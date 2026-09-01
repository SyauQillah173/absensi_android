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

        // Check activation window (1 hour before jam_mulai)
        if ($jadwal->jam_mulai) {
            $start = $this->scheduleTimeForToday((string) $jadwal->jam_mulai, $now);
            $activationStart = $start->copy()->subHour();

            if ($now->lt($activationStart)) {
                return $this->payload(
                    'upcoming',
                    false,
                    "Jadwal akan aktif pada pukul {$activationStart->format('H:i')} (1 jam sebelum jam pelajaran dimulai).",
                    $label
                );
            }
        }

        // Check completion & late tolerance cutoff (until 23:00)
        $isLate = false;
        if ($jadwal->jam_selesai) {
            $end = $this->scheduleTimeForToday((string) $jadwal->jam_selesai, $now);
            $cutoff = $this->scheduleTimeForToday('23:00:00', $now);

            if ($now->gt($cutoff)) {
                return $this->payload(
                    'locked',
                    false,
                    'Waktu input presensi guru untuk jadwal ini telah ditutup pukul 23:00. Silakan hubungi Admin Utama.',
                    $label
                );
            }

            if ($now->gt($end)) {
                $isLate = true;
            }
        }

        return $this->payload('aktif', true, $isLate ? 'Terlambat input presensi' : null, $label, $isLate);
    }

    public function assertOpenForGuru(Jadwal $jadwal, ?Carbon $date = null, bool $offlineSync = false): ?string
    {
        $date = ($date ?: Carbon::now('Asia/Jakarta'))->copy()->startOfDay();
        $today = Carbon::now('Asia/Jakarta')->startOfDay();
        $scheduledDay = $this->scheduledDay($jadwal);
        $dayLabel = $this->todayLabel($date);
        $label = trim(($scheduledDay ?: 'hari sesuai jadwal') . ' ' . ($jadwal->jam_mulai ?: ''));

        $user = request()->user();
        if ($user && $user->role === 'admin') {
            return null;
        }

        if ($scheduledDay && $scheduledDay !== $dayLabel) {
            return "Absensi belum dibuka. Jadwal: {$label}.";
        }

        if ($date->gt($today) || (!$offlineSync && !$date->equalTo($today))) {
            return 'Guru hanya bisa menginput absensi pada tanggal jadwal berjalan.';
        }

        if ($date->equalTo($today)) {
            $status = $this->resolve($jadwal);
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
