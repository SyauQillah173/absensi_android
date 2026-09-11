<?php

namespace App\Services;

use App\Models\ItGuruAttendanceOverride;
use App\Models\ItSystemControl;
use App\Models\Jadwal;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Collection;

class ItSystemControlService
{
    /**
     * Dapatkan konfigurasi default jam absensi guru
     */
    public function getGlobalAttendanceConfig(): array
    {
        return ItSystemControl::getByKey('attendance_guru_global', [
            'default_open_lead_minutes'     => 60,       // H-1 jam sebelum jadwal
            'default_close_hour'            => '23:00',   // Batas tutup guru pukul 23:00 WIB
            'admin_close_hour'              => '04:00',   // Khusus admin s/d jam 04:00 subuh
            'allow_guru_late_input'         => true,      // Boleh input terlambat sebelum tutup
            'enable_kbm_auto_notification'  => true,
        ]);
    }

    /**
     * Simpan konfigurasi default jam absensi guru
     */
    public function saveGlobalAttendanceConfig(array $data, ?int $userId = null): array
    {
        $current = $this->getGlobalAttendanceConfig();
        $updated = array_merge($current, [
            'default_open_lead_minutes'     => (int) ($data['default_open_lead_minutes'] ?? $current['default_open_lead_minutes']),
            'default_close_hour'            => (string) ($data['default_close_hour'] ?? $current['default_close_hour']),
            'admin_close_hour'              => (string) ($data['admin_close_hour'] ?? $current['admin_close_hour']),
            'allow_guru_late_input'         => (bool) ($data['allow_guru_late_input'] ?? $current['allow_guru_late_input']),
            'enable_kbm_auto_notification'  => (bool) ($data['enable_kbm_auto_notification'] ?? $current['enable_kbm_auto_notification']),
        ]);

        ItSystemControl::setByKey(
            'attendance_guru_global',
            $updated,
            'Konfigurasi global jam buka dan tutup presensi jadwal mengajar guru',
            $userId
        );

        return $updated;
    }

    /**
     * Dapatkan daftar override jam absensi guru
     */
    public function getGuruOverrides(): Collection
    {
        return ItGuruAttendanceOverride::with(['teacher:id,name,username,email,no_hp,role', 'jadwal.mapel', 'jadwal.kelas'])
            ->orderByDesc('id')
            ->get();
    }

    /**
     * Simpan atau update override untuk guru tertentu
     */
    public function saveGuruOverride(array $data, ?int $userId = null): ItGuruAttendanceOverride
    {
        $overrideId = $data['id'] ?? null;

        $payload = [
            'teacher_id'        => (int) $data['teacher_id'],
            'jadwal_id'         => !empty($data['jadwal_id']) ? (int) $data['jadwal_id'] : null,
            'open_lead_minutes' => isset($data['open_lead_minutes']) && $data['open_lead_minutes'] !== '' ? (int) $data['open_lead_minutes'] : 60,
            'custom_open_hour'  => !empty($data['custom_open_hour']) ? (string) $data['custom_open_hour'] : null,
            'close_hour'        => !empty($data['close_hour']) ? (string) $data['close_hour'] : '23:00',
            'is_force_open'     => !empty($data['is_force_open']),
            'is_force_locked'   => !empty($data['is_force_locked']),
            'notes'             => !empty($data['notes']) ? (string) $data['notes'] : null,
            'updated_by'        => $userId ?: auth()->id(),
        ];

        if ($overrideId) {
            $override = ItGuruAttendanceOverride::findOrFail($overrideId);
            $override->update($payload);
        } else {
            $payload['created_by'] = $userId ?: auth()->id();
            $override = ItGuruAttendanceOverride::create($payload);
        }

        return $override->load(['teacher:id,name,username,email', 'jadwal.mapel', 'jadwal.kelas']);
    }

    /**
     * Hapus override guru
     */
    public function deleteGuruOverride(int $id): bool
    {
        $override = ItGuruAttendanceOverride::find($id);
        if ($override) {
            return (bool) $override->delete();
        }
        return false;
    }

    /**
     * Toggle status darurat: Force Open atau Force Locked
     */
    public function toggleForceStatus(int $id, string $type, ?int $userId = null): ItGuruAttendanceOverride
    {
        $override = ItGuruAttendanceOverride::findOrFail($id);

        if ($type === 'force_open') {
            $override->is_force_open = !$override->is_force_open;
            if ($override->is_force_open) {
                $override->is_force_locked = false; // Tidak boleh bentrok
            }
        } elseif ($type === 'force_locked') {
            $override->is_force_locked = !$override->is_force_locked;
            if ($override->is_force_locked) {
                $override->is_force_open = false; // Tidak boleh bentrok
            }
        }

        $override->updated_by = $userId ?: auth()->id();
        $override->save();

        return $override->load(['teacher:id,name,username,email', 'jadwal.mapel', 'jadwal.kelas']);
    }

