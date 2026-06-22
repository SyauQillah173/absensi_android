<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AdminPaymentSecuritySetting extends Model
{
    protected $fillable = [
        'user_id',
        'face_enabled',
        'fingerprint_enabled',
        'verification_mode',
        'biometric_required',
        'pin_enabled',
        'transaction_pin_hash',
        'pin_set_at',
        'face_registered_at',
        'fingerprint_registered_at',
        'last_verified_at',
        'last_verification_method',
        'last_payment_transaction_code',
        'last_device_label',
    ];

    protected $casts = [
        'face_enabled' => 'boolean',
        'fingerprint_enabled' => 'boolean',
        'biometric_required' => 'boolean',
        'pin_enabled' => 'boolean',
        'pin_set_at' => 'datetime',
        'face_registered_at' => 'datetime',
        'fingerprint_registered_at' => 'datetime',
        'last_verified_at' => 'datetime',
    ];

    protected $hidden = [
        'transaction_pin_hash',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
