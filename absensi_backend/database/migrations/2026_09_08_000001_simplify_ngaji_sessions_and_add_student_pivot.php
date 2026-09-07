<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Pastikan tabel ngaji_sessions hanya memiliki 2 sesi utama: Ngaji Subuh dan Ngaji Sore
        if (Schema::hasTable('ngaji_sessions')) {
            $now = now();

            // Nonaktifkan sesi lama yang tidak digunakan
            DB::table('ngaji_sessions')
                ->whereNotIn('code', ['ngaji_subuh', 'ngaji_sore'])
                ->update(['is_active' => false, 'updated_at' => $now]);

            // Update atau buat Ngaji Subuh
            DB::table('ngaji_sessions')->updateOrInsert(
                ['code' => 'ngaji_subuh'],
                [
                    'name' => 'Ngaji Subuh',
                    'start_time' => '05:30:00',
                    'end_time' => '06:30:00',
                    'description' => 'Pengajian rutin santri setelah sholat Subuh berjamaah',
                    'is_active' => true,
                    'sort_order' => 10,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]
            );

            // Update atau buat Ngaji Sore
            DB::table('ngaji_sessions')->updateOrInsert(
                ['code' => 'ngaji_sore'],
                [
                    'name' => 'Ngaji Sore',
                    'start_time' => '16:00:00',
                    'end_time' => '17:15:00',
                    'description' => 'Pengajian rutin santri setelah sholat Ashar menjelang Maghrib',
                    'is_active' => true,
                    'sort_order' => 20,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]
            );

            // Jika sebelumnya ada ngaji_pagi, migrasikan referensi jadwalnya ke ngaji_subuh
            $subuhSession = DB::table('ngaji_sessions')->where('code', 'ngaji_subuh')->first();
            $pagiSession = DB::table('ngaji_sessions')->where('code', 'ngaji_pagi')->first();
            if ($subuhSession && $pagiSession) {
                DB::table('ngaji_schedules')
                    ->where('ngaji_session_id', $pagiSession->id)
                    ->update(['ngaji_session_id' => $subuhSession->id]);
                DB::table('ngaji_sessions')
                    ->where('id', $pagiSession->id)
                    ->update(['is_active' => false]);
            }
        }

        // 2. Tambahkan kolom gender dan kitab_nama pada ngaji_schedules
        if (Schema::hasTable('ngaji_schedules')) {
            Schema::table('ngaji_schedules', function (Blueprint $table) {
                if (!Schema::hasColumn('ngaji_schedules', 'gender')) {
                    $table->string('gender', 10)->default('PA')->after('ngaji_session_id')->index();
                }
                if (!Schema::hasColumn('ngaji_schedules', 'kitab_nama')) {
                    $table->string('kitab_nama', 160)->nullable()->after('ngaji_book_id');
                }
            });

            // Jadikan ngaji_book_id nullable jika di PostgreSQL
            try {
                DB::statement('ALTER TABLE ngaji_schedules ALTER COLUMN ngaji_book_id DROP NOT NULL;');
            } catch (\Throwable $e) {
                // Ignore jika sudah nullable
            }
        }

        // 3. Buat tabel pivot ngaji_schedule_siswa untuk daftar pilihan santri langsung
        if (!Schema::hasTable('ngaji_schedule_siswa')) {
            Schema::create('ngaji_schedule_siswa', function (Blueprint $table) {
                $table->id();
                $table->foreignId('ngaji_schedule_id')->constrained('ngaji_schedules')->cascadeOnDelete();
                $table->foreignId('siswa_id')->constrained('siswa')->cascadeOnDelete();
                $table->timestamps();

                $table->unique(['ngaji_schedule_id', 'siswa_id'], 'ngaji_sched_siswa_unique');
            });
        }

        // 4. Buat buku ngaji default untuk fallback jadwal tanpa kitab khusus
        if (Schema::hasTable('ngaji_books')) {
            $now = now();
            DB::table('ngaji_books')->updateOrInsert(
                ['code' => 'ngaji_umum'],
                [
                    'name' => 'Ngaji Pondok',
                    'method' => 'Umum',
                    'description' => 'Pengajian rutin umum santri pondok pesantren',
                    'is_active' => true,
                    'sort_order' => 1,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]
            );
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('ngaji_schedule_siswa');

        if (Schema::hasTable('ngaji_schedules')) {
            Schema::table('ngaji_schedules', function (Blueprint $table) {
                if (Schema::hasColumn('ngaji_schedules', 'gender')) {
                    $table->dropColumn('gender');
                }
                if (Schema::hasColumn('ngaji_schedules', 'kitab_nama')) {
                    $table->dropColumn('kitab_nama');
                }
            });
        }
    }
};
