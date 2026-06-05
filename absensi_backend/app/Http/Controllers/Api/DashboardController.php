<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Absensi;
use App\Models\AbsensiNgaji;
use App\Models\AbsensiSholat;
use App\Models\AppNotification;
use App\Models\BoardingRoom;
use App\Models\GuruAbsensiSholatAccess;
use App\Models\Jadwal;
use App\Models\MataPelajaran;
use App\Models\NgajiSchedule;
use App\Models\Pembayaran;
use App\Models\PrayerAttendanceType;
use App\Models\SantriPondok;
use App\Models\Siswa;
use App\Models\User;
use App\Services\ActorResolver;
use App\Services\GuruAttendanceStatusService;
use App\Services\MapelAccessService;
use App\Services\PermissionService;
use App\Services\ReferenceResolver;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function __construct(
        private readonly MapelAccessService $mapelAccessService,
        private readonly GuruAttendanceStatusService $attendanceStatusService,
        private readonly PermissionService $permissionService,
    ) {
    }

    public function index(Request $request)
    {
        $today = now()->toDateString();
        $actor = $this->resolveActor($request);

        if (!$actor) {
            return response()->json([
                'success' => false,
                'message' => 'Sesi pengguna tidak valid atau akun sedang nonaktif',
            ], 403);
        }

        if ($actor && $actor->role === 'guru') {
            return response()->json($this->withPermissions($this->buildGuruDashboard($actor, $today), $actor));
        }

        if ($actor && $actor->role === 'wali') {
            return response()->json($this->withPermissions($this->buildWaliDashboard($actor, $today), $actor));
        }

        return response()->json($this->withPermissions($this->buildAdminDashboard($today), $actor));
    }

    private function buildAdminDashboard(string $today): array
    {
        $absensiHariIni = Absensi::with('siswa')
            ->where('tanggal', $today)
            ->whereNotNull('class_id')
            ->whereNotNull('mapel_id')
            ->whereNotNull('jadwal_id')
            ->get();
        $pembayaranHariIni = Pembayaran::where('tanggal', $today)->get();

        $absensiPerKelas = $absensiHariIni->groupBy(function ($item) {
            return implode('|', [
                $item->class_id,
                $item->mapel_id,
                $item->jadwal_id,
            ]);
        })->map(function ($items) {
            $first = $items->first();
            return [
                'kelas' => $first->kelas,
                'mapel' => $first->mapel,
                'class_id' => $first->class_id,
                'mapel_id' => $first->mapel_id,
                'jadwal_id' => $first->jadwal_id,
                'total' => $items->count(),
                'hadir' => $items->where('status', 'Hadir')->count(),
                'izin' => $items->where('status', 'Izin')->count(),
                'sakit' => $items->where('status', 'Sakit')->count(),
                'alfa' => $items->where('status', 'Alfa')->count(),
                'diinput_oleh' => $first->diinput_oleh ?? 'Admin',
                'diinput_via' => $first->diinput_via ?? 'online',
                'waktu' => optional($first->created_at)->format('H:i:s') ?? '-',
                'status' => $this->resolveAbsensiStatus($first->diinput_via),
            ];
        })->values();

        return [
            'success' => true,
            'tanggal' => $today,
            'role' => 'admin',
            'absensi' => [
                'total' => $absensiHariIni->count(),
                'hadir' => $absensiHariIni->where('status', 'Hadir')->count(),
                'izin' => $absensiHariIni->where('status', 'Izin')->count(),
                'sakit' => $absensiHariIni->where('status', 'Sakit')->count(),
                'alfa' => $absensiHariIni->where('status', 'Alfa')->count(),
                'per_kelas' => $absensiPerKelas,
            ],
            'absensi_sholat' => $this->buildAdminPrayerSummary($today),
            'absensi_ngaji' => $this->buildAdminNgajiSummary($today),
            'pembayaran' => [
                'total_masuk' => $pembayaranHariIni->sum('jumlah'),
                'jumlah_transaksi' => $pembayaranHariIni->count(),
            ],
            'statistik' => [
                'total_siswa' => Siswa::count(),
                'siswa_aktif' => $this->activeStudentsQuery()->count(),
                'total_mapel' => MataPelajaran::where('status', 'Aktif')->count(),
            ],
        ];
    }

    private function buildGuruDashboard(User $guru, string $today): array
    {
        $todayName = $this->attendanceStatusService->todayLabel();

        $jadwalHariIni = $this->mapelAccessService
            ->buildGuruScheduleQuery($guru, $todayName)
            ->get();

        $cards = $jadwalHariIni->map(function (Jadwal $jadwal) use ($guru, $today) {
            $mapelName = $jadwal->mataPelajaran?->nama ?? '-';
            $existing = Absensi::query()
                ->whereDate('tanggal', $today)
                ->where('class_id', $jadwal->class_id)
                ->where('mapel_id', $jadwal->mapel_id)
                ->where('jadwal_id', $jadwal->id)
                ->orderByDesc('created_at')
                ->get();

            $attendanceStatus = $this->attendanceStatusService->resolve($jadwal, $existing->isNotEmpty());
            $status = $attendanceStatus['status'];

            return [
                'kelas' => $jadwal->sifir,
                'mapel' => $mapelName,
                'class_id' => $jadwal->class_id,
                'mapel_id' => $jadwal->mapel_id,
                'jadwal_id' => $jadwal->id,
                'status' => $status,
                'total' => $existing->count(),
                'hadir' => $existing->where('status', 'Hadir')->count(),
                'izin' => $existing->where('status', 'Izin')->count(),
                'sakit' => $existing->where('status', 'Sakit')->count(),
                'alfa' => $existing->where('status', 'Alfa')->count(),
                'diinput_oleh' => $existing->first()?->diinput_oleh ?? 'Guru: ' . $guru->name,
                'diinput_via' => $existing->first()?->diinput_via ?? 'jadwal_admin',
                'waktu' => $existing->first()?->created_at?->format('H:i:s') ?? $jadwal->jam_mulai,
                'jam_mulai' => $jadwal->jam_mulai,
                'jam_selesai' => $jadwal->jam_selesai,
                'hari' => $jadwal->hari,
                'can_absen' => $attendanceStatus['can_absen'],
                'status_message' => $attendanceStatus['message'],
                'notification_key' => md5($today . '|' . $jadwal->sifir . '|' . $mapelName . '|' . $jadwal->jam_mulai),
            ];
        })->filter(function (array $card) {
            return in_array($card['status'], ['upcoming', 'aktif', 'completed'], true);
        })->values();

        $cards = $this->groupGuruDashboardCards($cards);

        $absensiHariIni = Absensi::query()
            ->whereDate('tanggal', $today)
            ->where(function ($builder) use ($guru) {
                $builder->where('diinput_oleh', 'ilike', '%' . $guru->name . '%')
                    ->orWhere('diinput_oleh', 'ilike', '%Guru:%' . $guru->name . '%');
            })
            ->get();

        $pembayaranHariIni = Pembayaran::where('tanggal', $today)->get();

        return [
            'success' => true,
            'tanggal' => $today,
            'role' => 'guru',
            'absensi' => [
                'total' => $absensiHariIni->count(),
                'hadir' => $absensiHariIni->where('status', 'Hadir')->count(),
                'izin' => $absensiHariIni->where('status', 'Izin')->count(),
                'sakit' => $absensiHariIni->where('status', 'Sakit')->count(),
                'alfa' => $absensiHariIni->where('status', 'Alfa')->count(),
                'per_kelas' => $cards,
            ],
            'absensi_sholat' => $this->buildGuruPrayerSummary($guru, $today),
            'absensi_ngaji' => $this->buildGuruNgajiSummary($guru, $today),
            'pembayaran' => [
                'total_masuk' => $pembayaranHariIni->sum('jumlah'),
                'jumlah_transaksi' => $pembayaranHariIni->count(),
            ],
            'statistik' => [
                'total_siswa' => Siswa::count(),
                'siswa_aktif' => $this->activeStudentsQuery()->count(),
                'total_mapel' => MataPelajaran::whereHas('guru', function ($builder) use ($guru) {
                    $builder->where('users.id', $guru->id);
                })->where('status', 'Aktif')->count(),
            ],
        ];
    }

    private function groupGuruDashboardCards($cards)
    {
        return collect($cards)
            ->groupBy(function (array $card) {
                return implode('|', [
                    $card['mapel'] ?? '-',
                    $card['hari'] ?? '-',
                    $card['jam_mulai'] ?? '-',
                    $card['jam_selesai'] ?? '-',
                    $card['status'] ?? '-',
                ]);
            })
            ->map(function ($items) {
                $kelasList = collect($items)
                    ->pluck('kelas')
                    ->filter()
                    ->unique()
                    ->values();

                $first = $items->first();
                $kelasCount = $kelasList->count();
                $kelasLabel = $kelasCount <= 1
                    ? ($kelasList->first() ?? ($first['kelas'] ?? '-'))
                    : $this->summarizeKelasList($kelasList->all());

                return [
                    ...$first,
                    'kelas' => $kelasLabel,
                    'class_id' => $kelasCount === 1 ? ($first['class_id'] ?? null) : null,
                    'kelas_count' => $kelasCount,
                    'kelas_list' => $kelasList->all(),
                    'is_multi_class' => $kelasCount > 1,
                    'total' => collect($items)->sum('total'),
                    'hadir' => collect($items)->sum('hadir'),
                    'izin' => collect($items)->sum('izin'),
                    'sakit' => collect($items)->sum('sakit'),
                    'alfa' => collect($items)->sum('alfa'),
                ];
            })
            ->values();
    }

    private function summarizeKelasList(array $kelasList): string
    {
        $count = count($kelasList);
        if ($count <= 1) {
            return $kelasList[0] ?? '-';
        }

        if ($count === 2) {
            return implode(', ', $kelasList);
        }

        return implode(', ', array_slice($kelasList, 0, 2)) . ' +' . ($count - 2) . ' kelas';
    }

    private function buildWaliDashboard(User $wali, string $today): array
    {
        $anakIds = Siswa::query()
            ->where('wali_id', $wali->id)
            ->orWhereHas('guardianProfile', fn ($query) => $query->where('user_id', $wali->id))
            ->pluck('id');

        $absensiHariIni = Absensi::query()
            ->with('siswa:id,nama')
            ->whereDate('tanggal', $today)
            ->whereNotNull('class_id')
            ->whereNotNull('mapel_id')
            ->whereNotNull('jadwal_id')
            ->when(
                $anakIds->isNotEmpty(),
                fn ($builder) => $builder->whereIn('siswa_id', $anakIds),
                fn ($builder) => $builder->whereRaw('1 = 0'),
            )
            ->orderByDesc('created_at')
            ->get();

        $cards = $absensiHariIni
            ->groupBy(function ($item) {
                return implode('|', [
                    $item->class_id,
                    $item->mapel_id,
                    $item->jadwal_id,
                    $item->siswa_id,
                ]);
            })
            ->map(function ($items) {
                $first = $items->first();
                return [
                    'siswa_id' => $first->siswa_id,
                    'siswa_nama' => $first->siswa?->nama,
                    'kelas' => $first->kelas,
                    'mapel' => $first->mapel,
                    'class_id' => $first->class_id,
                    'mapel_id' => $first->mapel_id,
                    'jadwal_id' => $first->jadwal_id,
                    'status' => 'completed',
                    'total' => $items->count(),
                    'hadir' => $items->where('status', 'Hadir')->count(),
                    'izin' => $items->where('status', 'Izin')->count(),
                    'sakit' => $items->where('status', 'Sakit')->count(),
                    'alfa' => $items->where('status', 'Alfa')->count(),
                    'diinput_oleh' => $first->diinput_oleh ?? 'Guru/Admin',
                    'diinput_via' => 'riwayat_final',
                    'waktu' => optional($first->created_at)->format('H:i:s') ?? '-',
                ];
            })
            ->values();

        return [
            'success' => true,
            'tanggal' => $today,
            'role' => 'wali',
            'absensi' => [
                'total' => $absensiHariIni->count(),
                'hadir' => $absensiHariIni->where('status', 'Hadir')->count(),
                'izin' => $absensiHariIni->where('status', 'Izin')->count(),
                'sakit' => $absensiHariIni->where('status', 'Sakit')->count(),
                'alfa' => $absensiHariIni->where('status', 'Alfa')->count(),
                'per_kelas' => $cards,
            ],
            'absensi_sholat' => $this->buildWaliPrayerSummary($anakIds, $today),
            'absensi_ngaji' => $this->buildWaliNgajiSummary($anakIds, $today),
            'pembayaran' => [
                'total_masuk' => 0,
                'jumlah_transaksi' => 0,
            ],
            'statistik' => [
                'total_siswa' => $anakIds->count(),
                'siswa_aktif' => $this->activeStudentsQuery()->whereIn('id', $anakIds)->count(),
                'total_mapel' => $cards->pluck('mapel')->filter()->unique()->count(),
            ],
        ];
    }

    private function resolveActor(Request $request): ?User
    {
        return app(ActorResolver::class)->active($request, ['user_id', 'actor_user_id']);
    }

    private function activeStudentsQuery()
    {
        $activeStatusId = app(ReferenceResolver::class)->studentStatusId('Aktif');

        return Siswa::query()->where(function ($query) use ($activeStatusId) {
            if ($activeStatusId) {
                $query->where('student_status_id', $activeStatusId);
            }
            $query->orWhere('status', 'Aktif');
        });
    }

    private function buildAdminNgajiSummary(string $today): array
    {
        $schedules = NgajiSchedule::query()
            ->where('status', 'Aktif')
            ->get();

        $rows = AbsensiNgaji::query()
            ->with(['siswa:id,nama,nis,kelas', 'session:id,name', 'book:id,name', 'schedule.teacher:id,name'])
            ->whereDate('tanggal', $today)
            ->where('is_cancelled', false)
            ->get();

        return $this->formatNgajiSummary(
            $rows,
            $schedules->count(),
            $this->expectedNgajiStudentCount($schedules),
        );
    }

    private function buildGuruNgajiSummary(User $guru, string $today): array
    {
        $schedules = NgajiSchedule::query()
            ->where('status', 'Aktif')
            ->where('teacher_id', $guru->id)
            ->get();

        $scheduleIds = $schedules->pluck('id')->all();
        $rows = AbsensiNgaji::query()
            ->with(['siswa:id,nama,nis,kelas', 'session:id,name', 'book:id,name', 'schedule.teacher:id,name'])
            ->whereDate('tanggal', $today)
            ->when(
                !empty($scheduleIds),
                fn ($query) => $query->whereIn('ngaji_schedule_id', $scheduleIds),
                fn ($query) => $query->whereRaw('1 = 0'),
            )
            ->where('is_cancelled', false)
            ->get();

        return $this->formatNgajiSummary(
            $rows,
            $schedules->count(),
            $this->expectedNgajiStudentCount($schedules),
        );
    }

    private function buildWaliNgajiSummary($anakIds, string $today): array
    {
        $childIds = collect($anakIds)->map(fn ($id) => (int) $id)->filter()->values()->all();
        $schedules = NgajiSchedule::query()
            ->where('status', 'Aktif')
            ->get()
            ->filter(fn (NgajiSchedule $schedule) => $this->ngajiStudentCountForSchedule($schedule, $childIds) > 0)
            ->values();

        $rows = AbsensiNgaji::query()
            ->with(['siswa:id,nama,nis,kelas', 'session:id,name', 'book:id,name', 'schedule.teacher:id,name'])
            ->whereDate('tanggal', $today)
            ->when(
                !empty($childIds),
                fn ($query) => $query->whereIn('siswa_id', $childIds),
                fn ($query) => $query->whereRaw('1 = 0'),
            )
            ->where('is_cancelled', false)
            ->orderByDesc('created_at')
            ->get();

        return $this->formatNgajiSummary(
            $rows,
            $schedules->count(),
            $this->expectedNgajiStudentCount($schedules, $childIds),
        );
    }

    private function expectedNgajiStudentCount($schedules, ?array $onlyStudentIds = null): int
    {
        return collect($schedules)->sum(fn (NgajiSchedule $schedule) => $this->ngajiStudentCountForSchedule($schedule, $onlyStudentIds));
    }

    private function ngajiStudentCountForSchedule(NgajiSchedule $schedule, ?array $onlyStudentIds = null): int
    {
        $filterStudents = function ($query) use ($onlyStudentIds) {
            if (!empty($onlyStudentIds)) {
                $query->whereIn('siswa_id', $onlyStudentIds);
            }
        };

        if ($schedule->boarding_room_id) {
            return SantriPondok::query()
                ->where('status', 'Aktif')
                ->where('boarding_room_id', $schedule->boarding_room_id)
                ->when(!empty($onlyStudentIds), $filterStudents)
                ->count();
        }

        if ($schedule->boarding_complex_id) {
            return SantriPondok::query()
                ->where('status', 'Aktif')
                ->where('boarding_complex_id', $schedule->boarding_complex_id)
                ->when(!empty($onlyStudentIds), $filterStudents)
                ->count();
        }

        if ($schedule->class_id) {
            return $this->activeStudentsQuery()
                ->where('class_id', $schedule->class_id)
                ->when(!empty($onlyStudentIds), fn ($query) => $query->whereIn('id', $onlyStudentIds))
                ->count();
        }

        return SantriPondok::query()
            ->where('status', 'Aktif')
            ->when(!empty($onlyStudentIds), $filterStudents)
            ->count();
    }

    private function formatNgajiSummary($rows, int $expectedSchedules, int $expectedTotal = 0): array
    {
        $scheduleDone = $rows
            ->pluck('ngaji_schedule_id')
            ->filter()
            ->unique()
            ->count();
        $attended = $rows->count();
        $present = $rows->where('status_code', 'H')->count();
        $effectiveTotal = max($expectedTotal, $attended);

        return [
            'total' => $attended,
            'expected_total' => $expectedTotal,
            'H' => $present,
            'I' => $rows->where('status_code', 'I')->count(),
            'S' => $rows->where('status_code', 'S')->count(),
            'A' => $rows->where('status_code', 'A')->count(),
            'kosong' => max(0, $expectedTotal - $attended),
            'jadwal_sudah_diabsen' => $scheduleDone,
            'jadwal_belum_diabsen' => max(0, $expectedSchedules - $scheduleDone),
            'persentase_hadir' => $effectiveTotal > 0 ? round(($present / $effectiveTotal) * 100, 2) : 0,
            'terbaru' => $rows->sortByDesc('created_at')->take(5)->map(fn (AbsensiNgaji $row) => [
                'siswa_id' => $row->siswa_id,
                'siswa_nama' => $row->siswa?->nama,
                'nis' => $row->siswa?->nis,
                'kelas' => $row->siswa?->kelas,
                'ngaji_schedule_id' => $row->ngaji_schedule_id,
                'sesi' => $row->session?->name,
                'kitab' => $row->book?->name,
                'status' => $row->status_label,
                'status_code' => $row->status_code,
                'pengajar' => $row->schedule?->teacher?->name,
                'waktu' => $row->created_at?->format('H:i'),
            ])->values(),
        ];
    }

    private function buildAdminPrayerSummary(string $today): array
    {
        $typeCount = $this->activePrayerTypeCount();
        $rows = AbsensiSholat::query()
            ->with(['boardingRoom.complex', 'siswa:id,nama', 'prayerType:id,name'])
            ->whereDate('tanggal', $today)
            ->where('is_cancelled', false)
            ->get();
        $expected = SantriPondok::query()
            ->where('status', 'Aktif')
            ->where('participates_prayer', true);

        return $this->formatPrayerSummary(
            $rows,
            (clone $expected)->whereNotNull('boarding_room_id')->distinct()->count('boarding_room_id') * $typeCount,
            $expected->count() * $typeCount,
        );
    }

    private function buildGuruPrayerSummary(User $guru, string $today): array
    {
        $typeCount = $this->activePrayerTypeCount();
        $allowedRoomIds = $this->guruPrayerRoomIds($guru);
        $rows = AbsensiSholat::query()
            ->with(['boardingRoom.complex', 'siswa:id,nama', 'prayerType:id,name'])
            ->whereDate('tanggal', $today)
            ->whereIn('boarding_room_id', $allowedRoomIds)
            ->where('is_cancelled', false)
            ->get();
        $expected = SantriPondok::query()
            ->where('status', 'Aktif')
            ->where('participates_prayer', true)
            ->whereIn('boarding_room_id', $allowedRoomIds);

        return $this->formatPrayerSummary(
            $rows,
            (clone $expected)->whereNotNull('boarding_room_id')->distinct()->count('boarding_room_id') * $typeCount,
            $expected->count() * $typeCount,
        );
    }

    private function buildWaliPrayerSummary($anakIds, string $today): array
    {
        $typeCount = $this->activePrayerTypeCount();
        $rows = AbsensiSholat::query()
            ->with(['boardingRoom.complex', 'siswa:id,nama', 'prayerType:id,name'])
            ->whereDate('tanggal', $today)
            ->when(
                $anakIds->isNotEmpty(),
                fn ($query) => $query->whereIn('siswa_id', $anakIds),
                fn ($query) => $query->whereRaw('1 = 0'),
            )
            ->where('is_cancelled', false)
            ->orderByDesc('created_at')
            ->get();
        $expected = SantriPondok::query()
            ->where('status', 'Aktif')
            ->where('participates_prayer', true)
            ->when(
                $anakIds->isNotEmpty(),
                fn ($query) => $query->whereIn('siswa_id', $anakIds),
                fn ($query) => $query->whereRaw('1 = 0'),
            );

        return $this->formatPrayerSummary($rows, 0, $expected->count() * $typeCount);
    }

    private function formatPrayerSummary($rows, int $expectedRooms, int $expectedTotal = 0): array
    {
        $roomsDone = $rows
            ->filter(fn (AbsensiSholat $row) => !empty($row->boarding_room_id))
            ->map(fn (AbsensiSholat $row) => $row->boarding_room_id . '|' . ($row->prayer_attendance_type_id ?: 0))
            ->unique()
            ->count();
        $attended = $rows->count();
        $present = $rows->where('status_code', 'M')->count();
        $effectiveTotal = max($expectedTotal, $attended);

        return [
            'total' => $attended,
            'expected_total' => $expectedTotal,
            'M' => $present,
            'I' => $rows->where('status_code', 'I')->count(),
            'S' => $rows->where('status_code', 'S')->count(),
            'kosong' => max(0, $expectedTotal - $attended),
            'kamar_sudah_diabsen' => $roomsDone,
            'kamar_belum_diabsen' => max(0, $expectedRooms - $roomsDone),
            'persentase_hadir' => $effectiveTotal > 0 ? round(($present / $effectiveTotal) * 100, 2) : 0,
            'terbaru' => $rows->sortByDesc('created_at')->take(5)->map(fn (AbsensiSholat $row) => [
                'siswa_id' => $row->siswa_id,
                'siswa_nama' => $row->siswa?->nama,
                'prayer_attendance_type_id' => $row->prayer_attendance_type_id,
                'jenis_sholat' => $row->prayerType?->name,
                'status' => $row->status_label,
                'status_code' => $row->status_code,
                'komplek' => $row->boardingRoom?->complex?->name,
                'kamar' => $row->boardingRoom?->name,
                'waktu' => $row->created_at?->format('H:i'),
            ])->values(),
        ];
    }

    private function activePrayerTypeCount(): int
    {
        return max(1, PrayerAttendanceType::query()->where('is_active', true)->count());
    }

    private function guruPrayerRoomIds(User $guru): array
    {
        $accessRows = GuruAbsensiSholatAccess::query()
            ->where('user_id', $guru->id)
            ->where('is_active', true)
            ->where(function ($query) {
                $query->where('can_input', true)->orWhere('can_view_rekap', true);
            })
            ->get();

        if ($accessRows->isEmpty()) {
            return [];
        }

        if ($accessRows->contains(fn ($row) => !$row->boarding_room_id && !$row->boarding_complex_id)) {
            return BoardingRoom::query()->pluck('id')->all();
        }

        $roomIds = $accessRows->pluck('boarding_room_id')->filter()->map(fn ($id) => (int) $id);
        $complexIds = $accessRows->whereNull('boarding_room_id')->pluck('boarding_complex_id')->filter();
        if ($complexIds->isNotEmpty()) {
            $roomIds = $roomIds->merge(
                BoardingRoom::query()->whereIn('boarding_complex_id', $complexIds)->pluck('id')->map(fn ($id) => (int) $id)
            );
        }

        return $roomIds->unique()->values()->all();
    }

    private function resolveAbsensiStatus(?string $inputVia): string
    {
        return $inputVia === 'offline' ? 'pending' : 'completed';
    }

    private function withPermissions(array $payload, User $actor): array
    {
        $payload['permissions'] = $this->permissionService->permissionsForUser($actor);
        $payload['notifications'] = [
            'unread_count' => AppNotification::query()
                ->where('user_id', $actor->id)
                ->where('is_read', false)
                ->count(),
        ];

        return $payload;
    }

}
