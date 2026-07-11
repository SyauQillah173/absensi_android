# CATATAN DRAFT BAB IV DAN BAB V

Judul:

Pengembangan Sistem Presensi Madrasah Diniyah Berbasis Android dengan Arsitektur Offline-First dan Notifikasi WhatsApp (Studi Kasus Pondok Pesantren Qomaruddin)

Catatan:

- File ini dibuat sebagai bahan copas ke Word.
- Isi disusun berdasarkan project `absensi_skripsi`, bukan menyalin contoh skripsi kakak tingkat.
- Kerjakan pelan-pelan per subbab. Setelah subbab ini selesai dirapikan di Word, lanjutkan ke subbab berikutnya.

---

# BAB IV
# IMPLEMENTASI DAN PENGUJIAN SISTEM

## 4.1 Gambaran Umum Implementasi Sistem

Pada bab ini dijelaskan hasil implementasi sistem presensi Madrasah Diniyah berbasis Android yang telah dirancang pada bab sebelumnya. Sistem ini dibuat untuk membantu admin dan guru dalam mengelola data santri, guru, kelas, mencatat presensi, melihat riwayat presensi, serta melakukan sinkronisasi data ke server.

Aplikasi dikembangkan menggunakan Flutter sebagai aplikasi Android. Pada sisi server, sistem menggunakan Laravel REST API yang terhubung dengan database PostgreSQL khusus skripsi. Database tersebut dipisahkan dari database project utama agar proses pengujian dan demo aplikasi skripsi tidak mengganggu data operasional yang sebenarnya.

Sistem ini menerapkan konsep offline-first. Dengan konsep tersebut, data presensi tetap dapat disimpan terlebih dahulu pada perangkat Android walaupun koneksi internet tidak stabil. Data yang belum terkirim akan masuk ke antrean sinkronisasi, kemudian dikirim secara otomatis ke server ketika koneksi tersedia. Status sinkronisasi ditampilkan pada aplikasi, seperti pending, syncing, completed, atau failed.

Hak akses sistem dibagi menjadi dua, yaitu admin dan guru. Admin dapat mengelola data master seperti guru, kelas, dan santri, serta melihat data presensi. Guru dapat melakukan pencatatan presensi dan melihat riwayat presensi sesuai data yang tersedia pada aplikasi. Selain itu, sistem juga mendukung notifikasi WhatsApp sebagai fitur pendukung untuk menyampaikan informasi presensi tertentu kepada wali santri.

Dengan implementasi tersebut, sistem yang dibangun sudah mencakup fitur utama yang dibutuhkan, yaitu pengelolaan data master, pencatatan presensi, penyimpanan lokal, sinkronisasi data, hak akses pengguna, serta dukungan notifikasi WhatsApp.

Ringkasan komponen implementasi sistem dapat dilihat pada tabel berikut.

| Komponen | Implementasi |
|---|---|
| Aplikasi mobile | Flutter Android |
| Backend | Laravel REST API |
| Database server | PostgreSQL khusus skripsi |
| Database lokal | Room Database terenkripsi |
| Autentikasi | Token API |
| Aktor sistem | Admin dan Guru |
| Sinkronisasi | Outbox lokal, foreground sync, dan WorkManager |
| Notifikasi | WhatsApp Bot sebagai service pendukung |

## 4.2 Implementasi Database

Implementasi database pada sistem presensi Madrasah Diniyah dibuat untuk menyimpan data pengguna, data master, data presensi, data sinkronisasi, dan data notifikasi. Database server yang digunakan adalah PostgreSQL khusus untuk project skripsi. Pemisahan database ini dilakukan agar proses pengujian aplikasi tidak mengganggu data pada project utama.

Tabel utama yang digunakan pada sistem ini terdiri dari tabel `users`, `guru`, `kelas`, `santri`, `presensi`, dan `detail_presensi`. Tabel `users` digunakan untuk menyimpan data akun login admin dan guru. Tabel `guru` digunakan untuk menyimpan data guru atau ustadz yang terhubung dengan akun pengguna. Tabel `kelas` digunakan untuk menyimpan data kelas Madrasah Diniyah, sedangkan tabel `santri` digunakan untuk menyimpan data santri beserta data wali santri.

