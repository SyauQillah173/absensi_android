## 2.9 Notifikasi WhatsApp

Notifikasi WhatsApp merupakan salah satu media penyampaian informasi yang dapat digunakan untuk mengirimkan pesan secara cepat kepada pengguna. Dalam sistem presensi, notifikasi WhatsApp digunakan untuk memberikan informasi kehadiran santri kepada wali santri setelah data presensi berhasil tersimpan pada server.

Pada penelitian ini, pengiriman notifikasi tidak menggunakan WhatsApp Business API resmi, melainkan menggunakan layanan WhatsApp Bot yang berjalan pada server. WhatsApp Bot berfungsi sebagai penghubung antara backend sistem presensi dengan akun WhatsApp pengirim. Ketika data presensi berhasil diterima oleh server, sistem akan membentuk pesan notifikasi berisi nama santri, nomor induk, status kehadiran, kelas, mata pelajaran, dan keterangan apabila tersedia. Pesan tersebut kemudian dikirimkan kepada nomor wali santri melalui layanan WhatsApp Bot.

Penggunaan WhatsApp Bot dipilih karena sesuai dengan kebutuhan penelitian dan pengujian sistem, yaitu mengirimkan notifikasi presensi secara otomatis kepada wali santri. Dengan adanya layanan ini, guru atau admin tidak perlu mengirim pesan secara manual setelah melakukan presensi. Namun, berbeda dengan WhatsApp Business API resmi, layanan WhatsApp Bot tetap bergantung pada kondisi sesi akun WhatsApp pengirim, koneksi server, dan status autentikasi perangkat yang digunakan untuk menjalankan bot.

Dalam sistem yang dibangun, notifikasi WhatsApp terintegrasi dengan konsep offline-first. Aplikasi Android tetap dapat mencatat presensi meskipun koneksi internet belum tersedia. Data presensi terlebih dahulu disimpan pada database lokal dengan status belum tersinkronisasi. Ketika koneksi internet tersedia, sistem akan mengirimkan data presensi ke server. Setelah server berhasil menerima dan menyimpan data presensi, backend akan memanggil layanan WhatsApp Bot untuk mengirimkan notifikasi kepada wali santri.

Alur notifikasi WhatsApp dalam sistem presensi adalah sebagai berikut:

1. Guru atau admin mencatat presensi santri melalui aplikasi Android.
2. Data presensi disimpan terlebih dahulu pada database lokal aplikasi.
3. Jika koneksi internet belum tersedia, data akan diberi status menunggu sinkronisasi.
4. WorkManager mendeteksi data presensi yang belum tersinkronisasi.
5. Ketika koneksi internet tersedia, WorkManager mengirim data presensi ke server melalui REST API.
6. Server menerima data presensi dan melakukan validasi data.
7. Server menyimpan data presensi ke database server.
8. Server memanggil layanan WhatsApp Bot untuk mengirim notifikasi.
9. WhatsApp Bot mengirimkan pesan ke nomor wali santri.
10. Wali santri menerima pesan berisi informasi kehadiran santri.

Berdasarkan alur tersebut, notifikasi WhatsApp pada sistem ini berperan sebagai fitur pendukung untuk mempercepat penyampaian informasi presensi kepada wali santri. Notifikasi dikirim setelah data presensi berhasil tersimpan di server, sehingga informasi yang diterima wali santri sesuai dengan data presensi yang telah diproses oleh sistem.

Contoh format pesan notifikasi yang dikirimkan adalah sebagai berikut:

```
[Madrasah Diniyah]
Yth. Wali dari Nama Santri (NISN)
Pada hari ini, status kehadiran Ananda adalah Hadir.
Kelas: Sifir Awal A
Mata Pelajaran: Fiqih
Keterangan: -

Terima kasih.
```

Dengan adanya fitur notifikasi WhatsApp, sistem presensi tidak hanya berfungsi untuk mencatat data kehadiran, tetapi juga membantu pihak madrasah dalam menyampaikan informasi kepada wali santri secara lebih cepat dan otomatis.
