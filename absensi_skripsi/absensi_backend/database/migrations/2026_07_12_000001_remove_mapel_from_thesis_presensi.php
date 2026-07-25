<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public $withinTransaction = false;

    public function up(): void
    {
        if (!Schema::hasTable('presensi')) {
            return;
        }

        DB::statement('ALTER TABLE presensi DROP CONSTRAINT IF EXISTS presensi_sesi_mapel_unique');
        DB::statement('DROP INDEX IF EXISTS presensi_sesi_mapel_unique');
        DB::statement('ALTER TABLE presensi DROP CONSTRAINT IF EXISTS presensi_mapel_id_foreign');
        DB::statement('ALTER TABLE presensi DROP COLUMN IF EXISTS mapel_id');
        DB::statement('ALTER TABLE presensi DROP COLUMN IF EXISTS mapel');

        $idx = DB::select("SELECT 1 FROM pg_indexes WHERE indexname = 'presensi_sesi_unique'");
        if (empty($idx)) {
            DB::statement('CREATE UNIQUE INDEX presensi_sesi_unique ON presensi (id_kelas, tanggal, waktu_mulai)');
        }
    }

    public function down(): void
    {
        if (!Schema::hasTable('presensi')) {
            return;
        }

        Schema::table('presensi', function (Blueprint $table): void {
            if (!Schema::hasColumn('presensi', 'mapel_id')) {
                $table->foreignId('mapel_id')->nullable()->after('id_kelas')
                    ->constrained('mata_pelajaran')->nullOnDelete();
            }
            if (!Schema::hasColumn('presensi', 'mapel')) {
                $table->string('mapel', 120)->nullable()->after('mapel_id');
            }
        });
    }
};
