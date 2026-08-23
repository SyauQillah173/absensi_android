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

class RekapTransaksiSheet implements FromCollection, ShouldAutoSize, WithTitle, WithEvents
{
    public function __construct(
        private readonly Collection $transactions,
        private readonly array $filters = [],
        private readonly ?DocumentSetting $docSetting = null,
    ) {
    }

    public function title(): string
    {
        return 'Rincian Transaksi';
    }

    public function collection(): Collection
    {
        // Data collection is assembled and populated in registerEvents for rich custom header layout
        return collect();
    }

    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function (AfterSheet $event) {
                $sheet = $event->sheet->getDelegate();

                $instansi = $this->docSetting?->institution_name ?: "MTS ASSA'ADAH II";
                $alamat = $this->docSetting?->institution_address ?: 'Sampurnan Bungah Gresik';
                $tahunText = $this->filters['tahun_ajaran'] ?: 'Semua Tahun Ajaran';
                $semText = $this->filters['semester'] ?: 'Semua Semester';
                $kelasText = $this->filters['kelas'] ?: 'Semua Kelas';

                // 1. KOP & TITLE
                $sheet->setCellValue('A1', strtoupper($instansi));
                $sheet->setCellValue('A2', 'LAPORAN REKAPITULASI PEMBAYARAN KEUANGAN SANTRI');
                $sheet->setCellValue('A3', "Tahun Ajaran: {$tahunText}  |  Semester: {$semText}  |  Kelas: {$kelasText}");
                $sheet->setCellValue('A4', 'Tanggal Ekspor: ' . now()->format('d-m-Y H:i') . ' WIB');

                $sheet->mergeCells('A1:M1');
                $sheet->mergeCells('A2:M2');
                $sheet->mergeCells('A3:M3');
                $sheet->mergeCells('A4:M4');

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
                    'D' => 'NIS',
                    'E' => 'NAMA SANTRI',
                    'F' => 'KELAS',
                    'G' => 'TAHUN AJARAN',
                    'H' => 'SEMESTER',
                    'I' => 'TIPE TAGIHAN / RINCIAN ITEM',
                    'J' => 'METODE',
                    'K' => 'STATUS',
                    'L' => 'NOMINAL BAYAR (RP)',
                    'M' => 'CATATAN / KETERANGAN',
                ];

                foreach ($headers as $col => $text) {
                    $sheet->setCellValue("{$col}{$headerRow}", $text);
                }

