<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AcademicYear;
use App\Models\PaymentBill;
use App\Models\PaymentTransaction;
use App\Models\PaymentVerification;
use App\Models\Pembayaran;
use App\Models\Siswa;
use App\Services\PaymentBillService;
use App\Services\ReferenceResolver;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class PaymentVerificationController extends Controller
{
    public function __construct(
        private readonly PaymentBillService $billService,
    ) {
    }

    /**
     * GET /api/wali/pembayaran/verifikasi?siswa_id=X
     * Mengambil daftar bukti transfer yang diunggah oleh wali santri.
     */
    public function indexWali(Request $request)
    {
        $request->validate([
            'siswa_id' => 'required|integer|exists:siswa,id',
        ]);

        $wali = $request->user();
        $siswa = Siswa::where('id', (int) $request->siswa_id)
            ->where(function ($query) use ($wali) {
                $query->where('wali_id', $wali?->id)
                    ->orWhereHas('guardianProfile', fn ($nested) => $nested->where('user_id', $wali?->id));
            })
            ->first();

        if (!$siswa) {
            return response()->json([
                'success' => false,
                'message' => 'Anda tidak memiliki akses ke data santri ini.',
            ], 403);
        }

        $verifications = PaymentVerification::query()
            ->with(['verifier:id,name,role', 'paymentTransaction:id,kode_transaksi'])
            ->where('siswa_id', $siswa->id)
            ->orderByDesc('id')
            ->get()
            ->map(function (PaymentVerification $item) {
                return $this->formatVerification($item);
            });

        return response()->json([
            'success' => true,
            'data' => $verifications,
        ]);
    }

    /**
     * POST /api/wali/pembayaran/verifikasi
     * Wali mengunggah bukti transfer pembayaran dan memilih tagihan yang dibayar.
     */
    public function storeWali(Request $request)
    {
        $request->validate([
            'siswa_id' => 'required|integer|exists:siswa,id',
            'tanggal_transfer' => 'required|date',
            'bank_pengirim' => 'nullable|string|max:50',
            'nama_pengirim' => 'nullable|string|max:100',
            'nomor_rekening_pengirim' => 'nullable|string|max:50',
            'catatan_wali' => 'nullable|string|max:500',
            'selected_bills' => 'required',
            'file' => 'required|file|mimes:jpg,jpeg,png,webp,pdf|max:5120',
        ]);

        $wali = $request->user();
        $siswa = Siswa::where('id', (int) $request->siswa_id)
            ->where(function ($query) use ($wali) {
                $query->where('wali_id', $wali?->id)
                    ->orWhereHas('guardianProfile', fn ($nested) => $nested->where('user_id', $wali?->id));
            })
            ->first();

        if (!$siswa) {
            return response()->json([
                'success' => false,
                'message' => 'Anda tidak memiliki otorisasi untuk santri ini.',
            ], 403);
        }

        // Parse selected_bills
        $selectedBills = $request->input('selected_bills');
        if (is_string($selectedBills)) {
            $selectedBills = json_decode($selectedBills, true);
        }

        if (!is_array($selectedBills) || empty($selectedBills)) {
            throw ValidationException::withMessages([
                'selected_bills' => ['Pilih minimal satu pos tagihan yang ingin dibayar.'],
            ]);
        }

        // Calculate total nominal
        $totalNominal = 0;
        $sanitizedBills = [];
        foreach ($selectedBills as $b) {
            $amount = (int) ($b['amount'] ?? $b['nominal'] ?? 0);
            $totalNominal += $amount;
            $sanitizedBills[] = [
                'id' => $b['id'] ?? null,
                'title' => $b['title'] ?? $b['nama'] ?? 'Tagihan',
                'amount' => $amount,
                'payment_type_id' => $b['payment_type_id'] ?? null,
                'period_month' => $b['period_month'] ?? null,
                'period_year' => $b['period_year'] ?? null,
                'tahun_ajaran' => $b['tahun_ajaran'] ?? null,
            ];
        }

        if ($totalNominal <= 0) {
            throw ValidationException::withMessages([
                'selected_bills' => ['Total nominal pembayaran harus lebih besar dari 0.'],
            ]);
        }

        // Store file safely
        $file = $request->file('file');
        $path = $file->store('bukti_transfer', 'public');

        $activeYear = AcademicYear::where('is_active', true)->first();
        $tahunAjaran = $sanitizedBills[0]['tahun_ajaran'] ?? $activeYear?->name ?? '2025/2026';
        $academicYearId = $activeYear?->id;

        $kodePengajuan = 'TRF-' . date('Ymd') . '-' . strtoupper(Str::random(5));

        $verification = PaymentVerification::create([
            'kode_pengajuan' => $kodePengajuan,
            'siswa_id' => $siswa->id,
            'wali_id' => $wali?->id ?: $siswa->wali_id,
            'academic_year_id' => $academicYearId,
            'tahun_ajaran' => $tahunAjaran,
            'total_nominal' => $totalNominal,
            'bank_pengirim' => $request->input('bank_pengirim') ?: 'BSI / Transfer Bank',
            'nama_pengirim' => $request->input('nama_pengirim') ?: ($wali?->name ?: $siswa->nama_wali ?: 'Wali Santri'),
            'nomor_rekening_pengirim' => $request->input('nomor_rekening_pengirim'),
            'bank_tujuan' => 'BSI Syariah',
            'nomor_rekening_tujuan' => '7171 2026 88',
            'tanggal_transfer' => $request->input('tanggal_transfer'),
            'bukti_foto' => $path,
            'catatan_wali' => $request->input('catatan_wali'),
            'selected_bills' => $sanitizedBills,
            'status' => 'menunggu',
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Bukti transfer berhasil diunggah dan sedang menunggu verifikasi oleh bendahara.',
            'data' => $this->formatVerification($verification),
        ], 201);
    }

    /**
     * GET /api/pembayaran/verifikasi
     * Mengambil daftar bukti transfer untuk Admin & Bendahara.
     */
    public function indexAdmin(Request $request)
    {
        $status = $request->input('status');
        $search = $request->input('search');

        $query = PaymentVerification::query()
            ->with([
                'siswa:id,nama,nis,kelas,wali_id',
                'wali:id,name,email,no_hp',
                'verifier:id,name,role',
                'paymentTransaction:id,kode_transaksi',
            ]);

        if ($status && $status !== 'all') {
            $query->where('status', $status);
        }

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('kode_pengajuan', 'like', "%{$search}%")
                    ->orWhere('nama_pengirim', 'like', "%{$search}%")
                    ->orWhereHas('siswa', function ($sq) use ($search) {
                        $sq->where('nama', 'like', "%{$search}%")
                            ->orWhere('nis', 'like', "%{$search}%");
                    });
            });
        }

        $pendingCount = PaymentVerification::where('status', 'menunggu')->count();
        $approvedCount = PaymentVerification::where('status', 'disetujui')->count();
        $rejectedCount = PaymentVerification::where('status', 'ditolak')->count();

        $verifications = $query->orderByDesc('id')
            ->paginate($request->integer('per_page', 30))
            ->through(fn ($item) => $this->formatVerification($item));

        return response()->json([
            'success' => true,
            'counts' => [
                'menunggu' => $pendingCount,
                'disetujui' => $approvedCount,
                'ditolak' => $rejectedCount,
                'total' => $pendingCount + $approvedCount + $rejectedCount,
            ],
            'data' => $verifications->items(),
            'pagination' => [
                'current_page' => $verifications->currentPage(),
                'last_page' => $verifications->lastPage(),
                'per_page' => $verifications->perPage(),
                'total' => $verifications->total(),
            ],
        ]);
    }

    /**
     * POST /api/pembayaran/verifikasi/{id}/approve
     * Bendahara / Admin menyetujui bukti transfer dan otomatis mencatat pembayaran ke sistem keuangan.
     */
    public function approve(Request $request, $id)
    {
        $actor = $request->user();
        $verification = PaymentVerification::with(['siswa.wali'])->findOrFail($id);

        if ($verification->status !== 'menunggu') {
            return response()->json([
                'success' => false,
                'message' => "Bukti transfer ini sudah diproses sebelumnya dengan status: {$verification->status}.",
            ], 422);
        }

        $catatanPetugas = $request->input('catatan', 'Disetujui via Verifikasi Online Transfer');

        $transaction = DB::transaction(function () use ($actor, $verification, $catatanPetugas) {
            $siswa = $verification->siswa;
            $total = (int) $verification->total_nominal;
            $selectedBills = $verification->selected_bills ?: [];

            // 1. Create PaymentTransaction
            $kodeTransaksi = 'TRX-' . date('YmdHis') . '-' . rand(100, 999);
            $paymentTransaction = PaymentTransaction::create([
                'kode_transaksi' => $kodeTransaksi,
                'siswa_id' => $siswa->id,
                'wali_id' => $verification->wali_id ?: $siswa->wali_id,
                'created_by_user_id' => $actor->id,
                'updated_by_user_id' => $actor->id,
                'atas_nama' => $verification->nama_pengirim ?: ($siswa->wali?->name ?: 'Wali Santri'),
                'via' => 'Transfer Dana',
                'jumlah_total' => $total,
                'total_item' => count($selectedBills),
                'tanggal' => $verification->tanggal_transfer ? $verification->tanggal_transfer->toDateString() : now()->toDateString(),
                'status' => 'Lunas',
                'keterangan' => "ACC Transfer Online: {$verification->kode_pengajuan}. {$catatanPetugas}",
            ]);

            // 2. Process each bill & create Pembayaran records
            $order = 1;
            foreach ($selectedBills as $b) {
                $billId = $b['id'] ?? null;
                $amount = (int) ($b['amount'] ?? 0);
                $typeId = $b['payment_type_id'] ?? null;

                $paymentBill = null;
                if ($billId) {
                    $paymentBill = PaymentBill::find($billId);
                    if ($paymentBill) {
                        $paymentBill->update([
                            'status' => 'Lunas',
                            'paid_at' => now(),
                            'payment_transaction_id' => $paymentTransaction->id,
                        ]);
                        $typeId = $typeId ?: $paymentBill->payment_type_id;
                    }
                }

                Pembayaran::create([
                    'payment_transaction_id' => $paymentTransaction->id,
                    'sort_order' => $order++,
                    'siswa_id' => $siswa->id,
                    'payment_type_id' => $typeId,
                    'payment_bill_id' => $paymentBill?->id,
                    'wali_id' => $verification->wali_id ?: $siswa->wali_id,
                    'atas_nama' => $verification->nama_pengirim ?: 'Wali Santri',
                    'via' => 'Transfer Dana',
                    'jumlah' => $amount,
                    'tanggal' => $verification->tanggal_transfer ? $verification->tanggal_transfer->toDateString() : now()->toDateString(),
                    'status' => 'Lunas',
                    'academic_year_id' => $verification->academic_year_id,
                    'tahun_ajaran' => $verification->tahun_ajaran,
                    'keterangan' => ($b['title'] ?? 'Pos Pembayaran') . " [ACC Online #{$verification->kode_pengajuan}]",
                ]);
            }

            // 3. Reconcile student bills
            $this->billService->reconcilePaidBillsForStudent((int) $siswa->id);

            // 4. Update Verification record
            $verification->update([
                'status' => 'disetujui',
                'catatan_petugas' => $catatanPetugas,
                'verified_by_user_id' => $actor->id,
                'verified_at' => now(),
                'payment_transaction_id' => $paymentTransaction->id,
            ]);

            return $paymentTransaction;
        });

        return response()->json([
            'success' => true,
            'message' => 'Bukti transfer berhasil disetujui! Pembayaran telah dicatat dan tagihan santri otomatis lunas.',
            'transaction' => $transaction,
            'verification' => $this->formatVerification($verification->fresh()),
        ]);
    }

    /**
     * POST /api/pembayaran/verifikasi/{id}/reject
     * Bendahara / Admin menolak bukti transfer dengan menyertakan alasan.
     */
    public function reject(Request $request, $id)
    {
        $request->validate([
            'alasan' => 'required|string|max:500',
        ]);

        $actor = $request->user();
        $verification = PaymentVerification::findOrFail($id);

        if ($verification->status !== 'menunggu') {
            return response()->json([
                'success' => false,
                'message' => "Bukti transfer ini sudah diproses sebelumnya dengan status: {$verification->status}.",
            ], 422);
        }

        $verification->update([
            'status' => 'ditolak',
            'catatan_petugas' => $request->input('alasan'),
            'verified_by_user_id' => $actor->id,
            'verified_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Bukti transfer berhasil ditolak. Alasan penolakan telah dikirimkan ke wali santri.',
            'verification' => $this->formatVerification($verification->fresh()),
        ]);
    }

    private function formatVerification(PaymentVerification $item): array
    {
        return [
            'id' => $item->id,
            'kode_pengajuan' => $item->kode_pengajuan,
            'siswa_id' => $item->siswa_id,
            'siswa' => $item->siswa ? [
                'id' => $item->siswa->id,
                'nama' => $item->siswa->nama,
                'nis' => $item->siswa->nis,
                'kelas' => $item->siswa->kelas,
            ] : null,
            'wali_id' => $item->wali_id,
            'wali' => $item->wali ? [
                'id' => $item->wali->id,
                'name' => $item->wali->name,
                'no_hp' => $item->wali->no_hp,
            ] : null,
            'academic_year_id' => $item->academic_year_id,
            'tahun_ajaran' => $item->tahun_ajaran,
            'total_nominal' => (int) $item->total_nominal,
            'bank_pengirim' => $item->bank_pengirim,
            'nama_pengirim' => $item->nama_pengirim,
            'nomor_rekening_pengirim' => $item->nomor_rekening_pengirim,
            'bank_tujuan' => $item->bank_tujuan,
            'nomor_rekening_tujuan' => $item->nomor_rekening_tujuan,
            'tanggal_transfer' => $item->tanggal_transfer ? $item->tanggal_transfer->toDateString() : null,
            'bukti_foto' => $item->bukti_foto,
            'bukti_url' => asset('storage/' . $item->bukti_foto),
            'catatan_wali' => $item->catatan_wali,
            'selected_bills' => $item->selected_bills ?: [],
            'status' => $item->status,
            'catatan_petugas' => $item->catatan_petugas,
            'verified_by_user_id' => $item->verified_by_user_id,
            'verifier_name' => $item->verifier?->name,
            'verified_at' => $item->verified_at ? $item->verified_at->toDateTimeString() : null,
            'payment_transaction_id' => $item->payment_transaction_id,
            'kode_transaksi' => $item->paymentTransaction?->kode_transaksi,
            'created_at' => $item->created_at ? $item->created_at->toDateTimeString() : null,
        ];
    }
}
