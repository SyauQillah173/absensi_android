<?php

namespace App\Models;

use App\Services\ReferenceResolver;
use App\Services\AcademicPeriodService;
use Illuminate\Database\Eloquent\Model;

class PaymentTransaction extends Model
{
    protected $fillable = [
        'kode_transaksi',
        'siswa_id',
        'wali_id',
        'created_by_user_id',
        'updated_by_user_id',
        'atas_nama',
        'via',
        'payment_method_id',
        'jumlah_total',
        'total_item',
        'tanggal',
        'status',
        'payment_status_id',
        'keterangan',
        'biometric_required',
        'biometric_verified_at',
        'biometric_verification_method',
        'biometric_verification_mode',
        'academic_year_id',
        'semester_id',
        'tahun_ajaran',
        'semester',
    ];

    protected $casts = [
        'biometric_required' => 'boolean',
        'biometric_verified_at' => 'datetime',
        'tanggal' => 'date',
    ];

    public function siswa()
    {
        return $this->belongsTo(Siswa::class, 'siswa_id');
    }

    public function wali()
    {
        return $this->belongsTo(User::class, 'wali_id');
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }

    public function updater()
    {
        return $this->belongsTo(User::class, 'updated_by_user_id');
    }

    public function items()
    {
        return $this->hasMany(Pembayaran::class, 'payment_transaction_id')
            ->orderBy('sort_order')
            ->orderBy('id');
    }

    public function paymentMethod()
    {
        return $this->belongsTo(PaymentMethod::class);
    }

    public function statusRef()
    {
        return $this->belongsTo(PaymentStatus::class, 'payment_status_id');
    }

    public function bills()
    {
        return $this->hasMany(PaymentBill::class, 'payment_transaction_id');
    }

    protected static function booted(): void
    {
        static::saving(function (PaymentTransaction $transaction): void {
            $resolver = app(ReferenceResolver::class);
            $transaction->payment_method_id = $transaction->payment_method_id ?: $resolver->paymentMethodId($transaction->via);
            $transaction->payment_status_id = $transaction->payment_status_id ?: $resolver->paymentStatusId($transaction->status);
            $transaction->via = $resolver->paymentMethodName($transaction->payment_method_id) ?? $transaction->via;
            $transaction->status = $resolver->paymentStatusName($transaction->payment_status_id) ?? $transaction->status;
            app(AcademicPeriodService::class)->stampModel($transaction);
        });
    }
}
