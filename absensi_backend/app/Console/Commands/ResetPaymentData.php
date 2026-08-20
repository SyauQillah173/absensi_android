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
            $driver = DB::connection()->getDriverName();

            if ($driver === 'pgsql') {
                DB::statement('TRUNCATE TABLE payment_transaction_items, payment_transactions, pembayaran, payment_bills, payment_bill_rules RESTART IDENTITY CASCADE;');
            } else {
                Schema::disableForeignKeyConstraints();
                if (Schema::hasTable('payment_transaction_items')) {
                    DB::table('payment_transaction_items')->truncate();
                }
                if (Schema::hasTable('payment_transactions')) {
                    DB::table('payment_transactions')->truncate();
                }
                if (Schema::hasTable('pembayaran')) {
                    DB::table('pembayaran')->truncate();
                }
                if (Schema::hasTable('payment_bills')) {
                    DB::table('payment_bills')->truncate();
                }
                if (Schema::hasTable('payment_bill_rules')) {
                    DB::table('payment_bill_rules')->truncate();
                }
                Schema::enableForeignKeyConstraints();
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
