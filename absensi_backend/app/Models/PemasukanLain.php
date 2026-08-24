<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PemasukanLain extends Model
{
    use HasFactory;

    protected $table = 'pemasukan_lain';

    protected $fillable = [
        'no_transaksi',
        'judul',
        'kategori',
        'sumber_dana',
        'jumlah',
        'tanggal',
        'diterima_dari',
        'keterangan',
        'bukti_foto',
        'user_id',
        'academic_year_id',
        'semester_id',
    ];

    protected $casts = [
        'jumlah' => 'integer',
        'user_id' => 'integer',
        'academic_year_id' => 'integer',
        'semester_id' => 'integer',
    ];

    public function penginput()
    {
        return $this->belongsTo(User::class, 'user_id');
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
