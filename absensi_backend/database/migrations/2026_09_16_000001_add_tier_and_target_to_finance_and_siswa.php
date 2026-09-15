<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Tambah kolom pada tabel siswa
        Schema::table('siswa', function (Blueprint $table) {
            if (!Schema::hasColumn('siswa', 'kategori_spp')) {
                $table->string('kategori_spp', 50)->default('Reguler')->after('jenis_santri');
            }
        });

        // 2. Tambah kolom pada tabel payment_types
        Schema::table('payment_types', function (Blueprint $table) {
            if (!Schema::hasColumn('payment_types', 'target_mondok')) {
                $table->string('target_mondok', 50)->default('mondok')->after('target_gender');
            }
            if (!Schema::hasColumn('payment_types', 'tier_pricing_enabled')) {
                $table->boolean('tier_pricing_enabled')->default(false)->after('target_mondok');
            }
            if (!Schema::hasColumn('payment_types', 'nominal_vip')) {
                $table->bigInteger('nominal_vip')->nullable()->after('tier_pricing_enabled');
            }
            if (!Schema::hasColumn('payment_types', 'nominal_reguler')) {
                $table->bigInteger('nominal_reguler')->nullable()->after('nominal_vip');
            }
            if (!Schema::hasColumn('payment_types', 'nominal_keringanan')) {
                $table->bigInteger('nominal_keringanan')->nullable()->after('nominal_reguler');
            }
        });

        // 3. Tambah kolom pada tabel payment_bill_rules
        Schema::table('payment_bill_rules', function (Blueprint $table) {
            if (!Schema::hasColumn('payment_bill_rules', 'target_mondok')) {
                $table->string('target_mondok', 50)->default('mondok')->after('target_gender');
            }
            if (!Schema::hasColumn('payment_bill_rules', 'target_tier')) {
                $table->string('target_tier', 50)->nullable()->after('target_mondok');
            }
            if (!Schema::hasColumn('payment_bill_rules', 'nominal_vip')) {
                $table->bigInteger('nominal_vip')->nullable()->after('nominal');
            }
            if (!Schema::hasColumn('payment_bill_rules', 'nominal_keringanan')) {
                $table->bigInteger('nominal_keringanan')->nullable()->after('nominal_vip');
            }
        });

        // 4. Data Backfill Cerdas Otomatis
        // Set default status_mondok yang kosong menjadi 'mondok'
        DB::table('siswa')
            ->whereNull('status_mondok')
            ->orWhere('status_mondok', '')
            ->update(['status_mondok' => 'mondok']);

        // Backfill kategori_spp santri berdasarkan tagihan riil SPP 2026/2027
        $billsData = DB::table('payment_bills')
            ->where('tahun_ajaran', '2026/2027')
            ->select('siswa_id', DB::raw('MAX(amount) as max_amt'))
            ->groupBy('siswa_id')
            ->get();

        $vipIds = [];
        $keringananIds = [];

        foreach ($billsData as $b) {
            if ($b->max_amt >= 580000) {
                $vipIds[] = $b->siswa_id;
            } elseif ($b->max_amt > 0 && $b->max_amt <= 450000) {
                $keringananIds[] = $b->siswa_id;
            }
        }

        if (!empty($vipIds)) {
            DB::table('siswa')->whereIn('id', $vipIds)->update(['kategori_spp' => 'VIP']);
        }
        if (!empty($keringananIds)) {
            DB::table('siswa')->whereIn('id', $keringananIds)->update(['kategori_spp' => 'Keringanan']);
        }
    }

    public function down(): void
    {
        Schema::table('payment_bill_rules', function (Blueprint $table) {
            $table->dropColumn(['target_mondok', 'target_tier', 'nominal_vip', 'nominal_keringanan']);
        });

        Schema::table('payment_types', function (Blueprint $table) {
            $table->dropColumn([
                'target_mondok',
                'tier_pricing_enabled',
                'nominal_vip',
                'nominal_reguler',
                'nominal_keringanan',
            ]);
        });

        Schema::table('siswa', function (Blueprint $table) {
            $table->dropColumn('kategori_spp');
        });
    }
};
