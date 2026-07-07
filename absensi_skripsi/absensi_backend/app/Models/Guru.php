<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Guru extends Model
{
    protected $table = 'guru';
    protected $primaryKey = 'id_guru';
    protected $guarded = [];

    protected function casts(): array
    {
        return ['status_aktif' => 'boolean', 'audit_log' => 'array'];
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'id_user');
    }

    public function kelas()
    {
        return $this->hasMany(Kelas::class, 'id_guru');
    }
}
