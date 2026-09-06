<?php

namespace App\Services;

use App\Models\AppNotification;
use App\Models\PaymentBill;
use App\Models\PaymentTransaction;
use App\Models\Siswa;
use Illuminate\Support\Facades\Log;

class AppPushNotificationService
{
    public function __construct(
        protected WebPushService $webPushService
    ) {}

    /**
     * Dapatkan daftar ID User Wali yang terhubung dengan santri
     */
    protected function getWaliUserIds(Siswa $student): array
    {
        $student->loadMissing(['guardianProfile']);

        return collect([
            $student->wali_id,
            $student->guardianProfile?->user_id,
        ])->filter()->unique()->values()->all();
    }

    /**
     * Kirim notifikasi Presensi Madin ke HP Wali
     */
    public function notifyAbsensiMadin($row): void
    {
        try {
            $row->loadMissing(['siswa.guardianProfile']);
            $student = $row->siswa;
            if (!$student) {
                return;
            }

            $waliUserIds = $this->getWaliUserIds($student);
            if (empty($waliUserIds)) {
                return;
            }

            $studentName = $student->nama ?? 'Santri';
            $status = $row->status ?? '-';
            $tanggal = optional($row->tanggal)->format('d/m/Y') ?? (string) $row->tanggal;

            $title = "Presensi Madin: {$studentName}";
            $body = "{$studentName} tercatat {$status} pada KBM Madin ({$tanggal}). Ketuk untuk membuka riwayat.";
            $url = "/wali";

            foreach ($waliUserIds as $userId) {
                // 1. Simpan in-app notification (lonceng)
                AppNotification::query()->create([
                    'user_id' => $userId,
                    'title' => $title,
                    'message' => $body,
                    'type' => 'absensi_madin',
                    'data' => [
                        'siswa_id' => $student->id,
                        'absensi_id' => $row->id,
                        'status' => $status,
                        'tanggal' => $tanggal,
                        'url' => $url,
                    ],
                ]);

                // 2. Tembakkan Web Push ke Status Bar HP Android
                $this->webPushService->notifyUser($userId, $title, $body, $url, [
                    'tag' => "absensi-madin-{$row->id}",
                ]);
            }
        } catch (\Throwable $e) {
            Log::error("[AppPush] Gagal mengirim notif absensi madin: " . $e->getMessage());
        }
    }

    /**
     * Kirim notifikasi Presensi Sholat ke HP Wali
     */
    public function notifyAbsensiSholat(array $attendance, Siswa $student): void
    {
        try {
            $waliUserIds = $this->getWaliUserIds($student);
            if (empty($waliUserIds)) {
                return;
            }

            $studentName = $student->nama ?? 'Santri';
            $status = $attendance['status_label'] ?? $attendance['status_code'] ?? $attendance['status'] ?? '-';
            $jenisSholat = $attendance['jenis_sholat'] ?? 'Jamaah Sholat';
            $tanggal = $attendance['tanggal'] ?? date('d/m/Y');

            $title = "Presensi Sholat: {$studentName}";
            $body = "{$studentName} tercatat {$status} pada {$jenisSholat} ({$tanggal}). Ketuk untuk melihat riwayat.";
            $url = "/wali";

            foreach ($waliUserIds as $userId) {
                AppNotification::query()->create([
                    'user_id' => $userId,
                    'title' => $title,
                    'message' => $body,
                    'type' => 'absensi_sholat',
                    'data' => [
                        'siswa_id' => $student->id,
                        'status' => $status,
                        'jenis_sholat' => $jenisSholat,
                        'tanggal' => $tanggal,
                        'url' => $url,
                    ],
                ]);

                $this->webPushService->notifyUser($userId, $title, $body, $url, [
                    'tag' => "absensi-sholat-" . ($attendance['id'] ?? time()),
                ]);
            }
        } catch (\Throwable $e) {
            Log::error("[AppPush] Gagal mengirim notif absensi sholat: " . $e->getMessage());
        }
    }

