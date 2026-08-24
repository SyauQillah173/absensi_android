<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('pengeluaran', function (Blueprint $table) {
            if (!Schema::hasColumn('pengeluaran', 'no_transaksi')) {
                $table->string('no_transaksi', 50)->nullable()->after('id');
            }
            if (!Schema::hasColumn('pengeluaran', 'dibayarkan_kepada')) {
                $table->string('dibayarkan_kepada', 255)->nullable()->after('judul');
            }
            if (!Schema::hasColumn('pengeluaran', 'metode_pembayaran')) {
                $table->string('metode_pembayaran', 50)->nullable()->default('Tunai')->after('kategori');
            }
            if (!Schema::hasColumn('pengeluaran', 'bukti_foto')) {
                $table->string('bukti_foto', 255)->nullable()->after('keterangan');
            }
            if (!Schema::hasColumn('pengeluaran', 'academic_year_id')) {
                $table->foreignId('academic_year_id')->nullable()->after('diinput_oleh')->constrained('academic_years')->nullOnDelete();
            }
            if (!Schema::hasColumn('pengeluaran', 'semester_id')) {
                $table->foreignId('semester_id')->nullable()->after('academic_year_id')->constrained('semesters')->nullOnDelete();
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('pengeluaran', function (Blueprint $table) {
            if (Schema::hasColumn('pengeluaran', 'semester_id')) {
                $table->dropForeign(['semester_id']);
                $table->dropColumn('semester_id');
            }
            if (Schema::hasColumn('pengeluaran', 'academic_year_id')) {
                $table->dropForeign(['academic_year_id']);
                $table->dropColumn('academic_year_id');
            }
            if (Schema::hasColumn('pengeluaran', 'bukti_foto')) {
                $table->dropColumn('bukti_foto');
            }
            if (Schema::hasColumn('pengeluaran', 'metode_pembayaran')) {
                $table->dropColumn('metode_pembayaran');
            }
            if (Schema::hasColumn('pengeluaran', 'dibayarkan_kepada')) {
                $table->dropColumn('dibayarkan_kepada');
            }
            if (Schema::hasColumn('pengeluaran', 'no_transaksi')) {
                $table->dropColumn('no_transaksi');
            }
        });
    }
};
