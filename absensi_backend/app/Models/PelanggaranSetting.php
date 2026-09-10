<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PelanggaranSetting extends Model
{
    protected $table = 'pelanggaran_settings';

    protected $fillable = [
        'warning_threshold_points',
        'enable_denda',
        'surat_template_title',
        'surat_template_body',
    ];

    protected $casts = [
        'warning_threshold_points' => 'integer',
        'enable_denda' => 'boolean',
    ];

    public static function getActiveSetting(): self
    {
        return static::query()->firstOrCreate(
            ['id' => 1],
            [
                'warning_threshold_points' => 100,
                'enable_denda' => true,
                'surat_template_title' => 'SURAT PANGGILAN WALI SANTRI',
                'surat_template_body' => 'Sehubungan dengan akumulasi poin pelanggaran kedisiplinan santri yang telah mencapai ambang batas peringatan, kami mengharap kehadiran Bapak/Ibu Wali Santri ke Kantor Pengurus Keamanan Pondok Pesantren Qomaruddin untuk berkoordinasi dan berdiskusi terkait pembinaan santri.',
            ]
        );
    }
}
