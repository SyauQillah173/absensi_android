# Panduan Bot WhatsApp Skripsi

Panduan ini khusus menghubungkan Bot WhatsApp dengan backend skripsi.

## Kesimpulan Deploy

Backend Laravel skripsi boleh berjalan di Vercel, tetapi Bot WhatsApp berbasis
`whatsapp-web.js` tidak disarankan berjalan di Vercel serverless.

Alasannya:

- bot membutuhkan proses Node.js yang hidup terus;
- bot membutuhkan Chromium/Puppeteer untuk WhatsApp Web;
- bot membutuhkan sesi login WhatsApp yang tersimpan;
- Vercel Functions tidak dirancang untuk proses browser persistent seperti ini.

Untuk uji skripsi, pilihan paling aman adalah:

1. Jalankan bot di laptop lokal, lalu expose dengan Cloudflare Tunnel atau ngrok.
2. Jalankan bot di VPS.
3. Jalankan bot di platform Node.js persistent seperti Railway, Render, atau Fly.io.

## Alur Integrasi Skripsi

```text
Android Skripsi
  -> Backend Laravel Skripsi di Vercel
  -> WhatsApp Bot URL
  -> WhatsApp wali santri
```

Backend memanggil endpoint bot:

```text
POST /kirim
Header: x-bot-secret
Body: nomor, pesan
```

## Konfigurasi Bot

Salin file contoh environment:

```powershell
cd C:\Users\Nobita\absensi_android\absensi_skripsi\WhatsApp_Bot
copy .env.example .env
```

Isi `.env`:

```text
BOT_SECRET=isi_secret_yang_sama_dengan_backend
PORT=3001
AUTO_START_SESSION=true
DEFAULT_SESSION_ID=bot1
ADMIN_PHONE=628xxxxxxxxxx
```

Jalankan bot:

```powershell
npm.cmd install
npm.cmd start
```

Buka dashboard:

```text
http://localhost:3001/dashboard
```

Jika belum ada sesi, bot otomatis membuat sesi `bot1`. Scan QR dari dashboard
dengan WhatsApp pada HP.

## Uji Kirim Lokal

```powershell
Invoke-RestMethod -Method Post `
  -Uri http://127.0.0.1:3001/kirim `
  -Headers @{ "x-bot-secret" = "isi_secret_yang_sama_dengan_backend" } `
  -ContentType "application/json" `
  -Body '{"nomor":"628xxxxxxxxxx","pesan":"Tes notifikasi skripsi"}'
```

## Menghubungkan Backend Vercel ke Bot Lokal

Jika bot dijalankan di laptop, backend Vercel tidak bisa memanggil
`localhost`. Gunakan tunnel.

Contoh dengan Cloudflare Tunnel:

```powershell
cloudflared tunnel --url http://localhost:3001
```

Atau dengan ngrok:

```powershell
ngrok http 3001
```

Setelah mendapat URL publik, isi environment backend Vercel:

```text
WHATSAPP_BOT_URL=https://url-tunnel-kamu
WHATSAPP_BOT_SECRET=isi_secret_yang_sama_dengan_bot
WHATSAPP_BOT_TIMEOUT=12
```

Setelah env diubah, redeploy backend Laravel skripsi di Vercel.

## Uji dari Backend

1. Pastikan bot status aktif.
2. Pastikan nomor wali santri valid, format `08...` atau `62...`.
3. Input presensi dengan status `Sakit`, `Izin`, atau `Alpa`.
4. Backend membuat log di `whatsapp_message_logs`.
5. Job backend memanggil bot `/kirim`.
6. Jika berhasil, status log menjadi `sent`.

## Catatan untuk BAB 4

Kalimat aman untuk skripsi:

```text
Bot WhatsApp dijalankan sebagai service terpisah karena membutuhkan proses
persistent dan sesi WhatsApp Web. Backend skripsi mengirimkan request ke bot
melalui endpoint REST API.
```

Jangan menulis bahwa Bot WhatsApp berjalan di Vercel, kecuali nanti benar-benar
menggunakan platform persistent yang mendukung browser WhatsApp Web.
