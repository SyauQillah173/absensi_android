<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\MataPelajaran;
use App\Models\Jadwal;
use App\Models\Absensi;
use App\Models\Pembayaran;
use App\Models\Nilai;
use App\Models\Siswa;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // ===== 1. USERS =====
        User::create([
            'name' => 'Admin Madrasah',
            'email' => 'admin@absensi.com',
            'role' => 'admin',
            'nis' => 'ADM001',
            'nisn' => '',
            'no_hp' => '081111111111',
            'status' => 'Aktif',
            'password' => Hash::make('password123'),
        ]);
        User::create([
            'name' => 'Ust. Ahmad Fauzi',
            'email' => 'guru@absensi.com',
            'role' => 'guru',
            'nis' => 'GRU001',
            'nisn' => '',
            'kode_guru' => 'GRU001',
            'no_hp' => '081222222222',
            'status' => 'Aktif',
            'alamat' => 'Bungah, Gresik',
            'unit_kerja' => ["MTs Assa'adah 1", "Aliyah Assa'adah"],
            'kategori_guru' => ['guru', 'sertifikasi'],
            'password' => Hash::make('password123'),
        ]);
        // Guru ke-2 untuk test multi-account & permission
        User::create([
            'name' => 'Ust. Diki Ramdani',
            'email' => 'guru2@absensi.com',
            'role' => 'guru',
            'nis' => 'GRU002',
            'nisn' => '',
            'kode_guru' => 'GRU002',
            'no_hp' => '081333333333',
            'status' => 'Aktif',
            'alamat' => 'Sidayu, Gresik',
            'unit_kerja' => ["SMP Assa'adah", "MTs Assa'adah 2"],
            'kategori_guru' => ['guru', 'karyawan'],
            'password' => Hash::make('password123'),
        ]);

        // ===== ORANG TUA (WALI) — 2 akun test =====
        $ortu1 = User::create([
            'name' => 'Bp. Ahmad Fauzi',
            'email' => 'ortu1@absensi.com',
            'role' => 'wali',
            'nis' => 'ORT001',
            'nisn' => '',
            'no_hp' => '082111111111',
            'status' => 'Aktif',
            'password' => Hash::make('password123'),
        ]);
        $ortu2 = User::create([
            'name' => 'Bp. Moh. Falah',
            'email' => 'ortu2@absensi.com',
            'role' => 'wali',
            'nis' => 'ORT002',
            'nisn' => '',
            'no_hp' => '082222222222',
            'status' => 'Aktif',
            'password' => Hash::make('password123'),
        ]);

        // ===== 2. SISWA + KELOMPOK BELAJAR (via SiswaSeeder) =====
        $this->call(SiswaSeeder::class);

        // === Link siswa ke orang tua ===
        // Ortu 1 → anak: ABDUL HANIF (siswa ID 1)
        Siswa::where('nis', '2024001')->update(['wali_id' => $ortu1->id]);
        // Ortu 2 → anak: ADHA FAJRIL FALAH (siswa ID 2)
        Siswa::where('nis', '2024002')->update(['wali_id' => $ortu2->id]);
        // Siswa lain otomatis dibagi ke akun wali agar semua siswa punya relasi testing
        $waliIds = [$ortu1->id, $ortu2->id];
        $waliNames = [$ortu1->name, $ortu2->name];
        $siswaTanpaWali = Siswa::whereNull('wali_id')->orderBy('id')->get();
        foreach ($siswaTanpaWali as $index => $siswa) {
            $waliId = $waliIds[$index % count($waliIds)];
            $waliName = $waliNames[$index % count($waliNames)];
            $siswa->update([
                'wali_id' => $waliId,
                'nama_wali' => $siswa->nama_wali ?: $waliName,
            ]);
        }

        // ===== 3. MATA PELAJARAN (semua mapel — gabungan database + JSON frontend) =====
        $mapelData = [
            ['nama' => 'TAFSIR', 'kode' => 'TAF', 'status' => 'Aktif'],
            ['nama' => 'HADITS', 'kode' => 'HAD', 'status' => 'Aktif'],
            ['nama' => 'FIQIH', 'kode' => 'FIQ', 'status' => 'Aktif'],
            ['nama' => 'NAHWU', 'kode' => 'NAH', 'status' => 'Aktif'],
            ['nama' => 'SHOROF', 'kode' => 'SHO', 'status' => 'Aktif'],
            ['nama' => 'AQIDAH', 'kode' => 'AQI', 'status' => 'Aktif'],
            ['nama' => 'AKHLAQ', 'kode' => 'AKH', 'status' => 'Aktif'],
            ['nama' => 'TAJWID', 'kode' => 'TAJ', 'status' => 'Aktif'],
            ['nama' => 'TARIKH', 'kode' => 'TAR', 'status' => 'Aktif'],
            ['nama' => 'IMLA', 'kode' => 'IML', 'status' => 'Aktif'],
            ['nama' => 'INSYA', 'kode' => 'INS', 'status' => 'Aktif'],
            ['nama' => 'PEGO', 'kode' => 'PEG', 'status' => 'Aktif'],
            ['nama' => 'TAUHID', 'kode' => 'TAU', 'status' => 'Aktif'],
            ['nama' => 'BMK', 'kode' => 'BMK', 'status' => 'Aktif'],
            ['nama' => 'TAHAJI', 'kode' => 'THJ', 'status' => 'Aktif'],
            ['nama' => 'BALAGHO', 'kode' => 'BLG', 'status' => 'Aktif'],
            ['nama' => 'USHUL FIQIH', 'kode' => 'USF', 'status' => 'Aktif'],
            ['nama' => 'QOWAID FIQIH', 'kode' => 'QWF', 'status' => 'Nonaktif'],
        ];
        $mapelIds = [];
        foreach ($mapelData as $m) {
            $mapel = MataPelajaran::create($m);
            $mapelIds[$m['nama']] = $mapel->id;
        }

        // ===== 3b. GURU-MAPEL ASSIGNMENT (pivot table) =====
        // Guru 1: Ust. Ahmad Fauzi (user_id 2) → TAFSIR, HADITS, TAJWID, IMLA
        // Guru 2: Ust. Diki Ramdani (user_id 3) → FIQIH, NAHWU, SHOROF, AQIDAH
        $guru1 = 2; // Ust. Ahmad Fauzi
        $guru2 = 3; // Ust. Diki Ramdani
        $mapelGuru = [
            [$mapelIds['TAFSIR'], $guru1],
            [$mapelIds['HADITS'], $guru1],
            [$mapelIds['TAJWID'], $guru1],
            [$mapelIds['IMLA'], $guru1],
            [$mapelIds['FIQIH'], $guru2],
            [$mapelIds['NAHWU'], $guru2],
            [$mapelIds['SHOROF'], $guru2],
            [$mapelIds['AQIDAH'], $guru2],
            // Beberapa mapel diajar berdua
            [$mapelIds['AKHLAQ'], $guru1],
            [$mapelIds['AKHLAQ'], $guru2],
            [$mapelIds['TARIKH'], $guru1],
            [$mapelIds['INSYA'], $guru2],
            [$mapelIds['PEGO'], $guru1],
            [$mapelIds['TAUHID'], $guru2],
            [$mapelIds['BMK'], $guru1],
            [$mapelIds['TAHAJI'], $guru2],
            [$mapelIds['BALAGHO'], $guru1],
            [$mapelIds['USHUL FIQIH'], $guru2],
        ];
        foreach ($mapelGuru as $mg) {
            \DB::table('mapel_guru')->insert([
                'mapel_id' => $mg[0],
                'user_id' => $mg[1],
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        // ===== 4. JADWAL =====
        $jadwalData = [
            ['mapel_id' => $mapelIds['TAFSIR'], 'guru' => 'Ust. Ahmad Fauzi', 'hari' => 'Senin', 'jam_mulai' => '08:00', 'jam_selesai' => '09:30', 'sifir' => 'Sifir Awal A PA', 'status' => 'Aktif'],
            ['mapel_id' => $mapelIds['HADITS'], 'guru' => 'Ust. Ahmad Fauzi', 'hari' => 'Senin', 'jam_mulai' => '10:00', 'jam_selesai' => '11:30', 'sifir' => 'Sifir Awal A PA', 'status' => 'Aktif'],
            ['mapel_id' => $mapelIds['FIQIH'], 'guru' => 'Ust. Diki Ramdani', 'hari' => 'Selasa', 'jam_mulai' => '08:00', 'jam_selesai' => '09:30', 'sifir' => 'Sifir Awal A PA', 'status' => 'Aktif'],
            ['mapel_id' => $mapelIds['NAHWU'], 'guru' => 'Ust. Diki Ramdani', 'hari' => 'Selasa', 'jam_mulai' => '10:00', 'jam_selesai' => '11:30', 'sifir' => 'Sifir Awal B PA', 'status' => 'Aktif'],
            ['mapel_id' => $mapelIds['SHOROF'], 'guru' => 'Ust. Diki Ramdani', 'hari' => 'Rabu', 'jam_mulai' => '08:00', 'jam_selesai' => '09:30', 'sifir' => 'Sifir Awal B PA', 'status' => 'Aktif'],
            ['mapel_id' => $mapelIds['AQIDAH'], 'guru' => 'Ust. Diki Ramdani', 'hari' => 'Rabu', 'jam_mulai' => '10:00', 'jam_selesai' => '11:30', 'sifir' => 'Sifir Tsani A PA', 'status' => 'Aktif'],
            ['mapel_id' => $mapelIds['AKHLAQ'], 'guru' => 'Ust. Ahmad Fauzi', 'hari' => 'Kamis', 'jam_mulai' => '08:00', 'jam_selesai' => '09:30', 'sifir' => 'Sifir Tsani A PA', 'status' => 'Aktif'],
            ['mapel_id' => $mapelIds['TAJWID'], 'guru' => 'Ust. Ahmad Fauzi', 'hari' => 'Kamis', 'jam_mulai' => '10:00', 'jam_selesai' => '11:30', 'sifir' => 'Sifir Tsani B PA', 'status' => 'Aktif'],
            ['mapel_id' => $mapelIds['TARIKH'], 'guru' => 'Ust. Ahmad Fauzi', 'hari' => 'Jumat', 'jam_mulai' => '08:00', 'jam_selesai' => '09:30', 'sifir' => 'Sifir Awal A PA', 'status' => 'Aktif'],
            ['mapel_id' => $mapelIds['IMLA'], 'guru' => 'Ust. Ahmad Fauzi', 'hari' => 'Sabtu', 'jam_mulai' => '08:00', 'jam_selesai' => '09:30', 'sifir' => 'Sifir Awal A PA', 'status' => 'Aktif'],
            ['mapel_id' => $mapelIds['INSYA'], 'guru' => 'Ust. Diki Ramdani', 'hari' => 'Sabtu', 'jam_mulai' => '10:00', 'jam_selesai' => '11:30', 'sifir' => 'Sifir Awal B PA', 'status' => 'Aktif'],
            ['mapel_id' => $mapelIds['PEGO'], 'guru' => 'Ust. Ahmad Fauzi', 'hari' => 'Senin', 'jam_mulai' => '13:00', 'jam_selesai' => '14:30', 'sifir' => 'Sifir Tsani B PA', 'status' => 'Aktif'],
            ['mapel_id' => $mapelIds['TAUHID'], 'guru' => 'Ust. Diki Ramdani', 'hari' => 'Selasa', 'jam_mulai' => '13:00', 'jam_selesai' => '14:30', 'sifir' => 'Sifir Awal F PI', 'status' => 'Aktif'],
            ['mapel_id' => $mapelIds['BMK'], 'guru' => 'Ust. Ahmad Fauzi', 'hari' => 'Rabu', 'jam_mulai' => '13:00', 'jam_selesai' => '14:30', 'sifir' => 'Sifir Awal F PI', 'status' => 'Aktif'],
            ['mapel_id' => $mapelIds['TAHAJI'], 'guru' => 'Ust. Diki Ramdani', 'hari' => 'Kamis', 'jam_mulai' => '13:00', 'jam_selesai' => '14:30', 'sifir' => 'Sifir Tsani F PI', 'status' => 'Aktif'],
            ['mapel_id' => $mapelIds['BALAGHO'], 'guru' => 'Ust. Ahmad Fauzi', 'hari' => 'Jumat', 'jam_mulai' => '10:00', 'jam_selesai' => '11:30', 'sifir' => 'Sifir Tsalis A PA', 'status' => 'Aktif'],
        ];
        foreach ($jadwalData as $j) {
            Jadwal::create($j);
        }

        // ===== 5. ABSENSI (dikosongkan agar dashboard bersih saat awal) =====
        // Data absensi akan muncul saat admin/guru melakukan absensi dari app
        // Setelah absen → dashboard otomatis tampil card Pending/Completed

        // ===== 6. PEMBAYARAN =====
        $today = now()->toDateString();
        $paymentTypes = DB::table('payment_types')->pluck('id', 'nama');
        $pembayaranData = [
            // Pembayaran anak Ortu 1 (ABDUL HANIF — siswa_id 1)
            ['siswa_id' => 1, 'wali_id' => $ortu1->id, 'payment_type_id' => $paymentTypes['SPP Bulanan'] ?? null, 'atas_nama' => 'Bp. Ahmad Fauzi', 'jenis' => 'SPP Bulanan', 'via' => 'Transfer Dana', 'jumlah' => 250000, 'tanggal' => $today, 'status' => 'Lunas'],
            ['siswa_id' => 1, 'wali_id' => $ortu1->id, 'payment_type_id' => $paymentTypes['Buku & Kitab'] ?? null, 'atas_nama' => 'Bp. Ahmad Fauzi', 'jenis' => 'Buku & Kitab', 'via' => 'Tunai', 'jumlah' => 350000, 'tanggal' => '2026-02-15', 'status' => 'Lunas'],
            ['siswa_id' => 1, 'wali_id' => $ortu1->id, 'payment_type_id' => $paymentTypes['Ujian Semester'] ?? null, 'atas_nama' => 'Bp. Ahmad Fauzi', 'jenis' => 'Ujian Semester', 'via' => 'Bank BRI', 'jumlah' => 200000, 'tanggal' => '2026-02-20', 'status' => 'Belum Lunas'],
            ['siswa_id' => 1, 'wali_id' => $ortu1->id, 'payment_type_id' => $paymentTypes['Daftar Ulang'] ?? null, 'atas_nama' => 'Bp. Ahmad Fauzi', 'jenis' => 'Daftar Ulang', 'via' => 'Bank BSI', 'jumlah' => 500000, 'tanggal' => '2026-01-10', 'status' => 'Belum Lunas'],
            // Pembayaran anak Ortu 2 (ADHA FAJRIL FALAH — siswa_id 2)
            ['siswa_id' => 2, 'wali_id' => $ortu2->id, 'payment_type_id' => $paymentTypes['SPP Bulanan'] ?? null, 'atas_nama' => 'Bp. Moh. Falah', 'jenis' => 'SPP Bulanan', 'via' => 'Bank BRI', 'jumlah' => 250000, 'tanggal' => $today, 'status' => 'Lunas'],
            ['siswa_id' => 2, 'wali_id' => $ortu2->id, 'payment_type_id' => $paymentTypes['Buku & Kitab'] ?? null, 'atas_nama' => 'Bp. Moh. Falah', 'jenis' => 'Buku & Kitab', 'via' => 'Tunai', 'jumlah' => 350000, 'tanggal' => '2026-02-10', 'status' => 'Lunas'],
            ['siswa_id' => 2, 'wali_id' => $ortu2->id, 'payment_type_id' => $paymentTypes['Ujian Semester'] ?? null, 'atas_nama' => 'Bp. Moh. Falah', 'jenis' => 'Ujian Semester', 'via' => 'Bank Mandiri', 'jumlah' => 200000, 'tanggal' => '2026-02-25', 'status' => 'Belum Lunas'],
            // Pembayaran siswa lain
            ['siswa_id' => 3, 'wali_id' => Siswa::find(3)?->wali_id, 'payment_type_id' => $paymentTypes['Buku & Kitab'] ?? null, 'atas_nama' => 'Bp. Nur Haq', 'jenis' => 'Buku & Kitab', 'via' => 'Tunai', 'jumlah' => 350000, 'tanggal' => $today, 'status' => 'Lunas'],
        ];
        foreach ($pembayaranData as $p) {
            Pembayaran::create($p);
        }

        // ===== 7. NILAI (with auto-grade) =====
        $nilaiData = [
            // Nilai anak Ortu 1 (ABDUL HANIF — siswa_id 1) — banyak mapel!
            ['siswa_id' => 1, 'mapel_id' => $mapelIds['TAFSIR'], 'jenis_ujian' => 'UTS', 'nilai' => 85, 'semester' => 'Ganjil 2024', 'diinput_oleh' => 'Ust. Ahmad Fauzi', 'tahun_ajaran' => '2025/2026'],
            ['siswa_id' => 1, 'mapel_id' => $mapelIds['TAFSIR'], 'jenis_ujian' => 'UAS', 'nilai' => 88, 'semester' => 'Ganjil 2024', 'diinput_oleh' => 'Ust. Ahmad Fauzi', 'tahun_ajaran' => '2025/2026'],
            ['siswa_id' => 1, 'mapel_id' => $mapelIds['TAFSIR'], 'jenis_ujian' => 'Hafalan', 'nilai' => 92, 'semester' => 'Ganjil 2024', 'diinput_oleh' => 'Ust. Ahmad Fauzi', 'tahun_ajaran' => '2025/2026'],
            ['siswa_id' => 1, 'mapel_id' => $mapelIds['FIQIH'], 'jenis_ujian' => 'UTS', 'nilai' => 78, 'semester' => 'Ganjil 2024', 'diinput_oleh' => 'Ust. Diki Ramdani', 'tahun_ajaran' => '2025/2026'],
            ['siswa_id' => 1, 'mapel_id' => $mapelIds['FIQIH'], 'jenis_ujian' => 'UAS', 'nilai' => 90, 'semester' => 'Ganjil 2024', 'diinput_oleh' => 'Ust. Diki Ramdani', 'tahun_ajaran' => '2025/2026'],
            ['siswa_id' => 1, 'mapel_id' => $mapelIds['FIQIH'], 'jenis_ujian' => 'Tugas', 'nilai' => 85, 'semester' => 'Ganjil 2024', 'diinput_oleh' => 'Ust. Diki Ramdani', 'tahun_ajaran' => '2025/2026'],
            ['siswa_id' => 1, 'mapel_id' => $mapelIds['NAHWU'], 'jenis_ujian' => 'UTS', 'nilai' => 72, 'semester' => 'Ganjil 2024', 'diinput_oleh' => 'Ust. Diki Ramdani', 'tahun_ajaran' => '2025/2026'],
            ['siswa_id' => 1, 'mapel_id' => $mapelIds['NAHWU'], 'jenis_ujian' => 'UAS', 'nilai' => 80, 'semester' => 'Ganjil 2024', 'diinput_oleh' => 'Ust. Diki Ramdani', 'tahun_ajaran' => '2025/2026'],
            ['siswa_id' => 1, 'mapel_id' => $mapelIds['SHOROF'], 'jenis_ujian' => 'UTS', 'nilai' => 95, 'semester' => 'Ganjil 2024', 'diinput_oleh' => 'Ust. Diki Ramdani', 'tahun_ajaran' => '2025/2026'],
            ['siswa_id' => 1, 'mapel_id' => $mapelIds['SHOROF'], 'jenis_ujian' => 'Hafalan', 'nilai' => 90, 'semester' => 'Ganjil 2024', 'diinput_oleh' => 'Ust. Diki Ramdani', 'tahun_ajaran' => '2025/2026'],
            ['siswa_id' => 1, 'mapel_id' => $mapelIds['AKHLAQ'], 'jenis_ujian' => 'UTS', 'nilai' => 65, 'semester' => 'Ganjil 2024', 'diinput_oleh' => 'Ust. Ahmad Fauzi', 'tahun_ajaran' => '2025/2026'],
            ['siswa_id' => 1, 'mapel_id' => $mapelIds['TAJWID'], 'jenis_ujian' => 'UTS', 'nilai' => 88, 'semester' => 'Ganjil 2024', 'diinput_oleh' => 'Ust. Ahmad Fauzi', 'tahun_ajaran' => '2025/2026'],
            ['siswa_id' => 1, 'mapel_id' => $mapelIds['TAJWID'], 'jenis_ujian' => 'Hafalan', 'nilai' => 95, 'semester' => 'Ganjil 2024', 'diinput_oleh' => 'Ust. Ahmad Fauzi', 'tahun_ajaran' => '2025/2026'],
            // Nilai anak Ortu 2 (ADHA FAJRIL — siswa_id 2)
            ['siswa_id' => 2, 'mapel_id' => $mapelIds['TAFSIR'], 'jenis_ujian' => 'UTS', 'nilai' => 88, 'semester' => 'Ganjil 2024', 'diinput_oleh' => 'Ust. Ahmad Fauzi', 'tahun_ajaran' => '2025/2026'],
            ['siswa_id' => 2, 'mapel_id' => $mapelIds['TAFSIR'], 'jenis_ujian' => 'UAS', 'nilai' => 82, 'semester' => 'Ganjil 2024', 'diinput_oleh' => 'Ust. Ahmad Fauzi', 'tahun_ajaran' => '2025/2026'],
            ['siswa_id' => 2, 'mapel_id' => $mapelIds['FIQIH'], 'jenis_ujian' => 'UTS', 'nilai' => 92, 'semester' => 'Ganjil 2024', 'diinput_oleh' => 'Ust. Diki Ramdani', 'tahun_ajaran' => '2025/2026'],
            ['siswa_id' => 2, 'mapel_id' => $mapelIds['FIQIH'], 'jenis_ujian' => 'UAS', 'nilai' => 90, 'semester' => 'Ganjil 2024', 'diinput_oleh' => 'Ust. Diki Ramdani', 'tahun_ajaran' => '2025/2026'],
            ['siswa_id' => 2, 'mapel_id' => $mapelIds['NAHWU'], 'jenis_ujian' => 'UTS', 'nilai' => 75, 'semester' => 'Ganjil 2024', 'diinput_oleh' => 'Ust. Diki Ramdani', 'tahun_ajaran' => '2025/2026'],
            ['siswa_id' => 2, 'mapel_id' => $mapelIds['SHOROF'], 'jenis_ujian' => 'Hafalan', 'nilai' => 98, 'semester' => 'Ganjil 2024', 'diinput_oleh' => 'Ust. Diki Ramdani', 'tahun_ajaran' => '2025/2026'],
            ['siswa_id' => 2, 'mapel_id' => $mapelIds['AKHLAQ'], 'jenis_ujian' => 'UTS', 'nilai' => 70, 'semester' => 'Ganjil 2024', 'diinput_oleh' => 'Ust. Ahmad Fauzi', 'tahun_ajaran' => '2025/2026'],
            ['siswa_id' => 2, 'mapel_id' => $mapelIds['TAJWID'], 'jenis_ujian' => 'UTS', 'nilai' => 85, 'semester' => 'Ganjil 2024', 'diinput_oleh' => 'Ust. Ahmad Fauzi', 'tahun_ajaran' => '2025/2026'],
            // Siswa lain
            ['siswa_id' => 3, 'mapel_id' => $mapelIds['NAHWU'], 'jenis_ujian' => 'Hafalan', 'nilai' => 95, 'semester' => 'Ganjil 2024', 'diinput_oleh' => 'Ust. Diki Ramdani', 'tahun_ajaran' => '2025/2026'],
            ['siswa_id' => 4, 'mapel_id' => $mapelIds['TAJWID'], 'jenis_ujian' => 'Tugas', 'nilai' => 78, 'semester' => 'Ganjil 2024', 'diinput_oleh' => 'Ust. Ahmad Fauzi', 'tahun_ajaran' => '2025/2026'],
        ];
        foreach ($nilaiData as $n) {
            $n['grade'] = Nilai::calculateGrade($n['nilai']);
            Nilai::create($n);
        }
    }
}
