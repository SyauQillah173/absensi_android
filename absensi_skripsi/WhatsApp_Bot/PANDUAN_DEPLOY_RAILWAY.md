# Panduan Deploy WhatsApp Bot ke Railway

Panduan ini untuk menjalankan Bot WhatsApp skripsi sementara sampai sidang.

## 1. Persiapan Repository

Pastikan perubahan bot sudah berada di GitHub. Railway akan mengambil source dari GitHub.

Folder service bot:

```text
absensi_skripsi/WhatsApp_Bot
```

Folder ini sudah memiliki:

```text
Dockerfile
package.json
server.js
api.js
public/dashboard.html
```

Railway akan memakai `Dockerfile` jika root service diarahkan ke folder bot.

## 2. Buat Project Railway

1. Buka Railway Dashboard.
2. Pilih **New Project**.
3. Pilih **Deploy from GitHub repo**.
4. Pilih repository `absensi_android`.
5. Pada pengaturan service, set **Root Directory**:

```text
absensi_skripsi/WhatsApp_Bot
```

6. Deploy.

### Jika Root Directory Tidak Bisa Diset

Kalau field **Root Directory** tidak muncul, tidak bisa diklik, atau tidak bisa disimpan, pakai cara fallback ini:

1. Deploy repository `absensi_android` dari root seperti biasa.
2. Biarkan **Root Directory** kosong atau `/`.
3. Railway akan membaca file `railway.json` di root repository.
4. Railway akan memakai `Dockerfile.railway-bot`.
5. Dockerfile tersebut tetap membuild bot dari folder:

```text
absensi_skripsi/WhatsApp_Bot
```

Jadi tidak masalah kalau Root Directory tidak bisa diatur, karena konfigurasi root sudah mengarahkan Railway ke bot WhatsApp skripsi.

## 3. Tambahkan Environment Variables

Masuk ke service bot -> **Variables** -> tambahkan:

```text
BOT_SECRET=isi_secret_acak_yang_sama_dengan_backend
AUTO_START_SESSION=true
DEFAULT_SESSION_ID=bot1
ADMIN_PHONE=628xxxxxxxxxx
NODE_ENV=production
```

Catatan:

- `PORT` tidak perlu diisi manual karena Railway menyediakannya otomatis.
- `BOT_SECRET` harus sama dengan `WHATSAPP_BOT_SECRET` pada backend Laravel skripsi.

## 4. Tambahkan Volume Railway

Volume dipakai agar sesi login WhatsApp tidak hilang ketika service restart.

1. Masuk service bot di Railway.
2. Buka menu **Volumes**.
3. Tambahkan volume baru.
4. Mount path contoh:

```text
/data
```

Railway otomatis menyediakan environment:

```text
RAILWAY_VOLUME_MOUNT_PATH=/data
```

Bot akan otomatis memakai path tersebut untuk menyimpan:

```text
/data/sessions
/data/logs
```

## 5. Buka Domain Bot

Setelah deploy berhasil, buat public domain Railway pada service bot.

Contoh URL:

```text
https://nama-service.up.railway.app
```

Cek health:

```text
https://nama-service.up.railway.app/health
```

Buka dashboard:

```text
https://nama-service.up.railway.app/dashboard
```

## 6. Scan QR WhatsApp

1. Buka dashboard bot.
2. Masukkan secret jika dashboard meminta secret.
3. Pastikan sesi `bot1` muncul.
4. Scan QR dengan WhatsApp HP:

```text
WhatsApp -> Perangkat Tertaut -> Tautkan Perangkat
```

5. Tunggu status menjadi `aktif`.

## 7. Uji Kirim Pesan dari Railway

Ganti URL dan secret sesuai Railway.

```powershell
Invoke-RestMethod -Method Post `
  -Uri https://nama-service.up.railway.app/kirim `
  -Headers @{ "x-bot-secret" = "isi_secret_acak_yang_sama_dengan_backend" } `
  -ContentType "application/json" `
  -Body '{"nomor":"628xxxxxxxxxx","pesan":"Tes notifikasi WhatsApp skripsi dari Railway"}'
```

Jika berhasil, response berisi `sukses: true`.

## 8. Sambungkan ke Backend Laravel Skripsi di Vercel

Pada environment backend Vercel skripsi, isi:

```text
WHATSAPP_BOT_URL=https://nama-service.up.railway.app
WHATSAPP_BOT_SECRET=isi_secret_acak_yang_sama_dengan_backend
WHATSAPP_BOT_TIMEOUT=20
WHATSAPP_DISPATCH_WHEN_SYNC_QUEUE=true
```

Setelah env diubah, redeploy backend Laravel skripsi.

## 9. Uji dari Aplikasi Android

1. Pastikan bot Railway status `aktif`.
2. Pastikan nomor wali santri valid.
3. Buka aplikasi Android skripsi.
4. Input presensi dengan status `Sakit`, `Izin`, atau `Alpa`.
5. Sinkronkan sampai data masuk server.
6. Backend membuat log notifikasi.
7. Bot Railway mengirim WhatsApp.

## Catatan Penting

- Railway cocok untuk uji sementara karena bot butuh service yang hidup terus.
- Jika service restart dan tidak memakai volume, QR harus scan ulang.
- Jangan commit `.env`, sesi WhatsApp, atau log.
- Gunakan nomor WhatsApp khusus bot untuk mengurangi risiko nomor utama terkena pembatasan.
