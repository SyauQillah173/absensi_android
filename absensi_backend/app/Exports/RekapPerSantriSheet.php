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

class RekapPerSantriSheet implements FromCollection, ShouldAutoSize, WithTitle, WithEvents
{
    public function __construct(
        private readonly Collection $transactions,
        private readonly array $filters = [],
    ) {
    }

    public function title(): string
    {
        return 'Rekap Per-Santri';
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

                $tahunText = !empty($this->filters['tahun_ajaran']) ? $this->filters['tahun_ajaran'] : 'Semua Tahun Ajaran';
                $semText = !empty($this->filters['semester']) ? $this->filters['semester'] : 'Semua Semester';
                $kelasText = !empty($this->filters['kelas']) ? $this->filters['kelas'] : 'Semua Kelas';

                // 1. TITLE
                $sheet->setCellValue('A1', 'RINGKASAN TOTAL PEMBAYARAN PER-SANTRI');
                $sheet->setCellValue('A2', "Tahun Ajaran: {$tahunText}  |  Semester: {$semText}  |  Kelas: {$kelasText}");

                $sheet->mergeCells('A1:F1');
                $sheet->mergeCells('A2:F2');

                $sheet->getStyle('A1')->getFont()->setBold(true)->setSize(14)->setColor(new \PhpOffice\PhpSpreadsheet\Style\Color('FF138F81'));
                $sheet->getStyle('A2')->getFont()->setSize(10)->setItalic(true);
                $sheet->getStyle('A1:A2')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

                // 2. TABLE HEADERS (Row 4)
                $headerRow = 4;
                $headers = [
                    'A' => 'NO',
                    'B' => 'NIS',
                    'C' => 'NAMA SANTRI',
                    'D' => 'KELAS',
                    'E' => 'JUMLAH TRANSAKSI',
                    'F' => 'TOTAL DIBAYARKAN (RP)',
                ];

                foreach ($headers as $col => $text) {
                    $sheet->setCellValue("{$col}{$headerRow}", $text);
                }

                $sheet->getStyle("A{$headerRow}:F{$headerRow}")->applyFromArray([
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

                // 3. GROUP BY STUDENT
                $grouped = $this->transactions->groupBy(function ($t) {
                    return $t['siswa_id'] ?? $t['nama_siswa'] ?? 'unknown';
                });

                $currentRow = $headerRow + 1;
                $no = 1;

                foreach ($grouped as $studentTxs) {
                    $first = $studentTxs->first();
                    $nis = (string) ($first['nis'] ?? $first['siswa']['nis'] ?? '-');
                    $nama = (string) ($first['nama_siswa'] ?? $first['siswa_nama'] ?? $first['siswa']['nama'] ?? $first['atas_nama'] ?? '-');
                    $kelas = (string) ($first['kelas'] ?? $first['siswa']['kelas'] ?? '-');
                    $totalTrx = $studentTxs->count();
                    $totalNominal = (float) $studentTxs->sum(function ($tx) {
                        return (float) ($tx['jumlah_total'] ?? $tx['jumlah'] ?? $tx['amount'] ?? 0);
                    });

                    $sheet->setCellValue("A{$currentRow}", $no);
                    $sheet->setCellValue("B{$currentRow}", $nis);
                    $sheet->setCellValue("C{$currentRow}", $nama);
                    $sheet->setCellValue("D{$currentRow}", $kelas);
                    $sheet->setCellValue("E{$currentRow}", $totalTrx);
                    $sheet->setCellValue("F{$currentRow}", $totalNominal);

                    $isEven = ($no % 2 === 0);
                    $bgArgb = $isEven ? 'FFF4FAF9' : 'FFFFFFFF';

                    $sheet->getStyle("A{$currentRow}:F{$currentRow}")->applyFromArray([
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
                    $sheet->getStyle("B{$currentRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
                    $sheet->getStyle("D{$currentRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
                    $sheet->getStyle("E{$currentRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
                    $sheet->getStyle("F{$currentRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);
                    $sheet->getStyle("F{$currentRow}")->getNumberFormat()->setFormatCode('"Rp "#,##0');

                    $sheet->getRowDimension($currentRow)->setRowHeight(22);
                    $currentRow++;
                    $no++;
                }

                // 4. TOTAL ROW WITH EXCEL SUM FORMULA
                $totalRow = $currentRow;
                $firstDataRow = $headerRow + 1;
                $lastDataRow = max($headerRow + 1, $currentRow - 1);

                $sheet->mergeCells("A{$totalRow}:D{$totalRow}");
                $sheet->setCellValue("A{$totalRow}", 'TOTAL AKUMULASI SELURUH SANTRI');
                $sheet->setCellValue("E{$totalRow}", "=SUM(E{$firstDataRow}:E{$lastDataRow})");
                $sheet->setCellValue("F{$totalRow}", "=SUM(F{$firstDataRow}:F{$lastDataRow})");

                $sheet->getStyle("A{$totalRow}:F{$totalRow}")->applyFromArray([
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
                $sheet->getStyle("E{$totalRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
                $sheet->getStyle("F{$totalRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);
                $sheet->getStyle("F{$totalRow}")->getNumberFormat()->setFormatCode('"Rp "#,##0');
                $sheet->getRowDimension($totalRow)->setRowHeight(26);
            },
        ];
    }
}
