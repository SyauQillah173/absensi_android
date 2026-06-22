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
        Schema::table('payment_methods', function (Blueprint $table) {
            if (!Schema::hasColumn('payment_methods', 'icon')) {
                $table->string('icon')->nullable()->after('name');
            }
            if (!Schema::hasColumn('payment_methods', 'sort_order')) {
                $table->unsignedSmallInteger('sort_order')->default(100)->index()->after('is_active');
            }
        });

        Schema::table('payment_period_types', function (Blueprint $table) {
            if (!Schema::hasColumn('payment_period_types', 'uses_month')) {
                $table->boolean('uses_month')->default(false)->after('is_general');
            }
            if (!Schema::hasColumn('payment_period_types', 'uses_semester')) {
                $table->boolean('uses_semester')->default(false)->after('uses_month');
            }
            if (!Schema::hasColumn('payment_period_types', 'month_mode')) {
                $table->string('month_mode', 20)->default('semester')->after('uses_semester');
            }
            if (!Schema::hasColumn('payment_period_types', 'due_day')) {
                $table->unsignedTinyInteger('due_day')->nullable()->after('needs_due_day');
            }
            if (!Schema::hasColumn('payment_period_types', 'sort_order')) {
                $table->unsignedSmallInteger('sort_order')->default(100)->index()->after('is_active');
            }
        });

        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'admin_type')) {
                $table->string('admin_type', 30)->nullable()->index()->after('role_id');
            }
        });

        DB::table('users')
            ->where('role', 'admin')
            ->whereNull('admin_type')
            ->update(['admin_type' => 'utama', 'updated_at' => now()]);

        foreach ($this->paymentMethods() as $index => $method) {
            DB::table('payment_methods')->updateOrInsert(
                ['code' => $method['code']],
                [
                    'name' => $method['name'],
                    'icon' => $method['icon'],
                    'is_active' => true,
                    'sort_order' => ($index + 1) * 10,
                    'updated_at' => now(),
                    'created_at' => now(),
                ]
            );
        }

        foreach ($this->paymentPeriods() as $index => $period) {
            DB::table('payment_period_types')->updateOrInsert(
                ['code' => $period['code']],
                array_merge($period, [
                    'sort_order' => ($index + 1) * 10,
                    'updated_at' => now(),
                    'created_at' => now(),
                ])
            );
        }
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'admin_type')) {
                $table->dropColumn('admin_type');
            }
        });

        Schema::table('payment_period_types', function (Blueprint $table) {
            foreach (['sort_order', 'due_day', 'month_mode', 'uses_semester', 'uses_month'] as $column) {
                if (Schema::hasColumn('payment_period_types', $column)) {
                    $table->dropColumn($column);
                }
            }
        });

        Schema::table('payment_methods', function (Blueprint $table) {
            foreach (['sort_order', 'icon'] as $column) {
                if (Schema::hasColumn('payment_methods', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }

    private function paymentMethods(): array
    {
        return collect([
            ['name' => 'Tunai', 'icon' => 'payments'],
            ['name' => 'Bank BCA', 'icon' => 'account_balance'],
            ['name' => 'Bank BRI', 'icon' => 'account_balance'],
            ['name' => 'Bank BSI', 'icon' => 'account_balance'],
            ['name' => 'Bank Mandiri', 'icon' => 'account_balance'],
            ['name' => 'Transfer Bank', 'icon' => 'account_balance'],
            ['name' => 'Transfer Dana', 'icon' => 'send'],
            ['name' => 'QRIS', 'icon' => 'qr_code_2'],
            ['name' => 'E-Wallet', 'icon' => 'account_balance_wallet'],
            ['name' => 'Lainnya', 'icon' => 'more_horiz'],
        ])->map(fn (array $method) => [
            ...$method,
            'code' => Str::slug($method['name'], '_'),
        ])->all();
    }

    private function paymentPeriods(): array
    {
        return [
            ['code' => 'harian', 'name' => 'Harian', 'description' => 'Pembayaran berulang harian.', 'is_daily' => true, 'is_monthly' => false, 'is_general' => false, 'uses_month' => false, 'uses_semester' => false, 'needs_due_day' => false, 'due_day' => null, 'month_mode' => 'semester', 'is_active' => true],
            ['code' => 'mingguan', 'name' => 'Mingguan', 'description' => 'Pembayaran berulang mingguan.', 'is_daily' => false, 'is_monthly' => false, 'is_general' => false, 'uses_month' => false, 'uses_semester' => false, 'needs_due_day' => false, 'due_day' => null, 'month_mode' => 'semester', 'is_active' => true],
            ['code' => 'bulanan', 'name' => 'Bulanan', 'description' => 'Tagihan dibuat per bulan.', 'is_daily' => false, 'is_monthly' => true, 'is_general' => false, 'uses_month' => true, 'uses_semester' => true, 'needs_due_day' => true, 'due_day' => 10, 'month_mode' => 'semester', 'is_active' => true],
            ['code' => 'semesteran', 'name' => 'Semesteran', 'description' => 'Pembayaran per semester.', 'is_daily' => false, 'is_monthly' => false, 'is_general' => false, 'uses_month' => false, 'uses_semester' => true, 'needs_due_day' => false, 'due_day' => null, 'month_mode' => 'semester', 'is_active' => true],
            ['code' => 'tahunan', 'name' => 'Tahunan', 'description' => 'Pembayaran per tahun.', 'is_daily' => false, 'is_monthly' => false, 'is_general' => false, 'uses_month' => false, 'uses_semester' => false, 'needs_due_day' => false, 'due_day' => null, 'month_mode' => 'full_year', 'is_active' => true],
            ['code' => 'sekali', 'name' => 'Sekali Bayar', 'description' => 'Tagihan dibuat satu kali.', 'is_daily' => false, 'is_monthly' => false, 'is_general' => false, 'uses_month' => false, 'uses_semester' => false, 'needs_due_day' => false, 'due_day' => null, 'month_mode' => 'semester', 'is_active' => true],
            ['code' => 'umum', 'name' => 'Umum', 'description' => 'Pembayaran fleksibel seperti kitab atau seragam.', 'is_daily' => false, 'is_monthly' => false, 'is_general' => true, 'uses_month' => false, 'uses_semester' => true, 'needs_due_day' => false, 'due_day' => null, 'month_mode' => 'semester', 'is_active' => true],
        ];
    }
};
