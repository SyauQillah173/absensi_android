<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Jadwal;
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

        $activeStatusId = app(ReferenceResolver::class)->studentStatusId('Aktif');
        $teacherId = $request->integer('user_id') ?: null;
        $teacherName = $teacherId
            ? DB::table('users')->where('id', $teacherId)->where('role', 'guru')->value('name')
            : null;
        if ($teacherId && !$teacherName) {
            $teacherId = null;
        }

        // Hitung siswa murni dari relasi pivot kelompok_belajar_siswa tanpa duplikasi / ghost data
        $query->withCount(['siswa as jumlah_siswa' => function ($q) use ($activeStatusId) {
            $q->when(
                $activeStatusId,
                fn ($nested) => $nested->where('siswa.student_status_id', $activeStatusId),
                fn ($nested) => $nested->where('siswa.status', 'Aktif')
            );
        }]);

        $data = $query->orderBy('kategori')->orderBy('nama')->get();

        // Group by kategori
        $grouped = $data->groupBy('kategori')->map(function ($items, $kategori) use ($teacherId, $teacherName) {
            return [
                'kategori' => $kategori,
                'kelas' => $items->map(function ($k) use ($teacherId, $teacherName) {
                    return [
                        'id' => $k->id,
                        'class_id' => $k->class_id,
                        'nama' => $k->nama,
                        'sifir' => $k->sifir,
                        'jumlah_siswa' => (int) ($k->jumlah_siswa ?? 0),
                        'jumlah_mapel_aktif' => $this->activeMapelCount($k, $teacherId, $teacherName),
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

    private function activeMapelCount(KelompokBelajar $kelompokBelajar, ?int $teacherId = null, ?string $teacherName = null): int
    {
        return Jadwal::query()
            ->where('status', 'Aktif')
            ->whereNotNull('mapel_id')
            ->when($teacherId, function ($query) use ($teacherId, $teacherName) {
                $normalizedName = mb_strtolower(trim((string) $teacherName));
                $query->where(function ($nested) use ($teacherId, $normalizedName) {
                    $nested->where('teacher_id', $teacherId);
                    if ($normalizedName !== '') {
                        $nested->orWhereRaw('LOWER(TRIM(COALESCE(guru, \'\'))) = ?', [$normalizedName]);
                    }
                });
            })
            ->where(function ($query) use ($kelompokBelajar) {
                if ($kelompokBelajar->class_id) {
                    $query->where('class_id', $kelompokBelajar->class_id);
                }
                if ($kelompokBelajar->nama) {
                    $method = $kelompokBelajar->class_id ? 'orWhere' : 'where';
                    $query->{$method}('sifir', $kelompokBelajar->nama);
                }
            })
            ->whereHas('mataPelajaran', fn ($query) => $query->where('status', 'Aktif'))
            ->distinct()
            ->count('mapel_id');
    }

    public function show(KelompokBelajar $kelompokBelajar)
    {
        $activeStatusId = app(ReferenceResolver::class)->studentStatusId('Aktif');
        $siswa = $this->activeStudentQuery($kelompokBelajar, $activeStatusId)
            ->with(['boardingRoom.complex'])
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
                    $kamar = $s->boardingRoom ? (($s->boardingRoom->complex->name ?? '') . ' - ' . $s->boardingRoom->name) : ($s->kamar ?? '-');
                    return [
                        'id' => $s->id,
                        'nis' => $s->nis,
                        'nisn' => $s->nisn,
                        'nama' => $s->nama,
                        'jenis_kelamin' => $s->jenis_kelamin,
                        'status' => $s->status,
                        'kamar' => $kamar,
                        'kelas' => $s->kelas,
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
            'siswa_ids' => 'nullable|array',
            'siswa_ids.*' => 'integer|exists:siswa,id',
        ]);
        $validated['class_id'] = $validated['class_id']
            ?? app(ReferenceResolver::class)->classId($validated['nama'], false);

        $kelompok = DB::transaction(function () use ($validated) {
            $kelompok = KelompokBelajar::create([
                'nama' => $validated['nama'],
                'class_id' => $validated['class_id'] ?? null,
                'kategori' => $validated['kategori'],
                'sifir' => $validated['sifir'],
            ]);

            if (!empty($validated['siswa_ids']) && is_array($validated['siswa_ids'])) {
                $ids = collect($validated['siswa_ids'])->map(fn ($id) => (int) $id)->unique()->values()->all();
                $kelompok->siswa()->sync($ids);
                Siswa::whereIn('id', $ids)->update([
                    'kelas' => $kelompok->nama,
                    'class_id' => $kelompok->class_id,
                ]);
            }

            return $kelompok;
        });

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
            'siswa_id' => 'nullable|exists:siswa,id',
            'siswa_ids' => 'nullable|array',
            'siswa_ids.*' => 'integer|exists:siswa,id',
        ]);

        $ids = collect($validated['siswa_ids'] ?? [])
            ->merge(isset($validated['siswa_id']) ? [$validated['siswa_id']] : [])
            ->map(fn ($id) => (int) $id)
            ->filter()
            ->unique()
            ->values()
            ->all();

        if (empty($ids)) {
            return response()->json([
                'success' => false,
                'message' => 'Pilih santri terlebih dahulu',
            ], 422);
        }

        $kelompokBelajar->siswa()->syncWithoutDetaching($ids);

        // Update kelas siswa to match kelompok
        Siswa::whereIn('id', $ids)->update([
            'kelas' => $kelompokBelajar->nama,
            'class_id' => $kelompokBelajar->class_id,
        ]);

        return response()->json([
            'success' => true,
            'message' => count($ids) . ' Santri berhasil ditambahkan ke kelompok',
            'data' => $kelompokBelajar->load('siswa'),
        ]);
    }

    // DELETE /api/kelompok-belajar/{id}/siswa/{siswaId} — hapus siswa dari kelompok
    public function removeSiswa(KelompokBelajar $kelompokBelajar, $siswaId)
    {
        $kelompokBelajar->siswa()->detach($siswaId);
        Siswa::where('id', $siswaId)
            ->where(function ($q) use ($kelompokBelajar) {
                $q->where('class_id', $kelompokBelajar->class_id)
                  ->orWhere('kelas', $kelompokBelajar->nama);
            })
            ->update([
                'kelas' => null,
                'class_id' => null,
            ]);

        return response()->json([
            'success' => true,
            'message' => 'Santri berhasil dikeluarkan dari kelompok',
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
        // Anggota kelompok belajar murni bersumber dari relasi tabel pivot kelompok_belajar_siswa
        return $kelompokBelajar->siswa()
            ->when(
                $activeStatusId,
                fn ($query) => $query->where('siswa.student_status_id', $activeStatusId),
                fn ($query) => $query->where('siswa.status', 'Aktif')
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
            'siswa_ids' => 'nullable|array',
            'siswa_ids.*' => 'integer|exists:siswa,id',
        ]);
        if (array_key_exists('nama', $validated) && !array_key_exists('class_id', $validated)) {
            $validated['class_id'] = app(ReferenceResolver::class)->classId($validated['nama'], false);
        }

        DB::transaction(function () use ($validated, $kelompokBelajar) {
            // If nama changed, also update siswa.kelas for all attached siswa
            if (isset($validated['nama']) && $validated['nama'] !== $kelompokBelajar->nama) {
                Siswa::whereIn('id', $kelompokBelajar->siswa()->pluck('siswa_id'))
                    ->update([
                        'kelas' => $validated['nama'],
                        'class_id' => $validated['class_id'] ?? $kelompokBelajar->class_id,
                    ]);
            }

            if (isset($validated['siswa_ids']) && is_array($validated['siswa_ids'])) {
                $ids = collect($validated['siswa_ids'])->map(fn ($id) => (int) $id)->unique()->values()->all();
                
                // Find removed students
                $currentAttached = $kelompokBelajar->siswa()->pluck('siswa_id')->all();
                $removedIds = array_diff($currentAttached, $ids);
                if (!empty($removedIds)) {
                    Siswa::whereIn('id', $removedIds)
                        ->where(function ($q) use ($kelompokBelajar) {
                            $q->where('class_id', $kelompokBelajar->class_id)
                              ->orWhere('kelas', $kelompokBelajar->nama);
                        })
                        ->update([
                            'kelas' => null,
                            'class_id' => null,
                        ]);
                }

                $kelompokBelajar->siswa()->sync($ids);
                if (!empty($ids)) {
                    Siswa::whereIn('id', $ids)->update([
                        'kelas' => $validated['nama'] ?? $kelompokBelajar->nama,
                        'class_id' => $validated['class_id'] ?? $kelompokBelajar->class_id,
                    ]);
                }
            }

            $kelompokBelajar->update(array_intersect_key($validated, array_flip(['nama', 'class_id', 'kategori', 'sifir'])));
        });

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
