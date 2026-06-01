<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Siswa;
use App\Models\Absensi;
use App\Models\AbsensiSholat;
use App\Models\Pembayaran;
use App\Models\Nilai;
use App\Models\Hafalan;
use App\Models\PaymentBill;
use App\Models\PaymentType;
use App\Services\PaymentBillService;
use App\Services\PaymentHistoryService;
use App\Services\ReferenceResolver;
use App\Services\StudentBillingSummaryService;
use Illuminate\Http\Request;

class WaliController extends Controller
{
    public function __construct(
        private readonly PaymentHistoryService $paymentHistoryService,
        private readonly PaymentBillService $billService,
        private readonly StudentBillingSummaryService $studentBillingSummary,
    ) {
    }

    /**
     * GET /api/wali/anak?wali_id=X
     * Daftar anak (siswa) yang terhubung ke akun wali
     */
    public function anak(Request $request)
    {
        $wali = $request->user();

        $siswa = Siswa::where('wali_id', $wali->id)
            ->orWhereHas('guardianProfile', fn ($query) => $query->where('user_id', $wali->id))
            ->select('id', 'nis', 'nisn', 'nama', 'kelas', 'class_id', 'jenis_kelamin', 'status', 'student_status_id')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $siswa,
        ]);
    }

    /**
     * GET /api/wali/absensi?siswa_id=X&bulan=Y&tahun=Z
     * Riwayat absensi anak — semua tanggal, terbaru duluan
     */
    public function absensi(Request $request)
    {
        $request->validate([
            'siswa_id' => 'required|integer|exists:siswa,id',
            'bulan' => 'nullable|integer|between:1,12',
            'tahun' => 'nullable|integer',
        ]);

        $siswa = $this->resolveOwnedChild($request, (int) $request->siswa_id);
        if (!$siswa) {
            return $this->forbiddenChildResponse();
        }

        $query = Absensi::where('siswa_id', $siswa->id);

        // Default: bulan ini
        $bulan = $request->bulan ?? now()->month;
        $tahun = $request->tahun ?? now()->year;
        $query->whereMonth('tanggal', $bulan)->whereYear('tanggal', $tahun);

        $data = $query->orderBy('tanggal', 'desc')->orderBy('created_at', 'desc')->get()
            ->unique(fn (Absensi $item) => implode('|', [
                optional($item->tanggal)->format('Y-m-d'),
                $item->class_id ?? $item->kelas ?? '-',
                $item->mapel_id ?? $item->mapel ?? '-',
                $item->jadwal_id ?? '-',
                $item->siswa_id,
            ]))
            ->values();

        // Statistik bulanan
        $stats = [
            'total' => $data->count(),
            'hadir' => $data->where('status', 'Hadir')->count(),
            'sakit' => $data->where('status', 'Sakit')->count(),
            'izin' => $data->where('status', 'Izin')->count(),
            'alfa' => $data->where('status', 'Alfa')->count(),
        ];

        // Group by tanggal for better display
        $grouped = $data->groupBy(function ($item) {
            return \Carbon\Carbon::parse($item->tanggal)->format('Y-m-d');
        })->map(function ($items, $tanggal) {
            return [
                'tanggal' => $tanggal,
                'hari' => \Carbon\Carbon::parse($items->first()->tanggal)->locale('id')->isoFormat('dddd'),
                'records' => $items->map(function ($a) {
                    return [
                        'id' => $a->id,
                        'mapel' => $a->mapel ?? '-',
                        'status' => $a->status,
                        'keterangan' => $a->keterangan,
                        'kelas' => $a->kelas,
                        'diinput_oleh' => $a->diinput_oleh,
                        'waktu' => $a->created_at->format('H:i'),
                    ];
                })->values(),
            ];
        })->values();

        // Info siswa
        return response()->json([
            'success' => true,
            'siswa' => $siswa,
            'bulan' => $bulan,
            'tahun' => $tahun,
            'stats' => $stats,
            'data' => $grouped,
        ]);
    }

    public function absensiSholat(Request $request)
    {
        $request->validate([
            'siswa_id' => 'required|integer|exists:siswa,id',
            'bulan' => 'nullable|integer|between:1,12',
            'tahun' => 'nullable|integer',
        ]);

        $siswa = $this->resolveOwnedChild($request, (int) $request->siswa_id);
        if (!$siswa) {
            return $this->forbiddenChildResponse();
        }

        $bulan = $request->bulan ?? now()->month;
        $tahun = $request->tahun ?? now()->year;
        $data = AbsensiSholat::query()
            ->with(['siswa:id,kelas,class_id', 'boardingRoom.complex', 'actor:id,name,role'])
            ->where('siswa_id', $siswa->id)
            ->whereMonth('tanggal', $bulan)
            ->whereYear('tanggal', $tahun)
            ->orderByDesc('tanggal')
            ->orderByDesc('created_at')
            ->get();

        $stats = [
            'total' => $data->count(),
            'masuk' => $data->where('status_code', 'M')->count(),
            'izin' => $data->where('status_code', 'I')->count(),
            'sakit' => $data->where('status_code', 'S')->count(),
            'kosong' => 0,
        ];

        $grouped = $data->groupBy(fn ($item) => $item->tanggal->format('Y-m-d'))
            ->map(function ($items, $tanggal) {
                return [
                    'tanggal' => $tanggal,
                    'hari' => \Carbon\Carbon::parse($tanggal)->locale('id')->isoFormat('dddd'),
                    'records' => $items->map(function (AbsensiSholat $row) {
                        return [
                            'id' => $row->id,
                            'status' => $row->status_label,
                            'status_code' => $row->status_code,
                            'keterangan' => $row->keterangan,
                            'kelas' => $row->siswa?->kelas,
                            'komplek' => $row->boardingRoom?->complex?->name,
                            'kamar' => $row->boardingRoom?->name,
                            'mapel' => 'Jamaah Sholat',
                            'diinput_oleh' => $row->actor?->name ?? $row->diinput_oleh,
                            'waktu' => $row->created_at?->format('H:i'),
                        ];
                    })->values(),
                ];
            })
            ->values();

        return response()->json([
            'success' => true,
            'siswa' => $siswa,
            'bulan' => $bulan,
            'tahun' => $tahun,
            'stats' => $stats,
            'data' => $grouped,
        ]);
    }

    /**
     * GET /api/wali/pembayaran?siswa_id=X
     * Riwayat & status pembayaran anak
     */
    public function pembayaran(Request $request)
    {
        $request->validate([
            'siswa_id' => 'required|integer|exists:siswa,id',
            'academic_year_id' => 'nullable|integer|exists:academic_years,id',
            'semester_id' => 'nullable|integer|exists:semesters,id',
            'tahun_ajaran' => 'nullable|string',
            'semester' => 'nullable|string',
            'status' => 'nullable|string',
            'payment_type_id' => 'nullable|integer|exists:payment_types,id',
        ]);

        $siswa = $this->resolveOwnedChild($request, (int) $request->siswa_id);
        if (!$siswa) {
            return $this->forbiddenChildResponse();
        }

        $paymentItems = Pembayaran::with('paymentType')
            ->where('siswa_id', $siswa->id)
            ->orderBy('tanggal', 'desc')
            ->get();
        $this->billService->generateDueBills();
        $this->billService->reconcilePaidBillsForStudent((int) $siswa->id);
        $this->billService->refreshOverdue();
        $billingSummary = $this->studentBillingSummary->forStudent($siswa, [
            'academic_year_id' => $request->input('academic_year_id'),
            'semester_id' => $request->input('semester_id'),
            'tahun_ajaran' => $request->input('tahun_ajaran'),
            'semester' => $request->input('semester'),
            'status' => $request->input('status'),
            'payment_type_id' => $request->input('payment_type_id'),
        ]);
        $transactions = $this->paymentHistoryService->getTransactions([
            'siswa_id' => (int) $siswa->id,
            'academic_year_id' => $request->input('academic_year_id'),
            'semester_id' => $request->input('semester_id'),
            'tahun_ajaran' => $request->input('tahun_ajaran'),
            'semester' => $request->input('semester'),
        ]);

        $tagihan = PaymentBill::query()
            ->with(['paymentType', 'siswa:id,nama,nis,kelas,wali_id'])
            ->where('siswa_id', $siswa->id)
            ->when($request->filled('academic_year_id'), fn ($query) => $query->where('academic_year_id', $request->integer('academic_year_id')))
            ->when($request->filled('semester_id'), fn ($query) => $query->where('semester_id', $request->integer('semester_id')))
            ->when($request->filled('tahun_ajaran'), fn ($query) => $query->where('tahun_ajaran', $request->input('tahun_ajaran')))
            ->when($request->filled('semester'), fn ($query) => $query->whereRaw('lower(semester) = ?', [strtolower((string) $request->input('semester'))]))
            ->when($request->filled('payment_type_id'), fn ($query) => $query->where('payment_type_id', $request->integer('payment_type_id')))
            ->orderByRaw("CASE status WHEN 'Terlambat' THEN 1 WHEN 'Belum Lunas' THEN 2 WHEN 'Lunas' THEN 3 ELSE 4 END")
            ->orderBy('due_date')
            ->get()
            ->map(fn (PaymentBill $bill) => $this->billService->formatBill($bill))
            ->values();

        $paymentTypes = PaymentType::where('status', 'Aktif')->orderBy('nama')->get();

        $summary = [];
        foreach ($paymentTypes as $type) {
            $jenis = $type->nama;
            $items = $paymentItems
                ->where('payment_type_id', $type->id)
                ->when(
                    $paymentItems->where('payment_type_id', $type->id)->isEmpty(),
                    fn ($collection) => $collection->where('jenis', $jenis)
                );
            if ($items->isNotEmpty()) {
                $summary[] = [
                    'jenis' => $jenis,
                    'total_bayar' => $items->where('status', 'Lunas')->sum('jumlah'),
                    'total_belum' => $items->where('status', 'Belum Lunas')->sum('jumlah'),
                    'lunas' => $items->where('status', 'Lunas')->count(),
                    'belum_lunas' => $items->where('status', 'Belum Lunas')->count(),
                ];
            }
        }

        return response()->json([
            'success' => true,
            'siswa' => $siswa,
            'total_lunas' => (int) $transactions->where('status', 'Lunas')->sum('jumlah'),
            'total_belum_lunas' => (int) $tagihan->whereIn('status_tagihan', ['Belum Lunas', 'Terlambat'])->sum('amount'),
            'summary' => $summary,
            'tagihan' => $tagihan,
            'data' => $transactions->values(),
            'billing_summary' => $billingSummary,
        ]);
    }

    /**
     * GET /api/wali/biodata?siswa_id=X
     * Biodata lengkap anak, read-only untuk wali.
     */
    public function biodata(Request $request)
    {
        $request->validate([
            'siswa_id' => 'required|integer|exists:siswa,id',
        ]);

        $wali = $request->user();
        $siswa = Siswa::query()
            ->with([
                'wali:id,name,email,no_hp,status',
                'schoolOrigin:id,name,code,is_active',
                'kelompokBelajar:id,nama,kategori,sifir,class_id',
            ])
            ->where('id', (int) $request->siswa_id)
            ->where(function ($query) use ($wali) {
                $query->where('wali_id', $wali?->id)
                    ->orWhereHas('guardianProfile', fn ($nested) => $nested->where('user_id', $wali?->id));
            })
            ->first();

        if (!$siswa) {
            return $this->forbiddenChildResponse();
        }

        return response()->json([
            'success' => true,
            'data' => $siswa,
        ]);
    }

    /**
     * GET /api/wali/nilai?siswa_id=X&semester=Y
     * Semua nilai anak — per mapel + rata-rata
     */
    public function nilai(Request $request)
    {
        $request->validate([
            'siswa_id' => 'required|integer|exists:siswa,id',
            'semester' => 'nullable|string',
            'semester_id' => 'nullable|integer|exists:semesters,id',
            'tahun_ajaran' => 'nullable|string',
            'academic_year_id' => 'nullable|integer|exists:academic_years,id',
        ]);

        $siswa = $this->resolveOwnedChild($request, (int) $request->siswa_id);
        if (!$siswa) {
            return $this->forbiddenChildResponse();
        }

        $nilaiQuery = Nilai::with(['mataPelajaran', 'creator:id,name,role', 'updater:id,name,role'])
            ->where('siswa_id', $request->siswa_id);
        $hafalanQuery = Hafalan::with(['creator:id,name,role', 'updater:id,name,role'])
            ->where('siswa_id', $request->siswa_id);

        if ($request->filled('academic_year_id')) {
            $nilaiQuery->where('academic_year_id', $request->integer('academic_year_id'));
        } elseif ($request->filled('tahun_ajaran')) {
            $yearId = app(ReferenceResolver::class)->academicYearId($request->tahun_ajaran, false);
            $nilaiQuery->where(function ($builder) use ($request, $yearId) {
                if ($yearId) {
                    $builder->where('academic_year_id', $yearId);
                }
                $builder->orWhere('tahun_ajaran', $request->tahun_ajaran);
            });
            $hafalanQuery->where('periode', 'ilike', '%' . $request->tahun_ajaran . '%');
        }

        if ($request->filled('semester_id')) {
            $nilaiQuery->where('semester_id', $request->integer('semester_id'));
            $hafalanQuery->where('semester_id', $request->integer('semester_id'));
        } elseif ($request->filled('semester')) {
            $semesterId = app(ReferenceResolver::class)->semesterId($request->semester, $request->tahun_ajaran, false);
            $nilaiQuery->where(function ($builder) use ($request, $semesterId) {
                if ($semesterId) {
                    $builder->where('semester_id', $semesterId);
                }
                $builder->orWhere('semester', $request->semester);
            });
            $hafalanQuery->where('periode', 'ilike', '%' . $request->semester . '%');
        }

        $nilaiRows = $nilaiQuery->orderBy('mapel_id')->orderBy('jenis_ujian')->get();
        $hafalanRows = $hafalanQuery->orderByDesc('updated_at')->orderByDesc('id')->get();

        $grouped = $nilaiRows->groupBy('mapel_id')->map(function ($items) {
            $mapel = $items->first()->mataPelajaran;
            $latest = $items->sortByDesc('updated_at')->first();

            $nilaiList = $items->map(function ($n) {
                return [
                    'id' => $n->id,
                    'jenis_ujian' => $n->jenis_ujian,
                    'nilai' => (float) $n->nilai,
                    'semester' => $n->semester,
                    'predikat' => $n->grade,
                    'keterangan' => $n->keterangan,
                    'penilai_nama' => $n->updater?->name ?? $n->creator?->name ?? $n->diinput_oleh ?? '-',
                    'penilai_role' => $n->updated_by_role ?? $n->created_by_role ?? '-',
                    'updated_at' => optional($n->updated_at)->format('Y-m-d H:i'),
                ];
            })->values();

            $rataRata = $items->avg('nilai');

            return [
                'mapel_id' => $mapel->id ?? 0,
                'mapel_nama' => $mapel->nama ?? '-',
                'mapel_kode' => $mapel->kode ?? '-',
                'rata_rata' => round($rataRata, 1),
                'predikat' => Nilai::calculateGrade((float) $rataRata),
                'penilai_nama' => $latest->updater?->name ?? $latest->creator?->name ?? $latest->diinput_oleh ?? '-',
                'penilai_role' => $latest->updated_by_role ?? $latest->created_by_role ?? '-',
                'updated_at' => optional($latest->updated_at)->format('Y-m-d H:i'),
                'detail' => $nilaiList,
            ];
        })->values();

        $rataRataTotal = $grouped->isNotEmpty()
            ? round($grouped->avg('rata_rata'), 1)
            : 0;

        $hafalan = $hafalanRows->map(function ($item) {
            $label = $item->surah
                ? 'Surah ' . $item->surah
                : ($item->juz ? 'Juz ' . $item->juz : 'Hafalan Al-Qur\'an');

            return [
                'id' => $item->id,
                'item_label' => $label,
                'juz' => $item->juz,
                'surah' => $item->surah,
                'status' => $item->status,
                'nilai' => $item->nilai_hafalan,
                'keterangan' => $item->keterangan,
                'periode' => $item->periode,
                'penilai_nama' => $item->updater?->name ?? $item->creator?->name ?? $item->penguji ?? '-',
                'penilai_role' => $item->updated_by_role ?? $item->created_by_role ?? '-',
                'updated_at' => optional($item->updated_at)->format('Y-m-d H:i'),
            ];
        })->values();

        $rataRataHafalan = $hafalan->whereNotNull('nilai')->isNotEmpty()
            ? round($hafalan->whereNotNull('nilai')->avg('nilai'), 1)
            : 0;

        $periodeOptions = $this->buildPeriodeOptions((int) $siswa->id);
        $tahunAjaranOptions = collect($periodeOptions)
            ->pluck('tahun_ajaran')
            ->filter()
            ->unique()
            ->values();
        $semesterOptions = collect($periodeOptions)
            ->filter(function (array $option) use ($request) {
                if (!$request->filled('tahun_ajaran')) {
                    return true;
                }

                return ($option['tahun_ajaran'] ?? null) === $request->tahun_ajaran;
            })
            ->pluck('semester')
            ->filter()
            ->unique()
            ->values();

        return response()->json([
            'success' => true,
            'siswa' => $siswa,
            'selected_tahun_ajaran' => $request->tahun_ajaran,
            'selected_semester' => $request->semester,
            'rata_rata_total' => $rataRataTotal,
            'predikat_total' => $rataRataTotal > 0 ? Nilai::calculateGrade((float) $rataRataTotal) : '-',
            'total_mapel' => $grouped->count(),
            'rata_rata_hafalan' => $rataRataHafalan,
            'capaian_hafalan' => $hafalan->where('status', 'Selesai')->count() . '/' . $hafalan->count(),
            'tahun_ajaran_options' => $tahunAjaranOptions,
            'semester_options' => $semesterOptions,
            'periode_options' => $periodeOptions,
            'nilai_pelajaran' => $grouped,
            'nilai_hafalan' => $hafalan,
        ]);
    }

    private function resolveOwnedChild(Request $request, int $siswaId): ?Siswa
    {
        $wali = $request->user();

        return Siswa::query()
            ->where('id', $siswaId)
            ->where(function ($query) use ($wali) {
                $query->where('wali_id', $wali?->id)
                    ->orWhereHas('guardianProfile', fn ($nested) => $nested->where('user_id', $wali?->id));
            })
            ->first(['id', 'nama', 'kelas', 'class_id', 'nis', 'wali_id', 'guardian_profile_id']);
    }

    private function forbiddenChildResponse()
    {
        return response()->json([
            'success' => false,
            'message' => 'Anda hanya dapat melihat data anak sendiri',
        ], 403);
    }

    private function buildPeriodeOptions(int $siswaId): array
    {
        $nilaiPeriods = Nilai::query()
            ->where('siswa_id', $siswaId)
            ->select('tahun_ajaran', 'semester')
            ->distinct()
            ->get()
            ->map(function ($row) {
                return [
                    'tahun_ajaran' => $row->tahun_ajaran,
                    'semester' => $row->semester,
                ];
            });

        $hafalanPeriods = Hafalan::query()
            ->where('siswa_id', $siswaId)
            ->select('periode')
            ->distinct()
            ->pluck('periode')
            ->map(function (?string $periode) {
                return $this->parsePeriode($periode);
            });

        return $nilaiPeriods
            ->merge($hafalanPeriods)
            ->filter(function (array $item) {
                return !empty($item['tahun_ajaran']) || !empty($item['semester']);
            })
            ->unique(function (array $item) {
                return ($item['tahun_ajaran'] ?? '-') . '|' . ($item['semester'] ?? '-');
            })
            ->sortBy([
                ['tahun_ajaran', 'desc'],
                ['semester', 'asc'],
            ])
            ->values()
            ->all();
    }

    private function parsePeriode(?string $periode): array
    {
        $raw = trim((string) $periode);
        if ($raw === '') {
            return [
                'tahun_ajaran' => null,
                'semester' => null,
            ];
        }

        preg_match('/(Ganjil|Genap)/i', $raw, $semesterMatch);
        preg_match('/(\d{4}(?:\/\d{4})?)/', $raw, $yearMatch);

        return [
            'tahun_ajaran' => $yearMatch[1] ?? null,
            'semester' => isset($semesterMatch[1]) ? ucfirst(strtolower($semesterMatch[1])) : $raw,
        ];
    }
}
