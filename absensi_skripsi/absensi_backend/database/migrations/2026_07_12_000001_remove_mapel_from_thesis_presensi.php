<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public $withinTransaction = false;

    public function up(): void
    {
        if (!Schema::hasTable('presensi')) {
            return;
        }

        try {
            Schema::table('presensi', function (Blueprint $table): void {
                $table->dropUnique('presensi_sesi_mapel_unique');
            });
        } catch (\Throwable) {
        }

        if (Schema::hasColumn('presensi', 'mapel_id')) {
            try {
                Schema::table('presensi', function (Blueprint $table): void {
                    $table->dropConstrainedForeignId('mapel_id');
                });
            } catch (\Throwable) {
                Schema::table('presensi', function (Blueprint $table): void {
                    $table->dropColumn('mapel_id');
                });
            }
        }

        if (Schema::hasColumn('presensi', 'mapel')) {
            Schema::table('presensi', function (Blueprint $table): void {
                $table->dropColumn('mapel');
            });
        }

        try {
            Schema::table('presensi', function (Blueprint $table): void {
                $table->unique(['id_kelas', 'tanggal', 'waktu_mulai'], 'presensi_sesi_unique');
            });
        } catch (\Throwable) {
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
