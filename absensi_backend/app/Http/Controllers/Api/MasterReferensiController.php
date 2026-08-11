<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MasterReferensi;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class MasterReferensiController extends Controller
{
    public function index(Request $request)
    {
        $query = MasterReferensi::query();

        if ($request->filled('kategori')) {
            $query->where('kategori', $request->kategori);
        }

        if ($request->filled('search')) {
            $search = trim($request->search);
            $query->where('nilai', 'ilike', '%' . $search . '%');
        }

        if ($request->has('active')) {
            $query->where('is_active', $request->boolean('active'));
        }

        return response()->json([
            'success' => true,
            'data' => $query->orderBy('kategori')->orderBy('nilai')->get(),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'kategori' => ['required', 'string', 'max:100'],
            'nilai' => [
                'required',
                'string',
                'max:255',
                Rule::unique('master_referensi')->where(function ($query) use ($request) {
                    return $query->where('kategori', $request->kategori);
                }),
            ],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $validated['is_active'] = $validated['is_active'] ?? true;

        $referensi = MasterReferensi::create($validated);

        return response()->json([
            'success' => true,
            'data' => $referensi,
            'message' => 'Data referensi berhasil ditambahkan.',
        ], 201);
    }

    public function update(Request $request, MasterReferensi $referensi)
    {
        $validated = $request->validate([
            'kategori' => ['required', 'string', 'max:100'],
            'nilai' => [
                'required',
                'string',
                'max:255',
                Rule::unique('master_referensi')->where(function ($query) use ($request) {
                    return $query->where('kategori', $request->kategori);
                })->ignore($referensi->id),
            ],
            'is_active' => ['nullable', 'boolean'],
        ]);

        if (array_key_exists('is_active', $validated)) {
            $validated['is_active'] = (bool) $validated['is_active'];
        }

        $referensi->update($validated);

        return response()->json([
            'success' => true,
            'data' => $referensi,
            'message' => 'Data referensi berhasil diperbarui.',
        ]);
    }

    public function destroy(MasterReferensi $referensi)
    {
        $referensi->delete();

        return response()->json([
            'success' => true,
            'message' => 'Data referensi berhasil dihapus.',
        ]);
    }
}
