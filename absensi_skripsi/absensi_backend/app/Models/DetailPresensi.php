<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DetailPresensi extends Model
{
    protected $table = 'detail_presensi';
    protected $primaryKey = 'id_detail_presensi';
    protected $guarded = [];

    protected function casts(): array
    {
        return ['sync_flag' => 'boolean'];
    }

    public function presensi()
    {
        return $this->belongsTo(Presensi::class, 'id_presensi');
    }

    public function santri()
    {
        return $this->belongsTo(Santri::class, 'id_santri');
    }
}
