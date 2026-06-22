<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class GuardianProfile extends Model
{
    protected $fillable = ['user_id', 'name', 'phone', 'address'];
}
