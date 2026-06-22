<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DocumentSetting;
use App\Models\Hafalan;
use App\Models\Nilai;
use App\Models\Siswa;
use App\Models\User;
use App\Services\ActorResolver;
use App\Services\ReferenceResolver;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

class PenilaianController extends Controller
{
    public function documentData(Request $request)
    {
        $actor = $this->resolveActor($request);
        if (!$actor) {
            return $this->forbidden('User tidak ditemukan');
        }

        $validated = $request->validate([
            'user_id' => 'required|exists:users,id',
            'siswa_id' => 'required|exists:siswa,id',
            'semester' => 'nullable|string',
            'semester_id' => 'nullable|integer|exists:semesters,id',
            'tahun_ajaran' => 'nullable|string',
            'academic_year_id' => 'nullable|integer|exists:academic_years,id',
            'report_scope' => 'nullable|in:pelajaran,hafalan,gabungan',
        ]);

        $siswa = Siswa::with('wali:id,name')->findOrFail($validated['siswa_id']);
        if ($actor->role === 'wali' && (int) $siswa->wali_id !== $actor->id) {
            return $this->forbidden('Anda hanya dapat melihat nilai anak sendiri');
        }

        $semester = $validated['semester'] ?? null;
        $semesterId = $validated['semester_id'] ?? null;
        $tahunAjaran = $validated['tahun_ajaran'] ?? null;
        $academicYearId = $validated['academic_year_id'] ?? null;
        $scope = $validated['report_scope'] ?? 'gabungan';

        $nilaiQuery = Nilai::with([
            'mataPelajaran:id,nama,kode,status',
            'creator:id,name,role',
            'updater:id,name,role',
        ])->where('siswa_id', $siswa->id);

        if ($academicYearId || $tahunAjaran) {
            $resolvedYearId = $academicYearId ?: app(ReferenceResolver::class)->academicYearId($tahunAjaran, false);
            $nilaiQuery->where(function (Builder $builder) use ($tahunAjaran, $resolvedYearId) {
                if ($resolvedYearId) {
                    $builder->where('academic_year_id', $resolvedYearId);
                }
                if ($tahunAjaran) {
                    $builder->orWhere('tahun_ajaran', $tahunAjaran);
                }
            });
        }

        if ($semesterId || $semester) {
            $resolvedSemesterId = $semesterId ?: app(ReferenceResolver::class)->semesterId($semester, $tahunAjaran, false);
            $nilaiQuery->where(function (Builder $builder) use ($semester, $resolvedSemesterId) {
                if ($resolvedSemesterId) {
                    $builder->where('semester_id', $resolvedSemesterId);
                }
                if ($semester) {
                    $builder->orWhere('semester', $semester);
                }
            });
        }

        if ($actor->role === 'guru') {
            $nilaiQuery->where(function (Builder $builder) use ($actor) {
                $builder->where('created_by', $actor->id)
                    ->orWhere('updated_by', $actor->id)
                    ->orWhere('diinput_oleh', $actor->name);
            });
        }

        $hafalanQuery = Hafalan::with([
            'creator:id,name,role',
            'updater:id,name,role',
        ])->where('siswa_id', $siswa->id);

        if ($semesterId) {
            $hafalanQuery->where('semester_id', $semesterId);
        } elseif ($tahunAjaran) {
            $hafalanQuery->where('periode', 'ilike', '%' . $tahunAjaran . '%');
        }

        if (!$semesterId && $semester) {
            $hafalanQuery->where('periode', 'ilike', '%' . $semester . '%');
        }

        if ($actor->role === 'guru') {
            $hafalanQuery->where(function (Builder $builder) use ($actor) {
                $builder->where('created_by', $actor->id)
                    ->orWhere('updated_by', $actor->id)
                    ->orWhere('penguji', $actor->name);
            });
        }

        $nilaiRows = $scope === 'hafalan' ? collect() : $nilaiQuery->orderBy('mapel_id')->orderBy('jenis_ujian')->get();
        $hafalanRows = $scope === 'pelajaran' ? collect() : $hafalanQuery->orderByDesc('updated_at')->orderByDesc('id')->get();

        $pelajaran = $nilaiRows->groupBy('mapel_id')->map(function ($items) {
            $mapel = $items->first()->mataPelajaran;
            $latest = $items->sortByDesc('updated_at')->first();
            $rataRata = round((float) $items->avg('nilai'), 1);

            return [
                'mapel_id' => $mapel?->id,
                'nama_mapel' => $mapel?->nama ?? '-',
                'kode_mapel' => $mapel?->kode ?? '-',
                'rata_rata' => $rataRata,
                'predikat' => Nilai::calculateGrade($rataRata),
                'penilai_nama' => $latest->updater?->name ?? $latest->creator?->name ?? $latest->diinput_oleh ?? '-',
                'penilai_role' => $latest->updated_by_role ?? $latest->created_by_role ?? '-',
                'updated_at' => optional($latest->updated_at)->format('Y-m-d H:i'),
                'detail' => $items->map(function (Nilai $nilai) {
                    return [
                        'id' => $nilai->id,
                        'jenis_ujian' => $nilai->jenis_ujian,
                        'nilai' => (float) $nilai->nilai,
                        'predikat' => $nilai->grade,
                        'keterangan' => $nilai->keterangan,
                        'penilai_nama' => $nilai->updater?->name ?? $nilai->creator?->name ?? $nilai->diinput_oleh ?? '-',
                        'penilai_role' => $nilai->updated_by_role ?? $nilai->created_by_role ?? '-',
                        'updated_at' => optional($nilai->updated_at)->format('Y-m-d H:i'),
                    ];
                })->values(),
            ];
        })->values();

        $hafalan = $hafalanRows->map(function (Hafalan $item) {
            $label = $item->surah
                ? 'Surah ' . $item->surah
                : ($item->juz ? 'Juz ' . $item->juz : 'Hafalan Al-Qur\'an');

            return [
                'id' => $item->id,
                'item_label' => $label,
                'juz' => $item->juz,
                'surah' => $item->surah,
                'status' => $item->status,
                'nilai' => $item->nilai_hafalan,
                'keterangan' => $item->keterangan,
                'periode' => $item->periode,
                'penilai_nama' => $item->updater?->name ?? $item->creator?->name ?? $item->penguji ?? '-',
                'penilai_role' => $item->updated_by_role ?? $item->created_by_role ?? '-',
                'updated_at' => optional($item->updated_at)->format('Y-m-d H:i'),
            ];
        })->values();

        $documentSetting = DocumentSetting::query()->first();

        return response()->json([
            'success' => true,
            'data' => [
                'scope' => $scope,
                'tahun_ajaran' => $tahunAjaran,
                'semester' => $semester,
                'siswa' => [
                    'id' => $siswa->id,
                    'nama' => $siswa->nama,
                    'nis' => $siswa->nis,
                    'kelas' => $siswa->kelas,
                    'wali_nama' => $siswa->wali?->name,
                ],
                'summary' => [
                    'rata_rata_pelajaran' => $pelajaran->isNotEmpty() ? round((float) $pelajaran->avg('rata_rata'), 1) : 0,
                    'predikat_pelajaran' => $pelajaran->isNotEmpty()
                        ? Nilai::calculateGrade((float) $pelajaran->avg('rata_rata'))
                        : '-',
                    'capaian_hafalan' => $hafalan->where('status', 'Selesai')->count() . '/' . $hafalan->count(),
                    'rata_rata_hafalan' => $hafalan->whereNotNull('nilai')->isNotEmpty()
                        ? round((float) $hafalan->whereNotNull('nilai')->avg('nilai'), 1)
                        : 0,
                ],
                'pelajaran' => $pelajaran,
                'hafalan' => $hafalan,
                'document_setting' => $documentSetting ? [
                    'kepala_madin_nama' => $documentSetting->kepala_madin_nama,
                    'jabatan' => $documentSetting->jabatan,
                    'signature_mode' => $documentSetting->signature_mode,
                    'signature_url' => $documentSetting->signature_path ? url('storage/' . $documentSetting->signature_path) : null,
                    'document_logo_url' => $documentSetting->document_logo_path ? url('storage/' . $documentSetting->document_logo_path) : null,
                ] : null,
            ],
        ]);
    }

