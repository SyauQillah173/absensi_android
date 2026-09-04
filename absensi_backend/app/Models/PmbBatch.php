<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PmbBatch extends Model
{
    use HasFactory;

    protected $table = 'pmb_batches';

    protected $fillable = [
        'nama_gelombang',
        'tahun_akademik',
        'tanggal_mulai',
        'tanggal_selesai',
        'biaya_pendaftaran',
        'kuota',
        'is_active',
        'keterangan',
    ];

    protected $casts = [
        'tanggal_mulai' => 'date:Y-m-d',
        'tanggal_selesai' => 'date:Y-m-d',
        'biaya_pendaftaran' => 'decimal:2',
        'kuota' => 'integer',
        'is_active' => 'boolean',
    ];

    public function registrations()
    {
        return $this->hasMany(PmbRegistration::class, 'pmb_batch_id');
    }
}
