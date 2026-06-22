<?php

namespace App\Models;

use App\Services\ReferenceResolver;
use App\Services\AcademicPeriodService;
use Illuminate\Database\Eloquent\Model;

class Jadwal extends Model
{
    protected $table = 'jadwal';

    protected $fillable = [
        'mapel_id', 'teacher_id', 'guru', 'hari', 'day_id', 'jam_mulai',
        'jam_selesai', 'sifir', 'class_id', 'status',
        'academic_year_id', 'semester_id', 'tahun_ajaran', 'semester',
    ];

    public function mataPelajaran()
    {
        return $this->belongsTo(MataPelajaran::class, 'mapel_id');
    }

    public function teacher()
    {
        return $this->belongsTo(User::class, 'teacher_id');
    }

    public function day()
    {
        return $this->belongsTo(Day::class, 'day_id');
    }

    public function kelasRef()
    {
        return $this->belongsTo(SchoolClass::class, 'class_id');
    }

    protected static function booted(): void
    {
        static::saving(function (Jadwal $jadwal): void {
            $resolver = app(ReferenceResolver::class);
            $jadwal->teacher_id = $jadwal->teacher_id ?: $resolver->teacherIdByName($jadwal->guru);
            $jadwal->day_id = $jadwal->day_id ?: $resolver->dayId($jadwal->hari);
            $jadwal->class_id = $jadwal->class_id ?: $resolver->classId($jadwal->sifir, false);

            $jadwal->guru = $resolver->teacherName($jadwal->teacher_id) ?? $jadwal->guru;
            $jadwal->hari = $resolver->dayName($jadwal->day_id) ?? $jadwal->hari;
            $jadwal->sifir = $resolver->className($jadwal->class_id) ?? $jadwal->sifir;
            app(AcademicPeriodService::class)->stampModel($jadwal);
        });
    }
}
