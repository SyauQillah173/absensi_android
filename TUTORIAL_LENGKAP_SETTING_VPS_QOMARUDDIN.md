# 📚 BUKU PANDUAN & TUTORIAL LENGKAP SETTING VPS SINGAPURA
**Sistem Absensi Qomaruddin (Laravel Backend + React/Vite Frontend)**
*Disusun sebagai panduan belajar langkah demi langkah dari nol sampai online 24 jam dengan Auto-Deploy (CI/CD).*

---

## 🏛️ BAB 1: PERSIAPAN AWAL & INSTALASI AAPANEL DI VPS SINGAPURA
Langkah pertama adalah mempersiapkan server Cloud VPS (contoh: Tencent Cloud Lighthouse / DigitalOcean / AWS).

### 1. Reinstall OS VPS
* Pilihlah Sistem Operasi **Ubuntu 20.04 LTS** atau **Ubuntu 22.04 LTS** (sangat disarankan untuk stabilitas server web modern).

### 2. Buka Semua Port di Firewall Cloud (SANGAT PENTING!)
Sebelum menginstall apapun, pastikan gerbang depan cloud terbuka. Jika tidak, website yang sudah berjalan di VPS tidak akan bisa dibuka dari laptop abang.
* Login ke Web Panel penyedia VPS (contoh: Tencent Cloud Lighthouse -> menu **Firewall**).
* Klik tombol **Add rule** / **Tambah aturan**.
* Atur sebagai berikut:
  * **Protocol:** `ALL TCP` (Semua Protokol)
  * **Port:** `1-65535` (Semua Port)
  * **Policy / Action:** `Allow` (Izinkan)

### 3. Instalasi Mesin aaPanel (Control Panel Server)
* Buka terminal di laptop (Command Prompt / PowerShell / Putty) dan login ke VPS abang:
  ```bash
  ssh root@43.156.154.97
  ```
  *(Masukkan password VPS abang saat diminta).*
* Salin dan jalankan perintah instalasi aaPanel versi terbaru di terminal VPS:
  ```bash
  URL=https://www.aapanel.com/script/install_6.0_en.sh && if [ -f /usr/bin/curl ];then curl -ksSO "$URL" ;else wget --no-check-certificate -O install_6.0_en.sh "$URL";fi;bash install_6.0_en.sh aapanel
  ```
* Ketik `y` dan tekan Enter jika ditanya konfirmasi. Proses memakan waktu sekitar 3-5 menit.
* **CATAT INFORMASI PENTING DI AKHIR INSTALASI:**
  Di akhir instalasi, terminal akan mencetak alamat login, contoh:
  ```text
  aaPanel Internet Address: https://43.156.154.97:36696/xxxx
  username: xxxxx
  password: xxxxx
  ```
* 💡 **TIPS BELAJAR:** Jika suatu hari abang lupa alamat login atau port aaPanel, abang cukup login SSH ke terminal dan ketik perintah:
  ```bash
  bt 14
  ```

---

## 📦 BAB 2: INSTALASI PAKET DI DALAM AAPANEL (APP STORE)
Buka alamat aaPanel abang di browser (gunakan `https://...` dan port sesuai hasil instalasi).

Masuk ke menu **App Store** di aaPanel dan klik **Install** pada paket-paket berikut:
1. **Nginx** (Versi 1.22 ke atas) -> Berfungsi sebagai gerbang lalu lintas web (Web Server).
2. **PHP 8.3** *(atau sesuai kebutuhan Laravel abang)* -> Berfungsi menjalankan logika backend.
   * *Catatan Tambahan:* Klik menu **PHP-83** di aaPanel -> tab **Install extensions** -> Install `fileinfo`, `redis`, dan `pgsql` (jika menggunakan PostgreSQL).
3. **PostgreSQL** atau **MySQL/MariaDB** -> Berfungsi sebagai database penyimpanan absensi.
4. **PM2 Manager / Node.js Version Manager** -> Berfungsi menginstall **Node.js & NPM** untuk mem-build frontend.
5. **WebHook** (aaPanel WebHook) -> Berfungsi untuk sistem update otomatis (Auto-Deploy).

---

## ⚙️ BAB 3: UPLOAD & KONFIGURASI BACKEND LARAVEL (`absensi_backend`)

