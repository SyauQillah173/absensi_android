<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PushSubscription;
use App\Services\WebPushService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PushNotificationController extends Controller
{
    public function __construct(
        protected WebPushService $webPushService
    ) {}

    /**
     * Dapatkan Public Key VAPID untuk registrasi di frontend browser
     */
    public function getVapidPublicKey(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'publicKey' => $this->webPushService->getPublicKey(),
        ]);
    }

    /**
     * Simpan / daftarkan langganan notifikasi browser pengguna
     */
    public function subscribe(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'endpoint' => 'required|string',
            'p256dh' => 'nullable|string',
            'auth' => 'nullable|string',
            'user_id' => 'nullable|integer',
            'role' => 'nullable|string|max:30',
            'device_info' => 'nullable|string',
        ]);

        $user = $request->user();
        $userId = $user?->id ?? $validated['user_id'] ?? null;
        $role = $user?->role ?? $validated['role'] ?? null;

        $subscription = PushSubscription::updateOrCreate(
            ['endpoint' => $validated['endpoint']],
            [
                'user_id' => $userId,
                'p256dh' => $validated['p256dh'] ?? '',
                'auth' => $validated['auth'] ?? '',
                'role' => $role,
                'device_info' => $validated['device_info'] ?? $request->userAgent(),
                'last_used_at' => now(),
            ]
        );

        return response()->json([
            'success' => true,
            'message' => 'Perangkat Anda berhasil didaftarkan untuk menerima notifikasi real-time.',
            'data' => $subscription,
        ]);
    }

    /**
     * Hapus langganan notifikasi jika dinonaktifkan
     */
    public function unsubscribe(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'endpoint' => 'required|string',
        ]);

        PushSubscription::where('endpoint', $validated['endpoint'])->delete();

        return response()->json([
            'success' => true,
            'message' => 'Langganan notifikasi berhasil dihapus.',
        ]);
    }

    /**
     * Uji coba kirim notifikasi real-time ke perangkat yang sedang aktif
     */
    public function sendTest(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'endpoint' => 'nullable|string',
            'title' => 'nullable|string',
            'body' => 'nullable|string',
            'url' => 'nullable|string',
        ]);

        $title = $validated['title'] ?? 'Uji Notifikasi Qomaruddin 🔔';
        $body = $validated['body'] ?? 'Alhamdulillah, sistem notifikasi real-time Pondok Qomaruddin berhasil terhubung ke HP Anda!';
        $url = $validated['url'] ?? '/';

        $user = $request->user();

        if (!empty($validated['endpoint'])) {
            $sub = PushSubscription::where('endpoint', $validated['endpoint'])->first();
            if ($sub) {
                $sent = $this->webPushService->sendNotification($sub, [
                    'title' => $title,
                    'body' => $body,
                    'url' => $url,
                ]);
                return response()->json([
                    'success' => $sent,
                    'message' => $sent ? 'Notifikasi uji berhasil dikirim ke perangkat Anda.' : 'Gagal mengirim notifikasi.',
                ]);
            }
        }

        if ($user) {
            $count = $this->webPushService->notifyUser($user->id, $title, $body, $url);
            return response()->json([
                'success' => $count > 0,
                'message' => "Notifikasi terkirim ke {$count} perangkat Anda.",
            ]);
        }

        return response()->json([
            'success' => false,
            'message' => 'Tidak ditemukan perangkat langganan untuk dikirim.',
        ], 404);
    }
}
