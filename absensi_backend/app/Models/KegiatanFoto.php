<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class KegiatanFoto extends Model
{
    protected $table = 'kegiatan_foto';
    public $timestamps = false;

    protected $fillable = [
        'kegiatan_id', 'file_path', 'caption',
    ];

    public function kegiatan()
    {
        return $this->belongsTo(Kegiatan::class);
    }
}
