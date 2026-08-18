<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Pengeluaran extends Model
{
    protected $table = 'pengeluaran';

    protected $fillable = [
        'judul',
        'jumlah',
        'tanggal',
        'kategori',
        'keterangan',
        'diinput_oleh',
    ];

    protected $casts = [
        'jumlah' => 'integer',
        'tanggal' => 'date',
    ];

    public function penginput()
    {
        return $this->belongsTo(User::class, 'diinput_oleh');
    }
}
