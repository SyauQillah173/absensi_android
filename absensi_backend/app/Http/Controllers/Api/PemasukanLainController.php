<?php

namespace App\Http\Controllers\Api;

use App\Exports\RekapPemasukanLainExport;
use App\Http\Controllers\Controller;
use App\Models\DocumentSetting;
use App\Models\PemasukanLain;
use App\Services\AcademicPeriodService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Maatwebsite\Excel\Facades\Excel;

class PemasukanLainController extends Controller
{
    public function index(Request $request)
    {
        $query = PemasukanLain::with(['penginput:id,name', 'academicYear:id,name', 'semester:id,name']);

        // 1. Search Query Filter
        if ($request->filled('search')) {
            $search = '%' . trim($request->search) . '%';
            $query->where(function ($q) use ($search) {
                $q->where('judul', 'like', $search)
                    ->orWhere('no_transaksi', 'like', $search)
                    ->orWhere('kategori', 'like', $search)
                    ->orWhere('sumber_dana', 'like', $search)
                    ->orWhere('diterima_dari', 'like', $search)
                    ->orWhere('keterangan', 'like', $search)
                    ->orWhereHas('penginput', function ($qu) use ($search) {
                        $qu->where('name', 'like', $search);
                    });
            });
        }

        // 2. Kategori Filter
        if ($request->filled('kategori') && $request->kategori !== 'all') {
            $query->where('kategori', $request->kategori);
        }

        // 3. Sumber Dana Filter
        if ($request->filled('sumber_dana') && $request->sumber_dana !== 'all') {
            $query->where('sumber_dana', $request->sumber_dana);
        }

        // 4. Academic Period Filters
        if ($request->filled('academic_year_id')) {
            $query->where('academic_year_id', $request->academic_year_id);
        }
        if ($request->filled('semester_id')) {
            $query->where('semester_id', $request->semester_id);
        }

        // 5. Date Range Filter
        if ($request->filled('start_date')) {
            $query->whereDate('tanggal', '>=', $request->start_date);
        }
        if ($request->filled('end_date')) {
            $query->whereDate('tanggal', '<=', $request->end_date);
        }

        $pemasukanList = $query->orderBy('tanggal', 'desc')->orderBy('id', 'desc')->get();

        // 6. Realtime Summary Statistics
        $now = Carbon::now();
        $todayStr = $now->toDateString();
        $thisMonthStr = $now->format('Y-m');

        $totalFiltered = (int) $pemasukanList->sum('jumlah');
        $totalToday = (int) PemasukanLain::whereDate('tanggal', $todayStr)->sum('jumlah');
        $totalThisMonth = (int) PemasukanLain::where('tanggal', 'like', "{$thisMonthStr}%")->sum('jumlah');
        $totalAll = (int) PemasukanLain::sum('jumlah');
        $countTotal = $pemasukanList->count();

        // Group by category
        $kategoriBreakdown = PemasukanLain::select('kategori', DB::raw('SUM(jumlah) as total_nominal'), DB::raw('COUNT(*) as total_transaksi'))
            ->groupBy('kategori')
            ->orderByDesc('total_nominal')
            ->get()
            ->map(fn ($row) => [
                'kategori' => $row->kategori ?: 'Lain-lain',
                'total_nominal' => (int) $row->total_nominal,
                'total_transaksi' => (int) $row->total_transaksi,
            ]);

        // Default suggestions
        $defaultCategories = [
            'Infaq & Shodaqoh',
            'Donasi Pembangunan',
            'Bantuan Yayasan',
            'Dana BOS / Hibah',
            'Unit Usaha / Koperasi',
            'Sumbangan Alumni',
            'Sumbangan Wali Santri',
            'Kas Awal Bendahara',
            'Lain-lain'
        ];

        $existingCategories = PemasukanLain::whereNotNull('kategori')
            ->distinct()
            ->pluck('kategori')
            ->filter()
            ->values()
            ->all();

        $allCategories = collect(array_merge($defaultCategories, $existingCategories))->unique()->values()->all();

        return response()->json([
            'success' => true,
            'data' => $pemasukanList,
            'summary' => [
                'total_filtered' => $totalFiltered,
                'total_today' => $totalToday,
                'total_this_month' => $totalThisMonth,
                'total_all' => $totalAll,
                'total_count' => $countTotal,
                'kategori_breakdown' => $kategoriBreakdown,
                'categories' => $allCategories,
            ],
        ]);
    }

    public function show($id)
    {
        $pemasukan = PemasukanLain::with(['penginput:id,name', 'academicYear:id,name', 'semester:id,name'])->find($id);
        if (!$pemasukan) {
            return response()->json(['success' => false, 'message' => 'Data tidak ditemukan'], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $pemasukan,
        ]);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'judul' => 'required|string|max:255',
            'jumlah' => 'required|numeric|min:1',
            'tanggal' => 'required|date',
            'kategori' => 'nullable|string|max:100',
            'sumber_dana' => 'nullable|string|max:100',
            'diterima_dari' => 'nullable|string|max:255',
            'keterangan' => 'nullable|string',
            'bukti_foto' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
        }

        $activePeriod = app(AcademicPeriodService::class)->getActiveAcademicPeriod();

        $noTransaksi = $this->generateIncomeCode();

        $userId = Auth::id() ?: ($request->user_id ?: 1);

