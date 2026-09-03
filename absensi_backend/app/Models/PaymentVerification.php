<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PaymentVerification extends Model
{
    protected $table = 'payment_verifications';

    protected $fillable = [
        'kode_pengajuan',
        'siswa_id',
        'wali_id',
        'academic_year_id',
        'tahun_ajaran',
        'total_nominal',
        'bank_pengirim',
        'nama_pengirim',
        'nomor_rekening_pengirim',
        'bank_tujuan',
        'nomor_rekening_tujuan',
        'tanggal_transfer',
        'bukti_foto',
        'catatan_wali',
        'selected_bills',
        'status',
        'catatan_petugas',
        'verified_by_user_id',
        'verified_at',
        'payment_transaction_id',
    ];

    protected $casts = [
        'selected_bills' => 'array',
        'tanggal_transfer' => 'date',
        'verified_at' => 'datetime',
        'total_nominal' => 'integer',
    ];

    public function siswa(): BelongsTo
    {
        return $this->belongsTo(Siswa::class, 'siswa_id');
    }

    public function wali(): BelongsTo
    {
        return $this->belongsTo(User::class, 'wali_id');
    }

    public function academicYear(): BelongsTo
    {
        return $this->belongsTo(AcademicYear::class, 'academic_year_id');
    }

    public function verifier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'verified_by_user_id');
    }

    public function paymentTransaction(): BelongsTo
    {
        return $this->belongsTo(PaymentTransaction::class, 'payment_transaction_id');
    }

    public function scopeMenunggu($query)
    {
        return $query->where('status', 'menunggu');
    }

    public function scopeDisetujui($query)
    {
        return $query->where('status', 'disetujui');
    }

    public function scopeDitolak($query)
    {
        return $query->where('status', 'ditolak');
    }
}
