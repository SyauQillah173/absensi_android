<?php

namespace App\Http\Middleware;

use App\Models\ApiAccessToken;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AuthenticateApiToken
{
    public function handle(Request $request, Closure $next): Response
    {
        $plainToken = $request->bearerToken();

        if (!$plainToken) {
            return response()->json([
                'success' => false,
                'message' => 'Token login tidak ditemukan. Silakan login ulang.',
            ], 401);
        }

        $accessToken = ApiAccessToken::with('user')
            ->where('token_hash', hash('sha256', $plainToken))
            ->first();

        if (
            !$accessToken ||
            $accessToken->is_revoked ||
            ($accessToken->expires_at && $accessToken->expires_at->isPast()) ||
            !$accessToken->user ||
            (($accessToken->user->status ?? 'Aktif') !== 'Aktif')
        ) {
            return response()->json([
                'success' => false,
                'message' => 'Sesi login telah dikeluarkan atau kedaluwarsa. Silakan login kembali demi keamanan akun.',
            ], 401);
        }

        $accessToken->forceFill(['last_used_at' => now()])->save();

        $request->setUserResolver(fn () => $accessToken->user);
        $request->attributes->set('api_access_token', $accessToken);

        return $next($request);
    }
}
