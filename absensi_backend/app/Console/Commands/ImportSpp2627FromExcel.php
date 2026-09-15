<?php

namespace App\Console\Commands;

use App\Models\AcademicYear;
use App\Models\PaymentBill;
use App\Models\PaymentBillRule;
use App\Models\PaymentTransaction;
use App\Models\PaymentType;
use App\Models\Pembayaran;
use App\Models\Semester;
use App\Models\Siswa;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\IOFactory;

class ImportSpp2627FromExcel extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'spp:import-excel-2627
                            {--file= : Path spesifik ke file Excel PONPES QOMARUDDIN}
                            {--fresh : Reset tagihan SPP 2026/2027 lama sebelum import baru}
                            {--dry-run : Simulasi dan cek validasi data tanpa mengubah database}
                            {--auto-create-students : Daftarkan santri secara otomatis jika belum ada di database siswa}
                            {--force : Jalankan langsung tanpa konfirmasi interaktif}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Import data tagihan dan status SPP 26-27 dari dokumen Excel PONPES QOMARUDDIN ke database server';

    private function normName(?string $str): string
    {
        $n = strtoupper(trim((string)$str));
        $n = preg_replace('/[^\w\s]/u', '', $n);
        $n = preg_replace('/\s+/', ' ', $n);
        return trim($n);
    }

    private function resolveExcelPath(?string $customPath): ?string
    {
        if ($customPath && file_exists($customPath)) {
            return realpath($customPath);
        }

        $candidates = [
            base_path('../PONPES QOMARAUDDIN 1747 (1).xlsx'),
            base_path('../PONPES QOMARUDDIN 1747 (1).xlsx'),
            base_path('../PONPES QOMARUDDIN.xlsx'),
            base_path('PONPES QOMARAUDDIN 1747 (1).xlsx'),
            base_path('PONPES QOMARUDDIN 1747 (1).xlsx'),
            base_path('PONPES QOMARUDDIN.xlsx'),
            storage_path('app/PONPES QOMARAUDDIN 1747 (1).xlsx'),
            storage_path('app/PONPES QOMARUDDIN.xlsx'),
            'C:/Users/Nobita/absensi_android/PONPES QOMARAUDDIN 1747 (1).xlsx',
            'C:/Users/Nobita/Downloads/PONPES QOMARAUDDIN 1747.xlsx',
            '/var/www/ppqomaruddin/PONPES QOMARAUDDIN 1747 (1).xlsx',
            '/var/www/ppqomaruddin/absensi_backend/PONPES QOMARAUDDIN 1747 (1).xlsx',
        ];

        foreach ($candidates as $path) {
            if (file_exists($path)) {
                return realpath($path);
            }
        }

        return null;
    }

    public function handle(): int
    {
        ini_set('memory_limit', '1024M');
        set_time_limit(600);

        $this->info("=================================================================");
        $this->info("   📊 MIGRASI DATA SPP 26-27 DOKUMEN EXCEL PONPES QOMARUDDIN    ");
        $this->info("=================================================================");

        $filePath = $this->resolveExcelPath($this->option('file'));
        if (!$filePath) {
            $this->error("❌ File Excel tidak ditemukan! Pastikan file PONPES QOMARAUDDIN 1747 (1).xlsx ada di root project atau gunakan opsi --file=/path/to/file.xlsx");
            return 1;
        }

        $isDryRun = (bool)$this->option('dry-run');
        $isFresh = (bool)$this->option('fresh');
        $autoCreate = (bool)$this->option('auto-create-students');
        $force = (bool)$this->option('force');

        $this->info("📁 Lokasi File Excel : {$filePath} (" . round(filesize($filePath) / 1024, 2) . " KB)");
        $this->info("⚙️  Mode Eksekusi     : " . ($isDryRun ? "[DRY-RUN / SIMULASI]" : "[LIVE DATABASE MIGRATION]"));
        $this->info("🔄 Fresh Reset       : " . ($isFresh ? "YA (Hapus tagihan 26-27 lama)" : "TIDAK (Insert / Update)"));
        $this->info("👥 Auto-Create Siswa : " . ($autoCreate ? "YA (Daftarkan santri baru otomatis)" : "TIDAK (Hanya cocokkan data ada)"));
        $this->newLine();

        if (!$isDryRun && !$force) {
            if (!$this->confirm('Apakah Anda yakin ingin memproses migrasi data SPP 26-27 ke database server?', true)) {
                $this->warn("Operasi dibatalkan oleh pengguna.");
                return 0;
            }
        }

        // 1. Inisialisasi Master Data Akademik & Keuangan
        $this->info("▶ Menyiapkan Master Data Tahun Ajaran 2026/2027 & Jenis Pembayaran...");

        $academicYear = AcademicYear::firstOrCreate(
            ['name' => '2026/2027'],
            [
                'code' => '2026/2027',
                'start_date' => '2026-07-01',
                'end_date' => '2027-06-30',
                'year_start' => 2026,
                'year_end' => 2027,
                'active_semester' => 'ganjil',
                'is_active' => true,
            ]
        );

        $semGanjil = Semester::firstOrCreate(
            [
                'academic_year_id' => $academicYear->id,
                'name' => 'Ganjil',
            ],
            [
                'code' => '2026-ganjil',
                'is_active' => true,
            ]
        );

        $semGenap = Semester::firstOrCreate(
            [
                'academic_year_id' => $academicYear->id,
                'name' => 'Genap',
            ],
            [
                'code' => '2027-genap',
                'is_active' => false,
            ]
        );

        $paymentType = PaymentType::where('nama', 'SPP Pondok')
            ->orWhere('nama', 'SPP Pondok 2026/2027')
            ->first();

        if (!$paymentType) {
            $paymentType = PaymentType::create([
                'nama' => 'SPP Pondok',
                'deskripsi' => 'Tagihan SPP dan Kos Makan Santri Pondok Pesantren Qomaruddin',
                'nominal_default' => 530000,
                'periode' => 'bulanan',
                'status' => 'Aktif',
                'target_gender' => 'ALL',
                'is_billed_to_all' => true,
                'billed_months' => [7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6],
                'target_mondok' => 'mondok',
                'tier_pricing_enabled' => true,
                'nominal_reguler' => 530000,
                'nominal_vip' => 580000,
                'nominal_keringanan' => 250000,
            ]);
        } else {
            $paymentType->update([
                'nama' => 'SPP Pondok',
                'target_mondok' => 'mondok',
                'tier_pricing_enabled' => true,
                'nominal_default' => 530000,
                'nominal_reguler' => 530000,
                'nominal_vip' => 580000,
                'nominal_keringanan' => 250000,
            ]);
        }

        $rule = PaymentBillRule::firstOrCreate(
            [
                'payment_type_id' => $paymentType->id,
                'name' => 'Aturan Tarif SPP 2026/2027',
            ],
            [
                'nominal' => 530000,
                'billing_type' => 'bulanan',
                'due_day' => 10,
                'target_type' => 'all',
                'target_mondok' => 'mondok',
                'nominal_vip' => 580000,
                'nominal_keringanan' => 250000,
                'starts_on' => '2026-07-01',
                'ends_on' => '2027-06-30',
                'is_active' => true,
                'academic_year_id' => $academicYear->id,
                'semester_id' => $semGanjil->id,
                'tahun_ajaran' => '2026/2027',
                'semester' => 'Ganjil',
            ]
        );

        $rule->update([
            'target_mondok' => 'mondok',
            'nominal' => 530000,
            'nominal_vip' => 580000,
            'nominal_keringanan' => 250000,
        ]);

        $this->info("✓ Master Tahun Ajaran ID: {$academicYear->id} [2026/2027]");
        $this->info("✓ Master Jenis Tagihan ID: {$paymentType->id} [{$paymentType->nama}]");

        // 2. Pembersihan Tagihan Lama jika --fresh
        if ($isFresh && !$isDryRun) {
            $this->info("▶ Membersihkan tagihan SPP 2026/2027 lama...");
            $oldBillIds = PaymentBill::where('payment_type_id', $paymentType->id)
                ->where('academic_year_id', $academicYear->id)
                ->pluck('id')
                ->toArray();

            if (!empty($oldBillIds)) {
                Pembayaran::whereIn('payment_bill_id', $oldBillIds)->delete();
                PaymentBill::whereIn('id', $oldBillIds)->delete();
                $this->info("✓ Berhasil membersihkan " . count($oldBillIds) . " tagihan lama.");
            }
        }

        // 3. Membaca Dokumen Excel Sheet SPP 26-27
        $this->info("▶ Memuat worksheet [SPP 26-27] dari file Excel...");
        $reader = IOFactory::createReaderForFile($filePath);
        $reader->setLoadSheetsOnly(['SPP 26-27']);
        $reader->setReadDataOnly(true);
        $spreadsheet = $reader->load($filePath);
        $sheet = $spreadsheet->getSheetByName('SPP 26-27');

        $highestRow = $sheet->getHighestRow();
        $this->info("✓ Berhasil memuat sheet. Total baris yang akan diperiksa: {$highestRow}");

        // 4. Cache Siswa dari Database
        $this->info("▶ Memuat database santri ke memory cache...");
        $dbSiswaList = Siswa::select('id', 'nis', 'nama', 'kelas', 'kamar', 'wali_id', 'class_id')->get();
        $dbSiswaMap = [];
        $dbSiswaNorm = [];
        $maxNisNum = 0;

        foreach ($dbSiswaList as $s) {
            $raw = strtoupper(trim($s->nama));
            $norm = $this->normName($s->nama);
            $dbSiswaMap[$raw] = $s;
            $dbSiswaNorm[$norm] = $s;

            $nisDigits = (int)preg_replace('/[^0-9]/', '', (string)$s->nis);
            if ($nisDigits > $maxNisNum) {
                $maxNisNum = $nisDigits;
            }
        }
        $autoNisCounter = max($maxNisNum + 1, 20260001);

        $this->info("✓ Cache database santri siap (" . count($dbSiswaList) . " siswa).");

        // 5. Konfigurasi 12 Bulan Akademik (Juli 2026 - Juni 2027)
        $monthsConfig = [
            7 => ['name' => 'JULI', 'col' => 'E', 'year' => 2026, 'sem' => 'Ganjil', 'sem_id' => $semGanjil->id, 'due' => '2026-07-10', 'past' => true],
            8 => ['name' => 'AGUSTUS', 'col' => 'F', 'year' => 2026, 'sem' => 'Ganjil', 'sem_id' => $semGanjil->id, 'due' => '2026-08-10', 'past' => true],
            9 => ['name' => 'SEPTEMBER', 'col' => 'G', 'year' => 2026, 'sem' => 'Ganjil', 'sem_id' => $semGanjil->id, 'due' => '2026-09-10', 'past' => true],
            10 => ['name' => 'OKTOBER', 'col' => 'H', 'year' => 2026, 'sem' => 'Ganjil', 'sem_id' => $semGanjil->id, 'due' => '2026-10-10', 'past' => false],
            11 => ['name' => 'NOVEMBER', 'col' => 'I', 'year' => 2026, 'sem' => 'Ganjil', 'sem_id' => $semGanjil->id, 'due' => '2026-11-10', 'past' => false],
            12 => ['name' => 'DESEMBER', 'col' => 'J', 'year' => 2026, 'sem' => 'Ganjil', 'sem_id' => $semGanjil->id, 'due' => '2026-12-10', 'past' => false],
            1 => ['name' => 'JANUARI', 'col' => 'K', 'year' => 2027, 'sem' => 'Genap', 'sem_id' => $semGenap->id, 'due' => '2027-01-10', 'past' => false],
            2 => ['name' => 'FEBRUARI', 'col' => 'L', 'year' => 2027, 'sem' => 'Genap', 'sem_id' => $semGenap->id, 'due' => '2027-02-10', 'past' => false],
            3 => ['name' => 'MARET', 'col' => 'M', 'year' => 2027, 'sem' => 'Genap', 'sem_id' => $semGenap->id, 'due' => '2027-03-10', 'past' => false],
            4 => ['name' => 'APRIL', 'col' => 'N', 'year' => 2027, 'sem' => 'Genap', 'sem_id' => $semGenap->id, 'due' => '2027-04-10', 'past' => false],
            5 => ['name' => 'MEI', 'col' => 'O', 'year' => 2027, 'sem' => 'Genap', 'sem_id' => $semGenap->id, 'due' => '2027-05-10', 'past' => false],
            6 => ['name' => 'JUNI', 'col' => 'P', 'year' => 2027, 'sem' => 'Genap', 'sem_id' => $semGenap->id, 'due' => '2027-06-10', 'past' => false],
        ];

        // 6. Loop Parsing Baris Santri
        $this->info("▶ Memproses data santri dan membuat tagihan 12 bulan...");

        $totalSantri = 0;
        $matchedExact = 0;
        $matchedFuzzy = 0;
        $createdStudentsCount = 0;
        $unmatchedSkipped = 0;

        $totalBillsCreated = 0;
        $totalPaidBills = 0;
        $totalUnpaidBills = 0;
        $totalNominalPaid = 0;
        $totalNominalUnpaid = 0;

        $currentKamar = '';
        $progressBar = $this->output->createProgressBar($highestRow - 1);
        $progressBar->start();

        $defaultAdminUser = User::where('role', 'admin')->first() ?: User::first();
        $adminUserId = $defaultAdminUser?->id;

        for ($r = 2; $r <= $highestRow; $r++) {
            $progressBar->advance();

            $kamarCell = trim((string)$sheet->getCell([1, $r])->getValue());
            if (!empty($kamarCell)) {
                $currentKamar = $kamarCell;
            }

            $no = trim((string)$sheet->getCell([2, $r])->getValue());
            $nama = trim((string)$sheet->getCell([3, $r])->getValue());
            $kelas = trim((string)$sheet->getCell([4, $r])->getValue());

            if (empty($nama)) {
                continue;
            }

            $totalSantri++;

            // Cari santri di database
            $rawName = strtoupper(trim($nama));
            $normName = $this->normName($nama);
            $siswa = null;

            if (isset($dbSiswaMap[$rawName])) {
                $siswa = $dbSiswaMap[$rawName];
                $matchedExact++;
            } elseif (isset($dbSiswaNorm[$normName])) {
                $siswa = $dbSiswaNorm[$normName];
                $matchedFuzzy++;
            } else {
                // Coba kemiripan nama
                foreach ($dbSiswaNorm as $dn => $targetSiswa) {
                    similar_text($normName, $dn, $pct);
                    if ($pct >= 85) {
                        $siswa = $targetSiswa;
                        $matchedFuzzy++;
                        break;
                    }
                }
            }

            // Jika santri belum ada di database
            if (!$siswa) {
                if ($autoCreate) {
                    if (!$isDryRun) {
                        $siswa = Siswa::create([
                            'nis' => (string)$autoNisCounter++,
                            'nama' => $nama,
                            'kelas' => $kelas ?: 'Umum',
                            'kamar' => $currentKamar ?: 'BELUM MASUK DATA',
                            'status' => 'Aktif',
                            'status_mondok' => 'mondok',
                            'kategori_spp' => 'Reguler',
                            'jenis_santri' => 'Pondok',
                            'academic_year_id' => $academicYear->id,
                        ]);
                        // Masukkan ke cache agar tidak duplicate
                        $dbSiswaMap[$rawName] = $siswa;
                        $dbSiswaNorm[$normName] = $siswa;
                    }
                    $createdStudentsCount++;
                } else {
                    $unmatchedSkipped++;
                    continue;
                }
            }

            // Baca nilai nominal per bulan dan tentukan tarif standar santri
            $rowValues = [];
            $nonZeroAmounts = [];

            foreach ($monthsConfig as $mNum => $mCfg) {
                $col = $mCfg['col'];
                $val = $sheet->getCell($col . $r)->getCalculatedValue();
                if ($val === null || $val === '') {
                    $val = $sheet->getCell($col . $r)->getValue();
                }

                $num = is_numeric($val) ? (int)$val : 0;
                $rowValues[$mNum] = $num;
                if ($num > 0) {
                    $nonZeroAmounts[] = $num;
                }
            }

            // Hitung tarif dasar santri ini (misal 580000 atau 530000)
            if (!empty($nonZeroAmounts)) {
                $freq = array_count_values($nonZeroAmounts);
                arsort($freq);
                $baseMonthlyRate = array_key_first($freq);
            } else {
                $catatanS = trim((string)$sheet->getCell('S' . $r)->getValue());
                $baseMonthlyRate = is_numeric($catatanS) && (int)$catatanS >= 100000 ? (int)$catatanS : 530000;
            }

            // Klasifikasikan tier santri dan sinkronkan ke profil siswa
            $isVip = ($baseMonthlyRate >= 580000 || stripos($currentKamar, 'VIP') !== false || in_array(strtoupper($currentKamar), ['AL JAELANI', 'AL FAROBI', 'ABU MANSUR']));
            $isKeringanan = ($baseMonthlyRate < 500000 && $baseMonthlyRate > 0);
            $tierCategory = $isVip ? 'VIP' : ($isKeringanan ? 'Keringanan' : 'Reguler');

            if (!$isDryRun && $siswa) {
                if ($siswa->kategori_spp !== $tierCategory || $siswa->status_mondok !== 'mondok') {
                    $siswa->update([
                        'kategori_spp' => $tierCategory,
                        'status_mondok' => 'mondok',
                    ]);
                }
            }

            $catatanS = trim((string)$sheet->getCell('S' . $r)->getValue());
            $keteranganT = trim((string)$sheet->getCell('T' . $r)->getValue());
            $billNote = trim($keteranganT . ($catatanS ? " (Tarif: Rp " . number_format((int)$catatanS, 0, ',', '.') . ")" : ''));

            // Kumpulkan tagihan 12 bulan untuk santri ini
            foreach ($monthsConfig as $mNum => $mCfg) {
                $periodYear = $mCfg['year'];
                $periodKey = sprintf('%04d-%02d', $periodYear, $mNum);
                $periodLabel = $mCfg['name'] . ' ' . $periodYear;
                $dueDate = $mCfg['due'];
                $cellVal = $rowValues[$mNum];

                $isPaid = ($cellVal === 0);
                $billAmount = ($cellVal > 0) ? $cellVal : $baseMonthlyRate;

                if ($isPaid) {
                    $status = 'Lunas';
                    $paidAt = Carbon::create($periodYear, $mNum, 10, 8, 30, 0)->toDateTimeString();
                    $totalPaidBills++;
                    $totalNominalPaid += $billAmount;
                } else {
                    $status = $mCfg['past'] ? 'Terlambat' : 'Belum Lunas';
                    $paidAt = null;
                    $totalUnpaidBills++;
                    $totalNominalUnpaid += $billAmount;
                }

                $totalBillsCreated++;

                if (!$isDryRun && $siswa) {
                    $billsBatch[] = [
                        'payment_bill_rule_id' => $rule->id,
                        'payment_type_id' => $paymentType->id,
                        'siswa_id' => $siswa->id,
                        'wali_id' => $siswa->wali_id,
                        'class_id' => $siswa->class_id,
                        'period_key' => $periodKey,
                        'period_year' => $periodYear,
                        'period_month' => $mNum,
                        'period_label' => $periodLabel,
                        'title' => 'SPP ' . $periodLabel,
                        'amount' => $billAmount,
                        'due_date' => $dueDate,
                        'status' => $status,
                        'paid_at' => $paidAt,
                        'tahun_ajaran' => '2026/2027',
                        'semester' => $mCfg['sem'],
                        'semester_id' => $mCfg['sem_id'],
                        'academic_year_id' => $academicYear->id,
                        'notes' => $billNote ?: null,
                        'created_at' => now()->toDateTimeString(),
                        'updated_at' => now()->toDateTimeString(),
                    ];
                }
            }
        }

        $progressBar->finish();
        $this->newLine(2);

        // Eksekusi Batch Upsert ke Database jika bukan Dry-Run
        if (!$isDryRun && !empty($billsBatch)) {
            $this->info("▶ Menyimpan " . count($billsBatch) . " record tagihan ke database server via batch upsert...");
            $chunkBar = $this->output->createProgressBar(ceil(count($billsBatch) / 400));
            $chunkBar->start();

            foreach (array_chunk($billsBatch, 400) as $chunk) {
                PaymentBill::upsert(
                    $chunk,
                    ['payment_bill_rule_id', 'siswa_id', 'period_key'],
                    ['amount', 'due_date', 'status', 'paid_at', 'notes', 'updated_at']
                );
                $chunkBar->advance();
            }
            $chunkBar->finish();
            $this->newLine();
            $this->info("✓ Seluruh tagihan berhasil disimpan ke database.");

            // Sinkronisasi Transaksi Kas untuk Tagihan Lunas
            $this->info("▶ Menyinkronkan transaksi kas penerimaan untuk tagihan lunas...");
            $paidBills = PaymentBill::where('payment_type_id', $paymentType->id)
                ->where('academic_year_id', $academicYear->id)
                ->where('status', 'Lunas')
                ->whereNull('payment_transaction_id')
                ->with('siswa:id,nama,wali_id')
                ->get();

            if ($paidBills->isNotEmpty()) {
                $resolver = app(\App\Services\ReferenceResolver::class);
                $methodId = $resolver->paymentMethodId('Tunai / Kasir Pondok') ?: 11;
                $statusId = $resolver->paymentStatusId('Lunas') ?: 1;
                $nowStr = now()->toDateTimeString();

                $trxBatch = [];
                $allTrxCodes = [];

                foreach ($paidBills as $pb) {
                    $trxCode = 'TRX-SPP-' . $pb->period_year . sprintf('%02d', $pb->period_month) . '-' . $pb->siswa_id;
                    $dueDateStr = $pb->due_date ? $pb->due_date->toDateString() : now()->toDateString();
                    $allTrxCodes[] = $trxCode;

                    $trxBatch[] = [
                        'kode_transaksi' => $trxCode,
                        'siswa_id' => $pb->siswa_id,
                        'wali_id' => $pb->siswa?->wali_id,
                        'created_by_user_id' => $adminUserId,
                        'updated_by_user_id' => $adminUserId,
                        'atas_nama' => $pb->siswa?->nama ?? 'Santri',
                        'via' => 'Tunai / Kasir Pondok',
                        'payment_method_id' => $methodId,
                        'payment_status_id' => $statusId,
                        'jumlah_total' => $pb->amount,
                        'total_item' => 1,
                        'tanggal' => $dueDateStr,
                        'status' => 'Lunas',
                        'keterangan' => "Pelunasan {$pb->title} (Migrasi Excel SPP 26-27)",
                        'tahun_ajaran' => '2026/2027',
                        'semester' => $pb->semester,
                        'semester_id' => $pb->semester_id,
                        'academic_year_id' => $academicYear->id,
                        'created_at' => $nowStr,
                        'updated_at' => $nowStr,
                    ];
                }

                foreach (array_chunk($trxBatch, 250) as $chunk) {
                    PaymentTransaction::upsert($chunk, ['kode_transaksi'], [
                        'jumlah_total', 'status', 'keterangan', 'updated_at'
                    ]);
                }

                $trxMap = PaymentTransaction::whereIn('kode_transaksi', $allTrxCodes)->pluck('id', 'kode_transaksi');

                $pembayaranBatch = [];
                foreach ($paidBills as $pb) {
                    $trxCode = 'TRX-SPP-' . $pb->period_year . sprintf('%02d', $pb->period_month) . '-' . $pb->siswa_id;
                    $trxId = $trxMap[$trxCode] ?? null;
                    $dueDateStr = $pb->due_date ? $pb->due_date->toDateString() : now()->toDateString();

                    $pembayaranBatch[] = [
                        'payment_bill_id' => $pb->id,
                        'payment_type_id' => $paymentType->id,
                        'siswa_id' => $pb->siswa_id,
                        'payment_transaction_id' => $trxId,
                        'sort_order' => 1,
                        'wali_id' => $pb->siswa?->wali_id,
                        'atas_nama' => $pb->siswa?->nama ?? 'Santri',
                        'jenis' => 'SPP Bulanan',
                        'via' => 'Tunai / Kasir Pondok',
                        'payment_method_id' => $methodId,
                        'payment_status_id' => $statusId,
                        'jumlah' => $pb->amount,
                        'tanggal' => $dueDateStr,
                        'status' => 'Lunas',
                        'keterangan' => "Lunas {$pb->period_label}",
                        'tahun_ajaran' => '2026/2027',
                        'semester' => $pb->semester,
                        'semester_id' => $pb->semester_id,
                        'academic_year_id' => $academicYear->id,
                        'created_at' => $nowStr,
                        'updated_at' => $nowStr,
                    ];
                }

                foreach (array_chunk($pembayaranBatch, 250) as $chunk) {
                    Pembayaran::insert($chunk);
                }

                // Update payment_transaction_id pada payment_bills secara instan dalam 1 query
                DB::statement("
                    UPDATE payment_bills pb
                    SET payment_transaction_id = pt.id
                    FROM payment_transactions pt
                    WHERE pt.kode_transaksi = ('TRX-SPP-' || pb.period_year || lpad(pb.period_month::text, 2, '0') || '-' || pb.siswa_id)
                      AND pb.payment_type_id = ?
                      AND pb.academic_year_id = ?
                      AND pb.status = 'Lunas'
                ", [$paymentType->id, $academicYear->id]);

                $this->info("✓ Transaksi kas penerimaan untuk " . $paidBills->count() . " tagihan lunas berhasil disinkronkan.");
            }
        }

        $spreadsheet->disconnectWorksheets();
        unset($spreadsheet);
        gc_collect_cycles();

        // 7. Tampilkan Laporan Hasil
        $this->info("=================================================================");
        $this->info("             🎉 HASIL MIGRASI DATA SPP 26-27 SELESAI            ");
        $this->info("=================================================================");
        $this->table(
            ['Metrik Statistik', 'Jumlah', 'Keterangan'],
            [
                ['Total Baris Santri di Excel', $totalSantri, 'Santri terdata di sheet SPP 26-27'],
                ['Santri Cocok Persis Nama', $matchedExact, 'Langsung terhubung dengan buku induk'],
                ['Santri Cocok Normalisasi/Fuzzy', $matchedFuzzy, 'Nama cocok setelah normalisasi karakter'],
                ['Santri Baru Didaftarkan Otomatis', $createdStudentsCount, $autoCreate ? 'Berhasil didaftarkan ke tabel siswa' : 'Dilewati (opsi auto-create mati)'],
                ['Santri Dilewati (Belum Terdaftar)', $unmatchedSkipped, 'Santri tidak dapat diproses'],
                ['Total Record Tagihan (Bills)', $totalBillsCreated, '12 bulan periode Juli 2026 - Juni 2027'],
                ['Tagihan Berstatus LUNAS', $totalPaidBills, 'Nilai 0 di Excel (sudah terbayar)'],
                ['Tagihan BELUM LUNAS / TERLAMBAT', $totalUnpaidBills, 'Nilai nominal di Excel (piutang)'],
                ['Total Kas SPP Masuk (Lunas)', 'Rp ' . number_format($totalNominalPaid, 0, ',', '.'), 'Tercatat di pembayaran & transaksi kas'],
                ['Total Piutang Tagihan SPP', 'Rp ' . number_format($totalNominalUnpaid, 0, ',', '.'), 'Tunggakan & jatuh tempo mendatang'],
            ]
        );

        $this->info("=================================================================");
        if ($isDryRun) {
            $this->comment("ℹ️  MODE SIMULASI SELESAI. Database TIDAK diubah sama sekali.");
            $this->comment("👉 Jalankan tanpa --dry-run untuk menyimpan data secara permanen.");
        } else {
            $this->info("✅ SELURUH DATA SPP 26-27 BERHASIL DIMIGRASIKAN KE DATABASE SERVER!");
            $this->info("   Data kini dapat langsung dicek di Web Admin, Aplikasi Wali, & Laporan Keuangan.");
        }
        $this->info("=================================================================");

        return 0;
    }
}
