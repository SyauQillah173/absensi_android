<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SchoolClass extends Model
{
    protected $table = 'classes';

    protected $fillable = ['class_level_id', 'code', 'name', 'gender_group', 'category', 'is_active'];

    protected $casts = [
        'is_active' => 'boolean',
    ];
}
