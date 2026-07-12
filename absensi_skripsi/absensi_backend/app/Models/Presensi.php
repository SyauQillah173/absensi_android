<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Presensi extends Model
{
    protected $table = 'presensi';
    protected $primaryKey = 'id_presensi';
    protected $guarded = [];

    protected function casts(): array
    {
        return ['tanggal' => 'date:Y-m-d', 'sync_flag' => 'boolean'];
    }

    public function guru()
    {
        return $this->belongsTo(Guru::class, 'id_guru');
    }

    public function kelas()
    {
        return $this->belongsTo(Kelas::class, 'id_kelas');
    }

    public function mapelRef()
    {
        return $this->belongsTo(MataPelajaran::class, 'mapel_id');
    }

    public function detail()
    {
        return $this->hasMany(DetailPresensi::class, 'id_presensi');
    }
}
