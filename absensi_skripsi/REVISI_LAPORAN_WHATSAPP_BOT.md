# Revisi Laporan Khusus WhatsApp Bot

Catatan ini dipakai untuk mengganti bagian laporan yang masih menyebut "WhatsApp Business API". Revisi cukup diarahkan menjadi "WhatsApp Bot" karena implementasi sistem skripsi menggunakan layanan bot WhatsApp yang berjalan pada server terpisah dan dipanggil melalui REST API backend.

## Istilah Yang Diganti

Ganti:

`WhatsApp Business API`

Menjadi:

`layanan WhatsApp Bot`

Atau:

`WhatsApp Bot berbasis REST API`

## Revisi Singkat Untuk Rumusan Masalah

Bagaimana mengintegrasikan layanan WhatsApp Bot agar notifikasi kehadiran santri dapat terkirim secara otomatis setelah data presensi berhasil tersinkronisasi ke server?

## Revisi Singkat Untuk Tujuan Penelitian

Menyediakan fitur notifikasi otomatis kepada wali santri melalui layanan WhatsApp Bot untuk meningkatkan kecepatan penyampaian informasi kehadiran santri.

## Revisi Subbab Notifikasi WhatsApp

Notifikasi WhatsApp pada sistem ini diimplementasikan menggunakan layanan WhatsApp Bot yang berjalan pada server terpisah. Backend sistem presensi mengirimkan request ke layanan bot melalui REST API setelah data presensi berhasil diterima dan divalidasi oleh server. Layanan bot kemudian memproses nomor tujuan wali santri dan mengirimkan pesan notifikasi melalui akun WhatsApp yang telah terhubung.

Pendekatan ini digunakan untuk kebutuhan implementasi dan pengujian sistem skripsi karena dapat mengirimkan pesan otomatis tanpa harus membuka aplikasi Android secara terus-menerus. Notifikasi bersifat satu arah, yaitu dari sistem kepada wali santri, sehingga wali santri cukup menerima informasi kehadiran melalui aplikasi WhatsApp.

## Alur Notifikasi Dalam Sistem Offline-First

1. Guru mencatat presensi santri melalui aplikasi Android.
2. Data presensi disimpan terlebih dahulu ke database lokal perangkat.
3. Jika internet tersedia, data dikirim ke server melalui REST API.
4. Jika internet belum tersedia, data disimpan sebagai antrean sinkronisasi.
5. WorkManager menjalankan sinkronisasi saat koneksi internet tersedia.
6. Server menerima dan memvalidasi data presensi.
7. Backend membuat log notifikasi dan memanggil layanan WhatsApp Bot.
8. WhatsApp Bot mengirimkan pesan notifikasi kepada wali santri.

## Revisi Untuk Sequence Diagram Notifikasi

Pada sequence diagram notifikasi, komponen "WhatsApp Business API" diganti menjadi "WhatsApp Bot Service". Alurnya tetap sama, yaitu PresensiService memicu NotifikasiService, NotifikasiService mengambil data santri dan nomor wali, kemudian mengirim request ke WhatsApp Bot Service. Setelah pesan berhasil dikirim, status pengiriman dicatat pada log notifikasi.

## Revisi Untuk CRC NotifikasiService

NotifikasiService bertanggung jawab membuat template pesan, mengambil nomor WhatsApp wali santri, mencatat log pengiriman, mengirim request ke WhatsApp Bot Service, serta memperbarui status pengiriman pesan. NotifikasiService berkolaborasi dengan PresensiService, Santri, DetailPresensi, WhatsApp Bot Service, dan database log notifikasi.

## Contoh Template Pesan

[Madrasah Diniyah]
Yth. Wali dari NAMA_SANTRI (NISN)
Status kehadiran Ananda pada hari ini (Hari, tanggal bulan tahun) adalah
STATUS
Keterangan: KETERANGAN

Kelas: NAMA_KELAS

Terimakasih.
