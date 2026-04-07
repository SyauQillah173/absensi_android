<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Materi extends Model
{
    protected $table = 'materi';

    protected $fillable = [
        'guru_id', 'kelas', 'mapel', 'judul', 'deskripsi',
        'file_path', 'file_type', 'tanggal',
    ];

    public function guru()
    {
        return $this->belongsTo(User::class, 'guru_id');
    }
}
