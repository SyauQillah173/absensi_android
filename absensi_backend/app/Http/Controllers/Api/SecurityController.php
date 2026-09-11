<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ApiAccessToken;
use App\Models\LoginHistory;
use App\Models\User;
use App\Services\AuditLogService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Hash;

class SecurityController extends Controller
{
    /**
     * Pastikan hanya Admin IT yang berhak mengakses fungsi monitoring global
     */
    protected function authorizeItAdmin(Request $request): void
    {
        $user = $request->user();
        if (!$user) {
            abort(401, 'Unauthenticated');
        }

        $adminType = strtolower((string) ($user->admin_type ?? ''));
        $role = strtolower((string) ($user->role ?? ''));

        $isIt = in_array($adminType, ['it', 'admin_it', 'developer', 'dev'], true) ||
                ($role === 'admin' && in_array($adminType, ['it', 'admin_it'], true));

        if (!$isIt) {
            abort(403, 'Akses ditolak: Menu ini khusus untuk Admin IT.');
        }
    }

    /**
     * GET /api/security/active-sessions
     * Menampilkan daftar perangkat & sesi login yang sedang aktif untuk akun pengguna saat ini
     */
    public function activeSessions(Request $request)
    {
        $user = $request->user();
        $currentAccessToken = $request->attributes->get('api_access_token');

        $tokens = ApiAccessToken::where('user_id', $user->id)
            ->where('is_revoked', false)
            ->where(function ($q) {
                $q->whereNull('expires_at')->orWhere('expires_at', '>', now());
            })
            ->orderBy('last_used_at', 'desc')
            ->get();

        $sessions = $tokens->map(function ($token) use ($currentAccessToken) {
            $isCurrent = $currentAccessToken && $currentAccessToken->id === $token->id;

            return [
                'id'                => $token->id,
                'name'              => $token->name ?: 'Perangkat Web',
                'device_type'       => $token->device_type ?: 'desktop',
                'device_name'       => $token->device_name ?: 'Perangkat Terhubung',
                'platform'          => $token->platform ?: 'Unknown OS',
                'browser'           => $token->browser ?: 'Web Browser',
                'ip_address'        => $token->ip_address ?: '127.0.0.1',
                'location'          => $token->location ?: 'Indonesia',
                'last_used_at'      => $token->last_used_at ? $token->last_used_at->toIso8601String() : $token->created_at->toIso8601String(),
                'created_at'        => $token->created_at ? $token->created_at->toIso8601String() : now()->toIso8601String(),
                'is_current'        => $isCurrent,
                'is_current_device' => $isCurrent,
            ];
        });

        return response()->json([
            'success' => true,
            'data'    => $sessions,
        ]);
    }

    /**
     * GET /api/security/login-history
     * Menampilkan riwayat login untuk akun pengguna saat ini
     */
    public function loginHistory(Request $request)
    {
        $user = $request->user();

        $histories = LoginHistory::where('user_id', $user->id)
            ->orderBy('id', 'desc')
            ->limit(20)
            ->get();

        return response()->json([
            'success' => true,
            'data'    => $histories,
        ]);
    }

    /**
     * POST /api/security/revoke-session/{id}
     * Memutus sesi login perangkat tertentu (logout dari perangkat terpilih)
     */
    public function revokeSession(Request $request, $id)
    {
        $user = $request->user();
        $token = ApiAccessToken::where('user_id', $user->id)->findOrFail($id);

        try {
            LoginHistory::where('token_id', $token->id)
                ->where('status', 'active')
                ->update([
                    'status'    => 'revoked',
                    'logout_at' => now(),
                ]);
        } catch (\Throwable $e) {
            // ignore
        }

        $token->delete();

        app(AuditLogService::class)->record($request, 'security', 'revoke_session', $user, null, [
            'revoked_token_id' => $id,
            'device_name'      => $token->device_name,
            'ip_address'       => $token->ip_address,
        ]);

        return response()->json([
            'success' => true,
            'message' => "Perangkat ({$token->device_name}) berhasil dikeluarkan dari akun.",
        ]);
    }

