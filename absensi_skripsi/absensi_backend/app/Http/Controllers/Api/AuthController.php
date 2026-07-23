<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ApiAccessToken;
use App\Models\User;
use App\Services\JwtService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    public function login(Request $request, JwtService $jwt)
    {
        $validated = $request->validate([
            'username' => 'nullable|required_without:identifier|string',
            'identifier' => 'nullable|required_without:username|string',
            'password' => 'required|string|min:8',
            'device_name' => 'nullable|string|max:100',
        ]);
        $username = trim($validated['username'] ?? $validated['identifier']);
        $user = User::query()
            ->whereIn('role', ['admin', 'guru', 'kepala_sekolah'])
            ->where(fn ($query) => $query->where('username', $username)->orWhere('email', $username))
            ->first();

        if ($user?->locked_until?->isFuture()) {
            return response()->json([
                'success' => false,
                'message' => 'Login dikunci sementara. Coba lagi setelah '.$user->locked_until->format('H:i').'.',
            ], 429);
        }

        $hash = $user?->password_hash ?: $user?->password;
        if (!$user || !$hash || !Hash::check($validated['password'], $hash)) {
            if ($user) {
                $recent = $user->login_failed_at && now()->diffInMinutes($user->login_failed_at) < 15;
                $count = $recent ? ((int) $user->login_failed_count + 1) : 1;
                $user->forceFill([
                    'login_failed_count' => $count,
                    'login_failed_at' => now(),
                    'locked_until' => $count >= 5 ? now()->addMinutes(15) : null,
                ])->save();
            }
            return response()->json(['success' => false, 'message' => 'Username atau password salah.'], 401);
        }

        if (!$user->status_aktif) {
            return response()->json(['success' => false, 'message' => 'Akun tidak aktif.'], 403);
        }

        $user->forceFill(['login_failed_count' => 0, 'login_failed_at' => null, 'locked_until' => null])->save();
        $token = $jwt->issue($user->id, $user->role);
        ApiAccessToken::create([
            'user_id' => $user->id,
            'name' => $validated['device_name'] ?? 'android',
            'token_hash' => hash('sha256', $token),
            'expires_at' => now()->addDay(),
        ]);

        return response()->json([
            'success' => true,
            'token_type' => 'Bearer',
            'token' => $token,
            'expires_in' => 86400,
            'data' => [
                'id_user' => $user->id,
                'username' => $user->username,
                'nama' => $user->name,
                'role' => ucfirst($user->role),
                'id_guru' => $user->guru?->id_guru,
            ],
        ]);
    }

    public function logout(Request $request)
    {
        $request->attributes->get('api_access_token')?->delete();

        return response()->json(['success' => true, 'message' => 'Logout berhasil.']);
    }

    public function refresh(Request $request, JwtService $jwt)
    {
        $oldToken = $request->attributes->get('api_access_token');
        $user = $request->user();
        $token = $jwt->issue($user->id, $user->role);

        ApiAccessToken::create([
            'user_id' => $user->id,
            'name' => $oldToken?->name ?? 'android-refresh',
            'token_hash' => hash('sha256', $token),
            'expires_at' => now()->addDay(),
        ]);
        $oldToken?->delete();

        return response()->json([
            'success' => true,
            'token_type' => 'Bearer',
            'token' => $token,
            'expires_in' => 86400,
        ]);
    }
}
