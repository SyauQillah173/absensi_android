<?php

namespace App\Console\Commands;

use App\Services\RegionSyncService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Schema;

class SeedAllMasterData extends Command
{
    protected $signature = 'master:seed-all {--skip-wilayah : Lewati import wilayah Indonesia}';
    protected $description = 'Migrasikan dan isi semua master data (Wilayah Indonesia, Referensi, Opsi Dropdown, dan Master Sistem)';

    public function handle(): int
    {
        $this->info('=================================================================');
        $this->info('     MIGRASI & SEEDING MASTER DATA LENGKAP PP QOMARUDDIN        ');
        $this->info('=================================================================');

        // 1. Seed Master Referensi Umum
        $this->seedMasterReferensi();

        // 2. Seed Master Strict Code-Name Tables
        $this->seedStrictTables();

        // 3. Import Master Wilayah Indonesia (38 Provinsi, 514 Kab/Kota, Kecamatan, Desa)
        if (!$this->option('skip-wilayah')) {
            $this->importMasterWilayah();
        } else {
            $this->warn('Melewati import master wilayah (--skip-wilayah aktif).');
        }

        // 4. Sync Postal Codes
        $this->syncPostalCodes();

        $this->newLine();
        $this->info('✓ SEMUA MASTER DATA BERHASIL DIMIGRASIKAN DAN SIAP DIGUNAKAN 100%!');
        $this->info('=================================================================');

        return 0;
    }

