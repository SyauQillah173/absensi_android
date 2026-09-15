<?php

namespace App\Exports;

use App\Models\PelanggaranSantri;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Concerns\WithStyles;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class PelanggaranExport implements FromCollection, WithHeadings, WithMapping, WithStyles
{
    private int $rowNumber = 0;
    protected array $filters;

    public function __construct(array $filters = [])
    {
        $this->filters = $filters;
    }

    public function collection()
    {
        $query = PelanggaranSantri::query()
            ->with([
                'siswa:id,nama,nis,kelas,komplek,kamar',
                'kategori:id,nama_pelanggaran,tingkat,poin_default'
            ]);

        if (!empty($this->filters['tingkat']) && $this->filters['tingkat'] !== 'all') {
            $query->where('tingkat', $this->filters['tingkat']);
        }
        if (!empty($this->filters['status_denda']) && $this->filters['status_denda'] !== 'all') {
            $query->where('status_denda', $this->filters['status_denda']);
        }
        if (!empty($this->filters['start_date'])) {
            $query->whereDate('tanggal', '>=', $this->filters['start_date']);
        }
        if (!empty($this->filters['end_date'])) {
            $query->whereDate('tanggal', '<=', $this->filters['end_date']);
        }
        if (!empty($this->filters['search'])) {
            $s = '%' . trim($this->filters['search']) . '%';
            $query->where(function ($q) use ($s) {
                $q->where('judul_pelanggaran', 'ilike', $s)
                  ->orWhereHas('siswa', fn($sub) => $sub->where('nama', 'ilike', $s)->orWhere('nis', 'ilike', $s));
            });
        }

        return $query->orderBy('tanggal', 'desc')->orderBy('id', 'desc')->get();
    }

    public function headings(): array
    {
        return [
            'NO',
            'TANGGAL',
            'WAKTU',
            'NIS',
            'NAMA_SANTRI',
            'KELAS',
            'KAMAR_ASRAMA',
            'KATEGORI',
            'JUDUL_PELANGGARAN',
            'TINGKAT',
            'POIN',
            'DENDA_NOMINAL',
            'STATUS_DENDA',
            'TINDAKAN_TAKZIR',
            'KETERANGAN',
            'NAMA_PETUGAS'
        ];
    }

    public function map($row): array
    {
        $this->rowNumber++;
        $siswa = $row->siswa;
        return [
            $this->rowNumber,
            $row->tanggal ? $row->tanggal->format('Y-m-d') : '',
            $row->waktu ?? '',
            $siswa?->nis ?? '',
            $siswa?->nama ?? '',
            $siswa?->kelas ?? '',
            $siswa?->kamar ? ($siswa->komplek ? "{$siswa->komplek} - {$siswa->kamar}" : $siswa->kamar) : '',
            $row->kategori?->nama_pelanggaran ?? 'Umum',
            $row->judul_pelanggaran,
            $row->tingkat,
            $row->poin,
            $row->denda ?? 0,
            $row->status_denda,
            $row->tindakan_takzir ?? '',
            $row->keterangan ?? '',
            $row->nama_petugas ?? 'Petugas Keamanan'
        ];
    }

    public function styles(Worksheet $sheet)
    {
        return [
            1 => [
                'font' => ['bold' => true, 'color' => ['argb' => 'FFFFFFFF']],
                'fill' => [
                    'fillType' => \PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID,
                    'startColor' => ['argb' => 'FFE8590C']
                ],
            ],
        ];
    }
}
