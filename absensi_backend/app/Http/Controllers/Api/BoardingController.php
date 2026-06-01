<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AbsensiSholat;
use App\Models\BoardingComplex;
use App\Models\BoardingRoom;
use App\Models\GuruAbsensiSholatAccess;
use App\Models\SantriPondok;
use App\Models\Siswa;
use App\Models\User;
use App\Services\AuditLogService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class BoardingController extends Controller
{
    public function complexes(Request $request)
    {
        $complexes = BoardingComplex::query()
            ->with(['rooms' => function ($query) use ($request) {
                $query
                    ->withCount(['santriPondok as jumlah_santri' => function ($builder) {
                        $builder->where('status', 'Aktif')->where('participates_prayer', true);
                    }])
                    ->when(!$request->boolean('include_inactive'), fn ($builder) => $builder->where('is_active', true))
                    ->orderBy('sort_order')
                    ->orderBy('name');
            }])
            ->withCount(['santriPondok as jumlah_santri' => function ($builder) {
                $builder->where('status', 'Aktif')->where('participates_prayer', true);
            }])
            ->when(!$request->boolean('include_inactive'), fn ($query) => $query->where('is_active', true))
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $complexes,
        ]);
    }

    public function storeComplex(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255|unique:boarding_complexes,name',
            'description' => 'nullable|string',
            'sort_order' => 'nullable|integer|min:0',
            'is_active' => 'nullable|boolean',
        ]);

        $complex = BoardingComplex::create([
            'name' => trim($validated['name']),
            'description' => $validated['description'] ?? null,
            'sort_order' => $validated['sort_order'] ?? 0,
            'is_active' => $validated['is_active'] ?? true,
        ]);

        app(AuditLogService::class)->record($request, 'boarding', 'create_complex', $complex, null, $complex->toArray());

        return response()->json([
            'success' => true,
            'message' => 'Komplek berhasil ditambahkan',
            'data' => $complex,
        ], 201);
    }

    public function updateComplex(Request $request, BoardingComplex $complex)
    {
        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255', Rule::unique('boarding_complexes', 'name')->ignore($complex->id)],
            'description' => 'nullable|string',
            'sort_order' => 'nullable|integer|min:0',
            'is_active' => 'nullable|boolean',
        ]);

        $before = $complex->toArray();
        if (array_key_exists('name', $validated)) {
            $validated['name'] = trim($validated['name']);
        }
        $complex->update($validated);

        app(AuditLogService::class)->record($request, 'boarding', 'update_complex', $complex, $before, $complex->fresh()->toArray());

        return response()->json([
            'success' => true,
            'message' => 'Komplek berhasil diperbarui',
            'data' => $complex->fresh('rooms'),
        ]);
    }

    public function destroyComplex(Request $request, BoardingComplex $complex)
    {
        $before = $complex->toArray();
        $hasRelations = $complex->rooms()->exists() || $complex->santriPondok()->exists();

        if ($hasRelations) {
            $complex->update(['is_active' => false]);
            $message = 'Komplek sudah dipakai, jadi dinonaktifkan agar data lama tetap aman';
            $action = 'disable_complex';
        } else {
            $complex->delete();
            $message = 'Komplek berhasil dihapus';
            $action = 'delete_complex';
        }

        app(AuditLogService::class)->record($request, 'boarding', $action, $complex, $before, $hasRelations ? $complex->fresh()?->toArray() : null);

        return response()->json([
            'success' => true,
            'message' => $message,
        ]);
    }

    public function storeRoom(Request $request)
    {
        $validated = $request->validate([
            'boarding_complex_id' => 'required|integer|exists:boarding_complexes,id',
            'name' => [
                'required',
                'string',
                'max:255',
                Rule::unique('boarding_rooms', 'name')
                    ->where(fn ($query) => $query->where('boarding_complex_id', $request->integer('boarding_complex_id'))),
            ],
            'capacity' => 'nullable|integer|min:0',
            'description' => 'nullable|string',
            'sort_order' => 'nullable|integer|min:0',
            'is_active' => 'nullable|boolean',
        ]);

        $room = BoardingRoom::create([
            'boarding_complex_id' => $validated['boarding_complex_id'],
            'name' => trim($validated['name']),
            'capacity' => $validated['capacity'] ?? null,
            'description' => $validated['description'] ?? null,
            'sort_order' => $validated['sort_order'] ?? 0,
            'is_active' => $validated['is_active'] ?? true,
        ]);

        app(AuditLogService::class)->record($request, 'boarding', 'create_room', $room, null, $room->toArray());

        return response()->json([
            'success' => true,
            'message' => 'Kamar berhasil ditambahkan',
            'data' => $room->load('complex'),
        ], 201);
    }

    public function updateRoom(Request $request, BoardingRoom $room)
    {
        $complexId = $request->integer('boarding_complex_id') ?: $room->boarding_complex_id;
        $validated = $request->validate([
            'boarding_complex_id' => 'sometimes|integer|exists:boarding_complexes,id',
            'name' => [
                'sometimes',
                'string',
                'max:255',
                Rule::unique('boarding_rooms', 'name')
                    ->where(fn ($query) => $query->where('boarding_complex_id', $complexId))
                    ->ignore($room->id),
            ],
            'capacity' => 'nullable|integer|min:0',
            'description' => 'nullable|string',
            'sort_order' => 'nullable|integer|min:0',
            'is_active' => 'nullable|boolean',
        ]);

        $before = $room->toArray();
        if (array_key_exists('name', $validated)) {
            $validated['name'] = trim($validated['name']);
        }
        $room->update($validated);
        $this->refreshStudentRoomLabels($room);
        $this->refreshAssignmentComplex($room);

        app(AuditLogService::class)->record($request, 'boarding', 'update_room', $room, $before, $room->fresh()->toArray());

        return response()->json([
            'success' => true,
            'message' => 'Kamar berhasil diperbarui',
            'data' => $room->fresh('complex'),
        ]);
    }

    public function destroyRoom(Request $request, BoardingRoom $room)
    {
        $before = $room->toArray();
        $hasRelations = $room->santriPondok()->exists() || $room->siswa()->exists();

        if ($hasRelations) {
            $room->update(['is_active' => false]);
            $message = 'Kamar sudah dipakai, jadi dinonaktifkan agar data lama tetap aman';
            $action = 'disable_room';
        } else {
            $room->delete();
            $message = 'Kamar berhasil dihapus';
            $action = 'delete_room';
        }

        app(AuditLogService::class)->record($request, 'boarding', $action, $room, $before, $hasRelations ? $room->fresh()?->toArray() : null);

        return response()->json([
            'success' => true,
            'message' => $message,
        ]);
    }

    public function assignStudents(Request $request)
    {
        $validated = $request->validate([
            'boarding_room_id' => 'required|integer|exists:boarding_rooms,id',
            'siswa_ids' => 'required|array|min:1',
            'siswa_ids.*' => 'integer|exists:siswa,id',
            'status' => 'nullable|in:Aktif,Nonaktif',
            'is_resident' => 'nullable|boolean',
            'participates_prayer' => 'nullable|boolean',
        ]);

        $room = BoardingRoom::with('complex')->findOrFail($validated['boarding_room_id']);
        $updated = 0;
        $skipped = [];

        DB::transaction(function () use ($validated, $room, &$updated, &$skipped) {
            $students = Siswa::query()->whereIn('id', $validated['siswa_ids'])->get();
            $existingAssignments = SantriPondok::withTrashed()
                ->with(['room.complex'])
                ->whereIn('siswa_id', $students->pluck('id')->all())
                ->get()
                ->keyBy('siswa_id');

            foreach ($students as $student) {
                $existing = $existingAssignments->get($student->id);
                if ($existing && !$existing->trashed() && $existing->status === 'Aktif') {
                    $skipped[] = [
                        'siswa_id' => $student->id,
                        'nama' => $student->nama,
                        'komplek' => $existing->complex?->name ?? $existing->room?->complex?->name,
                        'kamar' => $existing->room?->name,
                        'message' => 'Santri sudah terdaftar aktif. Gunakan Edit untuk pindah kamar.',
                    ];
                    continue;
                }

                $payload = [
                    'boarding_room_id' => $room->id,
                    'boarding_complex_id' => $room->boarding_complex_id,
                    'class_id' => $student->class_id,
                    'status' => $validated['status'] ?? 'Aktif',
                    'is_resident' => $validated['is_resident'] ?? true,
                    'participates_prayer' => $validated['participates_prayer'] ?? true,
                    'ended_at' => ($validated['status'] ?? 'Aktif') === 'Nonaktif' ? now()->toDateString() : null,
                ];

                if ($existing) {
                    $existing->fill($payload);
                    $existing->save();
                    $assignment = $existing;
                } else {
                    $assignment = SantriPondok::create([
                        'siswa_id' => $student->id,
                        ...$payload,
                    ]);
                }

                if ($assignment->trashed()) {
                    $assignment->restore();
                }

                $this->syncLegacyStudentBoarding($student, $room, $validated['status'] ?? 'Aktif');
                $updated++;
            }
        });

        app(AuditLogService::class)->record($request, 'boarding', 'assign_students', $room, null, null, [
            'siswa_ids' => $validated['siswa_ids'],
            'updated_count' => $updated,
        ]);

        return response()->json([
            'success' => empty($skipped),
            'message' => empty($skipped)
                ? "{$updated} santri berhasil ditempatkan ke kamar"
                : "{$updated} santri disimpan, " . count($skipped) . ' dilewati karena sudah terdaftar aktif',
            'updated_count' => $updated,
            'skipped' => $skipped,
        ], empty($skipped) ? 200 : 409);
    }

    public function storeSantri(Request $request)
    {
        $validated = $request->validate([
            'siswa_id' => 'required|integer|exists:siswa,id',
            'boarding_room_id' => 'required|integer|exists:boarding_rooms,id',
            'status' => 'nullable|in:Aktif,Nonaktif',
            'is_resident' => 'nullable|boolean',
            'participates_prayer' => 'nullable|boolean',
            'notes' => 'nullable|string',
        ]);

        $room = BoardingRoom::with('complex')->findOrFail($validated['boarding_room_id']);
        $student = Siswa::findOrFail($validated['siswa_id']);

        $activeExisting = SantriPondok::query()
            ->with(['room.complex', 'complex'])
            ->where('siswa_id', $student->id)
            ->where('status', 'Aktif')
            ->first();
        if ($activeExisting) {
            return response()->json([
                'success' => false,
                'message' => 'Santri sudah terdaftar aktif di '
                    . (($activeExisting->complex?->name ?? $activeExisting->room?->complex?->name) ?: '-')
                    . ' / '
                    . ($activeExisting->room?->name ?: '-')
                    . '. Gunakan Edit untuk pindah kamar.',
            ], 409);
        }

        $assignment = DB::transaction(function () use ($validated, $room, $student) {
            $assignment = SantriPondok::withTrashed()->updateOrCreate(
                ['siswa_id' => $student->id],
                [
                    'boarding_room_id' => $room->id,
                    'boarding_complex_id' => $room->boarding_complex_id,
                    'class_id' => $student->class_id,
                    'status' => $validated['status'] ?? 'Aktif',
                    'is_resident' => $validated['is_resident'] ?? true,
                    'participates_prayer' => $validated['participates_prayer'] ?? true,
                    'notes' => $validated['notes'] ?? null,
                    'ended_at' => ($validated['status'] ?? 'Aktif') === 'Nonaktif' ? now()->toDateString() : null,
                ]
            );
            if ($assignment->trashed()) {
                $assignment->restore();
            }
            $this->syncLegacyStudentBoarding($student, $room, $validated['status'] ?? 'Aktif');

            return $assignment->fresh(['siswa.kelasRef', 'room.complex', 'complex']);
        });

        app(AuditLogService::class)->record($request, 'boarding', 'upsert_santri', $assignment, null, $assignment->toArray());

        return response()->json([
            'success' => true,
            'message' => 'Santri pondok berhasil disimpan',
            'data' => $this->assignmentPayload($assignment),
        ]);
    }

    public function updateSantri(Request $request, SantriPondok $santri)
    {
        $validated = $request->validate([
            'boarding_room_id' => 'sometimes|nullable|integer|exists:boarding_rooms,id',
            'status' => 'nullable|in:Aktif,Nonaktif',
            'is_resident' => 'nullable|boolean',
            'participates_prayer' => 'nullable|boolean',
            'notes' => 'nullable|string',
        ]);

        $before = $santri->toArray();
        $room = array_key_exists('boarding_room_id', $validated) && $validated['boarding_room_id']
            ? BoardingRoom::with('complex')->findOrFail($validated['boarding_room_id'])
            : $santri->room()->with('complex')->first();

        $payload = $validated;
        if ($room) {
            $payload['boarding_room_id'] = $room->id;
            $payload['boarding_complex_id'] = $room->boarding_complex_id;
        }
        $nextStatus = $payload['status'] ?? $santri->status;
        if ($nextStatus === 'Aktif' && !array_key_exists('participates_prayer', $payload)) {
            $payload['participates_prayer'] = true;
        }
        if ($nextStatus === 'Nonaktif') {
            $payload['participates_prayer'] = false;
            $payload['ended_at'] = $santri->ended_at ?: now()->toDateString();
        } else {
            $payload['ended_at'] = null;
        }

        $santri->update($payload);
        $this->syncLegacyStudentBoarding($santri->siswa, $room, $santri->fresh()->status);

        app(AuditLogService::class)->record($request, 'boarding', 'update_santri', $santri, $before, $santri->fresh()->toArray());

        return response()->json([
            'success' => true,
            'message' => 'Santri pondok berhasil diperbarui',
            'data' => $this->assignmentPayload($santri->fresh(['siswa.kelasRef', 'room.complex', 'complex'])),
        ]);
    }

    public function destroySantri(Request $request, SantriPondok $santri)
    {
        $before = $santri->toArray();
        $hasPrayerHistory = AbsensiSholat::query()
            ->where(function ($query) use ($santri) {
                $query->where('santri_pondok_id', $santri->id)
                    ->orWhere(function ($nested) use ($santri) {
                        $nested->where('siswa_id', $santri->siswa_id)
                            ->where('boarding_room_id', $santri->boarding_room_id);
                    });
            })
            ->exists();

        $santri->siswa?->update([
            'status_mondok' => 'tidak_mondok',
            'boarding_room_id' => null,
            'komplek' => null,
            'kamar' => null,
        ]);

        if ($hasPrayerHistory) {
            $santri->update([
                'status' => 'Nonaktif',
                'participates_prayer' => false,
                'ended_at' => now()->toDateString(),
            ]);
            $santri->delete();
            $message = 'Santri pondok diarsipkan karena sudah punya riwayat absensi';
            $action = 'archive_santri';
            $after = $santri->fresh()?->toArray();
        } else {
            $santri->forceDelete();
            $message = 'Relasi santri pondok berhasil dihapus';
            $action = 'delete_santri';
            $after = null;
        }

        app(AuditLogService::class)->record($request, 'boarding', $action, $santri, $before, $after);

        return response()->json([
            'success' => true,
            'message' => $message,
            'archived' => $hasPrayerHistory,
        ]);
    }

    public function students(Request $request)
    {
        $query = SantriPondok::query()
            ->with(['siswa.kelasRef:id,name', 'room.complex', 'complex'])
            ->when(!$request->boolean('include_inactive'), function ($builder) {
                $builder->where('status', 'Aktif')->where('participates_prayer', true);
            });

        if ($request->filled('boarding_room_id')) {
            $query->where('boarding_room_id', $request->integer('boarding_room_id'));
        }
        if ($request->filled('boarding_complex_id')) {
            $query->where('boarding_complex_id', $request->integer('boarding_complex_id'));
        }
        if ($request->filled('search')) {
            $search = '%' . trim((string) $request->search) . '%';
            $query->whereHas('siswa', function ($builder) use ($search) {
                $builder->where('nama', 'ilike', $search)
                    ->orWhere('nis', 'ilike', $search)
                    ->orWhere('nisn', 'ilike', $search)
                    ->orWhere('kelas', 'ilike', $search)
                    ->orWhereHas('kelasRef', fn ($nested) => $nested->where('name', 'ilike', $search));
            });
        }

        return response()->json([
            'success' => true,
            'data' => $query
                ->orderBy('boarding_complex_id')
                ->orderBy('boarding_room_id')
                ->get()
                ->sortBy(fn (SantriPondok $row) => $row->siswa?->nama ?? '')
                ->map(fn (SantriPondok $row) => $this->assignmentPayload($row))
                ->values(),
        ]);
    }

    public function guruAccess(Request $request)
    {
        $rows = GuruAbsensiSholatAccess::query()
            ->with(['user:id,name,email,status', 'complex:id,name', 'room:id,name,boarding_complex_id'])
            ->orderBy('user_id')
            ->orderBy('boarding_complex_id')
            ->orderBy('boarding_room_id')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $rows,
            'guru' => User::query()
                ->where('role', 'guru')
                ->where('status', 'Aktif')
                ->select('id', 'name', 'email', 'status')
                ->orderBy('name')
                ->get(),
        ]);
    }

    public function saveGuruAccess(Request $request)
    {
        $validated = $request->validate([
            'user_id' => 'required|integer|exists:users,id',
            'boarding_complex_id' => 'nullable|integer|exists:boarding_complexes,id',
            'boarding_room_id' => 'nullable|integer|exists:boarding_rooms,id',
            'can_input' => 'nullable|boolean',
            'can_view_rekap' => 'nullable|boolean',
            'can_edit' => 'nullable|boolean',
            'is_active' => 'nullable|boolean',
        ]);

        $guru = User::query()->where('role', 'guru')->findOrFail($validated['user_id']);
        if (!empty($validated['boarding_room_id'])) {
            $room = BoardingRoom::findOrFail($validated['boarding_room_id']);
            $validated['boarding_complex_id'] = $room->boarding_complex_id;
        }

        $row = GuruAbsensiSholatAccess::query()->updateOrCreate(
            [
                'user_id' => $guru->id,
                'boarding_complex_id' => $validated['boarding_complex_id'] ?? null,
                'boarding_room_id' => $validated['boarding_room_id'] ?? null,
            ],
            [
                'can_input' => $validated['can_input'] ?? true,
                'can_view_rekap' => $validated['can_view_rekap'] ?? true,
                'can_edit' => $validated['can_edit'] ?? false,
                'is_active' => $validated['is_active'] ?? true,
            ]
        );

        app(AuditLogService::class)->record($request, 'boarding', 'save_guru_sholat_access', $row, null, $row->toArray());

        return response()->json([
            'success' => true,
            'message' => 'Akses guru absensi sholat berhasil disimpan',
            'data' => $row->fresh(['user:id,name,email,status', 'complex:id,name', 'room:id,name,boarding_complex_id']),
        ]);
    }

    public function deleteGuruAccess(Request $request, GuruAbsensiSholatAccess $access)
    {
        $before = $access->toArray();
        $access->delete();
        app(AuditLogService::class)->record($request, 'boarding', 'delete_guru_sholat_access', $access, $before, null);

        return response()->json([
            'success' => true,
            'message' => 'Akses guru absensi sholat berhasil dihapus',
        ]);
    }

    private function refreshStudentRoomLabels(BoardingRoom $room): void
    {
        $fresh = $room->fresh('complex');
        if (!$fresh) {
            return;
        }

        Siswa::query()
            ->where('boarding_room_id', $fresh->id)
            ->update([
                'komplek' => $fresh->complex?->name,
                'kamar' => $fresh->name,
                'updated_at' => now(),
            ]);
    }

    private function refreshAssignmentComplex(BoardingRoom $room): void
    {
        SantriPondok::query()
            ->where('boarding_room_id', $room->id)
            ->update([
                'boarding_complex_id' => $room->boarding_complex_id,
                'updated_at' => now(),
            ]);
    }

    private function syncLegacyStudentBoarding(?Siswa $student, ?BoardingRoom $room, string $status): void
    {
        if (!$student) {
            return;
        }

        if (!$room || $status === 'Nonaktif') {
            $student->update([
                'status_mondok' => 'tidak_mondok',
                'boarding_room_id' => null,
                'komplek' => null,
                'kamar' => null,
            ]);
            return;
        }

        $student->update([
            'boarding_room_id' => $room->id,
            'komplek' => $room->complex?->name,
            'kamar' => $room->name,
            'status_mondok' => 'mondok',
        ]);
    }

    private function assignmentPayload(SantriPondok $assignment): array
    {
        $student = $assignment->siswa;
        $room = $assignment->room;
        $complex = $assignment->complex ?? $room?->complex;

        return [
            'id' => $assignment->id,
            'siswa_id' => $assignment->siswa_id,
            'boarding_room_id' => $assignment->boarding_room_id,
            'boarding_complex_id' => $assignment->boarding_complex_id,
            'komplek' => $complex?->name,
            'kamar' => $room?->name,
            'status' => $assignment->status,
            'is_resident' => (bool) $assignment->is_resident,
            'participates_prayer' => (bool) $assignment->participates_prayer,
            'notes' => $assignment->notes,
            'siswa' => $student ? $this->studentPayload($student, $assignment) : null,
        ];
    }

    private function studentPayload(Siswa $siswa, ?SantriPondok $assignment = null): array
    {
        $room = $assignment?->room ?? $siswa->boardingRoom;
        $complex = $assignment?->complex ?? $room?->complex;

        return [
            'id' => $siswa->id,
            'nis' => $siswa->nis,
            'nisn' => $siswa->nisn,
            'nama' => $siswa->nama,
            'kelas' => $siswa->kelasRef?->name ?? $siswa->kelas,
            'class_id' => $siswa->class_id,
            'status_siswa' => $siswa->status,
            'status_mondok' => $siswa->status_mondok,
            'boarding_room_id' => $room?->id ?? $siswa->boarding_room_id,
            'kamar' => $room?->name ?? $siswa->kamar,
            'boarding_complex_id' => $complex?->id ?? $room?->boarding_complex_id,
            'komplek' => $complex?->name ?? $siswa->komplek,
            'santri_pondok_id' => $assignment?->id,
            'status_pondok' => $assignment?->status,
        ];
    }
}
