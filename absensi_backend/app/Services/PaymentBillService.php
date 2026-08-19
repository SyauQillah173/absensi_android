<?php

namespace App\Services;

use App\Models\PaymentBill;
use App\Models\PaymentBillNotification;
use App\Models\PaymentBillRule;
use App\Models\PaymentTransaction;
use App\Models\PaymentType;
use App\Models\Pembayaran;
use App\Models\AcademicYear;
use App\Models\Semester;
use App\Models\Siswa;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PaymentBillService
{
    public const ACADEMIC_MONTHS = [
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

    public const CALENDAR_MONTHS = [
        1 => 'Jan',
        2 => 'Feb',
        3 => 'Mar',
        4 => 'Apr',
        5 => 'Mei',
        6 => 'Jun',
        7 => 'Jul',
        8 => 'Agu',
        9 => 'Sep',
        10 => 'Okt',
        11 => 'Nov',
        12 => 'Des',
    ];

    public function ensureRuleForPaymentType(PaymentType $paymentType, ?int $actorId = null, array $options = []): PaymentBillRule
    {
        $query = PaymentBillRule::query()->where('payment_type_id', $paymentType->id);
        
        if (isset($options['semester_id'])) {
            $query->where('semester_id', $options['semester_id']);
        }
        
        $rule = $query->orderBy('id')->first();

        $payload = [
            'payment_type_id' => $paymentType->id,
            'name' => $options['name'] ?? $paymentType->nama,
            'nominal' => (int) ($options['nominal'] ?? $paymentType->nominal_default ?? 0),
            'billing_type' => $options['billing_type'] ?? $paymentType->periode ?? 'sekali',
            'due_day' => array_key_exists('due_day', $options)
                ? ($options['due_day'] === null ? null : $this->normalizeDueDay($options['due_day']))
                : $this->normalizeDueDay($rule?->due_day ?? 10),
            'target_type' => $options['target_type'] ?? 'all',
            'class_id' => $options['class_id'] ?? null,
            'billed_months' => $options['billed_months'] ?? ($rule ? $rule->billed_months : $paymentType->billed_months),
            'starts_on' => $options['starts_on'] ?? ($rule && $rule->starts_on ? $rule->starts_on->format('Y-m-d') : now()->format('Y-m-d')),
            'ends_on' => array_key_exists('ends_on', $options) ? $options['ends_on'] : ($rule && $rule->ends_on ? $rule->ends_on->format('Y-m-d') : null),
            'is_active' => $options['is_active'] ?? (($paymentType->status ?? 'Aktif') === 'Aktif'),
            'notification_settings' => $options['notification_settings'] ?? [
                'channels' => ['in_app'],
                'manual' => true,
                'before_due_days' => [3],
                'on_due_date' => true,
                'after_due_days' => [3],
            ],
            'created_by_user_id' => $actorId,
        ];

        if (isset($options['semester_id'])) {
            $payload['semester_id'] = $options['semester_id'];
        }

        if ($rule) {
            $rule->update($payload);
        } else {
            $rule = PaymentBillRule::query()->create($payload);
        }

        if (($payload['target_type'] ?? '') === 'student' && !empty($options['student_ids'])) {
            $rule->students()->sync(collect($options['student_ids'])->map(fn ($id) => (int) $id)->filter()->values());
        }

        return $rule->fresh(['paymentType', 'students']);
    }

    public function generateDueBills(?Carbon $through = null, ?int $ruleId = null): int
    {
        $through = ($through ?: now())->copy()->startOfDay();
        $createdOrTouched = 0;

        PaymentBillRule::query()
            ->with(['paymentType', 'students'])
            ->where('is_active', true)
            ->when($ruleId, fn ($query) => $query->where('id', $ruleId))
            ->orderBy('id')
            ->chunkById(50, function ($rules) use ($through, &$createdOrTouched) {
                /** @var \Illuminate\Database\Eloquent\Collection<int, PaymentBillRule> $rules */
                foreach ($rules as $rule) {
                    if (!$rule->paymentType || ($rule->paymentType->status ?? 'Aktif') !== 'Aktif') {
                        continue;
                    }

                    $periods = $this->periodsForRule($rule, $through);
                    if ($periods->isEmpty()) {
                        continue;
                    }

                    $students = $this->targetStudents($rule)->get();
                    foreach ($students as $siswa) {
                        foreach ($periods as $period) {
                            $status = Carbon::parse($period['due_date']) < now()->startOfDay()
                                ? 'Terlambat'
                                : 'Belum Lunas';
                            $existing = PaymentBill::query()
                                ->where('payment_bill_rule_id', $rule->id)
                                ->where('siswa_id', $siswa->id)
                                ->where('period_key', $period['period_key'])
                                ->first();
                            $bill = PaymentBill::query()->updateOrCreate(
                                [
                                    'payment_bill_rule_id' => $rule->id,
                                    'siswa_id' => $siswa->id,
                                    'period_key' => $period['period_key'],
                                ],
                                [
                                    'payment_type_id' => $rule->payment_type_id,
                                    'wali_id' => $siswa->wali_id,
                                    'class_id' => $siswa->class_id,
                                    'period_year' => $period['period_year'],
                                    'period_month' => $period['period_month'],
                                    'period_label' => $period['period_label'],
                                    'title' => $period['title'],
                                    'amount' => (int) $rule->nominal,
                                    'due_date' => $period['due_date'],
                                    'status' => in_array($existing?->status, ['Lunas', 'Dibatalkan'], true)
                                        ? $existing->status
                                        : $status,
                                ]
                            );
                            $this->prepareNotifications($bill->fresh(), $rule);
                            $createdOrTouched++;
                        }
                    }
                }
            });

        return $createdOrTouched;
    }

    public function markBillsPaid(Collection $billIds, PaymentTransaction $transaction): void
    {
        $billIds = $billIds->map(fn ($id) => (int) $id)->filter()->unique()->values();
        if ($billIds->isEmpty()) {
            return;
        }

        $status = $transaction->status === 'Menunggu' ? 'Menunggu Verifikasi' : $transaction->status;
        $payload = [
            'status' => $status,
            'payment_transaction_id' => $transaction->id,
            'updated_at' => now(),
        ];
        if ($transaction->status === 'Lunas') {
            $payload['paid_at'] = now();
        }

        PaymentBill::query()->whereIn('id', $billIds)->update($payload);
    }

    public function monthlyOptions(int $siswaId, int $paymentTypeId, int $academicYearId, ?int $semesterId = null): array
    {
        $paymentType = PaymentType::query()->findOrFail($paymentTypeId);
        $year = DB::table('academic_years')->where('id', $academicYearId)->first();
        if (!$year) {
            throw ValidationException::withMessages(['academic_year_id' => ['Tahun ajaran tidak ditemukan.']]);
        }

        $bills = PaymentBill::query()
            ->where('siswa_id', $siswaId)
            ->where('payment_type_id', $paymentTypeId)
            ->where('academic_year_id', $academicYearId)
            ->when($semesterId, fn ($query) => $query->where('semester_id', $semesterId))
            ->whereNotNull('period_month')
            ->get()
            ->keyBy(fn (PaymentBill $bill) => (int) $bill->period_month);

        $monthOrder = $this->monthOrderForPaymentType($paymentType, $semesterId);

        return collect($monthOrder)
            ->map(function (string $label, int $month) use ($bills, $paymentType, $year, $semesterId) {
                $bill = $bills->get($month);
                $status = $bill?->status ?? 'Belum Ada Tagihan';

                return [
                    'month' => $month,
                    'label' => $label,
                    'period_year' => $this->academicPeriodYear((int) $year->year_start, (int) $year->year_end, $month),
                    'period_key' => sprintf('%04d-%02d', $this->academicPeriodYear((int) $year->year_start, (int) $year->year_end, $month), $month),
                    'payment_type_id' => $paymentType->id,
                    'payment_type_name' => $paymentType->nama,
                    'semester_id' => $semesterId,
                    'amount' => (int) ($bill?->amount ?? $paymentType->nominal_default ?? 0),
                    'status' => $status,
                    'bill_id' => $bill?->id,
                    'can_pay' => !in_array($status, ['Lunas', 'Dibatalkan'], true),
                    'bill' => $bill ? $this->formatBill($bill) : null,
                ];
            })
            ->values()
            ->all();
    }

    public function ensureMonthlyBillForPayment(
        Siswa $siswa,
        PaymentType $paymentType,
        int $academicYearId,
        ?int $semesterId,
        int $month
    ): PaymentBill {
        if (!array_key_exists($month, self::ACADEMIC_MONTHS)) {
            throw ValidationException::withMessages(['payment_items' => ['Bulan pembayaran tidak valid.']]);
        }

        $year = DB::table('academic_years')->where('id', $academicYearId)->first();
        if (!$year) {
            throw ValidationException::withMessages(['academic_year_id' => ['Tahun ajaran tidak ditemukan.']]);
        }

        $semester = $semesterId
            ? DB::table('semesters')->where('id', $semesterId)->where('academic_year_id', $academicYearId)->first()
            : null;
        $semesterMonths = $this->monthsForSemester($semester?->id, $semester?->code ?? $semester?->name ?? null);
        if (!$this->usesFullYearMonths($paymentType) && $semesterMonths !== null && !in_array($month, $semesterMonths, true)) {
            throw ValidationException::withMessages([
                'payment_items' => ['Bulan yang dipilih tidak sesuai dengan semester aktif.'],
            ]);
        }
        $rule = $this->ensureRuleForPaymentType($paymentType);
        $periodYear = $this->academicPeriodYear((int) $year->year_start, (int) $year->year_end, $month);
        $periodKey = sprintf('%04d-%02d', $periodYear, $month);
        $periodLabel = $this->monthLabel(Carbon::create($periodYear, $month, 1));
        $dueDate = $this->dueDateForMonth(Carbon::create($periodYear, $month, 1), $rule->due_day)->toDateString();
        $status = Carbon::parse($dueDate)->lt(now()->startOfDay()) ? 'Terlambat' : 'Belum Lunas';

        $bill = PaymentBill::query()
            ->where('siswa_id', $siswa->id)
            ->where('academic_year_id', $academicYearId)
            ->where('payment_type_id', $paymentType->id)
            ->where('period_month', $month)
            ->first();

        if ($bill) {
            if (in_array($bill->status, ['Lunas', 'Dibatalkan'], true)) {
                throw ValidationException::withMessages([
                    'payment_items' => ["Bulan {$periodLabel} sudah {$bill->status} dan tidak dapat dibayar ulang."],
                ]);
            }

            return $bill;
        }

        return PaymentBill::query()->create([
            'payment_bill_rule_id' => $rule->id,
            'payment_type_id' => $paymentType->id,
            'siswa_id' => $siswa->id,
            'wali_id' => $siswa->wali_id,
            'class_id' => $siswa->class_id,
            'period_key' => $periodKey,
            'period_year' => $periodYear,
            'period_month' => $month,
            'period_label' => $periodLabel,
            'title' => trim($paymentType->nama . ' ' . $periodLabel),
            'amount' => (int) ($paymentType->nominal_default ?? $rule->nominal),
            'due_date' => $dueDate,
            'status' => $status,
            'academic_year_id' => $academicYearId,
            'semester_id' => $semester?->id,
            'tahun_ajaran' => $year->name,
            'semester' => $semester?->name,
        ]);
    }

    public function ensureGeneralBillForPayment(
        Siswa $siswa,
        PaymentType $paymentType,
        int $academicYearId,
        ?int $semesterId,
        int $amountDue
    ): PaymentBill {
        $year = DB::table('academic_years')->where('id', $academicYearId)->first();
        if (!$year) {
            throw ValidationException::withMessages(['academic_year_id' => ['Tahun ajaran tidak ditemukan.']]);
        }
        $semester = $semesterId
            ? DB::table('semesters')->where('id', $semesterId)->where('academic_year_id', $academicYearId)->first()
            : null;

        $billQuery = PaymentBill::query()
            ->where('siswa_id', $siswa->id)
            ->where('payment_type_id', $paymentType->id)
            ->whereNull('period_month');

        $isMonthly = str_contains(strtolower($paymentType->periode ?? ''), 'bulan') 
            || str_contains(strtolower($paymentType->nama), 'spp') 
            || str_contains(strtolower($paymentType->nama), 'syahriyah');

        if ($isMonthly) {
            $billQuery->where('academic_year_id', $academicYearId);
            $billQuery->where('semester_id', $semester?->id);
        } else {
            // For non-monthly bills, it's strictly one per academic year, disregarding semester
            $billQuery->where('academic_year_id', $academicYearId);
        }

        $bill = $billQuery->first();

        if ($bill) {
            if (in_array($bill->status, ['Lunas', 'Dibatalkan'], true)) {
                throw ValidationException::withMessages([
                    'payment_items' => ["Tagihan {$bill->title} sudah {$bill->status} dan tidak dapat dibayar ulang."],
                ]);
            }

            return $bill;
        }

        $rule = $this->ensureRuleForPaymentType($paymentType, null, [
            'billing_type' => $paymentType->periode ?: 'sekali',
            'nominal' => $amountDue,
        ]);

        return PaymentBill::query()->create([
            'payment_bill_rule_id' => $rule->id,
            'payment_type_id' => $paymentType->id,
            'siswa_id' => $siswa->id,
            'wali_id' => $siswa->wali_id,
            'class_id' => $siswa->class_id,
            'period_key' => 'once-' . $academicYearId . '-' . ($isMonthly ? ($semester?->id ?: 'all') : 'all'),
            'period_year' => null,
            'period_month' => null,
            'period_label' => 'Sekali Bayar',
            'title' => trim($paymentType->nama . ' (Sekali Bayar)'),
            'amount' => $amountDue,
            'due_date' => now()->toDateString(),
            'status' => 'Belum Lunas',
            'academic_year_id' => $academicYearId,
            'semester_id' => $isMonthly ? $semester?->id : null,
            'tahun_ajaran' => $year->name,
            'semester' => $isMonthly ? $semester?->name : null,
        ]);
    }

    public function refreshOverdue(): void
    {
        PaymentBill::query()
            ->whereIn('status', ['Belum Lunas', 'Terlambat'])
            ->whereDate('due_date', '<', now()->toDateString())
            ->update(['status' => 'Terlambat', 'updated_at' => now()]);
    }

    public function generateBillsForAcademicPeriod(AcademicYear $academicYear, ?Semester $semester = null): int
    {
        $createdOrTouched = 0;
        $paymentTypes = PaymentType::query()
            ->where('status', 'Aktif')
            ->orderBy('id')
            ->get();

        if ($paymentTypes->isEmpty()) {
            return 0;
        }

        $students = Siswa::query()
            ->whereHas('tahunAjaran', function ($query) use ($academicYear, $semester) {
                $query->where('academic_year_id', $academicYear->id)
                    ->where('is_active', true);
                if ($semester) {
                    $query->where('semester_id', $semester->id);
                }
            })
            ->orderBy('id')
            ->get();

        foreach ($paymentTypes as $paymentType) {
            if (!$paymentType->is_billed_to_all) {
                continue;
            }

            $rule = $this->ensureRuleForPaymentType($paymentType);
            $isMonthly = str_contains(strtolower($paymentType->periode ?? ''), 'bulan') 
                || str_contains(strtolower($paymentType->nama), 'spp') 
                || str_contains(strtolower($paymentType->nama), 'syahriyah');

            if (!$isMonthly) {
                foreach ($students as $student) {
                    $existing = PaymentBill::query()
                        ->where('siswa_id', $student->id)
                        ->where('academic_year_id', $academicYear->id)
                        ->where('payment_type_id', $paymentType->id)
                        ->whereNull('period_month')
                        ->exists();

                    if (!$existing) {
                        $dueDate = now()->copy();
                        if ($rule->due_day) {
                            $dueDate = $this->dueDateForMonth(now(), $rule->due_day);
                        }
                        $status = $dueDate->lt(now()->startOfDay()) ? 'Terlambat' : 'Belum Lunas';

                        PaymentBill::query()->create([
                            'siswa_id' => $student->id,
                            'academic_year_id' => $academicYear->id,
                            'payment_type_id' => $paymentType->id,
                            'payment_bill_rule_id' => $rule->id,
                            'wali_id' => $student->wali_id,
                            'class_id' => $student->class_id,
                            'period_key' => 'once',
                            'period_year' => null,
                            'period_month' => null,
                            'period_label' => 'Sekali Bayar',
                            'title' => trim($paymentType->nama . ' (Sekali Bayar)'),
                            'amount' => (int) ($paymentType->nominal_default ?? $rule->nominal),
                            'due_date' => $dueDate->toDateString(),
                            'status' => $status,
                            'tahun_ajaran' => $academicYear->name,
                            'semester' => null,
                            'semester_id' => null,
                        ]);
                        $createdOrTouched++;
                    }
                }
                continue;
            }

            $months = $rule->billed_months ? array_map('intval', $rule->billed_months) : [];
            $academicYearWithSemesters = $academicYear->loadMissing('semesters');

            foreach ($students as $student) {
                foreach ($months as $month) {
                    $periodYear = $this->academicPeriodYear((int) $academicYear->year_start, (int) $academicYear->year_end, $month);
                    $periodKey = sprintf('%04d-%02d', $periodYear, $month);
                    $periodLabel = $this->monthLabel(Carbon::create($periodYear, $month, 1));
                    $dueDate = $this->dueDateForMonth(Carbon::create($periodYear, $month, 1), $rule->due_day)->toDateString();
                    $status = Carbon::parse($dueDate)->lt(now()->startOfDay()) ? 'Terlambat' : 'Belum Lunas';
                    
                    // Assign ALL configured months to the semester defined in the rule
                    $semesterInfo = [
                        'semester_id' => $rule->semester_id,
                        'semester' => $rule->semester,
                    ];

                    $existing = PaymentBill::query()
                        ->where('siswa_id', $student->id)
                        ->where('academic_year_id', $academicYear->id)
                        ->where('semester_id', $rule->semester_id) // Match the specific semester's bill
                        ->where('payment_type_id', $paymentType->id)
                        ->where('period_month', $month)
                        ->first();

                    PaymentBill::query()->updateOrCreate(
                        [
                            'siswa_id' => $student->id,
                            'academic_year_id' => $academicYear->id,
                            'payment_type_id' => $paymentType->id,
                            'period_month' => $month,
                        ],
                        [
                            'payment_bill_rule_id' => $rule->id,
                            'wali_id' => $student->wali_id,
                            'class_id' => $student->class_id,
                            'period_key' => $periodKey,
                            'period_year' => $periodYear,
                            'period_label' => $periodLabel,
                            'title' => $existing ? $existing->title : trim($paymentType->nama . ' ' . $periodLabel),
                            'amount' => $existing ? $existing->amount : (int) ($paymentType->nominal_default ?? $rule->nominal),
                            'due_date' => $dueDate,
                            'status' => in_array($existing?->status, ['Lunas', 'Dibatalkan', 'Menunggu Verifikasi'], true)
                                ? $existing->status
                                : $status,
                            'tahun_ajaran' => $academicYear->name,
                            'semester' => $semesterInfo['semester'],
                            'semester_id' => $semesterInfo['semester_id'],
                        ]
                    );
                    $createdOrTouched++;
                }
            }
        }

        return $createdOrTouched;
    }

    public function recalculateBills(Collection $billIds): void
    {
        $billIds = $billIds->map(fn ($id) => (int) $id)->filter()->unique()->values();
        if ($billIds->isEmpty()) {
            return;
        }

        PaymentBill::query()
            ->whereIn('id', $billIds)
            ->get()
            ->each(function (PaymentBill $bill) {
                $payments = Pembayaran::query()
                    ->where('payment_bill_id', $bill->id)
                    ->whereIn('status', ['Lunas', 'Belum Lunas', 'Menunggu', 'Menunggu Verifikasi'])
                    ->orderByDesc('tanggal')
                    ->orderByDesc('id')
                    ->get();

                $receivedPayments = $payments->whereIn('status', ['Lunas', 'Belum Lunas']);
                $paidAmount = (int) $receivedPayments->sum('jumlah');
                $latestReceived = $receivedPayments->first();
                if ($paidAmount >= (int) $bill->amount && $latestReceived) {
                    $bill->update([
                        'status' => 'Lunas',
                        'payment_transaction_id' => $latestReceived->payment_transaction_id,
                        'paid_at' => $latestReceived->tanggal,
                    ]);
                    return;
                }

                if ($paidAmount > 0 && $latestReceived) {
                    $bill->update([
                        'status' => $bill->due_date && $bill->due_date->lt(now()->startOfDay())
                            ? 'Terlambat'
                            : 'Belum Lunas',
                        'payment_transaction_id' => $latestReceived->payment_transaction_id,
                        'paid_at' => null,
                    ]);
                    return;
                }

                $pending = $payments->whereIn('status', ['Menunggu', 'Menunggu Verifikasi'])->first();
                if ($pending) {
                    $bill->update([
                        'status' => 'Menunggu Verifikasi',
                        'payment_transaction_id' => $pending->payment_transaction_id,
                        'paid_at' => null,
                    ]);
                    return;
                }

                $status = $bill->due_date && $bill->due_date->lt(now()->startOfDay())
                    ? 'Terlambat'
                    : 'Belum Lunas';
                $bill->update([
                    'status' => $status,
                    'payment_transaction_id' => null,
                    'paid_at' => null,
                ]);
            });
    }

    public function reconcilePaidBillsForStudent(int $siswaId): void
    {
        PaymentBill::query()
            ->where('siswa_id', $siswaId)
            ->whereIn('status', ['Belum Lunas', 'Terlambat'])
            ->orderBy('due_date')
            ->get()
            ->each(function (PaymentBill $bill) use ($siswaId) {
                $directPayment = Pembayaran::query()
                    ->where('payment_bill_id', $bill->id)
                    ->whereIn('status', ['Lunas', 'Menunggu', 'Menunggu Verifikasi'])
                    ->orderByRaw("CASE status WHEN 'Lunas' THEN 1 ELSE 2 END")
                    ->orderByDesc('tanggal')
                    ->orderByDesc('id')
                    ->first();

                if ($directPayment) {
                    $bill->update([
                        'status' => $directPayment->status === 'Lunas' ? 'Lunas' : 'Menunggu Verifikasi',
                        'payment_transaction_id' => $directPayment->payment_transaction_id,
                        'paid_at' => $directPayment->status === 'Lunas' ? $directPayment->tanggal : null,
                    ]);
                    return;
                }

                $paymentQuery = Pembayaran::query()
                    ->where('siswa_id', $siswaId)
                    ->where('payment_type_id', $bill->payment_type_id)
                    ->where('status', 'Lunas');

                if ($bill->period_year && $bill->period_month) {
                    $paymentQuery
                        ->whereYear('tanggal', $bill->period_year)
                        ->whereMonth('tanggal', $bill->period_month);
                }

                $payment = $paymentQuery
                    ->where('jumlah', '>=', $bill->amount)
                    ->orderByDesc('tanggal')
                    ->orderByDesc('id')
                    ->first();

                if (!$payment) {
                    return;
                }

                $bill->update([
                    'status' => 'Lunas',
                    'payment_transaction_id' => $payment->payment_transaction_id,
                    'paid_at' => $payment->tanggal,
                ]);
            });
    }

    public function formatBill(PaymentBill $bill): array
    {
        $bill->loadMissing(['paymentType.periodType', 'siswa:id,nama,nis,kelas,wali_id']);
        $monthOrder = $this->monthOrderForPaymentType($bill->paymentType, $bill->semester_id ?: $bill->semester);

        return [
            'id' => $bill->id,
            'payment_bill_rule_id' => $bill->payment_bill_rule_id,
            'payment_type_id' => $bill->payment_type_id,
            'payment_type' => $bill->paymentType,
            'siswa_id' => $bill->siswa_id,
            'siswa' => $bill->siswa,
            'wali_id' => $bill->wali_id,
            'class_id' => $bill->class_id,
            'title' => $bill->title,
            'nama' => $bill->title,
            'amount' => (int) $bill->amount,
            'nominal_default' => (int) $bill->amount,
            'due_date' => optional($bill->due_date)->format('Y-m-d'),
            'tanggal_jatuh_tempo' => optional($bill->due_date)->format('Y-m-d'),
            'period_key' => $bill->period_key,
            'period_year' => $bill->period_year,
            'period_month' => $bill->period_month,
            'period_label' => $bill->period_label,
            'academic_year_id' => $bill->academic_year_id,
            'semester_id' => $bill->semester_id,
            'tahun_ajaran' => $bill->tahun_ajaran,
            'semester' => $bill->semester,
            'status' => $bill->status,
            'status_tagihan' => $bill->status,
            'month_mode' => $bill->paymentType?->periodType?->month_mode ?? 'semester',
            'month_order' => collect($monthOrder)
                ->map(fn (string $label, int $month) => ['month' => $month, 'label' => $label])
                ->values(),
            'payment_transaction_id' => $bill->payment_transaction_id,
            'paid_at' => optional($bill->paid_at)->toIso8601String(),
            'metode_pembayaran' => $bill->paymentType?->metode_pembayaran ?? [],
        ];
    }

    public function monthOrderForPaymentType(?PaymentType $paymentType = null, mixed $semester = null): array
    {
        if ($this->usesFullYearMonths($paymentType)) {
            return self::CALENDAR_MONTHS;
        }

        $months = $this->monthsForSemester(
            is_numeric($semester) ? (int) $semester : null,
            is_numeric($semester) ? null : (string) $semester
        );

        if ($months === null) {
            return self::ACADEMIC_MONTHS;
        }

        return collect(self::ACADEMIC_MONTHS)
            ->filter(fn (string $label, int $month) => in_array($month, $months, true))
            ->all();
    }

    public function usesFullYearMonths(?PaymentType $paymentType): bool
    {
        if (!$paymentType) {
            return false;
        }

        $paymentType->loadMissing('periodType');
        return ($paymentType->periodType?->month_mode ?? 'semester') === 'full_year';
    }

    /**
     * @return Collection<int, array>
     */
    private function periodsForRule(PaymentBillRule $rule, Carbon $through): Collection
    {
        $start = $rule->starts_on ? $rule->starts_on->copy() : now()->startOfDay();
        $end = $rule->ends_on ? $rule->ends_on->copy()->min($through) : $through->copy();
        if ($start->gt($through) || $start->gt($end)) {
            return collect();
        }

        if ($rule->billing_type === 'bulanan') {
            $cursor = $start->copy()->startOfMonth();
            $last = $end->copy()->startOfMonth();
            $periods = [];

            $billedMonths = is_array($rule->billed_months) 
                ? array_map('intval', $rule->billed_months) 
                : null;

            while ($cursor->lte($last)) {
                $month = (int) $cursor->month;
                
                if ($billedMonths !== null && !in_array($month, $billedMonths, true)) {
                    $cursor->addMonthNoOverflow();
                    continue;
                }

                $dueDate = $this->dueDateForMonth($cursor, $rule->due_day);
                $periods[] = [
                    'period_key' => $cursor->format('Y-m'),
                    'period_year' => (int) $cursor->year,
                    'period_month' => $month,
                    'period_label' => $this->monthLabel($cursor),
                    'title' => trim($rule->name . ' ' . $this->monthLabel($cursor)),
                    'due_date' => $dueDate->toDateString(),
                ];
                $cursor->addMonthNoOverflow();
            }

            return collect($periods);
        }

        $dueDate = $start->copy();
        if ($rule->due_day) {
            $dueDate = $this->dueDateForMonth($start, $rule->due_day);
        }

        return collect([[
            'period_key' => 'once',
            'period_year' => null,
            'period_month' => null,
            'period_label' => 'Sekali Bayar',
            'title' => $rule->name,
            'due_date' => $dueDate->toDateString(),
        ]]);
    }

    private function targetStudents(PaymentBillRule $rule): Builder
    {
        $activeStatusId = app(ReferenceResolver::class)->studentStatusId('Aktif');

        return Siswa::query()
            ->where(function ($query) use ($activeStatusId) {
                if ($activeStatusId) {
                    $query->where('student_status_id', $activeStatusId);
                }
                $query->orWhere('status', 'Aktif');
            })
            ->when($rule->target_type === 'class' && $rule->class_id, fn ($query) => $query->where('class_id', $rule->class_id))
            ->when($rule->target_type === 'student', function ($query) use ($rule) {
                $ids = $rule->students->pluck('id')->values();
                $ids->isEmpty() ? $query->whereRaw('1 = 0') : $query->whereIn('id', $ids);
            });
    }

    private function dueDateForMonth(Carbon $month, ?int $dueDay): Carbon
    {
        $dueDay = $this->normalizeDueDay($dueDay ?? 10);
        $date = $month->copy()->startOfMonth();
        return $date->setDay(min($dueDay, $date->daysInMonth));
    }

    private function normalizeDueDay(mixed $value): int
    {
        return max(1, min(31, (int) ($value ?: 10)));
    }

    private function monthLabel(Carbon $date): string
    {
        $months = [
            1 => 'Januari',
            2 => 'Februari',
            3 => 'Maret',
            4 => 'April',
            5 => 'Mei',
            6 => 'Juni',
            7 => 'Juli',
            8 => 'Agustus',
            9 => 'September',
            10 => 'Oktober',
            11 => 'November',
            12 => 'Desember',
        ];

        return ($months[(int) $date->month] ?? $date->format('F')) . ' ' . $date->year;
    }

    private function academicPeriodYear(int $yearStart, int $yearEnd, int $month): int
    {
        return $month >= 7 ? $yearStart : $yearEnd;
    }

    private function monthsForSemester(?int $semesterId = null, ?string $semester = null): ?array
    {
        if ($semesterId) {
            $row = DB::table('semesters')->where('id', $semesterId)->first();
            $semester = $row?->code ?? $row?->name ?? $semester;
        }

        $raw = strtolower(trim((string) $semester));
        if ($raw === '') {
            return null;
        }
        if (in_array($raw, ['ganjil', 'gasal', '1', 'semester ganjil'], true)) {
            return [7, 8, 9, 10, 11, 12];
        }
        if (in_array($raw, ['genap', '2', 'semester genap'], true)) {
            return [1, 2, 3, 4, 5, 6];
        }

        return null;
    }

    /**
     * Determine the semester_id and semester name for a given month within an academic year.
     * Jul-Dec = Ganjil, Jan-Jun = Genap.
     */
    private function semesterForMonth(int $month, AcademicYear $academicYear): array
    {
        $isGanjil = $month >= 7 && $month <= 12;
        $code = $isGanjil ? 'ganjil' : 'genap';
        $semester = $academicYear->semesters
            ? collect($academicYear->semesters)->first(fn ($s) => strtolower($s->code ?? $s->name ?? '') === $code)
            : DB::table('semesters')
                ->where('academic_year_id', $academicYear->id)
                ->whereRaw('lower(coalesce(code, name)) = ?', [$code])
                ->first();

        return [
            'semester_id' => $semester->id ?? null,
            'semester' => $semester->name ?? ucfirst($code),
        ];
    }

    private function prepareNotifications(PaymentBill $bill, PaymentBillRule $rule): void
    {
        if (!$bill->due_date || !$bill->wali_id) {
            return;
        }

        $settings = $rule->notification_settings ?? [];
        $items = [];
        foreach (($settings['before_due_days'] ?? []) as $days) {
            $items[] = ['type' => 'before_due', 'date' => $bill->due_date->copy()->subDays((int) $days)];
        }
        if (($settings['on_due_date'] ?? false) === true) {
            $items[] = ['type' => 'on_due', 'date' => $bill->due_date->copy()];
        }
        foreach (($settings['after_due_days'] ?? []) as $days) {
            $items[] = ['type' => 'after_due', 'date' => $bill->due_date->copy()->addDays((int) $days)];
        }

        foreach ($items as $item) {
            PaymentBillNotification::query()->firstOrCreate(
                [
                    'payment_bill_id' => $bill->id,
                    'recipient_user_id' => $bill->wali_id,
                    'channel' => 'in_app',
                    'schedule_type' => $item['type'],
                    'scheduled_for' => $item['date']->toDateString(),
                ],
                [
                    'status' => 'pending',
                    'message' => "Tagihan {$bill->title} jatuh tempo {$bill->due_date->format('Y-m-d')}.",
                ]
            );
        }
    }

    public function syncBillsForPaymentType(PaymentType $paymentType, ?int $targetSemesterId = null): void
    {
        $query = PaymentBill::query()
            ->where('payment_type_id', $paymentType->id)
            ->whereIn('status', ['Belum Lunas', 'Terlambat']);

        if (!$paymentType->is_billed_to_all) {
            $query->delete();
            return;
        }

        $rule = $this->ensureRuleForPaymentType($paymentType, null, $targetSemesterId ? ['semester_id' => $targetSemesterId] : []);
        $isMonthly = str_contains(strtolower($paymentType->periode ?? ''), 'bulan');

        if ($isMonthly && is_array($rule->billed_months)) {
            $deleteQuery = (clone $query)->whereNotNull('period_month');
            if ($rule->semester_id) {
                $deleteQuery->where('semester_id', $rule->semester_id);
            }

            if (empty($rule->billed_months)) {
                $deleteQuery->delete();
                return;
            } else {
                $deleteQuery->whereNotIn('period_month', array_map('intval', $rule->billed_months))
                    ->delete();
            }
        }

        // Handle non-monthly bills (e.g. Kitab, Seragam)
        if (!$isMonthly) {
            // BERSIIHKAN semua tagihan bulanan yang belum lunas jika tipe diubah ke Sekali Bayar
            (clone $query)->whereNotNull('period_month')->delete();

            $academicYear = AcademicYear::query()->where('is_active', true)->first();
            if (!$academicYear) {
                return;
            }

            $students = Siswa::query()
                ->whereHas('tahunAjaran', function ($q) use ($academicYear) {
                    $q->where('academic_year_id', $academicYear->id)
                      ->where('is_active', true);
                })
                ->get();

            $existingBills = PaymentBill::query()
                ->where('payment_type_id', $paymentType->id)
                ->where('academic_year_id', $academicYear->id)
                ->select('siswa_id')
                ->get()
                ->pluck('siswa_id')
                ->toArray();

            $inserts = [];
            $now = now();

            foreach ($students as $student) {
                if (!in_array($student->id, $existingBills)) {
                    $dueDate = $now->copy();
                    if ($rule->due_day) {
                        $dueDate = $this->dueDateForMonth($now, $rule->due_day);
                    }
                    $status = $dueDate->lt($now->startOfDay()) ? 'Terlambat' : 'Belum Lunas';

                    $inserts[] = [
                        'payment_bill_rule_id' => $rule->id,
                        'payment_type_id' => $paymentType->id,
                        'siswa_id' => $student->id,
                        'wali_id' => $student->wali_id,
                        'class_id' => $student->class_id,
                        'period_key' => 'once',
                        'period_year' => null,
                        'period_month' => null,
                        'period_label' => 'Sekali Bayar',
                        'title' => trim($paymentType->nama . ' (Sekali Bayar)'),
                        'amount' => (int) ($paymentType->nominal_default ?? $rule->nominal),
                        'due_date' => $dueDate->toDateString(),
                        'status' => $status,
                        'academic_year_id' => $academicYear->id,
                        'tahun_ajaran' => $academicYear->name,
                        'semester_id' => null,
                        'semester' => null,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ];
                }
            }

            foreach (array_chunk($inserts, 500) as $chunk) {
                PaymentBill::insert($chunk);
            }
            return;
        }

        // Fast generation for missing checked months (only for monthly bills)
        if (empty($rule->billed_months)) {
            return;
        }

        $academicYear = AcademicYear::query()->with('semesters')->where('is_active', true)->first();
        if (!$academicYear) {
            return;
        }

        $monthsToBill = array_map('intval', $rule->billed_months);

        $students = Siswa::query()
            ->whereHas('tahunAjaran', function ($q) use ($academicYear) {
                $q->where('academic_year_id', $academicYear->id)
                  ->where('is_active', true);
            })
            ->get();

        $existingBills = PaymentBill::query()
            ->where('payment_type_id', $paymentType->id)
            ->where('academic_year_id', $academicYear->id)
            ->whereNotNull('period_month')
            ->select('siswa_id', 'period_month')
            ->get()
            ->groupBy('siswa_id')
            ->map(fn ($items) => $items->pluck('period_month')->toArray());

        $inserts = [];
        $now = now();

        foreach ($students as $student) {
            $existingMonths = $existingBills->get($student->id, []);
            $missingMonths = array_diff($monthsToBill, $existingMonths);

            foreach ($missingMonths as $month) {
                $periodYear = $this->academicPeriodYear((int) $academicYear->year_start, (int) $academicYear->year_end, $month);
                $periodKey = sprintf('%04d-%02d', $periodYear, $month);
                $periodLabel = $this->monthLabel(Carbon::create($periodYear, $month, 1));
                $dueDate = $this->dueDateForMonth(Carbon::create($periodYear, $month, 1), $rule->due_day);
                $status = $dueDate->lt($now->startOfDay()) ? 'Terlambat' : 'Belum Lunas';

                $semesterInfo = $this->semesterForMonth($month, $academicYear);

                $inserts[] = [
                    'payment_bill_rule_id' => $rule->id,
                    'payment_type_id' => $paymentType->id,
                    'siswa_id' => $student->id,
                    'wali_id' => $student->wali_id,
                    'class_id' => $student->class_id,
                    'period_key' => $periodKey,
                    'period_year' => $periodYear,
                    'period_month' => $month,
                    'period_label' => $periodLabel,
                    'title' => trim($paymentType->nama . ' ' . $periodLabel),
                    'amount' => (int) ($paymentType->nominal_default ?? $rule->nominal),
                    'due_date' => $dueDate->toDateString(),
                    'status' => $status,
                    'academic_year_id' => $academicYear->id,
                    'tahun_ajaran' => $academicYear->name,
                    'semester_id' => $semesterInfo['semester_id'],
                    'semester' => $semesterInfo['semester'],
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }
        }

        foreach (array_chunk($inserts, 500) as $chunk) {
            PaymentBill::insert($chunk);
        }

        // Hapus tagihan yang bulannya di-uncheck, TAPI HANYA JIKA bulan tersebut
        // milik semester dari rule ini (artinya semester yang sedang diedit).
        $ruleSemesterMonths = $this->monthsForSemester(null, $rule->semester) ?? [];
        $monthsToDelete = array_diff($ruleSemesterMonths, $monthsToBill);

        if (!empty($monthsToDelete)) {
            PaymentBill::query()
                ->where('payment_type_id', $paymentType->id)
                ->where('academic_year_id', $academicYear->id)
                ->where('semester_id', $rule->semester_id) // Hanya hapus di semester yg di-setting
                ->whereIn('period_month', $monthsToDelete)
                ->where(function ($q) {
                    $q->whereNull('status')
                      ->orWhereNotIn('status', ['Lunas', 'Menunggu Verifikasi']);
                })
                ->whereDoesntHave('pembayaran')
                ->delete();
        }
    }
}
