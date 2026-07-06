<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Absensi;
use App\Models\AppNotification;
use App\Models\Jadwal;
use App\Models\User;
use App\Services\ActorResolver;
use App\Services\AuditLogService;
use App\Services\GuruAttendanceStatusService;
use App\Services\ReferenceResolver;
use App\Services\WhatsAppNotificationService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AbsensiController extends Controller
{
    public function index(Request $request)
    {
        $query = Absensi::with('siswa');

        if ($request->has('tanggal')) {
            $query->where('tanggal', $request->tanggal);
        } else {
            $query->where('tanggal', now()->toDateString());
        }

        if ($request->filled('class_id')) {
            $query->where('class_id', $request->integer('class_id'));
        } elseif ($request->has('kelas')) {
            $classId = app(ReferenceResolver::class)->classId($request->kelas, false);
            $classId ? $query->where('class_id', $classId) : $query->whereRaw('1 = 0');
        }

        if ($request->filled('mapel_id')) {
            $query->where('mapel_id', $request->integer('mapel_id'));
        } elseif ($request->has('mapel')) {
            $mapelId = app(ReferenceResolver::class)->subjectId($request->mapel);
            $mapelId ? $query->where('mapel_id', $mapelId) : $query->whereRaw('1 = 0');
        }

        if ($request->filled('jadwal_id')) {
            $query->where('jadwal_id', $request->integer('jadwal_id'));
        }

        if ($request->filled('attendance_status_id')) {
            $query->where('attendance_status_id', $request->integer('attendance_status_id'));
        } elseif ($request->has('status')) {
            $statusId = app(ReferenceResolver::class)->attendanceStatusId($this->normalizeStatusValue($request->status));
            $statusId ? $query->where('attendance_status_id', $statusId) : $query->whereRaw('1 = 0');
        }

        $data = $query->orderBy('created_at', 'desc')->get();

        return response()->json([
            'success' => true,
            'stats' => [
                'total' => $data->count(),
                'hadir' => $data->where('status', 'Hadir')->count(),
                'izin' => $data->where('status', 'Izin')->count(),
                'sakit' => $data->where('status', 'Sakit')->count(),
                'alfa' => $data->where('status', 'Alfa')->count(),
            ],
            'data' => $data,
        ]);
    }

    public function store(Request $request)
    {
        $this->normalizeStatusRequest($request);

        $validated = $request->validate([
            'siswa_id' => 'required|exists:siswa,id',
            'tanggal' => 'required|date',
            'status' => 'required|in:Hadir,Izin,Sakit,Alfa,H,S,I,A',
            'keterangan' => 'nullable|string',
            'kelas' => 'nullable|string',
            'class_id' => 'required|integer|exists:classes,id',
            'mapel' => 'nullable|string',
            'mapel_id' => 'required|integer|exists:mata_pelajaran,id',
            'jadwal_id' => 'nullable|integer|exists:jadwal,id',
            'diinput_oleh' => 'nullable|string',
            'diinput_via' => 'nullable|in:online,offline_sync',
            'device_id' => 'nullable|string',
            'actor_user_id' => 'nullable|integer|exists:users,id',
            'user_id' => 'nullable|integer|exists:users,id',
        ]);

        $actor = $this->resolveActor($request);
        if (!$actor) {
            return $this->invalidActorResponse();
        }

        if (!$this->canInputAbsensi($actor)) {
            return $this->forbiddenResponse('Hanya admin atau guru aktif yang boleh menginput absensi');
        }

        $validated['diinput_oleh'] = $this->formatActorLabel($actor);
        $validated['actor_user_id'] = $actor->id;
        unset($validated['user_id']);

        $payload = $this->prepareWritePayload($validated);
        $this->assertActorCanUseSchedule($actor, $payload);
        $result = DB::transaction(function () use ($payload) {
            $existing = $this->findExistingAbsensi($payload);
            if ($existing) {
                return ['conflict' => true, 'absensi' => $existing->fresh()];
            }

            return ['conflict' => false, 'absensi' => Absensi::create($payload)];
        });

        if ($result['conflict']) {
            return $this->attendanceConflictResponse($result['absensi']);
        }

        app(AuditLogService::class)->record($request, 'absensi', 'create', $result['absensi'], null, $result['absensi']->toArray());
        $this->notifyGuardiansForAbsensi(collect([$result['absensi']]));

        return response()->json([
            'success' => true,
            'created' => true,
            'message' => 'Absensi berhasil dicatat',
            'data' => $result['absensi']->load('siswa'),
        ], 201);
    }

    public function storeBulk(Request $request)
    {
        $this->normalizeStatusRequest($request);

        $validated = $request->validate([
            'absensi' => 'required|array',
            'absensi.*.siswa_id' => 'required|integer',
            'absensi.*.tanggal' => 'required|date',
            'absensi.*.status' => 'required|in:Hadir,Izin,Sakit,Alfa,H,S,I,A',
            'absensi.*.keterangan' => 'nullable|string',
            'absensi.*.kelas' => 'nullable|string',
            'absensi.*.class_id' => 'required|integer',
            'absensi.*.mapel' => 'nullable|string',
            'absensi.*.mapel_id' => 'required|integer',
            'absensi.*.jadwal_id' => 'nullable|integer',
            'absensi.*.diinput_oleh' => 'nullable|string',
            'absensi.*.diinput_via' => 'nullable|in:online,offline_sync',
            'absensi.*.device_id' => 'nullable|string',
            'actor_user_id' => 'nullable|integer',
            'user_id' => 'nullable|integer',
        ]);

        $actor = $this->resolveActor($request);
        if (!$actor) {
            return $this->invalidActorResponse();
        }

        if (!$this->canInputAbsensi($actor)) {
            return $this->forbiddenResponse('Hanya admin atau guru aktif yang boleh menginput absensi');
        }

        $resolver = app(ReferenceResolver::class);
        $statusIds = collect($validated['absensi'])
            ->pluck('status')
            ->unique()
            ->mapWithKeys(fn ($status) => [$status => $resolver->attendanceStatusId($status)]);

        $now = now();
        $actorLabel = $this->formatActorLabel($actor);
        $payloads = [];
        $failed = [];

        foreach ($validated['absensi'] as $index => $item) {
            try {
                $payload = [
                    'siswa_id' => (int) $item['siswa_id'],
                    'tanggal' => Carbon::parse($item['tanggal'])->toDateString(),
                    'status' => $item['status'],
                    'attendance_status_id' => $statusIds[$item['status']] ?? null,
                    'keterangan' => $item['keterangan'] ?? null,
                    'kelas' => $item['kelas'] ?? null,
                    'class_id' => (int) $item['class_id'],
                    'mapel' => $item['mapel'] ?? null,
                    'mapel_id' => (int) $item['mapel_id'],
                    'jadwal_id' => !empty($item['jadwal_id']) ? (int) $item['jadwal_id'] : null,
                    'diinput_oleh' => $actorLabel,
                    'actor_user_id' => $actor->id,
                    'diinput_via' => $item['diinput_via'] ?? 'online',
                    'device_id' => $item['device_id'] ?? null,
                    'synced_at' => $now,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
                $this->assertCompleteAttendanceScope($payload);
                $this->assertActorCanUseSchedule($actor, $payload);
                $payload['attendance_key'] = $this->attendanceKey($payload);
                $payloads[$index] = $payload;
            } catch (ValidationException $exception) {
                $failed[] = [
                    'index' => $index,
                    'siswa_id' => $item['siswa_id'] ?? null,
                    'message' => collect($exception->errors())->flatten()->first(),
                ];
            }
        }

        $existingByKey = Absensi::query()
            ->whereIn('attendance_key', collect($payloads)->pluck('attendance_key')->all())
            ->get()
            ->keyBy('attendance_key');

        $createdResponse = collect();
        $updatedResponse = collect();

        foreach ($payloads as $index => $payload) {
            try {
                $existing = $existingByKey->get($payload['attendance_key']);
                if ($existing) {
                    if (!$this->canModifyAbsensi($existing, $actor, '', '')) {
                        $failed[] = $this->attendanceConflictPayload($existing, $index, $payload['siswa_id'] ?? null);
                        continue;
                    }

                    DB::table('absensi')
                        ->where('id', $existing->id)
                        ->update(collect($payload)
                            ->only(['status', 'attendance_status_id', 'keterangan', 'diinput_oleh', 'actor_user_id', 'diinput_via', 'device_id', 'synced_at', 'updated_at'])
                            ->all());
                    $updatedResponse->push(['id' => $existing->id, 'siswa_id' => $payload['siswa_id']]);
                    continue;
                }

                $id = DB::table('absensi')->insertGetId($payload);
                $createdResponse->push(['id' => $id, 'siswa_id' => $payload['siswa_id']]);
            } catch (\Throwable $exception) {
                $failed[] = [
                    'index' => $index,
                    'siswa_id' => $payload['siswa_id'] ?? null,
                    'message' => $exception->getMessage(),
                ];
            }
        }

        if ($createdResponse->isNotEmpty()) {
            try {
                $createdAbsensi = Absensi::query()
                    ->whereIn('id', $createdResponse->pluck('id')->all())
                    ->get();
                $this->notifyGuardiansForAbsensi($createdAbsensi);
            } catch (\Throwable $exception) {
                report($exception);
            }
        }

        return response()->json([
            'success' => true,
            'message' => $createdResponse->count() . ' absensi baru, ' . $updatedResponse->count() . ' diperbarui, ' . count($failed) . ' gagal/konflik',
            'created' => $createdResponse->values(),
            'updated' => $updatedResponse->values(),
            'failed' => $failed,
        ], $createdResponse->isNotEmpty() ? 201 : 200);
    }

    public function update(Request $request, Absensi $absensi)
    {
        $this->normalizeStatusRequest($request);

        $validated = $request->validate([
            'status' => 'sometimes|in:Hadir,Izin,Sakit,Alfa,H,S,I,A',
            'attendance_status_id' => 'nullable|integer|exists:attendance_statuses,id',
            'keterangan' => 'nullable|string',
            'diinput_oleh' => 'nullable|string',
            'actor_role' => 'nullable|string',
            'actor_name' => 'nullable|string',
            'actor_user_id' => 'nullable|integer|exists:users,id',
            'user_id' => 'nullable|integer|exists:users,id',
        ]);

        $actor = $this->resolveActor($request);
        if (($request->filled('actor_user_id') || $request->filled('user_id')) && !$actor) {
            return $this->invalidActorResponse();
        }

        $actorRole = strtolower($validated['actor_role'] ?? '');
        $actorName = $validated['actor_name'] ?? '';

        if ($actor && !$this->actorMatchesDeclaration($actor, $validated['actor_role'] ?? null, $validated['actor_name'] ?? null)) {
            return $this->forbiddenResponse('Identitas pengubah absensi tidak sesuai dengan sesi pengguna');
        }

        if (!$this->canModifyAbsensi($absensi, $actor, $actorRole, $actorName)) {
            return $this->forbiddenResponse('Anda hanya bisa mengubah absensi milik sendiri');
        }

        if ($actor && $this->canInputAbsensi($actor)) {
            if (empty($absensi->diinput_oleh)) {
                $validated['diinput_oleh'] = $this->formatActorLabel($actor);
            } else {
                unset($validated['diinput_oleh']);
            }

            if (empty($absensi->actor_user_id)) {
                $validated['actor_user_id'] = $actor->id;
            } else {
                unset($validated['actor_user_id']);
            }
        }

        unset($validated['actor_role'], $validated['actor_name'], $validated['user_id']);
        $validated = $this->normalizeReferences($validated);
        $before = $absensi->toArray();
        $absensi->update($validated);
        app(AuditLogService::class)->record($request, 'absensi', 'update', $absensi, $before, $absensi->fresh()->toArray());

        return response()->json([
            'success' => true,
            'message' => 'Absensi berhasil diupdate',
            'data' => $absensi->load('siswa'),
        ]);
    }

    public function destroy(Request $request, Absensi $absensi)
    {
        $request->validate([
            'actor_user_id' => 'nullable|integer|exists:users,id',
            'user_id' => 'nullable|integer|exists:users,id',
            'actor_role' => 'nullable|string',
            'actor_name' => 'nullable|string',
        ]);

        $actor = $this->resolveActor($request);
        if (($request->filled('actor_user_id') || $request->filled('user_id')) && !$actor) {
            return $this->invalidActorResponse();
        }

        $actorRole = strtolower($request->query('actor_role', ''));
        $actorName = $request->query('actor_name', '');

        if ($actor && !$this->actorMatchesDeclaration($actor, $request->query('actor_role'), $request->query('actor_name'))) {
            return $this->forbiddenResponse('Identitas pembatal absensi tidak sesuai dengan sesi pengguna');
        }

        if (!$this->canModifyAbsensi($absensi, $actor, $actorRole, $actorName)) {
            return $this->forbiddenResponse('Anda hanya bisa membatalkan absensi milik sendiri');
        }

        $nama = $absensi->siswa ? $absensi->siswa->nama : 'Siswa';
        $before = $absensi->toArray();
        $absensi->delete();
        app(AuditLogService::class)->record($request, 'absensi', 'cancel', $absensi, $before, null, [
            'siswa_nama' => $nama,
        ]);

        return response()->json([
            'success' => true,
            'message' => "Absensi $nama berhasil dibatalkan",
        ]);
    }

    public function rekap(Request $request)
    {
        $request->validate([
            'bulan' => 'required|integer|between:1,12',
            'tahun' => 'required|integer',
            'kelas' => 'nullable|string',
            'class_id' => 'nullable|integer|exists:classes,id',
            'tanggal_mulai' => 'nullable|date',
            'tanggal_akhir' => 'nullable|date',
        ]);

        $query = Absensi::with('siswa')
            ->whereMonth('tanggal', $request->bulan)
            ->whereYear('tanggal', $request->tahun);

        if ($request->filled('class_id')) {
            $query->where('class_id', $request->integer('class_id'));
        } elseif ($request->has('kelas')) {
            $classId = app(ReferenceResolver::class)->classId($request->kelas, false);
            $classId ? $query->where('class_id', $classId) : $query->whereRaw('1 = 0');
        }

        if ($request->tanggal_mulai) {
            $query->where('tanggal', '>=', $request->tanggal_mulai);
        }
        if ($request->tanggal_akhir) {
            $query->where('tanggal', '<=', $request->tanggal_akhir);
        }

        $data = $query
            ->whereNotNull('class_id')
            ->whereNotNull('mapel_id')
            ->orderBy('tanggal')
            ->get();

        $grouped = $data->groupBy(function ($item) {
            return $item->siswa_id . '_' . $item->mapel_id;
        })->map(function ($items) {
            $siswa = $items->first()->siswa;
            return [
                'siswa' => $siswa,
                'kelas' => $items->first()->kelas ?? ($siswa ? $siswa->kelas : '-'),
                'mapel' => $items->first()->mapel ?? '-',
                'absensi' => $items->map(fn ($a) => [
                    'tanggal' => $a->tanggal->format('Y-m-d'),
                    'hari' => $a->tanggal->format('d'),
                    'status' => $a->status,
                ])->values(),
                'total_hadir' => $items->where('status', 'Hadir')->count(),
                'total_izin' => $items->where('status', 'Izin')->count(),
                'total_sakit' => $items->where('status', 'Sakit')->count(),
                'total_alfa' => $items->where('status', 'Alfa')->count(),
                'diinput_oleh' => $items->last()->diinput_oleh ?? 'Admin',
            ];
        })->values();

        return response()->json([
            'success' => true,
            'bulan' => $request->bulan,
            'tahun' => $request->tahun,
            'data' => $grouped,
        ]);
    }

    private function prepareWritePayload(array $payload): array
    {
        $payload = $this->normalizeReferences($payload);
        $this->assertCompleteAttendanceScope($payload);
        $payload['attendance_key'] = $this->attendanceKey($payload);
        $payload['synced_at'] = now();

        return $payload;
    }

    private function findExistingAbsensi(array $payload): ?Absensi
    {
        $existing = Absensi::query()
            ->where('attendance_key', $payload['attendance_key'])
            ->lockForUpdate()
            ->first();

        if (!$existing) {
            $existing = Absensi::query()
                ->where('siswa_id', $payload['siswa_id'])
                ->whereDate('tanggal', $payload['tanggal'])
                ->where('class_id', $payload['class_id'])
                ->where('mapel_id', $payload['mapel_id'])
                ->where('jadwal_id', $payload['jadwal_id'])
                ->lockForUpdate()
                ->first();
        }

        return $existing;
    }

    private function attendanceConflictResponse(Absensi $existing)
    {
        return response()->json([
            'success' => false,
            'conflict' => true,
            'message' => $this->attendanceConflictMessage($existing),
            'data' => $existing->load('siswa'),
        ], 409);
    }

    private function attendanceConflictPayload(Absensi $existing, int $index, ?int $siswaId): array
    {
        return [
            'index' => $index,
            'siswa_id' => $siswaId,
            'conflict' => true,
            'message' => $this->attendanceConflictMessage($existing),
            'existing_id' => $existing->id,
            'diinput_oleh' => $existing->diinput_oleh,
            'waktu' => optional($existing->created_at)->format('H:i:s'),
        ];
    }

    private function attendanceConflictMessage(Absensi $existing): string
    {
        $actor = $existing->diinput_oleh ?: 'pengguna lain';
        $time = optional($existing->created_at)->format('H:i:s') ?: '-';

        return "Absensi sudah masuk server oleh {$actor} pada {$time}. Data offline tidak menimpa data server.";
    }

    private function normalizeStatusRequest(Request $request): void
    {
        if ($request->has('status')) {
            $request->merge(['status' => $this->normalizeStatusValue($request->input('status'))]);
        }

        if ($request->has('absensi')) {
            $items = collect($request->input('absensi', []))
                ->map(function ($item) {
                    if (is_array($item) && array_key_exists('status', $item)) {
                        $item['status'] = $this->normalizeStatusValue($item['status']);
                    }

                    return $item;
                })
                ->all();
            $request->merge(['absensi' => $items]);
        }
    }

    private function normalizeStatusValue(mixed $status): string
    {
        return match (strtoupper(trim((string) $status))) {
            'H' => 'Hadir',
            'S' => 'Sakit',
            'I' => 'Izin',
            'A' => 'Alfa',
            default => trim((string) $status),
        };
    }

    private function assertCompleteAttendanceScope(array $payload): void
    {
        $missing = [];
        foreach (['siswa_id', 'tanggal', 'class_id', 'mapel_id'] as $field) {
            if (empty($payload[$field])) {
                $missing[$field] = ["Data $field wajib dipilih dari master data sebelum menyimpan absensi."];
            }
        }

        if ($missing) {
            throw ValidationException::withMessages($missing);
        }
    }

    private function attendanceKey(array $payload): string
    {
        $key = Absensi::buildAttendanceKey(
            $payload['tanggal'] ?? null,
            $payload['class_id'] ?? null,
            $payload['mapel_id'] ?? null,
            $payload['jadwal_id'] ?? null,
            $payload['siswa_id'] ?? null,
        );

        if (!$key) {
            throw ValidationException::withMessages([
                'attendance_key' => ['Identitas absensi belum lengkap. Pilih kelas, mapel, siswa, dan tanggal yang valid.'],
            ]);
        }

        return $key;
    }

    private function resolveActor(Request $request): ?User
    {
        return app(ActorResolver::class)->active($request, ['actor_user_id', 'user_id']);
    }

    private function normalizeReferences(array $payload): array
    {
        $resolver = app(ReferenceResolver::class);
        $payload = $this->normalizeScheduleReference($payload, $resolver);

        $payload['class_id'] = $payload['class_id'] ?? $resolver->classId($payload['kelas'] ?? null, false);
        $payload['mapel_id'] = $payload['mapel_id'] ?? $resolver->subjectId($payload['mapel'] ?? null);
        $payload['attendance_status_id'] = $payload['attendance_status_id'] ?? $resolver->attendanceStatusId($payload['status'] ?? null);

        if (!empty($payload['kelas']) && empty($payload['class_id'])) {
            throw ValidationException::withMessages([
                'kelas' => ['Kelas tidak ditemukan di master kelas. Pilih kelas resmi, jangan ketik bebas.'],
            ]);
        }

        if (!empty($payload['mapel']) && empty($payload['mapel_id'])) {
            throw ValidationException::withMessages([
                'mapel' => ['Mata pelajaran tidak ditemukan di master mapel. Pilih mapel resmi, jangan ketik bebas.'],
            ]);
        }

        if (!empty($payload['status']) && empty($payload['attendance_status_id'])) {
            throw ValidationException::withMessages([
                'status' => ['Status absensi tidak ditemukan di master status.'],
            ]);
        }

        $payload['kelas'] = $resolver->className($payload['class_id'] ?? null) ?? ($payload['kelas'] ?? null);
        $payload['mapel'] = $resolver->subjectName($payload['mapel_id'] ?? null) ?? ($payload['mapel'] ?? null);
        $payload['status'] = $resolver->attendanceStatusName($payload['attendance_status_id'] ?? null) ?? ($payload['status'] ?? null);

        return $payload;
    }

    private function normalizeScheduleReference(array $payload, ReferenceResolver $resolver): array
    {
        if (empty($payload['jadwal_id'])) {
            return $payload;
        }

        $jadwal = Jadwal::query()->find($payload['jadwal_id']);
        if (!$jadwal) {
            throw ValidationException::withMessages([
                'jadwal_id' => ['Jadwal tidak ditemukan.'],
            ]);
        }

        if ($jadwal->status !== 'Aktif') {
            throw ValidationException::withMessages([
                'jadwal_id' => ['Jadwal ini sedang nonaktif. Pilih jadwal aktif dari admin.'],
            ]);
        }

        $classId = $payload['class_id'] ?? $resolver->classId($payload['kelas'] ?? null, false);
        $mapelId = $payload['mapel_id'] ?? $resolver->subjectId($payload['mapel'] ?? null);

        if ($classId && $jadwal->class_id && (int) $classId !== (int) $jadwal->class_id) {
            throw ValidationException::withMessages([
                'jadwal_id' => ['Kelas absensi tidak sesuai dengan jadwal yang dipilih.'],
            ]);
        }

        if ($mapelId && (int) $mapelId !== (int) $jadwal->mapel_id) {
            throw ValidationException::withMessages([
                'jadwal_id' => ['Mata pelajaran absensi tidak sesuai dengan jadwal yang dipilih.'],
            ]);
        }

        $payload['class_id'] = $classId ?: $jadwal->class_id;
        $payload['mapel_id'] = $mapelId ?: $jadwal->mapel_id;

        return $payload;
    }

    private function assertActorCanUseSchedule(User $actor, array $payload): void
    {
        if ($actor->role === 'admin') {
            return;
        }

        if ($actor->role !== 'guru') {
            throw ValidationException::withMessages([
                'actor_user_id' => ['Hanya admin atau guru yang boleh menginput absensi.'],
            ]);
        }

        // Versi skripsi: Guru tidak wajib memiliki jadwal untuk absensi.
        return;

        $jadwal = Jadwal::query()
            ->with('mataPelajaran.guru')
            ->find($payload['jadwal_id'] ?? null);

        if (!$jadwal) {
            throw ValidationException::withMessages([
                'jadwal_id' => ['Jadwal tidak ditemukan.'],
            ]);
        }

        $assignedBySchedule = (int) ($jadwal->teacher_id ?? 0) === (int) $actor->id;
        $assignedByMapel = $jadwal->mataPelajaran
            ? $jadwal->mataPelajaran->guru->contains('id', $actor->id)
            : false;

        if (!$assignedBySchedule && !$assignedByMapel) {
            throw ValidationException::withMessages([
                'jadwal_id' => ['Guru hanya bisa menginput absensi pada jadwal yang ditugaskan admin.'],
            ]);
        }

        $this->assertGuruScheduleIsOpen($jadwal, $payload);
    }

    private function assertGuruScheduleIsOpen(Jadwal $jadwal, array $payload): void
    {
        $tanggal = Carbon::parse($payload['tanggal'] ?? now()->toDateString())->startOfDay();
        $offlineSync = ($payload['diinput_via'] ?? '') === 'offline_sync';
        $message = app(GuruAttendanceStatusService::class)->assertOpenForGuru($jadwal, $tanggal, $offlineSync);
        if ($message) {
            $field = str_contains($message, 'tanggal') ? 'tanggal' : 'jadwal_id';
            throw ValidationException::withMessages([
                $field => [$message],
            ]);
        }
    }

    private function normalizeScheduleTime(string $time): string
    {
        $parts = explode(':', $time);
        $hour = str_pad((string) ((int) ($parts[0] ?? 0)), 2, '0', STR_PAD_LEFT);
        $minute = str_pad((string) ((int) ($parts[1] ?? 0)), 2, '0', STR_PAD_LEFT);
        $second = str_pad((string) ((int) ($parts[2] ?? 0)), 2, '0', STR_PAD_LEFT);

        return "{$hour}:{$minute}:{$second}";
    }

    private function canInputAbsensi(User $actor): bool
    {
        return in_array($actor->role, ['admin', 'guru'], true);
    }

    private function canModifyAbsensi(Absensi $absensi, ?User $actor, string $fallbackRole, string $fallbackName): bool
    {
        if ($actor) {
            if ($actor->role === 'admin') {
                return true;
            }

            if ($absensi->actor_user_id) {
                return (int) $absensi->actor_user_id === (int) $actor->id;
            }

            $allowedNames = array_filter([
                $actor->name,
                $this->formatActorLabel($actor),
            ]);

            return in_array($absensi->diinput_oleh, $allowedNames, true);
        }

        return $fallbackRole === 'admin'
            || ($fallbackName !== '' && $absensi->diinput_oleh === $fallbackName);
    }

    private function actorMatchesDeclaration(User $actor, ?string $declaredRole, ?string $declaredName): bool
    {
        if ($declaredRole && strtolower($declaredRole) !== strtolower($actor->role)) {
            return false;
        }

        if (!$declaredName) {
            return true;
        }

        $acceptedNames = array_filter([
            $actor->name,
            $this->formatActorLabel($actor),
        ]);

        return in_array(trim($declaredName), $acceptedNames, true);
    }

    private function formatActorLabel(User $actor): string
    {
        $roleLabel = match ($actor->role) {
            'guru' => 'Guru',
            'wali' => 'Orang Tua',
            default => 'Admin',
        };

        return trim($actor->name) !== ''
            ? $roleLabel . ': ' . trim($actor->name)
            : $roleLabel;
    }

    private function invalidActorResponse()
    {
        return response()->json([
            'success' => false,
            'message' => 'Sesi pengguna tidak valid atau akun sedang nonaktif',
        ], 403);
    }

    private function forbiddenResponse(string $message)
    {
        return response()->json([
            'success' => false,
            'message' => $message,
        ], 403);
    }

    private function notifyGuardiansForAbsensi($rows): void
    {
        $rows = collect($rows)->filter();
        if ($rows->isEmpty()) {
            return;
        }

        foreach ($rows as $row) {
            $row->loadMissing(['siswa.guardianProfile']);
            $student = $row->siswa;
            $userIds = collect([
                $student?->wali_id,
                $student?->guardianProfile?->user_id,
            ])->filter()->unique();

            foreach ($userIds as $userId) {
                AppNotification::query()->create([
                    'user_id' => $userId,
                    'title' => 'Absensi Madin',
                    'message' => sprintf(
                        '%s tercatat %s pada Absensi Madin tanggal %s.',
                        $student?->nama ?? 'Santri',
                        $row->status ?? '-',
                        optional($row->tanggal)->format('Y-m-d') ?? $row->tanggal
                    ),
                    'type' => 'absensi_madin',
                    'data' => [
                        'siswa_id' => $row->siswa_id,
                        'absensi_id' => $row->id,
                        'tanggal' => optional($row->tanggal)->format('Y-m-d') ?? $row->tanggal,
                        'status' => $row->status,
                    ],
                ]);
            }

            app(WhatsAppNotificationService::class)->queueAbsensiMadin($row);
        }
    }
}
