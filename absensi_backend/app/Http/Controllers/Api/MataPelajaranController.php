<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MataPelajaran;
use App\Models\User;
use Illuminate\Http\Request;

class MataPelajaranController extends Controller
{
    public function index(Request $request)
    {
        $query = MataPelajaran::with(['guru', 'jadwal']);

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }
        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('nama', 'ilike', '%' . $search . '%')
                  ->orWhere('kode', 'ilike', '%' . $search . '%')
                  ->orWhereHas('guru', function ($q2) use ($search) {
                      $q2->where('name', 'ilike', '%' . $search . '%');
                  });
            });
        }

        return response()->json([
            'success' => true,
            'data' => $query->orderBy('nama')->get(),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'nama' => 'required|string',
            'kode' => 'nullable|string|max:10',
            'status' => 'required|in:Aktif,Nonaktif',
            'guru_ids' => 'nullable|array',
            'guru_ids.*' => 'exists:users,id',
        ]);

        $mapel = MataPelajaran::create([
            'nama' => $validated['nama'],
            'kode' => $validated['kode'] ?? null,
            'status' => $validated['status'],
        ]);

        // Sync guru assignments
        if (isset($validated['guru_ids'])) {
            $mapel->guru()->sync($validated['guru_ids']);
        }

        return response()->json([
            'success' => true,
            'message' => 'Mata pelajaran berhasil ditambahkan',
            'data' => $mapel->load(['guru', 'jadwal']),
        ], 201);
    }

    public function show(MataPelajaran $mataPelajaran)
    {
        return response()->json([
            'success' => true,
            'data' => $mataPelajaran->load(['guru', 'jadwal']),
        ]);
    }

    public function update(Request $request, MataPelajaran $mataPelajaran)
    {
        $validated = $request->validate([
            'nama' => 'sometimes|string',
            'kode' => 'nullable|string|max:10',
            'status' => 'sometimes|in:Aktif,Nonaktif',
            'guru_ids' => 'nullable|array',
            'guru_ids.*' => 'exists:users,id',
        ]);

        $mapel = $mataPelajaran;
        $mapel->update(array_intersect_key($validated, array_flip(['nama', 'kode', 'status'])));

        // Sync guru assignments if provided
        if (isset($validated['guru_ids'])) {
            $mapel->guru()->sync($validated['guru_ids']);
        }

        return response()->json([
            'success' => true,
            'message' => 'Mata pelajaran berhasil diupdate',
            'data' => $mapel->load(['guru', 'jadwal']),
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
}