    /**
     * 🧠 ENGINE CERDAS: Evaluasi Window Buka/Tutup Presensi Guru
     * Menggabungkan override guru & konfigurasi global Admin IT
     */
    public function resolveWindowForJadwal(Jadwal $jadwal, ?Carbon $now = null): array
    {
        $now = $now ?: Carbon::now('Asia/Jakarta');
        $global = $this->getGlobalAttendanceConfig();

        // Cari override spesifik jadwal ini, atau override guru ini secara umum
        $override = null;
        if ($jadwal->teacher_id) {
            $override = ItGuruAttendanceOverride::where('teacher_id', $jadwal->teacher_id)
                ->where(function ($q) use ($jadwal) {
                    $q->where('jadwal_id', $jadwal->id)->orWhereNull('jadwal_id');
                })
                ->orderByRaw('jadwal_id IS NOT NULL DESC') // Prioritaskan override spesifik jadwal
                ->first();
        }

        // 1. Jika Admin IT menekan Force Open (Buka Paksa)
        if ($override && $override->is_force_open) {
            return [
                'mode'             => 'force_open',
                'is_force_open'    => true,
                'is_force_locked'  => false,
                'can_absen'        => true,
                'status'           => 'aktif',
                'reason'           => 'Presensi dibuka khusus oleh Admin IT' . ($override->notes ? " ({$override->notes})" : ''),
                'open_time_label'  => 'Dibuka Langsung',
                'close_time_label' => 'Tanpa Batasan',
                'is_late'          => false,
            ];
        }

        // 2. Jika Admin IT menekan Force Lock (Kunci Paksa)
        if ($override && $override->is_force_locked) {
            return [
                'mode'             => 'force_locked',
                'is_force_open'    => false,
                'is_force_locked'  => true,
                'can_absen'        => false,
                'status'           => 'locked',
                'reason'           => 'Presensi dikunci khusus oleh Admin IT' . ($override->notes ? " ({$override->notes})" : ''),
                'open_time_label'  => 'Dikunci',
                'close_time_label' => 'Terkunci',
                'is_late'          => false,
            ];
        }

        // 3. Hitung Waktu Buka Presensi
        // Buka berdasarkan custom_open_hour atau open_lead_minutes
        $leadMinutes = $override && $override->open_lead_minutes !== null
            ? $override->open_lead_minutes
            : ($global['default_open_lead_minutes'] ?? 60);

        $customOpenHour = $override?->custom_open_hour;
        $closeHourStr = $override && !empty($override->close_hour)
            ? $override->close_hour
            : ($global['default_close_hour'] ?? '23:00');

        $todayDate = $now->toDateString();

        // Tentukan titik pembukaan absensi
        if ($customOpenHour) {
            $activationStart = Carbon::createFromFormat('Y-m-d H:i', "{$todayDate} " . substr($customOpenHour, 0, 5), 'Asia/Jakarta');
        } elseif ($jadwal->jam_mulai) {
            $jamMulaiStr = substr($jadwal->jam_mulai, 0, 5);
            $start = Carbon::createFromFormat('Y-m-d H:i', "{$todayDate} {$jamMulaiStr}", 'Asia/Jakarta');
            $activationStart = $start->copy()->subMinutes($leadMinutes);
        } else {
            $activationStart = $now->copy()->startOfDay();
        }

        // Tentukan batas penutupan absensi
        $cutoff = Carbon::createFromFormat('Y-m-d H:i', "{$todayDate} " . substr($closeHourStr, 0, 5), 'Asia/Jakarta');

        $isBeforeOpen = $now->lt($activationStart);
        $isPastCutoff = $now->gt($cutoff);

        // Tentukan apakah terlambat
        $isLate = false;
        if ($jadwal->jam_selesai) {
            $jamSelesaiStr = substr($jadwal->jam_selesai, 0, 5);
            $end = Carbon::createFromFormat('Y-m-d H:i', "{$todayDate} {$jamSelesaiStr}", 'Asia/Jakarta');
            if ($now->gt($end) && !$isPastCutoff) {
                $isLate = true;
            }
        }

        if ($isBeforeOpen) {
            return [
                'mode'             => 'upcoming',
                'is_force_open'    => false,
                'is_force_locked'  => false,
                'can_absen'        => false,
                'status'           => 'upcoming',
                'reason'           => "Absensi akan dibuka pada pukul {$activationStart->format('H:i')} WIB (" . ($leadMinutes >= 60 ? ($leadMinutes / 60) . ' jam' : $leadMinutes . ' menit') . " sebelum pelajaran dimulai).",
                'open_time_label'  => $activationStart->format('H:i'),
                'close_time_label' => $cutoff->format('H:i'),
                'is_late'          => false,
            ];
        }

        if ($isPastCutoff) {
            return [
                'mode'             => 'closed',
                'is_force_open'    => false,
                'is_force_locked'  => false,
                'can_absen'        => false,
                'status'           => 'locked',
                'reason'           => "Waktu pengisian presensi telah ditutup pukul {$cutoff->format('H:i')} WIB. Silakan hubungi Admin IT jika memerlukan izin susulan.",
                'open_time_label'  => $activationStart->format('H:i'),
                'close_time_label' => $cutoff->format('H:i'),
                'is_late'          => true,
            ];
        }

        return [
            'mode'             => 'active',
            'is_force_open'    => false,
            'is_force_locked'  => false,
            'can_absen'        => true,
            'status'           => 'aktif',
            'reason'           => $isLate ? 'Terlambat input presensi' : null,
            'open_time_label'  => $activationStart->format('H:i'),
            'close_time_label' => $cutoff->format('H:i'),
            'is_late'          => $isLate,
        ];
    }

