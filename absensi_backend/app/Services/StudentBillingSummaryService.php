<?php

namespace App\Services;

use App\Models\PaymentBill;
use App\Models\Pembayaran;
use App\Models\Siswa;
use Illuminate\Support\Collection;

class StudentBillingSummaryService
{
    private const ACADEMIC_MONTHS = [
        7 => 'Jul',
        8 => 'Agu',
        9 => 'Sep',
        10 => 'Okt',
        11 => 'Nov',
        12 => 'Des',
        1 => 'Jan',
        2 => 'Feb',
        3 => 'Mar',
        4 => 'Apr',
        5 => 'Mei',
        6 => 'Jun',
    ];

    public function __construct(
        private readonly PaymentBillService $billService,
        private readonly PaymentHistoryService $historyService,
    ) {
    }

    public function forStudent(Siswa|int $student, array $filters = []): array
    {
        $siswa = $student instanceof Siswa
            ? $student->loadMissing(['wali:id,name,email', 'kelasRef:id,name'])
            : Siswa::query()->with(['wali:id,name,email', 'kelasRef:id,name'])->findOrFail((int) $student);

        $billQuery = PaymentBill::query()
            ->with(['paymentType.periodType', 'siswa:id,nama,nis,kelas,class_id,wali_id'])
            ->where('siswa_id', $siswa->id);

        $this->applyBillFilters($billQuery, $filters);

        $bills = $billQuery
            ->orderByDesc('tahun_ajaran')
            ->orderByRaw("CASE lower(coalesce(semester, '')) WHEN 'genap' THEN 1 WHEN 'ganjil' THEN 2 ELSE 3 END")
            ->orderBy('period_year')
            ->orderBy('period_month')
            ->orderBy('due_date')
            ->get();

        $paymentsByBill = $this->paymentsByBill($bills->pluck('id')->filter()->values());
        $rows = $bills
            ->map(fn (PaymentBill $bill) => $this->billRow($bill, $paymentsByBill->get($bill->id, collect())))
            ->values();

        $transactions = $this->historyService->getTransactions([
            'siswa_id' => $siswa->id,
            'academic_year_id' => $filters['academic_year_id'] ?? null,
            'semester_id' => $filters['semester_id'] ?? null,
            'tahun_ajaran' => $filters['tahun_ajaran'] ?? null,
            'semester' => $filters['semester'] ?? null,
            'status' => $filters['payment_status'] ?? null,
            'limit' => $filters['history_limit'] ?? 200,
        ]);

        return [
            'student' => [
                'id' => $siswa->id,
                'nama' => $siswa->nama,
                'nis' => $siswa->nis,
                'kelas' => $siswa->kelasRef?->name ?? $siswa->kelas,
                'class_id' => $siswa->class_id,
                'status' => $siswa->status,
                'wali_id' => $siswa->wali_id,
                'wali_nama' => $siswa->wali?->name ?? $siswa->nama_wali,
            ],
            'summary' => $this->summary($rows),
            'groups' => $this->groups($rows),
            'tagihan' => $rows,
            'transactions' => $transactions->values(),
            'month_order' => collect(self::ACADEMIC_MONTHS)
                ->map(fn (string $label, int $month) => ['month' => $month, 'label' => $label])
                ->values(),
        ];
    }

    private function applyBillFilters($query, array $filters): void
    {
        if (!empty($filters['academic_year_id'])) {
            $query->where('academic_year_id', (int) $filters['academic_year_id']);
        }
        if (!empty($filters['semester_id'])) {
            $query->where('semester_id', (int) $filters['semester_id']);
        }
        if (!empty($filters['tahun_ajaran'])) {
            $query->where('tahun_ajaran', $filters['tahun_ajaran']);
        }
        if (!empty($filters['semester'])) {
            $query->whereRaw('lower(semester) = ?', [strtolower((string) $filters['semester'])]);
        }
        if (!empty($filters['status']) && $filters['status'] !== 'Semua') {
            $query->where('status', $filters['status']);
        }
        if (!empty($filters['payment_type_id'])) {
            $query->where('payment_type_id', (int) $filters['payment_type_id']);
        }
    }

