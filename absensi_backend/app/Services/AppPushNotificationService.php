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

        $ids = collect([
            $student->wali_id,
            $student->guardianProfile?->user_id,
        ])->filter()->unique()->values()->all();

        // Tambahkan akun yang terhubung via NIS santri jika ada
        if (!empty($student->nis)) {
            $matchedUser = \App\Models\User::where('nis', $student->nis)->first();
            if ($matchedUser && !in_array($matchedUser->id, $ids)) {
                $ids[] = $matchedUser->id;
            }
        }

        if (empty($ids)) {
            // Coba temukan user wali dari nomor handphone atau NIS
            $phone = $student->wali_hp ?: $student->no_hp_wali ?: $student->guardianProfile?->phone;
            if ($phone) {
                $cleaned = preg_replace('/[^0-9]/', '', $phone);
                $tail = strlen($cleaned) >= 8 ? substr($cleaned, -8) : $cleaned;
                $user = \App\Models\User::where('role', 'wali')
                    ->where(function ($q) use ($phone, $tail) {
                        $q->where('no_hp', $phone)
                          ->orWhere('no_hp', 'like', "%{$tail}%");
                    })->first();
                if ($user) {
                    $ids[] = $user->id;
                }
            }
        }

        return array_values(array_unique($ids));
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

                $unreadCount = AppNotification::where('user_id', $userId)->where('is_read', false)->count();

                // 2. Tembakkan Web Push ke Status Bar HP Android
                $this->webPushService->notifyUser($userId, $title, $body, $url, [
                    'tag' => "absensi-madin-{$row->id}",
                    'badge_count' => max(1, $unreadCount),
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

                $unreadCount = AppNotification::where('user_id', $userId)->where('is_read', false)->count();

                $this->webPushService->notifyUser($userId, $title, $body, $url, [
                    'tag' => "absensi-sholat-" . ($attendance['id'] ?? time()),
                    'badge_count' => max(1, $unreadCount),
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

                $unreadCount = AppNotification::where('user_id', $userId)->where('is_read', false)->count();

                $this->webPushService->notifyUser($userId, $title, $body, $url, [
                    'tag' => "absensi-ngaji-" . ($attendance['id'] ?? time()),
                    'badge_count' => max(1, $unreadCount),
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
            if ($transaction->wali_id && !in_array((int) $transaction->wali_id, $waliUserIds)) {
                $waliUserIds[] = (int) $transaction->wali_id;
            }
            if (empty($waliUserIds)) {
                return;
            }

            $studentName = $student->nama ?? 'Santri';
            $nominal = number_format((float) ($transaction->jumlah_total ?? $transaction->nominal ?? $transaction->total_amount ?? 0), 0, ',', '.');
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

                $unreadCount = AppNotification::where('user_id', $userId)->where('is_read', false)->count();

                $this->webPushService->notifyUser($userId, $title, $body, $url, [
                    'tag' => "pembayaran-{$transaction->id}",
                    'badge_count' => max(1, $unreadCount),
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

                $unreadCount = AppNotification::where('user_id', $userId)->where('is_read', false)->count();

                $this->webPushService->notifyUser($userId, $title, $body, $url, [
                    'tag' => "tagihan-{$bill->id}",
                    'badge_count' => max(1, $unreadCount),
                ]);
            }
        } catch (\Throwable $e) {
            Log::error("[AppPush] Gagal mengirim notif tagihan baru: " . $e->getMessage());
        }
    }
}
