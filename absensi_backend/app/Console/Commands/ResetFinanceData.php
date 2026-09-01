<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class ResetFinanceData extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'finance:reset 
                            {--kas-only : Hanya reset data kas masuk lain dan pengeluaran}
                            {--keep-bills : Jangan hapus tagihan santri, hanya reset transaksi pembayaran}
                            {--force : Jalankan langsung tanpa konfirmasi interaktif}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Reset seluruh data transaksi keuangan (Transaksi Pembayaran SPP, Kas Masuk Lain, Pengeluaran Kas) untuk keperluan testing';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info("=================================================================");
        $this->info("      💰 RESET DATA TRANSAKSI KEUANGAN & KAS PESANTREN           ");
        $this->info("=================================================================");

        $isKasOnly = $this->option('kas-only');
        $keepBills = $this->option('keep-bills');
        $force = $this->option('force');

        if (!$force && !$this->confirm('Apakah Anda yakin ingin mereset seluruh data transaksi keuangan hasil uji coba?', true)) {
            $this->warn("Operasi reset dibatalkan.");
            return 0;
        }

        try {
            $candidateTables = [];

            if ($isKasOnly) {
                $candidateTables = [
                    'pemasukan_lain',
                    'pemasukan_lains',
                    'pengeluaran',
                    'pengeluarans',
                ];
                $this->info("▶ Membersihkan data Kas Masuk Lain & Pengeluaran...");
            } else {
                $candidateTables = [
                    'pembayaran',
                    'pembayarans',
                    'payment_transactions',
                    'payment_transaction_items',
                    'payment_bill_notifications',
                    'payment_bill_month_items',
                    'pemasukan_lain',
                    'pemasukan_lains',
                    'pengeluaran',
                    'pengeluarans',
                ];

                if (!$keepBills) {
                    $candidateTables[] = 'tagihan_santris';
                    $candidateTables[] = 'payment_bills';
                }

                $this->info("▶ Membersihkan seluruh transaksi pembayaran, kas masuk lain, dan pengeluaran...");
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

            // If keepBills is active, reset the paid status of bills to 0 / Unpaid
            if ($keepBills && Schema::hasTable('tagihan_santris')) {
                DB::table('tagihan_santris')->update([
                    'terbayar' => 0,
                    'status' => 'Belum Lunas',
                    'updated_at' => now(),
                ]);
                $this->info("✓ Status seluruh Tagihan Santri dikembalikan menjadi Belum Lunas (0 terbayar).");
            }

            $this->newLine();
            $this->info("-----------------------------------------------------------------");
            $this->info("  STATUS HASIL PEMBERSIHAN KEUANGAN:");
            $this->info("-----------------------------------------------------------------");
            if (!$isKasOnly) {
                $this->info("  ✓ Data Riwayat Transaksi Pembayaran Santri : [BERSIH / KOSONG]");
                if (!$keepBills) {
                    $this->info("  ✓ Data Tagihan Santri Uji Coba            : [BERSIH / KOSONG]");
                }
            }
            $this->info("  ✓ Data Pemasukan Kas Masuk Lain (Non-SPP)  : [BERSIH / KOSONG]");
            $this->info("  ✓ Data Pengeluaran Kas Operasional         : [BERSIH / KOSONG]");
            $this->info("-----------------------------------------------------------------");
            $this->comment("  🔒 DATA PENTING TETAP AMAN 100%:");
            $this->comment("  • Data Santri & Wali (siswa)          : [UTUH / TIDAK TERHAPUS]");
            $this->comment("  • Akun User, Admin, Guru (users)      : [UTUH / TIDAK TERHAPUS]");
            $this->comment("  • Master Tarif & Tipe Tagihan         : [UTUH / TIDAK TERHAPUS]");
            $this->info("=================================================================");
            $this->info("  ✅ KEUANGAN BERHASIL DIRESET! SIAP UNTUK DIGUNAKAN KEMBALI      ");
            $this->info("=================================================================");

            return 0;
        } catch (\Throwable $e) {
            $this->error("Gagal melakukan reset keuangan: " . $e->getMessage());
            return 1;
        }
    }
}
