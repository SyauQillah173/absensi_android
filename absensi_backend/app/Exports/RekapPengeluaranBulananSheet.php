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

class RekapPengeluaranBulananSheet implements FromCollection, ShouldAutoSize, WithTitle, WithEvents
{
    public function __construct(
        private readonly Collection $pengeluaran,
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

                $sheet->setCellValue('A1', 'REKAPITULASI PENGELUARAN PER BULAN');
                $sheet->setCellValue('A2', 'Periode: ' . ($this->filters['periode_label'] ?? 'Semua Periode'));
                $sheet->mergeCells('A1:E1');
                $sheet->mergeCells('A2:E2');
                $sheet->getStyle('A1')->getFont()->setBold(true)->setSize(13)->setColor(new \PhpOffice\PhpSpreadsheet\Style\Color('FF138F81'));
                $sheet->getStyle('A2')->getFont()->setSize(10)->setItalic(true);

                $headerRow = 4;
                $headers = [
                    'A' => 'NO',
                    'B' => 'BULAN & TAHUN',
                    'C' => 'JUMLAH TRANSAKSI',
                    'D' => 'TOTAL PENGELUARAN (RP)',
                    'E' => 'RATA-RATA / TRANSAKSI (RP)',
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

                // Group by Year-Month
                $grouped = $this->pengeluaran->groupBy(function ($item) {
                    return $item->tanggal ? Carbon::parse($item->tanggal)->format('Y-m') : 'Unknown';
                })->sortKeys();

                $rowNum = 5;
                $no = 1;

                foreach ($grouped as $yearMonth => $items) {
                    $monthLabel = $yearMonth !== 'Unknown' ? Carbon::createFromFormat('Y-m', $yearMonth)->translatedFormat('F Y') : 'Tanpa Tanggal';
                    $count = $items->count();
                    $total = (float) $items->sum('jumlah');

                    $sheet->setCellValue("A{$rowNum}", $no++);
                    $sheet->setCellValue("B{$rowNum}", $monthLabel);
                    $sheet->setCellValue("C{$rowNum}", $count);
                    $sheet->setCellValue("D{$rowNum}", $total);
                    $sheet->setCellValue("E{$rowNum}", "=D{$rowNum}/C{$rowNum}");

                    $sheet->getStyle("A{$rowNum}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
                    $sheet->getStyle("B{$rowNum}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_LEFT);
                    $sheet->getStyle("C{$rowNum}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
                    $sheet->getStyle("D{$rowNum}")->getNumberFormat()->setFormatCode('"Rp "#,##0');
                    $sheet->getStyle("D{$rowNum}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);
                    $sheet->getStyle("E{$rowNum}")->getNumberFormat()->setFormatCode('"Rp "#,##0');
                    $sheet->getStyle("E{$rowNum}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);

                    if ($rowNum % 2 === 0) {
                        $sheet->getStyle("A{$rowNum}:E{$rowNum}")->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setARGB('FFF9FBFC');
                    }

                    $rowNum++;
                }

                $lastDataRow = $rowNum - 1;

                // TOTAL ROW
                $totalRow = $rowNum;
                $sheet->setCellValue("A{$totalRow}", 'TOTAL REKAP');
                $sheet->mergeCells("A{$totalRow}:B{$totalRow}");

                if ($lastDataRow >= 5) {
                    $sheet->setCellValue("C{$totalRow}", "=SUM(C5:C{$lastDataRow})");
                    $sheet->setCellValue("D{$totalRow}", "=SUM(D5:D{$lastDataRow})");
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

                if ($lastDataRow >= 5) {
                    $sheet->getStyle("A5:E{$lastDataRow}")->applyFromArray([
                        'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['argb' => 'FFE2E8F0']]],
                    ]);
                }
            },
        ];
    }
}
