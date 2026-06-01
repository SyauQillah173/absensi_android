<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PaymentBill;
use App\Models\PaymentBillNotification;
use App\Models\PaymentBillRule;
use App\Services\ActorResolver;
use App\Services\PaymentBillService;
use App\Services\StudentBillingSummaryService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PaymentBillController extends Controller
{
    public function __construct(
        private readonly PaymentBillService $billService,
        private readonly StudentBillingSummaryService $studentBillingSummary,
    ) {
    }

    public function index(Request $request)
    {
        $this->billService->generateDueBills();
        $this->billService->refreshOverdue();

        $query = PaymentBill::query()->with(['paymentType', 'siswa:id,nama,nis,kelas,wali_id']);
        if ($request->filled('siswa_id')) {
            $query->where('siswa_id', $request->integer('siswa_id'));
        }
        if ($request->filled('class_id')) {
            $query->where('class_id', $request->integer('class_id'));
        }
        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }
        if ($request->filled('academic_year_id')) {
            $query->where(function ($builder) use ($request) {
                $builder->where('academic_year_id', $request->integer('academic_year_id'))
                    ->orWhereNull('academic_year_id');
            });
        }
        if ($request->filled('semester_id')) {
            $query->where(function ($builder) use ($request) {
                $builder->where('semester_id', $request->integer('semester_id'))
                    ->orWhereNull('semester_id');
            });
        }
        if ($request->filled('tahun_ajaran')) {
            $query->where(function ($builder) use ($request) {
                $builder->where('tahun_ajaran', $request->input('tahun_ajaran'))
                    ->orWhereNull('tahun_ajaran');
            });
        }
        if ($request->filled('semester')) {
            $query->where(function ($builder) use ($request) {
                $builder->whereRaw('lower(semester) = ?', [strtolower((string) $request->input('semester'))])
                    ->orWhereNull('semester');
            });
        }

        $data = $query
            ->orderByRaw("CASE status WHEN 'Terlambat' THEN 1 WHEN 'Belum Lunas' THEN 2 WHEN 'Lunas' THEN 3 ELSE 4 END")
            ->orderBy('due_date')
            ->limit(min(max($request->integer('limit', 200), 1), 500))
            ->get()
            ->map(fn (PaymentBill $bill) => $this->billService->formatBill($bill))
            ->values();

        return response()->json([
            'success' => true,
            'summary' => $this->summary(),
            'data' => $data,
        ]);
    }

    public function rules()
    {
        return response()->json([
            'success' => true,
            'data' => PaymentBillRule::query()
                ->with(['paymentType:id,nama,periode,nominal_default,status', 'schoolClass:id,name'])
                ->orderBy('name')
                ->get(),
        ]);
    }

    public function studentSummary(Request $request)
    {
        $validated = $request->validate([
            'siswa_id' => 'required|integer|exists:siswa,id',
            'academic_year_id' => 'nullable|integer|exists:academic_years,id',
            'semester_id' => 'nullable|integer|exists:semesters,id',
            'tahun_ajaran' => 'nullable|string',
            'semester' => 'nullable|string',
            'status' => 'nullable|string',
            'payment_type_id' => 'nullable|integer|exists:payment_types,id',
        ]);

        $this->billService->reconcilePaidBillsForStudent((int) $validated['siswa_id']);
        $billIds = PaymentBill::query()
            ->where('siswa_id', (int) $validated['siswa_id'])
            ->when(!empty($validated['academic_year_id']), fn ($query) => $query->where('academic_year_id', (int) $validated['academic_year_id']))
            ->when(!empty($validated['semester_id']), fn ($query) => $query->where('semester_id', (int) $validated['semester_id']))
            ->pluck('id');
        $this->billService->recalculateBills($billIds);
        $this->billService->refreshOverdue();

        return response()->json([
            'success' => true,
            'data' => $this->studentBillingSummary->forStudent((int) $validated['siswa_id'], $validated),
        ]);
    }

    public function monthlyOptions(Request $request)
    {
        $validated = $request->validate([
            'siswa_id' => 'required|integer|exists:siswa,id',
            'payment_type_id' => 'required|integer|exists:payment_types,id',
            'academic_year_id' => 'required|integer|exists:academic_years,id',
            'semester_id' => 'nullable|integer|exists:semesters,id',
        ]);

        $exists = DB::table('siswa_tahun_ajaran')
            ->where('siswa_id', $validated['siswa_id'])
            ->where('academic_year_id', $validated['academic_year_id'])
            ->when(isset($validated['semester_id']), fn ($query) => $query->where('semester_id', $validated['semester_id']))
            ->where('is_active', true)
            ->exists();
        if (!$exists) {
            return response()->json([
                'success' => false,
                'message' => 'Data santri belum tersedia di tahun ajaran ini. Silakan sinkronisasi data santri terlebih dahulu di Setting Akademik.',
            ], 422);
        }

        $this->billService->refreshOverdue();

        return response()->json([
            'success' => true,
            'data' => $this->billService->monthlyOptions(
                (int) $validated['siswa_id'],
                (int) $validated['payment_type_id'],
                (int) $validated['academic_year_id'],
                isset($validated['semester_id']) ? (int) $validated['semester_id'] : null,
            ),
        ]);
    }

    public function generate(Request $request)
    {
        $validated = $request->validate([
            'rule_id' => 'nullable|integer|exists:payment_bill_rules,id',
            'through' => 'nullable|date',
        ]);

        $count = $this->billService->generateDueBills(
            isset($validated['through']) ? Carbon::parse($validated['through']) : null,
            $validated['rule_id'] ?? null
        );
        $this->billService->refreshOverdue();

        return response()->json([
            'success' => true,
            'message' => 'Generate tagihan selesai',
            'count' => $count,
            'summary' => $this->summary(),
        ]);
    }

    public function notify(Request $request, PaymentBill $paymentBill)
    {
        $actor = app(ActorResolver::class)->active($request);
        $notification = PaymentBillNotification::query()->create([
            'payment_bill_id' => $paymentBill->id,
            'recipient_user_id' => $paymentBill->wali_id,
            'channel' => 'in_app',
            'schedule_type' => 'manual',
            'scheduled_for' => now()->toDateString(),
            'sent_at' => now(),
            'status' => 'sent',
            'message' => $request->input('message') ?: "Tagihan {$paymentBill->title} menunggu pembayaran.",
            'metadata' => [
                'sent_by_user_id' => $actor?->id,
                'future_channels' => ['whatsapp', 'email'],
            ],
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Notifikasi tagihan dicatat',
            'data' => $notification,
        ]);
    }

    private function summary(): array
    {
        return [
            'total_tagihan_hari_ini' => (int) PaymentBill::query()
                ->whereDate('due_date', now()->toDateString())
                ->whereIn('status', ['Belum Lunas', 'Terlambat'])
                ->sum('amount'),
            'total_tagihan_bulan_ini' => (int) PaymentBill::query()
                ->whereYear('due_date', now()->year)
                ->whereMonth('due_date', now()->month)
                ->whereIn('status', ['Belum Lunas', 'Terlambat'])
                ->sum('amount'),
            'total_sudah_dibayar' => (int) PaymentBill::query()->where('status', 'Lunas')->sum('amount'),
            'total_belum_lunas' => (int) PaymentBill::query()->where('status', 'Belum Lunas')->sum('amount'),
            'total_terlambat' => (int) PaymentBill::query()->where('status', 'Terlambat')->sum('amount'),
            'rekap_per_jenis' => PaymentBill::query()
                ->select('payment_type_id', DB::raw('sum(amount) as total'), DB::raw('count(*) as jumlah'))
                ->with('paymentType:id,nama')
                ->groupBy('payment_type_id')
                ->get(),
        ];
    }
}
