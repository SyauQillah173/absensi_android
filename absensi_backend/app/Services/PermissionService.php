<?php

namespace App\Services;

use App\Models\AppMenu;
use App\Models\RoleMenuPermission;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Schema;

class PermissionService
{
    private const ACTION_COLUMNS = [
        'view' => 'can_view',
        'create' => 'can_create',
        'update' => 'can_update',
        'delete' => 'can_delete',
        'approve' => 'can_approve',
        'cancel' => 'can_cancel',
    ];

    public function can(?User $user, string $menuKey, string $action = 'view'): bool
    {
        if (!$user) {
            return false;
        }

        if ($this->isSuperAdmin($user)) {
            return true;
        }

        $role = $this->effectiveRole($user);

        if (!$this->databaseReady()) {
            return $this->fallbackCan($role, $menuKey, $action);
        }

        $column = self::ACTION_COLUMNS[$action] ?? self::ACTION_COLUMNS['view'];
        $permission = RoleMenuPermission::query()
            ->where('role', $role)
            ->whereHas('menu', fn ($query) => $query->where('key', $menuKey)->where('is_active', true))
            ->first();

        if (!$permission) {
            return $this->fallbackCan($role, $menuKey, $action);
        }

        if (!$permission->is_enabled || !$permission->can_view) {
            return false;
        }

        return (bool) $permission->{$column};
    }

    public function permissionsForUser(?User $user): array
    {
        if (!$user) {
            return [
                'role' => null,
                'menus' => [],
                'by_key' => [],
            ];
        }

        return $this->permissionsForRole($this->effectiveRole($user));
    }

    public function permissionsForRole(string $role): array
    {
        if (in_array($role, ['admin', 'admin_utama'], true)) {
            return $this->adminPermissions();
        }

        if (!$this->databaseReady()) {
            return $this->fallbackPermissionArray($role);
        }

        $rows = RoleMenuPermission::query()
            ->with('menu')
            ->where('role', $role)
            ->whereHas('menu', fn ($query) => $query->where('is_active', true))
            ->get()
            ->filter(fn (RoleMenuPermission $permission) => $permission->menu)
            ->sortBy(fn (RoleMenuPermission $permission) => $permission->menu->sort_order)
            ->values();

        if ($rows->isEmpty()) {
            $rows = $this->fallbackPermissions($role);
        }

        return $this->formatPermissionCollection($role, $rows);
    }

    public function allSettings(): array
    {
        if (!$this->databaseReady()) {
            return [
                'roles' => $this->managedRoles(),
                'menus' => $this->defaultMenus()->values(),
                'permissions' => [
                    ...collect($this->managedRoles())
                        ->mapWithKeys(fn (string $role) => [$role => $this->fallbackPermissionArray($role)['menus']])
                        ->all(),
                ],
                'actions' => array_keys(self::ACTION_COLUMNS),
            ];
        }

        $menus = $this->menus();
        $roles = $this->managedRoles();

        return [
            'roles' => $roles,
            'menus' => $menus->map(fn (AppMenu $menu) => $this->formatMenu($menu))->values(),
            'permissions' => collect($roles)
                ->mapWithKeys(fn (string $role) => [$role => $this->permissionsForRole($role)['menus']])
                ->all(),
            'actions' => array_keys(self::ACTION_COLUMNS),
        ];
    }

    public function actionColumn(string $action): string
    {
        return self::ACTION_COLUMNS[$action] ?? self::ACTION_COLUMNS['view'];
    }

    public function menus(): Collection
    {
        if (!$this->databaseReady()) {
            return collect();
        }

        return AppMenu::query()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('label')
            ->get();
    }

    private function adminPermissions(): array
    {
        if (!$this->databaseReady()) {
            return $this->fallbackPermissionArray('admin');
        }

        $rows = $this->menus()->map(function (AppMenu $menu) {
            $permission = new RoleMenuPermission([
                'role' => 'admin',
                'can_view' => true,
                'can_create' => true,
                'can_update' => true,
                'can_delete' => true,
                'can_approve' => true,
                'can_cancel' => true,
                'is_enabled' => true,
                'locked' => true,
            ]);
            $permission->setRelation('menu', $menu);
            return $permission;
        });

        return $this->formatPermissionCollection('admin', $rows);
    }

    private function formatPermissionCollection(string $role, Collection $rows): array
    {
        $menus = $rows->map(fn (RoleMenuPermission $permission) => [
            ...$this->formatMenu($permission->menu),
            'can_view' => (bool) $permission->can_view,
            'can_create' => (bool) $permission->can_create,
            'can_update' => (bool) $permission->can_update,
            'can_delete' => (bool) $permission->can_delete,
            'can_approve' => (bool) $permission->can_approve,
            'can_cancel' => (bool) $permission->can_cancel,
            'is_enabled' => (bool) $permission->is_enabled,
            'locked' => (bool) $permission->locked,
        ])->values();

        return [
            'role' => $role,
            'menus' => $menus,
            'by_key' => $menus->keyBy('key')->all(),
        ];
    }

