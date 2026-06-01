<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Nilai;
use App\Models\PenilaianLog;
use App\Models\User;
use App\Services\ActorResolver;
use App\Services\ReferenceResolver;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class NilaiController extends Controller
{
    public function index(Request $request)
    {
        $actor = $this->resolveActor($request);
        if (!$actor || !$this->canAccessPenilaian($actor)) {
            return $this->forbidden();
        }

        $query = Nilai::with([
            'siswa:id,nama,kelas,class_id,nis',
            'mataPelajaran:id,nama,kode,status',
            'creator:id,name,role',
            'updater:id,name,role',
        ]);

        $this->applyNilaiFilters($query, $request);
        $this->applyActorScope($query, $actor);

        $data = $query
            ->orderByDesc('updated_at')
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (Nilai $nilai) => $this->formatNilai($nilai));

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
            'mapel_id' => 'required|exists:mata_pelajaran,id',
            'jenis_ujian' => 'required|in:UTS,UAS,Hafalan,Tugas,Harian',
            'assessment_type_id' => 'nullable|integer|exists:assessment_types,id',
            'nilai' => 'required|numeric|min:0|max:100',
            'semester' => 'nullable|string|max:100',
            'semester_id' => 'nullable|integer|exists:semesters,id',
            'keterangan' => 'nullable|string',
            'tahun_ajaran' => 'nullable|string|max:100',
            'academic_year_id' => 'nullable|integer|exists:academic_years,id',
        ]);

        unset($validated['user_id']);
        $validated = $this->normalizeReferences($validated);
        $this->ensureActorCanAssessMapel($actor, (int) $validated['mapel_id']);

        $validated['grade'] = Nilai::calculateGrade((float) $validated['nilai']);
        $validated['diinput_oleh'] = $actor->name;
        $validated['created_by'] = $actor->id;
        $validated['updated_by'] = $actor->id;
        $validated['created_by_role'] = $actor->role;
        $validated['updated_by_role'] = $actor->role;

        $nilai = Nilai::create($validated);
        PenilaianLog::recordNilai($nilai, $actor, 'dibuat');

        return response()->json([
            'success' => true,
            'message' => 'Nilai berhasil disimpan',
            'data' => $this->formatNilai($nilai->load([
                'siswa:id,nama,kelas,class_id,nis',
                'mataPelajaran:id,nama,kode,status',
                'creator:id,name,role',
                'updater:id,name,role',
            ])),
        ], 201);
    }

    public function storeBulk(Request $request)
    {
        $actor = $this->resolveActor($request);
        if (!$actor || !$this->canAccessPenilaian($actor)) {
            return $this->forbidden();
        }

        $validated = $request->validate([
            'user_id' => 'required|exists:users,id',
            'data' => 'required|array|min:1',
            'data.*.siswa_id' => 'required|exists:siswa,id',
            'data.*.mapel_id' => 'required|exists:mata_pelajaran,id',
            'data.*.jenis_ujian' => 'required|in:UTS,UAS,Hafalan,Tugas,Harian',
            'data.*.assessment_type_id' => 'nullable|integer|exists:assessment_types,id',
            'data.*.nilai' => 'required|numeric|min:0|max:100',
            'data.*.semester' => 'nullable|string|max:100',
            'data.*.semester_id' => 'nullable|integer|exists:semesters,id',
            'data.*.keterangan' => 'nullable|string',
            'data.*.tahun_ajaran' => 'nullable|string|max:100',
            'data.*.academic_year_id' => 'nullable|integer|exists:academic_years,id',
        ]);

        $created = DB::transaction(function () use ($validated, $actor) {
            $rows = [];
            foreach ($validated['data'] as $item) {
                $item = $this->normalizeReferences($item);
                $this->ensureActorCanAssessMapel($actor, (int) $item['mapel_id']);

                $item['grade'] = Nilai::calculateGrade((float) $item['nilai']);
                $item['diinput_oleh'] = $actor->name;
                $item['created_by'] = $actor->id;
                $item['updated_by'] = $actor->id;
                $item['created_by_role'] = $actor->role;
                $item['updated_by_role'] = $actor->role;

                $nilai = Nilai::create($item);
                PenilaianLog::recordNilai($nilai, $actor, 'dibuat');
                $rows[] = $nilai->load([
                    'siswa:id,nama,kelas,class_id,nis',
                    'mataPelajaran:id,nama,kode,status',
                    'creator:id,name,role',
                    'updater:id,name,role',
                ]);
            }

            return $rows;
        });

        return response()->json([
            'success' => true,
            'message' => count($created) . ' nilai berhasil disimpan',
            'data' => collect($created)->map(fn (Nilai $nilai) => $this->formatNilai($nilai))->values(),
        ], 201);
    }

    public function show(Request $request, Nilai $nilai)
    {
        $actor = $this->resolveActor($request);
        if (!$actor || !$this->canViewNilai($actor, $nilai)) {
            return $this->forbidden();
        }

        return response()->json([
            'success' => true,
            'data' => $this->formatNilai($nilai->load([
                'siswa:id,nama,kelas,class_id,nis',
                'mataPelajaran:id,nama,kode,status',
                'creator:id,name,role',
                'updater:id,name,role',
            ])),
        ]);
    }

    public function update(Request $request, Nilai $nilai)
    {
        $actor = $this->resolveActor($request);
        if (!$actor || !$this->canEditNilai($actor, $nilai)) {
            return $this->forbidden();
        }

        $validated = $request->validate([
            'user_id' => 'required|exists:users,id',
            'siswa_id' => 'sometimes|exists:siswa,id',
            'mapel_id' => 'sometimes|exists:mata_pelajaran,id',
            'jenis_ujian' => 'sometimes|in:UTS,UAS,Hafalan,Tugas,Harian',
            'assessment_type_id' => 'nullable|integer|exists:assessment_types,id',
            'nilai' => 'sometimes|numeric|min:0|max:100',
            'semester' => 'nullable|string|max:100',
            'semester_id' => 'nullable|integer|exists:semesters,id',
            'keterangan' => 'nullable|string',
            'tahun_ajaran' => 'nullable|string|max:100',
            'academic_year_id' => 'nullable|integer|exists:academic_years,id',
        ]);

        unset($validated['user_id']);
        $validated = $this->normalizeReferences($validated, $nilai);
        $mapelId = (int) ($validated['mapel_id'] ?? $nilai->mapel_id);
        $this->ensureActorCanAssessMapel($actor, $mapelId);

        if (isset($validated['nilai'])) {
            $validated['grade'] = Nilai::calculateGrade((float) $validated['nilai']);
        }

        $validated['diinput_oleh'] = $actor->name;
        $validated['updated_by'] = $actor->id;
        $validated['updated_by_role'] = $actor->role;

        $nilai->update($validated);
        $nilai->refresh();
        PenilaianLog::recordNilai($nilai, $actor, 'diperbarui');

        return response()->json([
            'success' => true,
            'message' => 'Nilai berhasil diupdate',
            'data' => $this->formatNilai($nilai->load([
                'siswa:id,nama,kelas,class_id,nis',
                'mataPelajaran:id,nama,kode,status',
                'creator:id,name,role',
                'updater:id,name,role',
            ])),
        ]);
    }

    public function destroy(Request $request, Nilai $nilai)
    {
        $actor = $this->resolveActor($request);
        if (!$actor || !$this->canEditNilai($actor, $nilai)) {
            return $this->forbidden();
        }

        PenilaianLog::recordNilai($nilai->load(['siswa:id,nama,kelas,class_id,nis', 'mataPelajaran:id,nama']), $actor, 'dihapus');
        $nilai->delete();

        return response()->json([
            'success' => true,
            'message' => 'Nilai berhasil dihapus',
        ]);
    }

    public function rekap(Request $request)
    {
        $actor = $this->resolveActor($request);
        if (!$actor || !$this->canAccessPenilaian($actor)) {
            return $this->forbidden();
        }

        $query = Nilai::with([
            'siswa:id,nama,kelas,class_id,nis',
            'mataPelajaran:id,nama,kode,status',
            'creator:id,name,role',
            'updater:id,name,role',
        ]);

        $this->applyNilaiFilters($query, $request);
        $this->applyActorScope($query, $actor);

        $data = $query->get()->groupBy('siswa_id')->map(function ($nilaiGroup) {
            $siswa = $nilaiGroup->first()->siswa;

            $perMapel = $nilaiGroup->groupBy('mapel_id')->map(function ($mapelGroup) {
                $mapel = $mapelGroup->first()->mataPelajaran;
                $latest = $mapelGroup->sortByDesc('updated_at')->first();

                return [
                    'mapel_id' => $mapel?->id,
                    'mapel' => $mapel?->nama ?? '-',
                    'kode' => $mapel?->kode ?? '-',
                    'rata_rata' => round((float) $mapelGroup->avg('nilai'), 2),
                    'predikat' => Nilai::calculateGrade((float) $mapelGroup->avg('nilai')),
                    'penilai_nama' => $latest->updater?->name ?? $latest->diinput_oleh ?? '-',
                    'penilai_role' => $latest->updated_by_role ?? $latest->created_by_role ?? '-',
                    'tanggal_update' => optional($latest->updated_at)->format('Y-m-d H:i'),
                    'detail' => $mapelGroup->map(fn (Nilai $nilai) => $this->formatNilai($nilai))->values(),
                ];
            })->values();

            return [
                'siswa' => [
                    'id' => $siswa?->id,
                    'nama' => $siswa?->nama ?? '-',
                    'kelas' => $siswa?->kelas ?? '-',
                    'nis' => $siswa?->nis ?? '-',
                ],
                'rata_rata' => $perMapel->isNotEmpty() ? round((float) $perMapel->avg('rata_rata'), 2) : 0,
                'nilai_per_mapel' => $perMapel,
            ];
        })->values();

        return response()->json([
            'success' => true,
            'data' => $data,
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

    private function ensureActorCanAssessMapel(User $actor, int $mapelId): void
    {
        if ($actor->role === 'admin') {
            return;
        }

        $isAssignedTeacher = DB::table('mapel_guru')
            ->where('mapel_id', $mapelId)
            ->where('user_id', $actor->id)
            ->exists();

        if (!$isAssignedTeacher) {
            throw ValidationException::withMessages([
                'mapel_id' => ['Guru ini tidak terhubung ke mata pelajaran yang dipilih.'],
            ]);
        }
    }

    private function applyNilaiFilters(Builder $query, Request $request): void
    {
        if ($request->filled('siswa_id')) {
            $query->where('siswa_id', $request->siswa_id);
        }
        if ($request->filled('mapel_id')) {
            $query->where('mapel_id', $request->mapel_id);
        }
        if ($request->filled('assessment_type_id')) {
            $query->where('assessment_type_id', $request->integer('assessment_type_id'));
        }
        if ($request->filled('jenis_ujian')) {
            $assessmentTypeId = app(ReferenceResolver::class)->assessmentTypeId($request->jenis_ujian);
            $query->where(function (Builder $builder) use ($request, $assessmentTypeId) {
                if ($assessmentTypeId) {
                    $builder->where('assessment_type_id', $assessmentTypeId);
                }
                $builder->orWhere('jenis_ujian', $request->jenis_ujian);
            });
        }
        if ($request->filled('semester_id')) {
            $query->where('semester_id', $request->integer('semester_id'));
        }
        if ($request->filled('semester')) {
            $semesterId = app(ReferenceResolver::class)->semesterId($request->semester, $request->tahun_ajaran, false);
            $query->where(function (Builder $builder) use ($request, $semesterId) {
                if ($semesterId) {
                    $builder->where('semester_id', $semesterId);
                }
                $builder->orWhere('semester', $request->semester);
            });
        }
        if ($request->filled('academic_year_id')) {
            $query->where('academic_year_id', $request->integer('academic_year_id'));
        }
        if ($request->filled('tahun_ajaran')) {
            $academicYearId = app(ReferenceResolver::class)->academicYearId($request->tahun_ajaran, false);
            $query->where(function (Builder $builder) use ($request, $academicYearId) {
                if ($academicYearId) {
                    $builder->where('academic_year_id', $academicYearId);
                }
                $builder->orWhere('tahun_ajaran', $request->tahun_ajaran);
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
            ->orWhere('diinput_oleh', $actor->name);
        });
    }

    private function normalizeReferences(array $payload, ?Nilai $existing = null): array
    {
        $resolver = app(ReferenceResolver::class);

        $assessmentTypeId = $payload['assessment_type_id'] ?? $existing?->assessment_type_id;
        $jenisUjian = $payload['jenis_ujian'] ?? $existing?->jenis_ujian;
        if ($assessmentTypeId) {
            $name = $resolver->nameById('assessment_types', (int) $assessmentTypeId);
            if (!$name) {
                throw ValidationException::withMessages([
                    'assessment_type_id' => ['Jenis ujian tidak ditemukan di master jenis penilaian.'],
                ]);
            }
            if (isset($payload['jenis_ujian']) && !$this->sameLabel($payload['jenis_ujian'], $name)) {
                throw ValidationException::withMessages([
                    'assessment_type_id' => ['Jenis ujian tidak sesuai dengan label yang dikirim. Pilih data resmi, jangan ketik bebas.'],
                ]);
            }
            $payload['assessment_type_id'] = (int) $assessmentTypeId;
            $payload['jenis_ujian'] = $name;
        } elseif ($jenisUjian) {
            $id = $resolver->assessmentTypeId($jenisUjian);
            if (!$id) {
                throw ValidationException::withMessages([
                    'jenis_ujian' => ['Jenis ujian tidak ditemukan di master jenis penilaian. Pilih data resmi, jangan ketik bebas.'],
                ]);
            }
            $payload['assessment_type_id'] = $id;
            $payload['jenis_ujian'] = $resolver->nameById('assessment_types', $id) ?? $jenisUjian;
        }

        $academicYearId = $payload['academic_year_id'] ?? $existing?->academic_year_id;
        $tahunAjaran = $payload['tahun_ajaran'] ?? $existing?->tahun_ajaran;
        if ($academicYearId) {
            $name = $resolver->nameById('academic_years', (int) $academicYearId);
            if (!$name) {
                throw ValidationException::withMessages([
                    'academic_year_id' => ['Tahun ajaran tidak ditemukan di master tahun ajaran.'],
                ]);
            }
            if (isset($payload['tahun_ajaran']) && !$this->sameLabel($payload['tahun_ajaran'], $name)) {
                throw ValidationException::withMessages([
                    'academic_year_id' => ['Tahun ajaran tidak sesuai dengan label yang dikirim.'],
                ]);
            }
            $payload['academic_year_id'] = (int) $academicYearId;
            $payload['tahun_ajaran'] = $name;
        } elseif ($tahunAjaran) {
            $id = $resolver->academicYearId($tahunAjaran, true);
            $payload['academic_year_id'] = $id;
            $payload['tahun_ajaran'] = $resolver->nameById('academic_years', $id) ?? $tahunAjaran;
        }

        $semesterId = $payload['semester_id'] ?? $existing?->semester_id;
        $semester = $payload['semester'] ?? $existing?->semester;
        $tahunAjaran = $payload['tahun_ajaran'] ?? $existing?->tahun_ajaran;
        if ($semesterId) {
            $name = $resolver->nameById('semesters', (int) $semesterId);
            if (!$name) {
                throw ValidationException::withMessages([
                    'semester_id' => ['Semester tidak ditemukan di master semester.'],
                ]);
            }
            if (isset($payload['semester']) && !$this->sameLabel($payload['semester'], $name)) {
                throw ValidationException::withMessages([
                    'semester_id' => ['Semester tidak sesuai dengan label yang dikirim.'],
                ]);
            }
            $payload['semester_id'] = (int) $semesterId;
            $payload['semester'] = $name;
        } elseif ($semester) {
            $id = $resolver->semesterId($semester, $tahunAjaran, true);
            $payload['semester_id'] = $id;
            $payload['semester'] = $resolver->nameById('semesters', $id) ?? $semester;
        }

        return $payload;
    }

    private function sameLabel(?string $left, ?string $right): bool
    {
        return strtolower(trim((string) $left)) === strtolower(trim((string) $right));
    }

    private function canViewNilai(User $actor, Nilai $nilai): bool
    {
        if ($actor->role === 'admin') {
            return true;
        }

        if ($actor->role !== 'guru') {
            return false;
        }

        return (int) ($nilai->created_by ?? 0) === $actor->id
            || (int) ($nilai->updated_by ?? 0) === $actor->id
            || ($nilai->diinput_oleh ?? '') === $actor->name;
    }

    private function canEditNilai(User $actor, Nilai $nilai): bool
    {
        return $this->canViewNilai($actor, $nilai);
    }

    private function forbidden()
    {
        return response()->json([
            'success' => false,
            'message' => 'Anda tidak memiliki akses ke data nilai ini',
        ], 403);
    }

    private function formatNilai(Nilai $nilai): array
    {
        $penilaiNama = $nilai->updater?->name
            ?? $nilai->creator?->name
            ?? $nilai->diinput_oleh
            ?? '-';
        $penilaiRole = $nilai->updated_by_role
            ?? $nilai->created_by_role
            ?? $nilai->updater?->role
            ?? $nilai->creator?->role
            ?? '-';

        return [
            'id' => $nilai->id,
            'siswa_id' => $nilai->siswa_id,
            'siswa' => $nilai->siswa ? [
                'id' => $nilai->siswa->id,
                'nama' => $nilai->siswa->nama,
                'kelas' => $nilai->siswa->kelas,
                'class_id' => $nilai->siswa->class_id,
                'nis' => $nilai->siswa->nis,
            ] : null,
            'mapel_id' => $nilai->mapel_id,
            'mata_pelajaran' => $nilai->mataPelajaran ? [
                'id' => $nilai->mataPelajaran->id,
                'nama' => $nilai->mataPelajaran->nama,
                'kode' => $nilai->mataPelajaran->kode,
                'status' => $nilai->mataPelajaran->status,
            ] : null,
            'jenis_ujian' => $nilai->jenis_ujian,
            'assessment_type_id' => $nilai->assessment_type_id,
            'nilai' => (float) $nilai->nilai,
            'semester' => $nilai->semester,
            'semester_id' => $nilai->semester_id,
            'grade' => $nilai->grade,
            'keterangan' => $nilai->keterangan,
            'diinput_oleh' => $nilai->diinput_oleh,
            'tahun_ajaran' => $nilai->tahun_ajaran,
            'academic_year_id' => $nilai->academic_year_id,
            'created_by' => $nilai->created_by,
            'updated_by' => $nilai->updated_by,
            'created_by_role' => $nilai->created_by_role,
            'updated_by_role' => $nilai->updated_by_role,
            'penilai_nama' => $penilaiNama,
            'penilai_role' => $penilaiRole,
            'status_data' => $nilai->updated_at && $nilai->created_at && $nilai->updated_at->gt($nilai->created_at)
                ? 'diperbarui'
                : 'dibuat',
            'created_at' => optional($nilai->created_at)->format('Y-m-d H:i'),
            'updated_at' => optional($nilai->updated_at)->format('Y-m-d H:i'),
        ];
    }
}
