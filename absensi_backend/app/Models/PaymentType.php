<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PaymentType extends Model
{
    protected $table = 'payment_types';

    protected $fillable = [
        'nama',
        'deskripsi',
        'nominal_default',
        'periode',
        'metode_pembayaran',
        'status',
    ];

    protected $casts = [
        'metode_pembayaran' => 'array',
    ];

    public function pembayaran()
    {
        return $this->hasMany(Pembayaran::class, 'payment_type_id');
    }
}
