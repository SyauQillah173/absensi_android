<?php

namespace App\Models;

use App\Services\AcademicPeriodService;
use Illuminate\Database\Eloquent\Model;

class PaymentBill extends Model
{
    protected $fillable = [
        'payment_bill_rule_id',
        'payment_type_id',
        'siswa_id',
        'wali_id',
        'class_id',
        'period_key',
        'period_year',
        'period_month',
        'period_label',
        'title',
        'amount',
        'due_date',
        'status',
        'payment_transaction_id',
        'paid_at',
        'canceled_at',
        'academic_year_id',
        'semester_id',
        'tahun_ajaran',
        'semester',
        'notes',
    ];

    protected $casts = [
        'due_date' => 'date',
        'paid_at' => 'datetime',
        'canceled_at' => 'datetime',
    ];

    public function rule()
    {
        return $this->belongsTo(PaymentBillRule::class, 'payment_bill_rule_id');
    }

    public function paymentType()
    {
        return $this->belongsTo(PaymentType::class);
    }

    public function siswa()
    {
        return $this->belongsTo(Siswa::class);
    }

    public function wali()
    {
        return $this->belongsTo(User::class, 'wali_id');
    }

    public function paymentTransaction()
    {
        return $this->belongsTo(PaymentTransaction::class);
    }

    public function notifications()
    {
        return $this->hasMany(PaymentBillNotification::class);
    }

    protected static function booted(): void
    {
        static::saving(function (PaymentBill $bill): void {
            app(AcademicPeriodService::class)->stampModel($bill);
        });
    }
}
