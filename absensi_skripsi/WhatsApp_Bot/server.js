require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const { startApi } = require('./api');
const fs = require('fs');
const path = require('path');
const { resolveDataDir, warnIfEphemeral } = require('./storage');

if (!process.env.BOT_SECRET) {
    console.error('BOT_SECRET belum diisi. Tambahkan BOT_SECRET pada Railway Variables lalu redeploy.');
    process.exit(1);
}

const dataDir = resolveDataDir();
const sessionsDir = path.join(dataDir, 'sessions');
if (!fs.existsSync(sessionsDir)) {
    fs.mkdirSync(sessionsDir, { recursive: true });
}
warnIfEphemeral(dataDir);
const browserPath = resolveBrowserPath();
console.log(`Data bot tersimpan di: ${dataDir}`);
console.log(`Browser Chrome: ${browserPath || 'default puppeteer'}`);
console.log(`Cache Puppeteer: ${process.env.PUPPETEER_CACHE_DIR || path.join(process.env.HOME || '/root', '.cache', 'puppeteer')}`);

function describeError(err) {
    if (!err) return 'Unknown error';
    if (typeof err === 'string') return err;
    if (err.message) return err.message;
    try {
        return JSON.stringify(err);
    } catch (e) {
        return String(err);
    }
}

function errorDetail(err) {
    if (!err) return { message: 'Unknown error' };
    if (err instanceof Error) {
        return { name: err.name, message: err.message, stack: err.stack };
    }
    if (typeof err === 'object') {
        return err;
    }
    return { message: String(err) };
}

// User Agent Rotation untuk Anti-Ban
const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
];

class SessionManager {
    constructor() {
        this.sessions = new Map(); // clientId -> state
    }

    async createSession(clientId, options = {}) {
        if (this.sessions.has(clientId)) return;
        const legacyAuth = options.legacyAuth === true;

        const state = {
            client: null,
            status: 'initializing',
            qr: null,
            info: null,
            startTime: Date.now(),
            reconnectAttempt: 0,
            reconnectTimer: null,
            authDirName: legacyAuth ? 'session' : `session-${clientId}`,
            legacyAuth,
            deleted: false,
            resetting: false,
            lastError: null
        };
        this.sessions.set(clientId, state);
        this.cleanupBrowserRuntimeFiles(state);

        const client = new Client({
            authStrategy: legacyAuth
                ? new LocalAuth({ dataPath: sessionsDir })
                : new LocalAuth({ clientId: clientId, dataPath: sessionsDir }),
            puppeteer: {
                executablePath: browserPath,
                headless: true,
                dumpio: true,
                protocolTimeout: parseInt(process.env.PUPPETEER_PROTOCOL_TIMEOUT || '300000', 10),
                timeout: parseInt(process.env.PUPPETEER_TIMEOUT || '120000', 10),
                args: [
                    '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas', '--no-first-run', '--disable-gpu',
                    '--disable-crash-reporter', '--disable-crashpad', '--disable-breakpad',
                    '--no-zygote',
                    '--disable-blink-features=AutomationControlled',
                    '--disable-features=IsolateOrigins,site-per-process,VizDisplayCompositor',
                    '--window-size=1366,768', '--disable-extensions',
                    '--disable-background-networking', '--disable-background-timer-throttling',
                    '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding',
                    '--disable-component-update', '--disable-default-apps',
                    '--disable-translate', '--metrics-recording-only',
                    '--no-default-browser-check', '--mute-audio',
                    '--password-store=basic', '--use-mock-keychain',
                    '--remote-debugging-port=0'
                ]
            },
            userAgent: userAgents[Math.floor(Math.random() * userAgents.length)],
            authTimeoutMs: parseInt(process.env.WA_AUTH_TIMEOUT_MS || '120000', 10),
            restartOnAuthFail: true
        });

        state.client = client;

        client.on('qr', (qr) => {
            state.qr = qr;
            state.status = 'menunggu_qr';
            console.log(`📱 [${clientId}] QR Code baru tersedia.`);
        });

        client.on('loading_screen', (percent, message) => {
            // WhatsApp Web can emit late loading events after ready; keep active sessions visible.
            if (state.status !== 'aktif') {
                state.status = 'loading';
            }
            console.log(`⏳ [${clientId}] Loading: ${percent}% — ${message}`);
        });

        client.on('authenticated', () => {
            state.qr = null;
            state.status = 'authenticated';
            console.log(`✅ [${clientId}] Terautentikasi`);
        });

        client.on('auth_failure', (msg) => {
            state.qr = null;
            state.status = 'error';
            state.lastError = describeError(msg || 'Autentikasi WhatsApp gagal');
            console.error(`❌ [${clientId}] Autentikasi gagal:`, msg);
        });

        client.on('ready', () => {
            state.qr = null;
            state.reconnectAttempt = 0;
            state.status = 'aktif';
            state.lastError = null;
            state.info = client.info;
            console.log(`✅ [${clientId}] SIAP! Nama: ${client.info.pushname} (${client.info.wid.user})`);
        });

        client.on('disconnected', async (reason) => {
            if (state.deleted || state.resetting) return;
            state.status = 'disconnected';
            console.warn(`⚠️ [${clientId}] Terputus:`, reason);
            if (this.isLogoutReason(reason)) {
                await this.resetSessionForRescan(clientId, reason);
                return;
            }
            this.attemptReconnect(clientId);
        });

        client.on('message', (msg) => {
            if (msg.body === '!ping') msg.reply('🏓 Pong! Bot aktif.');
        });

        try {
            await client.initialize();
        } catch (err) {
            const message = describeError(err);
            this.logError(clientId, 'Gagal inisialisasi', err);
            console.error(`❌ [${clientId}] Gagal inisialisasi:`, message);
            state.status = 'error';
            state.lastError = message;
            this.cleanupBrowserRuntimeFiles(state);
        }
    }

