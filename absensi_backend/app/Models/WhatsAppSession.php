<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class WhatsAppSession extends Model
{
    protected $table = 'whatsapp_sessions';

    protected $fillable = [
        'client_id',
        'client_name',
        'phone_number',
        'device_name',
        'status',
        'qr_code',
        'last_connected_at',
        'last_disconnected_at',
        'metadata',
    ];

    protected $casts = [
        'last_connected_at' => 'datetime',
        'last_disconnected_at' => 'datetime',
        'metadata' => 'array',
    ];
}
