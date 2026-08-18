<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AdminPaymentSecuritySetting;
use App\Models\DocumentSetting;
use App\Models\PaymentTransaction;
use App\Models\PaymentBill;
use App\Models\Pembayaran;
use App\Models\Pengeluaran;
use App\Models\PaymentType;
use App\Models\Siswa;
use App\Models\User;
use App\Services\ActorResolver;
use App\Services\AdminActivityNotificationService;
use App\Services\AcademicPeriodService;
use App\Services\AuditLogService;
use App\Services\PaymentBillService;
use App\Services\PaymentHistoryService;
use App\Services\ReferenceResolver;
use App\Services\WhatsAppNotificationService;
use Illuminate\Support\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
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

    private const BIOMETRIC_METHODS = [
        'face',
        'fingerprint',
        'face_or_fingerprint',
        'device_biometric',
        'admin_password',
        'admin_pin',
    ];

    public function __construct(
        private readonly PaymentHistoryService $paymentHistoryService,
    ) {
    }

    public function index(Request $request)
    {
        $filters = [
            'tanggal' => $request->input('tanggal'),
            'status' => $request->input('status'),
            'payment_status_id' => $request->input('payment_status_id'),
            'siswa_id' => $request->input('siswa_id'),
            'kelas' => $request->input('kelas'),
            'class_id' => $request->input('class_id'),
            'academic_year_id' => $request->input('academic_year_id'),
            'semester_id' => $request->input('semester_id'),
            'tahun_ajaran' => $request->input('tahun_ajaran'),
            'semester' => $request->input('semester'),
            'limit' => $request->integer('limit') ?: null,
        ];

        if (!$request->has('semua') && !$request->filled('tanggal') && !$request->filled('siswa_id')) {
            $filters['tanggal'] = now()->toDateString();
        }

        $data = $this->paymentHistoryService->getTransactions($filters);

        return response()->json([
            'success' => true,
            'total_hari_ini' => (int) $data->sum('jumlah'),
            'jumlah_transaksi' => $data->count(),
            'data' => $data->values(),
        ]);
    }

    public function chart(Request $request)
    {
        $actor = $this->resolveActor($request);
        if (!$actor || $actor->role !== 'admin') {
            return response()->json(['success' => false, 'data' => []]);
        }

        // Get monthly income for the current year
        $year = now()->year;
        $payments = Pembayaran::whereYear('tanggal', $year)
            ->where('status', 'Lunas')
            ->selectRaw('EXTRACT(MONTH FROM tanggal) as month, SUM(jumlah) as total')
            ->groupBy('month')
            ->orderBy('month')
            ->get();

        // Get monthly expense for the current year
        $expenses = Pengeluaran::whereYear('tanggal', $year)
            ->selectRaw('EXTRACT(MONTH FROM tanggal) as month, SUM(jumlah) as total')
            ->groupBy('month')
            ->orderBy('month')
            ->get();

        $months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
        $chartData = collect(range(1, 12))->map(function ($month) use ($payments, $expenses, $months) {
            $payment = $payments->firstWhere('month', $month);
            $income = $payment ? (int) $payment->total : 0;
            
            $expenseData = $expenses->firstWhere('month', $month);
            $expense = $expenseData ? (int) $expenseData->total : 0;
            
            return [
                'name' => $months[$month - 1],
                'Pemasukan' => $income,
                'Pengeluaran' => $expense,
            ];
        });

        return response()->json([
            'success' => true,
            'data' => $chartData,
        ]);
    }

    public function store(Request $request)
    {
        $actor = $this->resolveActor($request);
        if (!$actor || $actor->role !== 'admin') {
            return $this->forbidden('Hanya admin yang dapat mencatat pembayaran');
        }

        $validated = $request->validate([
            'user_id' => 'required|exists:users,id',
            'siswa_id' => 'required|exists:siswa,id',
            'atas_nama' => 'nullable|string',
            'jenis' => 'nullable|string|max:255',
            'via' => 'required|string|max:255',
            'payment_method_id' => 'nullable|integer|exists:payment_methods,id',
            'jumlah' => 'nullable|integer|min:0',
            'tanggal' => 'required|date',
            'status' => 'required|in:Lunas,Belum Lunas,Menunggu',
            'payment_status_id' => 'nullable|integer|exists:payment_statuses,id',
            'periode_mulai' => 'nullable|string',
            'periode_selesai' => 'nullable|string',
            'keterangan' => 'nullable|string',
            'payment_type_id' => 'nullable|exists:payment_types,id',
            'payment_bill_id' => 'nullable|exists:payment_bills,id',
            'academic_year_id' => 'nullable|integer|exists:academic_years,id',
            'semester_id' => 'nullable|integer|exists:semesters,id',
            'tahun_ajaran' => 'nullable|string|max:30',
            'semester' => 'nullable|string|max:30',
            'payment_items' => 'nullable|array|min:1',
            'payment_items.*.payment_type_id' => 'nullable|exists:payment_types,id',
            'payment_items.*.payment_bill_id' => 'nullable|exists:payment_bills,id',
            'payment_items.*.jumlah' => 'nullable|integer|min:0',
            'payment_items.*.period_month' => 'nullable|integer|min:1|max:12',
            'payment_items.*.month' => 'nullable|integer|min:1|max:12',
            'payment_items.*.keterangan' => 'nullable|string',
            'payment_items.*.academic_year_id' => 'nullable|integer|exists:academic_years,id',
            'payment_items.*.semester_id' => 'nullable|integer|exists:semesters,id',
            'payment_items.*.tahun_ajaran' => 'nullable|string|max:30',
            'payment_items.*.semester' => 'nullable|string|max:30',
            'biometric_verified_at' => 'nullable|date',
            'biometric_verification_method' => ['nullable', Rule::in(self::BIOMETRIC_METHODS)],
            'biometric_verification_mode' => 'nullable|string|max:100',
            'device_label' => 'nullable|string|max:255',
            'payment_security_password' => 'nullable|string',
            'payment_security_pin' => 'nullable|string',
        ]);
        $validated = $this->normalizePaymentReferences($validated);
        $this->assertActivePaymentMethod((int) $validated['payment_method_id']);

        $securitySetting = AdminPaymentSecuritySetting::query()->firstOrCreate(
            ['user_id' => $actor->id],
            [
                'face_enabled' => false,
                'fingerprint_enabled' => false,
                'verification_mode' => 'fingerprint_only',
                'biometric_required' => false,
            ]
        );

        $this->assertPaymentSecurityPayload($validated, $securitySetting, $actor);

        $siswa = Siswa::with('wali')->findOrFail($validated['siswa_id']);
        $paymentItems = $this->resolvePaymentItems($validated, $siswa);
        if ($paymentItems->isEmpty()) {
            throw ValidationException::withMessages([
                'payment_items' => ['Pilih minimal satu item pembayaran yang valid.'],
            ]);
        }

        $atasNama = $siswa->wali?->name
            ?? $siswa->nama_wali
            ?? $validated['atas_nama']
            ?? 'Wali Santri';
        $total = (int) $paymentItems->sum('jumlah');
        $transactionStatus = $this->deriveTransactionStatus($validated['status'], $paymentItems);
        $transactionStatusId = app(ReferenceResolver::class)->paymentStatusId($transactionStatus);
        $periodPayload = $paymentItems
            ->map(fn ($item) => collect($item)->only(['academic_year_id', 'semester_id', 'tahun_ajaran', 'semester'])->all())
            ->first(fn ($item) => !empty($item['academic_year_id']) || !empty($item['tahun_ajaran']), []);

        $transaction = DB::transaction(function () use ($actor, $validated, $paymentItems, $siswa, $atasNama, $total, $securitySetting, $periodPayload, $transactionStatus, $transactionStatusId) {
            $transaction = PaymentTransaction::query()->create([
                'kode_transaksi' => $this->generateTransactionCode(),
                'siswa_id' => $siswa->id,
                'wali_id' => $siswa->wali_id,
                'created_by_user_id' => $actor->id,
                'updated_by_user_id' => $actor->id,
                'atas_nama' => $atasNama,
                'via' => $validated['via'],
                'payment_method_id' => $validated['payment_method_id'],
                'jumlah_total' => $total,
                'total_item' => $paymentItems->count(),
                'tanggal' => $validated['tanggal'],
                'status' => $transactionStatus,
                'payment_status_id' => $transactionStatusId,
                'keterangan' => $validated['keterangan'] ?? null,
                'biometric_required' => true,
                'biometric_verified_at' => $validated['biometric_verified_at'],
                'biometric_verification_method' => $validated['biometric_verification_method'] ?? 'device_biometric',
                'biometric_verification_mode' => $validated['biometric_verification_mode'] ?? $securitySetting->verification_mode,
                ...$periodPayload,
            ]);

            foreach ($paymentItems->values() as $index => $item) {
                Pembayaran::query()->create([
                    'payment_transaction_id' => $transaction->id,
                    'sort_order' => $index,
                    'siswa_id' => $siswa->id,
                    'payment_type_id' => $item['payment_type_id'],
                    'payment_bill_id' => $item['payment_bill_id'] ?? null,
                    'wali_id' => $siswa->wali_id,
                    'atas_nama' => $atasNama,
                    'jenis' => $item['jenis'],
                    'via' => $validated['via'],
                    'payment_method_id' => $validated['payment_method_id'],
                    'jumlah' => $item['jumlah'],
                    'tanggal' => $validated['tanggal'],
                    'status' => $item['status'],
                    'payment_status_id' => app(ReferenceResolver::class)->paymentStatusId($item['status']),
                    'periode_mulai' => $validated['periode_mulai'] ?? null,
                    'periode_selesai' => $validated['periode_selesai'] ?? null,
                    'academic_year_id' => $item['academic_year_id'] ?? $periodPayload['academic_year_id'] ?? null,
                    'semester_id' => $item['semester_id'] ?? $periodPayload['semester_id'] ?? null,
                    'tahun_ajaran' => $item['tahun_ajaran'] ?? $periodPayload['tahun_ajaran'] ?? null,
                    'semester' => $item['semester'] ?? $periodPayload['semester'] ?? null,
                    'keterangan' => $item['keterangan'] ?? $validated['keterangan'] ?? null,
                ]);
            }

            app(PaymentBillService::class)->recalculateBills($paymentItems->pluck('payment_bill_id'));

            $securitySetting->update([
                'last_verified_at' => $validated['biometric_verified_at'],
                'last_verification_method' => $validated['biometric_verification_method'] ?? 'device_biometric',
                'last_payment_transaction_code' => $transaction->kode_transaksi,
                'last_device_label' => $validated['device_label'] ?? $securitySetting->last_device_label,
            ]);

            return $transaction->fresh(['siswa', 'wali', 'items.paymentType']);
        });

        app(AuditLogService::class)->record($request, 'pembayaran', 'create', $transaction, null, $transaction->toArray(), [
            'jumlah_total' => $transaction->jumlah_total,
            'total_item' => $transaction->total_item,
        ]);

        app(AdminActivityNotificationService::class)->notifyAdmins(
            'Pembayaran Baru',
            sprintf(
                'Pembayaran %s sebesar Rp %s berhasil dicatat untuk %s.',
                $transaction->items->pluck('paymentType.nama')->filter()->unique()->join(', ') ?: 'santri',
                number_format((float) $transaction->jumlah_total, 0, ',', '.'),
                $transaction->siswa?->nama ?? 'Santri'
            ),
            'pembayaran',
            [
                'payment_transaction_id' => $transaction->id,
                'siswa_id' => $transaction->siswa_id,
                'jumlah' => (int) $transaction->jumlah_total,
                'status' => $transaction->status,
            ],
        );

        // WA Notification is now handled by notifyWa endpoint based on user choice in frontend
        // if ($transaction->status === 'Lunas') {
        //     app(WhatsAppNotificationService::class)->queuePaymentTransaction($transaction, $actor->id);
        // }

        return response()->json([
            'success' => true,
            'message' => 'Pembayaran berhasil dicatat',
            'data' => $this->paymentHistoryService->formatTransaction($transaction),
        ], 201);
    }

    public function show(Pembayaran $pembayaran)
    {
        if ($pembayaran->payment_transaction_id) {
            $transaction = PaymentTransaction::query()
                ->with(['siswa', 'wali', 'items.paymentType'])
                ->findOrFail($pembayaran->payment_transaction_id);

            return response()->json([
                'success' => true,
                'data' => $this->paymentHistoryService->formatTransaction($transaction),
            ]);
        }

        return response()->json([
            'success' => true,
            'data' => $this->paymentHistoryService->formatLegacyPayment(
                $pembayaran->load(['siswa', 'wali', 'paymentType'])
            ),
        ]);
    }

    public function showTransaction(PaymentTransaction $paymentTransaction)
    {
        $paymentTransaction->loadMissing(['siswa', 'wali', 'items.paymentType', 'createdByUser', 'paymentMethod']);
        return response()->json([
            'success' => true,
            'data' => $this->paymentHistoryService->formatTransaction($paymentTransaction),
        ]);
    }

    public function notifyWa(Request $request, PaymentTransaction $paymentTransaction)
    {
        $actor = $this->resolveActor($request);
        $log = app(WhatsAppNotificationService::class)->queuePaymentTransaction($paymentTransaction, $actor?->id);

        return response()->json([
            'success' => true,
            'message' => $log ? 'Notifikasi WhatsApp berhasil masuk antrean' : 'Tidak dapat mengirim notifikasi WA',
        ]);
    }

    public function update(Request $request, Pembayaran $pembayaran)
    {
        if ($pembayaran->payment_transaction_id) {
            throw ValidationException::withMessages([
                'payment' => ['Transaksi multi pembayaran belum mendukung edit parsial. Hapus lalu input ulang transaksi baru.'],
            ]);
        }

        $validated = $request->validate([
            'siswa_id' => 'sometimes|required|exists:siswa,id',
            'payment_type_id' => 'nullable|exists:payment_types,id',
            'atas_nama' => 'sometimes|string',
            'jenis' => 'sometimes|nullable|string|max:255',
            'via' => 'sometimes|required|string|max:255',
            'payment_method_id' => 'nullable|integer|exists:payment_methods,id',
            'jumlah' => 'sometimes|integer|min:0',
            'tanggal' => 'sometimes|date',
            'status' => 'sometimes|in:Lunas,Belum Lunas,Menunggu',
            'payment_status_id' => 'nullable|integer|exists:payment_statuses,id',
            'periode_mulai' => 'nullable|string',
            'periode_selesai' => 'nullable|string',
            'academic_year_id' => 'nullable|integer|exists:academic_years,id',
            'semester_id' => 'nullable|integer|exists:semesters,id',
            'tahun_ajaran' => 'nullable|string|max:30',
            'semester' => 'nullable|string|max:30',
            'keterangan' => 'nullable|string',
        ]);
        $validated = $this->normalizePaymentReferences($validated, $pembayaran);
        if (array_key_exists('via', $validated) || array_key_exists('payment_method_id', $validated)) {
            $this->assertActivePaymentMethod((int) $validated['payment_method_id']);
        }

        $payload = $this->buildLegacyPayload($validated, $pembayaran);
        $before = $pembayaran->toArray();
        $pembayaran->update($payload);
        app(AuditLogService::class)->record($request, 'pembayaran', 'update', $pembayaran, $before, $pembayaran->fresh()->toArray());

        return response()->json([
            'success' => true,
            'message' => 'Pembayaran berhasil diupdate',
            'data' => $this->paymentHistoryService->formatLegacyPayment(
                $pembayaran->fresh(['siswa', 'wali', 'paymentType'])
            ),
        ]);
    }

    public function destroy(Request $request, Pembayaran $pembayaran)
    {
        if ($pembayaran->payment_transaction_id) {
            $transaction = PaymentTransaction::query()->find($pembayaran->payment_transaction_id);
            if ($transaction) {
                $before = $transaction->load('items')->toArray();
                $billIds = $transaction->items->pluck('payment_bill_id');
                $transaction->items()->delete();
                $transaction->delete();
                app(PaymentBillService::class)->recalculateBills($billIds);
                app(AuditLogService::class)->record($request, 'pembayaran', 'delete_transaction', $transaction, $before, null);

                return response()->json([
                    'success' => true,
                    'message' => 'Transaksi pembayaran berhasil dihapus',
                ]);
            }
        }

        $before = $pembayaran->toArray();
        $billIds = collect([$pembayaran->payment_bill_id]);
        $pembayaran->delete();
        app(PaymentBillService::class)->recalculateBills($billIds);
        app(AuditLogService::class)->record($request, 'pembayaran', 'delete', $pembayaran, $before, null);

        return response()->json([
            'success' => true,
            'message' => 'Pembayaran berhasil dihapus',
        ]);
    }

    public function destroyTransaction(Request $request, PaymentTransaction $paymentTransaction)
    {
        $before = $paymentTransaction->load('items')->toArray();
        $billIds = $paymentTransaction->items->pluck('payment_bill_id');
        $paymentTransaction->items()->delete();
        $paymentTransaction->delete();
        app(PaymentBillService::class)->recalculateBills($billIds);
        app(AuditLogService::class)->record($request, 'pembayaran', 'delete_transaction', $paymentTransaction, $before, null);

        return response()->json([
            'success' => true,
            'message' => 'Transaksi pembayaran berhasil dihapus',
        ]);
    }

    public function studentRekap(Request $request)
    {
        $actor = $this->resolveActor($request);
        if (!$actor || !in_array($actor->role, ['admin', 'wali'], true)) {
            return $this->forbidden('Anda tidak memiliki akses ke rekap pembayaran siswa');
        }

        $validated = $request->validate([
            'user_id' => 'required|exists:users,id',
            'siswa_id' => 'required|exists:siswa,id',
            'academic_year_id' => 'nullable|integer|exists:academic_years,id',
            'semester_id' => 'nullable|integer|exists:semesters,id',
            'tahun_ajaran' => 'nullable|string',
            'semester' => 'nullable|string',
        ]);

        $siswa = Siswa::with('wali:id,name')->findOrFail($validated['siswa_id']);
        if ($actor->role === 'wali' && (int) $siswa->wali_id !== $actor->id) {
            return $this->forbidden('Anda hanya dapat melihat rekap pembayaran anak sendiri');
        }

        $transactions = $this->paymentHistoryService->getTransactions([
            'siswa_id' => $siswa->id,
            'academic_year_id' => $validated['academic_year_id'] ?? null,
            'semester_id' => $validated['semester_id'] ?? null,
            'tahun_ajaran' => $validated['tahun_ajaran'] ?? null,
            'semester' => $validated['semester'] ?? null,
        ]);

        $rows = $transactions
            ->map(fn (array $transaction) => $this->paymentHistoryService->mapReportRow($transaction))
            ->values();

        return response()->json([
            'success' => true,
            'data' => [
                'siswa' => [
                    'id' => $siswa->id,
                    'nama' => $siswa->nama,
                    'nis' => $siswa->nis,
                    'kelas' => $siswa->kelas,
                    'wali_nama' => $siswa->wali?->name ?? $siswa->nama_wali,
                ],
                'summary' => [
                    'total_transaksi' => $transactions->count(),
                    'total_lunas' => (int) $transactions->where('status', 'Lunas')->sum('jumlah'),
                    'total_menunggu' => (int) $transactions->where('status', 'Menunggu')->sum('jumlah'),
                    'total_belum_lunas' => (int) $transactions->where('status', 'Belum Lunas')->sum('jumlah'),
                    'total_semua' => (int) $transactions->sum('jumlah'),
                ],
                'rows' => $rows,
                'document_setting' => $this->paymentDocumentSetting(),
                'generated_at' => now()->format('Y-m-d H:i'),
            ],
        ]);
    }

    public function rekapExport(Request $request)
    {
        $actor = $this->resolveActor($request);
        if (!$actor || $actor->role !== 'admin') {
            return $this->forbidden('Hanya admin yang dapat mengunduh rekap pembayaran');
        }

        $request->validate([
            'user_id' => 'required|exists:users,id',
            'kelas' => 'nullable|string',
            'class_id' => 'nullable|integer|exists:classes,id',
            'status' => 'nullable|in:Lunas,Belum Lunas,Menunggu',
            'payment_status_id' => 'nullable|integer|exists:payment_statuses,id',
            'tanggal_mulai' => 'nullable|date',
            'tanggal_akhir' => 'nullable|date',
            'academic_year_id' => 'nullable|integer|exists:academic_years,id',
            'semester_id' => 'nullable|integer|exists:semesters,id',
            'tahun_ajaran' => 'nullable|string',
            'semester' => 'nullable|string',
        ]);

        $transactions = $this->paymentHistoryService->getTransactions([
            'kelas' => $request->input('kelas'),
            'class_id' => $request->input('class_id'),
            'status' => $request->input('status'),
            'payment_status_id' => $request->input('payment_status_id'),
            'tanggal_mulai' => $request->input('tanggal_mulai'),
            'tanggal_akhir' => $request->input('tanggal_akhir'),
            'academic_year_id' => $request->input('academic_year_id'),
            'semester_id' => $request->input('semester_id'),
            'tahun_ajaran' => $request->input('tahun_ajaran'),
            'semester' => $request->input('semester'),
        ]);

        $rows = $transactions
            ->map(fn (array $transaction) => $this->paymentHistoryService->mapReportRow($transaction))
            ->values();

        $studentSummary = $transactions
            ->groupBy('siswa_id')
            ->map(function ($items) {
                $first = $items->first();
                $siswa = $first['siswa'] ?? [];

                return [
                    'siswa_id' => $siswa['id'] ?? null,
                    'nama_siswa' => $siswa['nama'] ?? '-',
                    'nis' => $siswa['nis'] ?? '-',
                    'kelas' => $siswa['kelas'] ?? '-',
                    'total_transaksi' => $items->count(),
                    'total_pembayaran' => (int) $items->sum('jumlah'),
                ];
            })
            ->values();

        return response()->json([
            'success' => true,
            'filters' => [
                'kelas' => $request->kelas,
                'status' => $request->status,
                'tanggal_mulai' => $request->tanggal_mulai,
                'tanggal_akhir' => $request->tanggal_akhir,
                'tahun_ajaran' => $request->tahun_ajaran,
                'semester' => $request->semester,
            ],
            'summary' => [
                'total_transaksi' => $transactions->count(),
                'total_siswa' => $transactions->pluck('siswa_id')->filter()->unique()->count(),
                'total_keseluruhan' => (int) $transactions->sum('jumlah'),
            ],
            'student_totals' => $studentSummary,
            'data' => $rows,
        ]);
    }

    private function resolvePaymentItems(array $validated, Siswa $siswa)
    {
        $items = collect($validated['payment_items'] ?? []);
        $rootPeriod = $this->normalizeAcademicPaymentPeriod($validated);
        $seenMonthlyKeys = [];

        if ($items->isEmpty() && !empty($validated['payment_type_id'])) {
            $items = collect([
                [
                    'payment_type_id' => (int) $validated['payment_type_id'],
                    'payment_bill_id' => $validated['payment_bill_id'] ?? null,
                    'jumlah' => $validated['jumlah'] ?? null,
                    'keterangan' => $validated['keterangan'] ?? null,
                ],
            ]);
        } elseif ($items->isEmpty() && !empty($validated['payment_bill_id'])) {
            $items = collect([[
                'payment_bill_id' => (int) $validated['payment_bill_id'],
                'jumlah' => $validated['jumlah'] ?? null,
                'keterangan' => $validated['keterangan'] ?? null,
            ]]);
        }

        return $items
            ->map(function (array $item) use ($validated, $rootPeriod, $siswa, &$seenMonthlyKeys) {
                $bill = null;
                if (!empty($item['payment_bill_id'])) {
                    $bill = PaymentBill::query()->findOrFail((int) $item['payment_bill_id']);
                    if ((int) $bill->siswa_id !== (int) $validated['siswa_id']) {
                        throw ValidationException::withMessages([
                            'payment_items' => ['Tagihan tidak sesuai dengan siswa yang dipilih.'],
                        ]);
                    }
                    if (in_array($bill->status, ['Lunas', 'Dibatalkan'], true)) {
                        throw ValidationException::withMessages([
                            'payment_items' => ["Tagihan {$bill->title} sudah {$bill->status} dan tidak dapat dibayar ulang."],
                        ]);
                    }
                    $item['payment_type_id'] = $item['payment_type_id'] ?? $bill->payment_type_id;
                }

                if (empty($item['payment_type_id'])) {
                    throw ValidationException::withMessages([
                        'payment_items' => ['Pilih tipe pembayaran atau tagihan yang valid.'],
                    ]);
                }

                $paymentType = PaymentType::query()->findOrFail((int) $item['payment_type_id']);
                if (($paymentType->status ?? 'Aktif') !== 'Aktif') {
                    throw ValidationException::withMessages([
                        'payment_items' => ["Tipe pembayaran {$paymentType->nama} sedang nonaktif."],
                    ]);
                }

                $periodMonth = (int) ($item['period_month'] ?? $item['month'] ?? 0);
                if (!$bill && $periodMonth > 0) {
                    $itemPeriodForBill = $this->normalizeAcademicPaymentPeriod($item, $rootPeriod);
                    $academicYearId = (int) ($itemPeriodForBill['academic_year_id'] ?? 0);
                    if ($academicYearId <= 0) {
                        throw ValidationException::withMessages([
                            'academic_year_id' => ['Tahun ajaran wajib dipilih untuk pembayaran bulanan.'],
                        ]);
                    }
                    $monthlyKey = implode('|', [
                        $paymentType->id,
                        $academicYearId,
                        $itemPeriodForBill['semester_id'] ?? 'all',
                        $periodMonth,
                    ]);
                    if (isset($seenMonthlyKeys[$monthlyKey])) {
                        throw ValidationException::withMessages([
                            'payment_items' => ['Bulan yang sama tidak boleh dipilih dua kali untuk tipe pembayaran dan periode yang sama.'],
                        ]);
                    }
                    $seenMonthlyKeys[$monthlyKey] = true;
                    $this->assertStudentSyncedToPeriod($siswa->id, $academicYearId, !empty($itemPeriodForBill['semester_id']) ? (int) $itemPeriodForBill['semester_id'] : null);
                    $bill = app(PaymentBillService::class)->ensureMonthlyBillForPayment(
                        $siswa,
                        $paymentType,
                        $academicYearId,
                        !empty($itemPeriodForBill['semester_id']) ? (int) $itemPeriodForBill['semester_id'] : null,
                        $periodMonth
                    );
                }

                $allowedMethods = $paymentType->metode_pembayaran ?? [];
                if (!empty($allowedMethods) && !in_array($validated['via'], $allowedMethods, true)) {
                    throw ValidationException::withMessages([
                        'via' => ["Metode pembayaran {$validated['via']} tidak didukung oleh tipe {$paymentType->nama}."],
                    ]);
                }

                $resolvedAmount = array_key_exists('jumlah', $item) && $item['jumlah'] !== null
                    ? (int) $item['jumlah']
                    : (int) ($bill?->amount ?? $paymentType->nominal_default);

                if ($resolvedAmount <= 0) {
                    throw ValidationException::withMessages([
                        'payment_items' => ["Nominal untuk {$paymentType->nama} harus lebih dari nol."],
                    ]);
                }

                if (!$bill && $periodMonth <= 0) {
                    $itemPeriodForBill = $this->normalizeAcademicPaymentPeriod($item, $rootPeriod);
                    $academicYearId = (int) ($itemPeriodForBill['academic_year_id'] ?? 0);
                    if ($academicYearId > 0) {
                        $this->assertStudentSyncedToPeriod($siswa->id, $academicYearId, !empty($itemPeriodForBill['semester_id']) ? (int) $itemPeriodForBill['semester_id'] : null);
                        $amountDue = (int) ($paymentType->nominal_default ?? 0);
                        if ($amountDue <= 0) {
                            $amountDue = $resolvedAmount;
                        }
                        $bill = app(PaymentBillService::class)->ensureGeneralBillForPayment(
                            $siswa,
                            $paymentType,
                            $academicYearId,
                            !empty($itemPeriodForBill['semester_id']) ? (int) $itemPeriodForBill['semester_id'] : null,
                            $amountDue
                        );
                    }
                }

                $itemPeriod = $bill
                    ? [
                        'academic_year_id' => $bill->academic_year_id,
                        'semester_id' => $bill->semester_id,
                        'tahun_ajaran' => $bill->tahun_ajaran,
                        'semester' => $bill->semester,
                    ]
                    : $this->normalizeAcademicPaymentPeriod($item, $rootPeriod);

                return [
                    'payment_type_id' => $paymentType->id,
                    'payment_bill_id' => $bill?->id,
                    'jenis' => $this->resolveJenisForStorage($paymentType, $item['jenis'] ?? null),
                    'jumlah' => $resolvedAmount,
                    'amount_due' => (int) ($bill?->amount ?? $paymentType->nominal_default ?? $resolvedAmount),
                    'status' => $this->deriveItemPaymentStatus(
                        (int) ($bill?->amount ?? $paymentType->nominal_default ?? $resolvedAmount),
                        $resolvedAmount,
                        $validated['status'] ?? 'Lunas'
                    ),
                    ...$itemPeriod,
                    'keterangan' => $item['keterangan'] ?? null,
                ];
            })
            ->values();
    }

    private function assertStudentSyncedToPeriod(int $siswaId, int $academicYearId, ?int $semesterId): void
    {
        $exists = DB::table('siswa_tahun_ajaran')
            ->where('siswa_id', $siswaId)
            ->where('academic_year_id', $academicYearId)
            ->when($semesterId, fn ($query) => $query->where('semester_id', $semesterId))
            ->where('is_active', true)
            ->exists();

        if (!$exists) {
            throw ValidationException::withMessages([
                'siswa_id' => ['Data santri belum tersedia di tahun ajaran ini. Silakan sinkronisasi data santri terlebih dahulu di Setting Akademik.'],
            ]);
        }
    }

    private function deriveItemPaymentStatus(int $amountDue, int $amountPaid, string $requestedStatus): string
    {
        if ($requestedStatus === 'Menunggu') {
            return 'Menunggu';
        }

        if ($amountDue > 0 && $amountPaid >= $amountDue) {
            return 'Lunas';
        }

        return 'Belum Lunas';
    }

    private function deriveTransactionStatus(string $requestedStatus, \Illuminate\Support\Collection $paymentItems): string
    {
        if ($requestedStatus === 'Menunggu') {
            return 'Menunggu';
        }

        $hasPartial = $paymentItems->contains(fn ($item) => ($item['status'] ?? 'Belum Lunas') !== 'Lunas');

        return $hasPartial ? 'Belum Lunas' : 'Lunas';
    }

    private function assertActivePaymentMethod(int $paymentMethodId): void
    {
        $active = DB::table('payment_methods')
            ->where('id', $paymentMethodId)
            ->where('is_active', true)
            ->exists();

        if (!$active) {
            throw ValidationException::withMessages([
                'via' => ['Metode pembayaran sedang nonaktif atau tidak tersedia. Aktifkan dari Pengaturan Metode Pembayaran.'],
            ]);
        }
    }

    private function normalizeAcademicPaymentPeriod(array $payload, array $fallback = []): array
    {
        $period = array_intersect_key($payload, array_flip([
            'academic_year_id',
            'semester_id',
            'tahun_ajaran',
            'semester',
        ]));

        if (empty(array_filter($period, fn ($value) => $value !== null && $value !== ''))) {
            return $fallback;
        }

        $academicYearId = !empty($period['academic_year_id']) ? (int) $period['academic_year_id'] : null;
        $tahunAjaran = trim((string) ($period['tahun_ajaran'] ?? ''));
        if ($academicYearId && $tahunAjaran === '') {
            $tahunAjaran = (string) DB::table('academic_years')->where('id', $academicYearId)->value('name');
        } elseif (!$academicYearId && $tahunAjaran !== '') {
            $academicYearId = app(ReferenceResolver::class)->academicYearId($tahunAjaran, false);
        }

        $semesterId = !empty($period['semester_id']) ? (int) $period['semester_id'] : null;
        $semester = trim((string) ($period['semester'] ?? ''));
        if ($semesterId && $semester === '') {
            $semester = (string) DB::table('semesters')->where('id', $semesterId)->value('name');
        }
        if ($semester !== '') {
            $semester = app(AcademicPeriodService::class)->semesterLabel(
                app(AcademicPeriodService::class)->normalizeSemester($semester)
            );
            if (!$semesterId) {
                $semesterId = DB::table('semesters')
                    ->when($academicYearId, fn ($query) => $query->where('academic_year_id', $academicYearId))
                    ->whereRaw('lower(name) = ?', [strtolower($semester)])
                    ->value('id');
            }
        }

        return [
            'academic_year_id' => $academicYearId,
            'semester_id' => $semesterId ? (int) $semesterId : null,
            'tahun_ajaran' => $tahunAjaran !== '' ? $tahunAjaran : null,
            'semester' => $semester !== '' ? $semester : null,
        ];
    }

    private function assertPaymentSecurityPayload(array &$validated, AdminPaymentSecuritySetting $securitySetting, User $actor): void
    {
        $method = $validated['biometric_verification_method'] ?? null;
        if ($method === 'admin_pin') {
            $pin = $validated['payment_security_pin'] ?? null;
            if (
                $securitySetting->pin_enabled
                && $securitySetting->transaction_pin_hash
                && is_string($pin)
                && $pin !== ''
                && Hash::check($pin, $securitySetting->transaction_pin_hash)
            ) {
                $validated['biometric_verified_at'] = now()->toDateTimeString();
                $validated['biometric_verification_method'] = 'admin_pin';
                $validated['biometric_verification_mode'] = 'admin_pin_fallback';
                return;
            }

            throw ValidationException::withMessages([
                'payment_security_pin' => ['PIN transaksi admin tidak valid. Transaksi pembayaran dibatalkan.'],
            ]);
        }

        if ($method === 'admin_password') {
            $password = $validated['payment_security_password'] ?? null;
            if (is_string($password) && $password !== '' && Hash::check($password, $actor->password)) {
                $validated['biometric_verified_at'] = now()->toDateTimeString();
                $validated['biometric_verification_method'] = 'admin_password';
                $validated['biometric_verification_mode'] = 'admin_password_fallback';
                return;
            }

            throw ValidationException::withMessages([
                'payment_security_password' => ['Password admin tidak valid. Transaksi pembayaran dibatalkan.'],
            ]);
        }

        if (empty($validated['biometric_verified_at']) || empty($validated['biometric_verification_method'])) {
            $pin = $validated['payment_security_pin'] ?? null;
            if (
                $securitySetting->pin_enabled
                && $securitySetting->transaction_pin_hash
                && is_string($pin)
                && $pin !== ''
                && Hash::check($pin, $securitySetting->transaction_pin_hash)
            ) {
                $validated['biometric_verified_at'] = now()->toDateTimeString();
                $validated['biometric_verification_method'] = 'admin_pin';
                $validated['biometric_verification_mode'] = 'admin_pin_fallback';
                return;
            }

            $password = $validated['payment_security_password'] ?? null;
            if (is_string($password) && $password !== '' && Hash::check($password, $actor->password)) {
                $validated['biometric_verified_at'] = now()->toDateTimeString();
                $validated['biometric_verification_method'] = 'admin_password';
                $validated['biometric_verification_mode'] = 'admin_password_fallback';
                return;
            }

            throw ValidationException::withMessages([
                'biometric_verified_at' => ['Verifikasi biometrik atau password admin wajib berhasil sebelum transaksi pembayaran disimpan.'],
            ]);
        }

        $verifiedAt = Carbon::parse($validated['biometric_verified_at']);
        if ($verifiedAt->lt(now()->subMinutes(5))) {
            throw ValidationException::withMessages([
                'biometric_verified_at' => ['Verifikasi biometrik sudah kedaluwarsa. Ulangi verifikasi sebelum menyimpan transaksi.'],
            ]);
        }

        if (
            !$securitySetting->biometric_required
            || (!$securitySetting->face_enabled && !$securitySetting->fingerprint_enabled)
        ) {
            throw ValidationException::withMessages([
                'biometric_verification_method' => ['Biometrik pembayaran belum dikonfigurasi. Gunakan verifikasi password admin atau aktifkan biometrik perangkat.'],
            ]);
        }
        if ($securitySetting->verification_mode === 'face_only' && $method !== 'face') {
            throw ValidationException::withMessages([
                'biometric_verification_method' => ['Mode keamanan ini membutuhkan verifikasi Face ID.'],
            ]);
        }

        if ($securitySetting->verification_mode === 'fingerprint_only' && $method !== 'fingerprint') {
            throw ValidationException::withMessages([
                'biometric_verification_method' => ['Mode keamanan ini membutuhkan verifikasi Fingerprint.'],
            ]);
        }

        if (!$securitySetting->face_enabled && $method === 'face') {
            throw ValidationException::withMessages([
                'biometric_verification_method' => ['Face ID belum diaktifkan pada pengaturan keamanan pembayaran admin ini.'],
            ]);
        }

        if (!$securitySetting->fingerprint_enabled && $method === 'fingerprint') {
            throw ValidationException::withMessages([
                'biometric_verification_method' => ['Fingerprint belum diaktifkan pada pengaturan keamanan pembayaran admin ini.'],
            ]);
        }

        if (
            in_array($securitySetting->verification_mode, ['face_or_fingerprint', 'face_primary_fingerprint_backup'], true)
            && !in_array($method, ['face', 'fingerprint', 'face_or_fingerprint', 'device_biometric'], true)
        ) {
            throw ValidationException::withMessages([
                'biometric_verification_method' => ['Metode verifikasi biometrik tidak sesuai dengan mode keamanan gabungan.'],
            ]);
        }
    }

    private function buildLegacyPayload(array $validated, ?Pembayaran $existing = null): array
    {
        $siswaId = $validated['siswa_id'] ?? $existing?->siswa_id;
        $siswa = Siswa::with('wali')->findOrFail($siswaId);

        $paymentTypeId = array_key_exists('payment_type_id', $validated)
            ? $validated['payment_type_id']
            : $existing?->payment_type_id;
        $paymentType = $paymentTypeId ? PaymentType::findOrFail($paymentTypeId) : null;

        if ($paymentType) {
            $isChangedPaymentType = (int) ($paymentType->id) !== (int) ($existing?->payment_type_id ?? 0);
            if ($isChangedPaymentType && ($paymentType->status ?? 'Aktif') !== 'Aktif') {
                throw ValidationException::withMessages([
                    'payment_type_id' => ['Tipe pembayaran sedang nonaktif. Pilih tipe pembayaran aktif.'],
                ]);
            }

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

        $periodPayload = $this->normalizeAcademicPaymentPeriod($validated, array_intersect_key(
            $existing?->toArray() ?? [],
            array_flip(['academic_year_id', 'semester_id', 'tahun_ajaran', 'semester'])
        ));

        return array_merge($validated, [
            'siswa_id' => $siswa->id,
            'wali_id' => $siswa->wali_id,
            'atas_nama' => $atasNama,
            'jenis' => $this->resolveJenisForStorage(
                $paymentType,
                $validated['jenis'] ?? $existing?->jenis
            ),
            'payment_type_id' => $paymentType?->id,
            'payment_method_id' => $validated['payment_method_id'] ?? $existing?->payment_method_id,
            'payment_status_id' => $validated['payment_status_id'] ?? $existing?->payment_status_id,
            ...$periodPayload,
        ]);
    }

    private function normalizePaymentReferences(array $payload, ?Pembayaran $existing = null): array
    {
        $resolver = app(ReferenceResolver::class);

        $via = $payload['via'] ?? $existing?->via;
        $methodId = $payload['payment_method_id'] ?? $existing?->payment_method_id;
        if ($methodId) {
            $methodName = $resolver->paymentMethodName((int) $methodId);
            if (!$methodName) {
                throw ValidationException::withMessages([
                    'payment_method_id' => ['Metode pembayaran tidak ditemukan di master metode pembayaran.'],
                ]);
            }
            if ($via && mb_strtolower(trim((string) $via)) !== mb_strtolower($methodName)) {
                throw ValidationException::withMessages([
                    'payment_method_id' => ['Metode pembayaran tidak sesuai dengan label via.'],
                ]);
            }
            $payload['via'] = $methodName;
            $payload['payment_method_id'] = (int) $methodId;
        } elseif ($via) {
            $resolvedMethodId = $resolver->paymentMethodId($via);
            if (!$resolvedMethodId) {
                throw ValidationException::withMessages([
                    'via' => ['Metode pembayaran tidak ditemukan di master metode pembayaran.'],
                ]);
            }
            $payload['payment_method_id'] = $resolvedMethodId;
            $payload['via'] = $resolver->paymentMethodName($resolvedMethodId) ?? $via;
        }

        $status = $payload['status'] ?? $existing?->status;
        $statusId = $payload['payment_status_id'] ?? $existing?->payment_status_id;
        if ($statusId) {
            $statusName = $resolver->paymentStatusName((int) $statusId);
            if (!$statusName) {
                throw ValidationException::withMessages([
                    'payment_status_id' => ['Status pembayaran tidak ditemukan di master status pembayaran.'],
                ]);
            }
            if ($status && mb_strtolower(trim((string) $status)) !== mb_strtolower($statusName)) {
                throw ValidationException::withMessages([
                    'payment_status_id' => ['Status pembayaran tidak sesuai dengan label status.'],
                ]);
            }
            $payload['status'] = $statusName;
            $payload['payment_status_id'] = (int) $statusId;
        } elseif ($status) {
            $resolvedStatusId = $resolver->paymentStatusId($status);
            if (!$resolvedStatusId) {
                throw ValidationException::withMessages([
                    'status' => ['Status pembayaran tidak ditemukan di master status pembayaran.'],
                ]);
            }
            $payload['payment_status_id'] = $resolvedStatusId;
            $payload['status'] = $resolver->paymentStatusName($resolvedStatusId) ?? $status;
        }

        return $payload;
    }

    private function resolveJenisForStorage(?PaymentType $paymentType, ?string $jenis): string
    {
        $resolved = $paymentType?->nama ?? $jenis ?? 'Lainnya';

        $canonical = $this->canonicalLegacyPaymentType($resolved);
        if ($canonical) {
            return $canonical;
        }

        return 'Lainnya';
    }

    private function canonicalLegacyPaymentType(string $jenis): ?string
    {
        $normalized = Str::of($jenis)
            ->lower()
            ->replace(['&', '/', '-', '_'], ' ')
            ->replaceMatches('/\s+/', ' ')
            ->trim()
            ->toString();

        return match ($normalized) {
            'spp', 'spp bulanan' => 'SPP Bulanan',
            'ujian', 'ujian semester' => 'Ujian Semester',
            'buku', 'kitab', 'buku kitab' => 'Buku & Kitab',
            'daftar ulang' => 'Daftar Ulang',
            'lainnya', 'lain lain', 'lain' => 'Lainnya',
            default => null,
        };
    }

    private function resolveActor(Request $request): ?User
    {
        return app(ActorResolver::class)->active($request);
    }

    private function generateTransactionCode(): string
    {
        do {
            $code = 'PAY-' . now()->format('Ymd') . '-' . Str::upper(Str::random(5));
        } while (PaymentTransaction::query()->where('kode_transaksi', $code)->exists());

        return $code;
    }

    private function forbidden(string $message)
    {
        return response()->json([
            'success' => false,
            'message' => $message,
        ], 403);
    }

    private function paymentDocumentSetting(): ?array
    {
        $setting = DocumentSetting::query()->first();
        if (!$setting) {
            return null;
        }

        return [
            'admin_name' => $setting->payment_admin_name,
            'admin_title' => $setting->payment_admin_title,
            'signature_mode' => $setting->payment_signature_mode,
            'signature_url' => $setting->payment_signature_path
                ? url('storage/' . $setting->payment_signature_path)
                : null,
            'document_logo_url' => $setting->document_logo_path
                ? url('storage/' . $setting->document_logo_path)
                : null,
        ];
    }
}
