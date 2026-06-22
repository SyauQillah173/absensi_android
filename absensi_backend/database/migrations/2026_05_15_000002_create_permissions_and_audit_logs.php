<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('app_menus', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique();
            $table->string('label');
            $table->string('group')->nullable();
            $table->string('icon')->nullable();
            $table->text('description')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_core')->default(false);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('role_menu_permissions', function (Blueprint $table) {
            $table->id();
            $table->string('role', 30);
            $table->foreignId('app_menu_id')->constrained('app_menus')->cascadeOnDelete();
            $table->boolean('can_view')->default(false);
            $table->boolean('can_create')->default(false);
            $table->boolean('can_update')->default(false);
            $table->boolean('can_delete')->default(false);
            $table->boolean('can_approve')->default(false);
            $table->boolean('can_cancel')->default(false);
            $table->boolean('is_enabled')->default(true);
            $table->boolean('locked')->default(false);
            $table->timestamps();

            $table->unique(['role', 'app_menu_id']);
            $table->index(['role', 'is_enabled']);
        });

        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('actor_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('actor_role', 30)->nullable();
            $table->string('actor_name')->nullable();
            $table->string('action', 80);
            $table->string('module', 80);
            $table->string('entity_type')->nullable();
            $table->string('entity_id')->nullable();
            $table->json('before_values')->nullable();
            $table->json('after_values')->nullable();
            $table->json('metadata')->nullable();
            $table->string('ip_address', 80)->nullable();
            $table->text('user_agent')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['actor_user_id', 'created_at']);
            $table->index(['actor_role', 'module']);
            $table->index(['module', 'action']);
        });

        $this->seedMenusAndPermissions();
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
        Schema::dropIfExists('role_menu_permissions');
        Schema::dropIfExists('app_menus');
    }

    private function seedMenusAndPermissions(): void
    {
        $now = now();
        $menus = [
            ['key' => 'dashboard', 'label' => 'Dashboard', 'group' => 'umum', 'icon' => 'home', 'sort_order' => 1, 'is_core' => true],
            ['key' => 'absensi', 'label' => 'Absensi', 'group' => 'guru', 'icon' => 'checklist', 'sort_order' => 10, 'is_core' => false],
            ['key' => 'mata_pelajaran', 'label' => 'Mata Pelajaran', 'group' => 'akademik', 'icon' => 'book', 'sort_order' => 20, 'is_core' => false],
            ['key' => 'nilai', 'label' => 'Nilai Ujian/Hafalan', 'group' => 'akademik', 'icon' => 'award', 'sort_order' => 30, 'is_core' => false],
            ['key' => 'keuangan', 'label' => 'Keuangan', 'group' => 'admin', 'icon' => 'wallet', 'sort_order' => 40, 'is_core' => false],
            ['key' => 'buku_induk', 'label' => 'Buku Induk', 'group' => 'admin', 'icon' => 'users', 'sort_order' => 50, 'is_core' => false],
            ['key' => 'data_diri_guru', 'label' => 'Data Diri Guru', 'group' => 'guru', 'icon' => 'badge', 'sort_order' => 60, 'is_core' => false],
            ['key' => 'materi_kegiatan', 'label' => 'Materi & Kegiatan', 'group' => 'akademik', 'icon' => 'image', 'sort_order' => 70, 'is_core' => false],
            ['key' => 'ruang_sifir', 'label' => 'Ruang Sifir', 'group' => 'akademik', 'icon' => 'bookmark', 'sort_order' => 80, 'is_core' => false],
            ['key' => 'pembayaran_wali', 'label' => 'Pembayaran', 'group' => 'wali', 'icon' => 'wallet', 'sort_order' => 90, 'is_core' => false],
            ['key' => 'nilai_wali', 'label' => 'Nilai Anak', 'group' => 'wali', 'icon' => 'award', 'sort_order' => 100, 'is_core' => false],
            ['key' => 'kegiatan_belajar', 'label' => 'Kegiatan Belajar', 'group' => 'wali', 'icon' => 'calendar', 'sort_order' => 110, 'is_core' => false],
            ['key' => 'biodata_siswa', 'label' => 'Biodata Siswa', 'group' => 'wali', 'icon' => 'user', 'sort_order' => 120, 'is_core' => false],
            ['key' => 'setting', 'label' => 'Setting', 'group' => 'admin', 'icon' => 'settings', 'sort_order' => 900, 'is_core' => true],
            ['key' => 'hak_akses', 'label' => 'Hak Akses Menu', 'group' => 'admin', 'icon' => 'shield', 'sort_order' => 910, 'is_core' => true],
            ['key' => 'dokumen_resmi', 'label' => 'Dokumen Resmi', 'group' => 'admin', 'icon' => 'file', 'sort_order' => 920, 'is_core' => false],
            ['key' => 'users', 'label' => 'Manajemen User', 'group' => 'admin', 'icon' => 'users', 'sort_order' => 930, 'is_core' => false],
        ];

        foreach ($menus as $menu) {
            DB::table('app_menus')->updateOrInsert(
                ['key' => $menu['key']],
                [
                    ...$menu,
                    'description' => null,
                    'is_active' => true,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]
            );
        }

        $menuRows = DB::table('app_menus')->pluck('id', 'key');
        $roles = ['admin', 'guru', 'wali'];
        $guruMenus = ['dashboard', 'absensi', 'mata_pelajaran', 'nilai', 'data_diri_guru', 'materi_kegiatan', 'ruang_sifir'];
        $waliMenus = ['dashboard', 'absensi', 'pembayaran_wali', 'nilai_wali', 'kegiatan_belajar', 'biodata_siswa'];

        foreach ($roles as $role) {
            foreach ($menuRows as $key => $menuId) {
                $isAdmin = $role === 'admin';
                $isGuruDefault = $role === 'guru' && in_array($key, $guruMenus, true);
                $isWaliDefault = $role === 'wali' && in_array($key, $waliMenus, true);
                $enabled = $isAdmin || $isGuruDefault || $isWaliDefault;

                DB::table('role_menu_permissions')->updateOrInsert(
                    ['role' => $role, 'app_menu_id' => $menuId],
                    [
                        'can_view' => $enabled,
                        'can_create' => $isAdmin || ($role === 'guru' && in_array($key, ['absensi', 'nilai', 'materi_kegiatan'], true)),
                        'can_update' => $isAdmin || ($role === 'guru' && in_array($key, ['absensi', 'nilai'], true)),
                        'can_delete' => $isAdmin,
                        'can_approve' => $isAdmin,
                        'can_cancel' => $isAdmin || ($role === 'guru' && $key === 'absensi'),
                        'is_enabled' => $enabled,
                        'locked' => $isAdmin,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]
                );
            }
        }
    }
};
