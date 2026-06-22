<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('boarding_complexes', function (Blueprint $table) {
            if (!Schema::hasColumn('boarding_complexes', 'description')) {
                $table->text('description')->nullable()->after('name');
            }
        });

        Schema::table('boarding_rooms', function (Blueprint $table) {
            if (!Schema::hasColumn('boarding_rooms', 'capacity')) {
                $table->unsignedInteger('capacity')->nullable()->after('name');
            }
            if (!Schema::hasColumn('boarding_rooms', 'description')) {
                $table->text('description')->nullable()->after('capacity');
            }
        });

        if (!Schema::hasTable('santri_pondok')) {
            Schema::create('santri_pondok', function (Blueprint $table) {
                $table->id();
                $table->foreignId('siswa_id')->constrained('siswa')->cascadeOnDelete();
                $table->foreignId('boarding_complex_id')->nullable()->constrained('boarding_complexes')->nullOnDelete();
                $table->foreignId('boarding_room_id')->nullable()->constrained('boarding_rooms')->nullOnDelete();
                $table->foreignId('class_id')->nullable()->constrained('classes')->nullOnDelete();
                $table->string('status', 30)->default('Aktif')->index();
                $table->boolean('is_resident')->default(true);
                $table->boolean('participates_prayer')->default(true)->index();
                $table->date('started_at')->nullable();
                $table->date('ended_at')->nullable();
                $table->text('notes')->nullable();
                $table->timestamps();

                $table->unique('siswa_id', 'santri_pondok_siswa_unique');
                $table->index(['boarding_complex_id', 'boarding_room_id', 'status'], 'santri_pondok_room_status_idx');
            });
        }

        if (Schema::hasTable('santri_pondok')) {
            DB::table('siswa')
                ->leftJoin('boarding_rooms', 'siswa.boarding_room_id', '=', 'boarding_rooms.id')
                ->select([
                    'siswa.id',
                    'siswa.boarding_room_id',
                    'siswa.class_id',
                    'siswa.status_mondok',
                    'boarding_rooms.boarding_complex_id',
                ])
                ->where(function ($query) {
                    $query->whereNotNull('siswa.boarding_room_id')
                        ->orWhere('siswa.status_mondok', 'mondok');
                })
                ->orderBy('siswa.id')
                ->chunk(200, function ($rows) {
                    foreach ($rows as $row) {
                        DB::table('santri_pondok')->updateOrInsert(
                            ['siswa_id' => $row->id],
                            [
                                'boarding_complex_id' => $row->boarding_complex_id,
                                'boarding_room_id' => $row->boarding_room_id,
                                'class_id' => $row->class_id,
                                'status' => 'Aktif',
                                'is_resident' => $row->status_mondok === 'mondok',
                                'participates_prayer' => true,
                                'updated_at' => now(),
                                'created_at' => now(),
                            ]
                        );
                    }
                });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('santri_pondok');

        Schema::table('boarding_rooms', function (Blueprint $table) {
            foreach (['description', 'capacity'] as $column) {
                if (Schema::hasColumn('boarding_rooms', $column)) {
                    $table->dropColumn($column);
                }
            }
        });

        Schema::table('boarding_complexes', function (Blueprint $table) {
            if (Schema::hasColumn('boarding_complexes', 'description')) {
                $table->dropColumn('description');
            }
        });
    }
};
