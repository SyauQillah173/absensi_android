<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PaymentPeriodType;
use App\Services\AuditLogService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class PaymentPeriodTypeController extends Controller
{
    public function index(Request $request)
    {
        $query = PaymentPeriodType::query();

        if ($request->has('active')) {
            $query->where('is_active', $request->boolean('active'));
        }
        if ($request->filled('search')) {
            $search = trim((string) $request->input('search'));
            $query->where(function ($builder) use ($search) {
                $builder
                    ->where('name', 'ilike', '%' . $search . '%')
                    ->orWhere('code', 'ilike', '%' . $search . '%');
            });
        }

        return response()->json([
            'success' => true,
            'data' => $query
                ->orderBy('sort_order')
                ->orderBy('name')
                ->get(),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $this->validatePayload($request);
        $validated = $this->normalizeFlags($validated);
        $period = PaymentPeriodType::query()->create($validated);

        app(AuditLogService::class)->record($request, 'payment_period_types', 'create', $period, null, $period->toArray());

        return response()->json([
            'success' => true,
            'message' => 'Periode pembayaran berhasil ditambahkan',
            'data' => $period,
        ], 201);
    }

    public function update(Request $request, PaymentPeriodType $paymentPeriodType)
    {
        $validated = $this->validatePayload($request, $paymentPeriodType->id, false);
        $validated = $this->normalizeFlags($validated, $paymentPeriodType);
        $before = $paymentPeriodType->toArray();
        $paymentPeriodType->update($validated);

        app(AuditLogService::class)->record($request, 'payment_period_types', 'update', $paymentPeriodType, $before, $paymentPeriodType->fresh()->toArray());

        return response()->json([
            'success' => true,
            'message' => 'Periode pembayaran berhasil diperbarui',
            'data' => $paymentPeriodType->fresh(),
        ]);
    }

    public function destroy(Request $request, PaymentPeriodType $paymentPeriodType)
    {
        $used = DB::table('payment_types')->where('payment_period_type_id', $paymentPeriodType->id)->exists();
        $before = $paymentPeriodType->toArray();

        if ($used) {
            $paymentPeriodType->update(['is_active' => false]);
            $message = 'Periode pembayaran sudah dipakai, jadi dinonaktifkan.';
        } else {
            $paymentPeriodType->delete();
            $message = 'Periode pembayaran berhasil dihapus.';
        }

        app(AuditLogService::class)->record($request, 'payment_period_types', $used ? 'deactivate' : 'delete', $paymentPeriodType, $before, $used ? $paymentPeriodType->fresh()?->toArray() : null);

        return response()->json([
            'success' => true,
            'message' => $message,
        ]);
    }

    private function validatePayload(Request $request, ?int $ignoreId = null, bool $requireAll = true): array
    {
        $required = $requireAll ? ['required'] : ['sometimes', 'required'];

        $validated = $request->validate([
            'name' => [...$required, 'string', 'max:255', Rule::unique('payment_period_types', 'name')->ignore($ignoreId)],
            'code' => ['nullable', 'string', 'max:80', Rule::unique('payment_period_types', 'code')->ignore($ignoreId)],
            'description' => 'nullable|string',
            'is_monthly' => 'nullable|boolean',
            'is_daily' => 'nullable|boolean',
            'is_general' => 'nullable|boolean',
            'uses_month' => 'nullable|boolean',
            'uses_semester' => 'nullable|boolean',
            'month_mode' => 'nullable|in:semester,full_year',
            'needs_due_day' => 'nullable|boolean',
            'due_day' => 'nullable|integer|between:1,31',
            'is_active' => 'nullable|boolean',
            'sort_order' => 'nullable|integer|min:0|max:65535',
        ]);

        foreach (['name', 'code', 'description'] as $field) {
            if (array_key_exists($field, $validated)) {
                $validated[$field] = trim((string) $validated[$field]);
                if ($validated[$field] === '') {
                    $validated[$field] = null;
                }
            }
        }
        if (!empty($validated['code'])) {
            $validated['code'] = Str::slug($validated['code'], '_') ?: null;
        } elseif (!empty($validated['name'])) {
            $validated['code'] = Str::slug($validated['name'], '_') ?: null;
        }

        return $validated;
    }

    private function normalizeFlags(array $payload, ?PaymentPeriodType $existing = null): array
    {
        $code = strtolower((string) ($payload['code'] ?? $existing?->code ?? ''));
        $isMonthly = (bool) ($payload['is_monthly'] ?? $existing?->is_monthly ?? $code === 'bulanan');
        $isDaily = (bool) ($payload['is_daily'] ?? $existing?->is_daily ?? $code === 'harian');
        $isGeneral = (bool) ($payload['is_general'] ?? $existing?->is_general ?? $code === 'umum');

        $payload['is_monthly'] = $isMonthly;
        $payload['is_daily'] = $isDaily;
        $payload['is_general'] = $isGeneral;
        $payload['uses_month'] = (bool) ($payload['uses_month'] ?? $existing?->uses_month ?? $isMonthly);
        $payload['uses_semester'] = (bool) ($payload['uses_semester'] ?? $existing?->uses_semester ?? in_array($code, ['bulanan', 'semesteran', 'umum'], true));
        $payload['needs_due_day'] = (bool) ($payload['needs_due_day'] ?? $existing?->needs_due_day ?? $isMonthly);
        $payload['month_mode'] = $payload['month_mode'] ?? $existing?->month_mode ?? ($isMonthly ? 'semester' : 'semester');
        $payload['due_day'] = $payload['needs_due_day'] ? ($payload['due_day'] ?? $existing?->due_day ?? 10) : null;
        $payload['is_active'] = (bool) ($payload['is_active'] ?? $existing?->is_active ?? true);
        $payload['sort_order'] = (int) ($payload['sort_order'] ?? $existing?->sort_order ?? 100);

        return $payload;
    }
}