Data presensi disimpan dalam dua tabel, yaitu `presensi` dan `detail_presensi`. Tabel `presensi` digunakan sebagai tabel utama yang menyimpan informasi sesi presensi, seperti guru, kelas, tanggal, waktu mulai, dan catatan. Tabel `detail_presensi` digunakan untuk menyimpan detail kehadiran setiap santri pada sesi presensi tersebut, seperti status hadir, sakit, izin, atau alpa, serta keterangan tambahan jika diperlukan.

Selain tabel utama, sistem juga menggunakan beberapa tabel pendukung. Tabel `api_access_tokens` digunakan untuk menyimpan token login pengguna. Tabel `sync_operations` digunakan untuk mencatat proses sinkronisasi data dari aplikasi Android ke server. Tabel `whatsapp_message_logs` digunakan untuk mencatat data notifikasi WhatsApp yang akan dikirim kepada wali santri. Tabel `audit_logs` digunakan sebagai catatan aktivitas perubahan data pada sistem.

Pada aplikasi Android, data juga disimpan secara lokal menggunakan Room Database terenkripsi. Database lokal digunakan untuk menyimpan data master dan antrean presensi sebelum dikirim ke server. Dengan adanya database lokal, aplikasi tetap dapat digunakan meskipun koneksi internet sedang tidak stabil. Setelah koneksi tersedia, data yang masih berstatus pending akan dikirim ke server melalui proses sinkronisasi.

Dengan rancangan database tersebut, sistem dapat mengelola data presensi secara lebih terstruktur. Data sesi presensi dan detail santri dipisahkan sehingga satu sesi presensi dapat memiliki banyak detail kehadiran santri. Selain itu, adanya tabel sinkronisasi dan log notifikasi mendukung konsep offline-first dan integrasi WhatsApp pada sistem.

Catatan screenshot untuk Word:

- Screenshot struktur tabel database atau migration database skripsi.
- Screenshot boleh diambil dari folder migration Laravel, database tool, atau halaman database jika tersedia.
- Caption yang disarankan: Gambar 4.2 Implementasi Database Sistem.

---

Subbab berikutnya:

## 4.3 Implementasi Antarmuka Aplikasi

Implementasi antarmuka aplikasi dibuat sederhana agar mudah digunakan oleh admin dan guru. Tampilan aplikasi disusun dengan konsep mobile-first sehingga setiap menu dapat diakses melalui perangkat Android. Antarmuka dibuat menggunakan Flutter dengan komponen Material Design.

Halaman pertama yang digunakan adalah halaman login. Pada halaman ini, pengguna memasukkan username dan password untuk masuk ke dalam sistem. Setelah login berhasil, pengguna diarahkan ke halaman utama sesuai hak aksesnya. Sistem membedakan hak akses admin dan guru sehingga menu yang ditampilkan dapat menyesuaikan peran pengguna.

Halaman beranda digunakan untuk menampilkan informasi awal pengguna dan status sinkronisasi data. Pada halaman ini pengguna dapat melihat apakah semua data sudah tersinkronisasi atau masih terdapat data yang menunggu pengiriman ke server. Tombol sinkronisasi juga disediakan agar pengguna dapat mencoba mengirim data secara manual apabila masih terdapat data pending.

Halaman presensi digunakan untuk mencatat kehadiran santri. Guru atau admin memilih kelas, tanggal, dan waktu presensi, kemudian menentukan status kehadiran setiap santri. Status yang digunakan meliputi Hadir, Sakit, Izin, dan Alpa. Jika status santri bukan Hadir, pengguna dapat menambahkan keterangan tambahan.

Halaman riwayat digunakan untuk menampilkan data presensi yang sudah pernah disimpan. Pada halaman ini pengguna dapat melihat tanggal, waktu, kelas, jumlah kehadiran, dan status sinkronisasi. Selain itu, sistem juga menyediakan fitur edit presensi agar data yang salah dapat diperbaiki dan dikirim ulang ke server.

Halaman buku induk digunakan oleh admin untuk mengelola data master. Data yang dikelola meliputi data santri, data kelas, dan data guru. Pada halaman ini admin dapat menambah, mengubah, menghapus atau menonaktifkan data. Selain input manual, sistem juga menyediakan fitur import Excel untuk mempercepat proses memasukkan data santri dalam jumlah banyak.

Dengan implementasi antarmuka tersebut, aplikasi dapat digunakan sesuai kebutuhan utama sistem, yaitu login pengguna, pengelolaan data master, pencatatan presensi, riwayat presensi, dan sinkronisasi data.

