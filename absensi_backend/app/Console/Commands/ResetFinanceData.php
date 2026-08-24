<?php

namespace App\Console\Commands;

use App\Models\AcademicYear;
use App\Models\PaymentBill;
use App\Models\PaymentBillRule;
use App\Models\PaymentTransaction;
use App\Models\PaymentTransactionItem;
use App\Models\Pembayaran;
use App\Models\PemasukanLain;
use App\Models\Pengeluaran;
use App\Models\Semester;
use App\Services\PaymentBillService;
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
                            {--all : Reset seluruh transaksi keuangan dan master tahun ajaran}
                            {--with-academic : Reset transaksi dan kembalikan tahun ajaran ke default awal (2025/2026 Ganjil)}
                            {--fresh-academic : Kosongkan seluruh tahun ajaran agar bisa input setting akademik dari nol}
                            {--no-generate : Jangan generate ulang tagihan setelah reset}
                            {--kas-only : Hanya reset kas masuk lain dan pengeluaran}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Reset seluruh data transaksi keuangan (Transaksi Siswa, Kas Masuk Lain, Pengeluaran) dan setting akademik untuk keperluan testing';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->warn("=================================================================");
        $this->warn("      RESET TOTAL SISTEM KEUANGAN & TESTING PESANTREN           ");
        $this->warn("=================================================================");

        $isKasOnly = $this->option('kas-only');
        $withAcademic = $this->option('with-academic') || $this->option('all');
        $freshAcademic = $this->option('fresh-academic');

        try {
            $candidateTables = [];

            if ($isKasOnly) {
                $candidateTables = [
                    'pemasukan_lain',
                    'pengeluaran',
                ];
                $this->info("Membersihkan data Kas Masuk Lain & Pengeluaran...");
            } else {
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

                if ($withAcademic || $freshAcademic) {
                    $candidateTables[] = 'semesters';
                    $candidateTables[] = 'academic_years';
                }

                $this->info("Membersihkan seluruh transaksi siswa, tagihan, kas masuk lain, dan pengeluaran...");
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

            if (!$isKasOnly) {
                $this->info("✓ Data Transaksi Pembayaran Santri berhasil dibersihkan.");
                $this->info("✓ Data Tagihan Santri (Bills & Rules) berhasil dibersihkan.");
            }
            $this->info("✓ Data Pemasukan Kas Lain (Non-Santri) berhasil dibersihkan.");
            $this->info("✓ Data Pengeluaran Kas berhasil dibersihkan.");

            if ($withAcademic) {
                $this->info("Menginisialisasi Tahun Ajaran Default (2025/2026 - Ganjil Aktif)...");
                $defaultYear = AcademicYear::create([
                    'name' => '2025/2026',
                    'start_date' => '2025-07-01',
                    'end_date' => '2026-06-30',
                    'year_start' => 2025,
                    'year_end' => 2026,
                    'active_semester' => 'Ganjil',
                    'is_active' => true,
                ]);

                Semester::create([
                    'academic_year_id' => $defaultYear->id,
                    'code' => '20251',
                    'name' => 'Ganjil',
                    'is_active' => true,
                ]);

                Semester::create([
                    'academic_year_id' => $defaultYear->id,
                    'code' => '20252',
                    'name' => 'Genap',
                    'is_active' => false,
                ]);
                $this->info("✓ Tahun Ajaran 2025/2026 (Ganjil Aktif) berhasil diinisialisasi.");
            } elseif ($freshAcademic) {
                $this->info("✓ Seluruh Tahun Ajaran & Semester telah dikosongkan. Silakan buat Tahun Ajaran baru di web admin.");
            }

            // Auto-generate bills if not disabled and not fresh/kas-only
            if (!$this->option('no-generate') && !$isKasOnly && !$freshAcademic) {
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

            $this->info("=================================================================");
            $this->info("         RESET SELESAI! SELURUH SISTEM SIAP DIUJI COBA          ");
            $this->info("=================================================================");

            return 0;
        } catch (\Throwable $e) {
            $this->error("Gagal melakukan reset: " . $e->getMessage());
            return 1;
        }
    }
}