    private function paymentsByBill(Collection $billIds): Collection
    {
        if ($billIds->isEmpty()) {
            return collect();
        }

        return Pembayaran::query()
            ->whereIn('payment_bill_id', $billIds->all())
            ->get()
            ->groupBy('payment_bill_id');
    }

    private function billRow(PaymentBill $bill, Collection $payments): array
    {
        $formatted = $this->billService->formatBill($bill);
        $amount = (int) $bill->amount;
        $paidAmount = (int) $payments
            ->whereNotIn('status', ['Dibatalkan', 'Batal'])
            ->sum('jumlah');
        $pendingAmount = (int) $payments
            ->where('status', 'Menunggu')
            ->sum('jumlah');

        $hasLunasPayment = $payments->where('status', 'Lunas')->isNotEmpty();
        $isPaid = $bill->status === 'Lunas' || $hasLunasPayment || ($paidAmount >= $amount && $amount > 0);

        if ($isPaid) {
            $status = 'Lunas';
            $remaining = 0;
            $displayStatus = 'Lunas';
            if ($paidAmount <= 0) {
                $paidAmount = $amount;
            }
        } else {
            $status = $bill->status;
            $remaining = max(0, $amount - $paidAmount);
            $displayStatus = $paidAmount > 0 ? 'Kurang Bayar' : $status;
        }

        if (!$this->isMonthly($bill) && $displayStatus === 'Terlambat') {
            $displayStatus = 'Belum Lunas';
        }

        return [
            ...$formatted,
            'payment_type_name' => $bill->paymentType?->nama ?? $bill->title,
            'period_type' => $bill->paymentType?->periode ?? null,
            'period_badge' => $this->periodBadge($bill->tahun_ajaran, $bill->semester),
            'month_order' => $formatted['month_order'] ?? [],
            'paid_amount' => $paidAmount,
            'pending_amount' => $pendingAmount,
            'remaining_amount' => $remaining,
            'kurang_bayar' => $remaining,
            'is_paid' => $isPaid,
            'status_code' => $status,
            'display_status' => $displayStatus,
            'is_monthly' => $this->isMonthly($bill),
            'pembayaran_id' => $payments->last()?->id,
        ];
    }

    private function summary(Collection $rows): array
    {
        return [
            'total_tagihan' => (int) $rows->sum('amount'),
            'total_dibayar' => (int) $rows->sum('paid_amount'),
            'total_lunas' => (int) $rows->where('is_paid', true)->sum('amount'),
            'total_belum_lunas' => (int) $rows->where('display_status', 'Belum Lunas')->sum('remaining_amount'),
            'total_terlambat' => (int) $rows->where('status', 'Terlambat')->sum('remaining_amount'),
            'total_menunggu_verifikasi' => (int) $rows->sum('pending_amount'),
            'total_kurang_bayar' => (int) $rows->sum('remaining_amount'),
            'jumlah_tagihan' => $rows->count(),
        ];
    }

    private function groups(Collection $rows): array
    {
        return $rows
            ->groupBy(fn (array $row) => $row['academic_year_id'] ?? ($row['tahun_ajaran'] ?? 'legacy'))
            ->map(function (Collection $yearRows) {
                $first = $yearRows->first();
                $academicYearName = $first['tahun_ajaran'] ?? '2025/2026';
                $monthlyRows = $yearRows->where('is_monthly', true);
                $generalRows = $yearRows->where('is_monthly', false);

                // Group monthly by payment_type_id
                $monthlyTypes = $monthlyRows
                    ->groupBy('payment_type_id')
                    ->map(fn (Collection $items) => $this->monthlyTypeRow($items))
                    ->values();

                return [
                    'academic_year_id' => $first['academic_year_id'] ?? null,
                    'tahun_ajaran' => $academicYearName,
                    'period_badge' => $academicYearName,
                    'monthly' => $monthlyTypes,
                    'general' => $generalRows->values(),
                ];
            })
            ->values()
            ->all();
    }

