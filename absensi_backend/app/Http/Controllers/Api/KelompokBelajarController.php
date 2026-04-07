<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\KelompokBelajar;
use App\Models\Siswa;
use Illuminate\Http\Request;

class KelompokBelajarController extends Controller
{
    // GET /api/kelompok-belajar — list semua kelompok + jumlah siswa
    public function index(Request $request)
    {
        $query = KelompokBelajar::withCount('siswa');

        if ($request->has('sifir')) {
            $query->where('sifir', $request->sifir);
        }
        if ($request->has('kategori')) {
            $query->where('kategori', $request->kategori);
        }

        $data = $query->orderBy('kategori')->orderBy('nama')->get();

        // Group by kategori
        $grouped = $data->groupBy('kategori')->map(function ($items, $kategori) {
            return [
                'kategori' => $kategori,
                'kelas' => $items->map(function ($k) {
                    return [
                        'id' => $k->id,
                        'nama' => $k->nama,
                        'sifir' => $k->sifir,
                        'jumlah_siswa' => $k->siswa_count,
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
    public function show(KelompokBelajar $kelompokBelajar)
    {
        $kelompokBelajar->load('siswa');

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $kelompokBelajar->id,
                'nama' => $kelompokBelajar->nama,
                'kategori' => $kelompokBelajar->kategori,
                'sifir' => $kelompokBelajar->sifir,
                'siswa' => $kelompokBelajar->siswa->map(function ($s) {
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
            'kategori' => 'required|string',
            'sifir' => 'required|string',
        ]);

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
        Siswa::where('id', $validated['siswa_id'])->update(['kelas' => $kelompokBelajar->nama]);

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
        $kelompok = KelompokBelajar::where('nama', $nama)->first();

        if (!$kelompok) {
            return response()->json([
                'success' => true,
                'data' => [],
            ]);
        }

        $siswa = $kelompok->siswa()->orderBy('nama')->get()->map(function ($s) {
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

    // PUT /api/kelompok-belajar/{id} — update kelompok
    public function update(Request $request, KelompokBelajar $kelompokBelajar)
    {
        $validated = $request->validate([
            'nama' => 'sometimes|string',
            'kategori' => 'sometimes|string',
            'sifir' => 'sometimes|string',
        ]);

        // If nama changed, also update siswa.kelas for all attached siswa
        if (isset($validated['nama']) && $validated['nama'] !== $kelompokBelajar->nama) {
            Siswa::whereIn('id', $kelompokBelajar->siswa()->pluck('siswa_id'))
                ->update(['kelas' => $validated['nama']]);
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
