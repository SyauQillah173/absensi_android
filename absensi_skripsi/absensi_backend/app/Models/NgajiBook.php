<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class NgajiBook extends Model
{
    protected $fillable = [
        'name',
        'code',
        'method',
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
