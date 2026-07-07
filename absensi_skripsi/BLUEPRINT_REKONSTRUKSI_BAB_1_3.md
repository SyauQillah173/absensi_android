# Blueprint Rekonstruksi Aplikasi Berdasarkan BAB 1-3

## Kedudukan dan Ruang Lingkup

Dokumen BAB 1-3 adalah sumber kebenaran utama. Proyek ini hanya mencakup
sistem presensi santri Madrasah Diniyah. Modul pembayaran, nilai, hafalan,
materi, kegiatan, pondok, absensi salat, absensi mengaji, dan portal wali
tidak termasuk ruang lingkup skripsi.

## Aktor dan Hak Akses

| Aktor | Hak akses |
|---|---|
| Admin/Operator | Login, CRUD santri/guru/kelas, seluruh riwayat dan rekap, ekspor laporan, log dan retry WhatsApp |
| Guru/Ustadz | Login, kelas yang diampu, mencatat presensi, riwayat dan rekap kelas yang diampu |
| Wali Santri | Tidak login; hanya menerima WhatsApp untuk status Sakit, Izin, atau Alpa |

## Keputusan atas Inkonsistensi Dokumen

1. Status dibakukan menjadi `Hadir`, `Izin`, `Sakit`, dan `Alpa` sesuai ERD.
2. Semua operasi tulis local-first sesuai kebutuhan fungsional, flowchart,
   CRC SinkronisasiService, dan uraian use case.
3. Sequence CRUD server langsung berlaku ketika online. Ketika offline,
   operasi masuk outbox lokal dan dikirim WorkManager.
4. Retry WhatsApp memakai jeda 1, 5, dan 15 menit sesuai aturan use case.
5. Satu kelas memiliki satu guru pengampu. Seorang guru boleh mengampu lebih
   dari satu kelas sesuai use case "kelas yang diampu".
6. Enam entitas ERD adalah entitas domain utama. Token, outbox, audit, dan log
   notifikasi adalah tabel teknis pendukung.

## Padanan Class Diagram

| Class | Server | Lokal Android |
|---|---|---|
| User | `users`, model `User` | cache sesi dan credential |
| Guru | `guru`, model `Guru` | Room `guru` |
| Kelas | `kelas`, model `Kelas` | Room `kelas` |
| Santri | `santri`, model `Santri` | Room `santri` |
| Presensi | `presensi`, model `Presensi` | Room `presensi` |
| DetailPresensi | `detail_presensi`, model `DetailPresensi` | Room `detail_presensi` |

Class layanan target:

- `AuthService`: login online/offline, bcrypt, JWT 24 jam, credential cache,
  dan batas lima kegagalan dalam 15 menit.
- `PresensiService`: validasi, penyimpanan atomik, duplikasi sesi, status
  default Hadir, riwayat, rekap, dan pembatasan kelas guru.
- `SinkronisasiService`: outbox, WorkManager, batch sync, retry, konflik, serta
  status pending/syncing/completed/failed.
- `NotifikasiService`: antrean WhatsApp, template, validasi nomor Indonesia,
  retry, log, dan kirim ulang oleh admin.
- `DatabaseManager`: Room pada Android dan transaksi database server.
- `RestApiService`: HTTP, JWT Bearer, timeout, dan respons terstruktur.

## ERD Target

### users

`id_user`, `username` unik, `password_hash`, `role` (`Admin`/`Guru`),
`status_aktif`, dan timestamps.

### guru

`id_guru`, `id_user` FK unik, `nama_guru`, `nip_nidm` unik, `nomor_hp`,
`alamat`, `status_aktif`, `audit_log`, dan timestamps.

### kelas

`id_kelas`, `id_guru` FK, `nama_kelas` unik, `tingkat`, `status_aktif`,
`audit_log`, dan timestamps.

### santri

