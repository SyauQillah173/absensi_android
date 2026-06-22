module.exports = {
    apps: [
        {
            name: 'wa-bot-qomaruddin',
            script: './server.js',
            cwd: __dirname,

            // Auto restart jika crash
            autorestart: true,
            watch: false,

            // Max memory 500MB sebelum restart otomatis
            max_memory_restart: '500M',

            // Environment
            env: {
                NODE_ENV: 'production'
            },

            // Log output ke file
            log_file: './logs/pm2-combined.log',
            out_file: './logs/pm2-out.log',
            error_file: './logs/pm2-error.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss',
            merge_logs: true,

            // Restart delay jika crash berulang
            restart_delay: 5000,
            max_restarts: 10,
            min_uptime: '10s',

            // Kill timeout (beri waktu graceful shutdown)
            kill_timeout: 5000
        }
    ]
};