Catatan screenshot untuk Word:

- Screenshot halaman Login.
- Screenshot halaman Beranda.
- Screenshot halaman Presensi.
- Screenshot halaman Riwayat.
- Screenshot halaman Buku Induk.

Caption yang disarankan:

- Gambar 4.4 Halaman Login Aplikasi
- Gambar 4.5 Halaman Beranda Aplikasi
- Gambar 4.6 Halaman Input Presensi
- Gambar 4.7 Halaman Riwayat Presensi
- Gambar 4.8 Halaman Buku Induk

---

Subbab berikutnya:

## 4.4 Implementasi Proses Presensi dan Sinkronisasi

Implementasi proses presensi dibuat dengan menyesuaikan kebutuhan guru dalam mencatat kehadiran santri. Pada halaman presensi, pengguna memilih kelas, tanggal, dan waktu presensi. Setelah itu, aplikasi menampilkan daftar santri pada kelas tersebut. Setiap santri dapat diberi status Hadir, Sakit, Izin, atau Alpa. Jika status yang dipilih bukan Hadir, pengguna dapat menambahkan keterangan sebagai informasi tambahan.

Ketika tombol simpan ditekan, data presensi tidak langsung bergantung pada koneksi server. Data terlebih dahulu disimpan ke database lokal pada perangkat Android. Penyimpanan lokal ini bertujuan agar proses input presensi tetap dapat dilakukan walaupun koneksi internet tidak stabil. Setelah data berhasil tersimpan secara lokal, aplikasi akan memasukkan data tersebut ke antrean sinkronisasi.

Proses sinkronisasi dilakukan dengan mengirimkan data yang masih berstatus pending ke backend Laravel. Jika data berhasil diterima server, status sinkronisasi akan berubah menjadi completed. Namun jika terjadi kendala, seperti koneksi terputus atau server menolak data, status akan berubah menjadi failed dan dapat dicoba kembali. Aplikasi juga menyediakan tombol sinkronisasi manual pada halaman beranda.

Selain pencatatan presensi baru, sistem juga mendukung proses edit presensi. Fitur ini digunakan apabila terdapat kesalahan dalam pengisian status kehadiran santri. Data yang sudah diedit akan disimpan kembali ke database lokal, kemudian dikirim ulang ke server melalui proses sinkronisasi. Dengan cara ini, perubahan data presensi tetap dapat tercatat baik di perangkat maupun di database server.

Untuk mendukung sinkronisasi otomatis, aplikasi menggunakan mekanisme foreground sync dan WorkManager. Foreground sync digunakan ketika aplikasi sedang dibuka, sedangkan WorkManager digunakan sebagai proses latar belakang agar data yang belum terkirim dapat dicoba kembali saat koneksi tersedia. Dengan mekanisme tersebut, sistem dapat menjaga data presensi tetap aman dan tidak hilang meskipun jaringan tidak stabil.

Dengan adanya proses presensi dan sinkronisasi ini, aplikasi dapat digunakan secara fleksibel. Guru dapat tetap mencatat presensi tanpa harus menunggu koneksi internet stabil, sedangkan admin dapat memantau status data yang sudah masuk atau masih menunggu sinkronisasi.

Catatan screenshot untuk Word:

- Screenshot halaman input presensi sebelum disimpan.
- Screenshot status pending atau syncing pada beranda/riwayat.
- Screenshot status completed setelah data berhasil tersinkron.
- Screenshot halaman edit presensi jika tersedia.

Caption yang disarankan:

- Gambar 4.9 Proses Input Presensi Santri
- Gambar 4.10 Status Sinkronisasi Data Presensi
- Gambar 4.11 Proses Edit Presensi

---

Subbab berikutnya:

## 4.5 Implementasi Notifikasi WhatsApp

Implementasi notifikasi WhatsApp pada sistem ini digunakan sebagai fitur pendukung untuk menyampaikan informasi presensi kepada wali santri. Notifikasi dikirim setelah data presensi berhasil masuk ke server. Informasi yang dikirim meliputi nama santri, NISN, tanggal presensi, status kehadiran, kelas, mata pelajaran, dan keterangan apabila status santri adalah Sakit, Izin, atau Alpa.

