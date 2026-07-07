<?php

namespace App\Http\Middleware;

use App\Models\ApiAccessToken;
use App\Services\JwtService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AuthenticateApiToken
{
    public function handle(Request $request, Closure $next): Response
    {
        $token = $request->bearerToken();
        try {
            $claims = $token ? app(JwtService::class)->decode($token) : null;
        } catch (\Throwable) {
            $claims = null;
        }

        $accessToken = $claims
            ? ApiAccessToken::with('user')->where('token_hash', hash('sha256', $token))->first()
            : null;
        if (!$accessToken || $accessToken->expires_at?->isPast() || !$accessToken->user?->status_aktif) {
            return response()->json(['success' => false, 'message' => 'Sesi tidak valid atau kedaluwarsa.'], 401);
        }

        if ((string) $accessToken->user_id !== (string) ($claims['sub'] ?? '')) {
            return response()->json(['success' => false, 'message' => 'Identitas JWT tidak valid.'], 401);
        }

        $accessToken->forceFill(['last_used_at' => now()])->save();
        $request->setUserResolver(fn () => $accessToken->user);
        $request->attributes->set('api_access_token', $accessToken);

        return $next($request);
    }
}
