<?php

namespace App\Models;

use App\Services\ReferenceResolver;
use Illuminate\Database\Eloquent\Model;

class Nilai extends Model
{
    protected $table = 'nilai';

    protected $fillable = [
        'siswa_id', 'mapel_id', 'jenis_ujian', 'assessment_type_id', 'nilai',
        'semester', 'semester_id', 'grade', 'keterangan', 'diinput_oleh',
        'tahun_ajaran', 'academic_year_id',
        'created_by', 'updated_by', 'created_by_role', 'updated_by_role',
    ];

    public function siswa()
    {
        return $this->belongsTo(Siswa::class);
    }

    public function mataPelajaran()
    {
        return $this->belongsTo(MataPelajaran::class, 'mapel_id');
    }

    public function assessmentType()
    {
        return $this->belongsTo(AssessmentType::class);
    }

    public function semesterRef()
    {
        return $this->belongsTo(Semester::class, 'semester_id');
    }

    public function academicYear()
    {
        return $this->belongsTo(AcademicYear::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function updater()
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    /**
     * Auto-calculate letter grade from numeric value
     */
    public static function calculateGrade(float $nilai): string
    {
        if ($nilai >= 90) return 'A';
        if ($nilai >= 80) return 'B';
        if ($nilai >= 70) return 'BC';
        if ($nilai >= 60) return 'C';
        if ($nilai >= 50) return 'D';
        return 'E';
    }

    protected static function booted(): void
    {
        static::saving(function (Nilai $nilai): void {
            $resolver = app(ReferenceResolver::class);
            $nilai->assessment_type_id = $nilai->assessment_type_id ?: $resolver->assessmentTypeId($nilai->jenis_ujian);
            $nilai->academic_year_id = $nilai->academic_year_id ?: $resolver->academicYearId($nilai->tahun_ajaran);
            $nilai->semester_id = $nilai->semester_id ?: $resolver->semesterId($nilai->semester, $nilai->tahun_ajaran);
        });
    }
}
