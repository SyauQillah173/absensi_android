<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Pengeluaran extends Model
{
    protected $table = 'pengeluaran';

    protected $fillable = [
        'no_transaksi',
        'judul',
        'dibayarkan_kepada',
        'jumlah',
        'tanggal',
        'kategori',
        'metode_pembayaran',
        'keterangan',
        'bukti_foto',
        'diinput_oleh',
        'academic_year_id',
        'semester_id',
    ];

    protected $casts = [
        'jumlah' => 'integer',
        'tanggal' => 'date',
        'academic_year_id' => 'integer',
        'semester_id' => 'integer',
    ];

    public function penginput()
    {
        return $this->belongsTo(User::class, 'diinput_oleh');
    }

    public function academicYear()
    {
        return $this->belongsTo(AcademicYear::class, 'academic_year_id');
    }

    public function semester()
    {
        return $this->belongsTo(Semester::class, 'semester_id');
    }
}
