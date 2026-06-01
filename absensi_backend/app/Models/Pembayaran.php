<?php

namespace App\Models;

use App\Services\ReferenceResolver;
use App\Services\AcademicPeriodService;
use Illuminate\Database\Eloquent\Model;

class Pembayaran extends Model
{
    protected $table = 'pembayaran';

    protected $fillable = [
        'payment_transaction_id', 'sort_order', 'siswa_id', 'payment_type_id', 'payment_bill_id', 'wali_id',
        'atas_nama', 'jenis', 'via', 'payment_method_id', 'jumlah', 'tanggal',
        'status', 'payment_status_id',
        'academic_year_id', 'semester_id', 'tahun_ajaran', 'semester',
        'periode_mulai', 'periode_selesai', 'keterangan',
    ];

    protected $casts = [
        'sort_order' => 'integer',
    ];

    public function siswa()
    {
        return $this->belongsTo(Siswa::class);
    }

    public function wali()
    {
        return $this->belongsTo(User::class, 'wali_id');
    }

    public function paymentType()
    {
        return $this->belongsTo(PaymentType::class, 'payment_type_id');
    }

    public function paymentTransaction()
    {
        return $this->belongsTo(PaymentTransaction::class, 'payment_transaction_id');
    }

    public function paymentBill()
    {
        return $this->belongsTo(PaymentBill::class, 'payment_bill_id');
    }

    public function paymentMethod()
    {
        return $this->belongsTo(PaymentMethod::class);
    }

    public function statusRef()
    {
        return $this->belongsTo(PaymentStatus::class, 'payment_status_id');
    }

    protected static function booted(): void
    {
        static::saving(function (Pembayaran $pembayaran): void {
            $resolver = app(ReferenceResolver::class);
            $pembayaran->payment_method_id = $pembayaran->payment_method_id ?: $resolver->paymentMethodId($pembayaran->via);
            $pembayaran->payment_status_id = $pembayaran->payment_status_id ?: $resolver->paymentStatusId($pembayaran->status);
            $pembayaran->via = $resolver->paymentMethodName($pembayaran->payment_method_id) ?? $pembayaran->via;
            $pembayaran->status = $resolver->paymentStatusName($pembayaran->payment_status_id) ?? $pembayaran->status;
            app(AcademicPeriodService::class)->stampModel($pembayaran);
        });
    }
}
