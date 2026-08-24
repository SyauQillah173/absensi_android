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

        $isMonthly = str_contains(strtolower($paymentType->periode ?? ''), 'bulan') 
            || str_contains(strtolower($paymentType->nama), 'spp') 
            || str_contains(strtolower($paymentType->nama), 'syahriyah');

        $all12Months = [7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6];

        if (array_key_exists('billed_months', $options) && $options['billed_months'] !== null) {
            $billedMonths = $options['billed_months'];
        } elseif ($rule && $rule->billed_months !== null) {
            $billedMonths = $rule->billed_months;
        } elseif ($paymentType->billed_months !== null) {
            $billedMonths = $paymentType->billed_months;
        } else {
            $billedMonths = $isMonthly ? $all12Months : null;
        }

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
            'billed_months' => $billedMonths,
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
            $semesterRow = DB::table('semesters')->where('id', $options['semester_id'])->first();
            if ($semesterRow) {
                $payload['semester'] = $semesterRow->name ?? $semesterRow->code;
                $payload['academic_year_id'] = $semesterRow->academic_year_id;
                $yearRow = DB::table('academic_years')->where('id', $semesterRow->academic_year_id)->first();
                if ($yearRow) {
                    $payload['tahun_ajaran'] = $yearRow->name;
                }
            }
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

    public function recalculateBills($billIds): void
    {
        $ids = collect($billIds)->map(fn ($id) => (int) $id)->filter()->unique()->values();
        if ($ids->isEmpty()) {
            return;
        }

        PaymentBill::query()
            ->whereIn('id', $ids)
            ->get()
            ->each(function (PaymentBill $bill) {
                $payments = Pembayaran::query()
                    ->where('payment_bill_id', $bill->id)
                    ->whereNotIn('status', ['Dibatalkan', 'Batal'])
                    ->orderByDesc('tanggal')
                    ->orderByDesc('id')
                    ->get();

                $hasLunas = $payments->where('status', 'Lunas')->isNotEmpty();
                $paidAmount = (int) $payments->sum('jumlah');
                $latest = $payments->first();

                if ($hasLunas || ($paidAmount >= (int) $bill->amount && $bill->amount > 0)) {
                    $bill->update([
                        'status' => 'Lunas',
                        'payment_transaction_id' => $latest?->payment_transaction_id ?: $bill->payment_transaction_id,
                        'paid_at' => $latest?->tanggal ?: now(),
                        'updated_at' => now(),
                    ]);
                    return;
                }

                $hasPending = $payments->where('status', 'Menunggu')->isNotEmpty();
                if ($hasPending) {
                    $bill->update([
                        'status' => 'Menunggu Verifikasi',
                        'payment_transaction_id' => $latest?->payment_transaction_id ?: $bill->payment_transaction_id,
                        'paid_at' => null,
                        'updated_at' => now(),
                    ]);
                    return;
                }

                $isOverdue = $bill->due_date && Carbon::parse($bill->due_date)->lt(now()->startOfDay());
                $bill->update([
                    'status' => $paidAmount > 0 ? 'Belum Lunas' : ($isOverdue ? 'Terlambat' : 'Belum Lunas'),
                    'payment_transaction_id' => $latest?->payment_transaction_id,
                    'paid_at' => null,
                    'updated_at' => now(),
                ]);
            });
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
            $payload['paid_at'] = $transaction->tanggal ? Carbon::parse($transaction->tanggal) : now();
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

        $rule = $this->ensureRuleForPaymentType($paymentType, null, $semesterId ? ['semester_id' => $semesterId] : []);
        $monthOrder = $this->monthOrderForPaymentType($paymentType, $semesterId, $rule);

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

        $rule = $this->ensureRuleForPaymentType($paymentType, null, $semesterId ? ['semester_id' => $semesterId] : []);
        $isMonthly = str_contains(strtolower($paymentType->periode ?? ''), 'bulan') 
                || str_contains(strtolower($paymentType->nama), 'spp') 
                || str_contains(strtolower($paymentType->nama), 'syahriyah');

        $periodYear = $this->academicPeriodYear((int) $year->year_start, (int) $year->year_end, $month);
        $periodKey = sprintf('%04d-%02d', $periodYear, $month);
        $periodLabel = $this->monthLabel(Carbon::create($periodYear, $month, 1));
        
        $semester = $semesterId
            ? DB::table('semesters')->where('id', $semesterId)->where('academic_year_id', $academicYearId)->first()
            : null;

        $bill = PaymentBill::query()
            ->where('siswa_id', $siswa->id)
            ->where('academic_year_id', $academicYearId)
            ->where('payment_type_id', $paymentType->id)
            ->where('period_month', $month)
            ->when($semesterId, fn ($q) => $q->where('semester_id', $semesterId))
            ->first();

        if ($bill) {
            if (in_array($bill->status, ['Lunas', 'Dibatalkan'], true)) {
                throw ValidationException::withMessages([
                    'payment_items' => ["Bulan {$periodLabel} sudah {$bill->status} dan tidak dapat dibayar ulang."],
                ]);
            }
            return $bill;
        }

        if ($isMonthly && is_array($rule->billed_months) && !empty($rule->billed_months)) {
            $allowedMonths = array_map('intval', $rule->billed_months);
            if (!in_array($month, $allowedMonths, true)) {
                throw ValidationException::withMessages([
                    'payment_items' => ['Bulan yang dipilih tidak termasuk dalam setting bulan tagihan untuk semester ini.'],
                ]);
            }
        }
        
        $dueDate = $this->dueDateForMonth(Carbon::create($periodYear, $month, 1), $rule->due_day)->toDateString();
        $status = Carbon::parse($dueDate)->lt(now()->startOfDay()) ? 'Terlambat' : 'Belum Lunas';

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
            $periode = strtolower($paymentType->periode ?? 'umum');
            if ($periode === 'tahunan' || $periode === 'umum') {
                $billQuery->where('academic_year_id', $academicYearId);
            } elseif ($periode === 'semesteran') {
                $billQuery->where('academic_year_id', $academicYearId);
                if ($semesterId) {
                    $billQuery->where('semester_id', $semesterId);
                }
            }
            // For 'sekali', we just check globally if they ever paid it (no academic_year filter needed)
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

        $periode = strtolower($paymentType->periode ?? 'umum');
        $periodLabel = match($periode) {
            'harian' => 'Harian',
            'mingguan' => 'Mingguan',
            'semesteran' => 'Semesteran',
            'tahunan' => 'Tahunan',
            'sekali' => 'Sekali Bayar',
            default => 'Umum',
        };
        $titleSuffix = $periodLabel === 'Sekali Bayar' ? '(Sekali Bayar)' : "({$periodLabel})";

        $insertSemesterId = null;
        $insertSemesterName = null;
        $insertAcademicYearId = $academicYearId;
        $insertAcademicYearName = $year->name;

        if ($isMonthly || $periode === 'semesteran') {
            $insertSemesterId = $semester?->id;
            $insertSemesterName = $semester?->name;
        } elseif ($periode === 'sekali') {
            $insertAcademicYearId = null;
            $insertAcademicYearName = null;
        }

        return PaymentBill::query()->create([
            'payment_bill_rule_id' => $rule->id,
            'payment_type_id' => $paymentType->id,
            'siswa_id' => $siswa->id,
            'wali_id' => $siswa->wali_id,
            'class_id' => $siswa->class_id,
            'period_key' => 'once-' . $academicYearId . '-' . ($isMonthly ? ($semester?->id ?: 'all') : 'all'),
            'period_year' => null,
            'period_month' => null,
            'period_label' => $periodLabel,
            'title' => trim($paymentType->nama . ' ' . $titleSuffix),
            'amount' => $amountDue,
            'due_date' => now()->toDateString(),
            'status' => 'Belum Lunas',
            'academic_year_id' => $insertAcademicYearId,
            'semester_id' => $insertSemesterId,
            'tahun_ajaran' => $insertAcademicYearName,
            'semester' => $insertSemesterName,
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

            $rule = $this->ensureRuleForPaymentType($paymentType, null, $semester ? ['semester_id' => $semester->id] : []);
            $isMonthly = str_contains(strtolower($paymentType->periode ?? ''), 'bulan') 
                || str_contains(strtolower($paymentType->nama), 'spp') 
                || str_contains(strtolower($paymentType->nama), 'syahriyah');

            if (!$isMonthly) {
                $periode = strtolower($paymentType->periode ?? 'umum');
                
                $periodLabel = match($periode) {
                    'harian' => 'Harian',
                    'mingguan' => 'Mingguan',
                    'semesteran' => 'Semesteran',
                    'tahunan' => 'Tahunan',
                    'sekali' => 'Sekali Bayar',
                    default => 'Umum',
                };
                
                $titleSuffix = $periodLabel === 'Sekali Bayar' ? '(Sekali Bayar)' : "({$periodLabel})";

                $existingStudentIds = PaymentBill::query()
                    ->where('payment_type_id', $paymentType->id)
                    ->whereNull('period_month')
                    ->when($periode !== 'sekali', fn ($q) => $q->where('academic_year_id', $academicYear->id))
                    ->when($periode === 'semesteran' && $semester, fn ($q) => $q->where('semester_id', $semester->id))
                    ->pluck('siswa_id')
                    ->all();

                $inserts = [];
                $now = now();
                $dueDate = now()->copy();
                if ($rule->due_day) {
                    $dueDate = $this->dueDateForMonth(now(), $rule->due_day);
                }
                $status = $dueDate->lt($now->startOfDay()) ? 'Terlambat' : 'Belum Lunas';

                $insertSemesterId = null;
                $insertSemesterName = null;
                $insertAcademicYearId = $academicYear->id;
                $insertAcademicYearName = $academicYear->name;

                if ($periode === 'semesteran' && $semester) {
                    $insertSemesterId = $semester->id;
                    $insertSemesterName = $semester->name;
                } elseif ($periode === 'sekali') {
                    $insertAcademicYearId = null;
                    $insertAcademicYearName = null;
                }

                $periodKey = match($periode) {
                    'semesteran' => $semester ? "ay-{$academicYear->id}-sem-{$semester->id}" : "ay-{$academicYear->id}-sem",
                    'sekali' => "once-{$paymentType->id}",
                    default => "ay-{$academicYear->id}-type-{$paymentType->id}",
                };

                foreach ($students as $student) {
                    if (in_array($student->id, $existingStudentIds, true)) {
                        continue;
                    }

                    $inserts[] = [
                        'siswa_id' => $student->id,
                        'academic_year_id' => $insertAcademicYearId,
                        'payment_type_id' => $paymentType->id,
                        'payment_bill_rule_id' => $rule->id,
                        'wali_id' => $student->wali_id,
                        'class_id' => $student->class_id,
                        'period_key' => $periodKey,
                        'period_year' => null,
                        'period_month' => null,
                        'period_label' => $periodLabel,
                        'title' => trim($paymentType->nama . ' ' . $titleSuffix),
                        'amount' => (int) ($paymentType->nominal_default ?? $rule->nominal),
                        'due_date' => $dueDate->toDateString(),
                        'status' => $status,
                        'tahun_ajaran' => $insertAcademicYearName,
                        'semester' => $insertSemesterName,
                        'semester_id' => $insertSemesterId,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ];
                }

                foreach (array_chunk($inserts, 500) as $chunk) {
                    PaymentBill::upsert(
                        $chunk,
                        ['payment_bill_rule_id', 'siswa_id', 'period_key'],
                        ['amount', 'title', 'period_label', 'due_date', 'status', 'academic_year_id', 'tahun_ajaran', 'semester_id', 'semester', 'updated_at']
                    );
                    $createdOrTouched += count($chunk);
                }
                continue;
            }

            $all12Months = [7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6];
            $months = !empty($rule->billed_months) ? array_map('intval', $rule->billed_months) : $all12Months;
            $targetSemesterId = $semester?->id ?? $rule->semester_id;
            $targetSemesterName = $semester?->name ?? $rule->semester ?? 'Ganjil';

            $inserts = [];
            $now = now();

            $existingBills = PaymentBill::query()
                ->where('payment_type_id', $paymentType->id)
                ->where('academic_year_id', $academicYear->id)
                ->where('semester_id', $targetSemesterId)
                ->whereNotNull('period_month')
                ->select('siswa_id', 'period_month')
                ->get()
                ->groupBy('siswa_id')
                ->map(fn ($items) => $items->pluck('period_month')->toArray());

            foreach ($students as $student) {
                $existingMonths = $existingBills->get($student->id, []);
                $missingMonths = array_diff($months, $existingMonths);

                foreach ($missingMonths as $month) {
                    $periodYear = $this->academicPeriodYear((int) $academicYear->year_start, (int) $academicYear->year_end, $month);
                    $periodKey = sprintf('%04d-%02d', $periodYear, $month);
                    $periodLabel = $this->monthLabel(Carbon::create($periodYear, $month, 1));
                    $dueDate = $this->dueDateForMonth(Carbon::create($periodYear, $month, 1), $rule->due_day)->toDateString();
                    $status = Carbon::parse($dueDate)->lt($now->startOfDay()) ? 'Terlambat' : 'Belum Lunas';

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
                        'amount' => $this->amountForMonth($paymentType, $rule, (int) $month),
                        'due_date' => $dueDate,
                        'status' => $status,
                        'tahun_ajaran' => $academicYear->name,
                        'semester' => $targetSemesterName,
                        'semester_id' => $targetSemesterId,
                        'academic_year_id' => $academicYear->id,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ];
                }
            }

            foreach (array_chunk($inserts, 500) as $chunk) {
                PaymentBill::upsert(
                    $chunk,
                    ['payment_bill_rule_id', 'siswa_id', 'period_key'],
                    ['amount', 'title', 'period_label', 'due_date', 'status', 'academic_year_id', 'tahun_ajaran', 'semester_id', 'semester', 'updated_at']
                );
                $createdOrTouched += count($chunk);
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
        $bill->loadMissing(['paymentType.periodType', 'siswa:id,nama,nis,kelas,wali_id', 'rule']);
        $monthOrder = $this->monthOrderForPaymentType($bill->paymentType, $bill->semester_id ?: $bill->semester, $bill->rule ?? null);

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

    public function monthOrderForPaymentType(?PaymentType $paymentType = null, mixed $semester = null, ?PaymentBillRule $rule = null): array
    {
        if ($this->usesFullYearMonths($paymentType)) {
            return self::CALENDAR_MONTHS;
        }

        if ($rule && !empty($rule->billed_months)) {
            $allowed = array_map('intval', $rule->billed_months);
            return collect(self::ACADEMIC_MONTHS)
                ->filter(fn (string $label, int $month) => in_array($month, $allowed, true))
                ->all();
        }

        return self::ACADEMIC_MONTHS;
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

                // FIX: Use academicPeriodYear for consistent period_key and period_year
                $activePeriod = app(AcademicPeriodService::class)->active();
                $academicYear = $activePeriod['academic_year'];
                $periodYear = $academicYear ? $this->academicPeriodYear((int) $academicYear->year_start, (int) $academicYear->year_end, $month) : (int) $cursor->year;
                $periodKey = sprintf('%04d-%02d', $periodYear, $month);

                $periods[] = [
                    'period_key' => $periodKey,
                    'period_year' => $periodYear,
                    'period_month' => $month,
                    'period_label' => $this->monthLabel($cursor),
                    'title' => trim($rule->name . ' ' . $this->monthLabel($cursor)),
                    'due_date' => $dueDate->toDateString(),
                ];
                $cursor->addMonthNoOverflow();
            }

            return collect($periods);
        }

        if ($rule->billing_type === 'harian') {
            $cursor = $start->copy()->startOfDay();
            $last = $end->copy()->startOfDay();
            $periods = [];

            while ($cursor->lte($last)) {
                $periods[] = [
                    'period_key' => $cursor->format('Y-m-d'),
                    'period_year' => (int) $cursor->year,
                    'period_month' => (int) $cursor->month,
                    'period_label' => $cursor->format('d-M-Y'),
                    'title' => trim($rule->name . ' ' . $cursor->format('d-M-Y')),
                    'due_date' => $cursor->toDateString(),
                ];
                $cursor->addDay();
            }

            return collect($periods);
        }

        if ($rule->billing_type === 'mingguan') {
            $cursor = $start->copy()->startOfWeek();
            $last = $end->copy()->startOfWeek();
            $periods = [];

            while ($cursor->lte($last)) {
                $weekNumber = $cursor->weekOfYear;
                $periods[] = [
                    'period_key' => $cursor->format('Y') . '-W' . sprintf('%02d', $weekNumber),
                    'period_year' => (int) $cursor->year,
                    'period_month' => (int) $cursor->month,
                    'period_label' => 'Minggu ' . $weekNumber . ' ' . $cursor->format('Y'),
                    'title' => trim($rule->name . ' Minggu ' . $weekNumber . ' ' . $cursor->format('Y')),
                    'due_date' => $cursor->copy()->endOfWeek()->toDateString(),
                ];
                $cursor->addWeek();
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

    /**
     * Sinkronisasi tagihan untuk tipe pembayaran tertentu.
     * 
     * @param PaymentType $paymentType
     * @param int|null $targetSemesterId
     * @return void
     */
    public function syncBillsForPaymentType(PaymentType $paymentType, ?int $targetSemesterId = null): void
    {
        if (!$paymentType->is_billed_to_all) {
            PaymentBill::query()
                ->where('payment_type_id', $paymentType->id)
                ->where(function ($q) {
                    $q->whereNull('status')
                      ->orWhereNotIn('status', ['Lunas', 'Menunggu Verifikasi']);
                })
                ->whereNull('payment_transaction_id')
                ->whereNull('paid_at')
                ->delete();
            return;
        }

        $activePeriod = app(AcademicPeriodService::class)->active();
        $academicYearId = $activePeriod['academic_year_id'] ?? null;
        $semesterId = $targetSemesterId ?: ($activePeriod['semester_id'] ?? null);

        $rule = $this->ensureRuleForPaymentType($paymentType, null, $semesterId ? ['semester_id' => $semesterId] : []);
        $isMonthly = str_contains(strtolower($paymentType->periode ?? ''), 'bulan') 
            || str_contains(strtolower($paymentType->nama), 'spp') 
            || str_contains(strtolower($paymentType->nama), 'syahriyah');

        // Jika dinonaktifkan dari penagihan otomatis seluruh santri (uncheck)
        if (!$paymentType->is_billed_to_all) {
            $deleteUnbilled = PaymentBill::query()
                ->where('payment_type_id', $paymentType->id)
                ->whereIn('status', ['Belum Lunas', 'Terlambat'])
                ->whereDoesntHave('pembayaran');

            if ($academicYearId) {
                $deleteUnbilled->where('academic_year_id', $academicYearId);
            }
            if ($semesterId) {
                $deleteUnbilled->where('semester_id', $semesterId);
            }
            $deleteUnbilled->delete();
            return;
        }

        if ($isMonthly) {
            $all12Months = [7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6];
            $billedMonths = is_array($rule->billed_months) ? array_map('intval', $rule->billed_months) : $all12Months;

            $deleteQuery = PaymentBill::query()
                ->where('payment_type_id', $paymentType->id)
                ->whereNotNull('period_month')
                ->where(function ($q) {
                    $q->whereNull('status')
                      ->orWhereNotIn('status', ['Lunas', 'Menunggu Verifikasi']);
                })
                ->whereNull('payment_transaction_id')
                ->whereNull('paid_at');

            if ($academicYearId) {
                $deleteQuery->where('academic_year_id', $academicYearId);
            }
            if ($semesterId) {
                $deleteQuery->where('semester_id', $semesterId);
            }

            if (empty($billedMonths)) {
                $deleteQuery->delete();
            } else {
                $deleteQuery->whereNotIn('period_month', $billedMonths)->delete();
            }

            // Fast generation for missing checked months (only for monthly bills)
            $this->syncMonthlyBillsForPaymentType($paymentType, $rule);
            return;
        }

        // Handle non-monthly bills (e.g. Kitab, Seragam, Heregistrasi, Umum)
        $this->syncNonMonthlyBillsForPaymentType($paymentType, $rule, $targetSemesterId);
    }

    private function syncNonMonthlyBillsForPaymentType(PaymentType $paymentType, PaymentBillRule $rule, ?int $targetSemesterId = null): void
    {
        $academicYear = AcademicYear::query()->where('is_active', true)->first();
        if (!$academicYear) {
            return;
        }

        $semester = null;
        if ($targetSemesterId) {
            $semester = Semester::query()->find($targetSemesterId);
        } else {
            $semester = Semester::query()->where('academic_year_id', $academicYear->id)->where('is_active', true)->first();
        }

        $periode = strtolower($paymentType->periode ?? 'umum');
        $periodLabel = match($periode) {
            'harian' => 'Harian',
            'mingguan' => 'Mingguan',
            'semesteran' => 'Semesteran',
            'tahunan' => 'Tahunan',
            'sekali' => 'Sekali Bayar',
            default => 'Umum',
        };
        $titleSuffix = $periodLabel === 'Sekali Bayar' ? '(Sekali Bayar)' : "({$periodLabel})";

        $students = Siswa::query()
            ->whereHas('tahunAjaran', function ($q) use ($academicYear, $semester) {
                $q->where('academic_year_id', $academicYear->id)
                  ->where('is_active', true);
                if ($semester) {
                    $q->where('semester_id', $semester->id);
                }
            })
            ->get();

        if ($students->isEmpty()) {
            $students = Siswa::query()
                ->where(function ($q) {
                    $q->where('status', 'Aktif')
                      ->orWhere('student_status_id', app(ReferenceResolver::class)->studentStatusId('Aktif'));
                })
                ->get();
        }

        $existingBills = PaymentBill::query()
            ->where('payment_type_id', $paymentType->id)
            ->whereNull('period_month')
            ->when($periode !== 'sekali', fn ($q) => $q->where('academic_year_id', $academicYear->id))
            ->when($periode === 'semesteran' && $semester, fn ($q) => $q->where('semester_id', $semester->id))
            ->pluck('siswa_id')
            ->toArray();

        $inserts = [];
        $now = now();
        $dueDate = now()->copy();
        if ($rule->due_day) {
            $dueDate = $this->dueDateForMonth(now(), $rule->due_day);
        }
        $status = $dueDate->lt($now->startOfDay()) ? 'Terlambat' : 'Belum Lunas';

        $insertSemesterId = null;
        $insertSemesterName = null;
        $insertAcademicYearId = $academicYear->id;
        $insertAcademicYearName = $academicYear->name;

        if ($periode === 'semesteran' && $semester) {
            $insertSemesterId = $semester->id;
            $insertSemesterName = $semester->name;
        } elseif ($periode === 'sekali') {
            $insertAcademicYearId = null;
            $insertAcademicYearName = null;
        }

        $periodKey = match($periode) {
            'semesteran' => $semester ? "ay-{$academicYear->id}-sem-{$semester->id}" : "ay-{$academicYear->id}-sem",
            'sekali' => "once-{$paymentType->id}",
            default => "ay-{$academicYear->id}-type-{$paymentType->id}",
        };

        foreach ($students as $student) {
            if (!in_array($student->id, $existingBills, true)) {
                $inserts[] = [
                    'payment_bill_rule_id' => $rule->id,
                    'payment_type_id' => $paymentType->id,
                    'siswa_id' => $student->id,
                    'wali_id' => $student->wali_id,
                    'class_id' => $student->class_id,
                    'period_key' => $periodKey,
                    'period_year' => null,
                    'period_month' => null,
                    'period_label' => $periodLabel,
                    'title' => trim($paymentType->nama . ' ' . $titleSuffix),
                    'amount' => (int) ($paymentType->nominal_default ?? $rule->nominal),
                    'due_date' => $dueDate->toDateString(),
                    'status' => $status,
                    'academic_year_id' => $insertAcademicYearId,
                    'tahun_ajaran' => $insertAcademicYearName,
                    'semester_id' => $insertSemesterId,
                    'semester' => $insertSemesterName,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }
        }

        foreach (array_chunk($inserts, 500) as $chunk) {
            PaymentBill::upsert(
                $chunk,
                ['payment_bill_rule_id', 'siswa_id', 'period_key'],
                ['amount', 'title', 'period_label', 'due_date', 'status', 'academic_year_id', 'tahun_ajaran', 'semester_id', 'semester', 'updated_at']
            );
        }

        // Update nominal tagihan yang belum lunas jika diubah
        PaymentBill::query()
            ->where('payment_type_id', $paymentType->id)
            ->where('academic_year_id', $academicYear->id)
            ->whereNull('period_month')
            ->whereIn('status', ['Belum Lunas', 'Terlambat'])
            ->whereDoesntHave('pembayaran')
            ->update([
                'amount' => (int) ($paymentType->nominal_default ?? $rule->nominal),
                'updated_at' => now(),
            ]);
    }

    private function syncMonthlyBillsForPaymentType(PaymentType $paymentType, PaymentBillRule $rule): void
    {
        $academicYear = AcademicYear::query()->with('semesters')->where('is_active', true)->first();
        if (!$academicYear) {
            return;
        }

        $targetSemesterId = $rule->semester_id;
        $targetSemesterName = $rule->semester;
        if (!$targetSemesterId) {
            $activeSemester = $academicYear->semesters->firstWhere('is_active', true);
            $targetSemesterId = $activeSemester?->id;
            $targetSemesterName = $activeSemester?->name ?? 'Ganjil';
        }

        $all12Months = [7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6];
        $billedMonths = !empty($rule->billed_months) ? $rule->billed_months : $all12Months;
        $monthsToBill = array_map('intval', $billedMonths);

        $students = Siswa::query()
            ->whereHas('tahunAjaran', function ($q) use ($academicYear, $targetSemesterId) {
                $q->where('academic_year_id', $academicYear->id)
                  ->where('is_active', true);
                if ($targetSemesterId) {
                    $q->where('semester_id', $targetSemesterId);
                }
            })
            ->get();

        if ($students->isEmpty()) {
            $students = Siswa::query()
                ->where(function ($q) {
                    $q->where('status', 'Aktif')
                      ->orWhere('student_status_id', app(ReferenceResolver::class)->studentStatusId('Aktif'));
                })
                ->get();
        }

        $existingBills = PaymentBill::query()
            ->where('payment_type_id', $paymentType->id)
            ->where('academic_year_id', $academicYear->id)
            ->where('semester_id', $targetSemesterId)
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
                    'amount' => $this->amountForMonth($paymentType, $rule, (int) $month),
                    'due_date' => $dueDate->toDateString(),
                    'status' => $status,
                    'academic_year_id' => $academicYear->id,
                    'tahun_ajaran' => $academicYear->name,
                    'semester_id' => $targetSemesterId,
                    'semester' => $targetSemesterName,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }
        }

        foreach (array_chunk($inserts, 500) as $chunk) {
            PaymentBill::upsert(
                $chunk,
                ['payment_bill_rule_id', 'siswa_id', 'period_key'],
                ['amount', 'title', 'period_label', 'due_date', 'status', 'academic_year_id', 'tahun_ajaran', 'semester_id', 'semester', 'updated_at']
            );
        }

        // Sinkronisasi nominal tagihan yang belum lunas sesuai custom nominal per bulan
        $unpaidBills = PaymentBill::query()
            ->where('payment_type_id', $paymentType->id)
            ->where('academic_year_id', $academicYear->id)
            ->where('semester_id', $targetSemesterId)
            ->whereNotNull('period_month')
            ->whereIn('status', ['Belum Lunas', 'Terlambat'])
            ->whereDoesntHave('pembayaran')
            ->get();

        foreach ($unpaidBills as $unpaidBill) {
            $correctAmount = $this->amountForMonth($paymentType, $rule, (int) $unpaidBill->period_month);
            if ((int) $unpaidBill->amount !== (int) $correctAmount) {
                $unpaidBill->update(['amount' => $correctAmount]);
            }
        }

        // Hapus tagihan yang bulannya di-uncheck HANYA pada semester ini
        $monthsToDelete = array_diff($all12Months, $monthsToBill);

        if (!empty($monthsToDelete)) {
            PaymentBill::query()
                ->where('payment_type_id', $paymentType->id)
                ->where('academic_year_id', $academicYear->id)
                ->where('semester_id', $targetSemesterId)
                ->whereIn('period_month', $monthsToDelete)
                ->where(function ($q) {
                    $q->whereNull('status')
                      ->orWhereNotIn('status', ['Lunas', 'Menunggu Verifikasi']);
                })
                ->whereDoesntHave('pembayaran')
                ->delete();
        }
    }

    public function amountForMonth(?PaymentType $paymentType, ?PaymentBillRule $rule, int $month): int
    {
        $monthAmounts = $rule?->month_amounts ?? $paymentType?->month_amounts ?? [];
        if (is_array($monthAmounts)) {
            if (isset($monthAmounts[$month]) && is_numeric($monthAmounts[$month]) && $monthAmounts[$month] > 0) {
                return (int) $monthAmounts[$month];
            }
            if (isset($monthAmounts[(string) $month]) && is_numeric($monthAmounts[(string) $month]) && $monthAmounts[(string) $month] > 0) {
                return (int) $monthAmounts[(string) $month];
            }
        }

        return (int) ($rule?->nominal ?: ($paymentType?->nominal_default ?? 0));
    }
}
