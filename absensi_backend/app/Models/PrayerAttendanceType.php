<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PrayerAttendanceType extends Model
{
    protected $fillable = [
        'name',
        'code',
        'description',
        'is_active',
        'sort_order',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];
}
