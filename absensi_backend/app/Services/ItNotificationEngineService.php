<?php

namespace App\Services;

use App\Models\Absensi;
use App\Models\AppNotification;
use App\Models\ItSystemControl;
use App\Models\Jadwal;
use App\Models\PaymentBill;
use App\Models\Siswa;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ItNotificationEngineService
{
    public function __construct(
        protected WebPushService $webPushService,
        protected ItSystemControlService $itControlService
    ) {}

    /**
     * Konfigurasi Notifikasi Tagihan Wali
     */
    public function getWaliBillingConfig(): array
    {
        return ItSystemControl::getByKey('wali_billing_notification', [
            'schedule_day'        => 10,       // Setiap tanggal 10
            'schedule_time'       => '07:00',  // Pukul 07:00 WIB
            'is_active'           => true,
            'title_template'      => '📢 Pengingat Tagihan SPP & Administrasi Santri',
            'message_template'    => 'Assalamu\'alaikum Wr. Wb. Bapak/Ibu Wali dari {nama_santri}, mengingatkan bahwa kewajiban administrasi santri telah memasuki tanggal pembayaran ({tanggal_pembayaran}). Mohon untuk menyelesaikan tagihan tertunggak sebesar {total_tagihan}. Syukron katsir.',
            'only_unpaid'         => true,
        ]);
    }

    public function saveWaliBillingConfig(array $data, ?int $userId = null): array
    {
        $current = $this->getWaliBillingConfig();
        $updated = array_merge($current, [
            'schedule_day'        => (int) ($data['schedule_day'] ?? $current['schedule_day']),
            'schedule_time'       => (string) ($data['schedule_time'] ?? $current['schedule_time']),
            'is_active'           => (bool) ($data['is_active'] ?? $current['is_active']),
            'title_template'      => (string) ($data['title_template'] ?? $current['title_template']),
            'message_template'    => (string) ($data['message_template'] ?? $current['message_template']),
            'only_unpaid'         => (bool) ($data['only_unpaid'] ?? $current['only_unpaid']),
        ]);

        ItSystemControl::setByKey(
            'wali_billing_notification',
            $updated,
            'Pengaturan jadwal dan pesan otomatis notifikasi tagihan SPP bulanan wali santri',
            $userId
        );

        return $updated;
    }

    /**
     * Konfigurasi Notifikasi Peringatan Guru
     */
    public function getGuruDeadlineConfig(): array
    {
        return ItSystemControl::getByKey('guru_deadline_notification', [
            'warning_lead_hours'  => 1,
            'is_active'           => true,
            'title_template'      => '⚠️ Peringatan Batas Waktu Presensi KBM',
            'message_template'    => 'Yth. {nama_guru}, presensi kelas {nama_kelas} ({nama_mapel}) belum diisi. Batas waktu input presensi akan ditutup pada pukul {jam_tutup} WIB.',
        ]);
    }

    public function saveGuruDeadlineConfig(array $data, ?int $userId = null): array
    {
        $current = $this->getGuruDeadlineConfig();
        $updated = array_merge($current, [
            'warning_lead_hours'  => (int) ($data['warning_lead_hours'] ?? $current['warning_lead_hours']),
            'is_active'           => (bool) ($data['is_active'] ?? $current['is_active']),
            'title_template'      => (string) ($data['title_template'] ?? $current['title_template']),
            'message_template'    => (string) ($data['message_template'] ?? $current['message_template']),
        ]);

        ItSystemControl::setByKey(
            'guru_deadline_notification',
            $updated,
            'Pengaturan notifikasi pengingat tenggat batas waktu pengisian absensi guru',
            $userId
        );

        return $updated;
    }

    /**
     * 🚀 TRIGGER CERDAS: Kirim Notifikasi Pengingat Presensi Guru
     * Mengirimkan notifikasi ke dewan guru yang jadwal mengajarnya hari ini belum diabsen
     */
    public function sendGuruAttendanceReminders(?int $actorId = null): array
    {
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

        $config = $this->getGuruDeadlineConfig();

        // Ambil semua jadwal hari ini
        $schedules = Jadwal::with(['mapel', 'kelas', 'teacher'])
            ->where('hari', $todayIndo)
            ->where('status', 'Aktif')
            ->get();

        $sentCount = 0;
        $details = [];

        foreach ($schedules as $j) {
            $hasAttended = Absensi::where('jadwal_id', $j->id)
                ->whereDate('tanggal', $todayDate)
                ->exists();

            if ($hasAttended) {
                continue; // Sudah diabsen, lewati
            }

            // Cari user guru
            $teacher = $j->teacher;
            if (!$teacher && !empty($j->guru)) {
                $teacher = User::where('name', $j->guru)->orWhere('kode_guru', $j->guru)->first();
            }

            if (!$teacher) {
                continue;
            }

            // Hitung jam tutup berdasarkan window control
            $window = $this->itControlService->resolveWindowForJadwal($j, $now);
            $jamTutup = $window['close_time_label'] ?: '23:00';

            $mapelName = $j->mapel->nama ?? $j->mapel->name ?? 'Mata Pelajaran';
            $kelasName = $j->kelas->name ?? $j->kelas->nama ?? 'Kelas';

            $title = str_replace(
                ['{nama_guru}', '{nama_kelas}', '{nama_mapel}', '{jam_tutup}'],
                [$teacher->name, $kelasName, $mapelName, $jamTutup],
                $config['title_template']
            );

            $message = str_replace(
                ['{nama_guru}', '{nama_kelas}', '{nama_mapel}', '{jam_tutup}'],
                [$teacher->name, $kelasName, $mapelName, $jamTutup],
                $config['message_template']
            );

            $notifKey = "it_guru_reminder_{$j->id}_{$todayDate}_" . $now->format('H');

            // Simpan AppNotification (notifikasi internal sistem)
            $notif = AppNotification::create([
                'user_id' => $teacher->id,
                'title'   => $title,
                'message' => $message,
                'type'    => 'peringatan_tenggat',
                'data'    => [
                    'key'         => $notifKey,
                    'jadwal_id'   => $j->id,
                    'triggered_by'=> $actorId,
                    'page'        => 'absensi',
                    'tab'         => 'madin-input',
                ],
                'is_read' => false,
            ]);

            // Kirim WebPush ke browser / HP guru jika terdaftar
            try {
                $this->webPushService->sendToUser(
                    $teacher->id,
                    $title,
                    $message,
                    '/?page=absensi',
                    ['type' => 'guru_attendance_reminder', 'jadwal_id' => $j->id]
                );
            } catch (\Throwable $e) {
                Log::warning("[ItNotification] Gagal push ke guru ID {$teacher->id}: " . $e->getMessage());
            }

            $sentCount++;
            $details[] = [
                'teacher_name' => $teacher->name,
                'mapel'        => $mapelName,
                'kelas'        => $kelasName,
                'jam_tutup'    => $jamTutup,
            ];
        }

        return [
            'success'    => true,
            'sent_count' => $sentCount,
            'timestamp'  => $now->toIso8601String(),
            'details'    => $details,
        ];
    }

    /**
     * 🚀 TRIGGER CERDAS: Kirim Notifikasi Pengingat Tagihan ke Wali Santri
     * ATURAN: HANYA wali yang belum lunas yang dikirimi! Wali yang lunas 100% TIDAK DIKIRIMI!
     */
    public function sendWaliBillingReminders(?int $actorId = null): array
    {
        $now = Carbon::now('Asia/Jakarta');
        $config = $this->getWaliBillingConfig();

        // 1. Dapatkan seluruh tagihan yang belum lunas
        $unpaidBills = PaymentBill::with(['siswa.waliUser', 'siswa.guardianProfile'])
            ->where(function ($q) {
                $q->where('status', '!=', 'Lunas')
                  ->orWhereNull('status');
            })
            ->get();

        // Kelompokkan tagihan per Siswa & Wali
        $groupedBySiswa = $unpaidBills->groupBy('siswa_id');

        $sentCount = 0;
        $totalUnpaidCalculated = 0;
        $recipients = [];

        foreach ($groupedBySiswa as $siswaId => $bills) {
            $siswa = $bills->first()->siswa;
            if (!$siswa) {
                continue;
            }

            $totalTunggakan = $bills->sum('amount');
            if ($totalTunggakan <= 0) {
                continue; // Tidak ada tunggakan, lewati!
            }

            $totalUnpaidCalculated += $totalTunggakan;

            // Cari akun wali yang terhubung
            $waliUser = $siswa->waliUser;
            if (!$waliUser && $siswa->wali_id) {
                $waliUser = User::find($siswa->wali_id);
            }

            // Jika belum terhubung user, cari user dengan nis/nama anak
            if (!$waliUser) {
                $waliUser = User::where('role', 'wali')
                    ->where(function ($q) use ($siswa) {
                        $q->where('nis', $siswa->nis)
                          ->orWhere('email', 'like', "%{$siswa->nis}%");
                    })
                    ->first();
            }

            if (!$waliUser) {
                continue;
            }

            $tglStr = "Tanggal " . ($config['schedule_day'] ?? 10) . " " . $now->translatedFormat('F Y');
            $nominalStr = 'Rp ' . number_format($totalTunggakan, 0, ',', '.');

            $title = str_replace(
                ['{nama_santri}', '{tanggal_pembayaran}', '{total_tagihan}'],
                [$siswa->nama_lengkap ?: $siswa->nama ?: 'Santri', $tglStr, $nominalStr],
                $config['title_template']
            );

            $message = str_replace(
                ['{nama_santri}', '{tanggal_pembayaran}', '{total_tagihan}'],
                [$siswa->nama_lengkap ?: $siswa->nama ?: 'Santri', $tglStr, $nominalStr],
                $config['message_template']
            );

            $notifKey = "it_billing_reminder_{$siswa->id}_" . $now->format('Y_m');

            // Simpan notifikasi portal wali
            AppNotification::create([
                'user_id' => $waliUser->id,
                'title'   => $title,
                'message' => $message,
                'type'    => 'tagihan_spp',
                'data'    => [
                    'key'              => $notifKey,
                    'siswa_id'         => $siswa->id,
                    'total_tunggakan'  => $totalTunggakan,
                    'triggered_by'     => $actorId,
                    'page'             => 'keuangan',
                    'tab'              => 'tagihan',
                ],
                'is_read' => false,
            ]);

            // Kirim WebPush ke HP Wali jika wali sudah mengaktifkan notifikasi
            try {
                $this->webPushService->sendToUser(
                    $waliUser->id,
                    $title,
                    $message,
                    '/?tab=keuangan',
                    ['type' => 'wali_billing_reminder', 'siswa_id' => $siswa->id]
                );
            } catch (\Throwable $e) {
                Log::warning("[ItNotification] Gagal push ke wali ID {$waliUser->id}: " . $e->getMessage());
            }

            $sentCount++;
            $recipients[] = [
                'wali_name'       => $waliUser->name,
                'siswa_name'      => $siswa->nama_lengkap ?: $siswa->nama,
                'total_tunggakan' => $totalTunggakan,
                'bills_count'     => $bills->count(),
            ];
        }

        return [
            'success'               => true,
            'sent_count'            => $sentCount,
            'total_unpaid_amount'   => $totalUnpaidCalculated,
            'total_unpaid_currency' => 'Rp ' . number_format($totalUnpaidCalculated, 0, ',', '.'),
            'timestamp'             => $now->toIso8601String(),
            'recipients_sample'     => array_slice($recipients, 0, 10),
        ];
    }
}
