## 4.6 Pengujian Sistem

Pengujian sistem dilakukan untuk memastikan fitur pada aplikasi presensi Madrasah Diniyah dapat berjalan sesuai dengan kebutuhan pengguna. Metode pengujian yang digunakan adalah black box testing, yaitu pengujian yang berfokus pada fungsi sistem berdasarkan input dan output yang dihasilkan.

Pengujian dilakukan dengan menggunakan Google Form. Responden diminta mencoba aplikasi, kemudian memberikan hasil pengujian pada setiap skenario dengan pilihan Berhasil, Gagal, atau Tidak Diuji. Fitur yang diuji meliputi login, data master, pemilihan kelas dan mata pelajaran, input presensi, edit presensi, sinkronisasi, dan notifikasi WhatsApp.

Berdasarkan data Google Form yang telah direkap, terdapat 13 responden yang mengisi pengujian. Responden terdiri dari penguji umum, guru/ustadz, dan admin/operator. Hasil pengujian dapat dilihat pada tabel berikut.

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

### Catatan Screenshot untuk Word

Screenshot yang perlu dimasukkan pada subbab ini:

1. Screenshot tampilan Google Form pengujian black box.
2. Screenshot tab Jawaban/Responses pada Google Form.
3. Screenshot Google Sheet hasil jawaban responden.
4. Screenshot ringkasan hasil respons Google Form jika tersedia.

Caption yang disarankan:

1. Gambar 4.15 Form Pengujian Black Box
2. Gambar 4.16 Hasil Respons Pengujian Black Box
3. Gambar 4.17 Rekap Data Pengujian Black Box
