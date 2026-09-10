<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PelanggaranKategori extends Model
{
    protected $table = 'pelanggaran_kategori';

    protected $fillable = [
        'nama_pelanggaran',
        'tingkat',
        'poin_default',
        'denda_default',
        'tindakan_rekomendasi',
        'is_active',
    ];

    protected $casts = [
        'poin_default' => 'integer',
        'denda_default' => 'decimal:2',
        'is_active' => 'boolean',
    ];

    public function pelanggaranList(): HasMany
    {
        return $this->hasMany(PelanggaranSantri::class, 'kategori_id');
    }
}
