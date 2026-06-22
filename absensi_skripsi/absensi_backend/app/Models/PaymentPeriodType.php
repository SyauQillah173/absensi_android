<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PaymentPeriodType extends Model
{
    protected $fillable = [
        'code',
        'name',
        'description',
        'is_monthly',
        'is_daily',
        'is_general',
        'uses_month',
        'uses_semester',
        'month_mode',
        'needs_due_day',
        'due_day',
        'is_active',
        'sort_order',
    ];

    protected $casts = [
        'is_monthly' => 'boolean',
        'is_daily' => 'boolean',
        'is_general' => 'boolean',
        'uses_month' => 'boolean',
        'uses_semester' => 'boolean',
        'needs_due_day' => 'boolean',
        'is_active' => 'boolean',
        'due_day' => 'integer',
        'sort_order' => 'integer',
    ];

    public function paymentTypes()
    {
        return $this->hasMany(PaymentType::class, 'payment_period_type_id');
    }
}
