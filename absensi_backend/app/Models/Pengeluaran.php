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
        'pos_pengeluaran',
        'status_pengajuan',
        'metode_pembayaran',
        'keterangan',
        'bukti_foto',
        'diinput_oleh',
        'nama_petugas',
        'academic_year_id',
        'semester_id',
    ];

    protected $appends = [
        'pos_pengeluaran_label',
        'bukti_foto_url',
    ];

    public function getPosPengeluaranLabelAttribute(): string
    {
        return strtolower($this->pos_pengeluaran ?? 'pondok') === 'madin' 
            ? 'Madrasah Diniyah' 
            : 'Pondok Pesantren';
    }

    public function getBuktiFotoUrlAttribute(): ?string
    {
        if (empty($this->bukti_foto)) {
            return null;
        }
        if (str_starts_with($this->bukti_foto, 'http://') || str_starts_with($this->bukti_foto, 'https://')) {
            return $this->bukti_foto;
        }
        return asset('storage/' . $this->bukti_foto);
    }

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
