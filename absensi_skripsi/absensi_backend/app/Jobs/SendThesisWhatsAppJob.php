<?php

namespace App\Jobs;

use App\Models\WhatsAppMessageLog;
use App\Services\WhatsAppBotService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class SendThesisWhatsAppJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public int $tries = 3;

    public function __construct(public int $logId)
    {
    }

    public function backoff(): array
    {
        return [60, 300, 900];
    }

    public function handle(WhatsAppBotService $bot): void
    {
        $log = WhatsAppMessageLog::find($this->logId);
        if (!$log || $log->status === 'sent') {
            return;
        }

        if (!$bot->configured()) {
            $log->update([
                'status' => 'failed',
                'error_message' => 'Konfigurasi WhatsApp Bot belum lengkap.',
            ]);
            return;
        }

        $log->update([
            'status' => 'processing',
            'error_message' => null,
        ]);

        $response = $bot->send($log->nomor_tujuan, $log->pesan);
        if (!($response['success'] ?? false)) {
            $message = $response['message'] ?? 'WhatsApp Bot tidak merespons.';
            if ($this->isPermanentFailure($message, (int) ($response['status'] ?? 0))) {
                $log->update([
                    'status' => 'failed',
                    'error_message' => $message,
                    'next_retry_at' => null,
                ]);
                return;
            }

            $log->update([
                'status' => 'retrying',
                'retry_count' => $log->retry_count + 1,
                'next_retry_at' => now()->addSeconds($this->backoff()[min($this->attempts() - 1, 2)]),
                'error_message' => $message,
            ]);
            throw new \RuntimeException($log->error_message);
        }

        $log->update([
            'status' => 'sent',
            'message_id' => data_get($response, 'data.message_id'),
            'sent_at' => now(),
            'next_retry_at' => null,
            'error_message' => null,
        ]);
    }

    private function isPermanentFailure(string $message, int $status): bool
    {
        $text = strtolower($message);

        return in_array($status, [400, 404, 422], true)
            || str_contains($text, 'no lid')
            || str_contains($text, 'not registered')
            || str_contains($text, 'tidak terdaftar')
            || str_contains($text, 'nomor tidak valid')
            || str_contains($text, 'panjang nomor tidak valid');
    }
}