`id_santri`, `id_kelas` FK, `nisn` unik, `nama_santri`, `jenis_kelamin`,
`tgl_lahir`, `alamat`, `nama_wali`, `nomor_wa_wali`, `status_aktif`,
`audit_log`, dan timestamps.

### presensi

`id_presensi`, `id_guru` FK, `id_kelas` FK, `tanggal`, `waktu_mulai`,
`waktu_selesai`, `catatan`, `sync_flag`, dan timestamps.

### detail_presensi

`id_detail_presensi`, `id_presensi` FK cascade, `id_santri` FK,
`status_presensi`, `keterangan`, `sync_flag`, dan timestamps. Kombinasi
presensi-santri wajib unik.

Tabel teknis: `api_access_tokens`, `sync_operations`,
`whatsapp_message_logs`, dan `audit_logs`.

## Kontrak REST API

| Method | Endpoint | Peran |
|---|---|---|
| POST | `/api/auth/login` | Publik |
| POST | `/api/auth/logout` | Admin, Guru |
| GET | `/api/sync/bootstrap` | Admin, Guru |
| POST | `/api/sync/batch` | Admin, Guru |
| CRUD | `/api/santri` | Baca Admin/Guru; tulis Admin |
| CRUD | `/api/guru` | Admin |
| CRUD | `/api/kelas` | Baca Admin/Guru; tulis Admin |
| GET/POST/PUT | `/api/presensi` | Admin/Guru sesuai kelas |
| GET | `/api/presensi/riwayat` | Admin/Guru sesuai kelas |
| GET | `/api/presensi/rekap` | Admin/Guru sesuai kelas |
| GET | `/api/presensi/rekap/export` | Admin |
| GET | `/api/notifikasi` | Admin |
| POST | `/api/notifikasi/{id}/retry` | Admin |

Semua operasi tulis membawa `operation_id` unik agar retry tidak membuat data
ganda.

## Alur Flowchart dan Sequence

1. Admin atau guru login. Jika server tidak terjangkau, credential cache yang
   masih valid dipakai.
2. Guru hanya melihat kelas yang diampu dan daftar santri dari Room.
3. Seluruh detail presensi disimpan atomik ke Room dengan status `pending`.
4. UI selesai tanpa menunggu server.
5. WorkManager berjalan otomatis ketika jaringan tersedia.
6. Server menyimpan header dan detail dalam satu transaksi.
7. Server mengantrekan WhatsApp hanya untuk Sakit, Izin, dan Alpa.
8. Room mengubah status menjadi `completed` setelah konfirmasi server.
9. Riwayat dan rekap membaca Room dahulu lalu refresh server saat online.

## Aturan Validasi

- Username, NISN, dan nama kelas wajib unik.
- Password minimal delapan karakter.
- Nomor wali menerima `08...` atau `+62...` lalu dinormalisasi.
- Data master yang mempunyai presensi dinonaktifkan, bukan dihapus fisik.
- Tanggal presensi maksimal tujuh hari sebelumnya sampai hari ini.
- Satu sesi tidak boleh memiliki dua detail untuk santri yang sama.
- Kelas/tanggal/waktu sama ditangani sebagai edit; sesi berbeda tetap boleh.
- Periode rekap maksimal satu tahun.
- Guru tidak dapat membaca atau menulis kelas guru lain.

## Kriteria Selesai

- APK hanya mempunyai alur Admin dan Guru dalam use case.
- Tidak ada menu pembayaran, nilai, hafalan, materi, pondok, atau portal wali.
- Database mempunyai enam tabel domain utama dan tabel teknis yang diperlukan.
- Penyimpanan presensi pertama maupun edit terasa instan karena local-first.
- Pending otomatis menjadi completed ketika koneksi tersedia.
- Restart aplikasi/perangkat tidak menghilangkan antrean.
- Retry tidak menghasilkan detail ganda.
- Notifikasi hanya dibuat untuk Sakit, Izin, dan Alpa.
- Test backend, test Flutter, analisis statis, dan build APK lulus.
