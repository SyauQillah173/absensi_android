<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Siswa;
use App\Models\KelompokBelajar;

class SiswaSeeder extends Seeder
{
    public function run(): void
    {
        // ===== KELOMPOK BELAJAR (60 kelas — sesuai Ruang Sifir) =====
        $kelompokData = [
            // Sifir Awal PA (5 kelas)
            ['nama' => 'Sifir Awal A PA', 'kategori' => 'Sifir Awal PA', 'sifir' => 'awal'],
            ['nama' => 'Sifir Awal B PA', 'kategori' => 'Sifir Awal PA', 'sifir' => 'awal'],
            ['nama' => 'Sifir Awal C PA', 'kategori' => 'Sifir Awal PA', 'sifir' => 'awal'],
            ['nama' => 'Sifir Awal D PA', 'kategori' => 'Sifir Awal PA', 'sifir' => 'awal'],
            ['nama' => 'Sifir Awal E PA', 'kategori' => 'Sifir Awal PA', 'sifir' => 'awal'],
            // Sifir Awal PI (5 kelas)
            ['nama' => 'Sifir Awal F PI', 'kategori' => 'Sifir Awal PI', 'sifir' => 'awal'],
            ['nama' => 'Sifir Awal G PI', 'kategori' => 'Sifir Awal PI', 'sifir' => 'awal'],
            ['nama' => 'Sifir Awal H PI', 'kategori' => 'Sifir Awal PI', 'sifir' => 'awal'],
            ['nama' => 'Sifir Awal I PI', 'kategori' => 'Sifir Awal PI', 'sifir' => 'awal'],
            ['nama' => 'Sifir Awal J PI', 'kategori' => 'Sifir Awal PI', 'sifir' => 'awal'],
            // Sifir Tsani PA (5 kelas)
            ['nama' => 'Sifir Tsani A PA', 'kategori' => 'Sifir Tsani PA', 'sifir' => 'tsani'],
            ['nama' => 'Sifir Tsani B PA', 'kategori' => 'Sifir Tsani PA', 'sifir' => 'tsani'],
            ['nama' => 'Sifir Tsani C PA', 'kategori' => 'Sifir Tsani PA', 'sifir' => 'tsani'],
            ['nama' => 'Sifir Tsani D PA', 'kategori' => 'Sifir Tsani PA', 'sifir' => 'tsani'],
            ['nama' => 'Sifir Tsani E PA', 'kategori' => 'Sifir Tsani PA', 'sifir' => 'tsani'],
            // Sifir Tsani PI (5 kelas)
            ['nama' => 'Sifir Tsani F PI', 'kategori' => 'Sifir Tsani PI', 'sifir' => 'tsani'],
            ['nama' => 'Sifir Tsani G PI', 'kategori' => 'Sifir Tsani PI', 'sifir' => 'tsani'],
            ['nama' => 'Sifir Tsani H PI', 'kategori' => 'Sifir Tsani PI', 'sifir' => 'tsani'],
            ['nama' => 'Sifir Tsani I PI', 'kategori' => 'Sifir Tsani PI', 'sifir' => 'tsani'],
            ['nama' => 'Sifir Tsani J PI', 'kategori' => 'Sifir Tsani PI', 'sifir' => 'tsani'],
            // Sifir Tsalis PA (5 kelas)
            ['nama' => 'Sifir Tsalis A PA', 'kategori' => 'Sifir Tsalis PA', 'sifir' => 'tsalis'],
            ['nama' => 'Sifir Tsalis B PA', 'kategori' => 'Sifir Tsalis PA', 'sifir' => 'tsalis'],
            ['nama' => 'Sifir Tsalis C PA', 'kategori' => 'Sifir Tsalis PA', 'sifir' => 'tsalis'],
            ['nama' => 'Sifir Tsalis D PA', 'kategori' => 'Sifir Tsalis PA', 'sifir' => 'tsalis'],
            ['nama' => 'Sifir Tsalis E PA', 'kategori' => 'Sifir Tsalis PA', 'sifir' => 'tsalis'],
            // Sifir Tsalis PI (5 kelas)
            ['nama' => 'Sifir Tsalis F PI', 'kategori' => 'Sifir Tsalis PI', 'sifir' => 'tsalis'],
            ['nama' => 'Sifir Tsalis G PI', 'kategori' => 'Sifir Tsalis PI', 'sifir' => 'tsalis'],
            ['nama' => 'Sifir Tsalis H PI', 'kategori' => 'Sifir Tsalis PI', 'sifir' => 'tsalis'],
            ['nama' => 'Sifir Tsalis I PI', 'kategori' => 'Sifir Tsalis PI', 'sifir' => 'tsalis'],
            ['nama' => 'Sifir Tsalis J PI', 'kategori' => 'Sifir Tsalis PI', 'sifir' => 'tsalis'],
            // Sifir Robi' PA (5 kelas)
            ['nama' => "Sifir Robi' A PA", 'kategori' => "Sifir Robi' PA", 'sifir' => 'robi'],
            ['nama' => "Sifir Robi' B PA", 'kategori' => "Sifir Robi' PA", 'sifir' => 'robi'],
            ['nama' => "Sifir Robi' C PA", 'kategori' => "Sifir Robi' PA", 'sifir' => 'robi'],
            ['nama' => "Sifir Robi' D PA", 'kategori' => "Sifir Robi' PA", 'sifir' => 'robi'],
            ['nama' => "Sifir Robi' E PA", 'kategori' => "Sifir Robi' PA", 'sifir' => 'robi'],
            // Sifir Robi' PI (5 kelas)
            ['nama' => "Sifir Robi' F PI", 'kategori' => "Sifir Robi' PI", 'sifir' => 'robi'],
            ['nama' => "Sifir Robi' G PI", 'kategori' => "Sifir Robi' PI", 'sifir' => 'robi'],
            ['nama' => "Sifir Robi' H PI", 'kategori' => "Sifir Robi' PI", 'sifir' => 'robi'],
            ['nama' => "Sifir Robi' I PI", 'kategori' => "Sifir Robi' PI", 'sifir' => 'robi'],
            ['nama' => "Sifir Robi' J PI", 'kategori' => "Sifir Robi' PI", 'sifir' => 'robi'],
            // Sifir Khomis PA (5 kelas)
            ['nama' => 'Sifir Khomis A PA', 'kategori' => 'Sifir Khomis PA', 'sifir' => 'khomis'],
            ['nama' => 'Sifir Khomis B PA', 'kategori' => 'Sifir Khomis PA', 'sifir' => 'khomis'],
            ['nama' => 'Sifir Khomis C PA', 'kategori' => 'Sifir Khomis PA', 'sifir' => 'khomis'],
            ['nama' => 'Sifir Khomis D PA', 'kategori' => 'Sifir Khomis PA', 'sifir' => 'khomis'],
            ['nama' => 'Sifir Khomis E PA', 'kategori' => 'Sifir Khomis PA', 'sifir' => 'khomis'],
            // Sifir Khomis PI (5 kelas)
            ['nama' => 'Sifir Khomis F PI', 'kategori' => 'Sifir Khomis PI', 'sifir' => 'khomis'],
            ['nama' => 'Sifir Khomis G PI', 'kategori' => 'Sifir Khomis PI', 'sifir' => 'khomis'],
            ['nama' => 'Sifir Khomis H PI', 'kategori' => 'Sifir Khomis PI', 'sifir' => 'khomis'],
            ['nama' => 'Sifir Khomis I PI', 'kategori' => 'Sifir Khomis PI', 'sifir' => 'khomis'],
            ['nama' => 'Sifir Khomis J PI', 'kategori' => 'Sifir Khomis PI', 'sifir' => 'khomis'],
            // Sifir Sadis PA (5 kelas)
            ['nama' => 'Sifir Sadis A PA', 'kategori' => 'Sifir Sadis PA', 'sifir' => 'sadis'],
            ['nama' => 'Sifir Sadis B PA', 'kategori' => 'Sifir Sadis PA', 'sifir' => 'sadis'],
            ['nama' => 'Sifir Sadis C PA', 'kategori' => 'Sifir Sadis PA', 'sifir' => 'sadis'],
            ['nama' => 'Sifir Sadis D PA', 'kategori' => 'Sifir Sadis PA', 'sifir' => 'sadis'],
            ['nama' => 'Sifir Sadis E PA', 'kategori' => 'Sifir Sadis PA', 'sifir' => 'sadis'],
            // Sifir Sadis PI (5 kelas)
            ['nama' => 'Sifir Sadis F PI', 'kategori' => 'Sifir Sadis PI', 'sifir' => 'sadis'],
            ['nama' => 'Sifir Sadis G PI', 'kategori' => 'Sifir Sadis PI', 'sifir' => 'sadis'],
            ['nama' => 'Sifir Sadis H PI', 'kategori' => 'Sifir Sadis PI', 'sifir' => 'sadis'],
            ['nama' => 'Sifir Sadis I PI', 'kategori' => 'Sifir Sadis PI', 'sifir' => 'sadis'],
            ['nama' => 'Sifir Sadis J PI', 'kategori' => 'Sifir Sadis PI', 'sifir' => 'sadis'],
        ];

        $kelompokIds = [];
        foreach ($kelompokData as $k) {
            $kelompok = KelompokBelajar::create($k);
            $kelompokIds[$k['nama']] = $kelompok->id;
        }

        // ===== SISWA =====
        $siswaData = [
            [
                'nis' => '2024001', 'nisn' => '0012345001',
                'nama' => 'ABDUL HANIF AWINDRA PUTRA',
                'tempat_lahir' => 'Gresik', 'tanggal_lahir' => '2010-03-15',
                'jenis_kelamin' => 'L', 'status' => 'Aktif',
                'kelas' => 'Sifir Awal A PA',
                'alamat' => 'Jl. KH. Abdul Wahab No. 1 Bungah, Gresik',
                'asal_sekolah' => 'MI Qomaruddin',
                'nama_ayah' => 'Ahmad Fauzi', 'nama_ibu' => 'Siti Aisyah',
                'pekerjaan_ayah' => 'Wiraswasta', 'pekerjaan_ibu' => 'IRT',
                'no_telepon_wali' => '081234567890',
                'tanggal_masuk' => '2024-07-01',
            ],
            [
                'nis' => '2024002', 'nisn' => '0012345002',
                'nama' => 'ADHA FAJRIL FALAH',
                'tempat_lahir' => 'Lamongan', 'tanggal_lahir' => '2011-06-22',
                'jenis_kelamin' => 'L', 'status' => 'Aktif',
                'kelas' => 'Sifir Awal A PA',
                'alamat' => 'Jl. Raya Lamongan No. 45',
                'asal_sekolah' => 'SDN Lamongan 3',
                'nama_ayah' => 'Moh. Falah', 'nama_ibu' => 'Nur Fadilah',
                'pekerjaan_ayah' => 'Petani', 'pekerjaan_ibu' => 'Guru',
                'no_telepon_wali' => '082345678901',
                'tanggal_masuk' => '2024-07-01',
            ],
            [
                'nis' => '2024003', 'nisn' => '0012345003',
                'nama' => 'AHMAD AFDHAL HAQ',
                'tempat_lahir' => 'Surabaya', 'tanggal_lahir' => '2010-01-08',
                'jenis_kelamin' => 'L', 'status' => 'Aktif',
                'kelas' => 'Sifir Awal B PA',
                'alamat' => 'Jl. Ampel Suci No. 12 Surabaya',
                'asal_sekolah' => 'MI Al-Hidayah Surabaya',
                'nama_ayah' => 'Nur Haq', 'nama_ibu' => 'Kholifah',
                'pekerjaan_ayah' => 'PNS', 'pekerjaan_ibu' => 'Dosen',
                'no_telepon_wali' => '083456789012',
                'tanggal_masuk' => '2024-07-01',
            ],
            [
                'nis' => '2024004', 'nisn' => '0012345004',
                'nama' => 'AISYAH NUR FADHILAH',
                'tempat_lahir' => 'Gresik', 'tanggal_lahir' => '2011-09-12',
                'jenis_kelamin' => 'P', 'status' => 'Aktif',
                'kelas' => 'Sifir Awal F PI',
                'alamat' => 'Gresik Kota',
                'asal_sekolah' => 'MI Miftahul Ulum',
                'nama_ayah' => 'Fadlillah', 'nama_ibu' => 'Nurul Aini',
                'pekerjaan_ayah' => 'Guru', 'pekerjaan_ibu' => 'IRT',
                'no_telepon_wali' => '084567890123',
                'tanggal_masuk' => '2024-07-01',
            ],
            [
                'nis' => '2024005', 'nisn' => '0012345005',
                'nama' => 'AHMAD ASYABITI AL HAKIM',
                'tempat_lahir' => 'Tuban', 'tanggal_lahir' => '2010-11-04',
                'jenis_kelamin' => 'L', 'status' => 'Aktif',
                'kelas' => 'Sifir Tsani A PA',
                'alamat' => 'Jl. Raya Tuban No. 8',
                'asal_sekolah' => 'SDN Tuban 1',
                'nama_ayah' => 'Al Hakim', 'nama_ibu' => 'Siti Zubaidah',
                'pekerjaan_ayah' => 'Nelayan', 'pekerjaan_ibu' => 'IRT',
                'no_telepon_wali' => '085678901234',
                'tanggal_masuk' => '2024-07-01',
            ],
            [
                'nis' => '2024006', 'nisn' => '0012345006',
                'nama' => 'FATIMAH AZZAHRA PUTRI',
                'tempat_lahir' => 'Sidoarjo', 'tanggal_lahir' => '2011-02-27',
                'jenis_kelamin' => 'P', 'status' => 'Aktif',
                'kelas' => 'Sifir Tsani F PI',
                'alamat' => 'Sidoarjo Kota',
                'asal_sekolah' => 'MI Nurul Huda Sidoarjo',
                'nama_ayah' => 'Azzam', 'nama_ibu' => 'Fatimah',
                'pekerjaan_ayah' => 'Dokter', 'pekerjaan_ibu' => 'Apoteker',
                'no_telepon_wali' => '086789012345',
                'tanggal_masuk' => '2024-07-01',
            ],
            [
                'nis' => '2024007', 'nisn' => '0012345007',
                'nama' => 'AHMAD FATIH ALFINO',
                'tempat_lahir' => 'Mojokerto', 'tanggal_lahir' => '2010-07-19',
                'jenis_kelamin' => 'L', 'status' => 'Nonaktif',
                'kelas' => 'Sifir Tsalis A PA',
                'alamat' => 'Mojokerto',
                'asal_sekolah' => 'SDN Mojokerto 5',
                'nama_ayah' => 'Alfino', 'nama_ibu' => 'Mariyah',
                'pekerjaan_ayah' => 'Buruh', 'pekerjaan_ibu' => 'IRT',
                'no_telepon_wali' => '087890123456',
                'tanggal_masuk' => '2024-07-01',
            ],
            [
                'nis' => '2024008', 'nisn' => '0012345008',
                'nama' => 'KHOIRUNNISA AULIA RAHMA',
                'tempat_lahir' => 'Jombang', 'tanggal_lahir' => '2011-05-03',
                'jenis_kelamin' => 'P', 'status' => 'Aktif',
                'kelas' => 'Sifir Tsalis F PI',
                'alamat' => 'Jombang',
                'asal_sekolah' => 'MI Al-Mubarok Jombang',
                'nama_ayah' => 'Rahmat', 'nama_ibu' => 'Aulia',
                'pekerjaan_ayah' => 'Guru', 'pekerjaan_ibu' => 'Pedagang',
                'no_telepon_wali' => '088901234567',
                'tanggal_masuk' => '2024-07-01',
            ],
            [
                'nis' => '2024009', 'nisn' => '0012345009',
                'nama' => 'AHMAD GUNTUR BASHARUDIN',
                'tempat_lahir' => 'Gresik', 'tanggal_lahir' => '2010-12-14',
                'jenis_kelamin' => 'L', 'status' => 'Aktif',
                'kelas' => "Sifir Robi' A PA",
                'alamat' => 'Bungah, Gresik',
                'asal_sekolah' => 'MI Qomaruddin',
                'nama_ayah' => 'Basharudin', 'nama_ibu' => 'Halimah',
                'pekerjaan_ayah' => 'PNS', 'pekerjaan_ibu' => 'Bidan',
                'no_telepon_wali' => '089012345678',
                'tanggal_masuk' => '2024-07-01',
            ],
            [
                'nis' => '2024010', 'nisn' => '0012345010',
                'nama' => 'AMRUSSIHAB AHMAD',
                'tempat_lahir' => 'Lamongan', 'tanggal_lahir' => '2011-08-30',
                'jenis_kelamin' => 'L', 'status' => 'Aktif',
                'kelas' => 'Sifir Awal B PA',
                'alamat' => 'Lamongan',
                'asal_sekolah' => 'SDN Lamongan 7',
                'nama_ayah' => 'Ahmad', 'nama_ibu' => 'Rahmawati',
                'pekerjaan_ayah' => 'Pedagang', 'pekerjaan_ibu' => 'IRT',
                'no_telepon_wali' => '081123456789',
                'tanggal_masuk' => '2024-07-01',
            ],
        ];

        foreach ($siswaData as $data) {
            $kelas = $data['kelas'];
            $siswa = Siswa::create($data);

            // Assign to kelompok belajar
            if (isset($kelompokIds[$kelas])) {
                $siswa->kelompokBelajar()->attach($kelompokIds[$kelas]);
            }
        }
    }
}