    /**
     * Mengambil konfigurasi notifikasi SPP wali santri
     */
    public function getWaliBillingNotificationConfig(): array
    {
        $raw = ItSystemControl::getByKey('wali_billing_notification', [
            'schedule_day'        => 10,
            'schedule_time'       => '07:00',
            'is_active'           => true,
            'title_template'      => '📢 Pengingat Tagihan SPP & Administrasi Santri',
            'message_template'    => 'Assalamu\'alaikum Wr. Wb. Bapak/Ibu Wali dari {nama_santri}, mengingatkan bahwa kewajiban administrasi santri telah memasuki tanggal pembayaran ({tanggal_pembayaran}). Mohon untuk menyelesaikan tagihan tertunggak sebesar {total_tagihan}. Syukron katsir.',
            'only_unpaid'         => true,
        ]);

        $day = (int) ($raw['scheduled_day_of_month'] ?? $raw['schedule_day'] ?? 10);
        $hour = (string) ($raw['scheduled_hour'] ?? $raw['schedule_time'] ?? '07:00');
        $isActive = (bool) ($raw['is_enabled'] ?? $raw['is_active'] ?? true);
        $title = (string) ($raw['template_title'] ?? $raw['title_template'] ?? '📢 Pengingat Tagihan SPP & Administrasi Santri');
        $body = (string) ($raw['template_body'] ?? $raw['message_template'] ?? 'Assalamu\'alaikum Wr. Wb. Bapak/Ibu Wali dari {nama_santri}, mohon segera menyelesaikan tagihan SPP tertunggak sebesar {total_tunggakan}.');

        return [
            'is_enabled'             => $isActive,
            'scheduled_day_of_month' => $day,
            'scheduled_hour'         => $hour,
            'template_title'         => $title,
            'template_body'          => $body,
            'auto_push_wa'           => (bool) ($raw['auto_push_wa'] ?? true),
            'last_run_at'            => $raw['last_run_at'] ?? null,
            // Aliases
            'schedule_day'           => $day,
            'schedule_time'          => $hour,
            'is_active'              => $isActive,
            'title_template'         => $title,
            'message_template'       => $body,
            'only_unpaid'            => true,
        ];
    }

