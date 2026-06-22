<?php

namespace App\Jobs;

use App\Models\WhatsAppMessageLog;
use App\Services\WhatsAppBotService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class SendWhatsAppMessageJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public function __construct(private readonly int $messageLogId)
    {
    }

    public function handle(WhatsAppBotService $bot): void
    {
        $log = WhatsAppMessageLog::query()->find($this->messageLogId);
        if (!$log || in_array($log->status, ['sent', 'cancelled'], true)) {
            return;
        }

        if (!$bot->configured()) {
            $this->markFailed($log, 'Konfigurasi WhatsApp Bot belum lengkap.');
            return;
        }

        if (!$log->phone_number || !$log->message) {
            $this->markFailed($log, 'Nomor atau isi pesan kosong.');
            return;
        }

        $log->forceFill([
            'status' => $log->retry_count > 0 ? 'retrying' : 'processing',
            'error_message' => null,
        ])->save();

        $response = $bot->send($log->phone_number, $log->message);
        if ($response['success'] ?? false) {
            $log->forceFill([
                'status' => 'sent',
                'sent_at' => now(),
                'error_message' => null,
                'metadata' => array_merge($log->metadata ?? [], ['last_response' => $response]),
            ])->save();
            return;
        }

        $retryCount = $log->retry_count + 1;
        $shouldRetry = $retryCount < $log->retry_limit;
        $log->forceFill([
            'status' => $shouldRetry ? 'pending' : 'failed',
            'retry_count' => $retryCount,
            'error_message' => $response['message'] ?? 'Gagal mengirim pesan WhatsApp.',
            'metadata' => array_merge($log->metadata ?? [], ['last_response' => $response]),
        ])->save();

        if ($shouldRetry) {
            $this->release(60);
        }
    }

    private function markFailed(WhatsAppMessageLog $log, string $message): void
    {
        $log->forceFill([
            'status' => 'failed',
            'error_message' => $message,
        ])->save();
    }
}
