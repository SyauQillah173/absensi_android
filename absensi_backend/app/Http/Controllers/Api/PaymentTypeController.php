<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PaymentType;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PaymentTypeController extends Controller
{
    private const ALLOWED_METHODS = [
        'Tunai',
        'Transfer Dana',
        'Bank BRI',
        'Bank Mandiri',
        'Bank BSI',
        'Bank BCA',
        'QRIS',
    ];

    public function index(Request $request)
    {
        $query = PaymentType::query()->orderBy('nama');

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        return response()->json([
            'success' => true,
            'data' => $query->get(),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $this->validatePayload($request);

        $paymentType = PaymentType::create($validated);

        return response()->json([
            'success' => true,
            'message' => 'Tipe pembayaran berhasil ditambahkan',
            'data' => $paymentType,
        ], 201);
    }

    public function update(Request $request, PaymentType $paymentType)
    {
        $validated = $this->validatePayload($request, $paymentType->id, false);
        $paymentType->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'Tipe pembayaran berhasil diperbarui',
            'data' => $paymentType->fresh(),
        ]);
    }

    public function destroy(PaymentType $paymentType)
    {
        if ($paymentType->pembayaran()->exists()) {
            return response()->json([
                'success' => false,
                'message' => 'Tipe pembayaran sudah dipakai transaksi dan tidak bisa dihapus',
            ], 422);
        }

        $paymentType->delete();

        return response()->json([
            'success' => true,
            'message' => 'Tipe pembayaran berhasil dihapus',
        ]);
    }

    private function validatePayload(Request $request, ?int $ignoreId = null, bool $requireAll = true): array
    {
        $nameRule = $requireAll ? 'required' : 'sometimes|required';

        return $request->validate([
            'nama' => [
                $nameRule,
                'string',
                'max:255',
                Rule::unique('payment_types', 'nama')->ignore($ignoreId),
            ],
            'deskripsi' => 'nullable|string',
            'nominal_default' => ($requireAll ? 'required' : 'sometimes|required') . '|integer|min:0',
            'periode' => ($requireAll ? 'required' : 'sometimes|required') . '|in:sekali,bulanan,tahunan',
            'metode_pembayaran' => ($requireAll ? 'required' : 'sometimes|required') . '|array|min:1',
            'metode_pembayaran.*' => ['string', Rule::in(self::ALLOWED_METHODS)],
            'status' => ($requireAll ? 'required' : 'sometimes|required') . '|in:Aktif,Nonaktif',
        ]);
    }
}
