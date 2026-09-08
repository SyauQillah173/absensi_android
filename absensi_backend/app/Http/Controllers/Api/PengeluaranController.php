<?php

namespace App\Http\Controllers\Api;

use App\Exports\RekapPengeluaranExport;
use App\Http\Controllers\Controller;
use App\Models\DocumentSetting;
use App\Models\Pembayaran;
use App\Models\PemasukanLain;
use App\Models\Pengeluaran;
use App\Services\AcademicPeriodService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Maatwebsite\Excel\Facades\Excel;

class PengeluaranController extends Controller
{
    public function index(Request $request)
    {
        $query = Pengeluaran::with(['penginput:id,name', 'academicYear:id,name', 'semester:id,name']);

        // 1. Search Query Filter
        if ($request->filled('search')) {
            $search = '%' . trim($request->search) . '%';
            $query->where(function ($q) use ($search) {
                $q->where('judul', 'like', $search)
                  ->orWhere('no_transaksi', 'like', $search)
                  ->orWhere('dibayarkan_kepada', 'like', $search)
                  ->orWhere('kategori', 'like', $search)
                  ->orWhere('keterangan', 'like', $search)
                  ->orWhereHas('penginput', fn ($u) => $u->where('name', 'like', $search));
            });
        }

        // 2. Pos Pengeluaran Filter (Pondok vs Madin)
        if ($request->filled('pos_pengeluaran') && $request->pos_pengeluaran !== 'all') {
            $query->where('pos_pengeluaran', strtolower($request->pos_pengeluaran));
        }

        // 3. Kategori Filter
        if ($request->filled('kategori') && $request->kategori !== 'all') {
            $query->where('kategori', $request->kategori);
        }

        // 4. Metode Pembayaran Filter
        if ($request->filled('metode_pembayaran') && $request->metode_pembayaran !== 'all') {
            $query->where('metode_pembayaran', $request->metode_pembayaran);
        }

        // 5. Academic Year & Semester & Year Filter
        if ($request->filled('academic_year_id') && $request->academic_year_id !== 'all') {
            $query->where('academic_year_id', $request->academic_year_id);
        }
        if ($request->filled('semester_id') && $request->semester_id !== 'all') {
            $query->where('semester_id', $request->semester_id);
        }
        if ($request->filled('year') && $request->year !== 'all') {
            $query->whereYear('tanggal', $request->year);
        }

        // 6. Date Range Filter
        if ($request->filled('start_date')) {
            $query->whereDate('tanggal', '>=', $request->start_date);
        }
        if ($request->filled('end_date')) {
            $query->whereDate('tanggal', '<=', $request->end_date);
        }

        // Clone query for stats
        $statsQuery = clone $query;
        $pengeluaranList = $query->orderBy('tanggal', 'desc')->orderBy('id', 'desc')->get();

        // 7. Calculate Realtime Summary Statistics
        $now = Carbon::now();
        $todayStr = $now->toDateString();
        $thisMonthStr = $now->format('Y-m');

        $totalFiltered = (int) $pengeluaranList->sum('jumlah');
        $totalToday = (int) Pengeluaran::whereDate('tanggal', $todayStr)->sum('jumlah');
        $totalThisMonth = (int) Pengeluaran::where('tanggal', 'like', "{$thisMonthStr}%")->sum('jumlah');
        $totalPengeluaranAll = (int) Pengeluaran::sum('jumlah');
        $countTotal = $pengeluaranList->count();

        // Pos Breakdown (All Time)
        $totalPondokAll = (int) Pengeluaran::where(function ($q) {
            $q->where('pos_pengeluaran', 'pondok')->orWhereNull('pos_pengeluaran');
        })->sum('jumlah');
        $totalMadinAll = (int) Pengeluaran::where('pos_pengeluaran', 'madin')->sum('jumlah');

        // Pos Breakdown (Filtered / Current View)
        $totalPondokFiltered = (int) $pengeluaranList->filter(fn ($p) => strtolower($p->pos_pengeluaran ?? 'pondok') === 'pondok')->sum('jumlah');
        $totalMadinFiltered = (int) $pengeluaranList->filter(fn ($p) => strtolower($p->pos_pengeluaran ?? 'pondok') === 'madin')->sum('jumlah');
        $countPondokFiltered = $pengeluaranList->filter(fn ($p) => strtolower($p->pos_pengeluaran ?? 'pondok') === 'pondok')->count();
        $countMadinFiltered = $pengeluaranList->filter(fn ($p) => strtolower($p->pos_pengeluaran ?? 'pondok') === 'madin')->count();

        // 8. Calculate Treasury Inflow (Pemasukan Siswa + Pemasukan Sumber Dana Lain - 1 PINTU TERPADU)
        $totalPemasukanSiswa = (int) Pembayaran::whereNotIn('status', ['Dibatalkan', 'Batal'])->sum('jumlah');
        $totalPemasukanBulanIni = (int) Pembayaran::whereNotIn('status', ['Dibatalkan', 'Batal'])->where('tanggal', 'like', "{$thisMonthStr}%")->sum('jumlah');
        $totalPemasukanHariIni = (int) Pembayaran::whereNotIn('status', ['Dibatalkan', 'Batal'])->whereDate('tanggal', $todayStr)->sum('jumlah');

        $totalPemasukanLain = (int) PemasukanLain::sum('jumlah');
        $totalPemasukanLainBulanIni = (int) PemasukanLain::where('tanggal', 'like', "{$thisMonthStr}%")->sum('jumlah');
        $totalPemasukanLainHariIni = (int) PemasukanLain::whereDate('tanggal', $todayStr)->sum('jumlah');

        $totalSeluruhPemasukan = $totalPemasukanSiswa + $totalPemasukanLain;
        $totalSeluruhPemasukanBulanIni = $totalPemasukanBulanIni + $totalPemasukanLainBulanIni;
        $totalSeluruhPemasukanHariIni = $totalPemasukanHariIni + $totalPemasukanLainHariIni;

        // Net Cash Balance (Sisa Saldo Kas Bersih = Pemasukan Terpadu - (Pengeluaran Pondok + Pengeluaran Madin))
        $saldoKasBersih = $totalSeluruhPemasukan - $totalPengeluaranAll;
        $saldoKasBulanIni = $totalSeluruhPemasukanBulanIni - $totalThisMonth;
        $saldoKasHariIni = $totalSeluruhPemasukanHariIni - $totalToday;

        // Group by category for chart/breakdown
        $kategoriBreakdown = Pengeluaran::select('kategori', DB::raw('SUM(jumlah) as total_nominal'), DB::raw('COUNT(*) as total_transaksi'))
            ->groupBy('kategori')
            ->orderByDesc('total_nominal')
            ->get()
            ->map(fn ($row) => [
                'kategori' => $row->kategori ?: 'Lain-lain',
                'total_nominal' => (int) $row->total_nominal,
                'total_transaksi' => (int) $row->total_transaksi,
            ]);

        // Distinct existing categories in DB + Standard Suggestions
        $existingCategories = Pengeluaran::whereNotNull('kategori')
            ->distinct()
            ->pluck('kategori')
            ->filter()
            ->values()
            ->all();

        $defaultCategories = [
            'Konsumsi & Dapur',
            'Operasional & Utilitas',
            'Honor & Gaji Asatidz',
            'Sarana & Prasarana',
            'Kegiatan & Lomba Santri',
            'ATK & Percetakan',
            'Kesehatan & Kebersihan',
            'Perawatan Gedung',
            'Lain-lain'
        ];

        $allCategories = collect(array_merge($defaultCategories, $existingCategories))->unique()->values()->all();

        return response()->json([
            'success' => true,
            'data' => $pengeluaranList,
            'summary' => [
                'total_filtered' => $totalFiltered,
                'total_today' => $totalToday,
                'total_this_month' => $totalThisMonth,
                'total_pengeluaran_all' => $totalPengeluaranAll,
                'total_count' => $countTotal,
                'total_pondok' => $totalPondokAll,
                'total_madin' => $totalMadinAll,
                'total_pondok_filtered' => $totalPondokFiltered,
                'total_madin_filtered' => $totalMadinFiltered,
                'count_pondok_filtered' => $countPondokFiltered,
                'count_madin_filtered' => $countMadinFiltered,
                'total_pemasukan' => $totalSeluruhPemasukan,
                'total_pemasukan_siswa' => $totalPemasukanSiswa,
                'total_pemasukan_lain' => $totalPemasukanLain,
                'total_pemasukan_bulan_ini' => $totalSeluruhPemasukanBulanIni,
                'total_pemasukan_hari_ini' => $totalSeluruhPemasukanHariIni,
                'saldo_kas_bersih' => $saldoKasBersih,
                'saldo_kas_bulan_ini' => $saldoKasBulanIni,
                'saldo_kas_hari_ini' => $saldoKasHariIni,
                'kategori_breakdown' => $kategoriBreakdown,
                'categories' => $allCategories,
            ],
        ]);
    }