    /**
     * Kirim notifikasi Presensi Ngaji ke HP Wali
     */
    public function notifyAbsensiNgaji(array $attendance, Siswa $student): void
    {
        try {
            $waliUserIds = $this->getWaliUserIds($student);
            if (empty($waliUserIds)) {
                return;
            }

            $studentName = $student->nama ?? 'Santri';
            $status = $attendance['status_label'] ?? $attendance['status_code'] ?? $attendance['status'] ?? '-';
            $kitab = $attendance['kitab'] ?? 'KBM Kitab';
            $sesi = $attendance['sesi'] ?? '';
            $tanggal = $attendance['tanggal'] ?? date('d/m/Y');

            $title = "Presensi Ngaji: {$studentName}";
            $body = "{$studentName} tercatat {$status} pada {$kitab} " . ($sesi ? "({$sesi})" : "") . " ({$tanggal}). Ketuk untuk melihat riwayat.";
            $url = "/wali";

            foreach ($waliUserIds as $userId) {
                AppNotification::query()->create([
                    'user_id' => $userId,
                    'title' => $title,
                    'message' => $body,
                    'type' => 'absensi_ngaji',
                    'data' => [
                        'siswa_id' => $student->id,
                        'status' => $status,
                        'kitab' => $kitab,
                        'sesi' => $sesi,
                        'tanggal' => $tanggal,
                        'url' => $url,
                    ],
                ]);

                $this->webPushService->notifyUser($userId, $title, $body, $url, [
                    'tag' => "absensi-ngaji-" . ($attendance['id'] ?? time()),
                ]);
            }
        } catch (\Throwable $e) {
            Log::error("[AppPush] Gagal mengirim notif absensi ngaji: " . $e->getMessage());
        }
    }

    /**
     * Kirim notifikasi Pembayaran Berhasil ke HP Wali
     */
    public function notifyPaymentTransaction(PaymentTransaction $transaction): void
    {
        try {
            $transaction->loadMissing(['siswa.guardianProfile', 'items.paymentType', 'bills.paymentType']);
            $student = $transaction->siswa;
            if (!$student) {
                return;
            }

            $waliUserIds = $this->getWaliUserIds($student);
            if (empty($waliUserIds)) {
                return;
            }

            $studentName = $student->nama ?? 'Santri';
            $nominal = number_format((float) ($transaction->nominal ?? $transaction->total_amount ?? 0), 0, ',', '.');
            $items = $transaction->items;
            $titlePayment = $items->pluck('paymentType.nama')->filter()->join(', ')
                ?: $transaction->bills->pluck('title')->filter()->join(', ')
                ?: 'Pembayaran Tagihan';

            $title = "Pembayaran Diterima: {$studentName}";
            $body = "Alhamdulillah, pembayaran {$titlePayment} sebesar Rp {$nominal} telah berhasil diverifikasi. Ketuk untuk melihat kuitansi.";
            $url = "/wali";

            foreach ($waliUserIds as $userId) {
                AppNotification::query()->create([
                    'user_id' => $userId,
                    'title' => $title,
                    'message' => $body,
                    'type' => 'pembayaran',
                    'data' => [
                        'siswa_id' => $student->id,
                        'transaction_id' => $transaction->id,
                        'nominal' => $nominal,
                        'url' => $url,
                    ],
                ]);

                $this->webPushService->notifyUser($userId, $title, $body, $url, [
                    'tag' => "pembayaran-{$transaction->id}",
                ]);
            }
        } catch (\Throwable $e) {
            Log::error("[AppPush] Gagal mengirim notif transaksi pembayaran: " . $e->getMessage());
        }
    }

    /**
     * Kirim notifikasi Tagihan Baru ke HP Wali
     */
    public function notifyPaymentBill(PaymentBill $bill): void
    {
        try {
            $bill->loadMissing(['siswa.guardianProfile', 'paymentType']);
            $student = $bill->siswa;
            if (!$student) {
                return;
            }

            $waliUserIds = $this->getWaliUserIds($student);
            if (empty($waliUserIds)) {
                return;
            }

            $studentName = $student->nama ?? 'Santri';
            $nominal = number_format((float) ($bill->amount ?? 0), 0, ',', '.');
            $titleBill = $bill->title ?: $bill->paymentType?->nama ?: 'Tagihan Santri';
            $tempo = $bill->due_date ? $bill->due_date->format('d/m/Y') : '-';

            $title = "Tagihan Baru: {$studentName}";
            $body = "Tagihan {$titleBill} sebesar Rp {$nominal} telah diterbitkan. Jatuh tempo: {$tempo}. Ketuk untuk rincian.";
            $url = "/wali";

            foreach ($waliUserIds as $userId) {
                AppNotification::query()->create([
                    'user_id' => $userId,
                    'title' => $title,
                    'message' => $body,
                    'type' => 'tagihan',
                    'data' => [
                        'siswa_id' => $student->id,
                        'bill_id' => $bill->id,
                        'nominal' => $nominal,
                        'tempo' => $tempo,
                        'url' => $url,
                    ],
                ]);

                $this->webPushService->notifyUser($userId, $title, $body, $url, [
                    'tag' => "tagihan-{$bill->id}",
                ]);
            }
        } catch (\Throwable $e) {
            Log::error("[AppPush] Gagal mengirim notif tagihan baru: " . $e->getMessage());
        }
    }
}
