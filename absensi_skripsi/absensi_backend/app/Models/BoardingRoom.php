<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BoardingRoom extends Model
{
    protected $fillable = [
        'boarding_complex_id',
        'name',
        'capacity',
        'description',
        'sort_order',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    public function complex()
    {
        return $this->belongsTo(BoardingComplex::class, 'boarding_complex_id');
    }

    public function siswa()
    {
        return $this->hasMany(Siswa::class, 'boarding_room_id');
    }

    public function santriPondok()
    {
        return $this->hasMany(SantriPondok::class, 'boarding_room_id');
    }
}
