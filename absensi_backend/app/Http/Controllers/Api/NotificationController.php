<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Absensi;
use App\Models\AppNotification;
use App\Models\Jadwal;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['success' => false, 'message' => 'Unauthenticated'], 401);
        }

        // Khusus Guru: Sinkronisasi pengingat jadwal KBM aktif & tenggat waktu
        if ($user->role === 'guru') {
            $this->syncTeacherNotifications($user);
        }

        $notifications = AppNotification::query()
            ->where('user_id', $user->id)
            ->orderByDesc('created_at')
            ->limit((int) $request->input('limit', 50))
            ->get();

        return response()->json([
            'success' => true,
            'unread_count' => $notifications->where('is_read', false)->count(),
            'data' => $notifications,
        ]);
    }

    public function markRead(Request $request, AppNotification $notification)
    {
        $user = $request->user();
        if ((int) $notification->user_id !== (int) $user?->id && $user?->role !== 'admin') {
            return response()->json([
                'success' => false,
                'message' => 'Notifikasi tidak ditemukan untuk akun ini',
            ], 404);
        }

        $notification->update([
            'is_read' => true,
            'read_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'data' => $notification->fresh(),
        ]);
    }

    public function markAllRead(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['success' => false, 'message' => 'Unauthenticated'], 401);
        }

        AppNotification::query()
            ->where('user_id', $user->id)
            ->where('is_read', false)
            ->update([
                'is_read' => true,
                'read_at' => now(),
            ]);

        return response()->json([
            'success' => true,
            'message' => 'Semua notifikasi berhasil ditandai telah dibaca',
        ]);
    }

    public function destroy(Request $request, AppNotification $notification)
    {
        $user = $request->user();
        if ((int) $notification->user_id !== (int) $user?->id && $user?->role !== 'admin') {
            return response()->json([
                'success' => false,
                'message' => 'Notifikasi tidak ditemukan',
            ], 404);
        }

        $notification->delete();

        return response()->json([
            'success' => true,
            'message' => 'Notifikasi berhasil dihapus',
        ]);
    }

    /**
     * Otomatis sinkronisasi notifikasi pengingat jadwal KBM untuk Ustadz / Guru
     */
    private function syncTeacherNotifications(User $user): void
    {
        try {
            $now = Carbon::now('Asia/Jakarta');
            $todayIndo = match ((int) $now->format('w')) {
                0 => 'Minggu',
                1 => 'Senin',
                2 => 'Selasa',
                3 => 'Rabu',
                4 => 'Kamis',
                5 => 'Jumat',
                6 => 'Sabtu',
                default => 'Senin'
            };
            $todayDate = $now->toDateString();

            // Ambil jadwal mengajar guru untuk hari ini
            $schedules = Jadwal::with(['mapel', 'kelas'])
                ->where(function ($q) use ($user) {
                    $q->where('teacher_id', $user->id)
                      ->orWhere('guru', $user->name)
                      ->orWhere('guru', $user->username);
                })
                ->where('hari', $todayIndo)
                ->get();

            foreach ($schedules as $j) {
                $jamMulaiStr = substr($j->jam_mulai ?? '00:00', 0, 5);
                $jamSelesaiStr = substr($j->jam_selesai ?? '23:59', 0, 5);
                $mapelName = $j->mapel->nama ?? $j->mapel->name ?? 'Mata Pelajaran';
                $kelasName = $j->kelas->name ?? $j->kelas->nama ?? 'Kelas';

                // Cek apakah sudah diabsen hari ini
                $hasAttended = Absensi::where('jadwal_id', $j->id)
                    ->whereDate('tanggal', $todayDate)
                    ->exists();

                if ($hasAttended) {
                    continue;
                }

                $jamMulaiCarbon = Carbon::createFromFormat('Y-m-d H:i', "{$todayDate} {$jamMulaiStr}", 'Asia/Jakarta');
                $jamSelesaiCarbon = Carbon::createFromFormat('Y-m-d H:i', "{$todayDate} {$jamSelesaiStr}", 'Asia/Jakarta');
                $jamAktifMulai = (clone $jamMulaiCarbon)->subHour();

                // 1. Notifikasi Jadwal KBM Aktif (1 jam sebelum s/d jam selesai)
                if ($now->greaterThanOrEqualTo($jamAktifMulai) && $now->lessThanOrEqualTo($jamSelesaiCarbon)) {
                    $typeKey = "kbm_aktif_{$j->id}_{$todayDate}";
                    $exists = AppNotification::where('user_id', $user->id)
                        ->where('data->key', $typeKey)
                        ->exists();

                    if (!$exists) {
                        AppNotification::create([
                            'user_id' => $user->id,
                            'title' => "⏰ Jadwal KBM Aktif: {$mapelName}",
                            'message' => "Jadwal mengajar kelas {$kelasName} ({$jamMulaiStr} - {$jamSelesaiStr} WIB) sedang aktif. Silakan input presensi santri.",
                            'type' => 'jadwal_aktif',
                            'data' => ['key' => $typeKey, 'jadwal_id' => $j->id, 'page' => 'absensi', 'tab' => 'madin-input'],
                            'is_read' => false,
                        ]);
                    }
                }

                // 2. Notifikasi Peringatan Keterlambatan / Tenggat (Lewat jam selesai s/d 23:00)
                if ($now->greaterThan($jamSelesaiCarbon) && $now->hour < 23) {
                    $typeKey = "kbm_urgent_{$j->id}_{$todayDate}";
                    $exists = AppNotification::where('user_id', $user->id)
                        ->where('data->key', $typeKey)
                        ->exists();

                    if (!$exists) {
                        AppNotification::create([
                            'user_id' => $user->id,
                            'title' => "⚠️ Segera Isi Presensi: {$mapelName}",
                            'message' => "Jam KBM kelas {$kelasName} telah selesai namun presensi belum diisi. Batas waktu guru sampai pukul 23:00 WIB sebelum akses ditutup.",
                            'type' => 'peringatan_tenggat',
                            'data' => ['key' => $typeKey, 'jadwal_id' => $j->id, 'page' => 'absensi', 'tab' => 'madin-input'],
                            'is_read' => false,
                        ]);
                    }
                }
            }
        } catch (\Throwable $e) {
            report($e);
        }
    }
}

