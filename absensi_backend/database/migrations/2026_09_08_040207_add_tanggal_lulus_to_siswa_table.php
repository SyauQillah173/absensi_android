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
        Schema::table('siswa', function (Blueprint $table) {
            if (!Schema::hasColumn('siswa', 'tanggal_lulus')) {
                $table->date('tanggal_lulus')->nullable()->after('tahun_lulus');
            }
            if (!Schema::hasColumn('siswa', 'nomor_ijazah')) {
                $table->string('nomor_ijazah', 100)->nullable()->after('tanggal_lulus');
            }
            if (!Schema::hasColumn('siswa', 'catatan_kelulusan')) {
                $table->text('catatan_kelulusan')->nullable()->after('nomor_ijazah');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('siswa', function (Blueprint $table) {
            if (Schema::hasColumn('siswa', 'catatan_kelulusan')) {
                $table->dropColumn('catatan_kelulusan');
            }
            if (Schema::hasColumn('siswa', 'nomor_ijazah')) {
                $table->dropColumn('nomor_ijazah');
            }
            if (Schema::hasColumn('siswa', 'tanggal_lulus')) {
                $table->dropColumn('tanggal_lulus');
            }
        });
    }
};
