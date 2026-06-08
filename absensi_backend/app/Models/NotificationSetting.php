<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class NotificationSetting extends Model
{
    protected $fillable = [
        'module',
        'channel_app',
        'channel_whatsapp',
        'send_mode',
        'template_id',
        'is_active',
        'retry_limit',
        'delay_seconds',
        'active_start_time',
        'active_end_time',
    ];

    protected $casts = [
        'channel_app' => 'boolean',
        'channel_whatsapp' => 'boolean',
        'is_active' => 'boolean',
        'retry_limit' => 'integer',
        'delay_seconds' => 'integer',
    ];

    public function template(): BelongsTo
    {
        return $this->belongsTo(WhatsAppTemplate::class, 'template_id');
    }
}
