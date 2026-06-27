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
            'with_relations' => $request->boolean('with_relations'),
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
        ]);

        $mapel = DB::transaction(function () use ($validated) {
            $mapel = MataPelajaran::create([
                'nama' => $validated['nama'],
                'kode' => $validated['kode'] ?? null,
                'status' => $validated['status'],
            ]);

            if (isset($validated['guru_ids'])) {
                $mapel->guru()->sync($validated['guru_ids']);
                $this->mapelAccessService->syncScheduleTeachers(
                    $mapel,
                    $validated['guru_ids'],
                );
            }

            return $mapel;
        });

        return response()->json([
            'success' => true,
            'message' => 'Mata pelajaran berhasil ditambahkan',
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
        ]);

        $mapel = DB::transaction(function () use ($validated, $mataPelajaran) {
            $mapel = $mataPelajaran;
            $mapel->update(array_intersect_key($validated, array_flip(['nama', 'kode', 'status'])));

            if (isset($validated['guru_ids'])) {
                $mapel->guru()->sync($validated['guru_ids']);
                $this->mapelAccessService->syncScheduleTeachers(
                    $mapel,
                    $validated['guru_ids'],
                );
            }

            return $mapel;
        });

        return response()->json([
            'success' => true,
            'message' => 'Mata pelajaran berhasil diupdate',
            'data' => $this->loadOperationalRelations($mapel),
        ]);
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