    /**
     * POST /api/security/logout-other-devices
     * Mengeluarkan akun dari SEMUA perangkat lain, KECUALI perangkat saat ini
     */
    public function logoutOtherDevices(Request $request)
    {
        $user = $request->user();
        $currentAccessToken = $request->attributes->get('api_access_token');

        if (!$currentAccessToken) {
            return response()->json([
                'success' => false,
                'message' => 'Sesi perangkat saat ini tidak ditemukan.',
            ], 400);
        }

        $otherTokens = ApiAccessToken::where('user_id', $user->id)
            ->where('id', '!=', $currentAccessToken->id)
            ->get();

        $count = $otherTokens->count();
        $otherTokenIds = $otherTokens->pluck('id')->toArray();

        if (!empty($otherTokenIds)) {
            try {
                LoginHistory::whereIn('token_id', $otherTokenIds)
                    ->where('status', 'active')
                    ->update([
                        'status'    => 'revoked',
                        'logout_at' => now(),
                    ]);
            } catch (\Throwable $e) {
                // ignore
            }

            ApiAccessToken::whereIn('id', $otherTokenIds)->delete();
        }

        app(AuditLogService::class)->record($request, 'security', 'logout_other_devices', $user, null, [
            'revoked_sessions_count' => $count,
        ]);

        return response()->json([
            'success' => true,
            'message' => "Berhasil mengeluarkan {$count} sesi perangkat lain. Akun Anda kini hanya aktif di perangkat ini.",
        ]);
    }

    /**
     * POST /api/security/logout-all-devices
     * Mengeluarkan akun dari SEMUA perangkat termasuk perangkat saat ini
     */
    public function logoutAllDevices(Request $request)
    {
        $user = $request->user();

        $allTokens = ApiAccessToken::where('user_id', $user->id)->get();
        $allTokenIds = $allTokens->pluck('id')->toArray();

        if (!empty($allTokenIds)) {
            try {
                LoginHistory::whereIn('token_id', $allTokenIds)
                    ->where('status', 'active')
                    ->update([
                        'status'    => 'revoked',
                        'logout_at' => now(),
                    ]);
            } catch (\Throwable $e) {
                // ignore
            }

            ApiAccessToken::whereIn('id', $allTokenIds)->delete();
        }

        app(AuditLogService::class)->record($request, 'security', 'logout_all_devices', $user, null, [
            'revoked_sessions_count' => count($allTokenIds),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Seluruh perangkat telah berhasil dikeluarkan. Silakan login kembali.',
        ]);
    }

    /**
     * POST /api/security/change-password-secure
     * Mengganti password akun secara aman + opsi otomatis logout dari semua perangkat lain
     */
    public function changePasswordSecure(Request $request)
    {
        if ($request->has('password') && !$request->has('new_password')) {
            $request->merge([
                'new_password' => $request->input('password'),
                'new_password_confirmation' => $request->input('password_confirmation'),
            ]);
        }

        $validated = $request->validate([
            'current_password'          => 'required|string',
            'new_password'              => 'required|string|min:6|different:current_password',
            'new_password_confirmation' => 'required|same:new_password',
            'logout_others'             => 'nullable|boolean',
        ]);

        $user = $request->user();

        if (!Hash::check($validated['current_password'], $user->password)) {
            return response()->json([
                'success' => false,
                'message' => 'Password lama tidak sesuai. Silakan periksa kembali.',
            ], 422);
        }

        // Update password baru
        $user->password = Hash::make($validated['new_password']);
        $user->password_current_encrypted = Crypt::encryptString($validated['new_password']);
        $user->password_changed_at = now();
        $user->save();

        $logoutOthers = $validated['logout_others'] ?? true;
        $currentAccessToken = $request->attributes->get('api_access_token');

        if ($logoutOthers && $currentAccessToken) {
            $otherTokens = ApiAccessToken::where('user_id', $user->id)
                ->where('id', '!=', $currentAccessToken->id)
                ->get();
            $otherTokenIds = $otherTokens->pluck('id')->toArray();

            if (!empty($otherTokenIds)) {
                LoginHistory::whereIn('token_id', $otherTokenIds)
                    ->where('status', 'active')
                    ->update([
                        'status'    => 'password_changed',
                        'logout_at' => now(),
                    ]);
                ApiAccessToken::whereIn('id', $otherTokenIds)->delete();
            }
        }

        app(AuditLogService::class)->record($request, 'security', 'change_password_secure', $user, null, [
            'logout_others' => $logoutOthers,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Password akun berhasil diubah' . ($logoutOthers ? ' dan seluruh perangkat lain telah dikeluarkan demi keamanan.' : '.'),
        ]);
    }

