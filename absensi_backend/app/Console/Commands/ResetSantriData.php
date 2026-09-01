<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class ResetSantriData extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'santri:reset {--force : Jalankan reset tanpa konfirmasi}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Bersihkan seluruh data santri (siswa, kamar pondok, absensi, tagihan & akun wali) menjadi 0 tanpa menghapus admin, guru, kelas, atau mapel';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->warn("=================================================");
        $this->warn("           RESET DATA SANTRI / SISWA             ");
        $this->warn("=================================================");
        $this->warn("PERINGATAN: Perintah ini akan mengosongkan:");
        $this->line("- Seluruh data Santri / Siswa (tabel siswa)");
        $this->line("- Seluruh relasi Santri Pondok (tabel santri_pondok)");
        $this->line("- Seluruh Akun Wali Santri (users role 'wali' & guardian_profiles)");
        $this->line("- Seluruh riwayat Absensi Santri (Madin, Sholat, Ngaji)");
        $this->line("- Seluruh Riwayat Tagihan & Pembayaran Santri");
        $this->warn("-------------------------------------------------");
        $this->info("DATA YANG TETAP AMAN & TIDAK DIHAPUS:");
        $this->info("✓ Akun Admin (role admin)");
        $this->info("✓ Akun Guru & Ustadz (role guru)");
        $this->info("✓ Master Data Kelas Madin & Formal (school_classes)");
        $this->info("✓ Master Mata Pelajaran & Jadwal");
        $this->info("✓ Master Komplek & Kamar Pondok");
        $this->info("✓ Master Pos Keuangan & Tarif");
        $this->warn("=================================================");

        if (!$this->option('force') && !$this->confirm('Apakah Anda yakin ingin mengosongkan seluruh data santri sekarang?')) {
            $this->info('Reset dibatalkan.');
            return 0;
        }

        $this->info('Memulai proses pembersihan data santri...');

        try {
            // 1. Hapus akun wali santri (HANYA role wali, TIDAK menghapus admin/guru)
            $waliCount = User::where('role', 'wali')->count();
            User::where('role', 'wali')->delete();
            $this->info("✓ Berhasil menghapus {$waliCount} akun wali santri.");

            // 2. Daftar tabel yang terkait langsung dengan data santri
            $candidateTables = [
                'santri_pondok',
                'guardian_profiles',
                'absensis',
                'absensi_sholats',
                'absensi_ngajis',
                'nilais',
                'nilai_hafalans',
                'payment_bill_month_items',
                'payment_bill_notifications',
                'payment_bill_rule_student',
                'payment_transaction_items',
                'payment_transactions',
                'payment_bills',
                'pembayaran',
                'buku_induk_entries',
                'siswa',
            ];

            $existingTables = [];
            foreach ($candidateTables as $tableName) {
                if (Schema::hasTable($tableName)) {
                    $existingTables[] = $tableName;
                }
            }

            if (!empty($existingTables)) {
                $driver = DB::connection()->getDriverName();
                if ($driver === 'pgsql') {
                    $tableList = implode(', ', $existingTables);
                    DB::statement("TRUNCATE TABLE {$tableList} RESTART IDENTITY CASCADE;");
                } else {
                    Schema::disableForeignKeyConstraints();
                    foreach ($existingTables as $tableName) {
                        DB::table($tableName)->truncate();
                    }
                    Schema::enableForeignKeyConstraints();
                }
            }

            $this->info('✓ Seluruh data santri dan transaksi terkait berhasil di-reset menjadi 0.');
            $this->info("=================================================");
            $this->info("   DATABASE SIAP! ANDA DAPAT MENGIMPORT DATA BARU");
            $this->info("=================================================");

            return 0;
        } catch (\Throwable $e) {
            $this->error('Gagal mereset data: ' . $e->getMessage());
            return 1;
        }
    }
}