                $sheet->getStyle("A{$headerRow}:M{$headerRow}")->applyFromArray([
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
                            'color' => ['argb' => 'FF0A6359'],
                        ],
                    ],
                ]);
                $sheet->getRowDimension($headerRow)->setRowHeight(28);

                // 3. POPULATE DATA ROWS
                $currentRow = $headerRow + 1;
                $no = 1;

                foreach ($this->transactions as $trx) {
                    $tanggal = substr((string) ($trx['tanggal'] ?? $trx['created_at'] ?? '-'), 0, 10);
                    $kode = (string) ($trx['kode_transaksi'] ?? $trx['transaction_code'] ?? $trx['invoice_number'] ?? 'TRX-' . ($trx['id'] ?? $no));
                    $nis = (string) ($trx['nis'] ?? $trx['siswa']['nis'] ?? '-');
                    $nama = (string) ($trx['nama_siswa'] ?? $trx['siswa_nama'] ?? $trx['siswa']['nama'] ?? $trx['atas_nama'] ?? '-');
                    $kelas = (string) ($trx['kelas'] ?? $trx['siswa']['kelas'] ?? '-');
                    $tahun = (string) ($trx['tahun_ajaran'] ?? '-');
                    $semester = (string) ($trx['semester'] ?? '-');

                    // Payment Items text
                    $items = $trx['payment_items'] ?? $trx['items'] ?? [];
                    if (is_array($items) && count($items) > 0) {
                        $itemsArr = [];
                        foreach ($items as $it) {
                            $pName = (string) ($it['payment_type_name'] ?? $it['nama'] ?? $it['name'] ?? 'Tagihan');
                            $mMonth = (int) ($it['period_month'] ?? 0);
                            $monthStr = $mMonth > 0 ? " (Bulan {$mMonth})" : '';
                            $itemsArr[] = "{$pName}{$monthStr}";
                        }
                        $itemsText = implode(', ', $itemsArr);
                    } else {
                        $itemsText = (string) ($trx['jenis'] ?? $trx['keterangan'] ?? 'Pembayaran Santri');
                    }

                    $via = (string) ($trx['via'] ?? 'Tunai');
                    $status = (string) ($trx['status'] ?? 'Lunas');
                    $jumlah = (float) ($trx['jumlah_total'] ?? $trx['jumlah'] ?? $trx['amount'] ?? 0);
                    $catatan = (string) ($trx['keterangan'] ?? '-');

                    $sheet->setCellValue("A{$currentRow}", $no);
                    $sheet->setCellValue("B{$currentRow}", $tanggal);
                    $sheet->setCellValue("C{$currentRow}", $kode);
                    $sheet->setCellValue("D{$currentRow}", $nis);
                    $sheet->setCellValue("E{$currentRow}", $nama);
                    $sheet->setCellValue("F{$currentRow}", $kelas);
                    $sheet->setCellValue("G{$currentRow}", $tahun);
                    $sheet->setCellValue("H{$currentRow}", $semester);
                    $sheet->setCellValue("I{$currentRow}", $itemsText);
                    $sheet->setCellValue("J{$currentRow}", $via);
                    $sheet->setCellValue("K{$currentRow}", $status);
                    $sheet->setCellValue("L{$currentRow}", $jumlah);
                    $sheet->setCellValue("M{$currentRow}", $catatan);

                    // Zebra stripe formatting
                    $isEven = ($no % 2 === 0);
                    $bgArgb = $isEven ? 'FFF4FAF9' : 'FFFFFFFF';

                    $sheet->getStyle("A{$currentRow}:M{$currentRow}")->applyFromArray([
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
                    $sheet->getStyle("C{$currentRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
                    $sheet->getStyle("D{$currentRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
                    $sheet->getStyle("F{$currentRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
                    $sheet->getStyle("G{$currentRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
                    $sheet->getStyle("H{$currentRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
                    $sheet->getStyle("J{$currentRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
                    $sheet->getStyle("K{$currentRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
                    $sheet->getStyle("L{$currentRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);
                    $sheet->getStyle("L{$currentRow}")->getNumberFormat()->setFormatCode('"Rp "#,##0');

                    $sheet->getRowDimension($currentRow)->setRowHeight(22);
                    $currentRow++;
                    $no++;
                }

                // 4. TOTAL ROW WITH EXCEL SUM FORMULA
                $totalRow = $currentRow;
                $firstDataRow = $headerRow + 1;
                $lastDataRow = max($headerRow + 1, $currentRow - 1);

                $sheet->mergeCells("A{$totalRow}:K{$totalRow}");
                $sheet->setCellValue("A{$totalRow}", 'TOTAL KESELURUHAN DITERIMA');
                $sheet->setCellValue("L{$totalRow}", "=SUM(L{$firstDataRow}:L{$lastDataRow})");
                $sheet->setCellValue("M{$totalRow}", '="Total: " & COUNTA(C' . $firstDataRow . ':C' . $lastDataRow . ') & " Transaksi"');

                $sheet->getStyle("A{$totalRow}:M{$totalRow}")->applyFromArray([
                    'font' => [
                        'bold' => true,
                        'size' => 11,
                        'color' => ['argb' => 'FF138F81'],
                    ],
                    'fill' => [
                        'fillType' => Fill::FILL_SOLID,
                        'startColor' => ['argb' => 'FFE8F6F4'], // Soft Teal
                    ],
                    'borders' => [
                        'top' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['argb' => 'FF138F81']],
                        'bottom' => ['borderStyle' => Border::BORDER_DOUBLE, 'color' => ['argb' => 'FF138F81']],
                        'allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['argb' => 'FFC0E4DE']],
                    ],
                ]);

                $sheet->getStyle("A{$totalRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);
                $sheet->getStyle("L{$totalRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);
                $sheet->getStyle("L{$totalRow}")->getNumberFormat()->setFormatCode('"Rp "#,##0');
                $sheet->getStyle("M{$totalRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
                $sheet->getRowDimension($totalRow)->setRowHeight(26);
            },
        ];
    }
}