    /**
     * GET /api/security/admin/all-logins
     * (Khusus Admin IT) Melihat seluruh riwayat dan live login dari semua akun di sistem
     */
    public function adminAllLogins(Request $request)
    {
        $this->authorizeItAdmin($request);

        $query = LoginHistory::with(['user:id,name,email,role,admin_type,status,foto_profil'])
            ->orderBy('id', 'desc');

        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('user_name', 'ilike', "%{$search}%")
                  ->orWhere('ip_address', 'like', "%{$search}%")
                  ->orWhere('device_name', 'ilike', "%{$search}%")
                  ->orWhere('location', 'ilike', "%{$search}%")
                  ->orWhere('platform', 'ilike', "%{$search}%");
            });
        }

        if ($role = $request->input('role')) {
            $query->where('role', $role);
        }

        if ($deviceType = $request->input('device_type')) {
            $query->where('device_type', $deviceType);
        }

        if ($status = $request->input('status')) {
            $query->where('status', $status);
        }

        $logs = $query->paginate($request->input('per_page', 25));

        // Statistik Ringkas Keamanan untuk Admin IT
        $totalLoginsToday = LoginHistory::whereDate('login_at', now()->toDateString())->count();
        $activeSessionsCount = ApiAccessToken::where('is_revoked', false)
            ->where(function ($q) {
                $q->whereNull('expires_at')->orWhere('expires_at', '>', now());
            })->count();
        $mobileCount = ApiAccessToken::where('device_type', 'mobile')->count();
        $desktopCount = ApiAccessToken::where('device_type', 'desktop')->count();

        return response()->json([
            'success' => true,
            'data'    => $logs->items(),
            'meta'    => [
                'current_page' => $logs->currentPage(),
                'last_page'    => $logs->lastPage(),
                'per_page'     => $logs->perPage(),
                'total'        => $logs->total(),
            ],
            'statistics' => [
                'total_logins_today' => $totalLoginsToday,
                'active_sessions'    => $activeSessionsCount,
                'mobile_devices'     => $mobileCount,
                'desktop_devices'    => $desktopCount,
            ],
        ]);
    }

    /**
     * POST /api/security/admin/force-logout-user/{userId}
     * (Khusus Admin IT) Memutus paksa seluruh sesi login milik user tertentu jika dicurigai
     */
    public function adminForceLogoutUser(Request $request, $userId)
    {
        $this->authorizeItAdmin($request);

        $targetUser = User::findOrFail($userId);

        $tokens = ApiAccessToken::where('user_id', $targetUser->id)->get();
        $tokenIds = $tokens->pluck('id')->toArray();
        $count = count($tokenIds);

        if ($count > 0) {
            try {
                LoginHistory::whereIn('token_id', $tokenIds)
                    ->where('status', 'active')
                    ->update([
                        'status'    => 'revoked',
                        'logout_at' => now(),
                    ]);
            } catch (\Throwable $e) {
                // ignore
            }

            ApiAccessToken::whereIn('id', $tokenIds)->delete();
        }

        app(AuditLogService::class)->record($request, 'security', 'admin_force_logout', $request->user(), $targetUser, [
            'target_user_id'   => $targetUser->id,
            'target_user_name' => $targetUser->name,
            'sessions_killed'  => $count,
        ]);

        return response()->json([
            'success' => true,
            'message' => "Berhasil memutus paksa {$count} sesi login milik {$targetUser->name}. Pengguna tersebut langsung logout seketika dari semua perangkatnya.",
        ]);
    }
}
