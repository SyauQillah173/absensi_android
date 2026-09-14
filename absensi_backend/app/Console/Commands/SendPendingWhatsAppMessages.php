<?php

namespace App\Console\Commands;

use App\Models\WhatsAppMessageLog;
use App\Services\WhatsAppBotService;
use Illuminate\Console\Command;

class SendPendingWhatsAppMessages extends Command
{
    protected $signature = 'whatsapp:send-pending {--limit=50 : Maksimum pesan yang diproses}';
    protected $description = 'Kirim seluruh antrian pesan WhatsApp yang masih berstatus pending/retrying';

    public function handle(WhatsAppBotService $bot): int
    {
        $this->info('Memeriksa konfigurasi WhatsApp Bot...');

        if (!$bot->configured()) {
            $this->error('Konfigurasi WhatsApp Bot belum lengkap (base_url atau secret kosong).');
            return 1;
        }

        $limit = (int) $this->option('limit');
        $logs = WhatsAppMessageLog::query()
            ->whereIn('status', ['pending', 'retrying'])
            ->orderBy('id')
            ->limit($limit)
            ->get();

        if ($logs->isEmpty()) {
            $this->info('Tidak ada antrian pesan pending. Semua sudah terkirim.');
            return 0;
        }

        $this->info("Ditemukan {$logs->count()} pesan dalam antrian. Memulai pengiriman...");

        $successCount = 0;
        $failCount = 0;

        foreach ($logs as $log) {
            $this->line("Mengirim pesan #{$log->id} ke {$log->phone_number}...");

            $log->forceFill([
                'status' => 'processing',
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

                $this->info("✓ Pesan #{$log->id} BERHASIL dikirim ke {$log->phone_number}");
                $successCount++;
            } else {
                $errMsg = $response['message'] ?? 'Gagal mengirim pesan WhatsApp.';
                $log->forceFill([
                    'status' => 'failed',
                    'error_message' => $errMsg,
                    'retry_count' => $log->retry_count + 1,
                    'metadata' => array_merge($log->metadata ?? [], ['last_response' => $response]),
                ])->save();

                $this->error("✗ Pesan #{$log->id} GAGAL: {$errMsg}");
                $failCount++;
            }
        }

        $this->info("Selesai! Berhasil: {$successCount}, Gagal: {$failCount}.");
        return 0;
    }
}
