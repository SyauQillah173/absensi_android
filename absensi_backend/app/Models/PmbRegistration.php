<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PmbRegistration extends Model
{
    use HasFactory;

    protected $table = 'pmb_registrations';

    protected $fillable = [
        'registration_number',
        'pmb_batch_id',
        'nama_lengkap',
        'nama_panggilan',
        'jenis_kelamin',
        'nik',
        'nisn',
        'tempat_lahir',
        'tanggal_lahir',
        'alamat_lengkap',
        'provinsi',
        'kota',
        'kecamatan',
        'asal_sekolah',
        'pilihan_jenjang',
        'pilihan_asrama',
        'nama_ayah',
        'pekerjaan_ayah',
        'nama_ibu',
        'pekerjaan_ibu',
        'nama_wali',
        'no_whatsapp_wali',
        'dokumen_foto',
        'dokumen_kk',
        'dokumen_ijazah',
        'catatan_khusus',
        'status',
        'catatan_admin',
        'verified_at',
        'verified_by',
        'is_converted',
        'converted_siswa_id',
    ];

    protected $casts = [
        'tanggal_lahir' => 'date:Y-m-d',
        'verified_at' => 'datetime',
        'is_converted' => 'boolean',
    ];

    public function batch()
    {
        return $this->belongsTo(PmbBatch::class, 'pmb_batch_id');
    }

    public function verifier()
    {
        return $this->belongsTo(User::class, 'verified_by');
    }

    public function siswa()
    {
        return $this->belongsTo(Siswa::class, 'converted_siswa_id');
    }
}
