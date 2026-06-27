<?php

namespace App\Services;

use App\Models\Jadwal;
use App\Models\MataPelajaran;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Database\Eloquent\Builder;

class MapelAccessService
{
    public function buildMapelQuery(?User $actor = null, array $filters = []): Builder
    {
        $status = isset($filters['status'])
            ? trim((string) $filters['status'])
            : '';
        $search = trim((string) ($filters['search'] ?? ''));
        $kelas = trim((string) ($filters['kelas'] ?? ''));
        $hari = trim((string) ($filters['hari'] ?? ''));
        $resolver = app(ReferenceResolver::class);
        $classId = !empty($filters['class_id'])
            ? (int) $filters['class_id']
            : $resolver->classId($kelas, false);
        $dayId = !empty($filters['day_id'])
            ? (int) $filters['day_id']
            : $resolver->dayId($hari);
        $requireJadwal = (bool) ($filters['require_jadwal'] ?? false);
        $withRelations = (bool) ($filters['with_relations'] ?? false);

        $scopeOperationalJadwal = $status === 'Aktif'
            || $kelas !== ''
            || $classId
            || $hari !== ''
            || $dayId;

        $query = MataPelajaran::query();
        if ($withRelations) {
            $query->with([
                'guru' => function ($builder) {
                    $builder
                        ->select('users.id', 'users.name', 'users.email', 'users.nis')
                        ->orderBy('users.name');
                },
                'jadwal' => function ($builder) use ($actor, $kelas, $hari, $classId, $dayId, $scopeOperationalJadwal) {
                    $builder->where('status', 'Aktif');

                    if ($classId || $kelas !== '') {
                        $builder->where(function ($nested) use ($classId, $kelas) {
                            if ($classId) {
                                $nested->where('class_id', $classId);
                            }
                            if ($kelas !== '') {
                                $nested->orWhere('sifir', $kelas);
                            }
                        });
                    }

                    if ($dayId || $hari !== '') {
                        $builder->where(function ($nested) use ($dayId, $hari) {
                            if ($dayId) {
                                $nested->where('day_id', $dayId);
                            }
                            if ($hari !== '') {
                                $nested->orWhere('hari', $hari);
                            }
                        });
                    }

                    $builder
                        ->orderByRaw("CASE hari
                            WHEN 'Ahad' THEN 1
                            WHEN 'Senin' THEN 2
                            WHEN 'Selasa' THEN 3
                            WHEN 'Rabu' THEN 4
                            WHEN 'Kamis' THEN 5
                            WHEN 'Jumat' THEN 6
                            WHEN 'Sabtu' THEN 7
                            ELSE 99
                        END")
                        ->orderBy('jam_mulai');
                },
            ]);
        }

        if ($status !== '') {
            $query->where('status', $status);
        }

        if ($search !== '') {
            $query->where(function (Builder $builder) use ($search) {
                $builder
                    ->where('nama', 'ilike', '%' . $search . '%')
                    ->orWhere('kode', 'ilike', '%' . $search . '%')
                    ->orWhereHas('guru', function (Builder $nested) use ($search) {
                        $nested->where('name', 'ilike', '%' . $search . '%');
                    });
            });
        }

        // Versi skripsi: Guru tidak dibatasi hanya melihat mapel miliknya.
        // Guru dapat melihat semua mapel yang aktif.

        if ($requireJadwal && ($classId || $kelas !== '' || $dayId || $hari !== '')) {
            $query->whereHas('jadwal', function (Builder $builder) use ($actor, $kelas, $hari, $classId, $dayId) {
                $builder->where('status', 'Aktif');

                if ($classId || $kelas !== '') {
                    $builder->where(function ($nested) use ($classId, $kelas) {
                        if ($classId) {
                            $nested->where('class_id', $classId);
                        }
                        if ($kelas !== '') {
                            $nested->orWhere('sifir', $kelas);
                        }
                    });
                }

                if ($dayId || $hari !== '') {
                    $builder->where(function ($nested) use ($dayId, $hari) {
                        if ($dayId) {
                            $nested->where('day_id', $dayId);
                        }
                        if ($hari !== '') {
                            $nested->orWhere('hari', $hari);
                        }
                    });
                }
            });
        }

        return $query->orderBy('nama');
    }

    public function buildGuruScheduleQuery(User $guru, string $hari): Builder
    {
        $dayId = app(ReferenceResolver::class)->dayId($hari);

        return Jadwal::query()
            ->with('mataPelajaran:id,nama,kode,status')
            ->where('status', 'Aktif')
            ->where(function (Builder $builder) use ($hari, $dayId) {
                if ($dayId) {
                    $builder->where('day_id', $dayId);
                }
                $builder->orWhere('hari', $hari);
            })
            ->whereHas('mataPelajaran', function (Builder $builder) use ($guru) {
                $builder
                    ->where('status', 'Aktif')
                    ->whereHas('guru', function (Builder $nested) use ($guru) {
                        $nested->where('users.id', $guru->id);
                    });
            })
            ->where(function (Builder $builder) use ($guru) {
                $this->applyGuruScheduleScope($builder, $guru);
            })
            ->orderBy('jam_mulai');
    }

    public function syncScheduleTeachers(MataPelajaran $mapel, array $guruIds): void
    {
        $normalizedGuruIds = array_values(array_filter(array_map(
            static fn ($id) => (int) $id,
            $guruIds
        )));

        $teachers = User::query()
            ->where('role', 'guru')
            ->whereIn('id', $normalizedGuruIds)
            ->get(['id', 'name']);

        $teacherNames = $teachers
            ->pluck('name')
            ->map(fn ($name) => trim((string) $name))
            ->filter()
            ->values();

        if ($teacherNames->isEmpty()) {
            $mapel->jadwal()->get()->each(fn (Jadwal $jadwal) => $this->archiveOrDeleteSchedule($jadwal));
            return;
        }

        $assignedTeacherIds = $teachers
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->values();
        $normalizedTeacherNames = $teacherNames
            ->map(fn ($name) => $this->normalizeTeacherName($name))
            ->values();

        $mapel->jadwal()->get()->each(function (Jadwal $jadwal) use ($assignedTeacherIds, $normalizedTeacherNames, $teacherNames) {
            $currentTeacher = $this->normalizeTeacherName($jadwal->guru);
            $currentTeacherId = (int) ($jadwal->teacher_id ?? 0);
            if (
                ($currentTeacherId > 0 && $assignedTeacherIds->contains($currentTeacherId))
                || ($currentTeacher !== '' && $normalizedTeacherNames->contains($currentTeacher))
            ) {
                return;
            }

            if ($teacherNames->count() === 1 && $currentTeacherId <= 0 && $currentTeacher === '') {
                $jadwal->update([
                    'guru' => $teacherNames->first(),
                    'teacher_id' => $assignedTeacherIds->first(),
                ]);
                return;
            }

            $this->archiveOrDeleteSchedule($jadwal);
        });

        if ($teacherNames->count() === 1) {
            $mapel->jadwal()
                ->where(function ($query) {
                    $query->whereNull('teacher_id')
                        ->orWhereNull('guru')
                        ->orWhereRaw("TRIM(COALESCE(guru, '')) = ''");
                })
                ->update([
                    'guru' => $teacherNames->first(),
                    'teacher_id' => $assignedTeacherIds->first(),
                ]);
        }
    }

    public function archiveOrDeleteSchedule(Jadwal $jadwal): void
    {
        $hasAttendance = DB::table('absensi')
            ->where('jadwal_id', $jadwal->id)
            ->exists();

        if ($hasAttendance) {
            $jadwal->update(['status' => 'Nonaktif']);
            return;
        }

        $jadwal->delete();
    }

    private function applyGuruScheduleScope($query, User $guru): void
    {
        $normalizedName = $this->normalizeTeacherName($guru->name);

        $query->where(function ($builder) use ($guru, $normalizedName) {
            $builder
                ->where('teacher_id', $guru->id)
                ->orWhereRaw('LOWER(TRIM(COALESCE(guru, \'\'))) = ?', [$normalizedName]);
        });
    }

    private function normalizeTeacherName(?string $value): string
    {
        return mb_strtolower(trim((string) $value));
    }
}
