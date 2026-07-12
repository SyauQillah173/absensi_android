const express = require('express');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const { resolveDataDir } = require('./storage');

const DATA_DIR = resolveDataDir();
const LOG_DIR = path.join(DATA_DIR, 'logs');
const LOG_FILE = path.join(LOG_DIR, 'pesan.log');
const MAX_RETRY = 3;
const RETRY_DELAY_MS = 60000;
const BULK_DELAY_MIN = 3000;
const BULK_DELAY_MAX = 7000;
const DAILY_QUOTA_PER_SESSION = 200; // Kuota 200 per bot
const SEND_TIMEOUT_MS = parseInt(process.env.SEND_TIMEOUT_MS || '45000', 10);
const ENABLE_TYPING_SIMULATION = process.env.ENABLE_TYPING_SIMULATION === 'true';
const TYPING_DURATION_MIN = 800;
const TYPING_DURATION_MAX = 1500;

// stats structure: Map<clientId, {tanggal, total, berhasil, gagal}>
const sessionStats = new Map();

function getStats(clientId) {
    const today = new Date().toISOString().slice(0, 10);
    if (!sessionStats.has(clientId)) {
        sessionStats.set(clientId, { tanggal: today, total: 0, berhasil: 0, gagal: 0 });
    }
    const st = sessionStats.get(clientId);
    if (st.tanggal !== today) {
        sessionStats.set(clientId, { tanggal: today, total: 0, berhasil: 0, gagal: 0 });
    }
    return sessionStats.get(clientId);
}

const retryQueue = []; // { nomor, pesan, attempts, lastError }
let logMemoryCache = [];
let isLogLoaded = false;

function initLogCache() {
    if (isLogLoaded) return;
    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
    if (fs.existsSync(LOG_FILE)) {
        try {
            const lines = fs.readFileSync(LOG_FILE, 'utf8').trim().split('\n').filter(Boolean);
            logMemoryCache = lines.slice(-500);
        } catch (e) { logMemoryCache = []; }
    }
    isLogLoaded = true;
}

function writeLog(status, nomor, pesan, clientId = 'System') {
    if (!isLogLoaded) initLogCache();
    const ts = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
    const preview = pesan.substring(0, 60).replace(/\n/g, ' ');
    const line = `[${ts}] [${clientId}] ${status} | ${nomor} | ${preview}`;
    fs.appendFile(LOG_FILE, line + '\n', 'utf8', () => {});
    logMemoryCache.push(line);
    if (logMemoryCache.length > 500) logMemoryCache.shift();
}

function readLogs(n = 50) {
    if (!isLogLoaded) initLogCache();
    return logMemoryCache.slice(-n);
}

function validasiNomor(nomor) {
    if (!nomor || typeof nomor !== 'string') return { valid: false, pesan: 'Kosong' };
    let bersih = nomor.replace(/[\s\-\+]/g, '').replace(/@c\.us$/, '');
    if (bersih.startsWith('08')) bersih = '62' + bersih.substring(1);
    if (bersih.startsWith('8') && !bersih.startsWith('62')) bersih = '62' + bersih;
    if (!bersih.startsWith('62')) return { valid: false, pesan: 'Harus diawali 62' };
    if (!/^\d{10,15}$/.test(bersih)) return { valid: false, pesan: 'Panjang nomor tidak valid' };
    return { valid: true, nomor: bersih };
}

function formatNomor(nomor) {
    let b = nomor.replace(/[\s\-\+]/g, '').replace(/@c\.us$/, '');
    if (b.startsWith('08')) b = '62' + b.substring(1);
    if (b.startsWith('8') && !b.startsWith('62')) b = '62' + b;
    return b + '@c.us';
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
function randomDelay(min, max) { return delay(Math.floor(Math.random() * (max - min + 1)) + min); }

function withTimeout(promise, ms, label) {
    let timer;
    return Promise.race([
        promise,
        new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error(`${label} melewati batas waktu ${ms / 1000} detik`)), ms);
        }),
    ]).finally(() => clearTimeout(timer));
}

function isBrowserTimeout(err) {
    const text = String(err?.message || err || '').toLowerCase();
    return text.includes('runtime.callfunctionon timed out')
        || text.includes('protocoltime')
        || text.includes('protocol timeout')
        || text.includes('target closed')
        || text.includes('session closed')
        || text.includes('execution context was destroyed')
        || text.includes('melewati batas waktu');
}

