<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('prayer_attendance_types')) {
            Schema::create('prayer_attendance_types', function (Blueprint $table) {
                $table->id();
                $table->string('name');
                $table->string('code')->unique();
                $table->text('description')->nullable();
                $table->boolean('is_active')->default(true)->index();
                $table->unsignedInteger('sort_order')->default(0);
                $table->timestamps();
            });
        }

        $now = now();
        $defaults = [
            ['name' => "Jama'ah Sholat", 'code' => 'jamaah_sholat', 'description' => 'Data lama/generik sebelum jenis sholat dipisah.', 'is_active' => false, 'sort_order' => 0],
            ['name' => 'Subuh', 'code' => 'subuh', 'description' => 'Absensi jamaah sholat Subuh.', 'is_active' => true, 'sort_order' => 10],
            ['name' => 'Maghrib', 'code' => 'maghrib', 'description' => 'Absensi jamaah sholat Maghrib.', 'is_active' => true, 'sort_order' => 20],
            ['name' => 'Isya', 'code' => 'isya', 'description' => 'Absensi jamaah sholat Isya.', 'is_active' => true, 'sort_order' => 30],
        ];

        foreach ($defaults as $row) {
            DB::table('prayer_attendance_types')->updateOrInsert(
                ['code' => $row['code']],
                array_merge($row, ['updated_at' => $now, 'created_at' => $now])
            );
        }

        Schema::table('absensi_sholat', function (Blueprint $table) {
            if (!Schema::hasColumn('absensi_sholat', 'prayer_attendance_type_id')) {
                $table->foreignId('prayer_attendance_type_id')
                    ->nullable()
                    ->after('boarding_room_id')
                    ->constrained('prayer_attendance_types')
                    ->nullOnDelete();
            }
        });

        $legacyId = DB::table('prayer_attendance_types')->where('code', 'jamaah_sholat')->value('id');
        if ($legacyId) {
            DB::table('absensi_sholat')
                ->whereNull('prayer_attendance_type_id')
                ->update(['prayer_attendance_type_id' => $legacyId]);
        }

        DB::statement('CREATE INDEX IF NOT EXISTS absensi_sholat_type_date_room_index ON absensi_sholat (prayer_attendance_type_id, tanggal, boarding_room_id)');
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS absensi_sholat_type_date_room_index');

        Schema::table('absensi_sholat', function (Blueprint $table) {
            if (Schema::hasColumn('absensi_sholat', 'prayer_attendance_type_id')) {
                $table->dropConstrainedForeignId('prayer_attendance_type_id');
            }
        });

        Schema::dropIfExists('prayer_attendance_types');
    }
};
