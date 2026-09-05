<?php

namespace App\Services;

use App\Models\PushSubscription;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

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
     * Kirim push notification ke satu subscription
     */
    public function sendNotification(PushSubscription $sub, array $payload): bool
    {
        $endpoint = $sub->endpoint;
        if (empty($endpoint)) {
            return false;
        }

        $formattedPayload = json_encode([
            'title' => $payload['title'] ?? 'Pemberitahuan Pesantren Qomaruddin',
            'body' => $payload['body'] ?? 'Ada informasi terbaru untuk Anda.',
            'icon' => $payload['icon'] ?? config('webpush.default_icon', '/logo-qomaruddin.png'),
            'badge' => $payload['badge'] ?? config('webpush.default_badge', '/logo-qomaruddin.png'),
            'url' => $payload['url'] ?? '/',
            'tag' => $payload['tag'] ?? 'qomaruddin-' . time(),
            'timestamp' => time() * 1000,
        ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

        try {
            // Sederhana dan kompatibel: Kirim payload via Web Push protocol
            // Jika Push Service Google/Chrome, kirim headers standar
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
