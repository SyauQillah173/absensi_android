<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Kegiatan;
use App\Models\KegiatanFoto;
use Illuminate\Http\Request;

class KegiatanController extends Controller
{
    // GET /api/kegiatan
    public function index()
    {
        $kegiatan = Kegiatan::with(['uploader:id,name,role', 'fotos'])
            ->orderByDesc('tanggal')
            ->get()
            ->map(function ($k) {
                return [
                    'id' => $k->id,
                    'judul' => $k->judul,
                    'deskripsi' => $k->deskripsi,
                    'tanggal' => $k->tanggal,
                    'uploaded_by_name' => $k->uploader->name ?? '-',
                    'foto_count' => $k->fotos->count(),
                    'fotos' => $k->fotos->map(function ($f) {
                        return [
                            'id' => $f->id,
                            'file_url' => url('storage/' . $f->file_path),
                            'caption' => $f->caption,
                        ];
                    }),
                    'created_at' => $k->created_at->format('Y-m-d H:i'),
                ];
            });

        return response()->json(['success' => true, 'data' => $kegiatan]);
    }

    // POST /api/kegiatan
    public function store(Request $request)
    {
        $request->validate([
            'uploaded_by' => 'required|exists:users,id',
            'judul' => 'required|string|max:255',
            'deskripsi' => 'nullable|string',
            'fotos' => 'required|array|min:1',
            'fotos.*' => 'image|max:5120', // max 5MB per foto
            'captions' => 'nullable|array',
        ]);

        $kegiatan = Kegiatan::create([
            'uploaded_by' => $request->uploaded_by,
            'judul' => $request->judul,
            'deskripsi' => $request->deskripsi,
            'tanggal' => now()->toDateString(),
        ]);

        $captions = $request->captions ?? [];
        foreach ($request->file('fotos') as $index => $foto) {
            $path = $foto->store('kegiatan', 'public');
            KegiatanFoto::create([
                'kegiatan_id' => $kegiatan->id,
                'file_path' => $path,
                'caption' => $captions[$index] ?? null,
            ]);
        }

        return response()->json([
            'success' => true,
            'message' => 'Kegiatan berhasil diupload',
            'data' => ['id' => $kegiatan->id],
        ], 201);
    }

    // DELETE /api/kegiatan/{id}
    public function destroy($id)
    {
        $kegiatan = Kegiatan::with('fotos')->findOrFail($id);

        // Delete all foto files
        foreach ($kegiatan->fotos as $foto) {
            $filePath = storage_path('app/public/' . $foto->file_path);
            if (file_exists($filePath)) {
                unlink($filePath);
            }
        }

        $kegiatan->delete(); // cascade deletes fotos records

        return response()->json([
            'success' => true,
            'message' => 'Kegiatan berhasil dihapus',
        ]);
    }

    // GET /api/wali/kegiatan — sama dengan index, orang tua lihat semua kegiatan
    public function kegiatanWali()
    {
        return $this->index();
    }
}
