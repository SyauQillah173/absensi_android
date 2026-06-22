<?php

namespace App\Models;

use App\Services\ReferenceResolver;
use Illuminate\Database\Eloquent\Model;

class Kegiatan extends Model
{
    protected $table = 'kegiatan';

    protected $fillable = [
        'uploaded_by', 'kelas', 'class_id', 'judul', 'deskripsi', 'tanggal',
    ];

    public function uploader()
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    public function fotos()
    {
        return $this->hasMany(KegiatanFoto::class);
    }

    public function kelasRef()
    {
        return $this->belongsTo(SchoolClass::class, 'class_id');
    }

    protected static function booted(): void
    {
        static::saving(function (Kegiatan $kegiatan): void {
            $resolver = app(ReferenceResolver::class);
            $kegiatan->class_id = $kegiatan->class_id ?: $resolver->classId($kegiatan->kelas, false);
            $kegiatan->kelas = $resolver->className($kegiatan->class_id) ?? $kegiatan->kelas;
        });
    }
}
