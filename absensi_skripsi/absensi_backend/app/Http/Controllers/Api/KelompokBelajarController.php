<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\KelompokBelajar;
use App\Models\Siswa;
use App\Services\ReferenceResolver;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class KelompokBelajarController extends Controller
{
    // GET /api/kelompok-belajar — list semua kelompok + jumlah siswa
    public function index(Request $request)
    {
        $query = KelompokBelajar::query();

        if ($request->has('sifir')) {
            $query->where('sifir', $request->sifir);
        }
        if ($request->has('kategori')) {
            $query->where('kategori', $request->kategori);
        }

        $data = $query->orderBy('kategori')->orderBy('nama')->get();
        $activeStatusId = app(ReferenceResolver::class)->studentStatusId('Aktif');
        $activeStudentCounts = $this->activeStudentCounts($data, $activeStatusId);
        $activeMapelCount = DB::table('mata_pelajaran')->where('status', 'Aktif')->count();

        // Group by kategori
        $grouped = $data->groupBy('kategori')->map(function ($items, $kategori) use ($activeStudentCounts, $activeMapelCount) {
            return [
                'kategori' => $kategori,
                'kelas' => $items->map(function ($k) use ($activeStudentCounts, $activeMapelCount) {
                    $classKey = $k->class_id ? 'class:' . $k->class_id : null;
                    $nameKey = $k->nama ? 'name:' . $k->nama : null;
                    return [
                        'id' => $k->id,
                        'class_id' => $k->class_id,
                        'nama' => $k->nama,
                        'sifir' => $k->sifir,
                        'jumlah_siswa' => $classKey && isset($activeStudentCounts[$classKey])
                            ? $activeStudentCounts[$classKey]
                            : ($activeStudentCounts[$nameKey] ?? 0),
                        'jumlah_mapel_aktif' => $activeMapelCount,
                    ];
                })->values(),
            ];
        })->values();

        return response()->json([
            'success' => true,
            'data' => $grouped,
        ]);
    }

    // GET /api/kelompok-belajar/{id} — detail dengan list siswa
    private function activeStudentCount(KelompokBelajar $kelompokBelajar, ?int $activeStatusId): int
    {
        return $this->activeStudentQuery($kelompokBelajar, $activeStatusId)->count();
    }

    private function activeStudentCounts($kelompokBelajar, ?int $activeStatusId): array
    {
        $classIds = collect($kelompokBelajar)
            ->pluck('class_id')
            ->filter()
            ->unique()
            ->values();
        $names = collect($kelompokBelajar)
            ->pluck('nama')
            ->filter()
            ->unique()
            ->values();

        $base = DB::table('siswa');
        if ($activeStatusId) {
            $base->where('student_status_id', $activeStatusId);
        } else {
            $base->where('status', 'Aktif');
        }

        $counts = [];
        if ($classIds->isNotEmpty()) {
            (clone $base)
                ->whereIn('class_id', $classIds)
                ->select('class_id', DB::raw('COUNT(*) as aggregate'))
                ->groupBy('class_id')
                ->get()
                ->each(function ($row) use (&$counts) {
                    $counts['class:' . $row->class_id] = (int) $row->aggregate;
                });
        }

        if ($names->isNotEmpty()) {
            (clone $base)
                ->whereIn('kelas', $names)
                ->select('kelas', DB::raw('COUNT(*) as aggregate'))
                ->groupBy('kelas')
                ->get()
                ->each(function ($row) use (&$counts) {
                    $counts['name:' . $row->kelas] = (int) $row->aggregate;
                });
        }

        return $counts;
    }

    public function show(KelompokBelajar $kelompokBelajar)
    {
        $activeStatusId = app(ReferenceResolver::class)->studentStatusId('Aktif');
        $siswa = $this->activeStudentQuery($kelompokBelajar, $activeStatusId)
            ->orderBy('nama')
            ->get();

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $kelompokBelajar->id,
                'class_id' => $kelompokBelajar->class_id,
                'nama' => $kelompokBelajar->nama,
                'kategori' => $kelompokBelajar->kategori,
                'sifir' => $kelompokBelajar->sifir,
                'siswa' => $siswa->map(function ($s) {
                    return [
                        'id' => $s->id,
                        'nis' => $s->nis,
                        'nama' => $s->nama,
                        'jenis_kelamin' => $s->jenis_kelamin,
                        'status' => $s->status,
                    ];
                }),
            ],
        ]);
    }

    // POST /api/kelompok-belajar — buat kelompok baru
    public function store(Request $request)
    {
        $validated = $request->validate([
            'nama' => 'required|string',
            'class_id' => 'nullable|integer|exists:classes,id',
            'kategori' => 'required|string',
            'sifir' => 'required|string',
        ]);
        $validated['class_id'] = $validated['class_id']
            ?? app(ReferenceResolver::class)->classId($validated['nama'], false);

        $kelompok = KelompokBelajar::create($validated);

        return response()->json([
            'success' => true,
            'message' => 'Kelompok belajar berhasil dibuat',
            'data' => $kelompok,
        ], 201);
    }

    // POST /api/kelompok-belajar/{id}/siswa — tambah siswa ke kelompok
    public function addSiswa(Request $request, KelompokBelajar $kelompokBelajar)
    {
        $validated = $request->validate([
            'siswa_id' => 'required|exists:siswa,id',
        ]);

        // Cek apakah siswa sudah ada di kelompok ini
        if ($kelompokBelajar->siswa()->where('siswa_id', $validated['siswa_id'])->exists()) {
            return response()->json([
                'success' => false,
                'message' => 'Siswa sudah ada di kelompok ini',
            ], 409);
        }

        $kelompokBelajar->siswa()->attach($validated['siswa_id']);

        // Update kelas siswa to match kelompok
        Siswa::where('id', $validated['siswa_id'])->update([
            'kelas' => $kelompokBelajar->nama,
            'class_id' => $kelompokBelajar->class_id,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Siswa berhasil ditambahkan ke kelompok',
            'data' => $kelompokBelajar->load('siswa'),
        ]);
    }

    // DELETE /api/kelompok-belajar/{id}/siswa/{siswaId} — hapus siswa dari kelompok
    public function removeSiswa(KelompokBelajar $kelompokBelajar, $siswaId)
    {
        $kelompokBelajar->siswa()->detach($siswaId);

        return response()->json([
            'success' => true,
            'message' => 'Siswa berhasil dihapus dari kelompok',
        ]);
    }

    // GET /api/kelompok-belajar/by-kelas/{nama} — ambil siswa berdasarkan nama kelas
    public function byKelas($nama)
    {
        $classId = app(ReferenceResolver::class)->classId($nama, false);
        $kelompok = KelompokBelajar::query()
            ->where('nama', $nama)
            ->when($classId, fn ($query) => $query->orWhere('class_id', $classId))
            ->first();

        if (!$kelompok) {
            return response()->json([
                'success' => true,
                'data' => [],
            ]);
        }

        $activeStatusId = app(ReferenceResolver::class)->studentStatusId('Aktif');
        $siswa = $this->activeStudentQuery($kelompok, $activeStatusId)->orderBy('nama')->get()->map(function ($s) {
            return [
                'id' => $s->id,
                'nis' => $s->nis,
                'nama' => $s->nama,
                'jenis_kelamin' => $s->jenis_kelamin,
                'status' => $s->status,
            ];
        });

        return response()->json([
            'success' => true,
            'data' => $siswa,
        ]);
    }

    private function activeStudentQuery(KelompokBelajar $kelompokBelajar, ?int $activeStatusId)
    {
        return Siswa::query()
            ->where(function ($query) use ($kelompokBelajar) {
                if ($kelompokBelajar->class_id) {
                    $query->where('class_id', $kelompokBelajar->class_id);
                }
                if ($kelompokBelajar->nama) {
                    $method = $kelompokBelajar->class_id ? 'orWhere' : 'where';
                    $query->{$method}('kelas', $kelompokBelajar->nama);
                }
                $pivotIds = $kelompokBelajar->siswa()->pluck('siswa.id');
                if ($pivotIds->isNotEmpty()) {
                    $query->orWhereIn('id', $pivotIds);
                }
            })
            ->when(
                $activeStatusId,
                fn ($query) => $query->where('student_status_id', $activeStatusId),
                fn ($query) => $query->where('status', 'Aktif')
            );
    }

    // PUT /api/kelompok-belajar/{id} — update kelompok
    public function update(Request $request, KelompokBelajar $kelompokBelajar)
    {
        $validated = $request->validate([
            'nama' => 'sometimes|string',
            'class_id' => 'nullable|integer|exists:classes,id',
            'kategori' => 'sometimes|string',
            'sifir' => 'sometimes|string',
        ]);
        if (array_key_exists('nama', $validated) && !array_key_exists('class_id', $validated)) {
            $validated['class_id'] = app(ReferenceResolver::class)->classId($validated['nama'], false);
        }

        // If nama changed, also update siswa.kelas for all attached siswa
        if (isset($validated['nama']) && $validated['nama'] !== $kelompokBelajar->nama) {
            Siswa::whereIn('id', $kelompokBelajar->siswa()->pluck('siswa_id'))
                ->update([
                    'kelas' => $validated['nama'],
                    'class_id' => $validated['class_id'] ?? $kelompokBelajar->class_id,
                ]);
        }

        $kelompokBelajar->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'Kelompok belajar berhasil diupdate',
            'data' => $kelompokBelajar->fresh(),
        ]);
    }

    // DELETE /api/kelompok-belajar/{id} — hapus kelompok + detach semua siswa
    public function destroy(KelompokBelajar $kelompokBelajar)
    {
        // Detach all siswa relationships first
        $kelompokBelajar->siswa()->detach();

        $kelompokBelajar->delete();

        return response()->json([
            'success' => true,
            'message' => 'Kelompok belajar berhasil dihapus',
        ]);
    }
}