Proses notifikasi diawali ketika pengguna menyimpan presensi pada aplikasi Android. Data presensi dikirim ke backend Laravel melalui proses sinkronisasi. Setelah backend menerima data tersebut, sistem membaca detail presensi setiap santri dan membuat pesan WhatsApp berdasarkan data yang tersimpan. Pesan dibuat sesuai kelas dan mata pelajaran yang dipilih pada saat presensi.

Format pesan yang digunakan adalah sebagai berikut:

```text
[Madrasah Diniyah]
Yth. Wali dari Nama Santri (NISN)
Status kehadiran Ananda pada hari ini (Hari, Tanggal Bulan Tahun) adalah
Status Kehadiran

Kelas: Nama Kelas
Mata Pelajaran: Nama Mata Pelajaran

Terimakasih.
```

Jika santri berstatus Sakit, Izin, atau Alpa dan pengguna mengisi keterangan, maka sistem menambahkan informasi keterangan pada pesan. Contohnya, jika santri berstatus Izin karena pulang kampung, maka pesan WhatsApp juga menampilkan keterangan tersebut.

Pengiriman pesan dilakukan melalui layanan WhatsApp Bot yang berjalan sebagai service terpisah. Backend Laravel bertugas membuat log notifikasi dan mengirim permintaan ke WhatsApp Bot, sedangkan WhatsApp Bot bertugas meneruskan pesan ke nomor wali santri. Pemisahan ini dilakukan karena WhatsApp Bot membutuhkan proses yang berjalan terus-menerus dan tidak dapat digabungkan langsung ke aplikasi Android.

Setiap percobaan pengiriman pesan dicatat pada tabel `whatsapp_message_logs`. Tabel ini menyimpan nomor tujuan, isi pesan, status pengiriman, waktu terkirim, dan pesan error apabila pengiriman gagal. Dengan adanya log tersebut, admin dapat mengetahui apakah notifikasi sudah terkirim atau masih mengalami kendala.

Dengan implementasi ini, sistem tidak hanya mencatat presensi santri, tetapi juga membantu penyampaian informasi kehadiran kepada wali santri secara otomatis melalui WhatsApp.

Catatan screenshot untuk Word:

- Screenshot halaman presensi yang menampilkan pilihan kelas dan mata pelajaran.
- Screenshot pesan WhatsApp yang berhasil terkirim ke nomor wali.
- Screenshot status bot WhatsApp aktif pada dashboard Railway.
- Screenshot log pengiriman pada endpoint atau dashboard bot jika diperlukan.

Caption yang disarankan:

- Gambar 4.12 Pemilihan Kelas dan Mata Pelajaran pada Presensi
- Gambar 4.13 Pesan Notifikasi WhatsApp kepada Wali Santri
- Gambar 4.14 Status Service WhatsApp Bot

---

Subbab berikutnya:

## 4.6 Pengujian Sistem

Pengujian sistem dilakukan untuk memastikan fitur pada aplikasi presensi Madrasah Diniyah dapat berjalan sesuai dengan kebutuhan pengguna. Metode pengujian yang digunakan adalah black box testing, yaitu pengujian yang berfokus pada fungsi sistem berdasarkan input dan output yang dihasilkan.

Pengujian dilakukan dengan menggunakan Google Form. Responden diminta mencoba aplikasi, kemudian memberikan hasil pengujian pada setiap skenario dengan pilihan Berhasil, Gagal, atau Tidak Diuji. Fitur yang diuji meliputi login, data master, pemilihan kelas dan mata pelajaran, input presensi, edit presensi, sinkronisasi, dan notifikasi WhatsApp.

Berdasarkan data Google Form yang direkap, terdapat 13 responden yang mengisi pengujian. Responden terdiri dari penguji umum, guru/ustadz, dan admin/operator. Hasil pengujian dapat dilihat pada tabel berikut.

