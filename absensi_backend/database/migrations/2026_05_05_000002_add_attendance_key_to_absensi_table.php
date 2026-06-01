<?php

use App\Models\Absensi;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('absensi', function (Blueprint $table) {
            if (!Schema::hasColumn('absensi', 'attendance_key')) {
                $table->string('attendance_key')->nullable()->after('jadwal_id');
            }
        });

        Absensi::query()
            ->whereNotNull('tanggal')
            ->whereNotNull('class_id')
            ->whereNotNull('mapel_id')
            ->whereNotNull('jadwal_id')
            ->whereNotNull('siswa_id')
            ->orderBy('id')
            ->chunkById(100, function ($rows) {
                foreach ($rows as $row) {
                    $key = Absensi::buildAttendanceKey(
                        $row->tanggal?->format('Y-m-d') ?? $row->tanggal,
                        $row->class_id,
                        $row->mapel_id,
                        $row->jadwal_id,
                        $row->siswa_id,
                    );

                    DB::table('absensi')
                        ->where('id', $row->id)
                        ->update(['attendance_key' => $key]);
                }
            });

        DB::statement('CREATE INDEX IF NOT EXISTS absensi_attendance_key_index ON absensi (attendance_key) WHERE attendance_key IS NOT NULL');
        DB::statement('CREATE INDEX IF NOT EXISTS absensi_scope_lookup_index ON absensi (tanggal, class_id, mapel_id, jadwal_id, siswa_id)');
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS absensi_attendance_key_index');
        DB::statement('DROP INDEX IF EXISTS absensi_scope_lookup_index');
        DB::statement('DROP INDEX IF EXISTS absensi_attendance_key_unique');

        Schema::table('absensi', function (Blueprint $table) {
            if (Schema::hasColumn('absensi', 'attendance_key')) {
                $table->dropColumn('attendance_key');
            }
        });
    }
};
