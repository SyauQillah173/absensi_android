<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Kelas extends Model
{
    protected $table = 'kelas';
    protected $primaryKey = 'id_kelas';
    protected $guarded = [];

    protected function casts(): array
    {
        return ['status_aktif' => 'boolean', 'audit_log' => 'array'];
    }

    public function guru()
    {
        return $this->belongsTo(Guru::class, 'id_guru');
    }

    public function santri()
    {
        return $this->hasMany(Santri::class, 'id_kelas');
    }
}
