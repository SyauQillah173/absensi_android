<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('boarding_complexes')) {
            Schema::create('boarding_complexes', function (Blueprint $table) {
                $table->id();
                $table->string('name')->unique();
                $table->unsignedInteger('sort_order')->default(0);
                $table->boolean('is_active')->default(true)->index();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('boarding_rooms')) {
            Schema::create('boarding_rooms', function (Blueprint $table) {
                $table->id();
                $table->foreignId('boarding_complex_id')->constrained('boarding_complexes')->cascadeOnDelete();
                $table->string('name');
                $table->unsignedInteger('sort_order')->default(0);
                $table->boolean('is_active')->default(true)->index();
                $table->timestamps();

                $table->unique(['boarding_complex_id', 'name'], 'boarding_rooms_complex_name_unique');
            });
        }

        Schema::table('siswa', function (Blueprint $table) {
            if (!Schema::hasColumn('siswa', 'boarding_room_id')) {
                $table->foreignId('boarding_room_id')
                    ->nullable()
                    ->after('status_mondok')
                    ->constrained('boarding_rooms')
                    ->nullOnDelete();
            }
            if (!Schema::hasColumn('siswa', 'komplek')) {
                $table->string('komplek')->nullable()->after('boarding_room_id');
            }
            if (!Schema::hasColumn('siswa', 'kamar')) {
                $table->string('kamar')->nullable()->after('komplek');
            }
        });

        if (!Schema::hasTable('absensi_sholat')) {
            Schema::create('absensi_sholat', function (Blueprint $table) {
                $table->id();
                $table->foreignId('siswa_id')->constrained('siswa')->cascadeOnDelete();
                $table->foreignId('boarding_room_id')->nullable()->constrained('boarding_rooms')->nullOnDelete();
                $table->date('tanggal')->index();
                $table->string('status_code', 1);
                $table->string('status_label', 20);
                $table->text('keterangan')->nullable();
                $table->string('attendance_key')->unique();
                $table->string('diinput_oleh')->nullable();
                $table->foreignId('actor_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->string('diinput_via', 30)->nullable();
                $table->string('device_id')->nullable();
                $table->timestamp('synced_at')->nullable();
                $table->timestamps();

                $table->index(['tanggal', 'boarding_room_id'], 'absensi_sholat_date_room_index');
                $table->index(['siswa_id', 'tanggal'], 'absensi_sholat_student_date_index');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('absensi_sholat');

        Schema::table('siswa', function (Blueprint $table) {
            if (Schema::hasColumn('siswa', 'boarding_room_id')) {
                $table->dropConstrainedForeignId('boarding_room_id');
            }
            foreach (['komplek', 'kamar'] as $column) {
                if (Schema::hasColumn('siswa', $column)) {
                    $table->dropColumn($column);
                }
            }
        });

        Schema::dropIfExists('boarding_rooms');
        Schema::dropIfExists('boarding_complexes');
    }
};
