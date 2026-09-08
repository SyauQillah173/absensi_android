<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Pengeluaran;
use App\Services\AcademicPeriodService;
use App\Services\AuditLogService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class PetugasPengajuanController extends Controller
{
    /**
     * GET /api/petugas/pengeluaran
     * Mengambil daftar riwayat pengajuan anggaran oleh petugas yang sedang login.
     */
    public function index(Request $request)
    {
        $user = Auth::user();
        $userId = $user->id;

        $query = Pengeluaran::with(['penginput:id,name', 'academicYear:id,name', 'semester:id,name'])
            ->where('diinput_oleh', $userId);

        // Filter Pos Pengeluaran
        if ($request->filled('pos_pengeluaran') && in_array(strtolower($request->pos_pengeluaran), ['pondok', 'madin'], true)) {
            $query->where('pos_pengeluaran', strtolower($request->pos_pengeluaran));
        }

        // Filter Kategori
        if ($request->filled('kategori') && $request->kategori !== 'all') {
            $query->where('kategori', $request->kategori);
        }

        // Filter Search Keyword
        if ($request->filled('search')) {
            $search = trim($request->search);
            $query->where(function ($q) use ($search) {
                $q->where('judul', 'like', "%{$search}%")
                  ->orWhere('keterangan', 'like', "%{$search}%")
                  ->orWhere('no_transaksi', 'like', "%{$search}%")
                  ->orWhere('kategori', 'like', "%{$search}%");
            });
        }

        // Urutkan dari pengajuan paling mutakhir (detik terbaru)
        $list = $query->orderByDesc('created_at')->get();

        // Agregasi Statistik Khusus Petugas Ini
        $allUserExpenses = Pengeluaran::where('diinput_oleh', $userId);
        $totalNominalSaya = (int) (clone $allUserExpenses)->sum('jumlah');
        $totalPondokSaya = (int) (clone $allUserExpenses)->where('pos_pengeluaran', 'pondok')->sum('jumlah');
        $totalMadinSaya = (int) (clone $allUserExpenses)->where('pos_pengeluaran', 'madin')->sum('jumlah');
        $countPengajuanSaya = (int) (clone $allUserExpenses)->count();

        $now = now();
        $totalBulanIniSaya = (int) (clone $allUserExpenses)
            ->whereYear('tanggal', $now->year)
            ->whereMonth('tanggal', $now->month)
            ->sum('jumlah');

        $totalHariIniSaya = (int) (clone $allUserExpenses)
            ->whereDate('tanggal', $now->toDateString())
            ->sum('jumlah');

        // Kategori Pengeluaran Umum untuk Preset
        $defaultCategories = [
            'Konsumsi & Dapur',
            'Operasional & Utilitas',
            'Kitab & Buku Pelajaran',
            'Bisyarah / Honor Guru',
            'Sarana & Prasarana',
            'Kegiatan & Lomba Santri',
            'ATK & Percetakan',
            'Kesehatan & Poskestren',
            'Perawatan Gedung',
            'Lain-lain',
        ];

        return response()->json([
            'success' => true,
            'data' => $list,
            'summary' => [
                'total_nominal' => $totalNominalSaya,
                'total_pondok' => $totalPondokSaya,
                'total_madin' => $totalMadinSaya,
                'total_transaksi' => $countPengajuanSaya,
                'total_bulan_ini' => $totalBulanIniSaya,
                'total_hari_ini' => $totalHariIniSaya,
                'categories' => $defaultCategories,
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'role' => $user->role,
                    'admin_type' => $user->admin_type,
                ],
            ],
        ]);
    }

    /**
     * POST /api/petugas/pengeluaran
     * Petugas mengajukan anggaran baru.
     * Otomatis langsung tercatat ke kas bendahara dan langsung memotong saldo kas.
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'judul' => 'required|string|max:255',
            'jumlah' => 'required|numeric|min:1',
            'pos_pengeluaran' => 'required|string|in:pondok,madin',
            'kategori' => 'nullable|string|max:255',
            'keterangan' => 'nullable|string',
            'bukti_foto' => 'nullable|file|mimes:jpeg,png,jpg,webp,pdf|max:5120',
        ], [
            'judul.required' => 'Judul pengajuan anggaran wajib diisi.',
            'jumlah.required' => 'Nominal pengajuan wajib diisi.',
            'jumlah.min' => 'Nominal pengajuan minimal Rp 1.',
            'pos_pengeluaran.required' => 'Pos pengeluaran (Pondok atau Madin) wajib dipilih.',
            'pos_pengeluaran.in' => 'Pos pengeluaran harus berupa Pondok atau Madin.',
            'bukti_foto.max' => 'Ukuran file bukti kuitansi maksimal 5MB.',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => $validator->errors()->first(),
                'errors' => $validator->errors(),
            ], 422);
        }

        $user = Auth::user();
        $validated = $validator->validated();

        // 1. Simpan fisik file bukti kuitansi jika diunggah
        $buktiPath = null;
        if ($request->hasFile('bukti_foto')) {
            $file = $request->file('bukti_foto');
            $buktiPath = $file->store('bukti_pengeluaran', 'public');
        }

        // 2. Resolve Periode Akademik Aktif
        $activePeriod = app(AcademicPeriodService::class)->active();

        // 3. Generate Kode Transaksi Unik
        $noTransaksi = $this->generateExpenseCode();

        // 4. Data Transaksi Pengeluaran
        $pengeluaran = Pengeluaran::create([
            'no_transaksi' => $noTransaksi,
            'judul' => trim($validated['judul']),
            'jumlah' => (int) $validated['jumlah'],
            'tanggal' => now()->toDateString(),
            'pos_pengeluaran' => strtolower($validated['pos_pengeluaran']),
            'kategori' => $validated['kategori'] ?: 'Operasional & Utilitas',
            'keterangan' => $validated['keterangan'] ? trim($validated['keterangan']) : null,
            'bukti_foto' => $buktiPath,
            'diinput_oleh' => $user->id,
            'nama_petugas' => $user->name,
            'dibayarkan_kepada' => $user->name,
            'status_pengajuan' => 'tercatat',
            'metode_pembayaran' => 'Kas Bendahara (Tunai)',
            'academic_year_id' => $activePeriod['academic_year_id'] ?? null,
            'semester_id' => $activePeriod['semester_id'] ?? null,
        ]);

        // 5. Audit Log
        try {
            app(AuditLogService::class)->record($request, 'pengeluaran', 'petugas_pengajuan_anggaran', $pengeluaran, null, [
                'nominal' => $pengeluaran->jumlah,
                'pos' => $pengeluaran->pos_pengeluaran,
                'petugas' => $user->name,
            ]);
        } catch (\Throwable $e) {
            // Ignore audit fail
        }

        return response()->json([
            'success' => true,
            'message' => 'Pengajuan anggaran berhasil disimpan! Kas bendahara langsung terpotong secara otomatis.',
            'data' => $pengeluaran->load(['penginput:id,name', 'academicYear:id,name', 'semester:id,name']),
        ], 201);
    }

    /**
     * Generate sequential/random transaction code (OUT-YYYYMMDD-XXXX)
     */
    private function generateExpenseCode(): string
    {
        $prefix = 'OUT-' . date('Ymd') . '-';
        $latest = Pengeluaran::where('no_transaksi', 'like', "{$prefix}%")
            ->orderByDesc('id')
            ->value('no_transaksi');

        if ($latest && preg_match('/-(\d{4})$/', $latest, $matches)) {
            $seq = (int) $matches[1] + 1;
        } else {
            $seq = 1;
        }

        return $prefix . str_pad((string) $seq, 4, '0', STR_PAD_LEFT);
    }
}
