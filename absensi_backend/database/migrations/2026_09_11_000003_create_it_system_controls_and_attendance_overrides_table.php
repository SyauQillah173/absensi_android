<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Tabel Konfigurasi Master Sistem IT (CMS Control)
        if (!Schema::hasTable('it_system_controls')) {
            Schema::create('it_system_controls', function (Blueprint $table) {
                $table->id();
                $table->string('key', 100)->unique();
                $table->json('value');
                $table->string('description')->nullable();
                $table->unsignedBigInteger('updated_by')->nullable();
                $table->timestamps();

                $table->foreign('updated_by')->references('id')->on('users')->nullOnDelete();
            });

            // Seed default configuration values
            DB::table('it_system_controls')->insert([
                [
                    'key'         => 'attendance_guru_global',
                    'value'       => json_encode([
                        'default_open_lead_minutes' => 60,       // 1 jam sebelum jam_mulai
                        'default_close_hour'        => '23:00',   // Ditutup pukul 23:00 WIB
                        'admin_close_hour'          => '04:00',   // Khusus admin s/d jam 04:00 subuh
                        'allow_guru_late_input'     => true,      // Izinkan guru input terlambat sebelum jam tutup
                        'enable_kbm_auto_notification' => true,   // Otomatis ingatkan guru
                    ]),
                    'description' => 'Konfigurasi global jam buka dan tutup presensi jadwal mengajar guru',
                    'created_at'  => now(),
                    'updated_at'  => now(),
                ],
                [
                    'key'         => 'wali_billing_notification',
                    'value'       => json_encode([
                        'schedule_day'        => 10,       // Setiap tanggal 10
                        'schedule_time'       => '07:00',  // Pukul 07:00 WIB
                        'is_active'           => true,     // Aktifkan otomatisasi
                        'title_template'      => '📢 Pengingat Tagihan SPP & Keuangan Santri',
                        'message_template'    => 'Assalamu\'alaikum Wr. Wb. Bapak/Ibu Wali dari {nama_santri}, mengingatkan bahwa kewajiban administrasi santri telah memasuki tanggal pembayaran ({tanggal_pembayaran}). Mohon untuk menyelesaikan tagihan tertunggak sebesar {total_tagihan}. Syukron katsir.',
                        'only_unpaid'         => true,     // Hanya wali yang memiliki tunggakan
                    ]),
                    'description' => 'Pengaturan jadwal dan pesan otomatis notifikasi tagihan SPP bulanan wali santri',
                    'created_at'  => now(),
                    'updated_at'  => now(),
                ],
                [
                    'key'         => 'guru_deadline_notification',
                    'value'       => json_encode([
                        'warning_lead_hours'  => 1,        // 1 jam sebelum jam tutup (pukul 22:00 jika tutup jam 23:00)
                        'is_active'           => true,
                        'title_template'      => '⚠️ Peringatan Batas Waktu Presensi KBM',
                        'message_template'    => 'Yth. {nama_guru}, presensi kelas {nama_kelas} ({nama_mapel}) belum diisi. Batas waktu input presensi akan ditutup pada pukul {jam_tutup} WIB.',
                    ]),
                    'description' => 'Pengaturan notifikasi pengingat tenggat batas waktu pengisian absensi guru',
                    'created_at'  => now(),
                    'updated_at'  => now(),
                ],
            ]);
        }

        // 2. Tabel Override Jam Absensi Khusus By Guru & By Jadwal
        if (!Schema::hasTable('it_guru_attendance_overrides')) {
            Schema::create('it_guru_attendance_overrides', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('teacher_id')->index();
                $table->unsignedBigInteger('jadwal_id')->nullable()->index();
                $table->integer('open_lead_minutes')->nullable()->default(60); // Menit sebelum jadwal dibuka
                $table->string('custom_open_hour', 10)->nullable();          // Contoh: '17:00' atau '18:00' (opsional jika ingin jam paten)
                $table->string('close_hour', 10)->nullable()->default('23:00'); // Contoh: '22:00' atau '23:30'
                $table->boolean('is_force_open')->default(false);             // Buka paksa saat ini juga
                $table->boolean('is_force_locked')->default(false);           // Kunci paksa saat ini juga
                $table->string('notes')->nullable();                          // Alasan / catatan Admin IT
                $table->unsignedBigInteger('created_by')->nullable();
                $table->unsignedBigInteger('updated_by')->nullable();
                $table->timestamps();

                $table->foreign('teacher_id')->references('id')->on('users')->cascadeOnDelete();
                $table->foreign('jadwal_id')->references('id')->on('jadwal')->nullOnDelete();
                $table->foreign('created_by')->references('id')->on('users')->nullOnDelete();
                $table->foreign('updated_by')->references('id')->on('users')->nullOnDelete();
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('it_guru_attendance_overrides');
        Schema::dropIfExists('it_system_controls');
    }
};
