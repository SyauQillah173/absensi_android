<?php

namespace App\Exports;

use Carbon\Carbon;
use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Concerns\WithTitle;
use Maatwebsite\Excel\Events\AfterSheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;

class RekapPemasukanLainBulananSheet implements FromCollection, ShouldAutoSize, WithTitle, WithEvents
{
    public function __construct(
        private readonly Collection $pemasukan,
        private readonly array $filters = [],
    ) {
    }

    public function title(): string
    {
        return 'Rekap Bulanan';
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

                $sheet->setCellValue('A1', 'REKAPITULASI PEMASUKAN KAS BULANAN');
                $sheet->mergeCells('A1:E1');
                $sheet->getStyle('A1')->getFont()->setBold(true)->setSize(12)->setColor(new \PhpOffice\PhpSpreadsheet\Style\Color('FF138F81'));
                $sheet->getStyle('A1')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

                $headerRow = 3;
                $headers = [
                    'A' => 'NO',
                    'B' => 'BULAN & TAHUN',
                    'C' => 'JUMLAH TRANSAKSI',
                    'D' => 'TOTAL NOMINAL (RP)',
                    'E' => 'RATA-RATA / TRX (RP)',
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

                $grouped = $this->pemasukan->groupBy(function ($item) {
                    return $item->tanggal ? Carbon::parse($item->tanggal)->format('Y-m') : 'Unknown';
                })->sortKeys();

                $rowNum = 4;
                $no = 1;

                foreach ($grouped as $monthKey => $items) {
                    $monthLabel = $monthKey !== 'Unknown' ? Carbon::parse($monthKey . '-01')->translatedFormat('F Y') : 'Tanpa Tanggal';
                    $catTotal = (float) $items->sum('jumlah');
                    $catCount = $items->count();

                    $sheet->setCellValue("A{$rowNum}", $no++);
                    $sheet->setCellValue("B{$rowNum}", $monthLabel);
                    $sheet->setCellValue("C{$rowNum}", $catCount);
                    $sheet->setCellValue("D{$rowNum}", $catTotal);
                    $sheet->setCellValue("E{$rowNum}", "=D{$rowNum}/C{$rowNum}");

                    $sheet->getStyle("A{$rowNum}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
                    $sheet->getStyle("C{$rowNum}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
                    $sheet->getStyle("D{$rowNum}")->getNumberFormat()->setFormatCode('"Rp "#,##0');
                    $sheet->getStyle("D{$rowNum}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);
                    $sheet->getStyle("E{$rowNum}")->getNumberFormat()->setFormatCode('"Rp "#,##0');
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
                    $sheet->setCellValue("E{$totalRow}", "=D{$totalRow}/C{$totalRow}");
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
                $sheet->getStyle("E{$totalRow}")->getNumberFormat()->setFormatCode('"Rp "#,##0');
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
