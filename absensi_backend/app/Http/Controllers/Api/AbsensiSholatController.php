<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AppNotification;
use App\Models\AbsensiSholat;
use App\Models\BoardingComplex;
use App\Models\BoardingRoom;
use App\Models\GuruAbsensiSholatAccess;
use App\Models\SantriPondok;
use App\Models\Siswa;
use App\Models\User;
use App\Services\AuditLogService;
use Carbon\Carbon;
use Carbon\CarbonPeriod;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AbsensiSholatController extends Controller
{
    public function context(Request $request)
    {
        $actor = $request->user();
        $validated = $request->validate([
            'tanggal' => 'required|date',
            'boarding_room_id' => 'nullable|integer|exists:boarding_rooms,id',
        ]);

        $students = collect();
        $attendances = collect();
        $room = null;

        if (!empty($validated['boarding_room_id'])) {
            $room = BoardingRoom::with('complex')->find($validated['boarding_room_id']);
            if (!$this->canAccessRoom($actor, $room, 'view')) {
                return response()->json([
                    'success' => false,
                    'message' => 'Anda tidak memiliki akses ke kamar pondok ini',
                ], 403);
            }
            $assignments = SantriPondok::query()
                ->with(['siswa.kelasRef:id,name', 'room.complex', 'complex'])
                ->where('status', 'Aktif')
                ->where('participates_prayer', true)
                ->where('boarding_room_id', $validated['boarding_room_id'])
                ->get();
            $students = $assignments
                ->sortBy(fn (SantriPondok $row) => $row->siswa?->nama ?? '')
                ->values()
                ->map(fn (SantriPondok $row) => $row->siswa?->setRelation('santriPondok', $row))
                ->filter();

            $attendances = AbsensiSholat::query()
                ->with(['actor:id,name,role'])
                ->whereDate('tanggal', $validated['tanggal'])
                ->whereIn('siswa_id', $students->pluck('id'))
                ->where('is_cancelled', false)
                ->get()
                ->keyBy('siswa_id');
        }

        $summary = ['M' => 0, 'I' => 0, 'S' => 0, 'kosong' => 0];
        $rows = $students->map(function (Siswa $siswa) use ($attendances, &$summary) {
            $attendance = $attendances->get($siswa->id);
            $code = $attendance?->status_code;
            if ($code && isset($summary[$code])) {
                $summary[$code]++;
            } else {
                $summary['kosong']++;
            }

            return [
                'siswa' => $this->studentPayload($siswa),
                'absensi' => $attendance ? $this->attendancePayload($attendance) : null,
            ];
        })->values();

        return response()->json([
            'success' => true,
            'data' => [
                'tanggal' => $validated['tanggal'],
                'room' => $room,
                'rows' => $rows,
                'summary' => $summary,
                'status_options' => AbsensiSholat::STATUS_LABELS,
            ],
        ]);
    }

    public function index(Request $request)
    {
        $query = AbsensiSholat::query()
            ->with(['siswa.kelasRef:id,name', 'boardingRoom.complex', 'actor:id,name,role'])
            ->where('is_cancelled', false);

        $this->applyAttendanceScope($query, $request->user(), 'view');

        if ($request->filled('tanggal')) {
            $query->whereDate('tanggal', $request->tanggal);
        }
        if ($request->filled('boarding_room_id')) {
            $query->where('boarding_room_id', $request->integer('boarding_room_id'));
        }
        if ($request->filled('siswa_id')) {
            $query->where('siswa_id', $request->integer('siswa_id'));
        }

        return response()->json([
            'success' => true,
            'data' => $query->orderByDesc('tanggal')->limit((int) $request->input('limit', 300))->get()
                ->map(fn (AbsensiSholat $row) => $this->attendancePayload($row))
                ->values(),
        ]);
    }

    public function storeBulk(Request $request)
    {
        $validated = $request->validate([
            'tanggal' => 'required|date',
            'boarding_room_id' => 'required|integer|exists:boarding_rooms,id',
            'diinput_oleh' => 'nullable|string|max:255',
            'actor_user_id' => 'nullable|integer|exists:users,id',
            'diinput_via' => 'nullable|in:online,offline_sync',
            'device_id' => 'nullable|string|max:255',
            'items' => 'required|array|min:1',
            'items.*.siswa_id' => 'required|integer|exists:siswa,id',
            'items.*.status_code' => 'required|in:M,I,S',
            'items.*.keterangan' => 'nullable|string',
        ]);

        $actor = $request->user();
        if (!$actor || !in_array($actor->role, ['admin', 'guru'], true)) {
            return response()->json([
                'success' => false,
                'message' => 'Hanya admin atau guru aktif yang boleh menginput absensi sholat',
            ], 403);
        }

        if (!empty($validated['actor_user_id']) && (int) $validated['actor_user_id'] !== (int) $actor->id) {
            return response()->json([
                'success' => false,
                'message' => 'Identitas penginput tidak sesuai dengan sesi pengguna',
            ], 403);
        }

        $room = BoardingRoom::with('complex')->findOrFail($validated['boarding_room_id']);
        if (!$this->canAccessRoom($actor, $room, 'input')) {
            return response()->json([
                'success' => false,
                'message' => 'Anda tidak memiliki akses input absensi sholat untuk kamar ini',
            ], 403);
        }

        $assignments = SantriPondok::query()
            ->with('siswa')
            ->where('boarding_room_id', $validated['boarding_room_id'])
            ->where('status', 'Aktif')
            ->where('participates_prayer', true)
            ->whereIn('siswa_id', collect($validated['items'])->pluck('siswa_id')->all())
            ->get()
            ->keyBy('siswa_id');

        foreach ($validated['items'] as $item) {
            if (!$assignments->has($item['siswa_id'])) {
                throw ValidationException::withMessages([
                    'items' => ['Absensi sholat hanya untuk santri pondok aktif di kamar yang dipilih.'],
                ]);
            }
        }

        $created = [];
        $updated = [];
        $failed = [];

        DB::transaction(function () use ($validated, $actor, $request, $assignments, &$created, &$updated, &$failed) {
            foreach ($validated['items'] as $index => $item) {
                $key = AbsensiSholat::buildAttendanceKey(
                    $validated['tanggal'],
                    $item['siswa_id'],
                    $validated['boarding_room_id'],
                );

                $payload = [
                    'siswa_id' => $item['siswa_id'],
                    'santri_pondok_id' => $assignments->get($item['siswa_id'])?->id,
                    'boarding_room_id' => $validated['boarding_room_id'],
                    'tanggal' => $validated['tanggal'],
                    'status_code' => $item['status_code'],
                    'status_label' => AbsensiSholat::STATUS_LABELS[$item['status_code']],
                    'keterangan' => $item['keterangan'] ?? null,
                    'attendance_key' => $key,
                    'diinput_oleh' => $validated['diinput_oleh'] ?? $actor->name,
                    'actor_user_id' => $actor->id,
                    'diinput_via' => $validated['diinput_via'] ?? 'online',
                    'device_id' => $validated['device_id'] ?? null,
                    'synced_at' => ($validated['diinput_via'] ?? null) === 'offline_sync' ? now() : null,
                    'is_cancelled' => false,
                    'cancelled_at' => null,
                    'cancelled_by' => null,
                    'cancel_reason' => null,
                ];

                $existing = AbsensiSholat::query()->where('attendance_key', $key)->first();
                if ($existing && !$this->canModify($existing, $actor)) {
                    $failed[] = [
                        'index' => $index,
                        'siswa_id' => $item['siswa_id'],
                        'message' => 'Absensi sudah diinput oleh akun lain',
                    ];
                    continue;
                }

                if ($existing) {
                    $before = $existing->toArray();
                    $existing->update($payload);
                    $updated[] = $this->attendancePayload($existing->fresh(['siswa', 'boardingRoom.complex']));
                    app(AuditLogService::class)->record($request, 'absensi_sholat', 'update', $existing, $before, $existing->fresh()->toArray());
                } else {
                    $row = AbsensiSholat::create($payload);
                    $created[] = $this->attendancePayload($row->fresh(['siswa', 'boardingRoom.complex']));
                }
            }
        });

        app(AuditLogService::class)->record($request, 'absensi_sholat', 'bulk_upsert', 'bulk_absensi_sholat', null, null, [
            'tanggal' => $validated['tanggal'],
            'boarding_room_id' => $validated['boarding_room_id'],
            'created' => count($created),
            'updated' => count($updated),
            'failed' => count($failed),
        ]);

        $this->notifyGuardiansForPrayerAttendance(collect($created)->merge($updated)->all());

        $status = count($failed) > 0 && count($created) + count($updated) === 0 ? 409 : 200;

        return response()->json([
            'success' => count($failed) === 0,
            'conflict' => count($failed) > 0,
            'message' => count($created) . ' absensi baru, ' . count($updated) . ' diperbarui, ' . count($failed) . ' gagal/konflik',
            'created' => $created,
            'updated' => $updated,
            'failed' => $failed,
        ], $status);
    }

    public function cancel(Request $request)
    {
        $validated = $request->validate([
            'tanggal' => 'required|date',
            'boarding_room_id' => 'required|integer|exists:boarding_rooms,id',
            'reason' => 'nullable|string|max:500',
        ]);

        $actor = $request->user();
        if (!$actor || !in_array($actor->role, ['admin', 'guru'], true)) {
            return response()->json([
                'success' => false,
                'message' => 'Hanya admin atau guru aktif yang boleh membatalkan absensi sholat',
            ], 403);
        }

        $room = BoardingRoom::with('complex')->findOrFail($validated['boarding_room_id']);
        if (!$this->canAccessRoom($actor, $room, 'edit')) {
            return response()->json([
                'success' => false,
                'message' => 'Anda tidak memiliki akses edit absensi sholat untuk kamar ini',
            ], 403);
        }

        $rows = AbsensiSholat::query()
            ->whereDate('tanggal', $validated['tanggal'])
            ->where('boarding_room_id', $room->id)
            ->where('is_cancelled', false)
            ->get();

        if ($rows->isEmpty()) {
            throw ValidationException::withMessages([
                'absensi' => ['Belum ada absensi aktif pada tanggal dan kamar ini.'],
            ]);
        }

        DB::transaction(function () use ($rows, $actor, $validated, $request) {
            foreach ($rows as $row) {
                $before = $row->toArray();
                $row->update([
                    'is_cancelled' => true,
                    'cancelled_at' => now(),
                    'cancelled_by' => $actor->id,
                    'cancel_reason' => $validated['reason'] ?? null,
                ]);
                app(AuditLogService::class)->record($request, 'absensi_sholat', 'cancel', $row, $before, $row->fresh()->toArray());
            }
        });

        return response()->json([
            'success' => true,
            'message' => $rows->count() . ' data absensi sholat dibatalkan',
            'cancelled' => $rows->count(),
        ]);
    }

    public function rekap(Request $request)
    {
        $actor = $request->user();
        $validated = $request->validate([
            'bulan' => 'nullable|integer|min:1|max:12',
            'tahun' => 'nullable|integer|min:2000|max:2100',
            'tanggal_mulai' => 'nullable|date',
            'tanggal_akhir' => 'nullable|date|after_or_equal:tanggal_mulai',
            'boarding_room_id' => 'nullable|integer|exists:boarding_rooms,id',
            'boarding_complex_id' => 'nullable|integer|exists:boarding_complexes,id',
            'siswa_id' => 'nullable|integer|exists:siswa,id',
            'actor_user_id' => 'nullable|integer|exists:users,id',
            'include_cancelled' => 'nullable|boolean',
            'status' => 'nullable|in:M,I,S,Kosong,Dibatalkan',
        ]);

        $start = !empty($validated['tanggal_mulai'])
            ? Carbon::parse($validated['tanggal_mulai'])->startOfDay()
            : Carbon::create(
                (int) ($validated['tahun'] ?? now()->year),
                (int) ($validated['bulan'] ?? now()->month),
                1
            )->startOfDay();
        $end = !empty($validated['tanggal_akhir'])
            ? Carbon::parse($validated['tanggal_akhir'])->startOfDay()
            : $start->copy()->endOfMonth()->startOfDay();
        if ($start->diffInDays($end) > 62) {
            $end = $start->copy()->addDays(62);
        }

        $assignmentsQuery = SantriPondok::query()
            ->with(['siswa.kelasRef:id,name', 'room.complex', 'complex'])
            ->where('status', 'Aktif')
            ->where('participates_prayer', true)
            ->when(!empty($validated['boarding_room_id']), fn ($query) => $query->where('boarding_room_id', $validated['boarding_room_id']))
            ->when(!empty($validated['boarding_complex_id']), fn ($query) => $query->where('boarding_complex_id', $validated['boarding_complex_id']))
            ->when(!empty($validated['siswa_id']), fn ($query) => $query->where('siswa_id', $validated['siswa_id']));

        if ($actor?->role === 'guru') {
            $allowedRoomIds = $this->allowedRoomIds($actor, 'view');
            $assignmentsQuery->whereIn('boarding_room_id', $allowedRoomIds);
        }

        $assignments = $assignmentsQuery->get();
        $attendanceQuery = AbsensiSholat::query()
            ->with(['siswa.kelasRef:id,name', 'boardingRoom.complex', 'actor:id,name,role', 'santriPondok'])
            ->whereBetween('tanggal', [$start->toDateString(), $end->toDateString()])
            ->whereIn('siswa_id', $assignments->pluck('siswa_id')->all());
        if (($validated['status'] ?? null) === 'Dibatalkan') {
            $attendanceQuery->where('is_cancelled', true);
        } elseif (!($validated['include_cancelled'] ?? false)) {
            $attendanceQuery->where('is_cancelled', false);
        }
        if (!empty($validated['boarding_room_id'])) {
            $attendanceQuery->where('boarding_room_id', $validated['boarding_room_id']);
        }
        if (!empty($validated['actor_user_id'])) {
            $attendanceQuery->where('actor_user_id', $validated['actor_user_id']);
        }
        $this->applyAttendanceScope($attendanceQuery, $actor, 'view');
        $attendances = $attendanceQuery->get()->keyBy(fn (AbsensiSholat $row) => $row->tanggal->format('Y-m-d') . '|' . $row->siswa_id . '|' . $row->boarding_room_id);

        $records = collect();
        foreach (CarbonPeriod::create($start, $end) as $date) {
            $dateKey = $date->format('Y-m-d');
            foreach ($assignments as $assignment) {
                $key = $dateKey . '|' . $assignment->siswa_id . '|' . $assignment->boarding_room_id;
                $attendance = $attendances->get($key);
                $status = $attendance?->is_cancelled ? 'Dibatalkan' : ($attendance?->status_code ?? 'Kosong');
                if (!empty($validated['status']) && $validated['status'] !== $status) {
                    continue;
                }
                $records->push([
                    'tanggal' => $dateKey,
                    'siswa_id' => $assignment->siswa_id,
                    'santri_pondok_id' => $assignment->id,
                    'nis' => $assignment->siswa?->nis,
                    'nama' => $assignment->siswa?->nama,
                    'kelas' => $assignment->siswa?->kelasRef?->name ?? $assignment->siswa?->kelas,
                    'boarding_complex_id' => $assignment->boarding_complex_id,
                    'boarding_room_id' => $assignment->boarding_room_id,
                    'komplek' => $assignment->complex?->name ?? $assignment->room?->complex?->name,
                    'kamar' => $assignment->room?->name,
                    'status' => $status,
                    'status_label' => $attendance?->is_cancelled ? 'Dibatalkan' : ($attendance?->status_label ?? 'Kosong'),
                    'diinput_oleh' => $attendance?->diinput_oleh,
                    'actor_user_id' => $attendance?->actor_user_id,
                    'petugas' => $attendance?->actor?->name ?? $attendance?->diinput_oleh,
                    'waktu_input' => $attendance?->created_at?->toIso8601String(),
                    'is_cancelled' => (bool) ($attendance?->is_cancelled ?? false),
                ]);
            }
        }

        $rows = $records
            ->groupBy('siswa_id')
            ->map(function ($items) {
                $first = $items->first();
                return [
                    'siswa_id' => $first['siswa_id'],
                    'nama' => $first['nama'],
                    'kelas' => $first['kelas'],
                    'komplek' => $first['komplek'],
                    'kamar' => $first['kamar'],
                    'M' => $items->where('status', 'M')->count(),
                    'I' => $items->where('status', 'I')->count(),
                    'S' => $items->where('status', 'S')->count(),
                    'Kosong' => $items->where('status', 'Kosong')->count(),
                    'Dibatalkan' => $items->where('status', 'Dibatalkan')->count(),
                    'total' => $items->count(),
                ];
            })
            ->sortBy('nama')
            ->values();

        return response()->json([
            'success' => true,
            'data' => $rows,
            'summary' => [
                'M' => $rows->sum('M'),
                'I' => $rows->sum('I'),
                'S' => $rows->sum('S'),
                'Kosong' => $rows->sum('Kosong'),
                'Dibatalkan' => $rows->sum('Dibatalkan'),
                'total' => $rows->sum('total'),
                'persentase_hadir' => $rows->sum('total') > 0
                    ? round(($rows->sum('M') / max(1, $rows->sum('total') - $rows->sum('Dibatalkan'))) * 100, 2)
                    : 0,
            ],
            'records' => $records->sortBy([['tanggal', 'desc'], ['nama', 'asc']])->values(),
            'periode' => [
                'tanggal_mulai' => $start->toDateString(),
                'tanggal_akhir' => $end->toDateString(),
            ],
        ]);
    }

    private function canModify(AbsensiSholat $attendance, User $actor): bool
    {
        if ($actor->role === 'admin') {
            return true;
        }

        if ((int) $attendance->actor_user_id === (int) $actor->id) {
            return true;
        }

        return $this->canAccessRoom($actor, $attendance->boardingRoom, 'edit');
    }

    private function canAccessRoom(?User $actor, ?BoardingRoom $room, string $ability): bool
    {
        if (!$actor || !$room) {
            return false;
        }
        if ($actor->role === 'admin') {
            return true;
        }
        if ($actor->role !== 'guru') {
            return false;
        }

        $column = match ($ability) {
            'input' => 'can_input',
            'edit' => 'can_edit',
            default => 'can_view_rekap',
        };

        return GuruAbsensiSholatAccess::query()
            ->where('user_id', $actor->id)
            ->where('is_active', true)
            ->where($column, true)
            ->where(function ($query) use ($room) {
                $query->where('boarding_room_id', $room->id)
                    ->orWhere(function ($nested) use ($room) {
                        $nested->whereNull('boarding_room_id')
                            ->where('boarding_complex_id', $room->boarding_complex_id);
                    })
                    ->orWhere(function ($nested) {
                        $nested->whereNull('boarding_room_id')
                            ->whereNull('boarding_complex_id');
                    });
            })
            ->exists();
    }

    private function applyAttendanceScope($query, ?User $actor, string $ability): void
    {
        if (!$actor || $actor->role === 'admin') {
            return;
        }

        if ($actor->role !== 'guru') {
            $query->whereRaw('1 = 0');
            return;
        }

        $allowedRoomIds = $this->allowedRoomIds($actor, $ability);
        $query->whereIn('boarding_room_id', $allowedRoomIds);
    }

    private function allowedRoomIds(User $actor, string $ability): array
    {
        if ($actor->role === 'admin') {
            return BoardingRoom::query()->pluck('id')->all();
        }

        $column = match ($ability) {
            'input' => 'can_input',
            'edit' => 'can_edit',
            default => 'can_view_rekap',
        };

        $accessRows = GuruAbsensiSholatAccess::query()
            ->where('user_id', $actor->id)
            ->where('is_active', true)
            ->where($column, true)
            ->get();

        if ($accessRows->isEmpty()) {
            return [];
        }

        $roomIds = $accessRows->pluck('boarding_room_id')->filter()->map(fn ($id) => (int) $id);
        $complexIds = $accessRows->whereNull('boarding_room_id')->pluck('boarding_complex_id')->filter()->map(fn ($id) => (int) $id);
        $hasGlobal = $accessRows->contains(fn ($row) => !$row->boarding_room_id && !$row->boarding_complex_id);

        if ($hasGlobal) {
            return BoardingRoom::query()->pluck('id')->all();
        }

        if ($complexIds->isNotEmpty()) {
            $roomIds = $roomIds->merge(
                BoardingRoom::query()
                    ->whereIn('boarding_complex_id', $complexIds->all())
                    ->pluck('id')
                    ->map(fn ($id) => (int) $id)
            );
        }

        return $roomIds->unique()->values()->all();
    }

    private function notifyGuardiansForPrayerAttendance(array $attendances): void
    {
        $studentIds = collect($attendances)->pluck('siswa_id')->filter()->unique()->values();
        if ($studentIds->isEmpty()) {
            return;
        }

        $students = Siswa::query()
            ->with(['guardianProfile:id,user_id', 'wali:id,name'])
            ->whereIn('id', $studentIds)
            ->get()
            ->keyBy('id');

        foreach ($attendances as $attendance) {
            $student = $students->get($attendance['siswa_id'] ?? null);
            $userIds = collect([
                $student?->wali_id,
                $student?->guardianProfile?->user_id,
            ])->filter()->unique();

            foreach ($userIds as $userId) {
                AppNotification::query()->create([
                    'user_id' => $userId,
                    'title' => 'Absensi Jamaah Sholat',
                    'message' => sprintf(
                        '%s tercatat %s pada Absensi Jamaah Sholat tanggal %s.',
                        $student?->nama ?? 'Santri',
                        $attendance['status_label'] ?? $attendance['status_code'] ?? '-',
                        $attendance['tanggal'] ?? '-'
                    ),
                    'type' => 'absensi_sholat',
                    'data' => [
                        'siswa_id' => $attendance['siswa_id'] ?? null,
                        'absensi_sholat_id' => $attendance['id'] ?? null,
                        'tanggal' => $attendance['tanggal'] ?? null,
                        'status' => $attendance['status_code'] ?? null,
                    ],
                ]);
            }
        }
    }

    private function studentPayload(Siswa $siswa): array
    {
        return [
            'id' => $siswa->id,
            'nis' => $siswa->nis,
            'nama' => $siswa->nama,
            'kelas' => $siswa->kelasRef?->name ?? $siswa->kelas,
            'class_id' => $siswa->class_id,
            'boarding_room_id' => $siswa->santriPondok?->boarding_room_id ?? $siswa->boarding_room_id,
            'kamar' => $siswa->santriPondok?->room?->name ?? $siswa->boardingRoom?->name ?? $siswa->kamar,
            'boarding_complex_id' => $siswa->santriPondok?->boarding_complex_id ?? $siswa->boardingRoom?->boarding_complex_id,
            'komplek' => $siswa->santriPondok?->complex?->name ?? $siswa->boardingRoom?->complex?->name ?? $siswa->komplek,
            'santri_pondok_id' => $siswa->santriPondok?->id,
        ];
    }

    private function attendancePayload(AbsensiSholat $attendance): array
    {
        return [
            'id' => $attendance->id,
            'siswa_id' => $attendance->siswa_id,
            'santri_pondok_id' => $attendance->santri_pondok_id,
            'boarding_room_id' => $attendance->boarding_room_id,
            'tanggal' => $attendance->tanggal?->format('Y-m-d'),
            'status_code' => $attendance->status_code,
            'status_label' => $attendance->status_label,
            'keterangan' => $attendance->keterangan,
            'attendance_key' => $attendance->attendance_key,
            'diinput_oleh' => $attendance->diinput_oleh,
            'actor_user_id' => $attendance->actor_user_id,
            'diinput_via' => $attendance->diinput_via,
            'synced_at' => $attendance->synced_at?->toIso8601String(),
            'is_cancelled' => (bool) $attendance->is_cancelled,
            'cancelled_at' => $attendance->cancelled_at?->toIso8601String(),
            'cancelled_by' => $attendance->cancelled_by,
            'cancel_reason' => $attendance->cancel_reason,
            'created_at' => $attendance->created_at?->toIso8601String(),
            'updated_at' => $attendance->updated_at?->toIso8601String(),
            'siswa' => $attendance->relationLoaded('siswa') && $attendance->siswa
                ? $this->studentPayload($attendance->siswa)
                : null,
        ];
    }
}
