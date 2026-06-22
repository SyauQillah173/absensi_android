<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SiswaTahunAjaran extends Model
{
    protected $table = 'siswa_tahun_ajaran';

    protected $fillable = [
        'siswa_id',
        'academic_year_id',
        'semester_id',
        'tahun_ajaran',
        'semester',
        'class_id',
        'kelas',
        'wali_id',
        'student_status_id',
        'status_santri',
        'is_active',
        'synced_at',
        'created_by_user_id',
        'updated_by_user_id',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'synced_at' => 'datetime',
    ];

    public function siswa()
    {
        return $this->belongsTo(Siswa::class, 'siswa_id');
    }

    public function academicYear()
    {
        return $this->belongsTo(AcademicYear::class, 'academic_year_id');
    }

    public function semesterRef()
    {
        return $this->belongsTo(Semester::class, 'semester_id');
    }

    public function kelasRef()
    {
        return $this->belongsTo(SchoolClass::class, 'class_id');
    }

    public function wali()
    {
        return $this->belongsTo(User::class, 'wali_id');
    }
}
