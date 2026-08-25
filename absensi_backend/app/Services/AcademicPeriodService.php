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
                    // --- KODE BARU MULAI DARI SINI ---
                    $currentSemesterCode = $semester?->code ?? $this->normalizeSemester($payload['semester'] ?? $academicYear->active_semester ?? self::SEMESTER_GANJIL);

                    // 1. Cek apakah santri sudah masuk ke tahun ajaran baru (tanpa peduli semesternya)
                    $existing = SiswaTahunAjaran::query()
                        ->where('siswa_id', $student->id)
                        ->where('academic_year_id', $academicYear->id)
                        ->first();

                    // 2. Cek apakah santri punya riwayat di tahun-tahun sebelumnya (Bukan santri baru)
                    $hasPreviousYear = SiswaTahunAjaran::query()
                        ->where('siswa_id', $student->id)
                        ->where('academic_year_id', '!=', $academicYear->id)
                        ->exists();

                    // 3. Jika belum disinkronisasi, dan ini Semester Ganjil, dan dia bukan santri baru, MAKA NAIK KELAS!
                    if (!$existing && $currentSemesterCode === self::SEMESTER_GANJIL && $hasPreviousYear) {
                        $res = $this->promoteStudent($student, $academicYear);
                        $student = $res['student'];

                        if ($res['status'] === 'Lulus') {
                            $summary['berhasil']++;
                            continue; // Langsung skip ke santri berikutnya karena dia sudah lulus
                        }

                        // Perbarui data payload dengan kelas yang baru naik
                        $payload['class_id'] = $student->class_id;
                        $payload['kelas'] = $student->kelas;
                    }

                    // 4. Sinkronisasi Normal (Tahun dan Semester saat ini)
                    $existingSemester = SiswaTahunAjaran::query()
                        ->where('siswa_id', $student->id)
                        ->where('academic_year_id', $academicYear->id)
                        ->where('semester_id', $semester?->id)
                        ->first();

                    if ($existingSemester) {
                        $existingSemester->update($payload);
                        $summary['sudah_ada']++;
                        continue;
                    }
                    // --- KODE BARU SAMPAI SINI ---

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

    // =========================================================================
    // FITUR NAIK KELAS MADIN OTOMATIS & KELULUSAN ALUMNI
    // =========================================================================
    public function autoPromoteAllStudents(AcademicYear $targetAcademicYear, ?int $actorId = null): array
    {
        $semester = $targetAcademicYear->semesters()->where('is_active', true)->first()
            ?? $this->ensureSemester($targetAcademicYear, self::SEMESTER_GANJIL, true);

        $activeStatusId = app(ReferenceResolver::class)->studentStatusId('Aktif');
        $lulusStatusId = app(ReferenceResolver::class)->studentStatusId('Lulus');

        // Ambil seluruh santri aktif
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

        $promotedCount = 0;
        $graduatedCount = 0;
        $unassignedCount = 0;
        $details = [];

        DB::transaction(function () use (
            $students,
            $targetAcademicYear,
            $semester,
            $actorId,
            $lulusStatusId,
            &$promotedCount,
            &$graduatedCount,
            &$unassignedCount,
            &$details
        ) {
            foreach ($students as $student) {
                $oldClass = $student->kelasRef?->name ?? $student->kelas;
                
                // Jika santri belum memiliki kelas (santri baru/belum diatur)
                if (empty($oldClass)) {
                    $unassignedCount++;
                    // Tetap simpan riwayat di tahun ajaran baru
                    SiswaTahunAjaran::query()->updateOrCreate(
                        [
                            'siswa_id' => $student->id,
                            'academic_year_id' => $targetAcademicYear->id,
                            'semester_id' => $semester->id,
                        ],
                        [
                            'tahun_ajaran' => $targetAcademicYear->name,
                            'semester' => $semester->name,
                            'class_id' => null,
                            'kelas' => null,
                            'wali_id' => $student->wali_id,
                            'student_status_id' => $student->student_status_id,
                            'status_santri' => 'Aktif',
                            'is_active' => true,
                            'synced_at' => now(),
                            'created_by_user_id' => $actorId,
                        ]
                    );
                    continue;
                }

                $promotionResult = $this->promoteStudent($student, $targetAcademicYear);

                if ($promotionResult['status'] === 'Lulus') {
                    $graduatedCount++;
                    $details[] = [
                        'siswa_id' => $student->id,
                        'nama' => $student->nama,
                        'nis' => $student->nis,
                        'status' => 'Lulus (Alumni)',
                        'old_class' => $oldClass,
                        'new_class' => 'Alumni (' . ($student->tahun_lulus ?? date('Y')) . ')',
                    ];
                } else {
                    $promotedCount++;
                    $details[] = [
                        'siswa_id' => $student->id,
                        'nama' => $student->nama,
                        'nis' => $student->nis,
                        'status' => 'Naik Kelas',
                        'old_class' => $oldClass,
                        'new_class' => $student->kelas,
                    ];

                    // Catat riwayat di tahun ajaran baru
                    SiswaTahunAjaran::query()->updateOrCreate(
                        [
                            'siswa_id' => $student->id,
                            'academic_year_id' => $targetAcademicYear->id,
                            'semester_id' => $semester->id,
                        ],
                        [
                            'tahun_ajaran' => $targetAcademicYear->name,
                            'semester' => $semester->name,
                            'class_id' => $student->class_id,
                            'kelas' => $student->kelas,
                            'wali_id' => $student->wali_id,
                            'student_status_id' => $student->student_status_id,
                            'status_santri' => 'Aktif',
                            'is_active' => true,
                            'synced_at' => now(),
                            'created_by_user_id' => $actorId,
                        ]
                    );
                }
            }
        });

        return [
            'total_santri_diproses' => $students->count(),
            'berhasil_naik_kelas' => $promotedCount,
            'lulus_menjadi_alumni' => $graduatedCount,
            'santri_baru_tanpa_kelas' => $unassignedCount,
            'tahun_ajaran_target' => $targetAcademicYear->name,
            'details' => $details,
        ];
    }

    public function promoteStudent(Siswa $student, ?AcademicYear $targetAcademicYear = null): array
    {
        $currentClass = trim((string)($student->kelasRef?->name ?? $student->kelas));
        if ($currentClass === '') {
            return ['student' => $student, 'status' => 'NoClass'];
        }

        // 1. Peta Urutan Jenjang Madin Pesantren Qomaruddin
        $promotionMap = [
            'Sifir Awal' => 'Sifir Tsani',
            'Sifir Tsani' => 'Sifir Tsalis',
            'Sifir Tsalis' => "Sifir Robi'",
            'Sifir Robi\'' => 'Sifir Khomis',
            "Sifir Robi'" => 'Sifir Khomis',
            'Sifir Khomis' => 'Sifir Sadis',
            'Sifir Sadis' => 'Lulus',
        ];

        $newClass = null;
        $isLulus = false;

        // 2. Deteksi kelas santri saat ini (menjaga huruf paralel PA/PI jika ada)
        foreach ($promotionMap as $old => $new) {
            if (stripos($currentClass, $old) === 0) {
                if ($new === 'Lulus') {
                    $isLulus = true;
                } else {
                    $newClass = trim(preg_replace('/^' . preg_quote($old, '/') . '/i', $new, $currentClass));
                }
                break;
            }
        }

        // 3. Eksekusi Kenaikan / Kelulusan
        if ($isLulus) {
            $lulusStatusId = app(ReferenceResolver::class)->studentStatusId('Lulus');
            $graduationYear = $targetAcademicYear ? (string)$targetAcademicYear->year_start : date('Y');
            
            $student->status = 'Lulus';
            $student->student_status_id = $lulusStatusId;
            $student->tahun_lulus = substr($graduationYear, 0, 4);
            $student->save();

            // Lepaskan dari kelompok belajar aktif
            $student->kelompokBelajar()->detach();

            return ['student' => $student, 'status' => 'Lulus'];
        } elseif ($newClass) {
            $classId = app(ReferenceResolver::class)->classId($newClass, true);

            $student->kelas = $newClass;
            $student->class_id = $classId;
            $student->save();

            // Pindahkan juga relasi Kelompok Belajar (Pivot) jika kelompok untuk kelas baru tersedia
            $kelompok = \App\Models\KelompokBelajar::where('nama', $newClass)->first();
            if ($kelompok) {
                $student->kelompokBelajar()->sync([$kelompok->id]);
            }

            return ['student' => $student, 'status' => 'Promoted', 'new_class' => $newClass];
        }

        return ['student' => $student, 'status' => 'Unchanged'];
    }

    public function delete(AcademicYear $academicYear): void
    {
        DB::transaction(function () use ($academicYear) {
            $yearId = $academicYear->id;
            $wasActive = (bool) $academicYear->is_active;

            // 1. Hapus tagihan (payment_bills) terkait tahun ajaran ini
            \App\Models\PaymentBill::query()->where('academic_year_id', $yearId)->delete();

            // 2. Hapus aturan tagihan (payment_bill_rules) terkait tahun ajaran ini
            \App\Models\PaymentBillRule::query()->where('academic_year_id', $yearId)->delete();

            // 3. Hapus data pivot riwayat santri (siswa_tahun_ajaran)
            \App\Models\SiswaTahunAjaran::query()->where('academic_year_id', $yearId)->delete();

            // 4. Hapus pembayaran & transaksi jika terkait tahun ajaran ini
            if (Schema::hasColumn('pembayaran', 'academic_year_id')) {
                \App\Models\Pembayaran::query()->where('academic_year_id', $yearId)->delete();
            }
            if (Schema::hasColumn('payment_transactions', 'academic_year_id')) {
                \App\Models\PaymentTransaction::query()->where('academic_year_id', $yearId)->delete();
            }

            // 5. Null-kan foreign key pada tabel riwayat lain
            if (Schema::hasTable('hafalan') && Schema::hasColumn('hafalan', 'academic_year_id')) {
                DB::table('hafalan')->where('academic_year_id', $yearId)->update(['academic_year_id' => null]);
            }
            if (Schema::hasTable('penilaian') && Schema::hasColumn('penilaian', 'academic_year_id')) {
                DB::table('penilaian')->where('academic_year_id', $yearId)->update(['academic_year_id' => null]);
            }
            if (Schema::hasTable('absensi') && Schema::hasColumn('absensi', 'academic_year_id')) {
                DB::table('absensi')->where('academic_year_id', $yearId)->update(['academic_year_id' => null]);
            }

            // 6. Hapus semester yang berelasi
            \App\Models\Semester::query()->where('academic_year_id', $yearId)->delete();

            // 7. Hapus record tahun ajaran
            $academicYear->delete();

            // 8. Jika yang dihapus adalah tahun aktif, aktifkan tahun ajaran terbaru yang tersisa
            if ($wasActive) {
                $nextYear = AcademicYear::query()->orderByDesc('year_start')->orderByDesc('id')->first();
                if ($nextYear) {
                    $this->activate($nextYear);
                }
            }
        });
    }
}
