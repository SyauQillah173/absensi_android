<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RoleMenuPermission extends Model
{
    use HasFactory;

    protected $fillable = [
        'role',
        'app_menu_id',
        'can_view',
        'can_create',
        'can_update',
        'can_delete',
        'can_approve',
        'can_cancel',
        'is_enabled',
        'locked',
    ];

    protected $casts = [
        'can_view' => 'boolean',
        'can_create' => 'boolean',
        'can_update' => 'boolean',
        'can_delete' => 'boolean',
        'can_approve' => 'boolean',
        'can_cancel' => 'boolean',
        'is_enabled' => 'boolean',
        'locked' => 'boolean',
    ];

    public function menu(): BelongsTo
    {
        return $this->belongsTo(AppMenu::class, 'app_menu_id');
    }
}
