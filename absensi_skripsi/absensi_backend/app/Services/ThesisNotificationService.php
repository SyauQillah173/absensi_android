<?php

namespace App\Services;

use App\Models\DetailPresensi;
use App\Models\WhatsAppMessageLog;
use Carbon\Carbon;

class ThesisNotificationService
{
    public function queue(DetailPresensi $detail): ?WhatsAppMessageLog
    {
        if (!in_array($detail->status_presensi, ['Hadir', 'Sakit', 'Izin', 'Alpa'], true)) {
            return null;
        }

        $detail->loadMissing('santri', 'presensi.kelas');
        $santri = $detail->santri;
        $phone = $this->normalize($santri->nomor_wa_wali);
        $tanggal = $this->formatTanggal($detail->presensi?->tanggal);
        $status = $detail->status_presensi === 'Hadir' ? 'Masuk' : $detail->status_presensi;
        $nisn = $santri->nisn ?: '-';
        $message = "[Madrasah Diniyah]\n"
            ."Yth. Wali dari {$santri->nama_santri} ({$nisn})\n"
            ."Pada hari ini ({$tanggal}) Ananda {$status}.\n\n"
            ."Yth. Bapak/Ibu Wali Murid,\n"
            ."Beberapa hari ini terjadi kendala pada nomor telepon sekolah sehingga notifikasi absensi siswa belum dapat terkirim.\n\n"
            ."Kami mohon maaf atas ketidaknyamanan ini. Perbaikan sedang dilakukan agar layanan dapat segera kembali normal.\n\n"
            ."Terima kasih atas pengertian dan kerja samanya.";

        $log = WhatsAppMessageLog::updateOrCreate([
            'id_detail_presensi' => $detail->id_detail_presensi,
        ], [
            'nomor_tujuan' => $phone ?: $santri->nomor_wa_wali,
            'pesan' => $message,
            'status' => $phone ? 'pending' : 'failed',
            'error_message' => $phone ? null : 'Nomor WhatsApp wali tidak valid.',
            'message_id' => null,
            'retry_count' => 0,
            'next_retry_at' => null,
            'sent_at' => null,
        ]);

        if ($phone) {
            $this->sendNow($log);
        }

        return $log;
    }

    public function retry(WhatsAppMessageLog $log): void
    {
        $log->update(['status' => 'pending', 'error_message' => null, 'next_retry_at' => null]);
        $this->sendNow($log);
    }

    private function sendNow(WhatsAppMessageLog $log): void
    {
        $bot = app(WhatsAppBotService::class);
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
        if ($response['success'] ?? false) {
            $log->update([
                'status' => 'sent',
                'message_id' => data_get($response, 'data.message_id'),
                'sent_at' => now(),
                'next_retry_at' => null,
                'error_message' => null,
            ]);
            return;
        }

        $log->update([
            'status' => 'retrying',
            'retry_count' => $log->retry_count + 1,
            'next_retry_at' => now()->addMinute(),
            'error_message' => $response['message'] ?? 'WhatsApp Bot tidak merespons.',
        ]);
    }

    private function normalize(?string $phone): ?string
    {
        $phone = preg_replace('/\D+/', '', (string) $phone);
        if (str_starts_with($phone, '0')) {
            $phone = '62'.substr($phone, 1);
        }

        return preg_match('/^62[0-9]{9,14}$/', $phone) ? $phone : null;
    }

    private function formatTanggal($date): string
    {
        if (!$date) {
            return now()->locale('id')->translatedFormat('l, d F Y');
        }

        return Carbon::parse($date)->locale('id')->translatedFormat('l, d F Y');
    }
}
