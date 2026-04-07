<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Hafalan extends Model
{
    protected $table = 'hafalan';

    protected $fillable = [
        'siswa_id', 'juz', 'surah', 'status',
        'tanggal_setor', 'penguji', 'nilai_hafalan', 'keterangan',
    ];

    protected $casts = [
        'tanggal_setor' => 'date',
    ];

    public function siswa()
    {
        return $this->belongsTo(Siswa::class);
    }
}
