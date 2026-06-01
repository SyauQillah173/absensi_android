<?php

namespace App\Models;

use App\Services\ReferenceResolver;
use App\Services\AcademicPeriodService;
use Illuminate\Database\Eloquent\Model;

class KelompokBelajar extends Model
{
    protected $table = 'kelompok_belajar';

    protected $fillable = [
        'class_id', 'nama', 'kategori', 'sifir',
        'academic_year_id', 'semester_id', 'tahun_ajaran', 'semester',
    ];

    public function siswa()
    {
        return $this->belongsToMany(Siswa::class, 'kelompok_belajar_siswa', 'kelompok_id', 'siswa_id');
    }

    public function kelasRef()
    {
        return $this->belongsTo(SchoolClass::class, 'class_id');
    }

    protected static function booted(): void
    {
        static::saving(function (KelompokBelajar $kelompok): void {
            $kelompok->class_id = $kelompok->class_id ?: app(ReferenceResolver::class)->classId($kelompok->nama, true);
            app(AcademicPeriodService::class)->stampModel($kelompok);
        });
    }
}
