<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Hafalan;
use Illuminate\Http\Request;

class HafalanController extends Controller
{
    public function index(Request $request)
    {
        $query = Hafalan::with('siswa');

        if ($request->has('siswa_id')) {
            $query->where('siswa_id', $request->siswa_id);
        }
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }
        if ($request->has('kelas')) {
            $query->whereHas('siswa', function ($q) use ($request) {
                $q->where('kelas', $request->kelas);
            });
        }

        return response()->json([
            'success' => true,
            'data' => $query->orderBy('siswa_id')->orderBy('juz')->get(),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'siswa_id' => 'required|exists:siswa,id',
            'juz' => 'nullable|integer|min:1|max:30',
            'surah' => 'nullable|string',
            'status' => 'required|in:Belum,Proses,Selesai',
            'tanggal_setor' => 'nullable|date',
            'penguji' => 'nullable|string',
            'nilai_hafalan' => 'nullable|integer|min:0|max:100',
            'keterangan' => 'nullable|string',
        ]);

        $hafalan = Hafalan::create($validated);

        return response()->json([
            'success' => true,
            'message' => 'Hafalan berhasil disimpan',
            'data' => $hafalan->load('siswa'),
        ], 201);
    }

    public function show(Hafalan $hafalan)
    {
        return response()->json([
            'success' => true,
            'data' => $hafalan->load('siswa'),
        ]);
    }

    public function update(Request $request, Hafalan $hafalan)
    {
        $validated = $request->validate([
            'juz' => 'nullable|integer|min:1|max:30',
            'surah' => 'nullable|string',
            'status' => 'sometimes|in:Belum,Proses,Selesai',
            'tanggal_setor' => 'nullable|date',
            'penguji' => 'nullable|string',
            'nilai_hafalan' => 'nullable|integer|min:0|max:100',
            'keterangan' => 'nullable|string',
        ]);

        $hafalan->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'Hafalan berhasil diupdate',
            'data' => $hafalan->load('siswa'),
        ]);
    }

    public function destroy(Hafalan $hafalan)
    {
        $hafalan->delete();

        return response()->json([
            'success' => true,
            'message' => 'Hafalan berhasil dihapus',
        ]);
    }
}
