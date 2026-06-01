<?php

namespace App\Services;

use App\Models\AcademicYear;
use App\Models\Semester;
use App\Models\Siswa;
use App\Models\SiswaTahunAjaran;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;

class AcademicPeriodService
{
    public const SEMESTER_GANJIL = 'ganjil';
    public const SEMESTER_GENAP = 'genap';

    public function active(): array
    {
        $academicYear = AcademicYear::query()
            ->with('semesters')
            ->where('is_active', true)
            ->orderByDesc('id')
            ->first();

        if (!$academicYear) {
            $academicYear = $this->createFallback();
        }

        $semesterCode = $this->normalizeSemester($academicYear->active_semester ?: self::SEMESTER_GANJIL);
        $semester = $this->ensureSemester($academicYear, $semesterCode, true);

        return [
            'academic_year' => $academicYear->fresh('semesters'),
            'semester' => $semester,
            'academic_year_id' => $academicYear->id,
            'semester_id' => $semester?->id,
            'tahun_ajaran' => $academicYear->name,
            'semester_code' => $semesterCode,
            'semester_label' => $this->semesterLabel($semesterCode),
        ];
    }

    public function create(array $payload): AcademicYear
    {
        $yearStart = (int) ($payload['year_start'] ?? 0);
        $yearEnd = (int) ($payload['year_end'] ?? ($yearStart + 1));
        $name = trim((string) ($payload['name'] ?? "{$yearStart}/{$yearEnd}"));
        $semester = $this->normalizeSemester($payload['active_semester'] ?? self::SEMESTER_GANJIL);

        if ($yearStart < 1900 || $yearEnd <= $yearStart) {
            throw ValidationException::withMessages([
                'year_start' => 'Tahun ajaran tidak valid.',
            ]);
        }

        return DB::transaction(function () use ($payload, $name, $yearStart, $yearEnd, $semester) {
            $academicYear = AcademicYear::query()->create([
                'name' => $name,
                'year_start' => $yearStart,
                'year_end' => $yearEnd,
                'start_date' => $payload['start_date'] ?? "{$yearStart}-07-01",
                'end_date' => $payload['end_date'] ?? "{$yearEnd}-06-30",
                'active_semester' => $semester,
                'is_active' => (bool) ($payload['is_active'] ?? false),
            ]);

            $this->ensureSemester($academicYear, self::SEMESTER_GANJIL, $semester === self::SEMESTER_GANJIL);
            $this->ensureSemester($academicYear, self::SEMESTER_GENAP, $semester === self::SEMESTER_GENAP);

            if ($academicYear->is_active) {
                $this->activate($academicYear, $semester);
            }

            return $academicYear->fresh('semesters');
        });
    }

    public function update(AcademicYear $academicYear, array $payload): AcademicYear
    {
        $semester = array_key_exists('active_semester', $payload)
            ? $this->normalizeSemester($payload['active_semester'])
            : ($academicYear->active_semester ?: self::SEMESTER_GANJIL);

        $academicYear->update([
            'name' => trim((string) ($payload['name'] ?? $academicYear->name)),
            'year_start' => $payload['year_start'] ?? $academicYear->year_start,
            'year_end' => $payload['year_end'] ?? $academicYear->year_end,
            'start_date' => $payload['start_date'] ?? $academicYear->start_date,
            'end_date' => $payload['end_date'] ?? $academicYear->end_date,
            'active_semester' => $semester,
        ]);

        if ($academicYear->is_active) {
            $this->setSemester($academicYear->fresh(), $semester);
        }

        return $academicYear->fresh('semesters');
    }

    public function activate(AcademicYear $academicYear, ?string $semester = null): AcademicYear
    {
        $semesterCode = $this->normalizeSemester($semester ?: $academicYear->active_semester ?: self::SEMESTER_GANJIL);

        return DB::transaction(function () use ($academicYear, $semesterCode) {
            AcademicYear::query()->where('id', '!=', $academicYear->id)->update(['is_active' => false]);

            $academicYear->update([
                'is_active' => true,
                'active_semester' => $semesterCode,
            ]);

            $this->setSemester($academicYear->fresh(), $semesterCode);

            return $academicYear->fresh('semesters');
        });
    }

    public function setSemester(AcademicYear $academicYear, string $semester): Semester
    {
        $semesterCode = $this->normalizeSemester($semester);

        return DB::transaction(function () use ($academicYear, $semesterCode) {
            $academicYear->update(['active_semester' => $semesterCode]);
            Semester::query()
                ->where('academic_year_id', $academicYear->id)
                ->update(['is_active' => false]);

            return $this->ensureSemester($academicYear, $semesterCode, true);
        });
    }

