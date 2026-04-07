<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Nilai;
use Illuminate\Http\Request;

class NilaiController extends Controller
{
    public function index(Request $request)
    {
        $query = Nilai::with(['siswa', 'mataPelajaran']);

        if ($request->has('siswa_id')) {
            $query->where('siswa_id', $request->siswa_id);
        }
        if ($request->has('mapel_id')) {
            $query->where('mapel_id', $request->mapel_id);
        }
        if ($request->has('jenis_ujian')) {
            $query->where('jenis_ujian', $request->jenis_ujian);
        }
        if ($request->has('semester')) {
            $query->where('semester', $request->semester);
        }
        if ($request->has('tahun_ajaran')) {
            $query->where('tahun_ajaran', $request->tahun_ajaran);
        }
        if ($request->has('kelas')) {
            $query->whereHas('siswa', function ($q) use ($request) {
                $q->where('kelas', $request->kelas);
            });
        }

        return response()->json([
            'success' => true,
            'data' => $query->orderBy('created_at', 'desc')->get(),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'siswa_id' => 'required|exists:siswa,id',
            'mapel_id' => 'required|exists:mata_pelajaran,id',
            'jenis_ujian' => 'required|in:UTS,UAS,Hafalan,Tugas,Harian',
            'nilai' => 'required|numeric|min:0|max:100',
            'semester' => 'nullable|string',
            'keterangan' => 'nullable|string',
            'diinput_oleh' => 'nullable|string',
            'tahun_ajaran' => 'nullable|string',
        ]);

        // Auto-calculate grade
        $validated['grade'] = Nilai::calculateGrade($validated['nilai']);

        $nilai = Nilai::create($validated);

        return response()->json([
            'success' => true,
            'message' => 'Nilai berhasil disimpan',
            'data' => $nilai->load(['siswa', 'mataPelajaran']),
        ], 201);
    }

    /**
     * Bulk insert — guru input nilai beberapa siswa/mapel sekaligus
     */
    public function storeBulk(Request $request)
    {
        $validated = $request->validate([
            'data' => 'required|array|min:1',
            'data.*.siswa_id' => 'required|exists:siswa,id',
            'data.*.mapel_id' => 'required|exists:mata_pelajaran,id',
            'data.*.jenis_ujian' => 'required|in:UTS,UAS,Hafalan,Tugas,Harian',
            'data.*.nilai' => 'required|numeric|min:0|max:100',
            'data.*.semester' => 'nullable|string',
            'data.*.keterangan' => 'nullable|string',
            'data.*.diinput_oleh' => 'nullable|string',
            'data.*.tahun_ajaran' => 'nullable|string',
        ]);

        $created = [];
        foreach ($validated['data'] as $item) {
            $item['grade'] = Nilai::calculateGrade($item['nilai']);
            $created[] = Nilai::create($item);
        }

        return response()->json([
            'success' => true,
            'message' => count($created) . ' nilai berhasil disimpan',
            'data' => $created,
        ], 201);
    }

    public function show(Nilai $nilai)
    {
        return response()->json([
            'success' => true,
            'data' => $nilai->load(['siswa', 'mataPelajaran']),
        ]);
    }

    public function update(Request $request, Nilai $nilai)
    {
        $validated = $request->validate([
            'siswa_id' => 'sometimes|exists:siswa,id',
            'mapel_id' => 'sometimes|exists:mata_pelajaran,id',
            'jenis_ujian' => 'sometimes|in:UTS,UAS,Hafalan,Tugas,Harian',
            'nilai' => 'sometimes|numeric|min:0|max:100',
            'semester' => 'nullable|string',
            'keterangan' => 'nullable|string',
            'diinput_oleh' => 'nullable|string',
            'tahun_ajaran' => 'nullable|string',
        ]);

        // Re-calculate grade if nilai changed
        if (isset($validated['nilai'])) {
            $validated['grade'] = Nilai::calculateGrade($validated['nilai']);
        }

        $nilai->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'Nilai berhasil diupdate',
            'data' => $nilai->load(['siswa', 'mataPelajaran']),
        ]);
    }

    public function destroy(Nilai $nilai)
    {
        $nilai->delete();

        return response()->json([
            'success' => true,
            'message' => 'Nilai berhasil dihapus',
        ]);
    }

    /**
     * Rekap nilai per siswa — grouped by mapel
     */
    public function rekap(Request $request)
    {
        $query = Nilai::with(['siswa', 'mataPelajaran']);

        if ($request->has('kelas')) {
            $query->whereHas('siswa', function ($q) use ($request) {
                $q->where('kelas', $request->kelas);
            });
        }
        if ($request->has('semester')) {
            $query->where('semester', $request->semester);
        }
        if ($request->has('tahun_ajaran')) {
            $query->where('tahun_ajaran', $request->tahun_ajaran);
        }

        $data = $query->get()->groupBy('siswa_id')->map(function ($nilaiGroup) {
            $siswa = $nilaiGroup->first()->siswa;
            return [
                'siswa' => $siswa,
                'nilai_per_mapel' => $nilaiGroup->groupBy('mapel_id')->map(function ($mapelGroup) {
                    $mapel = $mapelGroup->first()->mataPelajaran;
                    return [
                        'mapel' => $mapel,
                        'rata_rata' => round($mapelGroup->avg('nilai'), 2),
                        'grade' => Nilai::calculateGrade($mapelGroup->avg('nilai')),
                        'detail' => $mapelGroup,
                    ];
                })->values(),
            ];
        })->values();

        return response()->json([
            'success' => true,
            'data' => $data,
        ]);
    }
}
