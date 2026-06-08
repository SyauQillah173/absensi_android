<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class WhatsAppConnectedClient extends Model
{
    protected $fillable = [
        'client_id',
        'name',
        'client_type',
        'domain',
        'status',
        'last_seen_at',
        'metadata',
    ];

    protected $casts = [
        'last_seen_at' => 'datetime',
        'metadata' => 'array',
    ];
}