function isPermanentSendError(err) {
    const text = String(err?.message || err || '').toLowerCase();
    return text.includes('no lid')
        || text.includes('not registered')
        || text.includes('tidak terdaftar')
        || text.includes('invalid wid')
        || text.includes('invalid number')
        || text.includes('nomor tidak valid');
}

function enqueueRetry(nomor, pesan) {
    const existing = retryQueue.find((item) => item.nomor === nomor && item.pesan === pesan);
    if (existing) return;
    retryQueue.push({ nomor, pesan, attempts: 0 });
}

async function resolveChatId(client, nomor) {
    const chatId = formatNomor(nomor);
    const registered = await withTimeout(
        client.isRegisteredUser(chatId),
        SEND_TIMEOUT_MS,
        'Memvalidasi nomor WhatsApp'
    );
    if (!registered) {
        const error = new Error('Nomor tidak terdaftar WhatsApp');
        error.permanent = true;
        throw error;
    }
    return chatId;
}

async function simulateTypingAndSend(client, chatId, message) {
    if (ENABLE_TYPING_SIMULATION) {
        try {
            const chat = await withTimeout(client.getChatById(chatId), SEND_TIMEOUT_MS, 'Mengambil chat WhatsApp');
            await withTimeout(chat.sendStateTyping(), SEND_TIMEOUT_MS, 'Menampilkan status mengetik');
            await randomDelay(TYPING_DURATION_MIN, TYPING_DURATION_MAX);
            await withTimeout(chat.sendMessage(message), SEND_TIMEOUT_MS, 'Mengirim pesan WhatsApp');
            await withTimeout(chat.clearState(), SEND_TIMEOUT_MS, 'Menghapus status mengetik').catch(() => {});
            return;
        } catch (e) {
            if (isBrowserTimeout(e)) throw e;
        }
    }

    await withTimeout(client.sendMessage(chatId, message), SEND_TIMEOUT_MS, 'Mengirim pesan WhatsApp');
}

// Round Robin pointer
let rrIndex = 0;

