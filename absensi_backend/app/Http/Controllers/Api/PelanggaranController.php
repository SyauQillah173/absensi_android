<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Notification as AppNotification;
use App\Models\PelanggaranKategori;
use App\Models\PelanggaranSantri;
use App\Models\PelanggaranSetting;
use App\Models\Siswa;
use App\Models\User;
use App\Services\AppPushNotificationService;
use App\Services\AuditLogService;
use App\Services\WhatsAppNotificationService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class PelanggaranController extends Controller
{
    /**
     * GET /api/pelanggaran
     * Daftar seluruh catatan pelanggaran santri dengan filter lengkap
     */
    public function index(Request $request)
    {
        $query = PelanggaranSantri::query()
            ->with([
                'siswa:id,nama,nis,nisn,kelas,komplek,kamar,wali_id',
                'kategori:id,nama_pelanggaran,tingkat,poin_default',
                'petugas:id,name,role,admin_type',
            ]);

        // Filter Siswa ID
        if ($request->filled('siswa_id')) {
            $query->where('siswa_id', $request->input('siswa_id'));
        }

        // Filter Tingkat (Ringan / Sedang / Berat)
        if ($request->filled('tingkat') && $request->input('tingkat') !== 'all') {
            $query->where('tingkat', $request->input('tingkat'));
        }

        // Filter Status Denda
        if ($request->filled('status_denda') && $request->input('status_denda') !== 'all') {
            $query->where('status_denda', $request->input('status_denda'));
        }

        // Filter Rentang Tanggal
        if ($request->filled('tanggal_mulai')) {
            $query->whereDate('tanggal', '>=', $request->input('tanggal_mulai'));
        }
        if ($request->filled('tanggal_akhir')) {
            $query->whereDate('tanggal', '<=', $request->input('tanggal_akhir'));
        }

        // Search Nama / NIS Santri atau Judul Pelanggaran
        if ($request->filled('search')) {
            $search = trim((string) $request->input('search'));
            $query->where(function ($q) use ($search) {
                $q->where('judul_pelanggaran', 'like', "%{$search}%")
                  ->orWhere('keterangan', 'like', "%{$search}%")
                  ->orWhere('tindakan_takzir', 'like', "%{$search}%")
                  ->orWhereHas('siswa', function ($sq) use ($search) {
                      $sq->where('nama', 'like', "%{$search}%")
                         ->orWhere('nis', 'like', "%{$search}%")
                         ->orWhere('kelas', 'like', "%{$search}%")
                         ->orWhere('komplek', 'like', "%{$search}%")
                         ->orWhere('kamar', 'like', "%{$search}%");
                  });
            });
        }

        $query->orderByDesc('tanggal')->orderByDesc('id');

        $perPage = $request->input('per_page', 20);
        if ($perPage === 'all' || (int) $perPage > 200) {
            $rows = $query->get();
            return response()->json([
                'success' => true,
                'data' => $rows,
                'total' => $rows->count(),
            ]);
        }

        $paginated = $query->paginate((int) $perPage);

        return response()->json([
            'success' => true,
            'data' => $paginated->items(),
            'current_page' => $paginated->currentPage(),
            'last_page' => $paginated->lastPage(),
            'per_page' => $paginated->perPage(),
            'total' => $paginated->total(),
        ]);
    }

    /**
     * GET /api/pelanggaran/stats
     * Statistik ringkasan kedisiplinan santri
     */
    public function stats(Request $request)
    {
        $setting = PelanggaranSetting::getActiveSetting();
        $threshold = $setting->warning_threshold_points;

        $now = Carbon::now();
        $startOfMonth = $now->copy()->startOfMonth()->toDateString();
        $endOfMonth = $now->copy()->endOfMonth()->toDateString();

        $totalKasusBulanIni = PelanggaranSantri::whereBetween('tanggal', [$startOfMonth, $endOfMonth])->count();
        $totalKasusSemua = PelanggaranSantri::count();

        // Agregasi poin per siswa
        $studentPoints = PelanggaranSantri::query()
            ->select('siswa_id', DB::raw('SUM(poin) as total_poin'), DB::raw('COUNT(id) as total_kasus'))
            ->groupBy('siswa_id')
            ->get();

        $totalSantriTercatat = $studentPoints->count();
        $overThresholdCount = $studentPoints->where('total_poin', '>=', $threshold)->count();

        // Santri Kritis (Top 10 Poin Terbanyak)
        $santriKritisIds = $studentPoints->sortByDesc('total_poin')->take(10)->pluck('siswa_id');
        $santriKritisMap = Siswa::whereIn('id', $santriKritisIds)
            ->select('id', 'nama', 'nis', 'kelas', 'komplek', 'kamar')
            ->get()
            ->keyBy('id');

        $santriKritis = $studentPoints->sortByDesc('total_poin')->take(10)->map(function ($row) use ($santriKritisMap, $threshold) {
            $siswa = $santriKritisMap->get($row->siswa_id);
            return [
                'siswa_id' => $row->siswa_id,
                'nama' => $siswa?->nama ?? 'Santri',
                'nis' => $siswa?->nis ?? '-',
                'kelas' => $siswa?->kelas ?? '-',
                'asrama' => trim(($siswa?->komplek ?? '') . ' ' . ($siswa?->kamar ?? '')),
                'total_poin' => (int) $row->total_poin,
                'total_kasus' => (int) $row->total_kasus,
                'is_over_threshold' => (int) $row->total_poin >= $threshold,
            ];
        })->values();

        // Total Denda
        $totalDendaNominal = (float) PelanggaranSantri::sum('denda');
        $totalDendaLunas = (float) PelanggaranSantri::where('status_denda', 'lunas')->sum('denda');
        $totalDendaBelumLunas = (float) PelanggaranSantri::where('status_denda', 'belum_dibayar')->sum('denda');

        // Kasus Populer
        $topPelanggaran = PelanggaranSantri::query()
            ->select('judul_pelanggaran', 'tingkat', DB::raw('COUNT(id) as total'))
            ->groupBy('judul_pelanggaran', 'tingkat')
            ->orderByDesc('total')
            ->take(5)
            ->get();

        return response()->json([
            'success' => true,
            'data' => [
                'total_kasus_bulan_ini' => $totalKasusBulanIni,
                'total_kasus_semua' => $totalKasusSemua,
                'total_santri_tercatat' => $totalSantriTercatat,
                'total_santri_over_threshold' => $overThresholdCount,
                'warning_threshold_points' => $threshold,
                'enable_denda' => (bool) $setting->enable_denda,
                'total_denda_nominal' => $totalDendaNominal,
                'total_denda_lunas' => $totalDendaLunas,
                'total_denda_belum_lunas' => $totalDendaBelumLunas,
                'santri_kritis' => $santriKritis,
                'top_pelanggaran' => $topPelanggaran,
            ],
        ]);
    }

    /**
     * POST /api/pelanggaran
     * Catat pelanggaran baru santri
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'siswa_id' => 'required|exists:siswas,id',
            'tanggal' => 'required|date',
            'waktu' => 'nullable|string|max:20',
            'kategori_id' => 'nullable|exists:pelanggaran_kategori,id',
            'judul_pelanggaran' => 'required|string|max:255',
            'tingkat' => 'required|in:Ringan,Sedang,Berat',
            'poin' => 'required|integer|min:1|max:500',
            'denda' => 'nullable|numeric|min:0',
            'status_denda' => 'nullable|in:tidak_ada,belum_dibayar,lunas',
            'keterangan' => 'nullable|string',
            'tindakan_takzir' => 'nullable|string',
            'bukti_foto' => 'nullable',
        ]);

        $user = $request->user();
        $petugasId = $user?->id;
        $namaPetugas = $user?->name ?: 'Pengurus Keamanan';

        // Upload bukti foto jika ada
        $fotoPath = null;
        if ($request->hasFile('bukti_foto')) {
            $file = $request->file('bukti_foto');
            $filename = 'pelanggaran_' . time() . '_' . Str::random(8) . '.' . $file->getClientOriginalExtension();
            $fotoPath = $file->storeAs('bukti_pelanggaran', $filename, 'public');
        } elseif (is_string($request->input('bukti_foto')) && !empty($request->input('bukti_foto'))) {
            $fotoPath = $request->input('bukti_foto');
        }

        $dendaNominal = (float) ($validated['denda'] ?? 0);
        $statusDenda = $validated['status_denda'] ?? ($dendaNominal > 0 ? 'belum_dibayar' : 'tidak_ada');

        $siswa = Siswa::findOrFail($validated['siswa_id']);

        // Hitung total poin santri sebelumnya
        $poinLama = (int) PelanggaranSantri::where('siswa_id', $siswa->id)->sum('poin');
        $poinBaru = $poinLama + (int) $validated['poin'];

        $setting = PelanggaranSetting::getActiveSetting();
        $threshold = $setting->warning_threshold_points;

        // Tentukan status peringatan awal
        $statusPeringatan = 'normal';
        if ($poinBaru >= $threshold) {
            $statusPeringatan = 'panggilan_ortu';
        } elseif ($poinBaru >= ($threshold * 0.75)) {
            $statusPeringatan = 'sp2';
        } elseif ($poinBaru >= ($threshold * 0.5)) {
            $statusPeringatan = 'sp1';
        }

        $pelanggaran = PelanggaranSantri::create([
            'siswa_id' => $siswa->id,
            'tanggal' => $validated['tanggal'],
            'waktu' => $validated['waktu'] ?: Carbon::now()->format('H:i:s'),
            'kategori_id' => $validated['kategori_id'] ?? null,
            'judul_pelanggaran' => $validated['judul_pelanggaran'],
            'tingkat' => $validated['tingkat'],
            'poin' => (int) $validated['poin'],
            'denda' => $dendaNominal,
            'status_denda' => $statusDenda,
            'keterangan' => $validated['keterangan'] ?? null,
            'tindakan_takzir' => $validated['tindakan_takzir'] ?? null,
            'bukti_foto' => $fotoPath,
            'petugas_keamanan_id' => $petugasId,
            'nama_petugas' => $namaPetugas,
            'status_peringatan' => $statusPeringatan,
        ]);

        // Kirim Notifikasi Realtime ke Wali Santri
        $this->notifyWaliSantri($siswa, $pelanggaran, $poinBaru, $threshold);

        app(AuditLogService::class)->record($request, 'pelanggaran', 'create', $pelanggaran, null, [
            'siswa' => $siswa->nama,
            'poin' => $pelanggaran->poin,
            'total_poin' => $poinBaru,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Catatan pelanggaran santri berhasil disimpan dan terkirim ke Wali Santri.',
            'data' => $pelanggaran->load(['siswa:id,nama,nis,kelas', 'kategori:id,nama_pelanggaran']),
            'total_poin_santri' => $poinBaru,
            'is_over_threshold' => $poinBaru >= $threshold,
        ], 201);
    }

    /**
     * PUT /api/pelanggaran/{id}
     */
    public function update(Request $request, $id)
    {
        $pelanggaran = PelanggaranSantri::findOrFail($id);

        $validated = $request->validate([
            'tanggal' => 'sometimes|required|date',
            'waktu' => 'nullable|string|max:20',
            'kategori_id' => 'nullable|exists:pelanggaran_kategori,id',
            'judul_pelanggaran' => 'sometimes|required|string|max:255',
            'tingkat' => 'sometimes|required|in:Ringan,Sedang,Berat',
            'poin' => 'sometimes|required|integer|min:1|max:500',
            'denda' => 'nullable|numeric|min:0',
            'status_denda' => 'nullable|in:tidak_ada,belum_dibayar,lunas',
            'keterangan' => 'nullable|string',
            'tindakan_takzir' => 'nullable|string',
            'bukti_foto' => 'nullable',
        ]);

        if ($request->hasFile('bukti_foto')) {
            $file = $request->file('bukti_foto');
            $filename = 'pelanggaran_' . time() . '_' . Str::random(8) . '.' . $file->getClientOriginalExtension();
            $validated['bukti_foto'] = $file->storeAs('bukti_pelanggaran', $filename, 'public');
        }

        $before = $pelanggaran->toArray();
        $pelanggaran->update($validated);

        app(AuditLogService::class)->record($request, 'pelanggaran', 'update', $pelanggaran, $before, $pelanggaran->fresh()->toArray());

        return response()->json([
            'success' => true,
            'message' => 'Data pelanggaran santri berhasil diperbarui.',
            'data' => $pelanggaran->fresh(['siswa:id,nama,nis,kelas', 'kategori:id,nama_pelanggaran']),
        ]);
    }

    /**
     * DELETE /api/pelanggaran/{id}
     */
    public function destroy(Request $request, $id)
    {
        $pelanggaran = PelanggaranSantri::findOrFail($id);
        $before = $pelanggaran->toArray();

        // Hapus fisik foto jika ada
        if ($pelanggaran->bukti_foto && Storage::disk('public')->exists($pelanggaran->bukti_foto)) {
            Storage::disk('public')->delete($pelanggaran->bukti_foto);
        }

        $pelanggaran->delete();

        app(AuditLogService::class)->record($request, 'pelanggaran', 'delete', null, $before, null);

        return response()->json([
            'success' => true,
            'message' => 'Catatan pelanggaran berhasil dihapus.',
        ]);
    }

    /**
     * POST /api/pelanggaran/{id}/terbitkan-surat
     * Terbitkan Surat Panggilan Resmi ke Pondok untuk Wali Santri
     */
    public function terbitkanSurat(Request $request, $id)
    {
        $pelanggaran = PelanggaranSantri::with('siswa')->findOrFail($id);
        $siswa = $pelanggaran->siswa;

        $nomorSurat = 'SP/KEAMANAN/' . date('Ymd') . '/' . str_pad((string) $pelanggaran->id, 4, '0', STR_PAD_LEFT);

        $pelanggaran->update([
            'status_peringatan' => 'panggilan_ortu',
            'surat_panggilan_nomor' => $nomorSurat,
            'surat_panggilan_diterbitkan_at' => Carbon::now(),
        ]);

        // Kirim Notifikasi Darurat Panggilan ke Pondok
        $this->notifyEmergencyPanggilanWali($siswa, $pelanggaran, $nomorSurat);

        app(AuditLogService::class)->record($request, 'pelanggaran', 'issue_calling_letter', $pelanggaran, null, [
            'nomor_surat' => $nomorSurat,
            'siswa' => $siswa?->nama,
        ]);

        return response()->json([
            'success' => true,
            'message' => "Surat Panggilan Resmi ({$nomorSurat}) berhasil diterbitkan dan notifikasi darurat terkirim ke Wali Santri.",
            'data' => $pelanggaran->fresh(['siswa', 'kategori']),
        ]);
    }

    /**
     * POST /api/pelanggaran/{id}/bayar-denda
     * Tandai denda pelanggaran telah lunas dibayarkan
     */
    public function bayarDenda(Request $request, $id)
    {
        $pelanggaran = PelanggaranSantri::findOrFail($id);
        $pelanggaran->update([
            'status_denda' => 'lunas',
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Denda pelanggaran santri berhasil dilunaskan.',
            'data' => $pelanggaran,
        ]);
    }

    /**
     * GET /api/wali/pelanggaran/{siswa_id}
     * Akses riwayat pelanggaran khusus untuk portal wali santri
     */
    public function waliPelanggaran(Request $request, $siswaId)
    {
        $user = $request->user();
        $siswa = Siswa::findOrFail($siswaId);

        // Keamanan: Jika user adalah wali, pastikan siswa adalah anaknya
        if ($user && $user->role === 'wali') {
            $isMyChild = Siswa::where('id', $siswaId)
                ->where(function ($q) use ($user) {
                    $q->where('wali_id', $user->id)
                      ->orWhereHas('guardianProfile', fn ($gq) => $gq->where('user_id', $user->id));
                })
                ->exists();

            if (!$isMyChild) {
                return response()->json([
                    'success' => false,
                    'message' => 'Anda tidak memiliki hak akses melihat data santri ini.',
                ], 403);
            }
        }

        $setting = PelanggaranSetting::getActiveSetting();
        $threshold = $setting->warning_threshold_points;

        $pelanggaranList = PelanggaranSantri::where('siswa_id', $siswaId)
            ->with(['kategori:id,nama_pelanggaran,tingkat'])
            ->orderByDesc('tanggal')
            ->orderByDesc('id')
            ->get();

        $totalPoin = (int) $pelanggaranList->sum('poin');
        $totalDendaBelumLunas = (float) $pelanggaranList->where('status_denda', 'belum_dibayar')->sum('denda');
        $isOverThreshold = $totalPoin >= $threshold;

        // Cek apakah ada surat panggilan aktif
        $suratPanggilan = $pelanggaranList->whereNotNull('surat_panggilan_nomor')->first();

        return response()->json([
            'success' => true,
            'data' => [
                'siswa' => [
                    'id' => $siswa->id,
                    'nama' => $siswa->nama,
                    'nis' => $siswa->nis,
                    'kelas' => $siswa->kelas,
                    'komplek' => $siswa->komplek,
                    'kamar' => $siswa->kamar,
                ],
                'total_poin' => $totalPoin,
                'warning_threshold_points' => $threshold,
                'is_over_threshold' => $isOverThreshold,
                'has_surat_panggilan' => (bool) $suratPanggilan,
                'surat_info' => $suratPanggilan ? [
                    'nomor_surat' => $suratPanggilan->surat_panggilan_nomor,
                    'diterbitkan_at' => $suratPanggilan->surat_panggilan_diterbitkan_at?->translatedFormat('d F Y H:i'),
                    'perihal' => $setting->surat_template_title,
                    'pesan' => $setting->surat_template_body,
                ] : null,
                'total_denda_belum_lunas' => $totalDendaBelumLunas,
                'enable_denda' => (bool) $setting->enable_denda,
                'pelanggaran_list' => $pelanggaranList,
            ],
        ]);
    }

    /**
     * GET /api/pelanggaran/kategori
     */
    public function getCategories()
    {
        $categories = PelanggaranKategori::where('is_active', true)
            ->orderBy('tingkat')
            ->orderBy('nama_pelanggaran')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $categories,
        ]);
    }

    /**
     * POST /api/pelanggaran/kategori
     */
    public function storeCategory(Request $request)
    {
        $validated = $request->validate([
            'nama_pelanggaran' => 'required|string|max:255',
            'tingkat' => 'required|in:Ringan,Sedang,Berat',
            'poin_default' => 'required|integer|min:1',
            'denda_default' => 'nullable|numeric|min:0',
            'tindakan_rekomendasi' => 'nullable|string',
        ]);

        $category = PelanggaranKategori::create([
            ...$validated,
            'denda_default' => $validated['denda_default'] ?? 0,
            'is_active' => true,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Kategori pelanggaran berhasil ditambahkan.',
            'data' => $category,
        ], 201);
    }

    /**
     * GET /api/pelanggaran/settings
     */
    public function getSettings()
    {
        $setting = PelanggaranSetting::getActiveSetting();
        return response()->json([
            'success' => true,
            'data' => $setting,
        ]);
    }

    /**
     * POST /api/pelanggaran/settings
     */
    public function updateSettings(Request $request)
    {
        $validated = $request->validate([
            'warning_threshold_points' => 'required|integer|min:10|max:1000',
            'enable_denda' => 'required|boolean',
            'surat_template_title' => 'nullable|string|max:255',
            'surat_template_body' => 'nullable|string',
        ]);

        $setting = PelanggaranSetting::getActiveSetting();
        $setting->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'Pengaturan ambang batas poin pelanggaran berhasil disimpan.',
            'data' => $setting->fresh(),
        ]);
    }

    /**
     * Helper Notifikasi Realtime ke Wali Santri
     */
    private function notifyWaliSantri(Siswa $siswa, PelanggaranSantri $pelanggaran, int $totalPoin, int $threshold): void
    {
        $waliId = $siswa->wali_id;
        if (!$waliId && $siswa->guardianProfile) {
            $waliId = $siswa->guardianProfile->user_id;
        }

        $judul = "⚠️ Peringatan Kedisiplinan: {$siswa->nama}";
        $pesan = "Ananda {$siswa->nama} tercatat melakukan pelanggaran: {$pelanggaran->judul_pelanggaran} (+{$pelanggaran->poin} Poin). Takzir: " . ($pelanggaran->tindakan_takzir ?: '-') . ". Total akumulasi poin ananda saat ini: {$totalPoin} Poin.";

        if ($totalPoin >= $threshold) {
            $pesan .= " 🚨 PERHATIAN: Poin telah mencapai ambang batas ({$threshold} Poin). Mohon segera berkoordinasi dengan Pengurus Keamanan Pondok.";
        }

        if ($waliId) {
            AppNotification::create([
                'user_id' => $waliId,
                'title' => $judul,
                'body' => $pesan,
                'type' => 'pelanggaran_santri',
                'data' => [
                    'siswa_id' => $siswa->id,
                    'pelanggaran_id' => $pelanggaran->id,
                    'poin' => $pelanggaran->poin,
                    'total_poin' => $totalPoin,
                    'is_over_threshold' => $totalPoin >= $threshold,
                    'page' => 'wali',
                    'tab' => 'pelanggaran',
                ],
                'is_read' => false,
            ]);

            // Web Push Notifikasi
            try {
                app(AppPushNotificationService::class)->sendToUser(
                    $waliId,
                    $judul,
                    $pesan,
                    [
                        'page' => 'wali',
                        'tab' => 'pelanggaran',
                        'siswa_id' => $siswa->id,
                    ]
                );
            } catch (\Throwable $e) {
                // Ignore failure
            }

            // WhatsApp Notifikasi jika bot terhubung & no HP wali tersedia
            try {
                $waliUser = User::find($waliId);
                $noHp = $waliUser?->no_hp ?: $siswa->no_hp_wali;
                if ($noHp) {
                    $waText = "*YAYASAN PONDOK PESANTREN QOMARUDDIN*\n"
                        . "Jl. Masjid Kiyai Gede Sampurnan Bungah Gresik\n"
                        . "━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
                        . "⚠️ *INFORMASI KEDISIPLINAN SANTRI*\n\n"
                        . "Yth. Bapak/Ibu Wali Santri dari:\n"
                        . "• *Nama Santri:* {$siswa->nama}\n"
                        . "• *NIS:* {$siswa->nis}\n"
                        . "• *Kelas/Kamar:* {$siswa->kelas} / {$siswa->komplek} {$siswa->kamar}\n\n"
                        . "Diberitahukan bahwa santri tercatat melakukan pelanggaran:\n"
                        . "• *Pelanggaran:* {$pelanggaran->judul_pelanggaran}\n"
                        . "• *Poin Pelanggaran:* +{$pelanggaran->poin} Poin\n"
                        . "• *Tindakan/Takzir:* " . ($pelanggaran->tindakan_takzir ?: 'Pembinaan') . "\n"
                        . "• *Total Akumulasi Poin:* {$totalPoin} Poin (Batas Peringatan: {$threshold} Poin)\n\n";

                    if ($totalPoin >= $threshold) {
                        $waText .= "🚨 *PERINGATAN PANGGILAN WALI SANTRI*\n"
                            . "Karena poin telah mencapai batas maksimal, mohon kehadiran Bapak/Ibu Wali Santri ke Kantor Pengurus Keamanan Pondok Pesantren Qomaruddin untuk berdiskusi terkait pembinaan ananda.\n\n";
                    }

                    $waText .= "Terima kasih atas kerja sama Bapak/Ibu dalam mendidik putra/putri kita.\n"
                        . "_Wassalamu'alaikum Wr. Wb._\n"
                        . "*Pengurus Keamanan PP Qomaruddin*";

                    app(WhatsAppNotificationService::class)->sendRawMessage($noHp, $waText);
                }
            } catch (\Throwable $e) {
                // Ignore WA failure
            }
        }
    }

    /**
     * Helper Notifikasi Darurat Panggilan Resmi ke Pondok
     */
    private function notifyEmergencyPanggilanWali(Siswa $siswa, PelanggaranSantri $pelanggaran, string $nomorSurat): void
    {
        $waliId = $siswa->wali_id;
        if (!$waliId && $siswa->guardianProfile) {
            $waliId = $siswa->guardianProfile->user_id;
        }

        $judul = "🚨 SURAT PANGGILAN RESMI WALI SANTRI: {$siswa->nama}";
        $pesan = "Pengurus Keamanan Pondok Pesantren Qomaruddin telah menerbitkan Surat Panggilan Resmi ({$nomorSurat}) untuk Wali Santri dari {$siswa->nama}. Mohon segera datang ke kantor pondok untuk berdiskusi.";

        if ($waliId) {
            AppNotification::create([
                'user_id' => $waliId,
                'title' => $judul,
                'body' => $pesan,
                'type' => 'surat_panggilan_wali',
                'data' => [
                    'siswa_id' => $siswa->id,
                    'nomor_surat' => $nomorSurat,
                    'page' => 'wali',
                    'tab' => 'pelanggaran',
                ],
                'is_read' => false,
            ]);

            try {
                app(AppPushNotificationService::class)->sendToUser(
                    $waliId,
                    $judul,
                    $pesan,
                    [
                        'page' => 'wali',
                        'tab' => 'pelanggaran',
                        'siswa_id' => $siswa->id,
                    ]
                );
            } catch (\Throwable $e) {
                // Ignore failure
            }
        }
    }
}
