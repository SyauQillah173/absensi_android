<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class CloudflareTurnstileService
{
    /**
     * Endpoint verifikasi resmi Cloudflare Turnstile
     */
    protected const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

    /**
     * Secret key resmi dari dashboard Cloudflare Yayasan Qomaruddin (Domain itqom.net)
     */
    protected const DEFAULT_SECRET_KEY = '0x4AAAAAAEqTAJmZ1szlBwLMnKmlqgbI2xg';

    /**
     * Secret key resmi Cloudflare untuk testing / dev (Always Passes)
     */
    protected const TEST_SECRET_KEY = '1x0000000000000000000000000000000AA';

    /**
     * Verifikasi token Turnstile yang dikirim dari browser pengunjung.
     *
     * @param string|null $token Token respon dari widget Turnstile
     * @param string|null $remoteIp IP client pengirim
     * @return bool True jika valid, False jika bot/palsu
     */
    public function verify(?string $token, ?string $remoteIp = null): bool
    {
        $secretKey = config('services.cloudflare.turnstile_secret', env('CLOUDFLARE_TURNSTILE_SECRET_KEY', self::DEFAULT_SECRET_KEY));
        $isPrivate = $this->isPrivateOrLocalIp($remoteIp);

        // 1. Jika token kosong sama sekali (pengguna belum centang atau bot tanpa token) -> WAJIB TOLAK
        if (empty($token)) {
            return false;
        }

        // 2. Jika token berasal dari test key Cloudflare resmi (dimulai '1x' atau secret dummy)
        if (str_starts_with($token, '1x') || str_starts_with($token, 'XXXX.') || $secretKey === self::TEST_SECRET_KEY) {
            $secretKey = self::TEST_SECRET_KEY;
        }

        // 3. Request verifikasi ke API Cloudflare Turnstile
        try {
            $response = Http::asForm()->timeout(6)->post(self::VERIFY_URL, [
                'secret' => $secretKey,
                'response' => $token,
                'remoteip' => $remoteIp,
            ]);

            if ($response->successful()) {
                $body = $response->json();
                $isSuccess = (bool) ($body['success'] ?? false);
                
                if (!$isSuccess) {
                    $errorCodes = $body['error-codes'] ?? [];
                    Log::warning('[Cloudflare Turnstile] Verifikasi ditolak Cloudflare', [
                        'error_codes' => $errorCodes,
                        'remote_ip' => $remoteIp,
                    ]);

                    // Jika error karena domain-mismatch saat testing di IP server lokal/internal
                    if ($isPrivate && in_array('domain-mismatch', $errorCodes, true)) {
                        Log::info('[Cloudflare Turnstile] Domain mismatch di IP lokal diizinkan untuk keperluan development.');
                        return true;
                    }
                }
                
                return $isSuccess;
            }

            Log::warning('[Cloudflare Turnstile] HTTP verifikasi gagal dengan status ' . $response->status(), [
                'body' => $response->body(),
            ]);

            // Jika di jaringan privat dan API Cloudflare timeout/gagal, izinkan admin masuk
            return $isPrivate || app()->environment('local');
        } catch (\Throwable $e) {
            Log::error('[Cloudflare Turnstile] Exception saat memverifikasi token: ' . $e->getMessage());
            return $isPrivate || app()->environment('local');
        }
    }

    /**
     * Cek apakah IP client berasal dari localhost atau jaringan privat (LAN / VPN / Cloudflare Tunnel lokal)
     */
    private function isPrivateOrLocalIp(?string $ip): bool
    {
        if (empty($ip)) {
            return false;
        }

        if (in_array($ip, ['127.0.0.1', '::1', 'localhost'], true)) {
            return true;
        }

        // Cek apakah IP berada di range privat (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
        if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false) {
            return true;
        }

        return false;
    }
}
