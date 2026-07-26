<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Materi;
use App\Models\MataPelajaran;
use App\Models\User;
use App\Services\ActorResolver;
use App\Services\ReferenceResolver;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class MateriController extends Controller
{
    // GET /api/materi?kelas=X&mapel=Y&guru_id=Z
    public function index(Request $request)
    {
        $query = Materi::with([
            'guru:id,name,role',
            'mataPelajaran:id,nama,kode,status',
            'kelasRef:id,name',
        ])->orderByDesc('tanggal')->orderByDesc('id');

        if ($request->filled('class_id')) {
            $query->where('class_id', $request->integer('class_id'));
        } elseif ($request->filled('kelas')) {
            $classId = app(ReferenceResolver::class)->classId($request->kelas, false);
            $classId ? $query->where('class_id', $classId) : $query->whereRaw('1 = 0');
        }
        if ($request->filled('mapel_id')) {
            $query->where('mapel_id', $request->mapel_id);
        } elseif ($request->filled('mapel')) {
            $mapelId = app(ReferenceResolver::class)->subjectId($request->mapel);
            $mapelId ? $query->where('mapel_id', $mapelId) : $query->whereRaw('1 = 0');
        }
        if ($request->filled('guru_id')) {
            $query->where('guru_id', $request->guru_id);
        }

        $materi = $query->get()->map(fn ($m) => $this->formatMateri($m));

        return response()->json(['success' => true, 'data' => $materi]);
    }

    // POST /api/materi
    public function store(Request $request)
    {
        $request->validate([
            'guru_id' => [
                'nullable',
                'integer',
                Rule::exists('users', 'id')->where(fn ($query) => $query
                    ->whereIn('role', ['admin', 'guru'])
                    ->where('status', 'Aktif')),
            ],
            'kelas' => 'required|string|max:255',
            'class_id' => 'nullable|integer|exists:classes,id',
            'mapel_id' => 'required|exists:mata_pelajaran,id',
            'judul' => 'required|string|max:255',
            'deskripsi' => 'nullable|string',
            'file' => 'required|file|mimes:pdf,doc,docx,xls,xlsx,ppt,pptx,jpg,jpeg,png,webp|max:10240', // max 10MB, strictly safe learning files
            'file_type' => 'nullable|in:foto,dokumen',
        ]);

        $uploader = $this->resolveUploader($request);
        if (!$uploader) {
            return response()->json([
                'success' => false,
                'message' => 'Hanya admin atau guru aktif yang dapat mengupload materi.',
            ], 403);
        }
        if ($uploader->role !== 'admin' && $request->filled('guru_id') && (int) $request->guru_id !== (int) $uploader->id) {
            throw ValidationException::withMessages([
                'guru_id' => ['User upload materi tidak sesuai dengan sesi aktif.'],
            ]);
        }

        $mapel = MataPelajaran::where('id', $request->mapel_id)
            ->where('status', 'Aktif')
            ->first();

        if (!$mapel) {
            return response()->json([
                'success' => false,
                'message' => 'Mata pelajaran tidak aktif atau tidak ditemukan',
            ], 422);
        }

        $this->ensureUploaderCanCreateMateri($uploader, $mapel);

        $path = $request->file('file')->store('materi', 'public');

        $fileType = $request->file_type ?? 'foto';
        $ext = strtolower($request->file('file')->getClientOriginalExtension());
        if (in_array($ext, ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'])) {
            $fileType = 'dokumen';
        }

        $resolver = app(ReferenceResolver::class);
        $classId = $request->class_id ?: $resolver->classId($request->kelas, false);
        if (!$classId) {
            throw ValidationException::withMessages([
                'kelas' => ['Kelas tidak ditemukan di master kelas. Pilih kelas resmi, jangan ketik bebas.'],
            ]);
        }

        $materi = Materi::create([
            'guru_id' => $uploader->id,
            'kelas' => $resolver->className($classId),
            'class_id' => $classId,
            'mapel_id' => $mapel->id,
            'mapel' => $mapel->nama,
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

    // DELETE /api/materi/{id}
    public function destroy(Request $request, $id)
    {
        $materi = Materi::findOrFail($id);
        $actor = $this->resolveUploader($request);
        if (!$actor || ($actor->role !== 'admin' && (int) $materi->guru_id !== (int) $actor->id)) {
            return response()->json([
                'success' => false,
                'message' => 'Anda tidak memiliki akses untuk menghapus materi ini',
            ], 403);
        }

        if ($materi->file_path) {
            Storage::disk('public')->delete($materi->file_path);
        }

        $materi->delete();

        return response()->json([
            'success' => true,
            'message' => 'Materi berhasil dihapus',
        ]);
    }

    // GET /api/wali/materi?class_id=X atau kelas=X
    public function materiAnak(Request $request)
    {
        $kelas = $request->query('kelas');
        $classId = $request->filled('class_id')
            ? $request->integer('class_id')
            : app(ReferenceResolver::class)->classId($kelas, false);

        if (!$classId && !$kelas) {
            return response()->json([
                'success' => false,
                'message' => 'Parameter class_id atau kelas diperlukan',
            ], 400);
        }

        $materi = Materi::with([
            'guru:id,name',
            'mataPelajaran:id,nama,kode,status',
            'kelasRef:id,name',
        ])->when($classId, fn ($builder) => $builder->where('class_id', $classId))
            ->when(!$classId, fn ($builder) => $builder->whereRaw('1 = 0'))
            ->orderByDesc('tanggal')
            ->orderByDesc('id')
            ->get()
            ->map(fn ($m) => $this->formatMateri($m));

        return response()->json(['success' => true, 'data' => $materi]);
    }

    private function formatMateri(Materi $materi): array
    {
        $namaMapel = $materi->mataPelajaran->nama ?? $materi->mapel;
        $namaKelas = $materi->kelasRef->name ?? $materi->kelas;

        return [
            'id' => $materi->id,
            'guru_id' => $materi->guru_id,
            'guru_nama' => $materi->guru->name ?? '-',
            'class_id' => $materi->class_id,
            'kelas' => $namaKelas,
            'mapel_id' => $materi->mapel_id,
            'mapel' => $namaMapel,
            'judul' => $materi->judul,
            'deskripsi' => $materi->deskripsi,
            'file_path' => $materi->file_path,
            'file_url' => url('storage/' . $materi->file_path),
            'file_type' => $materi->file_type,
            'tanggal' => $materi->tanggal,
            'created_at' => $materi->created_at?->format('Y-m-d H:i'),
        ];
    }

    private function ensureUploaderCanCreateMateri(User $uploader, MataPelajaran $mapel): void
    {
        if ($uploader->role === 'admin') {
            return;
        }

        $isAssignedTeacher = $mapel->guru()
            ->where('users.id', $uploader->id)
            ->exists();

        if (!$isAssignedTeacher) {
            throw ValidationException::withMessages([
                'mapel_id' => ['Guru ini tidak terhubung ke mata pelajaran yang dipilih.'],
            ]);
        }
    }

    private function resolveUploader(Request $request): ?User
    {
        return app(ActorResolver::class)->activeWithRole($request, ['admin', 'guru'], ['user_id', 'guru_id']);
    }
}
