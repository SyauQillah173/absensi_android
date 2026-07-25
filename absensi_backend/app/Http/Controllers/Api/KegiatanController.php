<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Kegiatan;
use App\Models\KegiatanFoto;
use App\Models\User;
use App\Services\ActorResolver;
use App\Services\ReferenceResolver;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class KegiatanController extends Controller
{
    // GET /api/kegiatan
    public function index(Request $request)
    {
        $query = Kegiatan::with(['uploader:id,name,role', 'fotos', 'kelasRef:id,name'])
            ->orderByDesc('tanggal')
            ->orderByDesc('id');

        if ($request->filled('class_id')) {
            $query->where('class_id', $request->integer('class_id'));
        } elseif ($request->filled('kelas')) {
            $classId = app(ReferenceResolver::class)->classId($request->kelas, false);
            $classId ? $query->where('class_id', $classId) : $query->whereRaw('1 = 0');
        }

        $kegiatan = $query->get()->map(fn ($k) => $this->formatKegiatan($k));

        return response()->json(['success' => true, 'data' => $kegiatan]);
    }

    // POST /api/kegiatan
    public function store(Request $request)
    {
        $request->validate([
            'uploaded_by' => [
                'required',
                'integer',
                'exists:users,id',
            ],
            'kelas' => 'required|string|max:255',
            'class_id' => 'nullable|integer|exists:classes,id',
            'judul' => 'required|string|max:255',
            'deskripsi' => 'nullable|string',
            'fotos' => 'required|array|min:1',
            'fotos.*' => 'image|mimes:jpg,jpeg,png,webp|max:5120', // strictly safe image formats (no SVG)
            'captions' => 'nullable|array',
        ]);

        $actor = $this->resolveActor($request, (int) $request->uploaded_by);
        if (!$actor || $actor->role !== 'admin') {
            return $this->forbidden('Hanya admin aktif yang dapat mengupload kegiatan');
        }

        $resolver = app(ReferenceResolver::class);
        $classId = $request->class_id ?: $resolver->classId($request->kelas, false);
        if (!$classId) {
            throw ValidationException::withMessages([
                'kelas' => ['Kelas tidak ditemukan di master kelas. Pilih kelas resmi, jangan ketik bebas.'],
            ]);
        }

        $kegiatan = Kegiatan::create([
            'uploaded_by' => $actor->id,
            'kelas' => $resolver->className($classId),
            'class_id' => $classId,
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
    public function destroy(Request $request, $id)
    {
        $actor = $this->resolveActor($request);
        if (!$actor || $actor->role !== 'admin') {
            return $this->forbidden('Hanya admin aktif yang dapat menghapus kegiatan');
        }

        $kegiatan = Kegiatan::with('fotos')->findOrFail($id);

        foreach ($kegiatan->fotos as $foto) {
            Storage::disk('public')->delete($foto->file_path);
        }

        $kegiatan->delete();

        return response()->json([
            'success' => true,
            'message' => 'Kegiatan berhasil dihapus',
        ]);
    }

    // GET /api/wali/kegiatan?class_id=X atau kelas=X
    public function kegiatanWali(Request $request)
    {
        $kelas = $request->query('kelas');
        $classId = $request->filled('class_id')
            ? $request->integer('class_id')
            : app(ReferenceResolver::class)->classId($kelas, false);

        $query = Kegiatan::with(['uploader:id,name,role', 'fotos', 'kelasRef:id,name'])
            ->orderByDesc('tanggal')
            ->orderByDesc('id');

        if ($classId || $kelas) {
            $query->where(function ($builder) use ($classId) {
                $builder->whereNull('class_id');
                $classId
                    ? $builder->orWhere('class_id', $classId)
                    : $builder->whereRaw('1 = 0');
            });
        }

        $kegiatan = $query->get()->map(fn ($k) => $this->formatKegiatan($k));

        return response()->json(['success' => true, 'data' => $kegiatan]);
    }

    private function formatKegiatan(Kegiatan $kegiatan): array
    {
        return [
            'id' => $kegiatan->id,
            'judul' => $kegiatan->judul,
            'class_id' => $kegiatan->class_id,
            'kelas' => $kegiatan->kelasRef->name ?? $kegiatan->kelas,
            'deskripsi' => $kegiatan->deskripsi,
            'tanggal' => $kegiatan->tanggal,
            'uploaded_by_name' => $kegiatan->uploader->name ?? '-',
            'foto_count' => $kegiatan->fotos->count(),
            'fotos' => $kegiatan->fotos->map(function ($foto) {
                return [
                    'id' => $foto->id,
                    'file_url' => url('storage/' . $foto->file_path),
                    'caption' => $foto->caption,
                ];
            })->values(),
            'created_at' => $kegiatan->created_at?->format('Y-m-d H:i'),
        ];
    }

    private function resolveActor(Request $request, ?int $fallbackUserId = null): ?User
    {
        return app(ActorResolver::class)->active($request, ['user_id', 'uploaded_by'], $fallbackUserId);
    }

    private function forbidden(string $message)
    {
        return response()->json([
            'success' => false,
            'message' => $message,
        ], 403);
    }
}
