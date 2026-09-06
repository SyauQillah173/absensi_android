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
     * Secret key default dari dashboard Cloudflare Yayasan Qomaruddin
     */
    protected const DEFAULT_SECRET_KEY = '0x4AAAAAAEqTAJmZ1szlBwLMnKmlqgbI2xg';

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

        // Jika token kosong
        if (empty($token)) {
            // Jika di development lokal dan tanpa koneksi internet, beri toleransi
            if (app()->environment('local') && empty($secretKey)) {
                return true;
            }
            return false;
        }

        try {
            $response = Http::asForm()->timeout(5)->post(self::VERIFY_URL, [
                'secret' => $secretKey,
                'response' => $token,
                'remoteip' => $remoteIp,
            ]);

            if ($response->successful()) {
                $body = $response->json();
                return (bool) ($body['success'] ?? false);
            }

            Log::warning('[Cloudflare Turnstile] HTTP verification failed', [
                'status' => $response->status(),
                'body' => $response->body(),
            ]);
            return false;
        } catch (\Throwable $e) {
            Log::error('[Cloudflare Turnstile] Verification exception: ' . $e->getMessage());
            // Fail open hanya jika koneksi timeout di local, tolak di production
            return app()->environment('local');
        }
    }
}
