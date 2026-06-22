<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('ngaji_sessions')) {
            Schema::create('ngaji_sessions', function (Blueprint $table) {
                $table->id();
                $table->string('name');
                $table->string('code')->unique();
                $table->time('start_time')->nullable();
                $table->time('end_time')->nullable();
                $table->text('description')->nullable();
                $table->boolean('is_active')->default(true)->index();
                $table->unsignedInteger('sort_order')->default(0);
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('ngaji_books')) {
            Schema::create('ngaji_books', function (Blueprint $table) {
                $table->id();
                $table->string('name');
                $table->string('code')->unique();
                $table->string('method')->nullable();
                $table->text('description')->nullable();
                $table->boolean('is_active')->default(true)->index();
                $table->unsignedInteger('sort_order')->default(0);
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('ngaji_schedules')) {
            Schema::create('ngaji_schedules', function (Blueprint $table) {
                $table->id();
                $table->foreignId('ngaji_session_id')->constrained('ngaji_sessions')->cascadeOnDelete();
                $table->foreignId('ngaji_book_id')->constrained('ngaji_books')->cascadeOnDelete();
                $table->foreignId('teacher_id')->nullable()->constrained('users')->nullOnDelete();
                $table->foreignId('boarding_complex_id')->nullable()->constrained('boarding_complexes')->nullOnDelete();
                $table->foreignId('boarding_room_id')->nullable()->constrained('boarding_rooms')->nullOnDelete();
                $table->foreignId('class_id')->nullable()->constrained('classes')->nullOnDelete();
                $table->foreignId('day_id')->nullable()->constrained('days')->nullOnDelete();
                $table->time('start_time')->nullable();
                $table->time('end_time')->nullable();
                $table->string('status', 20)->default('Aktif')->index();
                $table->text('description')->nullable();
                $table->timestamps();

                $table->index(['ngaji_session_id', 'ngaji_book_id'], 'ngaji_schedules_session_book_index');
                $table->index(['boarding_complex_id', 'boarding_room_id'], 'ngaji_schedules_boarding_index');
            });
        }

        if (!Schema::hasTable('absensi_ngaji')) {
            Schema::create('absensi_ngaji', function (Blueprint $table) {
                $table->id();
                $table->foreignId('siswa_id')->constrained('siswa')->cascadeOnDelete();
                $table->foreignId('santri_pondok_id')->nullable()->constrained('santri_pondok')->nullOnDelete();
                $table->foreignId('ngaji_schedule_id')->constrained('ngaji_schedules')->cascadeOnDelete();
                $table->foreignId('ngaji_session_id')->constrained('ngaji_sessions')->cascadeOnDelete();
                $table->foreignId('ngaji_book_id')->constrained('ngaji_books')->cascadeOnDelete();
                $table->foreignId('boarding_complex_id')->nullable()->constrained('boarding_complexes')->nullOnDelete();
                $table->foreignId('boarding_room_id')->nullable()->constrained('boarding_rooms')->nullOnDelete();
                $table->foreignId('class_id')->nullable()->constrained('classes')->nullOnDelete();
                $table->date('tanggal')->index();
                $table->string('status_code', 1);
                $table->string('status_label', 30);
                $table->text('keterangan')->nullable();
                $table->string('attendance_key')->unique();
                $table->string('diinput_oleh')->nullable();
                $table->foreignId('actor_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->string('diinput_via', 30)->nullable();
                $table->string('device_id')->nullable();
                $table->timestamp('synced_at')->nullable();
                $table->boolean('is_cancelled')->default(false)->index();
                $table->timestamp('cancelled_at')->nullable();
                $table->foreignId('cancelled_by')->nullable()->constrained('users')->nullOnDelete();
                $table->text('cancel_reason')->nullable();
                $table->timestamps();

                $table->index(['tanggal', 'ngaji_schedule_id'], 'absensi_ngaji_date_schedule_index');
                $table->index(['siswa_id', 'tanggal'], 'absensi_ngaji_student_date_index');
            });
        }

        $now = now();
        foreach ([
            ['name' => 'Ngaji Pagi', 'code' => 'ngaji_pagi', 'start_time' => '05:30:00', 'sort_order' => 10],
            ['name' => 'Ngaji Sore', 'code' => 'ngaji_sore', 'start_time' => '16:00:00', 'sort_order' => 20],
        ] as $row) {
            DB::table('ngaji_sessions')->updateOrInsert(
                ['code' => $row['code']],
                array_merge($row, ['is_active' => true, 'updated_at' => $now, 'created_at' => $now])
            );
        }

        foreach ([
            ['name' => 'Kitab Umum', 'code' => 'kitab_umum', 'method' => 'Maknani', 'sort_order' => 10],
        ] as $row) {
            DB::table('ngaji_books')->updateOrInsert(
                ['code' => $row['code']],
                array_merge($row, ['is_active' => true, 'updated_at' => $now, 'created_at' => $now])
            );
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('absensi_ngaji');
        Schema::dropIfExists('ngaji_schedules');
        Schema::dropIfExists('ngaji_books');
        Schema::dropIfExists('ngaji_sessions');
    }
};