| No | Skenario Pengujian | Berhasil | Gagal | Tidak Diuji | Keterangan |
|---|---|---:|---:|---:|---|
| 1 | Login menggunakan akun yang benar | 13 | 0 | 0 | Berhasil |
| 2 | Menampilkan data santri, kelas, dan mata pelajaran | 13 | 0 | 0 | Berhasil |
| 3 | Memilih kelas dan mata pelajaran sebelum presensi | 13 | 0 | 0 | Berhasil |
| 4 | Mengisi status presensi Hadir, Sakit, Izin, dan Alpa | 13 | 0 | 0 | Berhasil |
| 5 | Menambahkan keterangan pada status Sakit, Izin, atau Alpa | 13 | 0 | 0 | Berhasil |
| 6 | Menyimpan presensi dan menampilkan data pada Riwayat | 13 | 0 | 0 | Berhasil |
| 7 | Mengedit data presensi yang sudah tersimpan | 11 | 1 | 1 | Cukup berhasil |
| 8 | Sinkronisasi berubah menjadi completed setelah internet aktif | 13 | 0 | 0 | Berhasil |
| 9 | Notifikasi WhatsApp terkirim setelah presensi masuk server | 13 | 0 | 0 | Berhasil |
| 10 | Isi notifikasi WhatsApp menampilkan nama, status, kelas, mata pelajaran, dan keterangan | 13 | 0 | 0 | Berhasil |

Dari 130 jawaban skenario pengujian, terdapat 128 jawaban Berhasil, 1 jawaban Gagal, dan 1 jawaban Tidak Diuji. Jika dihitung berdasarkan seluruh jawaban, persentase keberhasilan pengujian adalah 98,46%. Hasil ini menunjukkan bahwa sebagian besar fitur utama aplikasi telah berjalan sesuai dengan hasil yang diharapkan.

Pada bagian kesimpulan pengujian, sebagian besar responden menyatakan bahwa aplikasi berjalan dengan baik. Terdapat beberapa responden yang menyatakan aplikasi berjalan cukup baik dengan sedikit kendala. Kendala tersebut berkaitan dengan fitur edit presensi yang masih perlu diperhatikan pada proses penggunaan. Meskipun demikian, fitur utama seperti login, data master, input presensi, sinkronisasi, dan notifikasi WhatsApp telah berhasil diuji.

Berdasarkan hasil pengujian black box tersebut, dapat disimpulkan bahwa aplikasi presensi Madrasah Diniyah berbasis Android telah berjalan sesuai dengan kebutuhan utama sistem. Aplikasi dapat digunakan untuk mencatat presensi, memilih kelas dan mata pelajaran, menyimpan data, melakukan sinkronisasi ke server, serta mengirim notifikasi WhatsApp kepada wali santri.

Catatan screenshot untuk Word:

- Screenshot tampilan Google Form pengujian black box.
- Screenshot tab Responses/Jawaban pada Google Form.
- Screenshot ringkasan hasil respons Google Form.
- Screenshot grafik hasil jawaban jika tersedia.
- Screenshot aplikasi saat diuji, seperti presensi, riwayat, dan notifikasi WhatsApp.

Caption yang disarankan:

- Gambar 4.15 Form Pengujian Black Box
- Gambar 4.16 Ringkasan Respons Pengujian Black Box
- Gambar 4.17 Hasil Pengujian Fitur Presensi
- Gambar 4.18 Hasil Pengujian Notifikasi WhatsApp

---

Subbab berikutnya:
## 4.7 Hasil Implementasi Sistem

Berdasarkan implementasi yang telah dilakukan, sistem presensi Madrasah Diniyah berbasis Android berhasil dibangun sesuai dengan kebutuhan utama yang telah dirancang. Sistem dapat digunakan oleh admin dan guru untuk mengelola data master, memilih kelas dan mata pelajaran, mencatat presensi santri, mengubah data presensi, melihat riwayat, serta melakukan sinkronisasi data ke server.

Pada sisi aplikasi Android, fitur utama dapat digunakan melalui beberapa menu, yaitu Beranda, Presensi, Riwayat, dan Buku Induk. Menu Beranda menampilkan informasi pengguna dan status sinkronisasi. Menu Presensi digunakan untuk memilih kelas, mata pelajaran, tanggal, waktu, serta mengisi status kehadiran santri. Menu Riwayat digunakan untuk melihat data presensi yang telah disimpan, sedangkan Buku Induk digunakan untuk mengelola data master seperti guru, kelas, mata pelajaran, dan santri.

Sistem juga berhasil menerapkan konsep offline-first. Data presensi yang disimpan pada aplikasi tidak langsung bergantung pada koneksi internet, melainkan disimpan terlebih dahulu pada database lokal. Jika koneksi tersedia, data akan dikirim ke server. Apabila koneksi belum tersedia, data akan tetap tersimpan sebagai antrean dan dikirim kembali saat koneksi aktif.

