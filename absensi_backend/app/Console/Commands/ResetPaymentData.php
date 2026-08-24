<?php

namespace App\Console\Commands;

use App\Models\AcademicYear;
use App\Models\PaymentBill;
use App\Models\PaymentBillRule;
use App\Models\PaymentTransaction;
use App\Models\PaymentTransactionItem;
use App\Models\Pembayaran;
use App\Services\PaymentBillService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class ResetPaymentData extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'payment:reset {--no-generate : Jangan generate ulang tagihan setelah reset}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Reset seluruh data transaksi pembayaran, tagihan, dan aturan tagihan untuk keperluan testing';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->warn("=================================================");
        $this->warn("         RESET DATA PEMBAYARAN & TAGIHAN         ");
        $this->warn("=================================================");
        
        $this->info("Menghapus seluruh riwayat transaksi, pembayaran, dan tagihan...");

        try {
            $candidateTables = [
                'pembayaran',
                'payment_bills',
                'payment_bill_month_items',
                'payment_bill_notifications',
                'payment_bill_rule_student',
                'payment_bill_rules',
                'payment_transactions',
                'payment_transaction_items',
                'pemasukan_lain',
                'pengeluaran',
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

            $this->info("✓ Data transaksi pembayaran berhasil dibersihkan.");
            $this->info("✓ Data tagihan (bills) berhasil dibersihkan.");
            $this->info("✓ Aturan penagihan (bill rules) berhasil dibersihkan.");

            if (!$this->option('no-generate')) {
                $this->info("Men-generate ulang tagihan bersih untuk periode akademik aktif...");
                $activeYear = AcademicYear::query()->with('semesters')->where('is_active', true)->first();

                if ($activeYear) {
                    $activeSemester = $activeYear->semesters->firstWhere('is_active', true);
                    $count = app(PaymentBillService::class)->generateBillsForAcademicPeriod($activeYear, $activeSemester);
                    $semesterName = $activeSemester?->name ?? 'Ganjil';
                    $this->info("✓ Berhasil men-generate {$count} tagihan baru untuk {$activeYear->name} - {$semesterName}.");
                } else {
                    $this->warn("! Tidak ada Tahun Ajaran aktif saat ini. Buka web admin untuk mengaktifkan semester.");
                }
            }

            $this->info("=================================================");
            $this->info("       RESET SELESAI! DATABASE SIAP DIUJI        ");
            $this->info("=================================================");

            return 0;
        } catch (\Throwable $e) {
            $this->error("Gagal melakukan reset: " . $e->getMessage());
            return 1;
        }
    }
}
