# Absensi Skripsi Android

Project khusus skripsi:

> Pengembangan Sistem Presensi Madrasah Diniyah Berbasis Android dengan Arsitektur Offline-First dan Notifikasi WhatsApp (Studi Kasus Pondok Pesantren Qomaruddin)

## Cakupan Repo

- Aplikasi Android Flutter khusus skripsi.
- Backend Laravel pendukung API dengan database terpisah khusus skripsi.
- WhatsApp Bot pendukung notifikasi.
- `admin_web/` tidak ikut repo ini karena merupakan project real terpisah.

## Build APK

```bash
flutter pub get
flutter build apk --release --no-shrink
```

Jika backend skripsi sudah punya URL sendiri, build APK dengan:

```bash
flutter build apk --release --no-shrink --dart-define=API_BASE_URL=https://domain-backend-skripsi.vercel.app/api
```

Jika `API_BASE_URL` tidak diisi, aplikasi memakai default:

```text
https://absensi-android.vercel.app/api
```

Output APK:

```text
build/app/outputs/flutter-apk/app-release.apk
```

Catatan: release saat ini memakai debug signing bawaan Flutter untuk kebutuhan pengujian skripsi. Untuk distribusi production/Play Store, buat keystore release resmi.

## Push ke GitHub

Jika repo GitHub sudah dibuat:

```bash
git remote add origin https://github.com/USERNAME/NAMA_REPO.git
git branch -M main
git push -u origin main
```

Jika pakai SSH:

```bash
git remote add origin git@github.com:USERNAME/NAMA_REPO.git
git branch -M main
git push -u origin main
```

## Deploy Backend ke Vercel

Deploy dilakukan dari folder backend, bukan dari `admin_web`.

```bash
cd absensi_backend
npx vercel login
npx vercel --prod
```

Environment variable penting perlu diisi di Vercel sesuai `.env.example`, terutama:

- `APP_KEY`
- `APP_URL`
- `DB_CONNECTION`
- `DB_HOST`
- `DB_PORT`
- `DB_DATABASE`
- `DB_USERNAME`
- `DB_PASSWORD`
- `WHATSAPP_BOT_URL`

## Database Khusus Skripsi

Disarankan memakai database baru khusus skripsi agar CRUD dari aplikasi skripsi tidak mengubah data project real.

Alur aman:

1. Buat database PostgreSQL baru, misalnya di Neon atau Supabase.
2. Isi environment backend skripsi di Vercel dengan kredensial database baru.
3. Deploy backend skripsi.
4. Jalankan migration dan seeder untuk database skripsi.
5. Build APK dengan `API_BASE_URL` mengarah ke backend skripsi.

Contoh env database:

```text
DB_CONNECTION=pgsql
DB_HOST=host-database-skripsi
DB_PORT=5432
DB_DATABASE=absensi_skripsi
DB_USERNAME=user_database_skripsi
DB_PASSWORD=password_database_skripsi
DB_SSLMODE=require
```

Jika ingin memakai data awal dari project real, lakukan copy/backup sekali ke database skripsi. Setelah itu perubahan di aplikasi skripsi tidak akan memengaruhi database real.

Setelah backend punya URL baru, sesuaikan:

- build APK dengan `--dart-define=API_BASE_URL=...`
- `APP_URL` di Vercel backend

## Deploy WhatsApp Bot

WhatsApp bot tidak otomatis berjalan di Vercel static frontend. Jalankan sebagai service Node.js terpisah, lalu arahkan `WHATSAPP_BOT_URL` backend ke URL service tersebut.

```bash
cd WhatsApp_Bot
npm install
npm start
```

## Catatan Penting

- Jangan commit file `.env`.
- Jangan commit `admin_web/`.
- Database skripsi sebaiknya terpisah dari database project real.
