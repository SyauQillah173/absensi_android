<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('pengeluaran', function (Blueprint $table) {
            if (!Schema::hasColumn('pengeluaran', 'pos_pengeluaran')) {
                $table->string('pos_pengeluaran', 50)->default('pondok')->after('kategori');
                $table->index('pos_pengeluaran');
            }
        });

        // Pastikan seluruh data yang sudah ada memiliki nilai default 'pondok' jika null atau kosong
        DB::table('pengeluaran')
            ->whereNull('pos_pengeluaran')
            ->orWhere('pos_pengeluaran', '')
            ->update(['pos_pengeluaran' => 'pondok']);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('pengeluaran', function (Blueprint $table) {
            if (Schema::hasColumn('pengeluaran', 'pos_pengeluaran')) {
                $table->dropIndex(['pos_pengeluaran']);
                $table->dropColumn('pos_pengeluaran');
            }
        });
    }
};
