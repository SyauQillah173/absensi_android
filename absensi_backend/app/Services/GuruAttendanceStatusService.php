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

        return $labels[(int) ($now ?? now())->isoWeekday()] ?? 'Senin';
    }

    public function resolve(Jadwal $jadwal, bool $hasAttendance = false, ?Carbon $now = null): array
    {
        $now = $now ?: now();
        $scheduledDay = $this->scheduledDay($jadwal);
        $label = trim(($scheduledDay ?: 'hari sesuai jadwal') . ' ' . ($jadwal->jam_mulai ?: ''));

        if (($jadwal->status ?? 'Aktif') !== 'Aktif') {
            return $this->payload('locked', false, 'Jadwal sedang nonaktif.', $label);
        }

        if ($hasAttendance) {
            return $this->payload('completed', false, null, $label);
        }

        if ($scheduledDay && $scheduledDay !== $this->todayLabel($now)) {
            return $this->payload('locked', false, "Absensi belum dibuka. Jadwal: {$label}.", $label);
        }

        if ($jadwal->jam_mulai) {
            $start = $this->scheduleTimeForToday((string) $jadwal->jam_mulai, $now);
            if ($now->lt($start)) {
                return $this->payload('upcoming', false, "Absensi belum dibuka. Absensi dapat dilakukan mulai pukul {$jadwal->jam_mulai}.", $label);
            }
        }

        return $this->payload('aktif', true, null, $label);
    }

    public function assertOpenForGuru(Jadwal $jadwal, ?Carbon $date = null, bool $offlineSync = false): ?string
    {
        $date = ($date ?: now())->copy()->startOfDay();
        $today = now()->startOfDay();
        $scheduledDay = $this->scheduledDay($jadwal);
        $dayLabel = $this->todayLabel($date);
        $label = trim(($scheduledDay ?: 'hari sesuai jadwal') . ' ' . ($jadwal->jam_mulai ?: ''));

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
        return $jadwal->day_id
            ? DB::table('days')->where('id', $jadwal->day_id)->value('name')
            : $jadwal->hari;
    }

    private function scheduleTimeForToday(string $time, Carbon $now): Carbon
    {
        $parts = explode(':', $time);
        $hour = str_pad((string) ((int) ($parts[0] ?? 0)), 2, '0', STR_PAD_LEFT);
        $minute = str_pad((string) ((int) ($parts[1] ?? 0)), 2, '0', STR_PAD_LEFT);
        $second = str_pad((string) ((int) ($parts[2] ?? 0)), 2, '0', STR_PAD_LEFT);

        return Carbon::createFromFormat('Y-m-d H:i:s', $now->toDateString() . " {$hour}:{$minute}:{$second}");
    }

    private function payload(string $status, bool $canAbsen, ?string $message, string $label): array
    {
        return [
            'status' => $status,
            'can_absen' => $canAbsen,
            'message' => $message,
            'label' => $label,
        ];
    }
}
