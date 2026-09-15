<?php

namespace App\Exports;

use App\Models\BoardingRoom;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Concerns\WithStyles;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class BoardingRoomExport implements FromCollection, WithHeadings, WithMapping, WithStyles
{
    private int $rowNumber = 0;

    public function collection()
    {
        return BoardingRoom::with('complex')
            ->withCount(['santriPondok as active_santri_count' => function ($q) {
                $q->where('status', 'Aktif');
            }])
            ->orderBy('boarding_complex_id')
            ->orderBy('name')
            ->get();
    }

    public function headings(): array
    {
        return [
            'NO',
            'NAMA_KAMAR',
            'KOMPLEK_ASRAMA',
            'KAPASITAS',
            'JUMLAH_SANTRI_TERISI',
            'KETERANGAN',
            'STATUS'
        ];
    }

    public function map($row): array
    {
        $this->rowNumber++;
        return [
            $this->rowNumber,
            $row->name,
            $row->complex?->name ?? 'Tanpa Komplek',
            $row->capacity ?: 'Bebas',
            $row->active_santri_count ?? 0,
            $row->description ?? '',
            $row->is_active ? 'Aktif' : 'Nonaktif'
        ];
    }

    public function styles(Worksheet $sheet)
    {
        return [
            1 => [
                'font' => ['bold' => true, 'color' => ['argb' => 'FFFFFFFF']],
                'fill' => [
                    'fillType' => \PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID,
                    'startColor' => ['argb' => 'FF138F81']
                ],
            ],
        ];
    }
}
