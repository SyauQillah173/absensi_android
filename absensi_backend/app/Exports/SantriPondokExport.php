<?php

namespace App\Exports;

use App\Models\SantriPondok;
use Maatwebsite\Excel\Concerns\FromQuery;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;

class SantriPondokExport implements FromQuery, WithHeadings, WithMapping
{
    public function query()
    {
        return SantriPondok::query()->with(['siswa', 'complex', 'room', 'kelasRef']);
    }

    public function headings(): array
    {
        return [
            'NIS',
            'NAMA_SANTRI',
            'JENIS_KELAMIN',
            'NAMA_KOMPLEKS',
            'NAMA_KAMAR',
            'NAMA_KELAS',
            'STATUS_SANTRI',
            'MUKIM_ATAU_LAJO',
            'WAJIB_SHOLAT',
            'CATATAN'
        ];
    }

    public function map($row): array
    {
        return [
            $row->siswa?->nis,
            $row->siswa?->nama,
            $row->siswa?->jenis_kelamin,
            $row->complex?->name ?? '',
            $row->room?->name ?? '',
            $row->kelasRef?->name ?? '',
            $row->status,
            $row->is_resident ? 'Mukim' : 'Lajo',
            $row->participates_prayer ? 'Ya' : 'Tidak',
            $row->notes ?? ''
        ];
    }
}
