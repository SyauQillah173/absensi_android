<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class GuruAbsensiSholatAccess extends Model
{
    protected $table = 'guru_absensi_sholat_access';

    protected $fillable = [
        'user_id',
        'boarding_complex_id',
        'boarding_room_id',
        'can_input',
        'can_view_rekap',
        'can_edit',
        'is_active',
    ];

    protected $casts = [
        'can_input' => 'boolean',
        'can_view_rekap' => 'boolean',
        'can_edit' => 'boolean',
        'is_active' => 'boolean',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function complex()
    {
        return $this->belongsTo(BoardingComplex::class, 'boarding_complex_id');
    }

    public function room()
    {
        return $this->belongsTo(BoardingRoom::class, 'boarding_room_id');
    }
}
