<?php

namespace App\Models;

use App\Services\AcademicPeriodService;
use App\Services\ReferenceResolver;
use Illuminate\Database\Eloquent\Model;

class Hafalan extends Model
{
    protected $table = 'hafalan';

    protected $fillable = [
        'siswa_id', 'juz', 'surah', 'surah_id', 'status', 'memorization_status_id',
        'tanggal_setor', 'penguji', 'examiner_id', 'nilai_hafalan', 'keterangan',
        'periode', 'academic_year_id', 'semester_id', 'tahun_ajaran', 'semester',
        'created_by', 'updated_by', 'created_by_role', 'updated_by_role',
    ];

    protected $casts = [
        'tanggal_setor' => 'date',
    ];

    public function siswa()
    {
        return $this->belongsTo(Siswa::class);
    }

    public function surahRef()
    {
        return $this->belongsTo(Surah::class, 'surah_id');
    }

    public function statusRef()
    {
        return $this->belongsTo(MemorizationStatus::class, 'memorization_status_id');
    }

    public function examiner()
    {
        return $this->belongsTo(User::class, 'examiner_id');
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function updater()
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    protected static function booted(): void
    {
        static::saving(function (Hafalan $hafalan): void {
            $resolver = app(ReferenceResolver::class);
            $hafalan->surah_id = $hafalan->surah_id ?: $resolver->surahId($hafalan->surah);
            $hafalan->memorization_status_id = $hafalan->memorization_status_id ?: $resolver->memorizationStatusId($hafalan->status);
            $hafalan->examiner_id = $hafalan->examiner_id ?: $resolver->teacherIdByName($hafalan->penguji);
            $hafalan->semester_id = $hafalan->semester_id ?: $resolver->semesterId($hafalan->periode);
            app(AcademicPeriodService::class)->stampModel($hafalan);
            $hafalan->periode = $hafalan->periode
                ?: trim(($hafalan->semester ?? '') . ' ' . ($hafalan->tahun_ajaran ?? ''));
        });
    }
}
