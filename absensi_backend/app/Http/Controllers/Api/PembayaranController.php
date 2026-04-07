<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Pembayaran;
use App\Models\PaymentType;
use App\Models\Siswa;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class PembayaranController extends Controller
{
    private const LEGACY_PAYMENT_TYPES = [
        'SPP Bulanan',
        'Ujian Semester',
        'Buku & Kitab',
        'Daftar Ulang',
        'Lainnya',
    ];

    private const PAYMENT_METHODS = [
        'Transfer Dana',
        'Bank BRI',
        'Bank Mandiri',
        'Bank BSI',
        'Bank BCA',
        'QRIS',
        'Tunai',
    ];

    public function index(Request $request)
    {
        $query = Pembayaran::with(['siswa.wali', 'wali', 'paymentType']);

        if ($request->has('tanggal')) {
            $query->where('tanggal', $request->tanggal);
        }
        if ($request->has('jenis')) {
            $query->where('jenis', $request->jenis);
        }
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }
        if ($request->has('siswa_id')) {
            $query->where('siswa_id', $request->siswa_id);
        }
        // If 'semua' is set, don't filter by date
        if (!$request->has('semua') && !$request->has('tanggal') && !$request->has('siswa_id')) {
            $query->where('tanggal', now()->toDateString());
        }

        $data = $query->orderBy('created_at', 'desc')->get();

        return response()->json([
            'success' => true,
            'total_hari_ini' => $data->sum('jumlah'),
            'jumlah_transaksi' => $data->count(),
            'data' => $data,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'siswa_id' => 'required|exists:siswa,id',
            'payment_type_id' => 'nullable|exists:payment_types,id',
            'atas_nama' => 'nullable|string',
            'jenis' => 'nullable|string|max:255',
            'via' => ['required', Rule::in(self::PAYMENT_METHODS)],
            'jumlah' => 'required|integer|min:0',
            'tanggal' => 'required|date',
            'status' => 'required|in:Lunas,Belum Lunas,Menunggu',
            'periode_mulai' => 'nullable|string',
            'periode_selesai' => 'nullable|string',
            'keterangan' => 'nullable|string',
        ]);

        $payload = $this->buildPayload($validated);

        $pembayaran = Pembayaran::create($payload);

        return response()->json([
            'success' => true,
            'message' => 'Pembayaran berhasil dicatat',
            'data' => $pembayaran->load(['siswa.wali', 'wali', 'paymentType']),
        ], 201);
    }

    public function show(Pembayaran $pembayaran)
    {
        return response()->json([
            'success' => true,
            'data' => $pembayaran->load(['siswa.wali', 'wali', 'paymentType']),
        ]);
    }

    public function update(Request $request, Pembayaran $pembayaran)
    {
        $validated = $request->validate([
            'siswa_id' => 'sometimes|required|exists:siswa,id',
            'payment_type_id' => 'nullable|exists:payment_types,id',
            'atas_nama' => 'sometimes|string',
            'jenis' => 'sometimes|nullable|string|max:255',
            'via' => ['sometimes', 'required', Rule::in(self::PAYMENT_METHODS)],
            'jumlah' => 'sometimes|integer|min:0',
            'tanggal' => 'sometimes|date',
            'status' => 'sometimes|in:Lunas,Belum Lunas,Menunggu',
            'periode_mulai' => 'nullable|string',
            'periode_selesai' => 'nullable|string',
            'keterangan' => 'nullable|string',
        ]);

        $payload = $this->buildPayload($validated, $pembayaran);
        $pembayaran->update($payload);

        return response()->json([
            'success' => true,
            'message' => 'Pembayaran berhasil diupdate',
            'data' => $pembayaran->load(['siswa.wali', 'wali', 'paymentType']),
        ]);
    }

    public function destroy(Pembayaran $pembayaran)
    {
        $pembayaran->delete();

        return response()->json([
            'success' => true,
            'message' => 'Pembayaran berhasil dihapus',
        ]);
    }

    private function buildPayload(array $validated, ?Pembayaran $existing = null): array
    {
        $siswaId = $validated['siswa_id'] ?? $existing?->siswa_id;
        $siswa = Siswa::with('wali')->findOrFail($siswaId);

        $paymentTypeId = array_key_exists('payment_type_id', $validated)
            ? $validated['payment_type_id']
            : $existing?->payment_type_id;
        $paymentType = $paymentTypeId ? PaymentType::findOrFail($paymentTypeId) : null;

        if ($paymentType) {
            $allowedMethods = $paymentType->metode_pembayaran ?? [];
            if (!empty($allowedMethods) && !in_array($validated['via'] ?? $existing?->via, $allowedMethods, true)) {
                throw ValidationException::withMessages([
                    'via' => ['Metode pembayaran tidak didukung oleh tipe pembayaran ini'],
                ]);
            }
        }

        $atasNama = $siswa->wali?->name
            ?? $siswa->nama_wali
            ?? $validated['atas_nama']
            ?? $existing?->atas_nama
            ?? 'Wali Santri';

        return array_merge($validated, [
            'siswa_id' => $siswa->id,
            'wali_id' => $siswa->wali_id,
            'atas_nama' => $atasNama,
            'jenis' => $this->resolveJenisForStorage(
                $paymentType,
                $validated['jenis'] ?? $existing?->jenis
            ),
            'payment_type_id' => $paymentType?->id,
        ]);
    }

    private function resolveJenisForStorage(?PaymentType $paymentType, ?string $jenis): string
    {
        $resolved = $paymentType?->nama ?? $jenis ?? 'Lainnya';

        if (in_array($resolved, self::LEGACY_PAYMENT_TYPES, true)) {
            return $resolved;
        }

        return 'Lainnya';
    }
}
