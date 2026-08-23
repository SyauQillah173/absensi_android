<?php

namespace App\Models;

use App\Services\ReferenceResolver;
use Illuminate\Database\Eloquent\Model;

class PaymentType extends Model
{
    protected $table = 'payment_types';

    protected $fillable = [
        'nama',
        'deskripsi',
        'nominal_default',
        'periode',
        'payment_period_type_id',
        'metode_pembayaran',
        'status',
        'is_billed_to_all',
        'billed_months',
        'month_amounts',
    ];

    protected $casts = [
        'metode_pembayaran' => 'array',
        'billed_months' => 'array',
        'month_amounts' => 'array',
        'is_billed_to_all' => 'boolean',
    ];

    public function pembayaran()
    {
        return $this->hasMany(Pembayaran::class, 'payment_type_id');
    }

    public function paymentTransactionItems()
    {
        return $this->hasMany(Pembayaran::class, 'payment_type_id');
    }

    public function periodType()
    {
        return $this->belongsTo(PaymentPeriodType::class, 'payment_period_type_id');
    }

    public function paymentMethods()
    {
        return $this->belongsToMany(PaymentMethod::class, 'payment_type_method')->withTimestamps();
    }

    public function billRules()
    {
        return $this->hasMany(PaymentBillRule::class);
    }

    public function bills()
    {
        return $this->hasMany(PaymentBill::class);
    }

    protected static function booted(): void
    {
        static::saving(function (PaymentType $paymentType): void {
            $paymentType->payment_period_type_id = $paymentType->payment_period_type_id
                ?: app(ReferenceResolver::class)->paymentPeriodTypeId($paymentType->periode);
            $paymentType->periode = app(ReferenceResolver::class)->paymentPeriodTypeCode($paymentType->payment_period_type_id)
                ?? $paymentType->periode;
        });

        static::saved(function (PaymentType $paymentType): void {
            app(ReferenceResolver::class)->syncPaymentTypeMethods(
                $paymentType->id,
                $paymentType->metode_pembayaran
            );
        });
    }
}
