<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Kegiatan extends Model
{
    protected $table = 'kegiatan';

    protected $fillable = [
        'uploaded_by', 'judul', 'deskripsi', 'tanggal',
    ];

    public function uploader()
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    public function fotos()
    {
        return $this->hasMany(KegiatanFoto::class);
    }
}
