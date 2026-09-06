<?php

namespace App\Services;

use App\Models\PushSubscription;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

use Minishlink\WebPush\WebPush;
use Minishlink\WebPush\Subscription;

class WebPushService
{
    /**
     * Dapatkan Public Key VAPID untuk frontend
     */
    public function getPublicKey(): string
    {
        return (string) config('webpush.vapid.public_key');
    }

    /**
     * Kirim push notification ke satu subscription dengan VAPID encryption
     */
    public function sendNotification(PushSubscription $sub, array $payload): bool
    {
        $endpoint = $sub->endpoint;
        if (empty($endpoint)) {
            return false;
        }

        $url = $payload['url'] ?? '/wali';
        $badgeCount = isset($payload['badge_count']) ? (int) $payload['badge_count'] : 1;
        $formattedPayload = json_encode([
            'title' => $payload['title'] ?? 'Pemberitahuan Pesantren Qomaruddin',
            'body' => $payload['body'] ?? 'Ada informasi terbaru untuk Anda.',
            'icon' => $payload['icon'] ?? config('webpush.default_icon', '/logo-qomaruddin.png'),
            'badge' => $payload['badge'] ?? config('webpush.default_badge', '/logo-qomaruddin.png'),
            'url' => $url,
            'tag' => $payload['tag'] ?? 'qomaruddin-' . time(),
            'badge_count' => $badgeCount,
            'timestamp' => time() * 1000,
            'data' => [
                'url' => $url,
                'badge_count' => $badgeCount,
            ],
        ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

        try {
            // Gunakan Minishlink WebPush resmi jika kunci p256dh dan auth tersedia
            if (class_exists(WebPush::class) && !empty($sub->p256dh) && !empty($sub->auth)) {
                $auth = [
                    'VAPID' => [
                        'subject' => config('webpush.vapid.subject', 'mailto:admin@qomaruddin.ponpes.id'),
                        'publicKey' => config('webpush.vapid.public_key'),
                        'privateKey' => config('webpush.vapid.private_key'),
                    ],
                ];

                $webPush = new WebPush($auth, ['TTL' => 86400, 'urgency' => 'high']);
                $webPush->setDefaultOptions(['TTL' => 86400, 'urgency' => 'high']);

                $subscription = Subscription::create([
                    'endpoint' => $sub->endpoint,
                    'publicKey' => $sub->p256dh,
                    'authToken' => $sub->auth,
                ]);

                $report = $webPush->sendOneNotification($subscription, $formattedPayload);
                if ($report->isSuccess()) {
                    $sub->update(['last_used_at' => now()]);
                    return true;
                }

                if ($report->isSubscriptionExpired()) {
                    Log::info("[WebPush] Menghapus subscription kadaluarsa ID: {$sub->id}");
                    $sub->delete();
                    return false;
                }

                Log::warning("[WebPush] Gagal mengirim via WebPush library ke ID {$sub->id}: " . $report->getReason());
            }

            // Fallback HTTP POST langsung jika push service mendukung direct post
            $response = Http::timeout(8)
                ->withHeaders([
                    'TTL' => '86400',
                    'Urgency' => 'high',
                ])
                ->withBody($formattedPayload, 'application/json')
                ->post($endpoint);

            if ($response->successful()) {
                $sub->update(['last_used_at' => now()]);
                return true;
            }

            // Jika endpoint sudah kadaluarsa atau aplikasi di-uninstall di HP (HTTP 404 / 410)
            if ($response->status() === 404 || $response->status() === 410) {
                Log::info("[WebPush] Menghapus subscription kadaluarsa ID: {$sub->id}");
                $sub->delete();
            } else {
                Log::warning("[WebPush] Gagal mengirim notifikasi ke ID {$sub->id}: Status {$response->status()} - {$response->body()}");
            }

            return false;
        } catch (\Throwable $e) {
            Log::error("[WebPush] Exception saat mengirim notifikasi: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Kirim notifikasi ke user tertentu (misal wali santri atau guru)
     */
    public function notifyUser(int $userId, string $title, string $body, ?string $url = '/', array $extra = []): int
    {
        $subscriptions = PushSubscription::where('user_id', $userId)->get();
        $successCount = 0;

        foreach ($subscriptions as $sub) {
            if ($this->sendNotification($sub, array_merge($extra, [
                'title' => $title,
                'body' => $body,
                'url' => $url,
            ]))) {
                $successCount++;
            }
        }

        return $successCount;
    }

    /**
     * Kirim notifikasi ke seluruh user dengan role tertentu (misal: 'wali', 'guru', 'admin')
     */
    public function notifyRole(string $role, string $title, string $body, ?string $url = '/', array $extra = []): int
    {
        $subscriptions = PushSubscription::where('role', $role)->get();
        $successCount = 0;

        foreach ($subscriptions as $sub) {
            if ($this->sendNotification($sub, array_merge($extra, [
                'title' => $title,
                'body' => $body,
                'url' => $url,
            ]))) {
                $successCount++;
            }
        }

        return $successCount;
    }

    /**
     * Kirim notifikasi broadcast ke seluruh perangkat terdaftar
     */
    public function notifyAll(string $title, string $body, ?string $url = '/', array $extra = []): int
    {
        $subscriptions = PushSubscription::all();
        $successCount = 0;

        foreach ($subscriptions as $sub) {
            if ($this->sendNotification($sub, array_merge($extra, [
                'title' => $title,
                'body' => $body,
                'url' => $url,
            ]))) {
                $successCount++;
            }
        }

        return $successCount;
    }
}
