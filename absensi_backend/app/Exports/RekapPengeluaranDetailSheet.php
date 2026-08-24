<?php

namespace App\Exports;

use App\Models\DocumentSetting;
use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Concerns\WithTitle;
use Maatwebsite\Excel\Events\AfterSheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;

class RekapPengeluaranDetailSheet implements FromCollection, ShouldAutoSize, WithTitle, WithEvents
{
    public function __construct(
        private readonly Collection $pengeluaran,
        private readonly array $filters = [],
        private readonly ?DocumentSetting $docSetting = null,
    ) {
    }

    public function title(): string
    {
        return 'Rincian Pengeluaran';
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

                $instansi = $this->docSetting?->institution_name ?: "MTS ASSA'ADAH II";
                $alamat = $this->docSetting?->institution_address ?: 'Sampurnan Bungah Gresik';
                $periodeText = $this->filters['periode_label'] ?? 'Semua Periode';
                $kategoriText = $this->filters['kategori'] ?? 'Semua Kategori';

                // 1. KOP & TITLE
                $sheet->setCellValue('A1', strtoupper($instansi));
                $sheet->setCellValue('A2', 'LAPORAN REKAPITULASI PENGELUARAN / KAS KELUAR');
                $sheet->setCellValue('A3', "Periode: {$periodeText}  |  Kategori: {$kategoriText}");
                $sheet->setCellValue('A4', 'Tanggal Ekspor: ' . now()->format('d-m-Y H:i') . ' WIB');

                $sheet->mergeCells('A1:J1');
                $sheet->mergeCells('A2:J2');
                $sheet->mergeCells('A3:J3');
                $sheet->mergeCells('A4:J4');

                $sheet->getStyle('A1')->getFont()->setBold(true)->setSize(15)->setColor(new \PhpOffice\PhpSpreadsheet\Style\Color('FF138F81'));
                $sheet->getStyle('A2')->getFont()->setBold(true)->setSize(12);
                $sheet->getStyle('A3:A4')->getFont()->setSize(10)->setItalic(true);
                $sheet->getStyle('A1:A4')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

                // 2. TABLE HEADERS (Row 6)
                $headerRow = 6;
                $headers = [
                    'A' => 'NO',
                    'B' => 'TANGGAL',
                    'C' => 'NO. TRANSAKSI',
                    'D' => 'KEPERLUAN / JUDUL',
                    'E' => 'KATEGORI',
                    'F' => 'DIBAYARKAN KEPADA',
                    'G' => 'METODE / SUMBER DANA',
                    'H' => 'NOMINAL (RP)',
                    'I' => 'DIINPUT OLEH',
                    'J' => 'KETERANGAN / CATATAN',
                ];

                foreach ($headers as $col => $text) {
                    $sheet->setCellValue("{$col}{$headerRow}", $text);
                }

                $sheet->getStyle("A{$headerRow}:J{$headerRow}")->applyFromArray([
                    'font' => [
                        'bold' => true,
                        'color' => ['argb' => 'FFFFFFFF'],
                        'size' => 11,
                    ],
                    'fill' => [
                        'fillType' => Fill::FILL_SOLID,
                        'startColor' => ['argb' => 'FF138F81'], // Teal theme
                    ],
                    'alignment' => [
                        'horizontal' => Alignment::HORIZONTAL_CENTER,
                        'vertical' => Alignment::VERTICAL_CENTER,
                    ],
                    'borders' => [
                        'allBorders' => [
                            'borderStyle' => Border::BORDER_MEDIUM,
                            'color' => ['argb' => 'FF0F7A6E'],
                        ],
                    ],
                ]);

                // 3. POPULATE ROWS
                $rowNum = 7;
                $no = 1;

                foreach ($this->pengeluaran as $item) {
                    $tanggal = $item->tanggal ? \Carbon\Carbon::parse($item->tanggal)->format('d/m/Y') : '-';
                    $noTrx = $item->no_transaksi ?: ('EXP-' . sprintf('%04d', $item->id));
                    $judul = $item->judul ?? '-';
                    $kategori = $item->kategori ?? 'Umum';
                    $penerima = $item->dibayarkan_kepada ?? '-';
                    $metode = $item->metode_pembayaran ?? 'Tunai';
                    $nominal = (float) ($item->jumlah ?? 0);
                    $petugas = $item->penginput?->name ?? 'Admin';
                    $keterangan = $item->keterangan ?? '-';

                    $sheet->setCellValue("A{$rowNum}", $no++);
                    $sheet->setCellValue("B{$rowNum}", $tanggal);
                    $sheet->setCellValue("C{$rowNum}", $noTrx);
                    $sheet->setCellValue("D{$rowNum}", $judul);
                    $sheet->setCellValue("E{$rowNum}", $kategori);
                    $sheet->setCellValue("F{$rowNum}", $penerima);
                    $sheet->setCellValue("G{$rowNum}", $metode);
                    $sheet->setCellValue("H{$rowNum}", $nominal);
                    $sheet->setCellValue("I{$rowNum}", $petugas);
                    $sheet->setCellValue("J{$rowNum}", $keterangan);

                    // Row styling
                    $sheet->getStyle("A{$rowNum}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
                    $sheet->getStyle("B{$rowNum}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
                    $sheet->getStyle("C{$rowNum}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
                    $sheet->getStyle("E{$rowNum}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
                    $sheet->getStyle("G{$rowNum}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
                    $sheet->getStyle("H{$rowNum}")->getNumberFormat()->setFormatCode('"Rp "#,##0');
                    $sheet->getStyle("H{$rowNum}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);

                    if ($rowNum % 2 === 0) {
                        $sheet->getStyle("A{$rowNum}:J{$rowNum}")->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setARGB('FFF9FBFC');
                    }

                    $rowNum++;
                }

                $lastDataRow = $rowNum - 1;

                // 4. TOTAL ROW WITH REAL EXCEL FORMULA
                $totalRow = $rowNum;
                $sheet->setCellValue("A{$totalRow}", 'TOTAL PENGELUARAN');
                $sheet->mergeCells("A{$totalRow}:G{$totalRow}");

                if ($lastDataRow >= 7) {
                    $sheet->setCellValue("H{$totalRow}", "=SUM(H7:H{$lastDataRow})");
                } else {
                    $sheet->setCellValue("H{$totalRow}", 0);
                }

                $sheet->getStyle("A{$totalRow}:J{$totalRow}")->applyFromArray([
                    'font' => ['bold' => true, 'size' => 11, 'color' => ['argb' => 'FF138F81']],
                    'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FFE8F8F5']],
                    'borders' => [
                        'allBorders' => [
                            'borderStyle' => Border::BORDER_THIN,
                            'color' => ['argb' => 'FF138F81'],
                        ],
                    ],
                ]);

                $sheet->getStyle("A{$totalRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
                $sheet->getStyle("H{$totalRow}")->getNumberFormat()->setFormatCode('"Rp "#,##0');
                $sheet->getStyle("H{$totalRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);

                // Thin borders for data rows
                if ($lastDataRow >= 7) {
                    $sheet->getStyle("A7:J{$lastDataRow}")->applyFromArray([
                        'borders' => [
                            'allBorders' => [
                                'borderStyle' => Border::BORDER_THIN,
                                'color' => ['argb' => 'FFE2E8F0'],
                            ],
                        ],
                    ]);
                }

                // 5. SIGNATURE SECTION
                $signRow = $totalRow + 3;
                $sheet->setCellValue("H{$signRow}", 'Gresik, ' . now()->translatedFormat('d F Y'));
                $sheet->setCellValue("H" . ($signRow + 1), 'Bendahara Keuangan,');
                $sheet->setCellValue("H" . ($signRow + 4), '( ................................................ )');

                $sheet->getStyle("H{$signRow}:H" . ($signRow + 4))->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
            },
        ];
    }
}
