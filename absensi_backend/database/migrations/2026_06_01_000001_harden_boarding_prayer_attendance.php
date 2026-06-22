<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('santri_pondok', function (Blueprint $table) {
            if (!Schema::hasColumn('santri_pondok', 'deleted_at')) {
                $table->softDeletes()->after('ended_at');
            }
        });

        Schema::table('absensi_sholat', function (Blueprint $table) {
            if (!Schema::hasColumn('absensi_sholat', 'santri_pondok_id')) {
                $table->foreignId('santri_pondok_id')
                    ->nullable()
                    ->after('siswa_id')
                    ->constrained('santri_pondok')
                    ->nullOnDelete();
            }
        });

        if (Schema::hasColumn('absensi_sholat', 'santri_pondok_id')) {
            DB::statement(<<<'SQL'
                UPDATE absensi_sholat
                SET santri_pondok_id = santri_pondok.id
                FROM santri_pondok
                WHERE absensi_sholat.siswa_id = santri_pondok.siswa_id
                  AND absensi_sholat.santri_pondok_id IS NULL
            SQL);
        }

        if (!Schema::hasTable('notifications')) {
            Schema::create('notifications', function (Blueprint $table) {
                $table->id();
                $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                $table->string('title');
                $table->text('message');
                $table->string('type', 80)->index();
                $table->json('data')->nullable();
                $table->boolean('is_read')->default(false)->index();
                $table->timestamp('read_at')->nullable();
                $table->timestamps();

                $table->index(['user_id', 'is_read', 'created_at'], 'notifications_user_read_created_idx');
            });
        }

        if (!Schema::hasTable('guru_absensi_sholat_access')) {
            Schema::create('guru_absensi_sholat_access', function (Blueprint $table) {
                $table->id();
                $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                $table->foreignId('boarding_complex_id')->nullable()->constrained('boarding_complexes')->cascadeOnDelete();
                $table->foreignId('boarding_room_id')->nullable()->constrained('boarding_rooms')->cascadeOnDelete();
                $table->boolean('can_input')->default(true);
                $table->boolean('can_view_rekap')->default(true);
                $table->boolean('can_edit')->default(false);
                $table->boolean('is_active')->default(true)->index();
                $table->timestamps();

                $table->unique(['user_id', 'boarding_complex_id', 'boarding_room_id'], 'guru_sholat_access_scope_unique');
                $table->index(['user_id', 'is_active'], 'guru_sholat_access_user_active_idx');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('guru_absensi_sholat_access');
        Schema::dropIfExists('notifications');

        Schema::table('absensi_sholat', function (Blueprint $table) {
            if (Schema::hasColumn('absensi_sholat', 'santri_pondok_id')) {
                $table->dropConstrainedForeignId('santri_pondok_id');
            }
        });

        Schema::table('santri_pondok', function (Blueprint $table) {
            if (Schema::hasColumn('santri_pondok', 'deleted_at')) {
                $table->dropSoftDeletes();
            }
        });
    }
};
