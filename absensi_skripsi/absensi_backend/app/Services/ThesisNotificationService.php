<?php

namespace App\Services;

use App\Jobs\SendThesisWhatsAppJob;
use App\Models\DetailPresensi;
use App\Models\WhatsAppMessageLog;

class ThesisNotificationService
{
    public function queue(DetailPresensi $detail): ?WhatsAppMessageLog
    {
        if (!in_array($detail->status_presensi, ['Sakit', 'Izin', 'Alpa'], true)) {
            return null;
        }

        $detail->loadMissing('santri', 'presensi.kelas');
        $santri = $detail->santri;
        $phone = $this->normalize($santri->nomor_wa_wali);
        $message = "Assalamu'alaikum Bapak/Ibu {$santri->nama_wali}. "
            ."Kami informasikan bahwa {$santri->nama_santri} tercatat "
            ."{$detail->status_presensi} pada ".optional($detail->presensi->tanggal)->format('d-m-Y')
            ." di kelas {$detail->presensi->kelas->nama_kelas}."
            .($detail->keterangan ? " Keterangan: {$detail->keterangan}." : '');

        $log = WhatsAppMessageLog::create([
            'id_detail_presensi' => $detail->id_detail_presensi,
            'nomor_tujuan' => $phone ?: $santri->nomor_wa_wali,
            'pesan' => $message,
            'status' => $phone ? 'pending' : 'failed',
            'error_message' => $phone ? null : 'Nomor WhatsApp wali tidak valid.',
        ]);

        if ($phone) {
            SendThesisWhatsAppJob::dispatch($log->id)->afterResponse();
        }

        return $log;
    }

    public function retry(WhatsAppMessageLog $log): void
    {
        $log->update(['status' => 'pending', 'error_message' => null, 'next_retry_at' => null]);
        SendThesisWhatsAppJob::dispatch($log->id)->afterResponse();
    }

    private function normalize(?string $phone): ?string
    {
        $phone = preg_replace('/\D+/', '', (string) $phone);
        if (str_starts_with($phone, '0')) {
            $phone = '62'.substr($phone, 1);
        }

        return preg_match('/^62[0-9]{9,14}$/', $phone) ? $phone : null;
    }
}
