## 2.8 REST API dan JSON pada Sistem Presensi

REST API (Representational State Transfer Application Programming Interface) merupakan pendekatan komunikasi antara client dan server yang menggunakan protokol HTTP. Pada REST API, client mengirimkan request ke server melalui endpoint tertentu, kemudian server memberikan response sesuai dengan proses yang diminta. Metode HTTP yang umum digunakan antara lain GET untuk mengambil data, POST untuk mengirim data baru, PUT untuk memperbarui data, dan DELETE untuk menghapus data.

JSON (JavaScript Object Notation) merupakan format pertukaran data yang ringan, mudah dibaca, dan mudah diproses oleh sistem. JSON banyak digunakan pada aplikasi mobile karena struktur datanya sederhana dan dapat digunakan oleh berbagai bahasa pemrograman. Pada sistem presensi, JSON digunakan sebagai format data yang dikirimkan antara aplikasi Android dan backend server.

Pada sistem presensi Madrasah Diniyah, REST API digunakan untuk menghubungkan aplikasi Android dengan backend server. Aplikasi Android bertugas sebagai client yang digunakan oleh admin atau guru untuk mencatat presensi, sedangkan backend server bertugas menerima data, melakukan validasi, menyimpan data ke database, dan memproses notifikasi WhatsApp.

REST API juga digunakan untuk mendukung konsep offline-first. Ketika aplikasi digunakan dalam kondisi offline, data presensi disimpan terlebih dahulu pada database lokal. Setelah koneksi internet tersedia, WorkManager akan menjalankan proses sinkronisasi dan mengirimkan data presensi ke server melalui REST API dalam format JSON. Dengan mekanisme tersebut, data presensi tetap dapat dicatat walaupun koneksi internet tidak selalu stabil.

Endpoint API yang digunakan pada sistem presensi antara lain sebagai berikut:

1. Authentication Endpoint

   a. POST `/api/auth/login` untuk login pengguna.

   b. POST `/api/auth/logout` untuk logout pengguna.

   c. POST `/api/auth/refresh-token` untuk memperbarui token autentikasi.

2. Sync Endpoint

   a. GET `/api/sync/bootstrap` untuk mengambil data awal aplikasi, seperti data guru, kelas, mata pelajaran, santri, dan waktu server.

   b. POST `/api/sync/batch` untuk mengirim data presensi tertunda dari aplikasi ke server.

3. Data Master Endpoint

   a. GET `/api/kelas` untuk mengambil daftar kelas.

   b. GET `/api/mata-pelajaran` untuk mengambil daftar mata pelajaran.

   c. GET `/api/santri` untuk mengambil daftar santri.

   d. GET `/api/guru` untuk mengambil daftar guru.

   e. POST, PUT, dan DELETE pada endpoint data master digunakan oleh admin untuk menambah, mengubah, atau menghapus data guru, kelas, mata pelajaran, dan santri.

4. Presensi Endpoint

   a. POST `/api/presensi` untuk menyimpan data presensi.

   b. PUT `/api/presensi/{id}` untuk memperbarui data presensi.

   c. DELETE `/api/presensi/{id}` untuk membatalkan data presensi.

   d. GET `/api/presensi/riwayat` untuk mengambil riwayat presensi.

   e. GET `/api/presensi/rekap` untuk mengambil rekap presensi.

5. Notifikasi Endpoint

   a. GET `/api/notifikasi` untuk melihat daftar log notifikasi.

   b. POST `/api/notifikasi/whatsapp` untuk mengirim notifikasi WhatsApp.

   c. POST `/api/notifikasi/{id}/retry` untuk mengirim ulang notifikasi yang gagal.

Pada aspek keamanan, setiap pengguna harus melakukan login terlebih dahulu untuk mendapatkan token autentikasi. Token tersebut dikirimkan pada request API berikutnya sebagai Bearer Token. Backend server kemudian memeriksa token, masa berlaku token, dan hak akses pengguna sebelum menjalankan proses tertentu. Dengan mekanisme ini, fitur sistem hanya dapat diakses oleh pengguna yang memiliki hak akses, seperti admin dan guru.

Selain autentikasi token, sistem juga menerapkan pembatasan peran pengguna. Admin memiliki akses untuk mengelola data master, sedangkan guru hanya dapat mengakses data yang berkaitan dengan kelas yang menjadi tanggung jawabnya. Backend juga melakukan validasi pada data yang dikirim, seperti validasi kelas, santri, mata pelajaran, tanggal presensi, status presensi, dan format nomor WhatsApp wali santri.

Pada saat sistem dijalankan pada server online, komunikasi antara aplikasi dan server menggunakan alamat API berbasis HTTPS. HTTPS membantu melindungi data ketika dikirim melalui jaringan karena proses pertukaran data dilakukan melalui koneksi terenkripsi. Dengan demikian, keamanan sistem pada penelitian ini diterapkan melalui penggunaan HTTPS, autentikasi token, pembatasan hak akses berdasarkan role, masa berlaku token, validasi input, dan penyimpanan data presensi secara terstruktur pada database.

Contoh format JSON untuk sinkronisasi data presensi adalah sebagai berikut:

```json
{
  "operations": [
    {
      "operation_id": "550e8400-e29b-41d4-a716-446655440000",
      "entity_type": "presensi",
      "payload": {
        "id_kelas": 1,
        "mapel_id": 2,
        "tanggal": "2026-07-08",
        "waktu_mulai": "11:53:00",
        "waktu_selesai": "12:30:00",
        "allow_update": true,
        "detail": [
          {
            "id_santri": 1,
            "status_presensi": "Hadir",
            "keterangan": null
          },
          {
            "id_santri": 2,
            "status_presensi": "Izin",
            "keterangan": "Pergi pulang kampung"
          }
        ]
      }
    }
  ]
}
```

Format JSON tersebut menunjukkan bahwa satu proses presensi memiliki data kelas, mata pelajaran, tanggal, waktu, serta detail presensi santri. Setiap detail presensi berisi identitas santri, status kehadiran, dan keterangan apabila diperlukan.

Untuk mempercepat input data presensi, aplikasi menyediakan template keterangan yang dapat dipilih oleh guru atau admin. Template ini digunakan terutama pada status Sakit, Izin, dan Alpa, sehingga pengguna tidak perlu mengetik keterangan secara manual untuk kasus yang sering terjadi. Contoh template keterangan yang digunakan antara lain:

a. Sakit di rumah.

b. Pergi pulang kampung.

c. Tidak ada kabar.

d. Keluarga ada acara.

e. Lainnya, yaitu pengguna dapat mengetik keterangan sendiri.

Dengan penggunaan REST API dan JSON, proses pertukaran data antara aplikasi Android dan backend server menjadi lebih terstruktur. Sistem dapat mengambil data master, menyimpan presensi, memperbarui data presensi, melakukan sinkronisasi data tertunda, serta memproses notifikasi WhatsApp kepada wali santri.
