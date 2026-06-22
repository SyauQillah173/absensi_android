<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BoardingComplex extends Model
{
    protected $fillable = [
        'name',
        'description',
        'sort_order',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    public function rooms()
    {
        return $this->hasMany(BoardingRoom::class, 'boarding_complex_id');
    }

    public function santriPondok()
    {
        return $this->hasMany(SantriPondok::class, 'boarding_complex_id');
    }
}