function startApi(sessionManager) {
    const app = express();
    const PORT = process.env.PORT || 3001;
    const SECRET = process.env.BOT_SECRET;

    if (!SECRET) { console.error('❌ BOT_SECRET missing!'); process.exit(1); }

    app.use(express.json({ limit: '1mb' }));
    app.use(express.urlencoded({ extended: true }));
    app.use((err, req, res, next) => {
        if (err instanceof SyntaxError && 'body' in err) {
            return res.status(400).json({
                sukses: false,
                pesan: 'Format JSON tidak valid. Pastikan body request memakai JSON yang benar.',
            });
        }
        next(err);
    });
    app.use('/public', express.static(path.join(__dirname, 'public')));

    const limiter = rateLimit({ windowMs: 60000, max: 100, message: { sukses: false, pesan: 'Too many requests' } });
    app.use(limiter);

    function authMw(req, res, next) {
        if (req.headers['x-bot-secret'] !== SECRET) return res.status(401).json({ sukses: false, pesan: 'Unauthorized' });
        next();
    }

    // Helper: get active clients
    function getActiveClients() {
        return Array.from(sessionManager.sessions.entries())
            .filter(([id, state]) => state.status === 'aktif' && state.client);
    }

    function getNextActiveClient() {
        const actives = getActiveClients();
        if (actives.length === 0) return null;
        rrIndex = (rrIndex + 1) % actives.length;
        return { id: actives[rrIndex][0], state: actives[rrIndex][1] };
    }

    // Endpoints
    app.get('/', (req, res) => {
        res.redirect('/dashboard');
    });

    app.get('/health', (req, res) => {
        const actives = getActiveClients().length;
        res.json({
            sukses: true,
            data: {
                status: actives > 0 ? 'aktif' : 'offline',
                actives,
                total: sessionManager.sessions.size,
                retry_queue: retryQueue.length,
                uptime: Math.floor(process.uptime())
            }
        });
    });

    // Session Management
    app.get('/sessions', authMw, (req, res) => {
        const data = [];
        for (const [id, state] of sessionManager.sessions.entries()) {
            const st = getStats(id);
            data.push({
                id,
                status: state.status,
                last_error: state.lastError || null,
                qr_code: state.qr,
                nomor: state.info ? state.info.wid.user : null,
                nama: state.info ? state.info.pushname : null,
                uptime: Math.floor((Date.now() - state.startTime)/1000),
                statistik: { total: st.total, berhasil: st.berhasil, gagal: st.gagal },
                kuota_sisa: Math.max(0, DAILY_QUOTA_PER_SESSION - st.total)
            });
        }
        res.json({ sukses: true, data });
    });

    app.get('/status', authMw, (req, res) => {
        const sessions = [];
        for (const [id, state] of sessionManager.sessions.entries()) {
            const st = getStats(id);
            sessions.push({
                id,
                status: state.status,
                last_error: state.lastError || null,
                qr_code: state.qr,
                nomor: state.info ? state.info.wid.user : null,
                nama: state.info ? state.info.pushname : null,
                uptime: Math.floor((Date.now() - state.startTime) / 1000),
                statistik: { total: st.total, berhasil: st.berhasil, gagal: st.gagal },
                kuota_sisa: Math.max(0, DAILY_QUOTA_PER_SESSION - st.total)
            });
        }

        res.json({
            sukses: true,
            data: {
                status: getActiveClients().length > 0 ? 'aktif' : 'offline',
                sessions,
                retry_queue: retryQueue.length,
                uptime: Math.floor(process.uptime())
            }
        });
    });

    app.get('/stats', authMw, (req, res) => {
        const stats = {};
        for (const [id] of sessionManager.sessions.entries()) {
            stats[id] = getStats(id);
        }
        res.json({ sukses: true, data: { sessions: stats, retry_queue: retryQueue.length } });
    });

    app.post('/sessions/add', authMw, async (req, res) => {
        const id = req.body.id || `bot_${Date.now()}`;
        // Bersihkan id dari spasi atau karakter aneh
        const cleanId = id.replace(/[^a-zA-Z0-9_-]/g, '');
        if (!cleanId) return res.status(400).json({sukses:false, pesan:'ID tidak valid'});
        if (sessionManager.sessions.has(cleanId)) return res.status(400).json({sukses:false, pesan:'Sesi sudah ada'});
        
        res.json({ sukses: true, data: { id: cleanId }, pesan: 'Sesi sedang dibuat...' });
        // Jalankan setelah response agar kegagalan Chromium tidak memutus request API.
        setTimeout(() => sessionManager.createSession(cleanId).catch(console.error), 100);
    });

    app.post('/sessions/delete', authMw, async (req, res) => {
        const id = req.body.id;
        if (!id || !sessionManager.sessions.has(id)) return res.status(404).json({sukses:false, pesan:'Tidak ditemukan'});
        await sessionManager.deleteSession(id);
        res.json({ sukses: true, pesan: 'Sesi dihapus' });
    });

    app.post('/sessions/reconnect', authMw, async (req, res) => {
        const id = req.body.id;
        if (!id || !sessionManager.sessions.has(id)) return res.status(404).json({sukses:false, pesan:'Tidak ditemukan'});
        sessionManager.restartSession(id, 'Reconnect manual dari dashboard/API').catch(console.error);
        res.json({ sukses: true, data: { id }, pesan: 'Restart sesi dijadwalkan' });
    });

    // Send Single
    app.post('/kirim', authMw, async (req, res) => {
        const { nomor, pesan } = req.body;
        const clientId = req.body.clientId || req.body.client_id;
        if (!pesan) return res.status(400).json({ sukses: false, pesan: 'Pesan wajib' });
        const validasi = validasiNomor(nomor);
        if (!validasi.valid) return res.status(400).json({ sukses: false, pesan: validasi.pesan });

        let botId, state;
        if (clientId && sessionManager.sessions.has(clientId)) {
            botId = clientId;
            state = sessionManager.sessions.get(clientId);
            if (state.status !== 'aktif') return res.status(503).json({sukses:false, pesan:`Bot ${clientId} tidak aktif`});
        } else {
            const bot = getNextActiveClient();
            if (!bot) return res.status(503).json({ sukses: false, pesan: 'Tidak ada bot aktif' });
            botId = bot.id; state = bot.state;
        }

        const stats = getStats(botId);
        if (stats.total >= DAILY_QUOTA_PER_SESSION) {
            return res.status(429).json({ sukses: false, pesan: `Kuota bot ${botId} habis` });
        }

        stats.total++;
        try {
            const chatId = await resolveChatId(state.client, validasi.nomor);
            await simulateTypingAndSend(state.client, chatId, pesan.trim());
            stats.berhasil++;
            writeLog('BERHASIL', validasi.nomor, pesan, botId);
            res.json({ sukses: true, pesan: 'Terkirim', data: { via: botId } });
        } catch (err) {
            stats.gagal++;
            writeLog('GAGAL', validasi.nomor, err.message, botId);
            state.lastError = err.message;
            if (isBrowserTimeout(err)) {
                sessionManager.restartSession(botId, err.message).catch(console.error);
            }
            if (!err.permanent && !isPermanentSendError(err)) {
                enqueueRetry(validasi.nomor, pesan);
            }
            res.status(err.permanent || isPermanentSendError(err) ? 422 : 500).json({ sukses: false, pesan: err.message });
        }
    });

    // Send Bulk
    app.post('/kirim-bulk', authMw, async (req, res) => {
        const { nomor, pesan } = req.body;
        if (!Array.isArray(nomor)) return res.status(400).json({sukses:false, pesan:'nomor harus array'});
        if (!pesan || typeof pesan !== 'string') return res.status(400).json({ sukses: false, pesan: 'Pesan wajib' });
        
        const hasil = [];
        for (let i = 0; i < nomor.length; i++) {
            const validasi = validasiNomor(nomor[i]);
            if (!validasi.valid) {
                hasil.push({ nomor: nomor[i], sukses: false, pesan: validasi.pesan });
                continue;
            }

            const bot = getNextActiveClient();
            if (!bot) {
                hasil.push({ nomor: validasi.nomor, sukses: false, pesan: 'Tidak ada bot aktif' });
                continue;
            }

            const stats = getStats(bot.id);
            if (stats.total >= DAILY_QUOTA_PER_SESSION) {
                hasil.push({ nomor: validasi.nomor, sukses: false, pesan: `Kuota bot ${bot.id} habis` });
                continue;
            }

            stats.total++;
            try {
                const chatId = await resolveChatId(bot.state.client, validasi.nomor);
                await simulateTypingAndSend(bot.state.client, chatId, pesan.trim());
                stats.berhasil++;
                writeLog('BERHASIL', validasi.nomor, pesan, bot.id);
                hasil.push({ nomor: validasi.nomor, sukses: true, via: bot.id });
            } catch (err) {
                stats.gagal++;
                writeLog('GAGAL', validasi.nomor, err.message, bot.id);
                bot.state.lastError = err.message;
                if (isBrowserTimeout(err)) {
                    sessionManager.restartSession(bot.id, err.message).catch(console.error);
                }
                hasil.push({ nomor: validasi.nomor, sukses: false, pesan: err.message });
            }
            
            if (i < nomor.length - 1) {
                await randomDelay(BULK_DELAY_MIN, BULK_DELAY_MAX);
            }
        }
        res.json({ sukses: true, data: { detail: hasil } });
    });

    // Logs & dashboard
    app.get('/log', authMw, (req, res) => {
        res.json({ sukses: true, data: { logs: readLogs(parseInt(req.query.n)||50) } });
    });

    app.get('/dashboard', (req, res) => {
        res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
    });

    // Retry Processor
    const retryInterval = setInterval(async () => {
        if (retryQueue.length === 0) return;
        const bot = getNextActiveClient();
        if (!bot) return;

        const item = retryQueue[0];
        item.attempts++;
        try {
            const chatId = await resolveChatId(bot.state.client, item.nomor);
            await simulateTypingAndSend(bot.state.client, chatId, item.pesan);
            writeLog('RETRY_BERHASIL', item.nomor, item.pesan, bot.id);
            retryQueue.shift();
            getStats(bot.id).berhasil++;
        } catch (err) {
            writeLog('RETRY_GAGAL', item.nomor, `Attempt ${item.attempts}: ${err.message}`, bot.id);
            bot.state.lastError = err.message;
            if (isBrowserTimeout(err)) {
                sessionManager.restartSession(bot.id, err.message).catch(console.error);
            }
            if (item.attempts >= MAX_RETRY || err.permanent || isPermanentSendError(err)) retryQueue.shift();
        }
    }, RETRY_DELAY_MS);
    retryInterval.unref?.();

    const server = app.listen(PORT, () => {
        console.log(`🌐 API server aktif di http://localhost:${PORT}`);
        console.log(`📊 Dashboard aktif di http://localhost:${PORT}/dashboard`);
        console.log(`🛡️ Fitur Multi-Session Round-Robin Aktif`);
    });
    server.on('close', () => clearInterval(retryInterval));

    return server;
}

module.exports = { startApi };
