<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Absensi extends Model
{
    protected $table = 'absensi';

    protected $fillable = [
        'siswa_id', 'tanggal', 'status', 'keterangan', 'kelas', 'mapel',
        'diinput_oleh', 'diinput_via', 'device_id', 'synced_at',
    ];

    protected $casts = [
        'tanggal' => 'date',
        'synced_at' => 'datetime',
    ];

    public function siswa()
    {
        return $this->belongsTo(Siswa::class);
    }
}