    private function formatMenu(AppMenu $menu): array
    {
        return [
            'id' => $menu->id,
            'key' => $menu->key,
            'label' => $menu->label,
            'group' => $menu->group,
            'icon' => $menu->icon,
            'description' => $menu->description,
            'sort_order' => $menu->sort_order,
            'is_core' => (bool) $menu->is_core,
            'is_active' => (bool) $menu->is_active,
        ];
    }

    private function fallbackCan(string $role, string $menuKey, string $action): bool
    {
        if (in_array($role, ['admin', 'admin_utama'], true)) {
            return true;
        }

        $viewDefaults = [
            'admin_bendahara' => ['dashboard', 'keuangan'],
            'admin_pondok' => ['dashboard', 'buku_induk', 'absensi'],
            'admin_absensi' => ['dashboard', 'absensi'],
            'admin_akademik' => ['dashboard', 'buku_induk', 'mata_pelajaran', 'ruang_sifir', 'nilai'],
            'admin_lainnya' => ['dashboard'],
            'guru' => ['dashboard', 'absensi', 'mata_pelajaran', 'nilai', 'data_diri_guru', 'materi_kegiatan', 'ruang_sifir'],
            'wali' => ['dashboard', 'absensi', 'pembayaran_wali', 'nilai_wali', 'kegiatan_belajar', 'biodata_siswa'],
        ];

        if (!in_array($menuKey, $viewDefaults[$role] ?? [], true)) {
            return false;
        }

        if ($action === 'view') {
            return true;
        }

        if (str_starts_with($role, 'admin_')) {
            return true;
        }

        if ($role !== 'guru') {
            return false;
        }

        if ($action === 'create') {
            return in_array($menuKey, ['absensi', 'nilai', 'materi_kegiatan'], true);
        }

        if ($action === 'update') {
            return in_array($menuKey, ['absensi', 'nilai'], true);
        }

        return $action === 'cancel' && $menuKey === 'absensi';
    }

    private function fallbackPermissions(string $role): Collection
    {
        $menus = $this->menus();

        return $menus->map(function (AppMenu $menu) use ($role) {
            $permission = new RoleMenuPermission([
                'role' => $role,
                'can_view' => $this->fallbackCan($role, $menu->key, 'view'),
                'can_create' => $this->fallbackCan($role, $menu->key, 'create'),
                'can_update' => $this->fallbackCan($role, $menu->key, 'update'),
                'can_delete' => $this->fallbackCan($role, $menu->key, 'delete'),
                'can_approve' => $this->fallbackCan($role, $menu->key, 'approve'),
                'can_cancel' => $this->fallbackCan($role, $menu->key, 'cancel'),
                'is_enabled' => $this->fallbackCan($role, $menu->key, 'view'),
                'locked' => false,
            ]);
            $permission->setRelation('menu', $menu);
            return $permission;
        });
    }

    private function fallbackPermissionArray(string $role): array
    {
        $menus = $this->defaultMenus()->map(function (array $menu) use ($role) {
            $isAdmin = in_array($role, ['admin', 'admin_utama'], true);
            return [
                ...$menu,
                'can_view' => $isAdmin || $this->fallbackCan($role, $menu['key'], 'view'),
                'can_create' => $isAdmin || $this->fallbackCan($role, $menu['key'], 'create'),
                'can_update' => $isAdmin || $this->fallbackCan($role, $menu['key'], 'update'),
                'can_delete' => $isAdmin || $this->fallbackCan($role, $menu['key'], 'delete'),
                'can_approve' => $isAdmin || $this->fallbackCan($role, $menu['key'], 'approve'),
                'can_cancel' => $isAdmin || $this->fallbackCan($role, $menu['key'], 'cancel'),
                'is_enabled' => $isAdmin || $this->fallbackCan($role, $menu['key'], 'view'),
                'locked' => $isAdmin,
            ];
        })->values();

        return [
            'role' => $role,
            'menus' => $menus,
            'by_key' => $menus->keyBy('key')->all(),
        ];
    }

