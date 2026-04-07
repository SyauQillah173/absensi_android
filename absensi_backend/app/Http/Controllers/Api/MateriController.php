<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Materi;
use Illuminate\Http\Request;

class MateriController extends Controller
{
    // GET /api/materi?kelas=X&mapel=Y&guru_id=Z
    public function index(Request $request)
    {
        $query = Materi::with('guru:id,name,role')->orderByDesc('tanggal');

        if ($request->filled('kelas')) {
            $query->where('kelas', $request->kelas);
        }
        if ($request->filled('mapel')) {
            $query->where('mapel', $request->mapel);
        }
        if ($request->filled('guru_id')) {
            $query->where('guru_id', $request->guru_id);
        }

        $materi = $query->get()->map(function ($m) {
            return [
                'id' => $m->id,
                'guru_id' => $m->guru_id,
                'guru_nama' => $m->guru->name ?? '-',
                'kelas' => $m->kelas,
                'mapel' => $m->mapel,
                'judul' => $m->judul,
                'deskripsi' => $m->deskripsi,
                'file_path' => $m->file_path,
                'file_url' => url('storage/' . $m->file_path),
                'file_type' => $m->file_type,
                'tanggal' => $m->tanggal,
                'created_at' => $m->created_at->format('Y-m-d H:i'),
            ];
        });

        return response()->json(['success' => true, 'data' => $materi]);
    }

    // POST /api/materi
    public function store(Request $request)
    {
        $request->validate([
            'guru_id' => 'required|exists:users,id',
            'kelas' => 'required|string',
            'mapel' => 'required|string',
            'judul' => 'required|string|max:255',
            'deskripsi' => 'nullable|string',
            'file' => 'required|file|max:10240', // max 10MB
            'file_type' => 'nullable|in:foto,dokumen',
        ]);

        $path = $request->file('file')->store('materi', 'public');

        $fileType = $request->file_type ?? 'foto';
        $ext = strtolower($request->file('file')->getClientOriginalExtension());
        if (in_array($ext, ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'])) {
            $fileType = 'dokumen';
        }

        $materi = Materi::create([
            'guru_id' => $request->guru_id,
            'kelas' => $request->kelas,
            'mapel' => $request->mapel,
            'judul' => $request->judul,
            'deskripsi' => $request->deskripsi,
            'file_path' => $path,
            'file_type' => $fileType,
            'tanggal' => now()->toDateString(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Materi berhasil diupload',
            'data' => [
                'id' => $materi->id,
                'file_url' => url('storage/' . $path),
            ],
        ], 201);
    }

    // DELETE /api/materi/{id}?user_id=X
    public function destroy(Request $request, $id)
    {
        $materi = Materi::findOrFail($id);

        // Guru hanya bisa hapus materi sendiri, admin bisa hapus semua
        $userId = $request->query('user_id');
        if ($userId) {
            $user = \App\Models\User::find($userId);
            if ($user && $user->role !== 'admin' && $materi->guru_id != $userId) {
                return response()->json([
                    'success' => false,
                    'message' => 'Anda tidak memiliki akses untuk menghapus materi ini',
                ], 403);
            }
        }

        // Delete file from storage
        $filePath = storage_path('app/public/' . $materi->file_path);
        if (file_exists($filePath)) {
            unlink($filePath);
        }

        $materi->delete();

        return response()->json([
            'success' => true,
            'message' => 'Materi berhasil dihapus',
        ]);
    }

    // GET /api/wali/materi?kelas=X
    // Orang tua melihat materi berdasarkan kelas anak
    public function materiAnak(Request $request)
    {
        $kelas = $request->query('kelas');
        if (!$kelas) {
            return response()->json([
                'success' => false,
                'message' => 'Parameter kelas diperlukan',
            ], 400);
        }

        $materi = Materi::with('guru:id,name')
            ->where('kelas', $kelas)
            ->orderByDesc('tanggal')
            ->get()
            ->map(function ($m) {
                return [
                    'id' => $m->id,
                    'guru_nama' => $m->guru->name ?? '-',
                    'kelas' => $m->kelas,
                    'mapel' => $m->mapel,
                    'judul' => $m->judul,
                    'deskripsi' => $m->deskripsi,
                    'file_url' => url('storage/' . $m->file_path),
                    'file_type' => $m->file_type,
                    'tanggal' => $m->tanggal,
                ];
            });

        return response()->json(['success' => true, 'data' => $materi]);
    }
}
