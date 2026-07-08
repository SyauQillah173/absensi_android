<?php

namespace App\Services;

use App\Models\WhatsAppSession;
use Illuminate\Support\Facades\Http;

class WhatsAppBotService
{
    public function configured(): bool
    {
        return filled(config('services.whatsapp_bot.base_url')) && filled(config('services.whatsapp_bot.secret'));
    }

    public function health(): array
    {
        return $this->request('get', '/health', auth: false);
    }

    public function sessions(): array
    {
        return $this->request('get', '/sessions');
    }

    public function createSession(string $clientId, ?string $clientName = null): array
    {
        return $this->request('post', '/sessions/add', [
            'id' => $clientId,
            'nama' => $clientName ?: $clientId,
        ]);
    }

    public function deleteSession(string $clientId): array
    {
        return $this->request('post', '/sessions/delete', ['id' => $clientId]);
    }

    public function reconnectSession(string $clientId): array
    {
        return $this->request('post', '/sessions/reconnect', ['id' => $clientId]);
    }

    public function send(string $number, string $message, ?string $clientId = null): array
    {
        return $this->request('post', '/kirim', array_filter([
            'nomor' => $number,
            'pesan' => $message,
            'client_id' => $clientId,
        ], fn ($value) => $value !== null && $value !== ''));
    }

    public function logs(int $limit = 50): array
    {
        return $this->request('get', '/log?n=' . max(1, min($limit, 200)));
    }

    public function syncSessions(): array
    {
        $response = $this->sessions();
        $sessions = data_get($response, 'data.sessions', data_get($response, 'data', []));
        if (!is_array($sessions)) {
            return [];
        }

        return collect($sessions)->map(function (array $session) {
            $status = $session['status'] ?? 'unknown';
            return WhatsAppSession::query()->updateOrCreate(
                ['client_id' => (string) ($session['id'] ?? $session['client_id'] ?? 'default')],
                [
                    'client_name' => $session['nama'] ?? $session['name'] ?? null,
                    'phone_number' => $session['nomor'] ?? $session['phone_number'] ?? null,
                    'status' => $status,
                    'qr_code' => $session['qr_code'] ?? $session['qr'] ?? null,
                    'last_connected_at' => in_array($status, ['aktif', 'ready', 'connected'], true) ? now() : null,
                    'last_disconnected_at' => in_array($status, ['offline', 'disconnected', 'gagal'], true) ? now() : null,
                    'metadata' => $session,
                ]
            );
        })->values()->all();
    }

    private function request(string $method, string $path, array $payload = [], bool $auth = true): array
    {
        if (!$this->configured() && $auth) {
            return [
                'success' => false,
                'message' => 'Konfigurasi WhatsApp Bot belum lengkap.',
                'data' => null,
            ];
        }

        $baseUrl = rtrim((string) config('services.whatsapp_bot.base_url'), '/');
        if (preg_match('/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/i', $baseUrl)) {
            $baseUrl = 'https://absensiandroid-production.up.railway.app';
        }
        $headers = [];
        if ($auth) {
            $headers['x-bot-secret'] = (string) config('services.whatsapp_bot.secret');
        }

        try {
            $pending = Http::timeout((int) config('services.whatsapp_bot.timeout', 12))
                ->acceptJson()
                ->withHeaders($headers);
            $url = $baseUrl . '/' . ltrim($path, '/');
            $response = $method === 'get'
                ? $pending->get($url)
                : $pending->post($url, $payload);

            $json = $response->json();
            if (!is_array($json)) {
                $json = ['message' => $response->body()];
            }

            return [
                'success' => (bool) ($json['success'] ?? $json['sukses'] ?? $response->successful()),
                'message' => $json['message'] ?? $json['pesan'] ?? null,
                'data' => $json['data'] ?? $json,
                'status' => $response->status(),
            ];
        } catch (\Throwable $e) {
            return [
                'success' => false,
                'message' => $e->getMessage(),
                'data' => null,
            ];
        }
    }
}
