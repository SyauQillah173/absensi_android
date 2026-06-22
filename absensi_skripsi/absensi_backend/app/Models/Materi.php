<?php

namespace App\Models;

use App\Services\ReferenceResolver;
use Illuminate\Database\Eloquent\Model;

class Materi extends Model
{
    protected $table = 'materi';

    protected $fillable = [
        'guru_id', 'kelas', 'class_id', 'mapel_id', 'mapel', 'judul', 'deskripsi',
        'file_path', 'file_type', 'tanggal',
    ];

    public function guru()
    {
        return $this->belongsTo(User::class, 'guru_id');
    }

    public function mataPelajaran()
    {
        return $this->belongsTo(MataPelajaran::class, 'mapel_id');
    }

    public function kelasRef()
    {
        return $this->belongsTo(SchoolClass::class, 'class_id');
    }

    protected static function booted(): void
    {
        static::saving(function (Materi $materi): void {
            $resolver = app(ReferenceResolver::class);
            $materi->class_id = $materi->class_id ?: $resolver->classId($materi->kelas, false);
            $materi->mapel_id = $materi->mapel_id ?: $resolver->subjectId($materi->mapel);
            $materi->kelas = $resolver->className($materi->class_id) ?? $materi->kelas;
            $materi->mapel = $resolver->subjectName($materi->mapel_id) ?? $materi->mapel;
        });
    }
}