Pada sisi backend, sistem berhasil menyediakan API untuk login, data master, presensi, sinkronisasi, dan notifikasi WhatsApp. Backend juga menyimpan data presensi ke dalam tabel `presensi` dan `detail_presensi`, sehingga satu sesi presensi dapat memiliki banyak detail kehadiran santri. Selain itu, sistem menyimpan log notifikasi WhatsApp pada tabel `whatsapp_message_logs`.

Fitur notifikasi WhatsApp berhasil diintegrasikan sebagai layanan pendukung. Ketika data presensi masuk ke server, sistem membuat pesan yang berisi nama santri, NISN, status kehadiran, kelas, mata pelajaran, serta keterangan jika ada. Pesan tersebut kemudian dikirim ke nomor wali santri melalui WhatsApp Bot.

Dengan hasil implementasi tersebut, aplikasi yang dibangun telah memenuhi kebutuhan utama sistem presensi Madrasah Diniyah, yaitu pencatatan presensi, pengelolaan data master, penyimpanan lokal, sinkronisasi server, dan notifikasi kepada wali santri.

Catatan screenshot untuk Word:

- Screenshot menu utama aplikasi.
- Screenshot pilihan kelas dan mata pelajaran.
- Screenshot data presensi pada riwayat.
- Screenshot data masuk pada backend atau database jika tersedia.
- Screenshot pesan WhatsApp terkirim.

Caption yang disarankan:

- Gambar 4.20 Hasil Implementasi Menu Utama Aplikasi
- Gambar 4.21 Hasil Implementasi Presensi Berdasarkan Kelas dan Mata Pelajaran
- Gambar 4.22 Hasil Implementasi Riwayat Presensi
- Gambar 4.23 Hasil Implementasi Notifikasi WhatsApp

---

Subbab berikutnya:

## 4.8 Pembahasan

Berdasarkan hasil implementasi dan pengujian, sistem presensi Madrasah Diniyah yang dibangun telah mampu memenuhi kebutuhan utama pencatatan kehadiran santri. Aplikasi menyediakan fitur login, pengelolaan data master, pemilihan kelas dan mata pelajaran, input presensi, edit presensi, riwayat presensi, sinkronisasi data, serta notifikasi WhatsApp kepada wali santri.

Penerapan konsep offline-first menjadi salah satu bagian penting dalam sistem ini. Dengan adanya penyimpanan lokal, proses pencatatan presensi tetap dapat dilakukan walaupun koneksi internet tidak stabil. Data yang belum terkirim akan disimpan sebagai antrean dan dikirim ke server ketika koneksi tersedia. Hal ini membantu mengurangi risiko kehilangan data presensi saat proses input dilakukan di lingkungan dengan jaringan yang kurang stabil.

Fitur pemilihan kelas dan mata pelajaran membuat proses presensi menjadi lebih terarah. Setiap data presensi tidak hanya mencatat kehadiran santri, tetapi juga mencatat kelas dan mata pelajaran yang sedang berlangsung. Informasi ini membuat data riwayat presensi menjadi lebih jelas dan dapat digunakan sebagai bahan laporan.

Integrasi notifikasi WhatsApp juga memberikan nilai tambah pada sistem. Setelah data presensi berhasil masuk ke server, sistem dapat mengirimkan informasi kehadiran kepada wali santri. Pesan yang dikirim memuat nama santri, NISN, status kehadiran, kelas, mata pelajaran, serta keterangan apabila santri berstatus Sakit, Izin, atau Alpa. Dengan demikian, wali santri dapat memperoleh informasi presensi secara lebih cepat.

Meskipun sistem telah berjalan sesuai kebutuhan utama, masih terdapat beberapa hal yang dapat dikembangkan pada penelitian berikutnya. Sistem dapat dikembangkan dengan laporan presensi yang lebih lengkap, grafik kehadiran santri, pengaturan jadwal mata pelajaran yang lebih rinci, serta pengelolaan notifikasi WhatsApp yang lebih stabil untuk penggunaan jangka panjang.

Secara keseluruhan, aplikasi yang dibangun telah sesuai dengan tujuan penelitian, yaitu menghasilkan sistem presensi Madrasah Diniyah berbasis Android yang mendukung penyimpanan lokal, sinkronisasi server, dan notifikasi WhatsApp.

Catatan screenshot untuk Word:

- Tidak wajib banyak screenshot pada subbab pembahasan.
- Jika ingin menambah gambar, cukup gunakan screenshot rangkuman fitur utama atau hasil pengujian.

---