    public function rekapExport(Request $request)
    {
        $actor = $this->resolveActor($request);
        if (!$actor || $actor->role !== 'admin') {
            return $this->forbidden('Hanya admin yang dapat mengunduh rekap nilai');
        }

        $request->validate([
            'user_id' => 'required|exists:users,id',
            'kelas' => 'nullable|string',
            'class_id' => 'nullable|integer|exists:classes,id',
            'semester' => 'nullable|string',
            'semester_id' => 'nullable|integer|exists:semesters,id',
            'tahun_ajaran' => 'nullable|string',
            'academic_year_id' => 'nullable|integer|exists:academic_years,id',
            'score_type' => 'nullable|in:pelajaran,hafalan,gabungan',
        ]);

        $scoreType = $request->score_type ?? 'gabungan';

        $nilaiQuery = Nilai::with(['siswa:id,nama,kelas,class_id,nis', 'mataPelajaran:id,nama', 'updater:id,name,role']);
        $hafalanQuery = Hafalan::with(['siswa:id,nama,kelas,class_id,nis', 'updater:id,name,role']);

        if ($request->filled('class_id')) {
            $nilaiQuery->whereHas('siswa', fn (Builder $builder) => $builder->where('class_id', $request->integer('class_id')));
            $hafalanQuery->whereHas('siswa', fn (Builder $builder) => $builder->where('class_id', $request->integer('class_id')));
        } elseif ($request->filled('kelas')) {
            $kelas = $request->kelas;
            $classId = app(ReferenceResolver::class)->classId($kelas, false);
            $nilaiQuery->whereHas('siswa', function (Builder $builder) use ($kelas, $classId) {
                $builder->where('kelas', $kelas);
                if ($classId) {
                    $builder->orWhere('class_id', $classId);
                }
            });
            $hafalanQuery->whereHas('siswa', function (Builder $builder) use ($kelas, $classId) {
                $builder->where('kelas', $kelas);
                if ($classId) {
                    $builder->orWhere('class_id', $classId);
                }
            });
        }
        if ($request->filled('academic_year_id')) {
            $nilaiQuery->where('academic_year_id', $request->integer('academic_year_id'));
        } elseif ($request->filled('tahun_ajaran')) {
            $yearId = app(ReferenceResolver::class)->academicYearId($request->tahun_ajaran, false);
            $nilaiQuery->where(function (Builder $builder) use ($request, $yearId) {
                if ($yearId) {
                    $builder->where('academic_year_id', $yearId);
                }
                $builder->orWhere('tahun_ajaran', $request->tahun_ajaran);
            });
            $hafalanQuery->where('periode', 'ilike', '%' . $request->tahun_ajaran . '%');
        }

        if ($request->filled('semester_id')) {
            $nilaiQuery->where('semester_id', $request->integer('semester_id'));
            $hafalanQuery->where('semester_id', $request->integer('semester_id'));
        } elseif ($request->filled('semester')) {
            $semesterId = app(ReferenceResolver::class)->semesterId($request->semester, $request->tahun_ajaran, false);
            $nilaiQuery->where(function (Builder $builder) use ($request, $semesterId) {
                if ($semesterId) {
                    $builder->where('semester_id', $semesterId);
                }
                $builder->orWhere('semester', $request->semester);
            });
            $hafalanQuery->where('periode', 'ilike', '%' . $request->semester . '%');
        }

        $nilaiRows = $scoreType === 'hafalan' ? collect() : $nilaiQuery->get();
        $hafalanRows = $scoreType === 'pelajaran' ? collect() : $hafalanQuery->get();

        $studentIds = $nilaiRows->pluck('siswa_id')->merge($hafalanRows->pluck('siswa_id'))->unique()->values();
        $rows = collect();

        foreach ($studentIds as $siswaId) {
            $nilaiPerSiswa = $nilaiRows->where('siswa_id', $siswaId);
            $hafalanPerSiswa = $hafalanRows->where('siswa_id', $siswaId);
            $siswa = $nilaiPerSiswa->first()?->siswa ?? $hafalanPerSiswa->first()?->siswa;
            if (!$siswa) {
                continue;
            }

            $mapelText = $nilaiPerSiswa
                ->groupBy('mapel_id')
                ->map(function ($items) {
                    $mapelName = $items->first()->mataPelajaran?->nama ?? '-';
                    $avg = round((float) $items->avg('nilai'), 1);
                    return $mapelName . ': ' . $avg . ' (' . Nilai::calculateGrade($avg) . ')';
                })
                ->implode(' | ');

            $hafalanText = $hafalanPerSiswa
                ->map(function (Hafalan $hafalan) {
                    $label = $hafalan->surah
                        ? 'Surah ' . $hafalan->surah
                        : ($hafalan->juz ? 'Juz ' . $hafalan->juz : 'Hafalan');
                    return $label . ': ' . ($hafalan->nilai_hafalan ?? '-') . ' [' . $hafalan->status . ']';
                })
                ->implode(' | ');

            $penilai = $nilaiPerSiswa->sortByDesc('updated_at')->first()?->updater?->name
                ?? $hafalanPerSiswa->sortByDesc('updated_at')->first()?->updater?->name
                ?? '-';

            $updatedAt = $nilaiPerSiswa->merge($hafalanPerSiswa)->sortByDesc('updated_at')->first()?->updated_at;
            $avgNilai = $nilaiPerSiswa->isNotEmpty() ? round((float) $nilaiPerSiswa->avg('nilai'), 1) : null;
            $avgHafalan = $hafalanPerSiswa->whereNotNull('nilai_hafalan')->isNotEmpty()
                ? round((float) $hafalanPerSiswa->whereNotNull('nilai_hafalan')->avg('nilai_hafalan'), 1)
                : null;
            $overallValues = collect([$avgNilai, $avgHafalan])->filter(fn ($value) => $value !== null);
            $avgOverall = $overallValues->isNotEmpty() ? round((float) $overallValues->avg(), 1) : 0;

            $rows->push([
                'nama_siswa' => $siswa->nama,
                'nis' => $siswa->nis,
                'kelas' => $siswa->kelas,
                'nilai_pelajaran' => $mapelText,
                'nilai_hafalan' => $hafalanText,
                'rata_rata' => $avgOverall,
                'predikat' => $avgOverall > 0 ? Nilai::calculateGrade($avgOverall) : '-',
                'nama_penilai' => $penilai,
                'tanggal_update' => optional($updatedAt)->format('Y-m-d H:i') ?? '-',
            ]);
        }

        return response()->json([
            'success' => true,
            'filters' => [
                'kelas' => $request->kelas,
                'tahun_ajaran' => $request->tahun_ajaran,
                'semester' => $request->semester,
                'score_type' => $scoreType,
            ],
            'data' => $rows->values(),
        ]);
    }

    private function resolveActor(Request $request): ?User
    {
        return app(ActorResolver::class)->active($request);
    }

    private function forbidden(string $message)
    {
        return response()->json([
            'success' => false,
            'message' => $message,
        ], 403);
    }
}
