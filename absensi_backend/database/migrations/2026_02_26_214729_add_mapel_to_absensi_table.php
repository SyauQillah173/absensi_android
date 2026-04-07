<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Add mapel column
        Schema::table('absensi', function (Blueprint $table) {
            $table->string('mapel')->nullable()->after('kelas');
        });

        // 2. Drop old unique constraint (siswa_id + tanggal + kelas)
        Schema::table('absensi', function (Blueprint $table) {
            $table->dropUnique('absensi_unique');
        });

        // 3. Create new unique constraint including mapel
        Schema::table('absensi', function (Blueprint $table) {
            $table->unique(['siswa_id', 'tanggal', 'kelas', 'mapel'], 'absensi_unique_with_mapel');
        });
    }

    public function down(): void
    {
        Schema::table('absensi', function (Blueprint $table) {
            $table->dropUnique('absensi_unique_with_mapel');
            $table->unique(['siswa_id', 'tanggal', 'kelas'], 'absensi_unique');
            $table->dropColumn('mapel');
        });
    }
};
