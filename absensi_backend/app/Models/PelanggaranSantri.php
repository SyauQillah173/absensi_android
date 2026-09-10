<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

class PelanggaranSantri extends Model
{
    protected $table = 'pelanggaran_santri';

    protected $fillable = [
        'siswa_id',
        'tanggal',
        'waktu',
        'kategori_id',
        'judul_pelanggaran',
        'tingkat',
        'poin',
        'denda',
        'status_denda',
        'keterangan',
        'tindakan_takzir',
        'bukti_foto',
        'petugas_keamanan_id',
        'nama_petugas',
        'status_peringatan',
        'surat_panggilan_nomor',
        'surat_panggilan_diterbitkan_at',
        'catatan_wali',
    ];

    protected $casts = [
        'tanggal' => 'date:Y-m-d',
        'poin' => 'integer',
        'denda' => 'decimal:2',
        'surat_panggilan_diterbitkan_at' => 'datetime',
    ];

    protected $appends = [
        'bukti_foto_url',
    ];

    public function siswa(): BelongsTo
    {
        return $this->belongsTo(Siswa::class, 'siswa_id');
    }

    public function kategori(): BelongsTo
    {
        return $this->belongsTo(PelanggaranKategori::class, 'kategori_id');
    }

    public function petugas(): BelongsTo
    {
        return $this->belongsTo(User::class, 'petugas_keamanan_id');
    }

    public function getBuktiFotoUrlAttribute(): ?string
    {
        if (!$this->bukti_foto) {
            return null;
        }

        if (str_starts_with($this->bukti_foto, 'http://') || str_starts_with($this->bukti_foto, 'https://')) {
            return $this->bukti_foto;
        }

        return Storage::disk('public')->url($this->bukti_foto);
    }
}
