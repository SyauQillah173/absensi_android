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

    public function siswa()
    {
        return $this->hasMany(Siswa::class, 'class_id');
    }

    public function scopeMadin($query)
    {
        return $query->where(function ($q) {
            $q->where('category', '!=', 'Formal')
              ->orWhere('name', 'ilike', 'Sifir%');
        });
    }

    public function scopeFormal($query)
    {
        return $query->where(function ($q) {
            $q->where('category', 'Formal')
              ->orWhere('name', 'not ilike', 'Sifir%');
        });
    }
}