### 1. Buat Website Backend di aaPanel
* Klik menu **Website** -> Klik tombol **Add site**.
* **Domain:** Ketik IP VPS abang `43.156.154.97` (atau nama domain resmi jika sudah beli).
* **Root directory:** Arahkan tepat ke dalam folder `/public` Laravel abang!
  * Contoh: `/www/wwwroot/43.156.154.97/absensi_backend/public`
  * *(Sangat Penting: Laravel WAJIB diarahkan ke folder `public`, bukan folder luarnya!)*
* **PHP Version:** Pilih **PHP-83**. -> Klik **Submit**.

### 2. Atur URL Rewrite (Agar Endpoint API Tidak Error 404)
* Klik nama website `43.156.154.97` di tabel Website -> pilih tab menu **URL rewrite**.
* Pada kotak dropdown di kiri atas, pilih template **`Laravel`**.
* Isi kodingan rewrite akan otomatis muncul seperti ini:
  ```nginx
  location / {
      try_files $uri $uri/ /index.php?$query_string;
  }
  ```
* Klik tombol **Save**.

### 3. Pengaturan Terminal untuk Backend Laravel
Buka terminal SSH VPS dan lakukan ritual wajib Laravel:
```bash
# 1. Masuk ke folder proyek backend
cd /www/wwwroot/43.156.154.97/absensi_backend

# 2. Atur kepemilikan folder ke web server (www) agar bisa membaca/menulis file
chown -R www:www .
chmod -R 775 storage bootstrap/cache

# 3. Install dependency composer (tanpa paket dev)
composer install --no-dev --optimize-autoloader

# 4. Copy konfigurasi environment dan generate key (jika belum ada)
cp .env.example .env
php artisan key:generate

# 5. Jalankan migrasi tabel database dan seeder akun admin
php artisan migrate --seed --force
```

---

## 🖥️ BAB 4: SETUP FRONTEND WEB ADMIN (`admin_web` / Port 3000)
Jika abang ingin menjalankan frontend di dalam VPS Singapura juga (selain di Vercel):

### 1. Buat Website Frontend di aaPanel
* Di menu **Website** -> Klik **Add site**.
* **Domain:** Ketik `webadmin.local` -> Pada kolom port di bawahnya, ubah dari `80` menjadi **`3000`**.
  *(Sehingga web admin bisa diakses dari browser lewat alamat `http://43.156.154.97:3000`)*.
* **Root directory:** `/www/wwwroot/webadmin.local`. -> Klik **Submit**.

### 2. Build & Salin File Frontend
Melalui terminal SSH VPS:
```bash
# 1. Masuk ke folder mentahan React/Vite abang
cd /www/wwwroot/43.156.154.97/admin_web

# 2. Install library NPM
npm install

# 3. Build untuk produksi (menghasilkan folder /dist)
npm run build

# 4. Salin seluruh hasil build ke folder website port 3000 tadi
cp -r dist/* /www/wwwroot/webadmin.local/
chown -R www:www /www/wwwroot/webadmin.local/
```

---

## 🔓 BAB 5: MENGATASI GEMBOK KEAMANAN (CORS & CSP) - RAHASIA SUKSES LOGIN
Inilah ilmu paling mahal dan penting yang memecahkan masalah kenapa sebelumnya tombol Login menolak masuk padahal server 100% aktif!

### 1. Masalah CORS (Cross-Origin Resource Sharing)
* **Penyebab:** Browser melarang website di Port `3000` (atau dari Vercel) menelpon ke API di Port `80` karena dianggap "berbeda rumah/origin".
* **Solusi:** Di Laravel backend, pastikan header CORS mengizinkan origin frontend abang. Di Nginx, pastikan membalas permintaan preflight `OPTIONS` dengan status `204 No Content` atau `200 OK`.

### 2. Masalah CSP (Content Security Policy) di Browser
* **Penyebab:** Di dalam file `index.html` frontend abang terdapat aturan keamanan browser yang melarang penelponan ke alamat IP publik (hanya mengizinkan `localhost` atau `https://`). Eror merah di Console F12:
  `Refused to connect to http://43.156.154.97/api/login because it violates document's Content Security Policy`.
* **Solusi Langsung 1 Detik:** Hapus larangan IP dari file `index.html` dengan perintah terminal:
  ```bash
  sed -i 's/connect-src [^;]*;/connect-src * http: https: ws: wss:;/g' /www/wwwroot/webadmin.local/index.html
  ```
* Setelah itu wajib tekan **`Ctrl + Shift + R`** (Hard Refresh) di browser agar cache lama terbuang!

---

