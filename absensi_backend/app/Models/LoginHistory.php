<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LoginHistory extends Model
{
    protected $table = 'login_histories';

    protected $fillable = [
        'user_id',
        'token_id',
        'user_name',
        'role',
        'device_type',
        'device_name',
        'platform',
        'browser',
        'ip_address',
        'location',
        'user_agent',
        'status',
        'login_at',
        'logout_at',
        'last_active_at',
    ];

    protected function casts(): array
    {
        return [
            'login_at' => 'datetime',
            'logout_at' => 'datetime',
            'last_active_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function token(): BelongsTo
    {
        return $this->belongsTo(ApiAccessToken::class, 'token_id');
    }
}
