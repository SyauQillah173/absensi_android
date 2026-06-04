<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class NgajiSession extends Model
{
    protected $fillable = [
        'name',
        'code',
        'start_time',
        'end_time',
        'description',
        'is_active',
        'sort_order',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    public function schedules()
    {
        return $this->hasMany(NgajiSchedule::class);
    }
}
