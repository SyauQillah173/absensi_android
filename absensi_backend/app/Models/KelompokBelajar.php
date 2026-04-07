<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class KelompokBelajar extends Model
{
    protected $table = 'kelompok_belajar';

    protected $fillable = ['nama', 'kategori', 'sifir'];

    public function siswa()
    {
        return $this->belongsToMany(Siswa::class, 'kelompok_belajar_siswa', 'kelompok_id', 'siswa_id');
    }
}