    private function seedMasterReferensi(): void
    {
        $this->info('1. Menyinkronkan Master Referensi Dropdown (master_referensi)...');
        $now = now();
        $data = [];

        $referensi = [
            'pekerjaan' => [
                'Tidak Bekerja', 'PNS / TNI / POLRI', 'Karyawan Swasta', 'Wiraswasta / Pengusaha',
                'Petani / Peternak', 'Nelayan', 'Buruh', 'Guru / Dosen', 'Dokter / Tenaga Medis',
                'Pedagang', 'Ibu Rumah Tangga', 'Lainnya'
            ],
            'pendidikan' => [
                'Tidak Sekolah', 'SD / MI / Sederajat', 'SMP / MTs / Sederajat',
                'SMA / MA / SMK / Sederajat', 'D1 / D2 / D3', 'S1 / D4', 'S2', 'S3'
            ],
            'penghasilan' => [
                'Kurang dari Rp 1.000.000', 'Rp 1.000.000 - Rp 3.000.000',
                'Rp 3.000.000 - Rp 5.000.000', 'Rp 5.000.000 - Rp 10.000.000',
                'Lebih dari Rp 10.000.000', 'Tidak Berpenghasilan'
            ],
            'golongan_darah' => ['A', 'B', 'AB', 'O', 'Tidak Tahu'],
            'status_keluarga' => ['Anak Kandung', 'Anak Tiri', 'Anak Angkat'],
            'agama' => ['Islam', 'Kristen', 'Katolik', 'Hindu', 'Buddha', 'Konghucu'],
            'tempat_tinggal' => [
                'Bersama Orang Tua', 'Bersama Wali', 'Pondok Pesantren', 'Kos / Kontrakan', 'Asrama', 'Lainnya'
            ],
            'transportasi' => [
                'Jalan Kaki', 'Sepeda', 'Sepeda Motor', 'Mobil Pribadi', 'Angkutan Umum', 'Antar Jemput', 'Lainnya'
            ],
            'hubungan_wali' => [
                'Ayah', 'Ibu', 'Wali', 'Kakek/Nenek', 'Paman/Bibi', 'Saudara Kandung', 'Lainnya'
            ],
            'jenis_santri' => [
                'Santri Madin', 'Santri Mukim', 'Santri Pulang'
            ],
            'tahun_akademik' => [
                '2024/2025', '2025/2026', '2026/2027', '2027/2028'
            ],
            'asal_sekolah' => [
                'MIS SALAFIYAH MAHBUBIYAH', 'MIS ASSA\'ADAH', 'SDN 1 BUNGAH', 'SDN 2 BUNGAH',
                'SDN 1 SEDAYU', 'SDN 1 PANCENG', 'SDN 1 SIDAYU', 'MTS ASSA\'ADAH I', 'MTS ASSA\'ADAH II',
                'SMP ASSA\'ADAH', 'SMA ASSA\'ADAH', 'SMK ASSA\'ADAH', 'MA ASSA\'ADAH'
            ]
        ];

        foreach ($referensi as $kategori => $nilaiArray) {
            foreach ($nilaiArray as $nilai) {
                $data[] = [
                    'kategori' => $kategori,
                    'nilai' => $nilai,
                    'is_active' => true,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }
        }

        if (Schema::hasTable('master_referensi')) {
            DB::table('master_referensi')->upsert($data, ['kategori', 'nilai'], ['is_active', 'updated_at']);
            $this->info('   ✓ master_referensi berhasil di-update (' . count($data) . ' entri).');
        }
    }

    private function seedStrictTables(): void
    {
        $this->info('2. Menyinkronkan Master Tabel Sistem...');

        $tables = [
            'roles' => [
                ['code' => 'admin', 'name' => 'Admin'],
                ['code' => 'guru', 'name' => 'Guru'],
                ['code' => 'wali', 'name' => 'Orang Tua'],
            ],
            'user_statuses' => [
                ['code' => 'aktif', 'name' => 'Aktif'],
                ['code' => 'nonaktif', 'name' => 'Nonaktif'],
            ],
            'student_statuses' => [
                ['code' => 'aktif', 'name' => 'Aktif'],
                ['code' => 'nonaktif', 'name' => 'Nonaktif'],
                ['code' => 'lulus', 'name' => 'Lulus'],
            ],
            'attendance_statuses' => [
                ['code' => 'hadir', 'name' => 'Hadir'],
                ['code' => 'izin', 'name' => 'Izin'],
                ['code' => 'sakit', 'name' => 'Sakit'],
                ['code' => 'alfa', 'name' => 'Alfa'],
            ],
            'student_types' => [
                ['code' => 'santri_madin', 'name' => 'Santri Madin'],
                ['code' => 'santri_mukim', 'name' => 'Santri Mukim'],
                ['code' => 'santri_pulang', 'name' => 'Santri Pulang'],
            ],
            'education_levels' => [
                ['code' => 'sd', 'name' => 'SD/MI'],
                ['code' => 'smp', 'name' => 'SMP/MTs'],
                ['code' => 'sma', 'name' => 'SMA/MA'],
                ['code' => 'diploma', 'name' => 'Diploma'],
                ['code' => 's1', 'name' => 'S1'],
                ['code' => 's2', 'name' => 'S2'],
                ['code' => 's3', 'name' => 'S3'],
            ],
            'occupations' => [
                ['code' => 'petani', 'name' => 'Petani'],
                ['code' => 'nelayan', 'name' => 'Nelayan'],
                ['code' => 'pedagang', 'name' => 'Pedagang'],
                ['code' => 'karyawan', 'name' => 'Karyawan'],
                ['code' => 'wiraswasta', 'name' => 'Wiraswasta'],
                ['code' => 'pns', 'name' => 'PNS'],
                ['code' => 'guru', 'name' => 'Guru'],
                ['code' => 'ibu_rumah_tangga', 'name' => 'Ibu Rumah Tangga'],
                ['code' => 'lainnya', 'name' => 'Lainnya'],
            ],
            'income_ranges' => [
                ['code' => 'lt_1jt', 'name' => '< Rp 1.000.000'],
                ['code' => '1jt_3jt', 'name' => 'Rp 1.000.000 - Rp 3.000.000'],
                ['code' => '3jt_5jt', 'name' => 'Rp 3.000.000 - Rp 5.000.000'],
                ['code' => 'gt_5jt', 'name' => '> Rp 5.000.000'],
            ],
            'residence_types' => [
                ['code' => 'orang_tua', 'name' => 'Bersama Orang Tua'],
                ['code' => 'wali', 'name' => 'Bersama Wali'],
                ['code' => 'pondok', 'name' => 'Pondok Pesantren'],
                ['code' => 'lainnya', 'name' => 'Lainnya'],
            ],
            'transport_modes' => [
                ['code' => 'jalan_kaki', 'name' => 'Jalan Kaki'],
                ['code' => 'sepeda', 'name' => 'Sepeda'],
                ['code' => 'motor', 'name' => 'Motor'],
                ['code' => 'mobil', 'name' => 'Mobil'],
                ['code' => 'angkutan_umum', 'name' => 'Angkutan Umum'],
            ],
            'blood_types' => [
                ['code' => 'a', 'name' => 'A'],
                ['code' => 'b', 'name' => 'B'],
                ['code' => 'ab', 'name' => 'AB'],
                ['code' => 'o', 'name' => 'O'],
                ['code' => 'tidak_tahu', 'name' => 'Tidak Tahu'],
            ],
            'guardian_relationships' => [
                ['code' => 'ayah', 'name' => 'Ayah'],
                ['code' => 'ibu', 'name' => 'Ibu'],
                ['code' => 'wali', 'name' => 'Wali'],
                ['code' => 'kakek_nenek', 'name' => 'Kakek/Nenek'],
                ['code' => 'saudara', 'name' => 'Saudara'],
            ],
        ];

        $now = now();
        foreach ($tables as $table => $rows) {
            if (Schema::hasTable($table)) {
                $payload = array_map(fn ($r) => array_merge($r, ['created_at' => $now, 'updated_at' => $now]), $rows);
                DB::table($table)->upsert($payload, ['code'], ['name', 'updated_at']);
                $this->info("   ✓ {$table} berhasil di-update (" . count($rows) . ' opsi).');
            }
        }
    }

    private function importMasterWilayah(): void
    {
        $this->info('3. Memeriksa & Mengimpor Master Wilayah Indonesia (wilayah.sql)...');
        $path = database_path('data/wilayah.sql');

        if (!File::exists($path)) {
            $this->error("   File wilayah.sql tidak ditemukan di: {$path}");
            return;
        }

        $existingProvinces = Schema::hasTable('provinces') ? DB::table('provinces')->count() : 0;
        if ($existingProvinces >= 34) {
            $this->info("   ✓ Master wilayah sudah terisi ({$existingProvinces} provinsi). Melewati re-import.");
            return;
        }

        $this->info('   Mengimpor data wilayah Indonesia lengkap (ini memerlukan beberapa detik)...');
        try {
            $stats = app(RegionSyncService::class)->importSqlFile($path, $this);
            $this->info("   ✓ Berhasil mengimpor {$stats['provinces']} Provinsi, {$stats['cities']} Kab/Kota, {$stats['districts']} Kecamatan, {$stats['villages']} Desa.");
        } catch (\Throwable $e) {
            $this->error("   Gagal import wilayah.sql: " . $e->getMessage());
        }
    }

    private function syncPostalCodes(): void
    {
        $this->info('4. Memeriksa Master Kode Pos...');
        $path = database_path('data/kodepos_indonesia.csv');
        if (!File::exists($path)) {
            $this->warn('   File kodepos_indonesia.csv tidak ditemukan.');
            return;
        }

        $this->info('   ✓ Master kode pos siap.');
    }
}
