require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const { startApi } = require('./api');
const fs = require('fs');
const path = require('path');

const sessionsDir = path.join(__dirname, 'sessions');
if (!fs.existsSync(sessionsDir)) {
    fs.mkdirSync(sessionsDir, { recursive: true });
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

    async createSession(clientId) {
        if (this.sessions.has(clientId)) return;

        const state = {
            client: null,
            status: 'initializing',
            qr: null,
            info: null,
            startTime: Date.now(),
            reconnectAttempt: 0,
            reconnectTimer: null
        };
        this.sessions.set(clientId, state);

        const client = new Client({
            authStrategy: new LocalAuth({ clientId: clientId, dataPath: './sessions' }),
            puppeteer: {
                headless: true,
                args: [
                    '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas', '--no-first-run', '--disable-gpu',
                    '--disable-blink-features=AutomationControlled',
                    '--disable-features=IsolateOrigins,site-per-process',
                    '--window-size=1366,768', '--disable-extensions',
                    '--disable-background-networking', '--disable-background-timer-throttling',
                    '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding',
                    '--disable-component-update', '--disable-default-apps',
                    '--disable-translate', '--metrics-recording-only',
                    '--no-default-browser-check', '--mute-audio'
                ]
            },
            userAgent: userAgents[Math.floor(Math.random() * userAgents.length)],
            restartOnAuthFail: true
        });

        state.client = client;

        client.on('qr', (qr) => {
            state.qr = qr;
            state.status = 'menunggu_qr';
            console.log(`📱 [${clientId}] QR Code baru tersedia.`);
        });

        client.on('loading_screen', (percent, message) => {
            state.status = 'loading';
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
            console.error(`❌ [${clientId}] Autentikasi gagal:`, msg);
        });

        client.on('ready', () => {
            state.qr = null;
            state.reconnectAttempt = 0;
            state.status = 'aktif';
            state.info = client.info;
            console.log(`✅ [${clientId}] SIAP! Nama: ${client.info.pushname} (${client.info.wid.user})`);
        });

        client.on('disconnected', async (reason) => {
            state.status = 'disconnected';
            console.warn(`⚠️ [${clientId}] Terputus:`, reason);
            this.attemptReconnect(clientId);
        });

        client.on('message', (msg) => {
            if (msg.body === '!ping') msg.reply('🏓 Pong! Bot aktif.');
        });

        try {
            await client.initialize();
        } catch (err) {
            console.error(`❌ [${clientId}] Gagal inisialisasi:`, err.message);
            state.status = 'error';
        }
    }

    async deleteSession(clientId) {
        const state = this.sessions.get(clientId);
        if (state) {
            if (state.reconnectTimer) clearTimeout(state.reconnectTimer);
            try {
                await state.client.destroy();
            } catch (e) {}
            this.sessions.delete(clientId);
            
            // Hapus folder sesi LocalAuth
            const sessionPath = path.join(sessionsDir, `session-${clientId}`);
            if (fs.existsSync(sessionPath)) {
                fs.rmSync(sessionPath, { recursive: true, force: true });
            }
        }
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
                await state.client.initialize();
            } catch (err) {
                if (state.reconnectAttempt < 10) {
                    this.attemptReconnect(clientId);
                } else {
                    state.status = 'error';
                    console.error(`⛔ [${clientId}] Menyerah reconnect.`);
                }
            }
        }, delayMs);
    }

    async loadExistingSessions() {
        if (!fs.existsSync(sessionsDir)) return;
        const files = fs.readdirSync(sessionsDir);
        for (const file of files) {
            if (file.startsWith('session-')) {
                const clientId = file.replace('session-', '');
                console.log(`🔄 Memuat sesi lama: ${clientId}`);
                await this.createSession(clientId);
            }
        }
    }
}

const sessionManager = new SessionManager();

console.log('');
console.log('╔════════════════════════════════════════╗');
console.log('║   🤖  WhatsApp Bot Qomaruddin v3       ║');
console.log('║   (Multi-Session & Enhanced Anti-Ban)  ║');
console.log('╚════════════════════════════════════════╝');
console.log('');

sessionManager.loadExistingSessions().then(() => {
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
    console.error('🔥 [UNCAUGHT]', err.message);
});
process.on('unhandledRejection', (err) => {
    console.error('🔥 [UNHANDLED]', err);
});
