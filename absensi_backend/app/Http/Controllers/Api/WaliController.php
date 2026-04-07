<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Siswa;
use App\Models\Absensi;
use App\Models\Pembayaran;
use App\Models\Nilai;
use App\Models\PaymentType;
use Illuminate\Http\Request;

class WaliController extends Controller
{
    /**
     * GET /api/wali/anak?wali_id=X
     * Daftar anak (siswa) yang terhubung ke akun wali
     */
    public function anak(Request $request)
    {
        $request->validate(['wali_id' => 'required|integer']);

        $siswa = Siswa::where('wali_id', $request->wali_id)
            ->select('id', 'nis', 'nisn', 'nama', 'kelas', 'jenis_kelamin', 'status')
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

        $query = Absensi::where('siswa_id', $request->siswa_id);

        // Default: bulan ini
        $bulan = $request->bulan ?? now()->month;
        $tahun = $request->tahun ?? now()->year;
        $query->whereMonth('tanggal', $bulan)->whereYear('tanggal', $tahun);

        $data = $query->orderBy('tanggal', 'desc')->orderBy('created_at', 'desc')->get();

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
        $siswa = Siswa::find($request->siswa_id, ['id', 'nama', 'kelas', 'nis']);

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
        ]);

        $data = Pembayaran::with('paymentType')
            ->where('siswa_id', $request->siswa_id)
            ->orderBy('tanggal', 'desc')
            ->get();

        $paymentTypes = PaymentType::where('status', 'Aktif')->orderBy('nama')->get();

        $tagihan = $paymentTypes->map(function ($type) use ($data) {
            $latest = $data
                ->where('payment_type_id', $type->id)
                ->sortByDesc('tanggal')
                ->first()
                ?? $data
                    ->where('jenis', $type->nama)
                    ->sortByDesc('tanggal')
                    ->first();

            return [
                'id' => $type->id,
                'nama' => $type->nama,
                'deskripsi' => $type->deskripsi,
                'nominal_default' => (int) $type->nominal_default,
                'periode' => $type->periode,
                'metode_pembayaran' => $type->metode_pembayaran ?? [],
                'status_tagihan' => $latest?->status ?? 'Belum Ada Pembayaran',
                'tanggal_terakhir' => $latest?->tanggal,
                'nominal_terakhir' => $latest?->jumlah,
            ];
        })->values();

        $summary = [];
        foreach ($paymentTypes as $type) {
            $jenis = $type->nama;
            $items = $data
                ->where('payment_type_id', $type->id)
                ->when(
                    $data->where('payment_type_id', $type->id)->isEmpty(),
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

        $siswa = Siswa::find($request->siswa_id, ['id', 'nama', 'kelas', 'nis']);

        return response()->json([
            'success' => true,
            'siswa' => $siswa,
            'total_lunas' => $data->where('status', 'Lunas')->sum('jumlah'),
            'total_belum_lunas' => $data->where('status', 'Belum Lunas')->sum('jumlah'),
            'summary' => $summary,
            'tagihan' => $tagihan,
            'data' => $data,
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
        ]);

        $query = Nilai::with('mataPelajaran')
            ->where('siswa_id', $request->siswa_id);

        if ($request->has('semester') && $request->semester) {
            $query->where('semester', $request->semester);
        }

        $data = $query->orderBy('mapel_id')->orderBy('jenis_ujian')->get();

        // Group by mapel
        $grouped = $data->groupBy('mapel_id')->map(function ($items) {
            $mapel = $items->first()->mataPelajaran;
            $nilaiList = $items->map(function ($n) {
                return [
                    'id' => $n->id,
                    'jenis_ujian' => $n->jenis_ujian,
                    'nilai' => (float) $n->nilai,
                    'semester' => $n->semester,
                ];
            })->values();

            $rataRata = $items->avg('nilai');

            // Predikat
            $predikat = 'D';
            if ($rataRata >= 90) $predikat = 'A';
            elseif ($rataRata >= 80) $predikat = 'B';
            elseif ($rataRata >= 70) $predikat = 'C';

            return [
                'mapel_id' => $mapel->id ?? 0,
                'mapel_nama' => $mapel->nama ?? '-',
                'mapel_kode' => $mapel->kode ?? '-',
                'rata_rata' => round($rataRata, 1),
                'predikat' => $predikat,
                'detail' => $nilaiList,
            ];
        })->values();

        // Rata-rata keseluruhan
        $rataRataTotal = $grouped->isNotEmpty()
            ? round($grouped->avg('rata_rata'), 1)
            : 0;

        $predikatTotal = 'D';
        if ($rataRataTotal >= 90) $predikatTotal = 'A';
        elseif ($rataRataTotal >= 80) $predikatTotal = 'B';
        elseif ($rataRataTotal >= 70) $predikatTotal = 'C';

        $siswa = Siswa::find($request->siswa_id, ['id', 'nama', 'kelas', 'nis']);

        // Available semesters
        $semesters = Nilai::where('siswa_id', $request->siswa_id)
            ->select('semester')
            ->distinct()
            ->pluck('semester');

        return response()->json([
            'success' => true,
            'siswa' => $siswa,
            'rata_rata_total' => $rataRataTotal,
            'predikat_total' => $predikatTotal,
            'total_mapel' => $grouped->count(),
            'semesters' => $semesters,
            'data' => $grouped,
        ]);
    }
}
