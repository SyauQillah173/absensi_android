<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BoardingRoom;
use App\Models\PmbBatch;
use App\Models\PmbRegistration;
use App\Models\SchoolClass;
use App\Models\Siswa;
use App\Models\User;
use App\Services\ReferenceResolver;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class PmbController extends Controller
{
    /**
     * Pastikan minimal 1 Gelombang PMB aktif tersedia (Self-healing).
     */
    private function ensureActiveBatch(): PmbBatch
    {
        $batch = PmbBatch::where('is_active', true)->orderBy('id', 'desc')->first();
        if (!$batch) {
            $currentYear = date('Y');
            $nextYear = $currentYear + 1;
            $batch = PmbBatch::create([
                'nama_gelombang' => "Gelombang 1 - TA {$currentYear}/{$nextYear}",
                'tahun_akademik' => "{$currentYear}/{$nextYear}",
                'tanggal_mulai' => Carbon::create($currentYear, 1, 1)->toDateString(),
                'tanggal_selesai' => Carbon::create($currentYear, 12, 31)->toDateString(),
                'biaya_pendaftaran' => 150000,
                'kuota' => 350,
                'is_active' => true,
                'keterangan' => 'Pendaftaran Santri Baru Gelombang 1 Pondok Pesantren Qomaruddin Sampurnan Bungah Gresik.',
            ]);
        }
        return $batch;
    }

    /**
     * [PUBLIC] Informasi PMB & Profil Singkat Pesantren Qomaruddin
     */
    public function getInfo(): JsonResponse
    {
        $batch = $this->ensureActiveBatch();

        $totalRegistered = PmbRegistration::where('pmb_batch_id', $batch->id)->count();
        $quotaRemaining = $batch->kuota ? max(0, $batch->kuota - $totalRegistered) : null;

        // Metadata Profil Pesantren
        $profil = [
            'nama_pesantren' => 'Pondok Pesantren Qomaruddin',
            'pendiri' => 'Kiai Qomaruddin (Mbah Kiai Qomaruddin)',
            'tahun_berdiri' => '1775 M (Lebih dari 250 Tahun Berkhidmah)',
            'alamat' => 'Jl. Sampurnan No. 01, Bungah, Kabupaten Gresik, Jawa Timur 61152',
            'telepon' => '0812-3456-7890',
            'email' => 'pmb@ppqomaruddin.itqom.net',
            'website' => 'https://ppqomaruddin.itqom.net',
            'tagline' => 'Mencetak Generasi Berakhlakul Karimah, Unggul Ilmu Agama & Berdaya Saing Global',
            'program_unggulan' => [
                [
                    'title' => 'Madrasah Diniyah Salafiyah',
                    'desc' => 'Kajian mendalam kitab kuning berjenjang (Sifir, Ula, Wustho, Ulya) dengan metode sorogan dan bandongan klasik.',
                    'icon' => 'BookOpen'
                ],
                [
                    'title' => 'Tahfidzul Qur\'an 30 Juz',
                    'desc' => 'Bimbingan intensif hafalan Al-Qur\'an bersanad muttashil dengan target tajwid mutqin dan fashahah.',
                    'icon' => 'Award'
                ],
                [
                    'title' => 'Pendidikan Formal Terpadu',
                    'desc' => 'Sinergi kurikulum Kemenag/Kemendikbud (MI, MTs, MA, SMA, SMK Assa\'adah) hingga jenjang Universitas Qomaruddin.',
                    'icon' => 'GraduationCap'
                ],
                [
                    'title' => 'Karakter & Kemandirian Asrama',
                    'desc' => 'Pembinaan disiplin sholat jama\'ah 5 waktu, dzikir ma\'tsurat, kepemimpinan, dan bahasa Arab-Inggris.',
                    'icon' => 'ShieldCheck'
                ]
            ],
            'fasilitas' => [
                'Masjid Jami\' Qomaruddin yang Megah & Bersejarah',
                'Komplek Asrama Santri Putra & Putri Representatif',
                'Perpustakaan Khazanah Kitab Salaf & Referensi Modern',
                'Laboratorium Komputer & Bahasa',
                'Klinik Kesehatan Pesantren (Poskestren)',
                'Kantin, Koperasi Pesantren & Dapur Bersih',
                'Sarana Olahraga & Seni Hadrah Al-Banjari'
            ]
        ];

        return response()->json([
            'status' => 'success',
            'data' => [
                'active_batch' => $batch,
                'total_registered' => $totalRegistered,
                'quota_remaining' => $quotaRemaining,
                'profil' => $profil,
            ]
        ]);
    }

    /**
     * [PUBLIC] Pendaftaran Santri Baru Online
     */
    public function register(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'nama_lengkap' => 'required|string|max:150',
            'nama_panggilan' => 'nullable|string|max:60',
            'jenis_kelamin' => 'required|in:L,P',
            'nik' => 'nullable|string|max:30',
            'nisn' => 'nullable|string|max:30',
            'tempat_lahir' => 'nullable|string|max:80',
            'tanggal_lahir' => 'nullable|date',
            'alamat_lengkap' => 'nullable|string',
            'provinsi' => 'nullable|string|max:80',
            'kota' => 'nullable|string|max:80',
            'kecamatan' => 'nullable|string|max:80',
            'asal_sekolah' => 'nullable|string|max:120',
            'pilihan_jenjang' => 'nullable|string|max:100',
            'pilihan_asrama' => 'nullable|string|max:100',
            'nama_ayah' => 'nullable|string|max:120',
            'pekerjaan_ayah' => 'nullable|string|max:80',
            'nama_ibu' => 'nullable|string|max:120',
            'pekerjaan_ibu' => 'nullable|string|max:80',
            'nama_wali' => 'nullable|string|max:120',
            'no_whatsapp_wali' => 'required|string|max:30',
            'catatan_khusus' => 'nullable|string',
            'pmb_batch_id' => 'nullable|exists:pmb_batches,id',
            'dokumen_foto' => 'nullable|file|mimes:jpg,jpeg,png,webp|max:5120',
            'dokumen_kk' => 'nullable|file|mimes:jpg,jpeg,png,webp,pdf|max:5120',
            'dokumen_ijazah' => 'nullable|file|mimes:jpg,jpeg,png,webp,pdf|max:5120',
        ]);

        // Tentukan Batch
        $batchId = $validated['pmb_batch_id'] ?? null;
        if (!$batchId) {
            $batch = $this->ensureActiveBatch();
            $batchId = $batch->id;
        }

        // Generate Nomor Registrasi Unik (Contoh: PMB-2026-0001)
        $year = date('Y');
        $count = PmbRegistration::whereYear('created_at', $year)->count() + 1;
        $regNumber = sprintf("PMB-%s-%04d", $year, $count);
        while (PmbRegistration::where('registration_number', $regNumber)->exists()) {
            $count++;
            $regNumber = sprintf("PMB-%s-%04d", $year, $count);
        }

        // Handle File Uploads
        $fotoPath = null;
        if ($request->hasFile('dokumen_foto')) {
            $file = $request->file('dokumen_foto');
            $ext = $file->getClientOriginalExtension();
            $fotoPath = $file->storeAs('pmb/foto', "{$regNumber}_foto.{$ext}", 'public');
        }

        $kkPath = null;
        if ($request->hasFile('dokumen_kk')) {
            $file = $request->file('dokumen_kk');
            $ext = $file->getClientOriginalExtension();
            $kkPath = $file->storeAs('pmb/berkas', "{$regNumber}_kk.{$ext}", 'public');
        }

        $ijazahPath = null;
        if ($request->hasFile('dokumen_ijazah')) {
            $file = $request->file('dokumen_ijazah');
            $ext = $file->getClientOriginalExtension();
            $ijazahPath = $file->storeAs('pmb/berkas', "{$regNumber}_ijazah.{$ext}", 'public');
        }

        $registration = PmbRegistration::create([
            'registration_number' => $regNumber,
            'pmb_batch_id' => $batchId,
            'nama_lengkap' => trim($validated['nama_lengkap']),
            'nama_panggilan' => $validated['nama_panggilan'] ?? null,
            'jenis_kelamin' => $validated['jenis_kelamin'],
            'nik' => $validated['nik'] ?? null,
            'nisn' => $validated['nisn'] ?? null,
            'tempat_lahir' => $validated['tempat_lahir'] ?? null,
            'tanggal_lahir' => $validated['tanggal_lahir'] ?? null,
            'alamat_lengkap' => $validated['alamat_lengkap'] ?? null,
            'provinsi' => $validated['provinsi'] ?? null,
            'kota' => $validated['kota'] ?? null,
            'kecamatan' => $validated['kecamatan'] ?? null,
            'asal_sekolah' => $validated['asal_sekolah'] ?? null,
            'pilihan_jenjang' => $validated['pilihan_jenjang'] ?? 'Madrasah Diniyah & Pondok',
            'pilihan_asrama' => $validated['pilihan_asrama'] ?? ($validated['jenis_kelamin'] === 'P' ? 'Pondok Putri' : 'Pondok Putra'),
            'nama_ayah' => $validated['nama_ayah'] ?? null,
            'pekerjaan_ayah' => $validated['pekerjaan_ayah'] ?? null,
            'nama_ibu' => $validated['nama_ibu'] ?? null,
            'pekerjaan_ibu' => $validated['pekerjaan_ibu'] ?? null,
            'nama_wali' => $validated['nama_wali'] ?? ($validated['nama_ayah'] ?? null),
            'no_whatsapp_wali' => trim($validated['no_whatsapp_wali']),
            'dokumen_foto' => $fotoPath ? "/storage/{$fotoPath}" : null,
            'dokumen_kk' => $kkPath ? "/storage/{$kkPath}" : null,
            'dokumen_ijazah' => $ijazahPath ? "/storage/{$ijazahPath}" : null,
            'catatan_khusus' => $validated['catatan_khusus'] ?? null,
            'status' => 'pending',
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Pendaftaran online berhasil dikirim! Silakan simpan nomor registrasi Anda.',
            'data' => [
                'registration_number' => $registration->registration_number,
                'nama_lengkap' => $registration->nama_lengkap,
                'tanggal_daftar' => $registration->created_at->format('d M Y H:i'),
                'status' => $registration->status,
                'no_whatsapp_wali' => $registration->no_whatsapp_wali,
            ]
        ], 201);
    }

    /**
     * [PUBLIC] Lacak Status Pendaftaran PMB
     */
    public function checkStatus(Request $request): JsonResponse
    {
        $queryStr = trim($request->input('keyword', ''));
        if (empty($queryStr)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Masukkan Nomor Registrasi atau Nomor WhatsApp yang terdaftar.',
            ], 422);
        }

        // Cari berdasarkan nomor registrasi atau nomor whatsapp
        $cleanPhone = preg_replace('/[^0-9]/', '', $queryStr);
        $registrations = PmbRegistration::with('batch:id,nama_gelombang,tahun_akademik')
            ->where(function ($q) use ($queryStr, $cleanPhone) {
                $q->where('registration_number', 'ILIKE', "%{$queryStr}%")
                  ->orWhere('no_whatsapp_wali', 'LIKE', "%{$queryStr}%");
                if (strlen($cleanPhone) >= 7) {
                    $q->orWhere('no_whatsapp_wali', 'LIKE', "%{$cleanPhone}%");
                }
            })
            ->orderBy('id', 'desc')
            ->get();

        if ($registrations->isEmpty()) {
            return response()->json([
                'status' => 'error',
                'message' => "Data pendaftaran dengan kata kunci '{$queryStr}' tidak ditemukan. Mohon periksa kembali nomor registrasi atau nomor WhatsApp Anda.",
            ], 404);
        }

        $results = $registrations->map(function ($item) {
            return [
                'id' => $item->id,
                'registration_number' => $item->registration_number,
                'nama_lengkap' => $item->nama_lengkap,
                'jenis_kelamin' => $item->jenis_kelamin,
                'pilihan_jenjang' => $item->pilihan_jenjang,
                'pilihan_asrama' => $item->pilihan_asrama,
                'status' => $item->status,
                'status_label' => match($item->status) {
                    'pending' => 'Menunggu Verifikasi',
                    'reviewed' => 'Sedang Ditinjau Berkas',
                    'accepted' => 'Diterima (Lolos Seleksi)',
                    'rejected' => 'Perlu Perbaikan / Belum Lolos',
                    default => 'Diproses'
                },
                'catatan_admin' => $item->catatan_admin,
                'gelombang' => $item->batch?->nama_gelombang ?? '-',
                'tanggal_daftar' => $item->created_at?->format('d M Y H:i'),
                'is_converted' => $item->is_converted,
            ];
        });

        return response()->json([
            'status' => 'success',
            'data' => $results,
        ]);
    }

    /**
     * [ADMIN] Dashboard Statistik PMB
     */
    public function getDashboard(): JsonResponse
    {
        $this->ensureActiveBatch();

        $total = PmbRegistration::count();
        $today = PmbRegistration::whereDate('created_at', Carbon::today())->count();
        $pending = PmbRegistration::where('status', 'pending')->count();
        $reviewed = PmbRegistration::where('status', 'reviewed')->count();
        $accepted = PmbRegistration::where('status', 'accepted')->count();
        $rejected = PmbRegistration::where('status', 'rejected')->count();

        $putra = PmbRegistration::where('jenis_kelamin', 'L')->count();
        $putri = PmbRegistration::where('jenis_kelamin', 'P')->count();

        // Breakdown per jenjang
        $jenjangStats = PmbRegistration::query()
            ->select('pilihan_jenjang', DB::raw('count(*) as total'))
            ->groupBy('pilihan_jenjang')
            ->orderBy('total', 'desc')
            ->get();

        // Pendaftar Terbaru (5 orang)
        $latest = PmbRegistration::query()
            ->with('batch:id,nama_gelombang')
            ->orderBy('id', 'desc')
            ->limit(5)
            ->get();

        return response()->json([
            'status' => 'success',
            'data' => [
                'total' => $total,
                'today' => $today,
                'pending' => $pending,
                'reviewed' => $reviewed,
                'accepted' => $accepted,
                'rejected' => $rejected,
                'putra' => $putra,
                'putri' => $putri,
                'jenjang_stats' => $jenjangStats,
                'latest' => $latest,
            ]
        ]);
    }

    /**
     * [ADMIN] List Data Pendaftar PMB dengan Filter & Pagination
     */
    public function getRegistrations(Request $request): JsonResponse
    {
        $query = PmbRegistration::query()
            ->with([
                'batch:id,nama_gelombang,tahun_akademik',
                'verifier:id,name',
                'siswa:id,nis,nama,kelas,kamar'
            ]);

        // Filter status
        if ($request->filled('status') && $request->status !== 'all') {
            $query->where('status', $request->status);
        }

        // Filter jenis kelamin
        if ($request->filled('jenis_kelamin') && $request->jenis_kelamin !== 'all') {
            $query->where('jenis_kelamin', $request->jenis_kelamin);
        }

        // Filter batch
        if ($request->filled('pmb_batch_id') && $request->pmb_batch_id !== 'all') {
            $query->where('pmb_batch_id', $request->pmb_batch_id);
        }

        // Search
        if ($request->filled('search')) {
            $search = trim($request->search);
            $query->where(function ($q) use ($search) {
                $q->where('nama_lengkap', 'ILIKE', "%{$search}%")
                  ->orWhere('registration_number', 'ILIKE', "%{$search}%")
                  ->orWhere('no_whatsapp_wali', 'LIKE', "%{$search}%")
                  ->orWhere('kota', 'ILIKE', "%{$search}%")
                  ->orWhere('asal_sekolah', 'ILIKE', "%{$search}%");
            });
        }

        $perPage = max(10, min(100, (int) $request->input('per_page', 25)));
        $registrations = $query->orderBy('id', 'desc')->paginate($perPage);

        return response()->json([
            'status' => 'success',
            'data' => $registrations,
        ]);
    }

    /**
     * [ADMIN] Detail Calon Santri
     */
    public function getRegistrationDetail($id): JsonResponse
    {
        $registration = PmbRegistration::with(['batch', 'verifier:id,name', 'siswa'])->findOrFail($id);

        return response()->json([
            'status' => 'success',
            'data' => $registration,
        ]);
    }

    /**
     * [ADMIN] Ubah Status Verifikasi (Review / Tolak / Minta Perbaikan)
     */
    public function updateStatus(Request $request, $id): JsonResponse
    {
        $registration = PmbRegistration::findOrFail($id);

        $validated = $request->validate([
            'status' => 'required|in:pending,reviewed,accepted,rejected',
            'catatan_admin' => 'nullable|string',
        ]);

        $registration->update([
            'status' => $validated['status'],
            'catatan_admin' => $validated['catatan_admin'] ?? $registration->catatan_admin,
            'verified_at' => now(),
            'verified_by' => auth()->id(),
        ]);

        return response()->json([
            'status' => 'success',
            'message' => "Status pendaftaran {$registration->registration_number} berhasil diperbarui menjadi {$validated['status']}.",
            'data' => $registration,
        ]);
    }

    /**
     * [ADMIN] FITUR INTI: 1-Klik ACC & Konversi Calon Santri ke Santri Resmi (Tabel Siswa)
     */
    public function convertToSiswa(Request $request, $id): JsonResponse
    {
        $registration = PmbRegistration::findOrFail($id);

        if ($registration->is_converted && $registration->converted_siswa_id) {
            return response()->json([
                'status' => 'error',
                'message' => 'Calon santri ini sudah pernah dikonversi menjadi santri resmi sebelumnya.',
            ], 422);
        }

        $validated = $request->validate([
            'nis' => 'nullable|string|max:30',
            'class_id' => 'nullable|exists:classes,id',
            'boarding_room_id' => 'nullable|exists:boarding_rooms,id',
            'create_wali_user' => 'boolean',
            'catatan_admin' => 'nullable|string',
        ]);

        return DB::transaction(function () use ($registration, $validated) {
            $resolver = app(ReferenceResolver::class);

            // 1. Generate NIS jika tidak diinput manual
            $nis = trim($validated['nis'] ?? '');
            if (empty($nis)) {
                $year = date('Y');
                $lastSiswa = Siswa::where('nis', 'LIKE', "RT{$year}%")->orderBy('nis', 'desc')->first();
                $lastSeq = 1;
                if ($lastSiswa && preg_match('/RT' . $year . '(\d+)/', $lastSiswa->nis, $matches)) {
                    $lastSeq = (int) $matches[1] + 1;
                }
                $nis = sprintf("RT%s%04d", $year, $lastSeq);
                while (Siswa::where('nis', $nis)->exists()) {
                    $lastSeq++;
                    $nis = sprintf("RT%s%04d", $year, $lastSeq);
                }
            }

            // 2. Buat Akun Wali Santri jika diminta (default true)
            $waliId = null;
            $waliUser = null;
            $createWali = $validated['create_wali_user'] ?? true;
            if ($createWali) {
                $waliEmail = 'wali_' . strtolower($nis) . '@absensi.local';
                $defaultPass = 'siswa123';

                $waliUser = User::firstOrCreate(
                    ['email' => $waliEmail],
                    [
                        'name' => $registration->nama_wali ?: ('Wali ' . $registration->nama_lengkap),
                        'role' => 'wali',
                        'nis' => 'WLI_' . $nis,
                        'no_hp' => $registration->no_whatsapp_wali,
                        'status' => 'Aktif',
                        'password' => Hash::make($defaultPass),
                        'password_default_encrypted' => Crypt::encryptString($defaultPass),
                    ]
                );
                $waliId = $waliUser->id;
            }

            // 3. Tentukan Kamar & Komplek jika ada
            $roomName = null;
            $komplekName = null;
            $roomId = $validated['boarding_room_id'] ?? null;
            if ($roomId) {
                $room = BoardingRoom::with('complex')->find($roomId);
                if ($room) {
                    $roomName = $room->name;
                    $komplekName = $room->complex?->name;
                }
            }

            // 4. Tentukan Kelas Madin
            $classId = $validated['class_id'] ?? null;
            $className = null;
            if ($classId) {
                $cls = SchoolClass::find($classId);
                $className = $cls?->name;
            }

            // 5. Simpan Data Siswa Resmi ke tabel 'siswa'
            $siswa = Siswa::create([
                'nis' => $nis,
                'nisn' => $registration->nisn,
                'nik' => $registration->nik,
                'nama' => $registration->nama_lengkap,
                'nama_panggilan' => $registration->nama_panggilan,
                'jenis_kelamin' => $registration->jenis_kelamin,
                'tempat_lahir' => $registration->tempat_lahir,
                'tanggal_lahir' => $registration->tanggal_lahir,
                'alamat' => $registration->alamat_lengkap,
                'provinsi' => $registration->provinsi,
                'kota' => $registration->kota,
                'kecamatan' => $registration->kecamatan,
                'asal_sekolah' => $registration->asal_sekolah,
                'status' => 'Aktif',
                'status_mondok' => ($registration->pilihan_asrama === 'Non-Mukim' ? 'tidak_mondok' : 'mondok'),
                'class_id' => $classId,
                'kelas' => $className,
                'boarding_room_id' => $roomId,
                'kamar' => $roomName,
                'komplek' => $komplekName,
                'wali_id' => $waliId,
                'nama_wali' => $registration->nama_wali ?: ($registration->nama_ayah ?: 'Wali Santri'),
                'no_telepon_wali' => $registration->no_whatsapp_wali,
                'no_whatsapp' => $registration->no_whatsapp_wali,
                'wali_whatsapp_number' => $registration->no_whatsapp_wali,
                'nama_ayah' => $registration->nama_ayah,
                'pekerjaan_ayah' => $registration->pekerjaan_ayah,
                'nama_ibu' => $registration->nama_ibu,
                'pekerjaan_ibu' => $registration->pekerjaan_ibu,
                'foto_santri' => $registration->dokumen_foto,
                'catatan_santri' => $registration->catatan_khusus,
                'tahun_akademik_masuk' => $registration->batch?->tahun_akademik ?? '2026/2027',
                'tanggal_masuk' => now()->toDateString(),
                'tanggal_diterima_pondok' => now()->toDateString(),
            ]);

            // 6. Update status pendaftaran menjadi 'accepted' & 'is_converted'
            $registration->update([
                'status' => 'accepted',
                'is_converted' => true,
                'converted_siswa_id' => $siswa->id,
                'verified_at' => now(),
                'verified_by' => auth()->id(),
                'catatan_admin' => $validated['catatan_admin'] ?? 'Diterima resmi sebagai santri PP Qomaruddin.',
            ]);

            return response()->json([
                'status' => 'success',
                'message' => "Alhamdulillah! Calon santri {$registration->nama_lengkap} berhasil di-ACC dan dikonversi menjadi Santri Resmi PP Qomaruddin dengan NIS: {$nis}.",
                'data' => [
                    'siswa' => $siswa,
                    'registration' => $registration,
                    'wali_user' => $waliUser ? [
                        'email' => $waliUser->email,
                        'name' => $waliUser->name,
                        'default_password' => 'siswa123'
                    ] : null,
                ]
            ]);
        });
    }

    /**
     * [ADMIN] Kelola Gelombang PMB (Batches)
     */
    public function getBatches(): JsonResponse
    {
        $batches = PmbBatch::withCount('registrations')->orderBy('id', 'desc')->get();
        return response()->json([
            'status' => 'success',
            'data' => $batches,
        ]);
    }

    public function storeBatch(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'nama_gelombang' => 'required|string|max:100',
            'tahun_akademik' => 'required|string|max:30',
            'tanggal_mulai' => 'required|date',
            'tanggal_selesai' => 'required|date|after_or_equal:tanggal_mulai',
            'biaya_pendaftaran' => 'nullable|numeric|min:0',
            'kuota' => 'nullable|integer|min:1',
            'is_active' => 'boolean',
            'keterangan' => 'nullable|string',
        ]);

        if (!empty($validated['is_active'])) {
            PmbBatch::query()->update(['is_active' => false]);
        }

        $batch = PmbBatch::create($validated);

        return response()->json([
            'status' => 'success',
            'message' => 'Gelombang PMB baru berhasil dibuat.',
            'data' => $batch,
        ], 201);
    }

    public function updateBatch(Request $request, $id): JsonResponse
    {
        $batch = PmbBatch::findOrFail($id);

        $validated = $request->validate([
            'nama_gelombang' => 'required|string|max:100',
            'tahun_akademik' => 'required|string|max:30',
            'tanggal_mulai' => 'required|date',
            'tanggal_selesai' => 'required|date|after_or_equal:tanggal_mulai',
            'biaya_pendaftaran' => 'nullable|numeric|min:0',
            'kuota' => 'nullable|integer|min:1',
            'is_active' => 'boolean',
            'keterangan' => 'nullable|string',
        ]);

        if (!empty($validated['is_active']) && !$batch->is_active) {
            PmbBatch::where('id', '!=', $id)->update(['is_active' => false]);
        }

        $batch->update($validated);

        return response()->json([
            'status' => 'success',
            'message' => 'Data gelombang PMB berhasil diperbarui.',
            'data' => $batch,
        ]);
    }

    public function deleteBatch($id): JsonResponse
    {
        $batch = PmbBatch::findOrFail($id);
        if ($batch->registrations()->count() > 0) {
            return response()->json([
                'status' => 'error',
                'message' => 'Gelombang tidak dapat dihapus karena sudah memiliki calon santri yang mendaftar.',
            ], 422);
        }

        $batch->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Gelombang PMB berhasil dihapus.',
        ]);
    }
}
