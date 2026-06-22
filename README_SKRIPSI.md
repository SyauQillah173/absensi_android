# Absensi Skripsi Android

Project khusus skripsi:

> Pengembangan Sistem Presensi Madrasah Diniyah Berbasis Android dengan Arsitektur Offline-First dan Notifikasi WhatsApp (Studi Kasus Pondok Pesantren Qomaruddin)

## Cakupan Repo

- Aplikasi Android Flutter khusus skripsi.
- Backend Laravel pendukung API dan database yang sama dengan project real.
- WhatsApp Bot pendukung notifikasi.
- `admin_web/` tidak ikut repo ini karena merupakan project real terpisah.

## Build APK

```bash
flutter pub get
flutter build apk --release
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

Setelah backend punya URL baru, sesuaikan:

- `lib/services/api_service.dart` pada `baseUrl`
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
- Database tetap mengikuti database yang sudah ada sesuai kebutuhan skripsi.
