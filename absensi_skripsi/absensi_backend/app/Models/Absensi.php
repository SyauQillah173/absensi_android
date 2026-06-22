<?php

namespace App\Models;

use App\Services\ReferenceResolver;
use App\Services\AcademicPeriodService;
use Illuminate\Database\Eloquent\Model;

class Absensi extends Model
{
    protected $table = 'absensi';

    protected $fillable = [
        'siswa_id', 'tanggal', 'status', 'attendance_status_id', 'keterangan',
        'kelas', 'class_id', 'mapel', 'mapel_id', 'jadwal_id',
        'academic_year_id', 'semester_id', 'tahun_ajaran', 'semester',
        'attendance_key',
        'diinput_oleh', 'actor_user_id', 'diinput_via', 'device_id', 'synced_at',
    ];

    protected $casts = [
        'tanggal' => 'date',
        'synced_at' => 'datetime',
    ];

    public function siswa()
    {
        return $this->belongsTo(Siswa::class);
    }

    public function kelasRef()
    {
        return $this->belongsTo(SchoolClass::class, 'class_id');
    }

    public function mataPelajaran()
    {
        return $this->belongsTo(MataPelajaran::class, 'mapel_id');
    }

    public function statusRef()
    {
        return $this->belongsTo(AttendanceStatus::class, 'attendance_status_id');
    }

    public function actor()
    {
        return $this->belongsTo(User::class, 'actor_user_id');
    }

    public function jadwal()
    {
        return $this->belongsTo(Jadwal::class, 'jadwal_id');
    }

    protected static function booted(): void
    {
        static::saving(function (Absensi $absensi): void {
            $resolver = app(ReferenceResolver::class);
            $absensi->class_id = $absensi->class_id ?: $resolver->classId($absensi->kelas, false);
            $absensi->mapel_id = $absensi->mapel_id ?: $resolver->subjectId($absensi->mapel);
            $absensi->attendance_status_id = $absensi->attendance_status_id ?: $resolver->attendanceStatusId($absensi->status);
            $absensi->actor_user_id = $absensi->actor_user_id ?: $resolver->teacherIdByName($absensi->diinput_oleh);

            $absensi->kelas = $resolver->className($absensi->class_id) ?? $absensi->kelas;
            $absensi->mapel = $resolver->subjectName($absensi->mapel_id) ?? $absensi->mapel;
            $absensi->status = $resolver->attendanceStatusName($absensi->attendance_status_id) ?? $absensi->status;
            app(AcademicPeriodService::class)->stampModel($absensi);
            $absensi->attendance_key = self::buildAttendanceKey(
                $absensi->tanggal?->format('Y-m-d') ?? $absensi->tanggal,
                $absensi->class_id,
                $absensi->mapel_id,
                $absensi->jadwal_id,
                $absensi->siswa_id,
            );
        });
    }

    public static function buildAttendanceKey(
        mixed $tanggal,
        mixed $classId,
        mixed $mapelId,
        mixed $jadwalId,
        mixed $siswaId
    ): ?string {
        $date = trim((string) $tanggal);
        if ($date === '' || !$classId || !$mapelId || !$siswaId) {
            return null;
        }

        return implode('_', [
            $date,
            (int) $classId,
            (int) $mapelId,
            (int) $jadwalId, // Bisa 0 atau null untuk versi skripsi
            (int) $siswaId,
        ]);
    }
}
