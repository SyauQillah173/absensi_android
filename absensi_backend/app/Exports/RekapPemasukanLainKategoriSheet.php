<?php

namespace App\Exports;

use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Concerns\WithTitle;
use Maatwebsite\Excel\Events\AfterSheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;

class RekapPemasukanLainKategoriSheet implements FromCollection, ShouldAutoSize, WithTitle, WithEvents
{
    public function __construct(
        private readonly Collection $pemasukan,
        private readonly array $filters = [],
    ) {
    }

    public function title(): string
    {
        return 'Rekap Kategori';
    }

    public function collection(): Collection
    {
        return collect();
    }

    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function (AfterSheet $event) {
                $sheet = $event->sheet->getDelegate();

                $sheet->setCellValue('A1', 'REKAPITULASI PEMASUKAN KAS BERDASARKAN KATEGORI');
                $sheet->mergeCells('A1:E1');
                $sheet->getStyle('A1')->getFont()->setBold(true)->setSize(12)->setColor(new \PhpOffice\PhpSpreadsheet\Style\Color('FF138F81'));
                $sheet->getStyle('A1')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

                $headerRow = 3;
                $headers = [
                    'A' => 'NO',
                    'B' => 'KATEGORI PEMASUKAN',
                    'C' => 'JUMLAH TRANSAKSI',
                    'D' => 'TOTAL NOMINAL (RP)',
                    'E' => 'PERSENTASE (%)',
                ];

                foreach ($headers as $col => $text) {
                    $sheet->setCellValue("{$col}{$headerRow}", $text);
                }

                $sheet->getStyle("A{$headerRow}:E{$headerRow}")->applyFromArray([
                    'font' => ['bold' => true, 'color' => ['argb' => 'FFFFFFFF'], 'size' => 11],
                    'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FF138F81']],
                    'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER],
                    'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_MEDIUM, 'color' => ['argb' => 'FF0F7A6E']]],
                ]);

                $grouped = $this->pemasukan->groupBy(fn ($item) => $item->kategori ?: 'Lain-lain');

                $rowNum = 4;
                $no = 1;
                $totalAll = (float) $this->pemasukan->sum('jumlah');

                foreach ($grouped as $kategori => $items) {
                    $catTotal = (float) $items->sum('jumlah');
                    $catCount = $items->count();

                    $sheet->setCellValue("A{$rowNum}", $no++);
                    $sheet->setCellValue("B{$rowNum}", $kategori);
                    $sheet->setCellValue("C{$rowNum}", $catCount);
                    $sheet->setCellValue("D{$rowNum}", $catTotal);

                    if ($totalAll > 0) {
                        $sheet->setCellValue("E{$rowNum}", "=D{$rowNum}/{$totalAll}");
                    } else {
                        $sheet->setCellValue("E{$rowNum}", 0);
                    }

                    $sheet->getStyle("A{$rowNum}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
                    $sheet->getStyle("C{$rowNum}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
                    $sheet->getStyle("D{$rowNum}")->getNumberFormat()->setFormatCode('"Rp "#,##0');
                    $sheet->getStyle("D{$rowNum}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);
                    $sheet->getStyle("E{$rowNum}")->getNumberFormat()->setFormatCode('0.0%');
                    $sheet->getStyle("E{$rowNum}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);

                    $rowNum++;
                }

                $lastDataRow = $rowNum - 1;
                $totalRow = $rowNum;

                $sheet->setCellValue("A{$totalRow}", 'TOTAL');
                $sheet->mergeCells("A{$totalRow}:B{$totalRow}");

                if ($lastDataRow >= 4) {
                    $sheet->setCellValue("C{$totalRow}", "=SUM(C4:C{$lastDataRow})");
                    $sheet->setCellValue("D{$totalRow}", "=SUM(D4:D{$lastDataRow})");
                    $sheet->setCellValue("E{$totalRow}", "=SUM(E4:E{$lastDataRow})");
                } else {
                    $sheet->setCellValue("C{$totalRow}", 0);
                    $sheet->setCellValue("D{$totalRow}", 0);
                    $sheet->setCellValue("E{$totalRow}", 0);
                }

                $sheet->getStyle("A{$totalRow}:E{$totalRow}")->applyFromArray([
                    'font' => ['bold' => true, 'size' => 11, 'color' => ['argb' => 'FF138F81']],
                    'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FFE8F8F5']],
                    'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['argb' => 'FF138F81']]],
                ]);

                $sheet->getStyle("A{$totalRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
                $sheet->getStyle("C{$totalRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
                $sheet->getStyle("D{$totalRow}")->getNumberFormat()->setFormatCode('"Rp "#,##0');
                $sheet->getStyle("D{$totalRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);
                $sheet->getStyle("E{$totalRow}")->getNumberFormat()->setFormatCode('0.0%');
                $sheet->getStyle("E{$totalRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);

                if ($lastDataRow >= 4) {
                    $sheet->getStyle("A4:E{$lastDataRow}")->applyFromArray([
                        'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['argb' => 'FFE2E8F0']]],
                    ]);
                }
            },
        ];
    }
}
