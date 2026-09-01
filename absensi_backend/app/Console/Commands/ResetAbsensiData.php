<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class ResetAbsensiData extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'absensi:reset 
                            {--with-schedules : Reset juga seluruh susunan jadwal KBM Madin dan jadwal Ngaji Kitab}
                            {--force : Jalankan langsung tanpa konfirmasi interaktif}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Reset seluruh log kehadiran/presensi (Presensi Madin, Sholat Jamaah, Ngaji Kitab) untuk keperluan testing';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info("=================================================================");
        $this->info("      🕌 RESET LOG DATA ABSENSI & PRESENSI PESANTREN             ");
        $this->info("=================================================================");

        $withSchedules = $this->option('with-schedules');
        $force = $this->option('force');

        $prompt = $withSchedules
            ? 'Apakah Anda yakin ingin mereset seluruh LOG ABSENSI dan SUSUNAN JADWAL hasil uji coba?'
            : 'Apakah Anda yakin ingin mereset seluruh LOG ABSENSI (Madin, Sholat, Ngaji) hasil uji coba?';

        if (!$force && !$this->confirm($prompt, true)) {
            $this->warn("Operasi reset dibatalkan.");
            return 0;
        }

        try {
            $candidateTables = [
                'absensis',
                'absensi_sholat',
                'absensi_ngaji',
            ];

            if ($withSchedules) {
                $candidateTables[] = 'jadwal_pelajarans';
                $candidateTables[] = 'ngaji_schedules';
                $candidateTables[] = 'guru_mata_pelajaran';
                $this->info("▶ Membersihkan seluruh Log Absensi dan Susunan Jadwal...");
            } else {
                $this->info("▶ Membersihkan seluruh Log Absensi (Madin, Sholat, Ngaji)...");
            }

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

            $this->newLine();
            $this->info("-----------------------------------------------------------------");
            $this->info("  STATUS HASIL PEMBERSIHAN ABSENSI:");
            $this->info("-----------------------------------------------------------------");
            $this->info("  ✓ Log Absensi KBM Madin                  : [BERSIH / KOSONG]");
            $this->info("  ✓ Log Absensi Sholat Jama'ah Santri      : [BERSIH / KOSONG]");
            $this->info("  ✓ Log Absensi Ngaji Kitab Santri         : [BERSIH / KOSONG]");
            if ($withSchedules) {
                $this->info("  ✓ Susunan Jadwal KBM Madin & Ngaji       : [BERSIH / KOSONG]");
            } else {
                $this->info("  • Susunan Jadwal KBM & Ngaji             : [DIPERTAHANKAN]");
            }
            $this->info("-----------------------------------------------------------------");
            $this->comment("  🔒 DATA MASTER & PENTING TETAP AMAN 100%:");
            $this->comment("  • Data Santri & Wali (siswa)             : [UTUH / TIDAK TERHAPUS]");
            $this->comment("  • Akun Guru, Admin, Pengasuh (users)     : [UTUH / TIDAK TERHAPUS]");
            $this->comment("  • Master Kelas & Kelompok Belajar        : [UTUH / TIDAK TERHAPUS]");
            $this->comment("  • Master Komplek & Kamar Asrama          : [UTUH / TIDAK TERHAPUS]");
            $this->comment("  • Master Mata Pelajaran & Kitab Ngaji    : [UTUH / TIDAK TERHAPUS]");
            $this->comment("  • Master Sesi Ngaji & Waktu Sholat       : [UTUH / TIDAK TERHAPUS]");
            $this->info("=================================================================");
            $this->info("  ✅ ABSENSI BERHASIL DIRESET! SIAP UNTUK DIGUNAKAN KEMBALI       ");
            $this->info("=================================================================");

            return 0;
        } catch (\Throwable $e) {
            $this->error("Gagal melakukan reset absensi: " . $e->getMessage());
            return 1;
        }
    }
}
