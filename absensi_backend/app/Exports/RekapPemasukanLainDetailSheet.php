<?php

namespace App\Exports;

use App\Models\DocumentSetting;
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

class RekapPemasukanLainDetailSheet implements FromCollection, ShouldAutoSize, WithTitle, WithEvents
{
    public function __construct(
        private readonly Collection $pemasukan,
        private readonly array $filters = [],
        private readonly ?DocumentSetting $docSetting = null,
    ) {
    }

    public function title(): string
    {
        return 'Rincian Kas Masuk';
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
                $alamat = $this->docSetting?->institution_address ?: "JL. MASJID KIYAI GEDE BUNGAH GRESIK";
                $periodeText = $this->filters['periode_label'] ?? 'Semua Periode';

                // 1. KOP SURAT / HEADER
                $sheet->setCellValue('A1', strtoupper($instansi));
                $sheet->setCellValue('A2', 'LAPORAN RINCIAN PEMASUKAN KAS & SUMBER DANA LAIN');
                $sheet->setCellValue('A3', strtoupper($alamat));
                $sheet->setCellValue('A4', "Periode: {$periodeText} | Dicetak: " . now()->format('d-m-Y H:i') . ' WIB');

                $sheet->mergeCells('A1:I1');
                $sheet->mergeCells('A2:I2');
                $sheet->mergeCells('A3:I3');
                $sheet->mergeCells('A4:I4');

                $sheet->getStyle('A1')->getFont()->setBold(true)->setSize(14)->setColor(new \PhpOffice\PhpSpreadsheet\Style\Color('FF138F81'));
                $sheet->getStyle('A2')->getFont()->setBold(true)->setSize(12);
                $sheet->getStyle('A3')->getFont()->setSize(10)->setColor(new \PhpOffice\PhpSpreadsheet\Style\Color('FF64748B'));
                $sheet->getStyle('A4')->getFont()->setSize(9)->setItalic(true);
                $sheet->getStyle('A1:A4')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

                // 2. TABLE HEADERS (Row 6)
                $headerRow = 6;
                $headers = [
                    'A' => 'NO',
                    'B' => 'TANGGAL',
                    'C' => 'NO. BUKTI / TRX',
                    'D' => 'JUDUL / URAIAN KAS MASUK',
                    'E' => 'KATEGORI',
                    'F' => 'SUMBER DANA / METODE',
                    'G' => 'DITERIMA DARI / DONATUR',
                    'H' => 'NOMINAL (RP)',
                    'I' => 'PETUGAS INPUT',
                ];

                foreach ($headers as $col => $text) {
                    $sheet->setCellValue("{$col}{$headerRow}", $text);
                }

                $sheet->getStyle("A{$headerRow}:I{$headerRow}")->applyFromArray([
                    'font' => ['bold' => true, 'color' => ['argb' => 'FFFFFFFF'], 'size' => 11],
                    'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FF138F81']],
                    'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER],
                    'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_MEDIUM, 'color' => ['argb' => 'FF0F7A6E']]],
                ]);

                // 3. TABLE DATA (Row 7+)
                $rowNum = 7;
                $no = 1;

                foreach ($this->pemasukan as $row) {
                    $tglFormatted = $row->tanggal ? Carbon::parse($row->tanggal)->format('d/m/Y') : '-';
                    $noTrx = $row->no_transaksi ?: ('IN-' . sprintf('%04d', $row->id));
                    $petugas = $row->penginput?->name ?? 'Admin';

                    $sheet->setCellValue("A{$rowNum}", $no++);
                    $sheet->setCellValue("B{$rowNum}", $tglFormatted);
                    $sheet->setCellValue("C{$rowNum}", $noTrx);
                    $sheet->setCellValue("D{$rowNum}", $row->judul ?? '-');
                    $sheet->setCellValue("E{$rowNum}", $row->kategori ?? 'Umum');
                    $sheet->setCellValue("F{$rowNum}", $row->sumber_dana ?? 'Kas Tunai Bendahara');
                    $sheet->setCellValue("G{$rowNum}", $row->diterima_dari ?? '-');
                    $sheet->setCellValue("H{$rowNum}", (float) ($row->jumlah ?? 0));
                    $sheet->setCellValue("I{$rowNum}", $petugas);

                    $sheet->getStyle("A{$rowNum}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
                    $sheet->getStyle("B{$rowNum}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
                    $sheet->getStyle("C{$rowNum}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
                    $sheet->getStyle("E{$rowNum}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
                    $sheet->getStyle("F{$rowNum}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
                    $sheet->getStyle("H{$rowNum}")->getNumberFormat()->setFormatCode('"Rp "#,##0');
                    $sheet->getStyle("H{$rowNum}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);
                    $sheet->getStyle("H{$rowNum}")->getFont()->setBold(true)->setColor(new \PhpOffice\PhpSpreadsheet\Style\Color('FF16A34A'));

                    if ($rowNum % 2 === 0) {
                        $sheet->getStyle("A{$rowNum}:I{$rowNum}")->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setARGB('FFF9FBFC');
                    }

                    $rowNum++;
                }

                $lastDataRow = $rowNum - 1;

                // 4. TOTAL FOOTER ROW WITH FORMULA
                $totalRow = $rowNum;
                $sheet->setCellValue("A{$totalRow}", 'TOTAL SELURUH PEMASUKAN KAS');
                $sheet->mergeCells("A{$totalRow}:G{$totalRow}");

                if ($lastDataRow >= 7) {
                    $sheet->setCellValue("H{$totalRow}", "=SUM(H7:H{$lastDataRow})");
                } else {
                    $sheet->setCellValue("H{$totalRow}", 0);
                }

                $sheet->setCellValue("I{$totalRow}", '');

                $sheet->getStyle("A{$totalRow}:I{$totalRow}")->applyFromArray([
                    'font' => ['bold' => true, 'size' => 11, 'color' => ['argb' => 'FF138F81']],
                    'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FFE8F8F5']],
                    'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['argb' => 'FF138F81']]],
                ]);

                $sheet->getStyle("A{$totalRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
                $sheet->getStyle("H{$totalRow}")->getNumberFormat()->setFormatCode('"Rp "#,##0');
                $sheet->getStyle("H{$totalRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);

                if ($lastDataRow >= 7) {
                    $sheet->getStyle("A7:I{$lastDataRow}")->applyFromArray([
                        'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['argb' => 'FFE2E8F0']]],
                    ]);
                }
            },
        ];
    }
}