    async deleteSession(clientId) {
        const state = this.sessions.get(clientId);
        if (state) {
            state.deleted = true;
            state.status = 'logout';
            state.qr = null;
            state.info = null;
            if (state.reconnectTimer) clearTimeout(state.reconnectTimer);
            try {
                await state.client.logout();
            } catch (e) {}
            try {
                await state.client.destroy();
            } catch (e) {}
            this.sessions.delete(clientId);
            this.cleanupSessionFiles(state);
        }
    }

    async resetSessionForRescan(clientId, reason) {
        const state = this.sessions.get(clientId);
        if (!state || state.resetting || state.deleted) return;

        state.resetting = true;
        state.status = 'logout';
        state.qr = null;
        state.info = null;
        if (state.reconnectTimer) clearTimeout(state.reconnectTimer);

        console.warn(`🚪 [${clientId}] Logout terdeteksi (${reason}). Membersihkan sesi untuk scan ulang...`);
        try {
            await state.client.destroy();
        } catch (e) {}
        this.cleanupSessionFiles(state);
        this.sessions.delete(clientId);

        setTimeout(() => {
            this.createSession(clientId, { legacyAuth: state.legacyAuth }).catch((err) => {
                console.error(`❌ [${clientId}] Gagal membuat sesi scan ulang:`, describeError(err));
            });
        }, 1000);
    }

    async restartSession(clientId, reason = 'Restart diminta') {
        const state = this.sessions.get(clientId);
        if (!state || state.resetting || state.deleted) return;

        state.resetting = true;
        state.status = 'restarting';
        state.lastError = reason;
        if (state.reconnectTimer) clearTimeout(state.reconnectTimer);

        console.warn(`Restart sesi ${clientId}: ${reason}`);
        try {
            await state.client.destroy();
        } catch (e) {}

        const legacyAuth = state.legacyAuth;
        this.sessions.delete(clientId);
        setTimeout(() => {
            this.createSession(clientId, { legacyAuth }).catch((err) => {
                console.error(`Gagal restart sesi ${clientId}:`, describeError(err));
            });
        }, 1500);
    }

    cleanupSessionFiles(state) {
        const targets = [
            path.join(sessionsDir, state.authDirName),
            path.join(dataDir, '.wwebjs_auth', state.authDirName),
        ];
        for (const target of targets) {
            if (fs.existsSync(target)) {
                fs.rmSync(target, { recursive: true, force: true });
            }
        }
    }

    cleanupBrowserRuntimeFiles(state) {
        const sessionRoot = path.join(sessionsDir, state.authDirName);
        const targets = [
            'SingletonLock',
            'SingletonSocket',
            'SingletonCookie',
            'DevToolsActivePort',
            'chrome_debug.log',
            path.join('Default', 'LOCK'),
        ];

        for (const relativeTarget of targets) {
            const target = path.join(sessionRoot, relativeTarget);
            try {
                if (fs.existsSync(target)) {
                    fs.rmSync(target, { recursive: true, force: true });
                }
            } catch (error) {
                console.warn(`Tidak bisa membersihkan file runtime ${target}: ${describeError(error)}`);
            }
        }
    }

