<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AppMenu;
use App\Models\RoleMenuPermission;
use App\Services\AuditLogService;
use App\Services\PermissionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class PermissionController extends Controller
{
    public function __construct(
        private readonly PermissionService $permissions,
        private readonly AuditLogService $audit,
    ) {
    }

    public function menus()
    {
        return response()->json([
            'success' => true,
            'data' => $this->permissions->menus()->values(),
        ]);
    }

    public function index()
    {
        return response()->json([
            'success' => true,
            'data' => $this->permissions->allSettings(),
        ]);
    }

    public function update(Request $request)
    {
        $validated = $request->validate([
            'permissions' => 'required|array',
            'permissions.*.role' => ['required', Rule::in(['admin_bendahara', 'admin_bendahara_2', 'admin_akademik', 'admin_pondok', 'admin_absensi', 'admin_lainnya', 'guru', 'wali'])],
            'permissions.*.menu_key' => 'required|string|exists:app_menus,key',
            'permissions.*.can_view' => 'required|boolean',
            'permissions.*.can_create' => 'required|boolean',
            'permissions.*.can_update' => 'required|boolean',
            'permissions.*.can_delete' => 'required|boolean',
            'permissions.*.can_approve' => 'required|boolean',
            'permissions.*.can_cancel' => 'required|boolean',
            'permissions.*.is_enabled' => 'required|boolean',
        ]);

        $roles = collect($validated['permissions'])->pluck('role')->unique()->values();
        $before = $this->snapshot($roles->all());

        DB::transaction(function () use ($validated) {
            $menus = AppMenu::query()->pluck('id', 'key');

            foreach ($validated['permissions'] as $item) {
                $menuId = $menus[$item['menu_key']] ?? null;
                if (!$menuId) {
                    continue;
                }

                $enabled = (bool) $item['is_enabled'];
                $canView = $enabled && (bool) $item['can_view'];

                RoleMenuPermission::query()->updateOrCreate(
                    [
                        'role' => $item['role'],
                        'app_menu_id' => $menuId,
                    ],
                    [
                        'can_view' => $canView,
                        'can_create' => $canView && (bool) $item['can_create'],
                        'can_update' => $canView && (bool) $item['can_update'],
                        'can_delete' => $canView && (bool) $item['can_delete'],
                        'can_approve' => $canView && (bool) $item['can_approve'],
                        'can_cancel' => $canView && (bool) $item['can_cancel'],
                        'is_enabled' => $enabled,
                        'locked' => false,
                    ]
                );
            }
        });

        $after = $this->snapshot($roles->all());
        $this->audit->record($request, 'permissions', 'update', 'role_menu_permissions', $before, $after);

        return response()->json([
            'success' => true,
            'message' => 'Hak akses menu berhasil diperbarui',
            'data' => $this->permissions->allSettings(),
        ]);
    }

    private function snapshot(array $roles): array
    {
        return collect($roles)
            ->mapWithKeys(fn (string $role) => [$role => $this->permissions->permissionsForRole($role)['menus']])
            ->all();
    }
}