    private function defaultMenus(): Collection
    {
        return collect([
            ['id' => null, 'key' => 'dashboard', 'label' => 'Dashboard', 'group' => 'umum', 'icon' => 'home', 'description' => null, 'sort_order' => 1, 'is_core' => true, 'is_active' => true],
            ['id' => null, 'key' => 'absensi', 'label' => 'Absensi', 'group' => 'guru', 'icon' => 'checklist', 'description' => null, 'sort_order' => 10, 'is_core' => false, 'is_active' => true],
            ['id' => null, 'key' => 'mata_pelajaran', 'label' => 'Mata Pelajaran', 'group' => 'akademik', 'icon' => 'book', 'description' => null, 'sort_order' => 20, 'is_core' => false, 'is_active' => true],
            ['id' => null, 'key' => 'nilai', 'label' => 'Nilai Ujian/Hafalan', 'group' => 'akademik', 'icon' => 'award', 'description' => null, 'sort_order' => 30, 'is_core' => false, 'is_active' => true],
            ['id' => null, 'key' => 'keuangan', 'label' => 'Keuangan', 'group' => 'admin', 'icon' => 'wallet', 'description' => null, 'sort_order' => 40, 'is_core' => false, 'is_active' => true],
            ['id' => null, 'key' => 'buku_induk', 'label' => 'Buku Induk', 'group' => 'admin', 'icon' => 'users', 'description' => null, 'sort_order' => 50, 'is_core' => false, 'is_active' => true],
            ['id' => null, 'key' => 'data_diri_guru', 'label' => 'Data Diri Guru', 'group' => 'guru', 'icon' => 'badge', 'description' => null, 'sort_order' => 60, 'is_core' => false, 'is_active' => true],
            ['id' => null, 'key' => 'materi_kegiatan', 'label' => 'Materi & Kegiatan', 'group' => 'akademik', 'icon' => 'image', 'description' => null, 'sort_order' => 70, 'is_core' => false, 'is_active' => true],
            ['id' => null, 'key' => 'ruang_sifir', 'label' => 'Ruang Sifir', 'group' => 'akademik', 'icon' => 'bookmark', 'description' => null, 'sort_order' => 80, 'is_core' => false, 'is_active' => true],
            ['id' => null, 'key' => 'pembayaran_wali', 'label' => 'Pembayaran', 'group' => 'wali', 'icon' => 'wallet', 'description' => null, 'sort_order' => 90, 'is_core' => false, 'is_active' => true],
            ['id' => null, 'key' => 'nilai_wali', 'label' => 'Nilai Anak', 'group' => 'wali', 'icon' => 'award', 'description' => null, 'sort_order' => 100, 'is_core' => false, 'is_active' => true],
            ['id' => null, 'key' => 'kegiatan_belajar', 'label' => 'Kegiatan Belajar', 'group' => 'wali', 'icon' => 'calendar', 'description' => null, 'sort_order' => 110, 'is_core' => false, 'is_active' => true],
            ['id' => null, 'key' => 'biodata_siswa', 'label' => 'Biodata Siswa', 'group' => 'wali', 'icon' => 'user', 'description' => null, 'sort_order' => 120, 'is_core' => false, 'is_active' => true],
            ['id' => null, 'key' => 'setting', 'label' => 'Setting', 'group' => 'admin', 'icon' => 'settings', 'description' => null, 'sort_order' => 900, 'is_core' => true, 'is_active' => true],
            ['id' => null, 'key' => 'hak_akses', 'label' => 'Hak Akses Menu', 'group' => 'admin', 'icon' => 'shield', 'description' => null, 'sort_order' => 910, 'is_core' => true, 'is_active' => true],
        ]);
    }

    private function databaseReady(): bool
    {
        return Schema::hasTable('app_menus') && Schema::hasTable('role_menu_permissions');
    }

    private function isSuperAdmin(User $user): bool
    {
        return $user->role === 'admin' && in_array(($user->admin_type ?: 'utama'), ['utama', 'it', 'pengurus'], true);
    }

    private function effectiveRole(User $user): string
    {
        if ($user->role === 'admin') {
            $type = strtolower($user->admin_type ?: 'utama');
            if (in_array($type, ['it', 'pengurus', 'utama'], true)) {
                return 'admin_utama';
            }
            if (in_array($type, ['keuangan', 'bendahara', 'bendahara_1'], true)) {
                return 'admin_bendahara';
            }
            if (in_array($type, ['madrasah', 'absensi', 'kepala_madrasah'], true)) {
                return 'admin_absensi';
            }
            return 'admin_' . $type;
        }

        if ($user->role === 'guru') {
            $type = $user->admin_type ?: 'umum';
            return $type === 'umum' ? 'guru' : 'guru_' . $type;
        }

        return $user->role;
    }

    private function managedRoles(): array
    {
        return [
            'admin_utama',
            'admin_bendahara',
            'admin_bendahara_2',
            'admin_akademik',
            'admin_pondok',
            'admin_absensi',
            'admin_lainnya',
            'guru',
            'guru_madin',
            'guru_ngaji',
            'guru_sholat',
            'guru_asrama',
            'wali',
        ];
    }
}