    isLogoutReason(reason) {
        const text = String(reason || '').toUpperCase();
        return text.includes('LOGOUT') || text.includes('UNPAIRED') || text.includes('UNPAIRED_IDLE');
    }

    attemptReconnect(clientId) {
        const state = this.sessions.get(clientId);
        if (!state) return;
        
        state.reconnectAttempt++;
        const delays = [5000, 10000, 20000, 30000];
        const delayMs = delays[Math.min(state.reconnectAttempt, delays.length - 1)];
        
        console.log(`🔄 [${clientId}] Reconnect #${state.reconnectAttempt} dalam ${delayMs/1000}s...`);
        
        state.reconnectTimer = setTimeout(async () => {
            try {
                try { await state.client.destroy(); } catch (e) {}
                this.cleanupBrowserRuntimeFiles(state);
                await state.client.initialize();
            } catch (err) {
                state.lastError = describeError(err);
                if (state.reconnectAttempt < 10) {
                    this.attemptReconnect(clientId);
                } else {
                    state.status = 'error';
                    console.error(`⛔ [${clientId}] Menyerah reconnect.`);
                }
            }
        }, delayMs);
    }

    logError(clientId, label, err) {
        const detail = errorDetail(err);
        console.error(`ERROR_DETAIL [${clientId}] ${label}:`, JSON.stringify(detail, null, 2));
    }

    async loadExistingSessions() {
        if (!fs.existsSync(sessionsDir)) return;
        const files = fs.readdirSync(sessionsDir);
        let hasMultiSession = false;
        for (const file of files) {
            if (file.startsWith('session-')) {
                hasMultiSession = true;
                const clientId = file.replace('session-', '');
                console.log(`🔄 Memuat sesi lama: ${clientId}`);
                this.createSession(clientId).catch((err) => this.logError(clientId, 'Gagal memuat sesi lama', err));
            }
        }
        if (files.includes('session') && !hasMultiSession) {
            console.log('🔄 Memuat sesi lama: bot1');
            this.createSession('bot1', { legacyAuth: true }).catch((err) => this.logError('bot1', 'Gagal memuat sesi lama', err));
        }
    }
}

const sessionManager = new SessionManager();

function resolveBrowserPath() {
    const candidates = [
        process.env.PUPPETEER_EXECUTABLE_PATH,
        process.env.CHROME_BIN,
        process.env.CHROMIUM_PATH,
        '/usr/bin/google-chrome-stable',
        '/usr/bin/google-chrome',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        '/opt/google/chrome/chrome',
    ].filter(Boolean);

    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
            return candidate;
        }
    }

    return undefined;
}

console.log('');
console.log('╔════════════════════════════════════════╗');
console.log('║   🤖  WhatsApp Bot Qomaruddin v3       ║');
console.log('║   (Multi-Session & Enhanced Anti-Ban)  ║');
console.log('╚════════════════════════════════════════╝');
console.log('');

sessionManager.loadExistingSessions().then(() => {
    const autoStart = process.env.AUTO_START_SESSION !== 'false';
    const defaultSessionId = process.env.DEFAULT_SESSION_ID || 'bot1';
    if (autoStart && sessionManager.sessions.size === 0) {
        console.log(`Membuat sesi default: ${defaultSessionId}`);
        setTimeout(() => {
            sessionManager.createSession(defaultSessionId).catch((err) => {
                console.error(`Gagal membuat sesi default ${defaultSessionId}:`, describeError(err));
            });
        }, 1000);
    }
    startApi(sessionManager);
});

process.on('SIGINT', async () => {
    console.log('\n🛑 Menutup bot...');
    for (const [id, state] of sessionManager.sessions.entries()) {
        if (state.reconnectTimer) clearTimeout(state.reconnectTimer);
        try { await state.client.destroy(); } catch(e){}
    }
    process.exit(0);
});

process.on('uncaughtException', (err) => {
    console.error('🔥 [UNCAUGHT]', describeError(err));
});
process.on('unhandledRejection', (err) => {
    console.error('🔥 [UNHANDLED]', err);
});
