<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Siswa extends Model
{
    protected $table = 'siswa';

    protected $fillable = [
        'nis', 'nisn', 'nama', 'nama_panggilan', 'tempat_lahir', 'tanggal_lahir',
        'jenis_kelamin', 'nik', 'no_kk', 'no_akta', 'dokumen_akta',
        'nama_wali', 'no_telepon_wali', 'kelas', 'status', 'wali_id',
        'alamat', 'kewarganegaraan', 'provinsi', 'kota', 'kecamatan', 'kelurahan',
        'kode_pos', 'no_whatsapp', 'email_siswa',
        'asal_sekolah', 'tahun_lulus', 'tahun_akademik_masuk', 'jenis_santri',
        'anak_ke', 'jml_saudara',
        'nama_ayah', 'nik_ayah', 'tempat_lahir_ayah', 'tanggal_lahir_ayah',
        'nama_ibu', 'nik_ibu', 'tempat_lahir_ibu', 'tanggal_lahir_ibu',
        'pendidikan_ayah', 'pendidikan_ibu',
        'pekerjaan_ayah', 'penghasilan_ayah', 'pekerjaan_ibu', 'penghasilan_ibu',
        'alamat_ayah', 'alamat_ibu',
        'no_ayah', 'no_whatsapp_ayah', 'no_ibu', 'no_whatsapp_ibu',
        'nama_wali_keluarga', 'pekerjaan_wali_keluarga', 'alamat_wali_keluarga',
        'wali_sama_dengan', 'tanggal_masuk',
        'tempat_tinggal', 'transportasi', 'tinggi_badan', 'berat_badan',
        'golongan_darah', 'foto_santri', 'catatan_santri',
    ];

    public function wali()
    {
        return $this->belongsTo(User::class, 'wali_id');
    }

    public function absensi()
    {
        return $this->hasMany(Absensi::class);
    }

    public function pembayaran()
    {
        return $this->hasMany(Pembayaran::class);
    }

    public function nilai()
    {
        return $this->hasMany(Nilai::class);
    }

    public function kelompokBelajar()
    {
        return $this->belongsToMany(KelompokBelajar::class, 'kelompok_belajar_siswa', 'siswa_id', 'kelompok_id');
    }
}
