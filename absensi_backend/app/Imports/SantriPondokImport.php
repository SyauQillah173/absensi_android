<?php

namespace App\Imports;

use App\Models\Siswa;
use App\Models\SantriPondok;
use App\Models\BoardingComplex;
use App\Models\BoardingRoom;
use App\Models\SchoolClass;
use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\ToCollection;
use Maatwebsite\Excel\Concerns\WithHeadingRow;

class SantriPondokImport implements ToCollection, WithHeadingRow
{
    public function collection(Collection $rows)
    {
        foreach ($rows as $row) {
            $nis = $row['nis'];
            if (!$nis) continue;

            $siswa = Siswa::where('nis', $nis)->first();
            if (!$siswa) continue;

            $complex = null;
            if (!empty($row['nama_kompleks'])) {
                $complex = BoardingComplex::firstOrCreate(['name' => $row['nama_kompleks']]);
            }

            $room = null;
            if (!empty($row['nama_kamar']) && $complex) {
                $room = BoardingRoom::firstOrCreate([
                    'name' => $row['nama_kamar'],
                    'boarding_complex_id' => $complex->id
                ]);
            }

            $kelas = null;
            if (!empty($row['nama_kelas'])) {
                $kelas = SchoolClass::where('name', $row['nama_kelas'])->first();
            }

            SantriPondok::updateOrCreate(
                ['siswa_id' => $siswa->id],
                [
                    'boarding_complex_id' => $complex?->id,
                    'boarding_room_id' => $room?->id,
                    'class_id' => $kelas?->id ?? $siswa->class_id,
                    'status' => $row['status_santri'] ?? 'Aktif',
                    'is_resident' => strtolower(trim((string)$row['mukim_atau_lajo'])) === 'mukim',
                    'participates_prayer' => strtolower(trim((string)$row['wajib_sholat'])) === 'ya',
                    'notes' => $row['catatan'] ?? null,
                ]
            );
        }
    }
}
