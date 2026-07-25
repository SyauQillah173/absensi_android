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
        if (!Schema::hasTable('mata_pelajaran')) {
            Schema::create('mata_pelajaran', function (Blueprint $table): void {
                $table->id();
                $table->string('nama');
                $table->string('kode', 20)->nullable();
                $table->string('status', 20)->default('Aktif');
                $table->timestamps();
                $table->unique('nama');
            });
        }

        if (Schema::hasTable('presensi')) {
            Schema::table('presensi', function (Blueprint $table): void {
                if (!Schema::hasColumn('presensi', 'mapel_id')) {
                    $table->foreignId('mapel_id')->nullable()->after('id_kelas')
                        ->constrained('mata_pelajaran')->nullOnDelete();
                }
                if (!Schema::hasColumn('presensi', 'mapel')) {
                    $table->string('mapel', 120)->nullable()->after('mapel_id');
                }
            });

            DB::statement('ALTER TABLE presensi DROP CONSTRAINT IF EXISTS presensi_sesi_unique');
            DB::statement('DROP INDEX IF EXISTS presensi_sesi_unique');
            DB::statement('CREATE UNIQUE INDEX IF NOT EXISTS presensi_sesi_mapel_unique ON presensi (id_kelas, mapel_id, tanggal, waktu_mulai)');
        }

        $now = now();
        foreach ([
            ['nama' => 'Matematika', 'kode' => 'MTK'],
            ['nama' => 'Bahasa Indonesia', 'kode' => 'BIN'],
            ['nama' => 'Fiqih', 'kode' => 'FIQ'],
            ['nama' => 'Aqidah Akhlak', 'kode' => 'AA'],
            ['nama' => "Al-Qur'an Hadits", 'kode' => 'QH'],
            ['nama' => 'Sejarah Kebudayaan Islam', 'kode' => 'SKI'],
            ['nama' => 'Bahasa Arab', 'kode' => 'BAR'],
        ] as $row) {
            DB::table('mata_pelajaran')->updateOrInsert(
                ['nama' => $row['nama']],
                $row + ['status' => 'Aktif', 'created_at' => $now, 'updated_at' => $now],
            );
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('presensi')) {
            Schema::table('presensi', function (Blueprint $table): void {
                if (Schema::hasColumn('presensi', 'mapel_id')) {
                    $table->dropConstrainedForeignId('mapel_id');
                }
                if (Schema::hasColumn('presensi', 'mapel')) {
                    $table->dropColumn('mapel');
                }
            });
        }
    }
};
