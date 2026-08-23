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

class RekapPerTipeSheet implements FromCollection, ShouldAutoSize, WithTitle, WithEvents
{
    public function __construct(
        private readonly Collection $transactions,
        private readonly array $filters = [],
    ) {
    }

    public function title(): string
    {
        return 'Rekap Per-Tipe Pembayaran';
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

                $tahunText = $this->filters['tahun_ajaran'] ?: 'Semua Tahun Ajaran';
                $semText = $this->filters['semester'] ?: 'Semua Semester';

                // 1. TITLE
                $sheet->setCellValue('A1', 'RINGKASAN TOTAL PEMBAYARAN PER-TIPE TAGIHAN');
                $sheet->setCellValue('A2', "Tahun Ajaran: {$tahunText}  |  Semester: {$semText}");

                $sheet->mergeCells('A1:E1');
                $sheet->mergeCells('A2:E2');

                $sheet->getStyle('A1')->getFont()->setBold(true)->setSize(14)->setColor(new \PhpOffice\PhpSpreadsheet\Style\Color('FF138F81'));
                $sheet->getStyle('A2')->getFont()->setSize(10)->setItalic(true);
                $sheet->getStyle('A1:A2')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

                // 2. TABLE HEADERS (Row 4)
                $headerRow = 4;
                $headers = [
                    'A' => 'NO',
                    'B' => 'TIPE PEMBAYARAN',
                    'C' => 'KATEGORI / SIFAT',
                    'D' => 'TOTAL TRANSAKSI',
                    'E' => 'TOTAL NOMINAL MASUK (RP)',
                ];

                foreach ($headers as $col => $text) {
                    $sheet->setCellValue("{$col}{$headerRow}", $text);
                }

                $sheet->getStyle("A{$headerRow}:E{$headerRow}")->applyFromArray([
                    'font' => [
                        'bold' => true,
                        'color' => ['argb' => 'FFFFFFFF'],
                        'size' => 11,
                    ],
                    'fill' => [
                        'fillType' => Fill::FILL_SOLID,
                        'startColor' => ['argb' => 'FF138F81'],
                    ],
                    'alignment' => [
                        'horizontal' => Alignment::HORIZONTAL_CENTER,
                        'vertical' => Alignment::VERTICAL_CENTER,
                    ],
                    'borders' => [
                        'allBorders' => [
                            'borderStyle' => Border::BORDER_MEDIUM,
                            'color' => ['argb' => 'FF0A6359'],
                        ],
                    ],
                ]);
                $sheet->getRowDimension($headerRow)->setRowHeight(26);

                // 3. FLATTEN AND GROUP ITEMS BY TYPE
                $typeBuckets = [];

                foreach ($this->transactions as $trx) {
                    $items = $trx['payment_items'] ?? $trx['items'] ?? [];
                    if (is_array($items) && count($items) > 0) {
                        foreach ($items as $it) {
                            $name = (string) ($it['payment_type_name'] ?? $it['nama'] ?? $it['name'] ?? 'Tagihan Umum');
                            $periode = (string) ($it['periode'] ?? (isset($it['period_month']) ? 'Bulanan' : 'Sekali Bayar'));
                            $amt = (float) ($it['jumlah'] ?? $it['amount'] ?? 0);

                            if (!isset($typeBuckets[$name])) {
                                $typeBuckets[$name] = [
                                    'name' => $name,
                                    'kategori' => $periode,
                                    'count' => 0,
                                    'total' => 0,
                                ];
                            }
                            $typeBuckets[$name]['count']++;
                            $typeBuckets[$name]['total'] += $amt;
                        }
                    } else {
                        $name = (string) ($trx['jenis'] ?? $trx['keterangan'] ?? 'Pembayaran Santri');
                        $amt = (float) ($trx['jumlah_total'] ?? $trx['jumlah'] ?? $trx['amount'] ?? 0);

                        if (!isset($typeBuckets[$name])) {
                            $typeBuckets[$name] = [
                                'name' => $name,
                                'kategori' => 'Umum',
                                'count' => 0,
                                'total' => 0,
                            ];
                        }
                        $typeBuckets[$name]['count']++;
                        $typeBuckets[$name]['total'] += $amt;
                    }
                }

                $currentRow = $headerRow + 1;
                $no = 1;

                foreach ($typeBuckets as $type) {
                    $sheet->setCellValue("A{$currentRow}", $no);
                    $sheet->setCellValue("B{$currentRow}", $type['name']);
                    $sheet->setCellValue("C{$currentRow}", $type['kategori']);
                    $sheet->setCellValue("D{$currentRow}", $type['count']);
                    $sheet->setCellValue("E{$currentRow}", $type['total']);

                    $isEven = ($no % 2 === 0);
                    $bgArgb = $isEven ? 'FFF4FAF9' : 'FFFFFFFF';

                    $sheet->getStyle("A{$currentRow}:E{$currentRow}")->applyFromArray([
                        'fill' => [
                            'fillType' => Fill::FILL_SOLID,
                            'startColor' => ['argb' => $bgArgb],
                        ],
                        'borders' => [
                            'allBorders' => [
                                'borderStyle' => Border::BORDER_THIN,
                                'color' => ['argb' => 'FFE0E0E0'],
                            ],
                        ],
                    ]);

                    $sheet->getStyle("A{$currentRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
                    $sheet->getStyle("C{$currentRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
                    $sheet->getStyle("D{$currentRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
                    $sheet->getStyle("E{$currentRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);
                    $sheet->getStyle("E{$currentRow}")->getNumberFormat()->setFormatCode('"Rp "#,##0');

                    $sheet->getRowDimension($currentRow)->setRowHeight(22);
                    $currentRow++;
                    $no++;
                }

                // 4. TOTAL ROW WITH EXCEL SUM FORMULA
                $totalRow = $currentRow;
                $firstDataRow = $headerRow + 1;
                $lastDataRow = max($headerRow + 1, $currentRow - 1);

                $sheet->mergeCells("A{$totalRow}:C{$totalRow}");
                $sheet->setCellValue("A{$totalRow}", 'TOTAL SELURUH KATEGORI');
                $sheet->setCellValue("D{$totalRow}", "=SUM(D{$firstDataRow}:D{$lastDataRow})");
                $sheet->setCellValue("E{$totalRow}", "=SUM(E{$firstDataRow}:E{$lastDataRow})");

                $sheet->getStyle("A{$totalRow}:E{$totalRow}")->applyFromArray([
                    'font' => [
                        'bold' => true,
                        'size' => 11,
                        'color' => ['argb' => 'FF138F81'],
                    ],
                    'fill' => [
                        'fillType' => Fill::FILL_SOLID,
                        'startColor' => ['argb' => 'FFE8F6F4'],
                    ],
                    'borders' => [
                        'top' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['argb' => 'FF138F81']],
                        'bottom' => ['borderStyle' => Border::BORDER_DOUBLE, 'color' => ['argb' => 'FF138F81']],
                        'allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['argb' => 'FFC0E4DE']],
                    ],
                ]);

                $sheet->getStyle("A{$totalRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);
                $sheet->getStyle("D{$totalRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
                $sheet->getStyle("E{$totalRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);
                $sheet->getStyle("E{$totalRow}")->getNumberFormat()->setFormatCode('"Rp "#,##0');
                $sheet->getRowDimension($totalRow)->setRowHeight(26);
            },
        ];
    }
}
