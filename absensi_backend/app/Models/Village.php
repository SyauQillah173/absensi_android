<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Village extends Model
{
    protected $fillable = ['district_id', 'external_code', 'name', 'postal_code'];
}
