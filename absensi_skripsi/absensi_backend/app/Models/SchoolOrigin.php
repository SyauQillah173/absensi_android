<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SchoolOrigin extends Model
{
    protected $table = 'school_origins';

    protected $fillable = [
        'code',
        'name',
        'province_id',
        'city_id',
        'district_id',
        'npsn',
        'jenjang',
        'alamat',
        'status_sekolah',
        'source',
        'external_id',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    public function province()
    {
        return $this->belongsTo(Province::class);
    }

    public function city()
    {
        return $this->belongsTo(City::class);
    }

    public function district()
    {
        return $this->belongsTo(District::class);
    }
}
