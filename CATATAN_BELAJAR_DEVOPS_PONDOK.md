# 🚀 Catatan Perjalanan DevOps: Sistem Informasi Pondok Pesantren Qomaruddin

Catatan ini merangkum seluruh perjuangan dan ilmu berharga yang kita dapatkan saat membangun, mengonfigurasi, dan memperbaiki *server* (VPS) hingga aplikasi web berhasil diakses dengan sempurna. Simpan catatan ini sebagai referensi abang di masa depan!

---

## 1. Arsitektur Aplikasi Kita (Modern Terpisah)
Kita menggunakan arsitektur modern yang memisahkan antara "Tampilan" dan "Mesin":
- **Frontend (Tampilan - React/Vite):** Disimpan di **Vercel**. Keunggulannya: Gratis, sangat cepat, dan menggunakan SSL (HTTPS) bawaan.
- **Backend (Mesin & Database - Laravel/PHP):** Disimpan di **VPS Ubuntu (aaPanel)** dengan IP `43.156.154.97`.
- Keduanya saling berkomunikasi menggunakan **API (Application Programming Interface)**.

---

## 2. Setting Domain & Cloudflare (Tameng Keamanan)
Kita menggunakan Cloudflare sebagai satpam (proxy) untuk melindungi server kita dari serangan *hacker/bot*.
- **Domain Utama (`sisteminformasipondok.my.id`):** Kita arahkan ke Vercel (menggunakan DNS tipe `CNAME` ke `cname.vercel-dns.com`). Ini agar orang yang mengetik nama web abang langsung melihat tampilan Frontend.
- **Subdomain API (`api.sisteminformasipondok.my.id`):** Kita buat khusus untuk mesin (Backend). Kita arahkan ke IP VPS `43.156.154.97` menggunakan DNS tipe `A Record`.
- **Mode SSL Cloudflare:** Kita atur menjadi **Flexible**. Artinya, Cloudflare akan melayani pengunjung dengan gembok hijau (`https`), lalu Cloudflare meneruskan datanya ke VPS kita melalui jalur biasa (`http`). Ini sangat jenius karena kita tidak perlu repot menginstal sertifikat SSL di dalam VPS.

---

## 3. Menghapus Captcha yang Rusak (Coding)
Karena tameng Cloudflare sudah sangat canggih menahan serangan, kita memutuskan untuk membuang fitur Captcha di halaman Login yang jadul dan malah *error* (gambarnya rusak karena ekstensi PHP `ext-gd` belum terinstal).
- **Backend:** Kita menghapus aturan wajib Captcha di dalam file `AuthController.php`.
- **Frontend:** Kita menghapus kotak input Captcha di halaman `LoginPage.tsx`.

---

## 4. Tragedi Hak Akses (Permissions) di VPS
Ini adalah pelajaran paling mahal dan sering dialami Programmer!
- **Masalah:** Saat abang menarik kodingan baru dari Github (`git pull`) di terminal VPS, abang sedang menggunakan akun **Root** (Raja). Akibatnya, kodingan baru tersebut dicap sebagai milik *Root*. Pelayan web kita (Nginx) yang beroperasi menggunakan akun `www` tidak punya izin untuk membacanya. Alhasil, muncullah *error 500* atau *Gagal terhubung*.
- **Mantra Solusi:** Setiap habis melakukan `git pull` di VPS, kita WAJIB membaca dua mantra ini untuk mengembalikan hak milik ke tangan Nginx:
  ```bash
  chown -R www:www .
  chmod -R 775 storage bootstrap/cache
  ```

---

## 5. Tragedi "URL Rewrite" (Error 404 Nginx)
- **Masalah:** Waktu Vercel memanggil `api/login`, aaPanel (Nginx) menolak dan memunculkan error **404 Not Found**. Kenapa? Karena Nginx mengira Vercel sedang mencari folder fisik bernama `api/login` di dalam server (yang tentu saja tidak ada). Nginx tidak tahu kalau alamat itu harus diserahkan ke Laravel.
- **Solusi:** Di menu **aaPanel > Website > URL Rewrite**, kita harus memilih aturan **`laravel`**. Aturan ini berisi kode:
  ```nginx
  location / {
      try_files $uri $uri/ /index.php?$query_string;
  }
  ```
  Kode ini memerintahkan Nginx: *"Hei, kalau foldernya tidak ada, jangan langsung tolak (404)! Tolong serahkan alamat itu ke `index.php` milik Laravel biar Laravel yang mikir!"*

---

## 6. Tragedi Sabuk Pengaman Vercel (Content Security Policy)
Ini musuh terakhir yang paling susah ditebak!
- **Masalah:** Di layar hitam (*Console*) muncul error merah panjang `Refused to connect... violates the Content Security Policy directive`. Ternyata, kodingan Tampilan kita punya "Sabuk Pengaman" yang secara keras memblokir panggilan ke alamat luar selain yang sudah terdaftar. Waktu kita buatkan alamat API baru (`api.sisteminformasipondok.my.id`), webnya sendiri mengira itu adalah *hacker* dan memblokirnya.
- **Solusi:** Kita membuka gembok sabuk pengaman itu. Ternyata gemboknya dikunci di dua tempat:
  1. Di dalam meta tag file HTML (`index.html`).
  2. Di pengaturan HTTP Headers file server Vercel (`vercel.json`).
- Kita menambahkan alamat API baru ke dalam parameter `connect-src` di kedua file tersebut, lalu mengunggahnya ke Vercel.

---

## 7. Tragedi Cache Browser (Memori Bandel Chrome)
- **Masalah:** Meskipun kodingan Vercel sudah diperbaiki, laptop abang tetap saja menampilkan error yang lama.
- **Penyebab:** Google Chrome sangat pintar menyimpan memori (*cache*) supaya web terasa lebih cepat. Dia malas mengunduh kodingan baru dari Vercel dan malah menampilkan kodingan rusak sisa kemarin.
- **Solusi:** Kita memaksa Chrome membuang ingatan lamanya dengan cara melakukan **Empty Cache and Hard Reload** atau menggunakan **Jendela Penyamaran (Incognito - CTRL+SHIFT+N)**.

---

### Kesimpulan
Perjalanan ini sangat luar biasa bang! Abang sudah merasakan langsung asam garam dunia *Server, Networking, DNS, Permissions,* hingga keamanan *Browser (CSP)*. Ini ilmu tingkat dewa yang biasanya baru dipelajari oleh programmer tingkat lanjut. Pertahankan semangat belajarnya bang! 🔥
