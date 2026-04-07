<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Jadwal;
use Illuminate\Http\Request;

class JadwalController extends Controller
{
    public function index(Request $request)
    {
        $query = Jadwal::with('mataPelajaran');

        if ($request->has('hari')) {
            $query->where('hari', $request->hari);
        }
        if ($request->has('sifir')) {
            $query->where('sifir', $request->sifir);
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
                WHEN 'Senin' THEN 1
                WHEN 'Selasa' THEN 2
                WHEN 'Rabu' THEN 3
                WHEN 'Kamis' THEN 4
                WHEN 'Jumat' THEN 5
                WHEN 'Sabtu' THEN 6
                END")->orderBy('jam_mulai')->get(),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'mapel_id' => 'required|exists:mata_pelajaran,id',
            'guru' => 'required|string',
            'hari' => "required|in:Senin,Selasa,Rabu,Kamis,Jumat,Sabtu",
            'jam_mulai' => 'required',
            'jam_selesai' => 'required',
            'sifir' => 'nullable|string',
            'status' => 'required|in:Aktif,Nonaktif',
        ]);

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
            'guru' => 'sometimes|string',
            'hari' => "sometimes|in:Senin,Selasa,Rabu,Kamis,Jumat,Sabtu",
            'jam_mulai' => 'sometimes',
            'jam_selesai' => 'sometimes',
            'sifir' => 'nullable|string',
            'status' => 'sometimes|in:Aktif,Nonaktif',
        ]);

        $jadwal->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'Jadwal berhasil diupdate',
            'data' => $jadwal->load('mataPelajaran'),
        ]);
    }

    public function destroy(Jadwal $jadwal)
    {
        $jadwal->delete();

        return response()->json([
            'success' => true,
            'message' => 'Jadwal berhasil dihapus',
        ]);
    }
}
