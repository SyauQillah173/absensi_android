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
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
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
        // 🤖 Sistem Cerdas Otomatis (Autonomous Background Cleaner):
        // Jika sudah ada file bukti > 60 hari yang lunas/ditolak, otomatis dibersihkan
        // tanpa admin perlu hapus manual! (Maksimal diperiksa 1x per 24 jam).
        self::autoPurgeIfDue(60);

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

    /**
     * 🤖 SISTEM CERDAS MANDIRI (AUTONOMOUS BACKGROUND CLEANER):
     * Otomatis membersihkan file fisik dari disk storage & mengosongkan kolom bukti_foto
     * di database menjadi NULL tanpa sisa untuk rekaman > 60 hari.
     * Berjalan otomatis tanpa admin harus klik manual. Dibatasi 1x per 24 jam via cache lock.
     */
    public static function autoPurgeIfDue(int $days = 60): void
    {
        $cacheKey = 'finance_proof_autopurge_last_run';
        if (Cache::has($cacheKey)) {
            return;
        }

        // Tandai cache selama 24 jam agar tidak memeriksa di setiap request
        Cache::put($cacheKey, now()->toDateTimeString(), now()->addHours(24));

        try {
            $thresholdDate = now()->subDays($days);
            $candidates = PaymentVerification::query()
                ->whereIn('status', ['disetujui', 'ditolak'])
                ->where(function ($q) use ($thresholdDate) {
                    $q->where('updated_at', '<=', $thresholdDate)
                      ->orWhere('verified_at', '<=', $thresholdDate);
                })
                ->whereNotNull('bukti_foto')
                ->where('bukti_foto', '!=', '')
                ->where('bukti_foto', '!=', 'purged')
                ->get();

            foreach ($candidates as $item) {
                $path = $item->bukti_foto;
                if ($path && Storage::disk('public')->exists($path)) {
                    Storage::disk('public')->delete($path);
                }
                // Bersihkan total tanpa sisa di database (set NULL)
                $item->update(['bukti_foto' => null]);
            }
        } catch (\Throwable $e) {
            Log::warning('Auto-purge transfer proofs encountered an error: ' . $e->getMessage());
        }
    }

    /**
     * GET /api/pembayaran/verifikasi/storage-status
     * Mengambil statistik penggunaan storage file bukti transfer.
     */
    public function storageStatus(Request $request)
    {
        $days = (int) ($request->query('days') ?: 60);
        if ($days < 1) {
            $days = 60;
        }
        $thresholdDate = now()->subDays($days);

        $allWithFiles = PaymentVerification::whereNotNull('bukti_foto')
            ->where('bukti_foto', '!=', '')
            ->where('bukti_foto', '!=', 'purged')
            ->get();

        $totalActiveFiles = 0;
        $totalBytes = 0;
        $eligibleCount = 0;
        $eligibleBytes = 0;

        foreach ($allWithFiles as $item) {
            $path = $item->bukti_foto;
            if (Storage::disk('public')->exists($path)) {
                $size = (int) Storage::disk('public')->size($path);
                $totalActiveFiles++;
                $totalBytes += $size;

                $isProcessed = in_array($item->status, ['disetujui', 'ditolak']);
                $isOlder = ($item->updated_at && $item->updated_at <= $thresholdDate)
                    || ($item->verified_at && $item->verified_at <= $thresholdDate);

                if ($isProcessed && $isOlder) {
                    $eligibleCount++;
                    $eligibleBytes += $size;
                }
            }
        }

        $purgedCount = PaymentVerification::whereIn('status', ['disetujui', 'ditolak'])
            ->where(function ($q) {
                $q->whereNull('bukti_foto')
                  ->orWhere('bukti_foto', 'purged')
                  ->orWhere('bukti_foto', '');
            })
            ->count();

        return response()->json([
            'success' => true,
            'data' => [
                'retention_days' => $days,
                'total_active_files' => $totalActiveFiles,
                'total_size_bytes' => $totalBytes,
                'total_size_mb' => round($totalBytes / (1024 * 1024), 2),
                'eligible_count' => $eligibleCount,
                'eligible_bytes' => $eligibleBytes,
                'eligible_size_mb' => round($eligibleBytes / (1024 * 1024), 2),
                'purged_count' => $purgedCount,
            ],
        ]);
    }

    /**
     * POST /api/pembayaran/verifikasi/purge-proofs
     * Menghapus file fisik bukti transfer yang sudah lunas/disetujui/ditolak lebih dari X hari.
     */
    public function purgeProofs(Request $request)
    {
        $days = (int) ($request->input('days') ?: 60);
        if ($days < 1) {
            $days = 60;
        }
        $thresholdDate = now()->subDays($days);

        $candidates = PaymentVerification::query()
            ->whereIn('status', ['disetujui', 'ditolak'])
            ->where(function ($q) use ($thresholdDate) {
                $q->where('updated_at', '<=', $thresholdDate)
                  ->orWhere('verified_at', '<=', $thresholdDate);
            })
            ->whereNotNull('bukti_foto')
            ->where('bukti_foto', '!=', '')
            ->where('bukti_foto', '!=', 'purged')
            ->get();

        $purgedFiles = 0;
        $freedBytes = 0;

        foreach ($candidates as $item) {
            $path = $item->bukti_foto;
            if (Storage::disk('public')->exists($path)) {
                $size = (int) Storage::disk('public')->size($path);
                Storage::disk('public')->delete($path);
                $freedBytes += $size;
            }
            // Bersihkan total tanpa sisa di database (set NULL)
            $item->update(['bukti_foto' => null]);
            $purgedFiles++;
        }

        $freedMb = round($freedBytes / (1024 * 1024), 2);

        return response()->json([
            'success' => true,
            'message' => "Alhamdulillah! Berhasil membersihkan {$purgedFiles} file bukti transfer lama (> {$days} hari). Ruang disk server dihemat sebesar {$freedMb} MB dan database telah bersih tanpa sisa.",
            'data' => [
                'purged_files' => $purgedFiles,
                'freed_bytes' => $freedBytes,
                'freed_mb' => $freedMb,
            ],
        ]);
    }

    private function formatVerification(PaymentVerification $item): array
    {
        $isPurged = empty($item->bukti_foto) && in_array($item->status, ['disetujui', 'ditolak']);

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
            'bukti_url' => (!empty($item->bukti_foto) && $item->bukti_foto !== 'purged') ? asset('storage/' . $item->bukti_foto) : null,
            'is_purged' => $isPurged,
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
