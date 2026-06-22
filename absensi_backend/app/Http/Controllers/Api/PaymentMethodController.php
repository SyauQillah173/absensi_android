<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PaymentMethod;
use App\Services\AuditLogService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class PaymentMethodController extends Controller
{
    public function index(Request $request)
    {
        $query = PaymentMethod::query();

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
        $validated['code'] = $validated['code'] ?? $this->code($validated['name']);

        $method = PaymentMethod::query()->create($validated);
        app(AuditLogService::class)->record($request, 'payment_methods', 'create', $method, null, $method->toArray());

        return response()->json([
            'success' => true,
            'message' => 'Metode pembayaran berhasil ditambahkan',
            'data' => $method,
        ], 201);
    }

    public function update(Request $request, PaymentMethod $paymentMethod)
    {
        $validated = $this->validatePayload($request, $paymentMethod->id, false);
        if (array_key_exists('name', $validated) && empty($validated['code'])) {
            $validated['code'] = $paymentMethod->code ?: $this->code($validated['name']);
        }

        $before = $paymentMethod->toArray();
        $paymentMethod->update($validated);
        app(AuditLogService::class)->record($request, 'payment_methods', 'update', $paymentMethod, $before, $paymentMethod->fresh()->toArray());

        return response()->json([
            'success' => true,
            'message' => 'Metode pembayaran berhasil diperbarui',
            'data' => $paymentMethod->fresh(),
        ]);
    }

    public function destroy(Request $request, PaymentMethod $paymentMethod)
    {
        $used = DB::table('pembayaran')->where('payment_method_id', $paymentMethod->id)->exists()
            || DB::table('payment_transactions')->where('payment_method_id', $paymentMethod->id)->exists()
            || DB::table('payment_type_method')->where('payment_method_id', $paymentMethod->id)->exists();

        $before = $paymentMethod->toArray();
        if ($used) {
            $paymentMethod->update(['is_active' => false]);
            $message = 'Metode pembayaran sudah dipakai, jadi dinonaktifkan.';
        } else {
            $paymentMethod->delete();
            $message = 'Metode pembayaran berhasil dihapus.';
        }

        app(AuditLogService::class)->record($request, 'payment_methods', $used ? 'deactivate' : 'delete', $paymentMethod, $before, $used ? $paymentMethod->fresh()?->toArray() : null);

        return response()->json([
            'success' => true,
            'message' => $message,
        ]);
    }

    private function validatePayload(Request $request, ?int $ignoreId = null, bool $requireAll = true): array
    {
        $required = $requireAll ? ['required'] : ['sometimes', 'required'];

        $validated = $request->validate([
            'name' => [...$required, 'string', 'max:255', Rule::unique('payment_methods', 'name')->ignore($ignoreId)],
            'code' => ['nullable', 'string', 'max:80', Rule::unique('payment_methods', 'code')->ignore($ignoreId)],
            'icon' => 'nullable|string|max:80',
            'description' => 'nullable|string',
            'qris_image_path' => 'nullable|string|max:255',
            'is_active' => 'nullable|boolean',
            'sort_order' => 'nullable|integer|min:0|max:65535',
        ]);

        foreach (['name', 'code', 'icon', 'description', 'qris_image_path'] as $field) {
            if (array_key_exists($field, $validated)) {
                $validated[$field] = trim((string) $validated[$field]);
                if ($validated[$field] === '') {
                    $validated[$field] = null;
                }
            }
        }

        if (!empty($validated['code'])) {
            $validated['code'] = $this->code($validated['code']);
        }
        if (!array_key_exists('is_active', $validated)) {
            $validated['is_active'] = true;
        }
        if (!array_key_exists('sort_order', $validated)) {
            $validated['sort_order'] = 100;
        }

        return $validated;
    }

    private function code(string $value): string
    {
        return Str::slug($value, '_') ?: 'metode';
    }
}
