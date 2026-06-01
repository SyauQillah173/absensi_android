<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Hafalan;
use App\Models\PenilaianLog;
use App\Models\User;
use App\Services\ActorResolver;
use App\Services\AcademicPeriodService;
use App\Services\ReferenceResolver;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class HafalanController extends Controller
{
    public function index(Request $request)
    {
        $actor = $this->resolveActor($request);
        if (!$actor || !$this->canAccessPenilaian($actor)) {
            return $this->forbidden();
        }

        $query = Hafalan::with([
            'siswa:id,nama,kelas,class_id,nis',
            'creator:id,name,role',
            'updater:id,name,role',
        ]);

        $this->applyHafalanFilters($query, $request);
        $this->applyActorScope($query, $actor);

        $data = $query
            ->orderByDesc('updated_at')
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (Hafalan $hafalan) => $this->formatHafalan($hafalan));

        return response()->json([
            'success' => true,
            'data' => $data,
        ]);
    }

    public function store(Request $request)
    {
        $actor = $this->resolveActor($request);
        if (!$actor || !$this->canAccessPenilaian($actor)) {
            return $this->forbidden();
        }

        $validated = $request->validate([
            'user_id' => 'required|exists:users,id',
            'siswa_id' => 'required|exists:siswa,id',
            'juz' => 'nullable|integer|min:1|max:30',
            'surah' => 'nullable|string|max:255',
            'surah_id' => 'nullable|integer|exists:surahs,id',
            'status' => 'required|in:Belum,Proses,Selesai',
            'memorization_status_id' => 'nullable|integer|exists:memorization_statuses,id',
            'tanggal_setor' => 'nullable|date',
            'nilai_hafalan' => 'nullable|integer|min:0|max:100',
            'keterangan' => 'nullable|string',
            'periode' => 'nullable|string|max:100',
            'academic_year_id' => 'nullable|integer|exists:academic_years,id',
            'semester_id' => 'nullable|integer|exists:semesters,id',
            'tahun_ajaran' => 'nullable|string|max:30',
            'semester' => 'nullable|string|max:30',
        ]);

        unset($validated['user_id']);
        $validated = $this->normalizeReferences($validated);
        $validated['penguji'] = $actor->name;
        $validated['examiner_id'] = $actor->id;
        $validated = app(AcademicPeriodService::class)->stamp($validated);
        $validated['periode'] = $validated['periode']
            ?? trim(($validated['semester'] ?? '') . ' ' . ($validated['tahun_ajaran'] ?? ''));
        $validated['created_by'] = $actor->id;
        $validated['updated_by'] = $actor->id;
        $validated['created_by_role'] = $actor->role;
        $validated['updated_by_role'] = $actor->role;

        $hafalan = Hafalan::create($validated);
        PenilaianLog::recordHafalan($hafalan, $actor, 'dibuat');

        return response()->json([
            'success' => true,
            'message' => 'Hafalan berhasil disimpan',
            'data' => $this->formatHafalan($hafalan->load([
                'siswa:id,nama,kelas,class_id,nis',
                'creator:id,name,role',
                'updater:id,name,role',
            ])),
        ], 201);
    }

    public function show(Request $request, Hafalan $hafalan)
    {
        $actor = $this->resolveActor($request);
        if (!$actor || !$this->canViewHafalan($actor, $hafalan)) {
            return $this->forbidden();
        }

        return response()->json([
            'success' => true,
            'data' => $this->formatHafalan($hafalan->load([
                'siswa:id,nama,kelas,class_id,nis',
                'creator:id,name,role',
                'updater:id,name,role',
            ])),
        ]);
    }

    public function update(Request $request, Hafalan $hafalan)
    {
        $actor = $this->resolveActor($request);
        if (!$actor || !$this->canViewHafalan($actor, $hafalan)) {
            return $this->forbidden();
        }

        $validated = $request->validate([
            'user_id' => 'required|exists:users,id',
            'juz' => 'nullable|integer|min:1|max:30',
            'surah' => 'nullable|string|max:255',
            'surah_id' => 'nullable|integer|exists:surahs,id',
            'status' => 'sometimes|in:Belum,Proses,Selesai',
            'memorization_status_id' => 'nullable|integer|exists:memorization_statuses,id',
            'tanggal_setor' => 'nullable|date',
            'nilai_hafalan' => 'nullable|integer|min:0|max:100',
            'keterangan' => 'nullable|string',
            'periode' => 'nullable|string|max:100',
            'academic_year_id' => 'nullable|integer|exists:academic_years,id',
            'semester_id' => 'nullable|integer|exists:semesters,id',
            'tahun_ajaran' => 'nullable|string|max:30',
            'semester' => 'nullable|string|max:30',
        ]);

        unset($validated['user_id']);
        $validated = $this->normalizeReferences($validated, $hafalan);
        $validated['penguji'] = $actor->name;
        $validated['examiner_id'] = $actor->id;
        $validated['updated_by'] = $actor->id;
        $validated['updated_by_role'] = $actor->role;

        $hafalan->update($validated);
        $hafalan->refresh();
        PenilaianLog::recordHafalan($hafalan, $actor, 'diperbarui');

        return response()->json([
            'success' => true,
            'message' => 'Hafalan berhasil diupdate',
            'data' => $this->formatHafalan($hafalan->load([
                'siswa:id,nama,kelas,class_id,nis',
                'creator:id,name,role',
                'updater:id,name,role',
            ])),
        ]);
    }

    public function destroy(Request $request, Hafalan $hafalan)
    {
        $actor = $this->resolveActor($request);
        if (!$actor || !$this->canViewHafalan($actor, $hafalan)) {
            return $this->forbidden();
        }

        PenilaianLog::recordHafalan($hafalan->load(['siswa:id,nama,kelas,class_id,nis']), $actor, 'dihapus');
        $hafalan->delete();

        return response()->json([
            'success' => true,
            'message' => 'Hafalan berhasil dihapus',
        ]);
    }

    private function resolveActor(Request $request): ?User
    {
        return app(ActorResolver::class)->active($request);
    }

    private function canAccessPenilaian(User $actor): bool
    {
        return in_array($actor->role, ['admin', 'guru'], true);
    }

    private function applyHafalanFilters(Builder $query, Request $request): void
    {
        if ($request->filled('siswa_id')) {
            $query->where('siswa_id', $request->siswa_id);
        }
        if ($request->filled('memorization_status_id')) {
            $query->where('memorization_status_id', $request->integer('memorization_status_id'));
        }
        if ($request->filled('status')) {
            $statusId = app(ReferenceResolver::class)->memorizationStatusId($request->status);
            $query->where(function (Builder $builder) use ($request, $statusId) {
                if ($statusId) {
                    $builder->where('memorization_status_id', $statusId);
                }
                $builder->orWhere('status', $request->status);
            });
        }
        if ($request->filled('semester_id')) {
            $query->where('semester_id', $request->integer('semester_id'));
        }
        if ($request->filled('academic_year_id')) {
            $query->where('academic_year_id', $request->integer('academic_year_id'));
        }
        if ($request->filled('tahun_ajaran')) {
            $query->where(function (Builder $builder) use ($request) {
                $builder->where('tahun_ajaran', $request->tahun_ajaran)
                    ->orWhere('periode', 'ilike', '%' . $request->tahun_ajaran . '%');
            });
        }
        if ($request->filled('semester')) {
            $query->where(function (Builder $builder) use ($request) {
                $builder->whereRaw('lower(semester) = ?', [strtolower((string) $request->semester)])
                    ->orWhere('periode', 'ilike', '%' . $request->semester . '%');
            });
        }
        if ($request->filled('periode')) {
            $semesterId = app(ReferenceResolver::class)->semesterId($request->periode, null, false);
            $query->where(function (Builder $builder) use ($request, $semesterId) {
                if ($semesterId) {
                    $builder->where('semester_id', $semesterId);
                }
                $builder->orWhere('periode', $request->periode);
            });
        }
        if ($request->filled('class_id')) {
            $query->whereHas('siswa', function (Builder $builder) use ($request) {
                $builder->where('class_id', $request->integer('class_id'));
            });
        }
        if ($request->filled('kelas')) {
            $kelas = $request->kelas;
            $classId = app(ReferenceResolver::class)->classId($kelas, false);
            $query->whereHas('siswa', function (Builder $builder) use ($kelas, $classId) {
                $builder->where('kelas', $kelas);
                if ($classId) {
                    $builder->orWhere('class_id', $classId);
                }
            });
        }
    }

    private function applyActorScope(Builder $query, User $actor): void
    {
        if ($actor->role !== 'guru') {
            return;
        }

        $query->where(function (Builder $builder) use ($actor) {
            $builder->where('created_by', $actor->id)
                ->orWhere('updated_by', $actor->id)
                ->orWhere('examiner_id', $actor->id)
                ->orWhere('penguji', $actor->name);
        });
    }

    private function normalizeReferences(array $payload, ?Hafalan $existing = null): array
    {
        $resolver = app(ReferenceResolver::class);

        $surahId = $payload['surah_id'] ?? $existing?->surah_id;
        $surah = $payload['surah'] ?? $existing?->surah;
        if ($surahId) {
            $name = $resolver->nameById('surahs', (int) $surahId);
            if (!$name) {
                throw ValidationException::withMessages([
                    'surah_id' => ['Surah tidak ditemukan di master surah.'],
                ]);
            }
            if (isset($payload['surah']) && !$this->sameLabel($payload['surah'], $name)) {
                throw ValidationException::withMessages([
                    'surah_id' => ['Surah tidak sesuai dengan label yang dikirim. Pilih data resmi, jangan ketik bebas.'],
                ]);
            }
            $payload['surah_id'] = (int) $surahId;
            $payload['surah'] = $name;
        } elseif ($surah) {
            $id = $resolver->surahId($surah);
            $payload['surah_id'] = $id;
            $payload['surah'] = $resolver->nameById('surahs', $id) ?? $surah;
        }

        $statusId = $payload['memorization_status_id'] ?? $existing?->memorization_status_id;
        $status = $payload['status'] ?? $existing?->status;
        if ($statusId) {
            $name = $resolver->nameById('memorization_statuses', (int) $statusId);
            if (!$name) {
                throw ValidationException::withMessages([
                    'memorization_status_id' => ['Status hafalan tidak ditemukan di master status hafalan.'],
                ]);
            }
            if (isset($payload['status']) && !$this->sameLabel($payload['status'], $name)) {
                throw ValidationException::withMessages([
                    'memorization_status_id' => ['Status hafalan tidak sesuai dengan label yang dikirim.'],
                ]);
            }
            $payload['memorization_status_id'] = (int) $statusId;
            $payload['status'] = $name;
        } elseif ($status) {
            $id = $resolver->memorizationStatusId($status);
            if (!$id) {
                throw ValidationException::withMessages([
                    'status' => ['Status hafalan tidak ditemukan di master status hafalan. Pilih data resmi, jangan ketik bebas.'],
                ]);
            }
            $payload['memorization_status_id'] = $id;
            $payload['status'] = $resolver->nameById('memorization_statuses', $id) ?? $status;
        }

        $academicYearId = $payload['academic_year_id'] ?? $existing?->academic_year_id;
        $tahunAjaran = $payload['tahun_ajaran'] ?? $existing?->tahun_ajaran;
        if ($academicYearId && empty($payload['tahun_ajaran'])) {
            $payload['tahun_ajaran'] = DB::table('academic_years')
                ->where('id', (int) $academicYearId)
                ->value('name');
        } elseif (!$academicYearId && $tahunAjaran) {
            $payload['academic_year_id'] = $resolver->academicYearId($tahunAjaran, false);
        }

        $semesterId = $payload['semester_id'] ?? $existing?->semester_id;
        $periodLabel = trim(($payload['semester'] ?? $existing?->semester ?? '') . ' ' . ($payload['tahun_ajaran'] ?? $existing?->tahun_ajaran ?? ''));
        $periode = $payload['periode'] ?? ($periodLabel !== '' ? $periodLabel : $existing?->periode);
        if ($semesterId) {
            $name = $resolver->nameById('semesters', (int) $semesterId);
            if (!$name) {
                throw ValidationException::withMessages([
                    'semester_id' => ['Periode/semester tidak ditemukan di master semester.'],
                ]);
            }
            if (isset($payload['periode']) && !$this->sameLabel($payload['periode'], $name)) {
                throw ValidationException::withMessages([
                    'semester_id' => ['Periode/semester tidak sesuai dengan label yang dikirim.'],
                ]);
            }
            $payload['semester_id'] = (int) $semesterId;
            $payload['semester'] = $payload['semester'] ?? $name;
            $payload['periode'] = $payload['periode']
                ?? trim($name . ' ' . ($payload['tahun_ajaran'] ?? $existing?->tahun_ajaran ?? ''));
        } elseif ($periode) {
            $id = $resolver->semesterId($periode, null, true);
            $payload['semester_id'] = $id;
            $payload['semester'] = $payload['semester'] ?? $resolver->nameById('semesters', $id);
            $payload['periode'] = $payload['periode'] ?? $periode;
        }

        return $payload;
    }

    private function sameLabel(?string $left, ?string $right): bool
    {
        return strtolower(trim((string) $left)) === strtolower(trim((string) $right));
    }

    private function canViewHafalan(User $actor, Hafalan $hafalan): bool
    {
        if ($actor->role === 'admin') {
            return true;
        }

        if ($actor->role !== 'guru') {
            return false;
        }

        return (int) ($hafalan->created_by ?? 0) === $actor->id
            || (int) ($hafalan->updated_by ?? 0) === $actor->id
            || (int) ($hafalan->examiner_id ?? 0) === $actor->id
            || ($hafalan->penguji ?? '') === $actor->name;
    }

    private function forbidden()
    {
        return response()->json([
            'success' => false,
            'message' => 'Anda tidak memiliki akses ke data hafalan ini',
        ], 403);
    }

    private function formatHafalan(Hafalan $hafalan): array
    {
        $penilaiNama = $hafalan->updater?->name
            ?? $hafalan->creator?->name
            ?? $hafalan->penguji
            ?? '-';
        $penilaiRole = $hafalan->updated_by_role
            ?? $hafalan->created_by_role
            ?? $hafalan->updater?->role
            ?? $hafalan->creator?->role
            ?? '-';

        return [
            'id' => $hafalan->id,
            'siswa_id' => $hafalan->siswa_id,
            'siswa' => $hafalan->siswa ? [
                'id' => $hafalan->siswa->id,
                'nama' => $hafalan->siswa->nama,
                'kelas' => $hafalan->siswa->kelas,
                'class_id' => $hafalan->siswa->class_id,
                'nis' => $hafalan->siswa->nis,
            ] : null,
            'juz' => $hafalan->juz,
            'surah' => $hafalan->surah,
            'surah_id' => $hafalan->surah_id,
            'status' => $hafalan->status,
            'memorization_status_id' => $hafalan->memorization_status_id,
            'tanggal_setor' => optional($hafalan->tanggal_setor)->format('Y-m-d'),
            'penguji' => $hafalan->penguji,
            'examiner_id' => $hafalan->examiner_id,
            'nilai_hafalan' => $hafalan->nilai_hafalan,
            'keterangan' => $hafalan->keterangan,
            'periode' => $hafalan->periode,
            'academic_year_id' => $hafalan->academic_year_id,
            'semester_id' => $hafalan->semester_id,
            'tahun_ajaran' => $hafalan->tahun_ajaran,
            'semester' => $hafalan->semester,
            'penilai_nama' => $penilaiNama,
            'penilai_role' => $penilaiRole,
            'status_data' => $hafalan->updated_at && $hafalan->created_at && $hafalan->updated_at->gt($hafalan->created_at)
                ? 'diperbarui'
                : 'dibuat',
            'created_at' => optional($hafalan->created_at)->format('Y-m-d H:i'),
            'updated_at' => optional($hafalan->updated_at)->format('Y-m-d H:i'),
        ];
    }
}