    public function show($id)
    {
        $pengeluaran = Pengeluaran::with(['penginput:id,name', 'academicYear:id,name', 'semester:id,name'])->find($id);
        if (!$pengeluaran) {
            return response()->json(['success' => false, 'message' => 'Data tidak ditemukan'], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $pengeluaran
        ]);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'judul' => 'required|string|max:255',
            'jumlah' => 'required|numeric|min:0',
            'tanggal' => 'required|date',
            'pos_pengeluaran' => 'nullable|string|in:pondok,madin',
            'kategori' => 'nullable|string|max:255',
            'metode_pembayaran' => 'nullable|string|max:50',
            'dibayarkan_kepada' => 'nullable|string|max:255',
            'keterangan' => 'nullable|string',
            'academic_year_id' => 'nullable|integer',
            'semester_id' => 'nullable|integer',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => $validator->errors()->first()
            ], 422);
        }

        $data = $validator->validated();

        // 1. Resolve User
        $data['diinput_oleh'] = Auth::id() ?? ($request->user_id ?? 1);

        // 2. Resolve Active Academic Period if not provided
        if (empty($data['academic_year_id'])) {
            $activePeriod = app(AcademicPeriodService::class)->active();
            $data['academic_year_id'] = $activePeriod['academic_year_id'] ?? null;
            if (empty($data['semester_id'])) {
                $data['semester_id'] = $activePeriod['semester_id'] ?? null;
            }
        }

        // 3. Pos Pengeluaran default to 'pondok' if empty
        $data['pos_pengeluaran'] = strtolower($data['pos_pengeluaran'] ?? 'pondok');

        // 4. Generate sequential/random transaction code (OUT-YYYYMMDD-XXXX)
        $data['no_transaksi'] = $this->generateExpenseCode();
        $data['metode_pembayaran'] = $data['metode_pembayaran'] ?? 'Tunai';

        $pengeluaran = Pengeluaran::create($data);

        return response()->json([
            'success' => true,
            'message' => 'Pengeluaran kas keluar berhasil dicatat',
            'data' => $pengeluaran->load(['penginput:id,name', 'academicYear:id,name', 'semester:id,name'])
        ], 201);
    }

    public function update(Request $request, $id)
    {
        $pengeluaran = Pengeluaran::find($id);
        if (!$pengeluaran) {
            return response()->json(['success' => false, 'message' => 'Data tidak ditemukan'], 404);
        }

        $validator = Validator::make($request->all(), [
            'judul' => 'sometimes|required|string|max:255',
            'jumlah' => 'sometimes|required|numeric|min:0',
            'tanggal' => 'sometimes|required|date',
            'pos_pengeluaran' => 'nullable|string|in:pondok,madin',
            'kategori' => 'nullable|string|max:255',
            'metode_pembayaran' => 'nullable|string|max:50',
            'dibayarkan_kepada' => 'nullable|string|max:255',
            'keterangan' => 'nullable|string',
            'academic_year_id' => 'nullable|integer',
            'semester_id' => 'nullable|integer',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => $validator->errors()->first()
            ], 422);
        }

        $updateData = $validator->validated();
        if (isset($updateData['pos_pengeluaran'])) {
            $updateData['pos_pengeluaran'] = strtolower($updateData['pos_pengeluaran']);
        }

        $pengeluaran->update($updateData);

        return response()->json([
            'success' => true,
            'message' => 'Data pengeluaran berhasil diperbarui',
            'data' => $pengeluaran->fresh(['penginput:id,name', 'academicYear:id,name', 'semester:id,name'])
        ]);
    }

    public function destroy($id)
    {
        $pengeluaran = Pengeluaran::find($id);
        if (!$pengeluaran) {
            return response()->json(['success' => false, 'message' => 'Data tidak ditemukan'], 404);
        }

        $pengeluaran->delete();

        return response()->json([
            'success' => true,
            'message' => 'Catatan pengeluaran berhasil dihapus'
        ]);
    }

    public function export(Request $request)
    {
        $query = Pengeluaran::with(['penginput:id,name', 'academicYear:id,name', 'semester:id,name']);

        if ($request->filled('search')) {
            $search = '%' . trim($request->search) . '%';
            $query->where(function ($q) use ($search) {
                $q->where('judul', 'like', $search)
                  ->orWhere('no_transaksi', 'like', $search)
                  ->orWhere('dibayarkan_kepada', 'like', $search)
                  ->orWhere('kategori', 'like', $search)
                  ->orWhere('keterangan', 'like', $search);
            });
        }

        if ($request->filled('pos_pengeluaran') && $request->pos_pengeluaran !== 'all') {
            $query->where('pos_pengeluaran', strtolower($request->pos_pengeluaran));
        }

        if ($request->filled('kategori') && $request->kategori !== 'all') {
            $query->where('kategori', $request->kategori);
        }

        if ($request->filled('metode_pembayaran') && $request->metode_pembayaran !== 'all') {
            $query->where('metode_pembayaran', $request->metode_pembayaran);
        }

        if ($request->filled('academic_year_id') && $request->academic_year_id !== 'all') {
            $query->where('academic_year_id', $request->academic_year_id);
        }
        if ($request->filled('semester_id') && $request->semester_id !== 'all') {
            $query->where('semester_id', $request->semester_id);
        }
        if ($request->filled('year') && $request->year !== 'all') {
            $query->whereYear('tanggal', $request->year);
        }

        if ($request->filled('start_date')) {
            $query->whereDate('tanggal', '>=', $request->start_date);
        }
        if ($request->filled('end_date')) {
            $query->whereDate('tanggal', '<=', $request->end_date);
        }

        $data = $query->orderBy('tanggal', 'asc')->orderBy('id', 'asc')->get();

        $periodeLabel = 'Semua Periode';
        if ($request->filled('start_date') && $request->filled('end_date')) {
            $periodeLabel = Carbon::parse($request->start_date)->format('d/m/Y') . ' s/d ' . Carbon::parse($request->end_date)->format('d/m/Y');
        } elseif ($request->filled('start_date')) {
            $periodeLabel = 'Mulai ' . Carbon::parse($request->start_date)->format('d/m/Y');
        }

        $posLabel = 'Semua Pos (Pondok & Madin)';
        if ($request->filled('pos_pengeluaran') && $request->pos_pengeluaran !== 'all') {
            $posLabel = strtolower($request->pos_pengeluaran) === 'madin' ? 'Khusus Madrasah Diniyah (Madin)' : 'Khusus Pondok Pesantren';
        }

        $filters = [
            'periode_label' => $periodeLabel,
            'pos_pengeluaran' => $posLabel,
            'kategori' => $request->filled('kategori') && $request->kategori !== 'all' ? $request->kategori : 'Semua Kategori',
        ];

        $docSetting = DocumentSetting::query()->where('document_type', 'pembayaran')->first();

        $filename = 'Rekap_Pengeluaran_Kas_' . date('Ymd_His') . '.xlsx';

        return Excel::download(new RekapPengeluaranExport($data, $filters, $docSetting), $filename);
    }

    private function generateExpenseCode(): string
    {
        $prefix = 'OUT-' . date('Ymd') . '-';
        $random = strtoupper(substr(bin2hex(random_bytes(2)), 0, 4));
        return $prefix . $random;
    }
}