    /**
     * Simpan konfigurasi notifikasi SPP wali santri
     */
    public function saveWaliBillingNotificationConfig(array $data, ?int $userId = null): array
    {
        $current = $this->getWaliBillingNotificationConfig();
        $day = isset($data['scheduled_day_of_month']) ? (int) $data['scheduled_day_of_month'] : (int) ($data['schedule_day'] ?? $current['scheduled_day_of_month']);
        $hour = isset($data['scheduled_hour']) ? (string) $data['scheduled_hour'] : (string) ($data['schedule_time'] ?? $current['scheduled_hour']);
        $isActive = isset($data['is_enabled']) ? (bool) $data['is_enabled'] : (bool) ($data['is_active'] ?? $current['is_enabled']);
        $title = isset($data['template_title']) ? (string) $data['template_title'] : (string) ($data['title_template'] ?? $current['template_title']);
        $body = isset($data['template_body']) ? (string) $data['template_body'] : (string) ($data['message_template'] ?? $current['template_body']);

        $updated = [
            'is_enabled'             => $isActive,
            'scheduled_day_of_month' => $day,
            'scheduled_hour'         => $hour,
            'template_title'         => $title,
            'template_body'          => $body,
            'auto_push_wa'           => (bool) ($data['auto_push_wa'] ?? $current['auto_push_wa'] ?? true),
            'last_run_at'            => $current['last_run_at'] ?? null,
            // Aliases
            'schedule_day'           => $day,
            'schedule_time'          => $hour,
            'is_active'              => $isActive,
            'title_template'         => $title,
            'message_template'       => $body,
            'only_unpaid'            => true,
        ];

        ItSystemControl::setByKey(
            'wali_billing_notification',
            $updated,
            'Pengaturan jadwal dan pesan otomatis notifikasi tagihan SPP bulanan wali santri',
            $userId
        );

        return $updated;
    }

    /**
     * Mengambil konfigurasi notifikasi tenggat waktu presensi guru
     */
    public function getGuruDeadlineNotificationConfig(): array
    {
        $raw = ItSystemControl::getByKey('guru_deadline_notification', [
            'warning_lead_hours'  => 1,
            'is_active'           => true,
            'title_template'      => '⚠️ Peringatan Batas Waktu Presensi KBM',
            'message_template'    => 'Yth. {nama_guru}, presensi kelas {nama_kelas} ({nama_mapel}) belum diisi. Batas waktu input presensi akan ditutup pada pukul {jam_tutup} WIB.',
        ]);

        $leadHours = (int) ($raw['warning_lead_hours'] ?? 1);
        $minutes = isset($raw['warning_minutes_before_close']) ? (int) $raw['warning_minutes_before_close'] : ($leadHours * 60);
        $isActive = (bool) ($raw['is_enabled'] ?? $raw['is_active'] ?? true);
        $title = (string) ($raw['template_title'] ?? $raw['title_template'] ?? '⚠️ Peringatan Batas Waktu Presensi KBM');
        $body = (string) ($raw['template_body'] ?? $raw['message_template'] ?? 'Yth. {nama_guru}, presensi kelas {mapel} ({kelas}) belum diisi. Batas waktu input presensi akan ditutup pada pukul {jam_tutup} WIB.');

        return [
            'is_enabled'                   => $isActive,
            'warning_minutes_before_close' => $minutes,
            'warning_lead_hours'           => $leadHours,
            'template_title'               => $title,
            'template_body'                => $body,
            'auto_push_wa'                 => (bool) ($raw['auto_push_wa'] ?? true),
            'last_run_at'                  => $raw['last_run_at'] ?? null,
            // Aliases
            'is_active'                    => $isActive,
            'title_template'               => $title,
            'message_template'             => $body,
        ];
    }

    /**
     * Simpan konfigurasi notifikasi tenggat presensi guru
     */
    public function saveGuruDeadlineNotificationConfig(array $data, ?int $userId = null): array
    {
        $current = $this->getGuruDeadlineNotificationConfig();
        $minutes = isset($data['warning_minutes_before_close']) ? (int) $data['warning_minutes_before_close'] : (int) ($current['warning_minutes_before_close'] ?? 60);
        $leadHours = (int) ceil($minutes / 60);
        $isActive = isset($data['is_enabled']) ? (bool) $data['is_enabled'] : (bool) ($data['is_active'] ?? $current['is_enabled']);
        $title = isset($data['template_title']) ? (string) $data['template_title'] : (string) ($data['title_template'] ?? $current['template_title']);
        $body = isset($data['template_body']) ? (string) $data['template_body'] : (string) ($data['message_template'] ?? $current['template_body']);

        $updated = [
            'is_enabled'                   => $isActive,
            'warning_minutes_before_close' => $minutes,
            'warning_lead_hours'           => $leadHours,
            'template_title'               => $title,
            'template_body'                => $body,
            'auto_push_wa'                 => (bool) ($data['auto_push_wa'] ?? $current['auto_push_wa'] ?? true),
            'last_run_at'                  => $current['last_run_at'] ?? null,
            // Aliases
            'is_active'                    => $isActive,
            'title_template'               => $title,
            'message_template'             => $body,
        ];

        ItSystemControl::setByKey(
            'guru_deadline_notification',
            $updated,
            'Pengaturan notifikasi pengingat tenggat batas waktu pengisian absensi guru',
            $userId
        );

        return $updated;
    }
}
