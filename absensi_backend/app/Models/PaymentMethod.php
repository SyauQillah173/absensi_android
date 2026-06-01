<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PaymentMethod extends Model
{
    protected $fillable = [
        'code',
        'name',
        'icon',
        'description',
        'qris_image_path',
        'is_active',
        'sort_order',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'sort_order' => 'integer',
    ];

    public function paymentTypes()
    {
        return $this->belongsToMany(PaymentType::class, 'payment_type_method')->withTimestamps();
    }
}
