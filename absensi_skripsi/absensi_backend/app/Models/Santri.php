<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Santri extends Model
{
    protected $table = 'santri';
    protected $primaryKey = 'id_santri';
    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'tgl_lahir' => 'date:Y-m-d',
            'status_aktif' => 'boolean',
            'audit_log' => 'array',
        ];
    }

    public function kelas()
    {
        return $this->belongsTo(Kelas::class, 'id_kelas');
    }
}