    public function syncStudents(AcademicYear $academicYear, array $payload = [], ?int $actorId = null): array
    {
        $semester = null;
        if (!empty($payload['semester_id'])) {
            $semester = Semester::query()
                ->where('academic_year_id', $academicYear->id)
                ->findOrFail((int) $payload['semester_id']);
        } else {
            $semesterCode = $this->normalizeSemester($payload['semester'] ?? $academicYear->active_semester ?? self::SEMESTER_GANJIL);
            $semester = $this->ensureSemester($academicYear, $semesterCode, $academicYear->is_active && $academicYear->active_semester === $semesterCode);
        }

        $activeStatusId = app(ReferenceResolver::class)->studentStatusId('Aktif');
        $students = Siswa::query()
            ->with(['kelasRef:id,name'])
            ->where(function ($query) use ($activeStatusId) {
                if ($activeStatusId) {
                    $query->where('student_status_id', $activeStatusId);
                }
                $query->orWhere('status', 'Aktif');
            })
            ->orderBy('id')
            ->get();

        $summary = [
            'total_santri' => $students->count(),
            'berhasil' => 0,
            'sudah_ada' => 0,
            'gagal' => 0,
            'errors' => [],
        ];

        DB::transaction(function () use ($students, $academicYear, $semester, $actorId, &$summary) {
            foreach ($students as $student) {
                try {
                    $payload = [
                        'tahun_ajaran' => $academicYear->name,
                        'semester' => $semester?->name,
                        'class_id' => $student->class_id,
                        'kelas' => $student->kelasRef?->name ?? $student->kelas,
                        'wali_id' => $student->wali_id,
                        'student_status_id' => $student->student_status_id,
                        'status_santri' => $student->status,
                        'is_active' => true,
                        'synced_at' => now(),
                        'updated_by_user_id' => $actorId,
                    ];

                    $existing = SiswaTahunAjaran::query()
                        ->where('siswa_id', $student->id)
                        ->where('academic_year_id', $academicYear->id)
                        ->where('semester_id', $semester?->id)
                        ->first();

                    if ($existing) {
                        $existing->update($payload);
                        $summary['sudah_ada']++;
                        continue;
                    }

                    SiswaTahunAjaran::query()->create([
                        'siswa_id' => $student->id,
                        'academic_year_id' => $academicYear->id,
                        'semester_id' => $semester?->id,
                        'created_by_user_id' => $actorId,
                        ...$payload,
                    ]);
                    $summary['berhasil']++;
                } catch (\Throwable $exception) {
                    $summary['gagal']++;
                    $summary['errors'][] = [
                        'siswa_id' => $student->id,
                        'nama' => $student->nama,
                        'message' => $exception->getMessage(),
                    ];
                }
            }
        });

        return [
            ...$summary,
            'academic_year_id' => $academicYear->id,
            'tahun_ajaran' => $academicYear->name,
            'semester_id' => $semester?->id,
            'semester' => $semester?->name,
        ];
    }

    public function stamp(array $payload): array
    {
        $period = $this->active();

        $payload['academic_year_id'] = $payload['academic_year_id'] ?? $period['academic_year_id'];
        $payload['semester_id'] = $payload['semester_id'] ?? $period['semester_id'];
        $payload['tahun_ajaran'] = $payload['tahun_ajaran'] ?? $period['tahun_ajaran'];
        $payload['semester'] = $payload['semester'] ?? $period['semester_label'];

        return $payload;
    }

    public function stampModel(Model $model): void
    {
        $period = $this->active();
        $table = $model->getTable();

        foreach ([
            'academic_year_id' => $period['academic_year_id'],
            'semester_id' => $period['semester_id'],
            'tahun_ajaran' => $period['tahun_ajaran'],
            'semester' => $period['semester_label'],
        ] as $column => $value) {
            if (Schema::hasColumn($table, $column) && empty($model->{$column})) {
                $model->{$column} = $value;
            }
        }
    }

    public function normalizeSemester(?string $value): string
    {
        $raw = strtolower(trim((string) $value));
        if (in_array($raw, ['genap', '2', 'semester genap'], true)) {
            return self::SEMESTER_GENAP;
        }
        if (in_array($raw, ['ganjil', '1', 'semester ganjil', 'gasal'], true)) {
            return self::SEMESTER_GANJIL;
        }

        throw ValidationException::withMessages([
            'semester' => 'Semester harus Ganjil atau Genap.',
        ]);
    }

    public function semesterLabel(string $semester): string
    {
        return $semester === self::SEMESTER_GENAP ? 'Genap' : 'Ganjil';
    }

    private function ensureSemester(AcademicYear $academicYear, string $code, bool $active): Semester
    {
        return Semester::query()->updateOrCreate(
            [
                'academic_year_id' => $academicYear->id,
                'code' => $code,
            ],
            [
                'name' => $this->semesterLabel($code),
                'is_active' => $active,
            ]
        );
    }

    private function createFallback(): AcademicYear
    {
        $now = Carbon::now('Asia/Jakarta');
        $yearStart = $now->month >= 7 ? $now->year : $now->year - 1;
        $yearEnd = $yearStart + 1;

        return DB::transaction(function () use ($yearStart, $yearEnd) {
            $academicYear = AcademicYear::query()->firstOrCreate(
                ['name' => "{$yearStart}/{$yearEnd}"],
                [
                    'year_start' => $yearStart,
                    'year_end' => $yearEnd,
                    'start_date' => "{$yearStart}-07-01",
                    'end_date' => "{$yearEnd}-06-30",
                    'active_semester' => self::SEMESTER_GANJIL,
                    'is_active' => true,
                ]
            );

            return $this->activate($academicYear, $academicYear->active_semester ?: self::SEMESTER_GANJIL);
        });
    }
}
