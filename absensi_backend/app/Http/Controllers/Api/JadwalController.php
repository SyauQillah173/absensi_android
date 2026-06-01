<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Jadwal;
use App\Models\MataPelajaran;
use App\Services\MapelAccessService;
use App\Services\ReferenceResolver;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class JadwalController extends Controller
{
    public function index(Request $request)
    {
        $query = Jadwal::with('mataPelajaran');

        if ($request->filled('status')) {
            if ($request->input('status') !== 'Semua') {
                $query->where('status', $request->input('status'));
            }
        } else {
            $query->where('status', 'Aktif');
        }

        if ($request->filled('day_id')) {
            $query->where('day_id', $request->integer('day_id'));
        } elseif ($request->has('hari')) {
            $dayId = app(ReferenceResolver::class)->dayId($request->hari);
            $query->where(function ($builder) use ($request, $dayId) {
                if ($dayId) {
                    $builder->where('day_id', $dayId);
                }
                $builder->orWhere('hari', $request->hari);
            });
        }
        if ($request->filled('class_id')) {
            $query->where('class_id', $request->integer('class_id'));
        } elseif ($request->has('sifir')) {
            $classId = app(ReferenceResolver::class)->classId($request->sifir, false);
            $query->where(function ($builder) use ($request, $classId) {
                if ($classId) {
                    $builder->where('class_id', $classId);
                }
                $builder->orWhere('sifir', $request->sifir);
            });
        }
        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('guru', 'ilike', "%$search%")
                  ->orWhereHas('mataPelajaran', function ($q2) use ($search) {
                      $q2->where('nama', 'ilike', "%$search%");
                  });
            });
        }

        return response()->json([
            'success' => true,
            'data' => $query->orderByRaw("CASE hari
                WHEN 'Ahad' THEN 1
                WHEN 'Senin' THEN 2
                WHEN 'Selasa' THEN 3
                WHEN 'Rabu' THEN 4
                WHEN 'Kamis' THEN 5
                WHEN 'Jumat' THEN 6
                WHEN 'Sabtu' THEN 7
                END")->orderBy('jam_mulai')->get(),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'mapel_id' => 'required|exists:mata_pelajaran,id',
            'teacher_id' => ['nullable', 'integer', Rule::exists('users', 'id')->where('role', 'guru')],
            'guru' => 'required_without:teacher_id|string',
            'day_id' => 'nullable|integer|exists:days,id',
            'hari' => "required_without:day_id|in:Ahad,Senin,Selasa,Rabu,Kamis,Jumat,Sabtu",
            'jam_mulai' => 'required',
            'jam_selesai' => 'required',
            'class_id' => 'nullable|integer|exists:classes,id',
            'sifir' => 'required_without:class_id|string',
            'status' => 'required|in:Aktif,Nonaktif',
        ]);
        $validated = $this->normalizeReferences($validated);

        $this->ensureGuruAttachedToMapel(
            (int) $validated['mapel_id'],
            (int) $validated['teacher_id']
        );
        $this->ensureNoScheduleConflict($validated);

        $jadwal = Jadwal::create($validated);

        return response()->json([
            'success' => true,
            'message' => 'Jadwal berhasil ditambahkan',
            'data' => $jadwal->load('mataPelajaran'),
        ], 201);
    }

    public function show(Jadwal $jadwal)
    {
        return response()->json([
            'success' => true,
            'data' => $jadwal->load('mataPelajaran'),
        ]);
    }

    public function update(Request $request, Jadwal $jadwal)
    {
        $validated = $request->validate([
            'mapel_id' => 'sometimes|exists:mata_pelajaran,id',
            'teacher_id' => ['nullable', 'integer', Rule::exists('users', 'id')->where('role', 'guru')],
            'guru' => 'sometimes|string',
            'day_id' => 'nullable|integer|exists:days,id',
            'hari' => "sometimes|in:Ahad,Senin,Selasa,Rabu,Kamis,Jumat,Sabtu",
            'jam_mulai' => 'sometimes',
            'jam_selesai' => 'sometimes',
            'class_id' => 'nullable|integer|exists:classes,id',
            'sifir' => 'sometimes|required|string',
            'status' => 'sometimes|in:Aktif,Nonaktif',
        ]);
        $validated = $this->normalizeReferences($validated);

        $mapelId = (int) ($validated['mapel_id'] ?? $jadwal->mapel_id);
        $teacherId = (int) (
            $validated['teacher_id']
            ?? $jadwal->teacher_id
            ?? app(ReferenceResolver::class)->teacherIdByName($validated['guru'] ?? $jadwal->guru)
        );
        $this->ensureGuruAttachedToMapel($mapelId, $teacherId);
        $this->ensureNoScheduleConflict([
            'mapel_id' => $mapelId,
            'teacher_id' => $teacherId,
            'day_id' => $validated['day_id'] ?? $jadwal->day_id,
            'hari' => $validated['hari'] ?? $jadwal->hari,
            'jam_mulai' => $validated['jam_mulai'] ?? $jadwal->jam_mulai,
            'jam_selesai' => $validated['jam_selesai'] ?? $jadwal->jam_selesai,
            'class_id' => $validated['class_id'] ?? $jadwal->class_id,
            'sifir' => $validated['sifir'] ?? $jadwal->sifir,
            'status' => $validated['status'] ?? $jadwal->status,
        ], $jadwal->id);

        $jadwal->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'Jadwal berhasil diupdate',
            'data' => $jadwal->load('mataPelajaran'),
        ]);
    }

    public function destroy(Jadwal $jadwal)
    {
        DB::transaction(function () use ($jadwal) {
            app(MapelAccessService::class)->archiveOrDeleteSchedule($jadwal);
        });

        return response()->json([
            'success' => true,
            'message' => 'Jadwal berhasil dihapus',
        ]);
    }

    public function syncGroup(Request $request)
    {
        $validated = $request->validate([
            'mapel_id' => 'required|exists:mata_pelajaran,id',
            'teacher_id' => ['nullable', 'integer', Rule::exists('users', 'id')->where('role', 'guru')],
            'guru' => 'required_without:teacher_id|string',
            'day_id' => 'nullable|integer|exists:days,id',
            'hari' => "required_without:day_id|in:Ahad,Senin,Selasa,Rabu,Kamis,Jumat,Sabtu",
            'jam_mulai' => 'required',
            'jam_selesai' => 'required',
            'status' => 'nullable|in:Aktif,Nonaktif',
            'class_ids' => 'nullable|array',
            'class_ids.*' => 'integer|exists:classes,id',
            'kelas' => 'required|array|min:1',
            'kelas.*' => 'required|string',
            'current_ids' => 'nullable|array',
            'current_ids.*' => 'integer|exists:jadwal,id',
        ]);

        $validated = $this->normalizeReferences($validated);
        $this->ensureGuruAttachedToMapel(
            (int) $validated['mapel_id'],
            (int) $validated['teacher_id']
        );

        $mapel = DB::transaction(function () use ($validated) {
            $mapelId = (int) $validated['mapel_id'];
            $resolver = app(ReferenceResolver::class);
            $targetClasses = collect($validated['kelas'])
                ->map(fn ($kelas) => trim((string) $kelas))
                ->filter()
                ->unique()
                ->map(function (string $kelas) use ($resolver) {
                    $classId = $resolver->classId($kelas, false);
                    if (!$classId) {
                        throw ValidationException::withMessages([
                            'kelas' => ["Kelas {$kelas} tidak ditemukan di master kelas."],
                        ]);
                    }

                    return [
                        'id' => $classId,
                        'name' => $resolver->className($classId),
                    ];
                })
                ->values();

            $currentIds = collect($validated['current_ids'] ?? [])
                ->map(fn ($id) => (int) $id)
                ->filter()
                ->values();

            $status = $validated['status'] ?? 'Aktif';

            $currentRowsQuery = Jadwal::query()->where('mapel_id', $mapelId);

            if ($currentIds->isNotEmpty()) {
                $currentRowsQuery->whereIn('id', $currentIds);
            } else {
                $currentRowsQuery
                    ->where(function ($builder) use ($validated) {
                        if (!empty($validated['teacher_id'])) {
                            $builder->where('teacher_id', $validated['teacher_id']);
                        }
                        $builder->orWhere('guru', $validated['guru']);
                    })
                    ->where(function ($builder) use ($validated) {
                        if (!empty($validated['day_id'])) {
                            $builder->where('day_id', $validated['day_id']);
                        }
                        $builder->orWhere('hari', $validated['hari']);
                    })
                    ->where('jam_mulai', $validated['jam_mulai'])
                    ->where('jam_selesai', $validated['jam_selesai']);
            }

            $existingRows = $currentRowsQuery->get();
            $existingRowsByClass = $existingRows->groupBy(fn (Jadwal $row) => (int) $row->class_id);
            $remainingExistingRows = $existingRows->keyBy('id');
            $ignoreIds = $existingRows->pluck('id')
                ->merge($currentIds)
                ->map(fn ($id) => (int) $id)
                ->filter()
                ->unique()
                ->values()
                ->all();

            $this->ensureNoScheduleConflict([
                'mapel_id' => $mapelId,
                'teacher_id' => $validated['teacher_id'],
                'guru' => $validated['guru'],
                'day_id' => $validated['day_id'] ?? null,
                'hari' => $validated['hari'],
                'jam_mulai' => $validated['jam_mulai'],
                'jam_selesai' => $validated['jam_selesai'],
                'class_id' => $targetClasses->first()['id'] ?? null,
                'sifir' => $targetClasses->first()['name'] ?? null,
                'status' => $status,
            ], $ignoreIds);

            foreach ($targetClasses as $kelas) {
                $classRows = $existingRowsByClass->get((int) $kelas['id'], collect());
                $existing = $classRows->shift();
                $existingRowsByClass[(int) $kelas['id']] = $classRows;

                if ($existing) {
                    $remainingExistingRows->forget($existing->id);
                    $existing->update([
                        'teacher_id' => $validated['teacher_id'] ?? $existing->teacher_id,
                        'guru' => $validated['guru'],
                        'day_id' => $validated['day_id'] ?? $existing->day_id,
                        'hari' => $validated['hari'],
                        'jam_mulai' => $validated['jam_mulai'],
                        'jam_selesai' => $validated['jam_selesai'],
                        'class_id' => $kelas['id'],
                        'sifir' => $kelas['name'],
                        'status' => $status,
                    ]);
                    continue;
                }

                Jadwal::create([
                    'mapel_id' => $mapelId,
                    'teacher_id' => $validated['teacher_id'] ?? null,
                    'guru' => $validated['guru'],
                    'day_id' => $validated['day_id'] ?? null,
                    'hari' => $validated['hari'],
                    'jam_mulai' => $validated['jam_mulai'],
                    'jam_selesai' => $validated['jam_selesai'],
                    'class_id' => $kelas['id'],
                    'sifir' => $kelas['name'],
                    'status' => $status,
                ]);
            }

            foreach ($remainingExistingRows as $orphan) {
                app(MapelAccessService::class)->archiveOrDeleteSchedule($orphan);
            }

            return MataPelajaran::query()->findOrFail($mapelId);
        });

        return response()->json([
            'success' => true,
            'message' => 'Jadwal berhasil disinkronkan',
            'data' => $mapel->load([
                'guru',
                'jadwal' => fn ($query) => $query->where('status', 'Aktif'),
            ]),
        ]);
    }

    public function destroyGroup(Request $request)
    {
        $validated = $request->validate([
            'mapel_id' => 'required|exists:mata_pelajaran,id',
            'jadwal_ids' => 'required|array|min:1',
            'jadwal_ids.*' => 'integer|exists:jadwal,id',
        ]);

        $mapel = DB::transaction(function () use ($validated) {
            Jadwal::query()
                ->where('mapel_id', $validated['mapel_id'])
                ->whereIn('id', $validated['jadwal_ids'])
                ->get()
                ->each(fn (Jadwal $jadwal) => app(MapelAccessService::class)->archiveOrDeleteSchedule($jadwal));

            return MataPelajaran::query()->findOrFail((int) $validated['mapel_id']);
        });

        return response()->json([
            'success' => true,
            'message' => 'Jadwal berhasil dihapus',
            'data' => $mapel->load([
                'guru',
                'jadwal' => fn ($query) => $query->where('status', 'Aktif'),
            ]),
        ]);
    }

    private function ensureGuruAttachedToMapel(int $mapelId, int $teacherId): void
    {
        $mapel = MataPelajaran::query()
            ->with(['guru:id,name'])
            ->findOrFail($mapelId);

        $assignedTeacherIds = $mapel->guru
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->values();

        if ($assignedTeacherIds->isEmpty()) {
            throw ValidationException::withMessages([
                'guru' => 'Belum ada guru pengajar aktif pada mata pelajaran ini.',
            ]);
        }

        if (!$assignedTeacherIds->contains($teacherId)) {
            throw ValidationException::withMessages([
                'guru' => 'Guru pengajar ini tidak lagi terhubung ke mata pelajaran ini.',
            ]);
        }
    }

    private function ensureNoScheduleConflict(array $payload, int|array|null $ignoreId = null): void
    {
        if (($payload['status'] ?? 'Aktif') !== 'Aktif') {
            return;
        }

        $labels = [
            'teacher_id' => 'guru pengajar',
            'day_id' => 'hari',
            'class_id' => 'kelas',
            'jam_mulai' => 'jam mulai',
            'jam_selesai' => 'jam selesai',
        ];

        foreach (['teacher_id', 'day_id', 'class_id', 'jam_mulai', 'jam_selesai'] as $field) {
            if (empty($payload[$field])) {
                throw ValidationException::withMessages([
                    $field => ["Data {$labels[$field]} wajib dipilih dari master data untuk membuat jadwal aktif."],
                ]);
            }
        }

        if ((string) $payload['jam_mulai'] >= (string) $payload['jam_selesai']) {
            throw ValidationException::withMessages([
                'jam_selesai' => ['Jam selesai harus lebih besar dari jam mulai.'],
            ]);
        }

        $base = Jadwal::query()
            ->where('status', 'Aktif')
            ->where('day_id', $payload['day_id'])
            ->where('jam_mulai', '<', $payload['jam_selesai'])
            ->where('jam_selesai', '>', $payload['jam_mulai']);

        $ignoreIds = collect(is_array($ignoreId) ? $ignoreId : [$ignoreId])
            ->map(fn ($id) => (int) $id)
            ->filter()
            ->unique()
            ->values();
        if ($ignoreIds->isNotEmpty()) {
            $base->whereNotIn('id', $ignoreIds);
        }

        $teacherConflict = (clone $base)
            ->where('teacher_id', $payload['teacher_id'])
            ->first();
        if ($teacherConflict) {
            $teacherName = $teacherConflict->guru ?: DB::table('users')->where('id', $payload['teacher_id'])->value('name');
            throw ValidationException::withMessages([
                'teacher_id' => [
                    trim((string) $teacherName) !== ''
                        ? "Guru {$teacherName} sudah memiliki jadwal aktif yang bentrok pada hari dan jam yang sama."
                        : 'Guru ini sudah memiliki jadwal aktif yang bentrok pada hari dan jam yang sama.',
                ],
            ]);
        }
    }

    private function normalizeReferences(array $payload): array
    {
        if (!empty($payload['teacher_id'])) {
            $payload['guru'] = DB::table('users')->where('id', $payload['teacher_id'])->value('name') ?: ($payload['guru'] ?? null);
        } elseif (!empty($payload['guru'])) {
            $payload['teacher_id'] = app(ReferenceResolver::class)->teacherIdByName($payload['guru']);
            if (!$payload['teacher_id']) {
                throw ValidationException::withMessages([
                    'guru' => ['Guru tidak ditemukan di master user guru. Pilih guru resmi, jangan ketik bebas.'],
                ]);
            }
            $payload['guru'] = DB::table('users')->where('id', $payload['teacher_id'])->value('name');
        }
        if (!empty($payload['day_id'])) {
            $payload['hari'] = DB::table('days')->where('id', $payload['day_id'])->value('name') ?: ($payload['hari'] ?? null);
        } elseif (!empty($payload['hari'])) {
            $payload['day_id'] = app(ReferenceResolver::class)->dayId($payload['hari']);
            if (!$payload['day_id']) {
                throw ValidationException::withMessages([
                    'hari' => ['Hari tidak ditemukan di master data. Pilih hari resmi dari daftar aplikasi.'],
                ]);
            }
            $payload['hari'] = DB::table('days')->where('id', $payload['day_id'])->value('name') ?: $payload['hari'];
        }
        if (!empty($payload['class_id'])) {
            $payload['sifir'] = DB::table('classes')->where('id', $payload['class_id'])->value('name') ?: ($payload['sifir'] ?? null);
        } elseif (!empty($payload['sifir'])) {
            $payload['class_id'] = app(ReferenceResolver::class)->classId($payload['sifir'], false);
            if (!$payload['class_id']) {
                throw ValidationException::withMessages([
                    'sifir' => ['Kelas tidak ditemukan di master kelas. Pilih kelas resmi, jangan ketik bebas.'],
                ]);
            }
            $payload['sifir'] = DB::table('classes')->where('id', $payload['class_id'])->value('name');
        }

        return $payload;
    }
}