# BAB V
# PENUTUP

Subbab berikutnya:

## 5.1 Kesimpulan

Berdasarkan hasil perancangan, implementasi, dan pengujian yang telah dilakukan, dapat diambil beberapa kesimpulan sebagai berikut:

1. Sistem presensi Madrasah Diniyah berbasis Android berhasil dibangun untuk membantu proses pencatatan kehadiran santri. Aplikasi menyediakan fitur login, pengelolaan data master, pemilihan kelas dan mata pelajaran, input presensi, edit presensi, serta riwayat presensi.

2. Sistem berhasil menerapkan konsep offline-first dengan menyimpan data presensi terlebih dahulu pada database lokal di perangkat Android. Dengan konsep ini, pengguna tetap dapat mencatat presensi walaupun koneksi internet tidak stabil. Data yang belum terkirim akan masuk ke antrean sinkronisasi dan dikirim ke server ketika koneksi tersedia.

3. Backend Laravel berhasil digunakan sebagai REST API untuk mengelola data master, data presensi, sinkronisasi, dan notifikasi. Data presensi disimpan pada database server sehingga admin dan guru dapat memantau riwayat presensi yang telah tersinkronisasi.

4. Fitur notifikasi WhatsApp berhasil diintegrasikan sebagai layanan pendukung. Notifikasi dikirim kepada wali santri setelah data presensi berhasil diproses oleh server. Pesan yang dikirim memuat informasi nama santri, NISN, status kehadiran, kelas, mata pelajaran, dan keterangan apabila diperlukan.

5. Berdasarkan hasil pengujian, fitur utama sistem dapat berjalan sesuai kebutuhan. Aplikasi dapat digunakan untuk melakukan pencatatan presensi, menyimpan data secara lokal, menyinkronkan data ke server, mengubah data presensi, dan mengirim notifikasi WhatsApp.

Dengan demikian, sistem yang dibangun telah sesuai dengan tujuan penelitian, yaitu menghasilkan aplikasi presensi Madrasah Diniyah berbasis Android yang mendukung pencatatan presensi, penyimpanan lokal, sinkronisasi data, dan notifikasi kepada wali santri.

---

Subbab berikutnya:

## 5.2 Saran

Berdasarkan hasil penelitian dan implementasi sistem, terdapat beberapa saran yang dapat digunakan untuk pengembangan selanjutnya, yaitu:

1. Sistem dapat dikembangkan dengan fitur laporan presensi yang lebih lengkap, seperti rekap per santri, per kelas, per mata pelajaran, dan per periode tertentu. Dengan adanya laporan tersebut, admin dan guru dapat lebih mudah melihat perkembangan kehadiran santri.

2. Sistem dapat ditambahkan fitur grafik atau visualisasi data presensi. Grafik kehadiran dapat membantu pihak madrasah dalam memantau tingkat kehadiran santri secara lebih cepat dan mudah dipahami.

3. Fitur notifikasi WhatsApp dapat dikembangkan lebih lanjut agar lebih stabil untuk penggunaan jangka panjang. Pengembangan dapat dilakukan dengan menambahkan pengaturan template pesan, antrean pengiriman, dan monitoring status bot secara lebih lengkap.

4. Sistem dapat dikembangkan dengan fitur pengaturan jadwal mata pelajaran yang lebih rinci. Dengan adanya jadwal, proses presensi dapat disesuaikan dengan waktu pelajaran yang sebenarnya.

5. Aplikasi dapat dikembangkan agar mendukung dashboard web untuk admin. Dashboard web dapat memudahkan admin dalam mengelola data master, melihat laporan, dan memantau hasil presensi melalui perangkat komputer.

6. Pengujian pengguna dapat diperluas dengan melibatkan lebih banyak responden, seperti admin, guru, dan pihak madrasah. Dengan jumlah responden yang lebih banyak, hasil evaluasi aplikasi dapat menjadi lebih objektif.

Dengan adanya saran tersebut, diharapkan sistem presensi Madrasah Diniyah berbasis Android ini dapat dikembangkan menjadi sistem yang lebih lengkap, stabil, dan siap digunakan dalam lingkungan operasional yang lebih luas.

---

CATATAN AKHIR:

BAB IV dan BAB V pada file ini masih berupa draft bahan copas ke Word. Sesuaikan kembali penomoran gambar, tabel, dan hasil pengujian sesuai isi dokumen Word.

