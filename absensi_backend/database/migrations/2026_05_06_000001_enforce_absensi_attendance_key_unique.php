<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("UPDATE absensi
            SET attendance_key = tanggal::date::text || '_' || class_id::text || '_' || mapel_id::text || '_' || jadwal_id::text || '_' || siswa_id::text
            WHERE attendance_key IS NULL
                AND tanggal IS NOT NULL
                AND class_id IS NOT NULL
                AND mapel_id IS NOT NULL
                AND jadwal_id IS NOT NULL
                AND siswa_id IS NOT NULL");

        $duplicate = DB::table('absensi')
            ->select('attendance_key')
            ->whereNotNull('attendance_key')
            ->groupBy('attendance_key')
            ->havingRaw('COUNT(*) > 1')
            ->first();

        if ($duplicate) {
            throw new RuntimeException(
                'Masih ada duplikat absensi. Jalankan: php artisan attendance:repair-duplicates --apply lalu ulangi migrate.'
            );
        }

        DB::statement('ALTER TABLE absensi DROP CONSTRAINT IF EXISTS absensi_unique_with_mapel');
        DB::statement('DROP INDEX IF EXISTS absensi_attendance_key_index');
        DB::statement('CREATE UNIQUE INDEX IF NOT EXISTS absensi_attendance_key_unique ON absensi (attendance_key) WHERE attendance_key IS NOT NULL');
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS absensi_attendance_key_unique');
        DB::statement('CREATE INDEX IF NOT EXISTS absensi_attendance_key_index ON absensi (attendance_key) WHERE attendance_key IS NOT NULL');
    }
};
