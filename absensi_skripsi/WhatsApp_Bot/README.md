# 🤖 WhatsApp Bot — Pondok Pesantren Qomaruddin

Bot WhatsApp notifikasi otomatis menggunakan **whatsapp-web.js**.
Dipakai untuk mengirim notifikasi tagihan, pembayaran, absensi, dan pengumuman
ke wali santri secara otomatis dari sistem backend.

---

## 📋 Fitur

- ✅ Scan QR code sekali, sesi tersimpan permanen
- ✅ REST API untuk kirim pesan (1 nomor atau bulk)
- ✅ Validasi nomor Indonesia otomatis
- ✅ Rate limiting (30 request/menit)
- ✅ Antrian retry otomatis untuk pesan gagal
- ✅ Logging ke file
- ✅ Dashboard monitoring web
- ✅ Auto reconnect jika koneksi putus
- ✅ PM2 ready untuk production
- ✅ Class PHP untuk integrasi Laravel

---

## 🚀 Cara Menjalankan Pertama Kali

### 1. Install Dependencies

```bash
cd WhatsApp_Bot
npm install
```

### 2. Konfigurasi Environment

Salin `.env.example` menjadi `.env` (sudah dibuat):

```bash
copy .env.example .env
```

Edit `.env` dan isi:
- `BOT_SECRET` — secret key acak untuk autentikasi API
- `ADMIN_PHONE` — nomor admin (format 62xxx)

### 3. Jalankan Bot

```bash
npm start
```

### 4. Scan QR Code

- QR code akan muncul di terminal
- Buka WhatsApp di HP → **Perangkat Tertaut** → **Tautkan Perangkat**
- Scan QR code dari terminal
- Setelah berhasil, bot akan menampilkan ✅ BOT WHATSAPP SIAP!

### 5. Buka Dashboard

Buka browser: **http://localhost:3001/dashboard**

---

## 📡 API Endpoints

### Tanpa Autentikasi

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/health` | Cek status bot + uptime |

### Dengan Header `x-bot-secret`

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/status` | Status lengkap bot |
| POST | `/kirim` | Kirim pesan ke 1 nomor |
| POST | `/kirim-bulk` | Kirim ke banyak nomor |
| GET | `/log?n=50` | Lihat log terakhir |
| GET | `/stats` | Statistik hari ini |
| GET | `/dashboard` | Halaman monitoring |

### Contoh Request

**Kirim 1 pesan:**
```bash
curl -X POST http://localhost:3001/kirim \
  -H "Content-Type: application/json" \
  -H "x-bot-secret: rahasia_bot_qomaruddin_2026" \
  -d '{"nomor": "6281234567890", "pesan": "Halo dari bot!"}'
```

**Kirim bulk:**
```bash
curl -X POST http://localhost:3001/kirim-bulk \
  -H "Content-Type: application/json" \
  -H "x-bot-secret: rahasia_bot_qomaruddin_2026" \
  -d '{"nomor": ["6281234567890", "6289876543210"], "pesan": "Pengumuman penting!"}'
```

**Cek status:**
```bash
curl http://localhost:3001/health
```

---

## 🔌 Integrasi Laravel

Class PHP tersedia di `integrations/php/WhatsAppBot.php`.

```php
$bot = new WhatsAppBot('http://localhost:3001', 'rahasia_bot_qomaruddin_2026');

// Kirim pesan
$bot->kirim('6281234567890', 'Halo dari Laravel!');

// Notifikasi tagihan
$bot->notifTagihanBaru('6281234567890', [
    'nama_santri'   => 'Ahmad Fauzi',
    'kelas'         => 'Sifir Awal A',
    'jenis_tagihan' => 'SPP Bulanan',
    'nominal'       => 350000,
    'jatuh_tempo'   => '15 Juli 2026',
]);
```

Jika ingin memakai dari Laravel, salin file ke:
```
absensi_backend/app/Services/WhatsAppBotService.php
```

---

## 🖥️ Deploy dengan PM2

```bash
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

Perintah PM2 penting:
```bash
pm2 status                  # Lihat status
pm2 logs wa-bot-qomaruddin  # Lihat log realtime
pm2 restart wa-bot-qomaruddin  # Restart bot
pm2 stop wa-bot-qomaruddin  # Stop bot
```

---

## 🔧 Troubleshooting

| Masalah | Solusi |
|---------|--------|
| QR tidak muncul | Pastikan Chromium terinstall. Di Linux: `sudo apt install chromium-browser` |
| Bot tidak bisa kirim pesan | Pastikan nomor sudah terdaftar WhatsApp |
| Chromium crash | Tambah memory swap jika di VPS kecil |
| Sesi expired | Hapus folder `./sessions` lalu jalankan ulang untuk scan QR baru |
| Port 3001 sudah dipakai | Ubah `PORT` di file `.env` |
| Error `ECONNREFUSED` dari PHP | Pastikan bot sudah jalan di port yang benar |

### Hapus Sesi dan Scan Ulang

```bash
# Stop bot dulu
pm2 stop wa-bot-qomaruddin   # atau Ctrl+C

# Hapus sesi
rmdir /s /q sessions          # Windows
rm -rf sessions               # Linux

# Jalankan ulang
npm start
# Scan QR baru
```

---

## 📂 Struktur Folder

```
WhatsApp_Bot/
├── server.js              # WhatsApp client core
├── api.js                 # Express REST API
├── package.json           # Dependencies
├── ecosystem.config.js    # PM2 config
├── .env                   # Environment variables
├── .env.example           # Contoh environment
├── .gitignore
├── README.md
├── public/
│   └── dashboard.html     # Dashboard monitoring
├── integrations/
│   └── php/
│       └── WhatsAppBot.php  # Class PHP integrasi
├── sessions/              # (auto-generated) Sesi WhatsApp
└── logs/                  # (auto-generated) Log pesan
```

---

## ⚠️ Catatan Penting

- **Gunakan nomor HP khusus bot**, jangan nomor pribadi
- Bot ini memakai library tidak resmi (whatsapp-web.js), ada risiko nomor terkena ban jika dipakai spam
- Kirim pesan secukupnya, jangan bulk ratusan pesan sekaligus
- Sesi WhatsApp tersimpan di folder `./sessions` — backup folder ini agar tidak perlu scan QR ulang
- Bot ini berjalan mandiri dan **tidak mengubah file apapun** di project Flutter, Laravel, atau admin_web
