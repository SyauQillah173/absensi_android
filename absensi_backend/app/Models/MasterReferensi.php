<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MasterReferensi extends Model
{
    protected $table = 'master_referensi';

    protected $fillable = [
        'kategori',
        'nilai',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];
}
