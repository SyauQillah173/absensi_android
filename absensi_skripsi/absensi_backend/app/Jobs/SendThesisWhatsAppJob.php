<?php

namespace App\Jobs;

use App\Models\WhatsAppMessageLog;
use App\Services\WhatsAppBotService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class SendThesisWhatsAppJob implements ShouldQueue
{
    use Queueable;

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

        $response = $bot->send($log->nomor_tujuan, $log->pesan);
        if (!($response['success'] ?? false)) {
            $log->update([
                'status' => 'retrying',
                'retry_count' => $log->retry_count + 1,
                'next_retry_at' => now()->addSeconds($this->backoff()[min($this->attempts() - 1, 2)]),
                'error_message' => $response['message'] ?? 'WhatsApp Bot tidak merespons.',
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
}
