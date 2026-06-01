<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PaymentBillNotification extends Model
{
    protected $fillable = [
        'payment_bill_id',
        'recipient_user_id',
        'channel',
        'schedule_type',
        'scheduled_for',
        'sent_at',
        'status',
        'message',
        'metadata',
    ];

    protected $casts = [
        'scheduled_for' => 'date',
        'sent_at' => 'datetime',
        'metadata' => 'array',
    ];

    public function bill()
    {
        return $this->belongsTo(PaymentBill::class, 'payment_bill_id');
    }

    public function recipient()
    {
        return $this->belongsTo(User::class, 'recipient_user_id');
    }
}
