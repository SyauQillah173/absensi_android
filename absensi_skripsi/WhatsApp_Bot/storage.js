const fs = require('fs');
const path = require('path');

function resolveDataDir() {
    const candidates = [
        process.env.BOT_DATA_DIR,
        process.env.RAILWAY_VOLUME_MOUNT_PATH,
        process.env.RAILWAY_ENVIRONMENT ? '/data' : null,
        __dirname,
    ].filter(Boolean);

    for (const candidate of candidates) {
        try {
            fs.mkdirSync(candidate, { recursive: true });
            fs.accessSync(candidate, fs.constants.W_OK);
            return path.resolve(candidate);
        } catch (error) {}
    }

    return __dirname;
}

function warnIfEphemeral(dataDir) {
    const railway = Boolean(process.env.RAILWAY_ENVIRONMENT);
    const hasVolumeEnv = Boolean(process.env.RAILWAY_VOLUME_MOUNT_PATH || process.env.BOT_DATA_DIR);
    if (railway && !hasVolumeEnv) {
        console.warn('PERINGATAN: Railway Volume belum terdeteksi dari environment. Pasang Volume dengan mount path /data agar sesi WhatsApp tidak hilang saat restart/redeploy.');
    } else if (railway && !dataDir.startsWith('/data')) {
        console.warn('PERINGATAN: Railway Volume /data belum aktif. Sesi WhatsApp bisa hilang saat restart/redeploy.');
    }
}

module.exports = { resolveDataDir, warnIfEphemeral };
