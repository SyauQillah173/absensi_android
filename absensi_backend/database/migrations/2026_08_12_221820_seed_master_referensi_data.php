<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $now = now();
        $data = [];

        $referensi = [
            'pekerjaan' => ['Tidak Bekerja', 'PNS / TNI / POLRI', 'Karyawan Swasta', 'Wiraswasta / Pengusaha', 'Petani / Peternak', 'Nelayan', 'Buruh', 'Guru / Dosen', 'Dokter / Tenaga Medis', 'Lainnya'],
            'pendidikan' => ['Tidak Sekolah', 'SD / MI / Sederajat', 'SMP / MTs / Sederajat', 'SMA / MA / SMK / Sederajat', 'D1 / D2 / D3', 'S1 / D4', 'S2', 'S3'],
            'penghasilan' => ['Kurang dari Rp 1.000.000', 'Rp 1.000.000 - Rp 3.000.000', 'Rp 3.000.000 - Rp 5.000.000', 'Rp 5.000.000 - Rp 10.000.000', 'Lebih dari Rp 10.000.000', 'Tidak Berpenghasilan'],
            'golongan_darah' => ['A', 'B', 'AB', 'O', 'Tidak Tahu'],
            'status_keluarga' => ['Anak Kandung', 'Anak Tiri', 'Anak Angkat'],
            'agama' => ['Islam', 'Kristen', 'Katolik', 'Hindu', 'Buddha', 'Konghucu'],
        ];

        foreach ($referensi as $kategori => $nilaiArray) {
            foreach ($nilaiArray as $nilai) {
                $data[] = [
                    'kategori' => $kategori,
                    'nilai' => $nilai,
                    'is_active' => true,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }
        }

        DB::table('master_referensi')->insertOrIgnore($data);
    }

    public function down(): void
    {
        DB::table('master_referensi')->whereIn('kategori', [
            'pekerjaan', 'pendidikan', 'penghasilan', 'golongan_darah', 'status_keluarga', 'agama'
        ])->delete();
    }
};
