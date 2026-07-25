<?php

namespace App\Services;

use App\Jobs\SendThesisWhatsAppJob;
use App\Models\DetailPresensi;
use App\Models\WhatsAppMessageLog;
use Carbon\Carbon;

class ThesisNotificationService
{
    public function queue(DetailPresensi $detail): ?WhatsAppMessageLog
    {
        $detail->loadMissing('santri', 'presensi.kelas', 'presensi.mapelRef');
        $santri = $detail->santri;
        $phone = $this->normalize($santri->nomor_wa_wali);
        $tanggal = $this->formatTanggal($detail->presensi?->tanggal);
        $status = $detail->status_presensi;
        $nisn = $santri->nisn ?: '-';
        $kelas = $detail->presensi?->kelas?->nama_kelas ?: '-';
        $mapel = $detail->presensi?->mapelRef?->nama ?: ($detail->presensi?->mapel ?: '-');
        $keterangan = trim((string) $detail->keterangan);
        $keteranganLine = $keterangan === ''
            ? ''
            : "\nKeterangan: {$keterangan}";
        $message = "[Madrasah Diniyah]\n"
            ."Yth. Wali dari {$santri->nama_santri} ({$nisn})\n"
            ."Status kehadiran Ananda pada hari ini ({$tanggal}) adalah\n"
            ."{$status}{$keteranganLine}\n\n"
            ."Kelas: {$kelas}\n"
            ."Mata Pelajaran: {$mapel}\n"
            ."\n"
            ."Terimakasih.";

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
            if (config('queue.default') !== 'sync' || config('services.whatsapp_bot.dispatch_when_sync_queue')) {
                SendThesisWhatsAppJob::dispatch($log->id);
            }
        }

        return $log;
    }

    public function retry(WhatsAppMessageLog $log): void
    {
        $log->update(['status' => 'pending', 'error_message' => null, 'next_retry_at' => null]);
        if (config('queue.default') !== 'sync' || config('services.whatsapp_bot.dispatch_when_sync_queue')) {
            SendThesisWhatsAppJob::dispatch($log->id);
        }
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
