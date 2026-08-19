<?php

namespace App\Models;

use App\Services\AcademicPeriodService;
use Illuminate\Database\Eloquent\Model;

/**
 * @property \Illuminate\Support\Carbon|null $starts_on
 * @property \Illuminate\Support\Carbon|null $ends_on
 */
class PaymentBillRule extends Model
{
    protected $fillable = [
        'payment_type_id',
        'name',
        'nominal',
        'billing_type',
        'due_day',
        'target_type',
        'class_id',
        'starts_on',
        'ends_on',
        'is_active',
        'notification_settings',
        'created_by_user_id',
        'academic_year_id',
        'semester_id',
        'tahun_ajaran',
        'semester',
        'billed_months',
    ];

    protected $casts = [
        'starts_on' => 'date',
        'ends_on' => 'date',
        'is_active' => 'boolean',
        'notification_settings' => 'array',
        'billed_months' => 'array',
    ];

    public function paymentType()
    {
        return $this->belongsTo(PaymentType::class);
    }

    public function schoolClass()
    {
        return $this->belongsTo(SchoolClass::class, 'class_id');
    }

    public function students()
    {
        return $this->belongsToMany(Siswa::class, 'payment_bill_rule_student', 'payment_bill_rule_id', 'siswa_id')
            ->withTimestamps();
    }

    public function bills()
    {
        return $this->hasMany(PaymentBill::class);
    }

    protected static function booted(): void
    {
        static::saving(function (PaymentBillRule $rule): void {
            app(AcademicPeriodService::class)->stampModel($rule);
        });
    }
}
