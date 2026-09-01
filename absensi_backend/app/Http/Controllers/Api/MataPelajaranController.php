<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MataPelajaran;
use App\Services\ActorResolver;
use App\Services\MapelAccessService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class MataPelajaranController extends Controller
{
    public function __construct(
        private readonly MapelAccessService $mapelAccessService,
    ) {
    }

    public function index(Request $request)
    {
        $actor = app(ActorResolver::class)->active($request);

        $query = $this->mapelAccessService->buildMapelQuery($actor, [
            'status' => $request->input('status'),
            'search' => $request->input('search'),
            'kelas' => $request->input('kelas'),
            'class_id' => $request->input('class_id'),
            'hari' => $request->input('hari'),
            'day_id' => $request->input('day_id'),
            'require_jadwal' => $request->boolean('require_jadwal'),
        ]);

        return response()->json([
            'success' => true,
            'data' => $query->get(),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'nama' => 'required|string',
            'kode' => 'nullable|string|max:10',
            'status' => 'required|in:Aktif,Nonaktif',
            'guru_ids' => 'nullable|array',
            'guru_ids.*' => ['integer', Rule::exists('users', 'id')->where('role', 'guru')],
            'jadwals' => 'nullable|array',
        ]);

        $mapel = DB::transaction(function () use ($validated) {
            $mapel = MataPelajaran::create([
                'nama' => $validated['nama'],
                'kode' => $validated['kode'] ?? null,
                'status' => $validated['status'],
            ]);

            $guruIds = collect($validated['guru_ids'] ?? [])->map(fn ($id) => (int) $id);

            // Sync jadwals if provided
            if (!empty($validated['jadwals']) && is_array($validated['jadwals'])) {
                $this->syncMapelSchedules($mapel, $validated['jadwals'], $guruIds);
            }

            if ($guruIds->isNotEmpty()) {
                $mapel->guru()->sync($guruIds->unique()->values()->all());
            }

            return $mapel;
        });

        return response()->json([
            'success' => true,
            'message' => 'Mata pelajaran dan jadwal berhasil ditambahkan',
            'data' => $this->loadOperationalRelations($mapel),
        ], 201);
    }

    public function show(MataPelajaran $mataPelajaran)
    {
        return response()->json([
            'success' => true,
            'data' => $this->loadOperationalRelations($mataPelajaran),
        ]);
    }

    public function update(Request $request, MataPelajaran $mataPelajaran)
    {
        $validated = $request->validate([
            'nama' => 'sometimes|string',
            'kode' => 'nullable|string|max:10',
            'status' => 'sometimes|in:Aktif,Nonaktif',
            'guru_ids' => 'nullable|array',
            'guru_ids.*' => ['integer', Rule::exists('users', 'id')->where('role', 'guru')],
            'jadwals' => 'nullable|array',
        ]);

        $mapel = DB::transaction(function () use ($validated, $mataPelajaran) {
            $mapel = $mataPelajaran;
            $mapel->update(array_intersect_key($validated, array_flip(['nama', 'kode', 'status'])));

            $guruIds = collect($validated['guru_ids'] ?? $mapel->guru->pluck('id')->all())->map(fn ($id) => (int) $id);

            // Sync jadwals if provided
            if (isset($validated['jadwals']) && is_array($validated['jadwals'])) {
                $this->syncMapelSchedules($mapel, $validated['jadwals'], $guruIds);
            }

            if (isset($validated['guru_ids']) || $guruIds->isNotEmpty()) {
                $mapel->guru()->sync($guruIds->unique()->values()->all());
            }

            return $mapel;
        });

        return response()->json([
            'success' => true,
            'message' => 'Mata pelajaran dan jadwal berhasil diperbarui',
            'data' => $this->loadOperationalRelations($mapel),
        ]);
    }

    private function syncMapelSchedules(MataPelajaran $mapel, array $jadwals, &$guruIds): void
    {
        $resolver = app(\App\Services\ReferenceResolver::class);
        $keptIds = [];

        foreach ($jadwals as $item) {
            if (empty($item['hari']) && empty($item['day_id'])) {
                continue;
            }

            $teacherId = !empty($item['teacher_id']) ? (int) $item['teacher_id'] : null;
            $teacherName = $item['guru'] ?? null;

            if ($teacherId) {
                $teacherName = DB::table('users')->where('id', $teacherId)->value('name') ?: $teacherName;
                $guruIds->push($teacherId);
            } elseif ($teacherName) {
                $teacherId = $resolver->teacherIdByName($teacherName);
                if ($teacherId) {
                    $guruIds->push($teacherId);
                }
            }

            $dayId = !empty($item['day_id']) ? (int) $item['day_id'] : null;
            $dayName = $item['hari'] ?? null;
            if ($dayId) {
                $dayName = DB::table('days')->where('id', $dayId)->value('name') ?: $dayName;
            } elseif ($dayName) {
                $dayId = $resolver->dayId($dayName);
            }

            $classId = !empty($item['class_id']) ? (int) $item['class_id'] : null;
            $className = $item['sifir'] ?? $item['kelas'] ?? null;
            if ($classId) {
                $className = DB::table('classes')->where('id', $classId)->value('name') ?: $className;
            } elseif ($className) {
                $classId = $resolver->classId($className, false);
            }

            $scheduleData = [
                'mapel_id' => $mapel->id,
                'teacher_id' => $teacherId,
                'guru' => $teacherName ?: 'Ustadz Pengajar',
                'day_id' => $dayId,
                'hari' => $dayName ?: 'Senin',
                'jam_mulai' => $item['jam_mulai'] ?? '07:00',
                'jam_selesai' => $item['jam_selesai'] ?? '08:30',
                'class_id' => $classId,
                'sifir' => $className ?: 'Kelas Utama',
                'ruangan' => $item['ruangan'] ?? null,
                'status' => $item['status'] ?? 'Aktif',
            ];

            if (!empty($item['id'])) {
                $existing = \App\Models\Jadwal::where('id', $item['id'])
                    ->where('mapel_id', $mapel->id)
                    ->first();
                if ($existing) {
                    $existing->update($scheduleData);
                    $keptIds[] = $existing->id;
                    continue;
                }
            }

            $created = \App\Models\Jadwal::create($scheduleData);
            $keptIds[] = $created->id;
        }

        // Delete any schedules belonging to this mapel that were removed
        \App\Models\Jadwal::where('mapel_id', $mapel->id)
            ->whereNotIn('id', $keptIds)
            ->delete();
    }

    public function destroy(MataPelajaran $mataPelajaran)
    {
        $mataPelajaran->delete();

        return response()->json([
            'success' => true,
            'message' => 'Mata pelajaran berhasil dihapus',
        ]);
    }

    private function loadOperationalRelations(MataPelajaran $mapel): MataPelajaran
    {
        return $mapel->fresh()->load([
            'guru',
            'jadwal' => fn ($query) => $query
                ->where('status', 'Aktif')
                ->orderByRaw("CASE hari
                    WHEN 'Ahad' THEN 1
                    WHEN 'Senin' THEN 2
                    WHEN 'Selasa' THEN 3
                    WHEN 'Rabu' THEN 4
                    WHEN 'Kamis' THEN 5
                    WHEN 'Jumat' THEN 6
                    WHEN 'Sabtu' THEN 7
                    ELSE 99
                END")
                ->orderBy('jam_mulai'),
        ]);
    }
}