        $pemasukan = PemasukanLain::create([
            'no_transaksi' => $noTransaksi,
            'judul' => $request->judul,
            'kategori' => $request->kategori ?: 'Infaq & Shodaqoh',
            'sumber_dana' => $request->sumber_dana ?: 'Kas Tunai Bendahara',
            'jumlah' => $request->jumlah,
            'tanggal' => $request->tanggal,
            'diterima_dari' => $request->diterima_dari,
            'keterangan' => $request->keterangan,
            'bukti_foto' => $request->bukti_foto,
            'user_id' => $userId,
            'academic_year_id' => $activePeriod['academic_year_id'] ?? null,
            'semester_id' => $activePeriod['semester_id'] ?? null,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Pemasukan kas berhasil dicatat',
            'data' => $pemasukan->load(['penginput:id,name', 'academicYear:id,name', 'semester:id,name']),
        ], 201);
    }

    public function update(Request $request, $id)
    {
        $pemasukan = PemasukanLain::find($id);
        if (!$pemasukan) {
            return response()->json(['success' => false, 'message' => 'Data tidak ditemukan'], 404);
        }

        $validator = Validator::make($request->all(), [
            'judul' => 'sometimes|required|string|max:255',
            'jumlah' => 'sometimes|required|numeric|min:1',
            'tanggal' => 'sometimes|required|date',
            'kategori' => 'nullable|string|max:100',
            'sumber_dana' => 'nullable|string|max:100',
            'diterima_dari' => 'nullable|string|max:255',
            'keterangan' => 'nullable|string',
            'bukti_foto' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
        }

        $pemasukan->update($request->only([
            'judul',
            'jumlah',
            'tanggal',
            'kategori',
            'sumber_dana',
            'diterima_dari',
            'keterangan',
            'bukti_foto',
        ]));

        return response()->json([
            'success' => true,
            'message' => 'Data pemasukan kas berhasil diperbarui',
            'data' => $pemasukan->fresh(['penginput:id,name', 'academicYear:id,name', 'semester:id,name']),
        ]);
    }

    public function destroy($id)
    {
        $pemasukan = PemasukanLain::find($id);
        if (!$pemasukan) {
            return response()->json(['success' => false, 'message' => 'Data tidak ditemukan'], 404);
        }

        $pemasukan->delete();

        return response()->json([
            'success' => true,
            'message' => 'Data pemasukan kas berhasil dihapus',
        ]);
    }

    public function export(Request $request)
    {
        $query = PemasukanLain::with(['penginput:id,name', 'academicYear:id,name', 'semester:id,name']);

        if ($request->filled('search')) {
            $search = '%' . trim($request->search) . '%';
            $query->where(function ($q) use ($search) {
                $q->where('judul', 'like', $search)
                    ->orWhere('no_transaksi', 'like', $search)
                    ->orWhere('kategori', 'like', $search)
                    ->orWhere('sumber_dana', 'like', $search)
                    ->orWhere('diterima_dari', 'like', $search);
            });
        }

        if ($request->filled('kategori') && $request->kategori !== 'all') {
            $query->where('kategori', $request->kategori);
        }

        if ($request->filled('sumber_dana') && $request->sumber_dana !== 'all') {
            $query->where('sumber_dana', $request->sumber_dana);
        }

        if ($request->filled('start_date')) {
            $query->whereDate('tanggal', '>=', $request->start_date);
        }
        if ($request->filled('end_date')) {
            $query->whereDate('tanggal', '<=', $request->end_date);
        }

        $pemasukanList = $query->orderBy('tanggal', 'desc')->get();

        $docSetting = DocumentSetting::first();

        $filters = [
            'kategori' => $request->kategori,
            'sumber_dana' => $request->sumber_dana,
            'start_date' => $request->start_date,
            'end_date' => $request->end_date,
            'periode_label' => $this->getPeriodeLabel($request),
        ];

        $filename = 'Rekap_Pemasukan_Kas_' . now()->format('Ymd_His') . '.xlsx';

        return Excel::download(new RekapPemasukanLainExport($pemasukanList, $filters, $docSetting), $filename);
    }

    private function generateIncomeCode(): string
    {
        $today = Carbon::now()->format('Ymd');
        $prefix = "IN-{$today}-";

        $lastRecord = PemasukanLain::where('no_transaksi', 'like', "{$prefix}%")
            ->orderBy('id', 'desc')
            ->first();

        if ($lastRecord && preg_match('/-(\d{4})$/', $lastRecord->no_transaksi, $matches)) {
            $sequence = (int) $matches[1] + 1;
        } else {
            $sequence = 1;
        }

        return $prefix . sprintf('%04d', $sequence);
    }

    private function getPeriodeLabel(Request $request): string
    {
        if ($request->filled('start_date') && $request->filled('end_date')) {
            return Carbon::parse($request->start_date)->format('d/m/Y') . ' s/d ' . Carbon::parse($request->end_date)->format('d/m/Y');
        }
        if ($request->filled('start_date')) {
            return 'Sejak ' . Carbon::parse($request->start_date)->format('d/m/Y');
        }
        if ($request->filled('end_date')) {
            return 'Sampai ' . Carbon::parse($request->end_date)->format('d/m/Y');
        }
        return 'Semua Periode';
    }
}
