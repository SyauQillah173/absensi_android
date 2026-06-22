<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class IncomeRange extends Model
{
    protected $fillable = ['code', 'name', 'min_amount', 'max_amount'];
}
