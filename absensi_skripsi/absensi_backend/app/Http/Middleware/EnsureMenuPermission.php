<?php

namespace App\Http\Middleware;

use App\Services\PermissionService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureMenuPermission
{
    public function __construct(private readonly PermissionService $permissions)
    {
    }

    public function handle(Request $request, Closure $next, string $menuKey, string $action = 'view'): Response
    {
        if (!$this->permissions->can($request->user(), $menuKey, $action)) {
            return response()->json([
                'success' => false,
                'message' => 'Akses ditolak. Anda tidak memiliki izin untuk membuka fitur ini.',
                'permission' => [
                    'menu_key' => $menuKey,
                    'action' => $action,
                ],
            ], 403);
        }

        return $next($request);
    }
}
