<?php

namespace App\Services;

use App\Models\Jadwal;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class GuruAttendanceStatusService
{
    public function todayLabel(?Carbon $now = null): string
    {
        $labels = [
            1 => 'Senin',
            2 => 'Selasa',
            3 => 'Rabu',
            4 => 'Kamis',
            5 => 'Jumat',
            6 => 'Sabtu',
            7 => 'Ahad',
        ];

        return $labels[(int) ($now ?? Carbon::now('Asia/Jakarta'))->isoWeekday()] ?? 'Senin';
    }

    public function resolve(Jadwal $jadwal, bool $hasAttendance = false, ?Carbon $now = null): array
    {
        $now = $now ?: Carbon::now('Asia/Jakarta');
        $scheduledDay = $this->scheduledDay($jadwal);
        $label = trim(($scheduledDay ?: 'hari sesuai jadwal') . ' ' . ($jadwal->jam_mulai ?: ''));

        if (($jadwal->status ?? 'Aktif') !== 'Aktif') {
            return $this->payload('locked', false, 'Jadwal sedang nonaktif.', $label);
        }

        if ($hasAttendance) {
            return $this->payload('completed', false, 'Presensi kelas ini sudah berhasil disimpan & terkunci.', $label);
        }

        $user = request()->user();
        $isAdmin = $user && $user->role === 'admin';

        // Admin can input attendance anytime without day/hour restriction
        if ($isAdmin) {
            return $this->payload('aktif', true, null, $label, false);
        }

        if ($scheduledDay && $scheduledDay !== $this->todayLabel($now)) {
            return $this->payload('locked', false, "Absensi belum dibuka. Jadwal hari {$label}.", $label);
        }

        // 1. Cek evaluasi jam buka & tutup dinamis dari CMS IT Control
        $itControlService = app(\App\Services\ItSystemControlService::class);
        $window = $itControlService->resolveWindowForJadwal($jadwal, $now);

        // Jika Admin IT mengaktifkan Buka Paksa (Force Open) untuk guru ini
        if ($window['is_force_open']) {
            return $this->payload('aktif', true, $window['reason'] ?: 'Presensi dibuka khusus oleh Admin IT.', $label, false);
        }

        // Jika Admin IT mengaktifkan Kunci Paksa (Force Lock) untuk guru ini
        if ($window['is_force_locked']) {
            return $this->payload('locked', false, $window['reason'] ?: 'Presensi dikunci khusus oleh Admin IT.', $label, false);
        }

        if ($scheduledDay && $scheduledDay !== $this->todayLabel($now)) {
            return $this->payload('locked', false, "Absensi belum dibuka. Jadwal hari {$label}.", $label);
        }

        // Jika di luar jendela aktif (belum buka atau sudah lewat jam tutup)
        if (!$window['can_absen']) {
            return $this->payload(
                $window['status'],
                false,
                $window['reason'],
                $label,
                $window['is_late'] ?? false
            );
        }

        return $this->payload(
            'aktif',
            true,
            $window['reason'] ?? ($window['is_late'] ? 'Terlambat input presensi' : null),
            $label,
            $window['is_late'] ?? false
        );
    }

    public function assertOpenForGuru(Jadwal $jadwal, ?Carbon $date = null, bool $offlineSync = false): ?string
    {
        $now = Carbon::now('Asia/Jakarta');
        $date = ($date ?: $now)->copy()->setTimezone('Asia/Jakarta')->startOfDay();
        $today = $now->copy()->startOfDay();
        $scheduledDay = $this->scheduledDay($jadwal);
        $dayLabel = $this->todayLabel($date);
        $label = trim(($scheduledDay ?: 'hari sesuai jadwal') . ' ' . ($jadwal->jam_mulai ?: ''));

        $user = request()->user();
        if ($user && $user->role === 'admin') {
            return null;
        }

        $itControlService = app(\App\Services\ItSystemControlService::class);
        $window = $itControlService->resolveWindowForJadwal($jadwal, $now);

        // Jika Admin IT membuka paksa (Force Open), bypass validasi hari dan jam
        if ($window['is_force_open']) {
            return null;
        }

        // Jika Admin IT mengunci paksa (Force Lock)
        if ($window['is_force_locked']) {
            return $window['reason'] ?: 'Presensi dikunci khusus oleh Admin IT.';
        }

        if ($scheduledDay && $scheduledDay !== $dayLabel) {
            return "Absensi belum dibuka. Jadwal: {$label}.";
        }

        if ($date->gt($today) || (!$offlineSync && !$date->equalTo($today))) {
            return 'Guru hanya bisa menginput absensi pada tanggal jadwal berjalan.';
        }

        if ($date->equalTo($today)) {
            $status = $this->resolve($jadwal, false, $now);
            if (!$status['can_absen']) {
                return $status['message'] ?: "Absensi belum dibuka. Jadwal: {$label}.";
            }
        }

        return null;
    }

    private function scheduledDay(Jadwal $jadwal): ?string
    {
        if (!empty($jadwal->hari)) {
            return trim($jadwal->hari);
        }

        return $jadwal->day_id
            ? DB::table('days')->where('id', $jadwal->day_id)->value('name')
            : null;
    }

    private function scheduleTimeForToday(string $time, Carbon $now): Carbon
    {
        $parts = explode(':', $time);
        $hour = str_pad((string) ((int) ($parts[0] ?? 0)), 2, '0', STR_PAD_LEFT);
        $minute = str_pad((string) ((int) ($parts[1] ?? 0)), 2, '0', STR_PAD_LEFT);
        $second = str_pad((string) ((int) ($parts[2] ?? 0)), 2, '0', STR_PAD_LEFT);

        return Carbon::createFromFormat('Y-m-d H:i:s', $now->toDateString() . " {$hour}:{$minute}:{$second}", 'Asia/Jakarta');
    }

    private function payload(string $status, bool $canAbsen, ?string $message, string $label, bool $isLate = false): array
    {
        return [
            'status' => $status,
            'can_absen' => $canAbsen,
            'message' => $message,
            'label' => $label,
            'is_late' => $isLate,
        ];
    }
}
