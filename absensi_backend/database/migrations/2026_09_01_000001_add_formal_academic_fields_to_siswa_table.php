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
            if (!Schema::hasColumn('siswa', 'tahun_akademik_masuk_formal')) {
                $table->string('tahun_akademik_masuk_formal')->nullable()->after('tahun_akademik_masuk');
            }
            if (!Schema::hasColumn('siswa', 'sekolah_formal')) {
                $table->string('sekolah_formal')->nullable()->after('asal_sekolah');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('siswa', function (Blueprint $table) {
            if (Schema::hasColumn('siswa', 'tahun_akademik_masuk_formal')) {
                $table->dropColumn('tahun_akademik_masuk_formal');
            }
            if (Schema::hasColumn('siswa', 'sekolah_formal')) {
                $table->dropColumn('sekolah_formal');
            }
        });
    }
};
