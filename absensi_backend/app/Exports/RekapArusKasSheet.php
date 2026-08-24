<?php

namespace App\Exports;

use App\Models\DocumentSetting;
use App\Models\Pembayaran;
use App\Models\PemasukanLain;
use App\Models\Pengeluaran;
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

class RekapArusKasSheet implements FromCollection, ShouldAutoSize, WithTitle, WithEvents
{
    public function __construct(
        private readonly Collection $pengeluaran,
        private readonly array $filters = [],
        private readonly ?DocumentSetting $docSetting = null,
    ) {
    }

    public function title(): string
    {
        return 'Buku Kas & Arus Kas';
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
                $periodeText = $this->filters['periode_label'] ?? 'Semua Periode';

                // Fetch Pembayaran
                $pembayaranQuery = Pembayaran::query()->whereNotIn('status', ['Dibatalkan', 'Batal']);
                if (!empty($this->filters['start_date'])) {
                    $pembayaranQuery->whereDate('tanggal', '>=', $this->filters['start_date']);
                }
                if (!empty($this->filters['end_date'])) {
                    $pembayaranQuery->whereDate('tanggal', '<=', $this->filters['end_date']);
                }
                $pembayaranList = $pembayaranQuery->with('siswa:id,nama,nis')->get();

                // Fetch PemasukanLain
                $pemasukanLainQuery = PemasukanLain::query();
                if (!empty($this->filters['start_date'])) {
                    $pemasukanLainQuery->whereDate('tanggal', '>=', $this->filters['start_date']);
                }
                if (!empty($this->filters['end_date'])) {
                    $pemasukanLainQuery->whereDate('tanggal', '<=', $this->filters['end_date']);
                }
                $pemasukanLainList = $pemasukanLainQuery->get();

                // Merge into unified cashflow ledger sorted by date
                $ledger = collect();

                foreach ($pembayaranList as $p) {
                    $ledger->push([
                        'tanggal' => $p->tanggal ? Carbon::parse($p->tanggal)->toDateString() : '',
                        'no_trx' => $p->kode_transaksi ?: ('PAY-' . sprintf('%04d', $p->id)),
                        'uraian' => 'Pemasukan Siswa: ' . ($p->siswa?->nama ?? 'Santri') . ' (' . ($p->jenis ?? 'Pembayaran') . ')',
                        'kategori' => 'Pemasukan Santri',
                        'masuk' => (float) ($p->jumlah ?? 0),
                        'keluar' => 0,
                    ]);
                }

                foreach ($pemasukanLainList as $in) {
                    $ledger->push([
                        'tanggal' => $in->tanggal ? Carbon::parse($in->tanggal)->toDateString() : '',
                        'no_trx' => $in->no_transaksi ?: ('IN-' . sprintf('%04d', $in->id)),
                        'uraian' => 'Pemasukan Kas: ' . ($in->judul ?? '-') . ($in->diterima_dari ? ' (Dari: ' . $in->diterima_dari . ')' : ''),
                        'kategori' => $in->kategori ?: 'Kas Masuk Lain',
                        'masuk' => (float) ($in->jumlah ?? 0),
                        'keluar' => 0,
                    ]);
                }

                foreach ($this->pengeluaran as $out) {
                    $ledger->push([
                        'tanggal' => $out->tanggal ? Carbon::parse($out->tanggal)->toDateString() : '',
                        'no_trx' => $out->no_transaksi ?: ('EXP-' . sprintf('%04d', $out->id)),
                        'uraian' => 'Pengeluaran: ' . ($out->judul ?? '-') . ($out->dibayarkan_kepada ? ' (Kpd: ' . $out->dibayarkan_kepada . ')' : ''),
                        'kategori' => $out->kategori ?: 'Operasional',
                        'masuk' => 0,
                        'keluar' => (float) ($out->jumlah ?? 0),
                    ]);
                }

                $sortedLedger = $ledger->sortBy('tanggal')->values();

                $totalPemasukanAll = (float) $pembayaranList->sum('jumlah') + (float) $pemasukanLainList->sum('jumlah');

                // 1. KOP TITLE
                $sheet->setCellValue('A1', strtoupper($instansi));
                $sheet->setCellValue('A2', 'BUKU KAS UMUM & ARUS KAS (CASHFLOW REPORT)');
                $sheet->setCellValue('A3', "Periode: {$periodeText}");
                $sheet->setCellValue('A4', 'Tanggal Ekspor: ' . now()->format('d-m-Y H:i') . ' WIB');

                $sheet->mergeCells('A1:H1');
                $sheet->mergeCells('A2:H2');
                $sheet->mergeCells('A3:H3');
                $sheet->mergeCells('A4:H4');

                $sheet->getStyle('A1')->getFont()->setBold(true)->setSize(14)->setColor(new \PhpOffice\PhpSpreadsheet\Style\Color('FF138F81'));
                $sheet->getStyle('A2')->getFont()->setBold(true)->setSize(12);
                $sheet->getStyle('A3:A4')->getFont()->setSize(10)->setItalic(true);
                $sheet->getStyle('A1:A4')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

                // 2. SUMMARY BOXES (Row 6 - 8)
                $sheet->setCellValue('A6', 'TOTAL SELURUH PEMASUKAN KAS');
                $sheet->setCellValue('B6', $totalPemasukanAll);
                $sheet->setCellValue('A7', 'TOTAL PENGELUARAN KAS');
                $sheet->setCellValue('B7', (float) $this->pengeluaran->sum('jumlah'));
                $sheet->setCellValue('A8', 'SISA SALDO KAS BERSIH (NET)');
                $sheet->setCellValue('B8', '=B6-B7');

                $sheet->getStyle('A6:A8')->getFont()->setBold(true)->setSize(10);
                $sheet->getStyle('B6:B8')->getFont()->setBold(true)->setSize(11);
                $sheet->getStyle('B6')->getNumberFormat()->setFormatCode('"Rp "#,##0');
                $sheet->getStyle('B7')->getNumberFormat()->setFormatCode('"Rp "#,##0');
                $sheet->getStyle('B8')->getNumberFormat()->setFormatCode('"Rp "#,##0');
                $sheet->getStyle('B8')->getFont()->setColor(new \PhpOffice\PhpSpreadsheet\Style\Color('FF138F81'));
                $sheet->getStyle('A6:B8')->applyFromArray([
                    'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['argb' => 'FFCBD5E1']]],
                ]);

                // 3. TABLE HEADERS (Row 10)
                $headerRow = 10;
                $headers = [
                    'A' => 'NO',
                    'B' => 'TANGGAL',
                    'C' => 'NO. TRANSAKSI',
                    'D' => 'URAIAN / KETERANGAN TRANSAKSI',
                    'E' => 'KATEGORI / SUMBER',
                    'F' => 'KAS MASUK (RP)',
                    'G' => 'KAS KELUAR (RP)',
                    'H' => 'SALDO AKUMULASI (RP)',
                ];

                foreach ($headers as $col => $text) {
                    $sheet->setCellValue("{$col}{$headerRow}", $text);
                }

                $sheet->getStyle("A{$headerRow}:H{$headerRow}")->applyFromArray([
                    'font' => ['bold' => true, 'color' => ['argb' => 'FFFFFFFF'], 'size' => 11],
                    'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FF138F81']],
                    'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER],
                    'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_MEDIUM, 'color' => ['argb' => 'FF0F7A6E']]],
                ]);

                // 4. POPULATE LEDGER ROWS
                $rowNum = 11;
                $no = 1;

                foreach ($sortedLedger as $item) {
                    $tglFormatted = $item['tanggal'] ? Carbon::parse($item['tanggal'])->format('d/m/Y') : '-';

                    $sheet->setCellValue("A{$rowNum}", $no++);
                    $sheet->setCellValue("B{$rowNum}", $tglFormatted);
                    $sheet->setCellValue("C{$rowNum}", $item['no_trx']);
                    $sheet->setCellValue("D{$rowNum}", $item['uraian']);
                    $sheet->setCellValue("E{$rowNum}", $item['kategori']);
                    $sheet->setCellValue("F{$rowNum}", $item['masuk']);
                    $sheet->setCellValue("G{$rowNum}", $item['keluar']);

                    // Running balance formula
                    if ($rowNum === 11) {
                        $sheet->setCellValue("H{$rowNum}", "=F{$rowNum}-G{$rowNum}");
                    } else {
                        $prevRow = $rowNum - 1;
                        $sheet->setCellValue("H{$rowNum}", "=H{$prevRow}+F{$rowNum}-G{$rowNum}");
                    }

                    $sheet->getStyle("A{$rowNum}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
                    $sheet->getStyle("B{$rowNum}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
                    $sheet->getStyle("C{$rowNum}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
                    $sheet->getStyle("E{$rowNum}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

                    $sheet->getStyle("F{$rowNum}")->getNumberFormat()->setFormatCode('"Rp "#,##0');
                    $sheet->getStyle("G{$rowNum}")->getNumberFormat()->setFormatCode('"Rp "#,##0');
                    $sheet->getStyle("H{$rowNum}")->getNumberFormat()->setFormatCode('"Rp "#,##0');

                    $sheet->getStyle("F{$rowNum}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);
                    $sheet->getStyle("G{$rowNum}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);
                    $sheet->getStyle("H{$rowNum}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);

                    if ($item['masuk'] > 0) {
                        $sheet->getStyle("F{$rowNum}")->getFont()->setColor(new \PhpOffice\PhpSpreadsheet\Style\Color('FF16A34A'))->setBold(true);
                    }
                    if ($item['keluar'] > 0) {
                        $sheet->getStyle("G{$rowNum}")->getFont()->setColor(new \PhpOffice\PhpSpreadsheet\Style\Color('FFE11D48'))->setBold(true);
                    }

                    if ($rowNum % 2 === 0) {
                        $sheet->getStyle("A{$rowNum}:H{$rowNum}")->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setARGB('FFF9FBFC');
                    }

                    $rowNum++;
                }

                $lastDataRow = $rowNum - 1;

                // 5. TOTAL FOOTER ROW
                $totalRow = $rowNum;
                $sheet->setCellValue("A{$totalRow}", 'TOTAL MUTASI KAS');
                $sheet->mergeCells("A{$totalRow}:E{$totalRow}");

                if ($lastDataRow >= 11) {
                    $sheet->setCellValue("F{$totalRow}", "=SUM(F11:F{$lastDataRow})");
                    $sheet->setCellValue("G{$totalRow}", "=SUM(G11:G{$lastDataRow})");
                    $sheet->setCellValue("H{$totalRow}", "=F{$totalRow}-G{$totalRow}");
                } else {
                    $sheet->setCellValue("F{$totalRow}", 0);
                    $sheet->setCellValue("G{$totalRow}", 0);
                    $sheet->setCellValue("H{$totalRow}", 0);
                }

                $sheet->getStyle("A{$totalRow}:H{$totalRow}")->applyFromArray([
                    'font' => ['bold' => true, 'size' => 11, 'color' => ['argb' => 'FF138F81']],
                    'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FFE8F8F5']],
                    'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['argb' => 'FF138F81']]],
                ]);

                $sheet->getStyle("A{$totalRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
                $sheet->getStyle("F{$totalRow}")->getNumberFormat()->setFormatCode('"Rp "#,##0');
                $sheet->getStyle("G{$totalRow}")->getNumberFormat()->setFormatCode('"Rp "#,##0');
                $sheet->getStyle("H{$totalRow}")->getNumberFormat()->setFormatCode('"Rp "#,##0');

                $sheet->getStyle("F{$totalRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);
                $sheet->getStyle("G{$totalRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);
                $sheet->getStyle("H{$totalRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);

                if ($lastDataRow >= 11) {
                    $sheet->getStyle("A11:H{$lastDataRow}")->applyFromArray([
                        'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['argb' => 'FFE2E8F0']]],
                    ]);
                }
            },
        ];
    }
}
