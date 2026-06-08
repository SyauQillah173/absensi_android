<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WhatsAppMessageLog extends Model
{
    protected $fillable = [
        'message_id',
        'module',
        'event_type',
        'student_id',
        'wali_id',
        'phone_number',
        'message',
        'status',
        'error_message',
        'retry_count',
        'retry_limit',
        'idempotency_key',
        'sent_at',
        'delivered_at',
        'cancelled_at',
        'created_by',
        'payload',
        'metadata',
    ];

    protected $casts = [
        'retry_count' => 'integer',
        'retry_limit' => 'integer',
        'sent_at' => 'datetime',
        'delivered_at' => 'datetime',
        'cancelled_at' => 'datetime',
        'payload' => 'array',
        'metadata' => 'array',
    ];

    public function siswa(): BelongsTo
    {
        return $this->belongsTo(Siswa::class, 'student_id');
    }

    public function wali(): BelongsTo
    {
        return $this->belongsTo(User::class, 'wali_id');
    }
}