## 🤖 BAB 6: SISTEM AUTO-DEPLOY (CI/CD) DENGAN GITHUB WEBHOOK
Agar setiap kali abang mengedit kodingan di laptop lalu ketik `git push`, server VPS Singapura dan Vercel otomatis mengupdate dirinya sendiri dalam 3 detik!

### 1. Setup Plugin WebHook di aaPanel
* Buka menu **App Store** di aaPanel -> Buka plugin **WebHook** -> Klik **Add**.
* **Name:** `deploy_qomaruddin`
* **Execution script:**
  ```bash
  #!/bin/bash
  echo "=== MEMULAI AUTO REDEPLOY QOMARUDDIN ==="
  date
  
  echo "--> 1. Memperbarui Backend..."
  cd /www/wwwroot/43.156.154.97/absensi_backend
  git pull origin main
  composer install --no-dev --optimize-autoloader
  php artisan migrate --force
  php artisan config:cache
  php artisan route:cache
  chown -R www:www /www/wwwroot/43.156.154.97/absensi_backend

  echo "--> 2. Memperbarui Frontend (Port 3000)..."
  cd /www/wwwroot/43.156.154.97/admin_web
  git pull origin main
  npm install
  npm run build
  cp -r dist/* /www/wwwroot/webadmin.local/
  chown -R www:www /www/wwwroot/webadmin.local/
  
  echo "=== REDEPLOY DUA-DUANYA SELESAI 100% ==="
  ```
* Klik **Confirm**. Setelah itu klik tulisan **View key** / **URL** dan salin Key Rahasianya (contoh: `P27bQ9xkFc...`).

### 2. Mengatasi Blokir Port Webhook GitHub (Membuat Jembatan Port 80)
* **Masalah:** GitHub menolak mengirim sinyal ke nomor port tinggi aaPanel (`36696`) dengan eror `failed to connect to host`. GitHub hanya mau menelpon ke Port standar web (`80` / `443`).
* **Solusi Pintar:** Kita buatkan "Jembatan Nginx" di Port 80 yang otomatis meneruskan sinyal GitHub ke port 36696!
* Buka terminal SSH VPS dan jalankan perintah pembuatan jembatan ini:
  ```bash
  mkdir -p /www/server/panel/vhost/nginx/extension/43.156.154.97/
  
  echo -e "location /github-webhook {\n    proxy_pass https://127.0.0.1:36696/hook\$is_args\$args;\n    proxy_ssl_verify off;\n    proxy_set_header Host 127.0.0.1:36696;\n}" > /www/server/panel/vhost/nginx/extension/43.156.154.97/webhook.conf
  
  /etc/init.d/nginx reload
  ```

### 3. Daftarkan Jembatan Webhook ke GitHub Abang
* Buka repository kodingan abang di **GitHub.com** -> Klik tab menu **`Settings`** -> Klik menu **`Webhooks`** (di kiri).
* Klik tombol **Add webhook** (atau Edit webhook yang ada).
* Isi formulir dengan data jembatan Port 80 kita:
  * **Payload URL:**
    `http://43.156.154.97/github-webhook?access_key=KEY_RAHASIA_DARI_AAPANEL&param=main`
    *(Gantilah `KEY_RAHASIA_DARI_AAPANEL` dengan Key dari plugin WebHook aaPanel abang)*.
  * **Content type:** Pilih **`application/json`**.
  * **SSL verification:** Wajib pilih **`Disable (not recommended)`** *(karena masih menggunakan alamat IP HTTP)*.
  * **Which events?:** Pilih `Just the push event.`
* Klik **Update webhook** -> Lalu di tab **Recent Deliveries**, klik tombol **`Redeliver`** pada pengiriman sebelumnya.
* 🎯 **HASIL AKHIR:** Muncul ikon **Centang Hijau ✅** dan pesan `Last delivery was successful.`!

---

## 🏆 KESIMPULAN ALUR KERJA ABANG SEKARANG (CI/CD MODERN):
1. Abang mengedit kodingan proyek di laptop abang.
2. Abang mengetik 3 perintah di terminal laptop:
   ```bash
   git add .
   git commit -m "update fitur baru"
   git push
   ```
3. **Dalam waktu 3 detik:**
   * **Vercel** otomatis mem-build ulang tampilan Frontend Web Admin.
   * **VPS Singapura** otomatis menarik `git pull` terbaru dan memperbarui database Backend Laravel.
4. **Sistem Absensi Qomaruddin selalu online 24 jam dalam versi terbaru tanpa perlu upload manual lagi!** 🚀💪👑
