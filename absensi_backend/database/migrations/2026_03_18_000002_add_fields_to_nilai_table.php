<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Drop the old enum constraint and recreate with more options
        // PostgreSQL needs special handling for enum changes
        DB::statement("ALTER TABLE nilai DROP CONSTRAINT IF EXISTS nilai_jenis_ujian_check");
        DB::statement("ALTER TABLE nilai ADD CONSTRAINT nilai_jenis_ujian_check CHECK (jenis_ujian IN ('UTS', 'UAS', 'Hafalan', 'Tugas', 'Harian'))");

        Schema::table('nilai', function (Blueprint $table) {
            $table->string('grade', 5)->nullable()->after('nilai');
            $table->text('keterangan')->nullable()->after('grade');
            $table->string('diinput_oleh')->nullable()->after('keterangan');
            $table->string('tahun_ajaran')->nullable()->after('diinput_oleh');
        });
    }

    public function down(): void
    {
        Schema::table('nilai', function (Blueprint $table) {
            $table->dropColumn(['grade', 'keterangan', 'diinput_oleh', 'tahun_ajaran']);
        });

        DB::statement("ALTER TABLE nilai DROP CONSTRAINT IF EXISTS nilai_jenis_ujian_check");
        DB::statement("ALTER TABLE nilai ADD CONSTRAINT nilai_jenis_ujian_check CHECK (jenis_ujian IN ('UTS', 'UAS', 'Hafalan', 'Tugas'))");
    }
};
