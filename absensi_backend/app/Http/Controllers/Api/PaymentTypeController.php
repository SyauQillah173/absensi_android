<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PaymentPeriodType;
use App\Models\PaymentType;
use App\Services\ActorResolver;
use App\Services\AuditLogService;
use App\Services\PaymentBillService;
use App\Services\ReferenceResolver;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class PaymentTypeController extends Controller
{
    public function index(Request $request)
    {
        $query = PaymentType::query()->with(['billRules', 'periodType', 'paymentMethods'])->orderBy('nama');

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }
        if ($request->filled('payment_period_type_id')) {
            $query->where('payment_period_type_id', $request->integer('payment_period_type_id'));
        } elseif ($request->filled('periode')) {
            $periodId = app(ReferenceResolver::class)->paymentPeriodTypeId($request->periode);
            $periodId ? $query->where('payment_period_type_id', $periodId) : $query->whereRaw('1 = 0');
        }

        return response()->json([
            'success' => true,
            'data' => $query->get(),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $this->validatePayload($request);
        $ruleOptions = $this->billRuleOptions($validated);
        $payload = $this->paymentTypePayload($validated);

        $paymentType = PaymentType::create($payload);
        app(PaymentBillService::class)->ensureRuleForPaymentType(
            $paymentType,
            app(ActorResolver::class)->active($request)?->id,
            $ruleOptions
        );
        app(PaymentBillService::class)->syncBillsForPaymentType($paymentType->fresh());
        app(AuditLogService::class)->record($request, 'payment_types', 'create', $paymentType, null, $paymentType->fresh(['billRules'])->toArray());

        return response()->json([
            'success' => true,
            'message' => 'Tipe pembayaran berhasil ditambahkan',
            'data' => $paymentType->fresh(['billRules']),
        ], 201);
    }

    public function update(Request $request, PaymentType $paymentType)
    {
        try {
            $validated = $this->validatePayload($request, $paymentType->id, false);
            $ruleOptions = $this->billRuleOptions($validated);
            
            $before = $paymentType->load('billRules')->toArray();
            $targetSemesterId = $validated['target_semester_id'] ?? null;
            
            DB::transaction(function () use ($request, $paymentType, $validated, $ruleOptions, $targetSemesterId) {
                if ($targetSemesterId) {
                    $activePeriod = app(\App\Services\AcademicPeriodService::class)->active();
                    if ($activePeriod) {
                        $rule = \App\Models\PaymentBillRule::query()
                            ->where('payment_type_id', $paymentType->id)
                            ->where('semester_id', $targetSemesterId)
                            ->first();
                        
                        if ($rule) {
                            $rule->update([
                                'nominal' => $ruleOptions['nominal'] ?? $rule->nominal,
                                'billed_months' => $ruleOptions['billed_months'] ?? $rule->billed_months,
                                'is_active' => $ruleOptions['is_active'] ?? $rule->is_active,
                            ]);
                        } else {
                            app(PaymentBillService::class)->ensureRuleForPaymentType(
                                $paymentType,
                                app(ActorResolver::class)->active($request)?->id,
                                array_merge($ruleOptions, ['semester_id' => $targetSemesterId])
                            );
                        }
                    }
                    
                    $payload = collect($this->paymentTypePayload($validated))
                        ->except(['nominal_default'])
                        ->all();
                    $paymentType->update($payload);
                } else {
                    $paymentType->update($this->paymentTypePayload($validated));
                    app(PaymentBillService::class)->ensureRuleForPaymentType(
                        $paymentType->fresh(),
                        app(ActorResolver::class)->active($request)?->id,
                        $ruleOptions
                    );
                }

                app(PaymentBillService::class)->syncBillsForPaymentType($paymentType->fresh(), $targetSemesterId);
            });

            app(AuditLogService::class)->record($request, 'payment_types', 'update', $paymentType, $before, $paymentType->fresh(['billRules'])->toArray());

            return response()->json([
                'success' => true,
                'message' => 'Tipe pembayaran berhasil diperbarui',
                'data' => $paymentType->fresh(['billRules']),
            ]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->validator->errors()->first() ?: 'Validasi gagal',
                'errors' => $e->validator->errors(),
            ], 422);
        } catch (\Throwable $e) {
            Log::error('PaymentType update failed: ' . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            return response()->json([
                'success' => false,
                'message' => 'Gagal memperbarui tipe pembayaran: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function destroy(Request $request, PaymentType $paymentType)
    {
        if ($paymentType->pembayaran()->exists()) {
            return response()->json([
                'success' => false,
                'message' => 'Tipe pembayaran sudah dipakai transaksi dan tidak bisa dihapus',
            ], 422);
        }
        if ($paymentType->bills()->exists()) {
            return response()->json([
                'success' => false,
                'message' => 'Tipe pembayaran sudah memiliki tagihan dan tidak bisa dihapus. Nonaktifkan tipe pembayaran jika tidak digunakan lagi.',
            ], 422);
        }

        $before = $paymentType->toArray();
        $paymentType->delete();
        app(AuditLogService::class)->record($request, 'payment_types', 'delete', $paymentType, $before, null);

        return response()->json([
            'success' => true,
            'message' => 'Tipe pembayaran berhasil dihapus',
        ]);
    }

    private function validatePayload(Request $request, ?int $ignoreId = null, bool $requireAll = true): array
    {
        $requiredRules = $requireAll ? ['required'] : ['sometimes', 'required'];

        $validated = $request->validate([
            'nama' => [
                ...$requiredRules,
                'string',
                'max:255',
                Rule::unique('payment_types', 'nama')->ignore($ignoreId),
            ],
            'deskripsi' => 'nullable|string',
            'nominal_default' => [...$requiredRules, 'integer', 'min:0'],
            'periode' => [...$requiredRules, 'string', 'max:40'],
            'payment_period_type_id' => 'nullable|integer|exists:payment_period_types,id',
            'metode_pembayaran' => [...$requiredRules, 'array', 'min:1'],
            'metode_pembayaran.*' => ['string', 'max:255', Rule::exists('payment_methods', 'name')->where('is_active', true)],
            'status' => [...$requiredRules, 'in:Aktif,Nonaktif'],
            'is_billed_to_all' => 'nullable|boolean',
            'billed_months' => 'nullable|array',
            'billed_months.*' => 'integer|between:1,12',
            'due_day' => 'nullable|integer|between:1,31',
            'target_type' => 'nullable|in:all,class,student',
            'class_id' => 'nullable|integer|exists:classes,id',
            'student_ids' => 'nullable|array',
            'student_ids.*' => 'integer|exists:siswa,id',
            'starts_on' => 'nullable|date',
            'ends_on' => 'nullable|date|after_or_equal:starts_on',
            'notification_settings' => 'nullable|array',
            'target_semester_id' => 'nullable|integer',
        ]);

        if (isset($validated['periode'])) {
            $validated['periode'] = strtolower(trim($validated['periode']));
            $validated['payment_period_type_id'] = $validated['payment_period_type_id']
                ?? $this->ensurePaymentPeriodType($validated['periode'])->id;
            $period = PaymentPeriodType::query()->find($validated['payment_period_type_id']);
            if (!$period || !$period->is_active) {
                throw ValidationException::withMessages([
                    'periode' => ['Periode pembayaran sedang nonaktif.'],
                ]);
            }
            $validated['periode'] = app(ReferenceResolver::class)->paymentPeriodTypeCode($validated['payment_period_type_id'])
                ?? $validated['periode'];
        }

        return $validated;
    }

    private function paymentTypePayload(array $validated): array
    {
        return collect($validated)
            ->only(['nama', 'deskripsi', 'nominal_default', 'periode', 'payment_period_type_id', 'metode_pembayaran', 'status', 'is_billed_to_all', 'billed_months'])
            ->all();
    }

    private function billRuleOptions(array $validated): array
    {
        $billingType = $validated['periode'] ?? null;

        return [
            'name' => $validated['nama'] ?? null,
            'nominal' => $validated['nominal_default'] ?? null,
            'billing_type' => $billingType,
            'due_day' => $billingType === 'bulanan'
                ? ($validated['due_day'] ?? PaymentPeriodType::query()->find($validated['payment_period_type_id'] ?? null)?->due_day ?? 10)
                : null,
            'target_type' => $validated['target_type'] ?? 'all',
            'class_id' => $validated['class_id'] ?? null,
            'student_ids' => $validated['student_ids'] ?? [],
            'billed_months' => $validated['billed_months'] ?? null,
            'starts_on' => $validated['starts_on'] ?? null,
            'ends_on' => $validated['ends_on'] ?? null,
            'is_active' => ($validated['status'] ?? 'Aktif') === 'Aktif',
            'notification_settings' => $validated['notification_settings'] ?? null,
        ];
    }

    private function ensurePaymentPeriodType(string $code): PaymentPeriodType
    {
        $name = collect(explode('_', str_replace('-', '_', $code)))
            ->filter()
            ->map(fn ($part) => ucfirst($part))
            ->implode(' ');

        return PaymentPeriodType::query()->firstOrCreate(
            ['code' => $code],
            [
                'name' => $name ?: ucfirst($code),
                'is_monthly' => $code === 'bulanan',
                'is_daily' => $code === 'harian',
                'is_general' => $code === 'umum',
                'needs_due_day' => $code === 'bulanan',
                'is_active' => true,
            ]
        );
    }
}
