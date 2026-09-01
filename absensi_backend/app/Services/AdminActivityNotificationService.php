<?php

namespace App\Services;

use App\Models\AppNotification;
use App\Models\User;
use Illuminate\Support\Facades\Schema;
use Throwable;

class AdminActivityNotificationService
{
    /**
     * Kirim notifikasi cerdas kepada admin berdasarkan wewenang & tugasnya
     */
    public function notifyAdmins(
        string $title,
        string $message,
        string $type,
        array $data = [],
    ): void {
        try {
            if (!Schema::hasTable('notifications')) {
                return;
            }

            $admins = User::query()
                ->where('role', 'admin')
                ->where('status', 'Aktif')
                ->get();

            $isFinanceType = str_contains($type, 'pembayaran')
                || str_contains($type, 'keuangan')
                || str_contains($type, 'transaksi')
                || str_contains($type, 'pengeluaran')
                || str_contains($type, 'kas');

            $isAttendanceType = str_contains($type, 'absensi')
                || str_contains($type, 'kbm')
                || str_contains($type, 'guru_terlambat')
                || str_contains($type, 'sholat')
                || str_contains($type, 'ngaji');

            foreach ($admins as $admin) {
                $adminType = strtolower(trim((string) ($admin->admin_type ?? 'utama')));
                
                // 1. Admin Utama (Syauqillah & Fahmi) -> Selalu menerima SEMUA notifikasi
                $isMainAdmin = empty($adminType) || in_array($adminType, ['utama', 'it', 'pengurus', 'superadmin', 'admin'], true);

                // 2. Admin Bendahara (Mas Wildan & Mas Udin) -> Hanya menerima notifikasi Keuangan & Kas
                $isTreasurer = in_array($adminType, ['bendahara', 'keuangan', 'bendahara_1', 'bendahara_2', 'kasir'], true);

                // 3. Kepala Sekolah (Bapak Erwin) -> Hanya menerima notifikasi Absensi & KBM
                $isKepalaSekolah = in_array($adminType, ['madrasah', 'absensi', 'kepala_madrasah', 'kepala_sekolah', 'monitoring', 'kepala'], true);

                $shouldReceive = false;

                if ($isMainAdmin) {
                    $shouldReceive = true;
                } elseif ($isTreasurer && $isFinanceType) {
                    $shouldReceive = true;
                } elseif ($isKepalaSekolah && $isAttendanceType) {
                    $shouldReceive = true;
                } elseif (!$isFinanceType && !$isAttendanceType) {
                    // Notifikasi umum / broadcast
                    $shouldReceive = true;
                }

                if ($shouldReceive) {
                    AppNotification::query()->create([
                        'user_id' => $admin->id,
                        'title' => $title,
                        'message' => $message,
                        'type' => $type,
                        'data' => $data,
                    ]);
                }
            }
        } catch (Throwable $exception) {
            report($exception);
        }
    }
}

