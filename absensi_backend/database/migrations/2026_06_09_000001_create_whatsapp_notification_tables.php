<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('whatsapp_sessions')) {
            Schema::create('whatsapp_sessions', function (Blueprint $table) {
                $table->id();
                $table->string('client_id')->unique();
                $table->string('client_name')->nullable();
                $table->string('phone_number', 30)->nullable();
                $table->string('device_name')->nullable();
                $table->string('status')->default('belum_terhubung')->index();
                $table->text('qr_code')->nullable();
                $table->timestamp('last_connected_at')->nullable();
                $table->timestamp('last_disconnected_at')->nullable();
                $table->json('metadata')->nullable();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('whatsapp_connected_clients')) {
            Schema::create('whatsapp_connected_clients', function (Blueprint $table) {
                $table->id();
                $table->string('client_id')->unique();
                $table->string('name');
                $table->string('client_type')->nullable();
                $table->string('domain')->nullable();
                $table->string('status')->default('aktif')->index();
                $table->timestamp('last_seen_at')->nullable();
                $table->json('metadata')->nullable();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('whatsapp_templates')) {
            Schema::create('whatsapp_templates', function (Blueprint $table) {
                $table->id();
                $table->string('name');
                $table->string('code')->unique();
                $table->string('module')->index();
                $table->string('event_type')->nullable()->index();
                $table->text('message_template');
                $table->boolean('is_active')->default(true)->index();
                $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('notification_settings')) {
            Schema::create('notification_settings', function (Blueprint $table) {
                $table->id();
                $table->string('module')->unique();
                $table->boolean('channel_app')->default(true);
                $table->boolean('channel_whatsapp')->default(false);
                $table->string('send_mode')->default('manual');
                $table->foreignId('template_id')->nullable()->constrained('whatsapp_templates')->nullOnDelete();
                $table->boolean('is_active')->default(true)->index();
                $table->unsignedSmallInteger('retry_limit')->default(3);
                $table->unsignedSmallInteger('delay_seconds')->default(0);
                $table->time('active_start_time')->nullable();
                $table->time('active_end_time')->nullable();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('whatsapp_message_logs')) {
            Schema::create('whatsapp_message_logs', function (Blueprint $table) {
                $table->id();
                $table->string('message_id')->unique();
                $table->string('module')->index();
                $table->string('event_type')->nullable()->index();
                $table->foreignId('student_id')->nullable()->constrained('siswa')->nullOnDelete();
                $table->foreignId('wali_id')->nullable()->constrained('users')->nullOnDelete();
                $table->string('phone_number', 30)->nullable();
                $table->text('message');
                $table->string('status')->default('pending')->index();
                $table->text('error_message')->nullable();
                $table->unsignedSmallInteger('retry_count')->default(0);
                $table->unsignedSmallInteger('retry_limit')->default(3);
                $table->string('idempotency_key')->nullable()->unique();
                $table->timestamp('sent_at')->nullable();
                $table->timestamp('delivered_at')->nullable();
                $table->timestamp('cancelled_at')->nullable();
                $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
                $table->json('payload')->nullable();
                $table->json('metadata')->nullable();
                $table->timestamps();

                $table->index(['module', 'event_type', 'status']);
                $table->index(['student_id', 'created_at']);
                $table->index(['wali_id', 'created_at']);
            });
        }

        if (Schema::hasTable('siswa')) {
            if (!Schema::hasColumn('siswa', 'wali_whatsapp_number')) {
                Schema::table('siswa', function (Blueprint $table) {
                    $table->string('wali_whatsapp_number', 30)->nullable();
                });
            }
            if (!Schema::hasColumn('siswa', 'notification_whatsapp_enabled')) {
                Schema::table('siswa', function (Blueprint $table) {
                    $table->boolean('notification_whatsapp_enabled')->default(true)->index();
                });
            }
            if (!Schema::hasColumn('siswa', 'notification_app_enabled')) {
                Schema::table('siswa', function (Blueprint $table) {
                    $table->boolean('notification_app_enabled')->default(true)->index();
                });
            }
        }

        $this->seedMenuAndDefaults();
    }

    public function down(): void
    {
        if (Schema::hasTable('siswa')) {
            Schema::table('siswa', function (Blueprint $table) {
                foreach (['notification_app_enabled', 'notification_whatsapp_enabled', 'wali_whatsapp_number'] as $column) {
                    if (Schema::hasColumn('siswa', $column)) {
                        $table->dropColumn($column);
                    }
                }
            });
        }

        Schema::dropIfExists('whatsapp_message_logs');
        Schema::dropIfExists('notification_settings');
        Schema::dropIfExists('whatsapp_templates');
        Schema::dropIfExists('whatsapp_connected_clients');
        Schema::dropIfExists('whatsapp_sessions');
    }

    private function seedMenuAndDefaults(): void
    {
        if (Schema::hasTable('app_menus')) {
            DB::table('app_menus')->updateOrInsert(
                ['key' => 'whatsapp_bot'],
                [
                    'label' => 'WhatsApp Bot',
                    'group' => 'admin',
                    'icon' => 'message-circle',
                    'sort_order' => 940,
                    'is_active' => true,
                    'updated_at' => now(),
                    'created_at' => now(),
                ]
            );

            if (Schema::hasTable('role_menu_permissions')) {
                $menuId = DB::table('app_menus')->where('key', 'whatsapp_bot')->value('id');
                $roles = [
                    'admin_utama' => [true, true, true, true, true, true, true],
                    'admin_bendahara' => [true, true, true, false, true, true, true],
                    'admin_absensi' => [true, true, true, false, true, true, true],
                    'admin_akademik' => [false, false, false, false, false, false, false],
                    'admin_pondok' => [false, false, false, false, false, false, false],
                    'admin_lainnya' => [false, false, false, false, false, false, false],
                    'guru' => [false, false, false, false, false, false, false],
                    'wali' => [false, false, false, false, false, false, false],
                ];

                foreach ($roles as $role => $values) {
                    DB::table('role_menu_permissions')->updateOrInsert(
                        ['role' => $role, 'app_menu_id' => $menuId],
                        [
                            'can_view' => $values[0],
                            'can_create' => $values[1],
                            'can_update' => $values[2],
                            'can_delete' => $values[3],
                            'can_approve' => $values[4],
                            'can_cancel' => $values[5],
                            'is_enabled' => $values[6],
                            'locked' => $role === 'admin_utama',
                            'updated_at' => now(),
                            'created_at' => now(),
                        ]
                    );
                }
            }
        }

        if (!Schema::hasTable('whatsapp_templates')) {
            return;
        }

        $templates = [
            [
                'name' => 'Absensi Madin',
                'code' => 'absensi_madin',
                'module' => 'absensi_madin',
                'event_type' => 'created',
                'message_template' => "Assalamualaikum, wali santri {nama_siswa}.\nAbsensi Madin tanggal {tanggal}: {status_absensi}.\nKelas: {kelas}.\n- {nama_sekolah}",
            ],
            [
                'name' => 'Absensi Ngaji',
                'code' => 'absensi_ngaji',
                'module' => 'absensi_ngaji',
                'event_type' => 'created',
                'message_template' => "Assalamualaikum, wali santri {nama_siswa}.\nAbsensi Ngaji {sesi} ({kitab}) tanggal {tanggal}: {status_absensi}.\n- {nama_sekolah}",
            ],
            [
                'name' => 'Absensi Sholat',
                'code' => 'absensi_sholat',
                'module' => 'absensi_sholat',
                'event_type' => 'created',
                'message_template' => "Assalamualaikum, wali santri {nama_siswa}.\nAbsensi {jenis_sholat} tanggal {tanggal}: {status_absensi}.\nKomplek/Kamar: {komplek} {kamar}.\n- {nama_sekolah}",
            ],
            [
                'name' => 'Tagihan Pembayaran',
                'code' => 'tagihan_pembayaran',
                'module' => 'tagihan',
                'event_type' => 'manual',
                'message_template' => "Assalamualaikum, wali santri {nama_siswa}.\nTagihan {judul_tagihan} sebesar {nominal_tagihan} menunggu pembayaran. Jatuh tempo: {tanggal_jatuh_tempo}.\n- {nama_sekolah}",
            ],
            [
                'name' => 'Pembayaran Berhasil',
                'code' => 'pembayaran_berhasil',
                'module' => 'pembayaran',
                'event_type' => 'paid',
                'message_template' => "Assalamualaikum, pembayaran {judul_tagihan} santri {nama_siswa} sebesar {nominal_bayar} telah tercatat pada {tanggal_bayar}.\nTerima kasih.\n- {nama_sekolah}",
            ],
            [
                'name' => 'Pesan Manual',
                'code' => 'manual',
                'module' => 'manual',
                'event_type' => 'manual',
                'message_template' => '{pesan}',
            ],
        ];

        foreach ($templates as $template) {
            DB::table('whatsapp_templates')->updateOrInsert(
                ['code' => $template['code']],
                $template + ['is_active' => true, 'updated_at' => now(), 'created_at' => now()]
            );
        }

        if (!Schema::hasTable('notification_settings')) {
            return;
        }

        foreach (['absensi_madin', 'absensi_ngaji', 'absensi_sholat', 'tagihan', 'pembayaran', 'manual'] as $module) {
            $templateId = DB::table('whatsapp_templates')
                ->where('module', $module)
                ->orWhere('code', $module)
                ->value('id');

            DB::table('notification_settings')->updateOrInsert(
                ['module' => $module],
                [
                    'channel_app' => $module !== 'manual',
                    'channel_whatsapp' => false,
                    'send_mode' => in_array($module, ['tagihan', 'manual'], true) ? 'manual' : 'automatic',
                    'template_id' => $templateId,
                    'is_active' => true,
                    'retry_limit' => 3,
                    'delay_seconds' => 0,
                    'updated_at' => now(),
                    'created_at' => now(),
                ]
            );
        }
    }
};
