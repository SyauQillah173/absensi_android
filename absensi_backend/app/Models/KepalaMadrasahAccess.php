<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class KepalaMadrasahAccess extends Model
{
    protected $table = 'kepala_madrasah_access';

    protected $fillable = [
        'user_id',
        'nama_pejabat',
        'jabatan',
        'can_monitor_madin',
        'can_monitor_sholat',
        'can_monitor_ngaji',
        'is_active',
    ];

    protected $casts = [
        'can_monitor_madin' => 'boolean',
        'can_monitor_sholat' => 'boolean',
        'can_monitor_ngaji' => 'boolean',
        'is_active' => 'boolean',
    ];

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