    private function monthlyTypeRow(Collection $items): array
    {
        $first = $items->first();
        $byMonth = $items->keyBy(fn (array $row) => (int) ($row['period_month'] ?? 0));
        
        $paymentType = \App\Models\PaymentType::query()->find($first['payment_type_id'] ?? 0);
        
        $rule = \App\Models\PaymentBillRule::query()
            ->where('payment_type_id', $first['payment_type_id'] ?? 0)
            ->when(!empty($first['academic_year_id']), fn ($q) => $q->where('academic_year_id', $first['academic_year_id']))
            ->orderBy('id')
            ->first();

        $all12Months = [7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6];
        $billedMonths = ($rule && is_array($rule->billed_months)) 
            ? array_map('intval', $rule->billed_months) 
            : (($paymentType && is_array($paymentType->billed_months)) ? array_map('intval', $paymentType->billed_months) : $all12Months);

        // Always show all 12 academic months: Jul -> Jun
        $months = collect(self::ACADEMIC_MONTHS)
            ->map(function (string $label, int $month) use ($byMonth, $paymentType, $rule, $billedMonths) {
                $row = $byMonth->get($month);
                $isConfiguredToBill = in_array($month, $billedMonths, true);
                
                $isPaid = (bool) ($row['is_paid'] ?? false);
                $hasBill = !empty($row);

                $status = 'Libur';
                if ($isPaid) {
                    $status = 'Lunas';
                } elseif ($hasBill && $isConfiguredToBill) {
                    $status = $row['display_status'] ?? $row['status'] ?? 'Belum Lunas';
                } elseif (!$isConfiguredToBill && !$hasBill) {
                    $status = 'Libur';
                }

                $configuredAmount = app(\App\Services\PaymentBillService::class)->amountForMonth($paymentType, $rule, $month);

                return [
                    'month' => $month,
                    'label' => $label,
                    'status' => $status,
                    'is_paid' => $isPaid,
                    'is_billed' => $hasBill && $isConfiguredToBill,
                    'paid_amount' => (int) ($row['paid_amount'] ?? 0),
                    'amount' => (int) ($row['amount'] ?? $configuredAmount),
                    'remaining_amount' => (int) ($row['remaining_amount'] ?? ($isConfiguredToBill ? $configuredAmount : 0)),
                    'bill_id' => $row['id'] ?? null,
                    'pembayaran_id' => $row['pembayaran_id'] ?? null,
                    'bill' => $row,
                ];
            })
            ->values();

        return [
            'payment_type_id' => $first['payment_type_id'] ?? null,
            'name' => $first['payment_type_name'] ?? $first['title'] ?? 'SPP',
            'months' => $months,
        ];
    }

    private function isMonthly(PaymentBill $bill): bool
    {
        $periode = strtolower((string) ($bill->paymentType?->periode ?? ''));

        return str_contains($periode, 'bulan')
            || !empty($bill->period_month)
            || preg_match('/^\d{4}-\d{2}$/', (string) $bill->period_key) === 1;
    }

    private function periodBadge(?string $tahunAjaran, ?string $semester): string
    {
        $year = trim((string) $tahunAjaran);
        $term = trim((string) $semester);
        if ($year === '' && $term === '') {
            return 'Tanpa Periode';
        }
        if ($year === '') {
            return $term;
        }
        if ($term === '') {
            return $year;
        }

        return "{$year} • {$term}";
    }

    private function monthsForSemester(?string $semester): ?array
    {
        $raw = strtolower(trim((string) $semester));
        if (in_array($raw, ['ganjil', 'gasal', 'semester ganjil'], true)) {
            return [7, 8, 9, 10, 11, 12];
        }
        if (in_array($raw, ['genap', 'semester genap'], true)) {
            return [1, 2, 3, 4, 5, 6];
        }

        return null;
    }
}
