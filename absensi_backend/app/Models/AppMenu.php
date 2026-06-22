<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AppMenu extends Model
{
    use HasFactory;

    protected $fillable = [
        'key',
        'label',
        'group',
        'icon',
        'description',
        'sort_order',
        'is_core',
        'is_active',
    ];

    protected $casts = [
        'sort_order' => 'integer',
        'is_core' => 'boolean',
        'is_active' => 'boolean',
    ];

    public function permissions(): HasMany
    {
        return $this->hasMany(RoleMenuPermission::class);
    }
}
