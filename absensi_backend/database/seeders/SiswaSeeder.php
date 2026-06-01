<?php

namespace Database\Seeders;

use App\Models\KelompokBelajar;
use Illuminate\Database\Seeder;

class SiswaSeeder extends Seeder
{
    public function run(): void
    {
        foreach ($this->kelasMadin() as $kelas) {
            KelompokBelajar::updateOrCreate(
                ['nama' => $kelas['nama']],
                [
                    'kategori' => $kelas['kategori'],
                    'sifir' => $kelas['sifir'],
                ]
            );
        }
    }

    private function kelasMadin(): array
    {
        $levels = [
            ['label' => 'Sifir Awal', 'code' => 'awal'],
            ['label' => 'Sifir Tsani', 'code' => 'tsani'],
            ['label' => 'Sifir Tsalis', 'code' => 'tsalis'],
            ['label' => "Sifir Robi'", 'code' => 'robi'],
            ['label' => 'Sifir Khomis', 'code' => 'khomis'],
            ['label' => 'Sifir Sadis', 'code' => 'sadis'],
        ];

        $rows = [];
        foreach ($levels as $level) {
            foreach (['PA' => ['A', 'B', 'C', 'D', 'E'], 'PI' => ['F', 'G', 'H', 'I', 'J']] as $gender => $letters) {
                foreach ($letters as $letter) {
                    $rows[] = [
                        'nama' => "{$level['label']} {$letter} {$gender}",
                        'kategori' => "{$level['label']} {$gender}",
                        'sifir' => $level['code'],
                    ];
                }
            }
        }

        return $rows;
    }
}
