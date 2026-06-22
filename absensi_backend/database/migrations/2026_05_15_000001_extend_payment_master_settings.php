<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE payment_types DROP CONSTRAINT IF EXISTS payment_types_periode_check');
        DB::statement('ALTER TABLE pembayaran DROP CONSTRAINT IF EXISTS pembayaran_via_check');

        Schema::table('payment_period_types', function (Blueprint $table) {
            if (!Schema::hasColumn('payment_period_types', 'description')) {
                $table->text('description')->nullable()->after('name');
            }
            if (!Schema::hasColumn('payment_period_types', 'is_monthly')) {
                $table->boolean('is_monthly')->default(false)->after('description');
            }
            if (!Schema::hasColumn('payment_period_types', 'is_daily')) {
                $table->boolean('is_daily')->default(false)->after('is_monthly');
            }
            if (!Schema::hasColumn('payment_period_types', 'is_general')) {
                $table->boolean('is_general')->default(false)->after('is_daily');
            }
            if (!Schema::hasColumn('payment_period_types', 'needs_due_day')) {
                $table->boolean('needs_due_day')->default(false)->after('is_general');
            }
            if (!Schema::hasColumn('payment_period_types', 'is_active')) {
                $table->boolean('is_active')->default(true)->index()->after('needs_due_day');
            }
        });

        Schema::table('payment_methods', function (Blueprint $table) {
            if (!Schema::hasColumn('payment_methods', 'description')) {
                $table->text('description')->nullable()->after('name');
            }
            if (!Schema::hasColumn('payment_methods', 'qris_image_path')) {
                $table->string('qris_image_path')->nullable()->after('description');
            }
        });

        foreach ($this->periodTypes() as $period) {
            DB::table('payment_period_types')->updateOrInsert(
                ['code' => $period['code']],
                array_merge($period, [
                    'updated_at' => now(),
                    'created_at' => now(),
                ])
            );
        }

        foreach (['Tunai', 'Transfer Bank', 'QRIS', 'E-Wallet', 'Lainnya'] as $method) {
            DB::table('payment_methods')->updateOrInsert(
                ['code' => Str::slug($method, '_')],
                [
                    'name' => $method,
                    'is_active' => true,
                    'updated_at' => now(),
                    'created_at' => now(),
                ]
            );
        }
    }

    public function down(): void
    {
        Schema::table('payment_methods', function (Blueprint $table) {
            if (Schema::hasColumn('payment_methods', 'qris_image_path')) {
                $table->dropColumn('qris_image_path');
            }
            if (Schema::hasColumn('payment_methods', 'description')) {
                $table->dropColumn('description');
            }
        });

        Schema::table('payment_period_types', function (Blueprint $table) {
            foreach (['is_active', 'needs_due_day', 'is_general', 'is_daily', 'is_monthly', 'description'] as $column) {
                if (Schema::hasColumn('payment_period_types', $column)) {
                    $table->dropColumn($column);
                }
            }
        });

        DB::statement("ALTER TABLE payment_types ADD CONSTRAINT payment_types_periode_check CHECK (periode IN ('sekali', 'bulanan', 'tahunan'))");
        DB::statement("ALTER TABLE pembayaran ADD CONSTRAINT pembayaran_via_check CHECK (via IN ('Transfer Dana', 'Bank BRI', 'Bank Mandiri', 'Bank BSI', 'Bank BCA', 'QRIS', 'Tunai'))");
    }

    private function periodTypes(): array
    {
        return [
            ['code' => 'harian', 'name' => 'Harian', 'description' => 'Pembayaran berulang harian.', 'is_daily' => true, 'is_monthly' => false, 'is_general' => false, 'needs_due_day' => false, 'is_active' => true],
            ['code' => 'bulanan', 'name' => 'Bulanan', 'description' => 'Tagihan dibuat per bulan dengan tanggal jatuh tempo.', 'is_daily' => false, 'is_monthly' => true, 'is_general' => false, 'needs_due_day' => true, 'is_active' => true],
            ['code' => 'umum', 'name' => 'Umum', 'description' => 'Pembayaran bebas seperti kitab, seragam, kegiatan, atau donasi.', 'is_daily' => false, 'is_monthly' => false, 'is_general' => true, 'needs_due_day' => false, 'is_active' => true],
            ['code' => 'sekali', 'name' => 'Sekali Bayar', 'description' => 'Tagihan dibuat satu kali.', 'is_daily' => false, 'is_monthly' => false, 'is_general' => false, 'needs_due_day' => false, 'is_active' => true],
            ['code' => 'mingguan', 'name' => 'Mingguan', 'description' => 'Pembayaran berulang mingguan.', 'is_daily' => false, 'is_monthly' => false, 'is_general' => false, 'needs_due_day' => false, 'is_active' => true],
            ['code' => 'semesteran', 'name' => 'Semesteran', 'description' => 'Pembayaran per semester.', 'is_daily' => false, 'is_monthly' => false, 'is_general' => false, 'needs_due_day' => false, 'is_active' => true],
            ['code' => 'tahunan', 'name' => 'Tahunan', 'description' => 'Pembayaran per tahun.', 'is_daily' => false, 'is_monthly' => false, 'is_general' => false, 'needs_due_day' => false, 'is_active' => true],
        ];
    }
};
