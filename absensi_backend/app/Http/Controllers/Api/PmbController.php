<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BoardingRoom;
use App\Models\PmbAnnouncement;
use App\Models\PmbBatch;
use App\Models\PmbCmsSetting;
use App\Models\PmbRegistration;
use App\Models\SchoolClass;
use App\Models\Siswa;
use App\Models\User;
use App\Services\ReferenceResolver;
use App\Services\WhatsAppNotificationService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
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
     * 🛡️ Pastikan pengguna memiliki wewenang mengakses modul PMB.
     * Khusus Admin IT selalu memiliki akses penuh 100%.
     * Admin non-IT (seperti Pengurus) hanya diizinkan jika pmb_visible_to_pengurus bernilai true.
     */
    private function checkPmbAccess(?Request $request = null): void
    {
        $user = $request ? $request->user() : request()->user();
        if (!$user || $user->role !== 'admin') {
            abort(403, 'Akses ditolak: Anda tidak memiliki wewenang administrator.');
        }

        $adminType = strtolower((string) ($user->admin_type ?? ''));
        $isIt = in_array($adminType, ['it', 'superadmin'], true) ||
            $user->email === 'syauqillah@absensi.com' ||
            str_contains(strtolower($user->name ?? ''), 'syauqillah');

        if ($isIt) {
            return;
        }

        $isPmbUser = in_array($adminType, ['pmb', 'admin_pmb'], true);
        if ($isPmbUser) {
            return;
        }

        $visibleToPengurus = (bool) PmbCmsSetting::getValue('pmb_visible_to_pengurus', false);
        if (!$visibleToPengurus) {
            abort(403, 'Modul PMB saat ini sedang dalam persiapan internal IT dan belum dirilis untuk pengurus.');
        }
    }

    /**
     * [ADMIN IT ONLY] Mengaktifkan atau menonaktifkan visibilitas modul PMB ke Admin Pengurus
     */
    public function togglePengurusVisibility(Request $request): JsonResponse
    {
        $user = $request->user();
        $adminType = strtolower((string) ($user->admin_type ?? ''));
        $isIt = in_array($adminType, ['it', 'superadmin'], true) ||
            $user->email === 'syauqillah@absensi.com' ||
            str_contains(strtolower($user->name ?? ''), 'syauqillah');

        if (!$isIt) {
            return response()->json([
                'status' => 'error',
                'message' => 'Hanya Admin IT (Super Admin) yang berwenang mengubah status rilis modul PMB ke Admin Pengurus.',
            ], 403);
        }

        $current = (bool) PmbCmsSetting::getValue('pmb_visible_to_pengurus', false);
        $next = $request->has('visible')
            ? filter_var($request->input('visible'), FILTER_VALIDATE_BOOLEAN)
            : !$current;

        PmbCmsSetting::setValue('pmb_visible_to_pengurus', $next, 'system', 'Tampilkan Modul & Manajemen PMB ke Admin Pengurus', 'boolean');

        $statusText = $next ? 'DITAMPILKAN ke Admin Pengurus' : 'DISEMBUNYIKAN dari Admin Pengurus (Khusus IT Saja)';

        return response()->json([
            'status' => 'success',
            'pmb_visible_to_pengurus' => $next,
            'message' => "Modul PMB sekarang $statusText.",
        ]);
    }

    /**
     * [PUBLIC] Informasi PMB & Profil Lengkap Pesantren Qomaruddin (CMS-driven ala WordPress)
     */
    public function getInfo(): JsonResponse
    {
        $batch = $this->ensureActiveBatch();

        $totalRegistered = PmbRegistration::where('pmb_batch_id', $batch->id)->count();
        $quotaRemaining = $batch->kuota ? max(0, $batch->kuota - $totalRegistered) : null;

        // Cek status buka/tutup PMB dari CMS
        $pmbIsOpen = PmbCmsSetting::getValue('pmb_is_open', true);
        $pmbClosedMessage = PmbCmsSetting::getValue('pmb_closed_message', 'Pendaftaran Santri Baru Gelombang Ini Saat Ini Sedang Ditutup. Silakan Pantau Pengumuman Resmi Berkala.');

        // Metadata Profil Dinamis dari CMS dengan Fallback Nilai Standar
        $defaultPrograms = [
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
        ];

        $defaultFasilitas = [
            'Masjid Jami\' Qomaruddin yang Megah & Bersejarah',
            'Komplek Asrama Santri Putra & Putri Representatif',
            'Perpustakaan Khazanah Kitab Salaf & Referensi Modern',
            'Laboratorium Komputer & Bahasa',
            'Klinik Kesehatan Pesantren (Poskestren)',
            'Kantin, Koperasi Pesantren & Dapur Bersih',
            'Sarana Olahraga & Seni Hadrah Al-Banjari'
        ];

        $profil = [
            'nama_pesantren' => PmbCmsSetting::getValue('nama_pesantren', 'Pondok Pesantren Qomaruddin'),
            'pendiri' => PmbCmsSetting::getValue('pendiri', 'Kiai Qomaruddin (Mbah Kiai Qomaruddin)'),
            'tahun_berdiri' => PmbCmsSetting::getValue('tahun_berdiri', '1775 M (Lebih dari 250 Tahun Berkhidmah)'),
            'alamat' => PmbCmsSetting::getValue('alamat', 'Jl. Sampurnan No. 01, Bungah, Kabupaten Gresik, Jawa Timur 61152'),
            'telepon' => PmbCmsSetting::getValue('telepon', '0812-3456-7890'),
            'email' => PmbCmsSetting::getValue('email', 'pmb@ppqomaruddin.itqom.net'),
            'website' => PmbCmsSetting::getValue('website', 'https://ppqomaruddin.itqom.net'),
            'tagline' => PmbCmsSetting::getValue('tagline', 'Mencetak Generasi Berakhlakul Karimah, Unggul Ilmu Agama & Berdaya Saing Global'),
            'sejarah' => PmbCmsSetting::getValue('sejarah', 'Pondok Pesantren Qomaruddin didirikan pada tahun 1775 M oleh Kiai Qomaruddin, seorang ulama kharismatik pejuang dakwah Islam Nusantara di wilayah Sampurnan, Bungah, Gresik. Lembaga ini terus bertumbuh melahirkan generasi ulama, cendekiawan Muslim, dan pemimpin bangsa.'),
            'visi' => PmbCmsSetting::getValue('visi', 'Terwujudnya insan kamil yang kokoh dalam aqidah Ahlussunnah Wal Jamaah, unggul dalam keilmuan agama, berakhlak mulia, dan mandiri.'),
            'misi' => PmbCmsSetting::getValue('misi', "1. Menyelenggarakan pendidikan pesantren salafiyah berbasis kitab kuning otentik.\n2. Mengintegrasikan pendidikan agama, tahfidz, dan sains modern.\n3. Membentuk karakter santri yang beradab, disiplin, dan berjiwa khidmah."),
            'agenda_kedatangan_info' => PmbCmsSetting::getValue('agenda_kedatangan_info', 'Santri baru yang telah diterima (ACC) wajib diantar ke pondok pesantren sesuai tanggal kalender yang telah ditetapkan oleh Panitia PMB.'),
            'program_unggulan' => PmbCmsSetting::getValue('program_unggulan', $defaultPrograms),
            'fasilitas' => PmbCmsSetting::getValue('fasilitas', $defaultFasilitas),
        ];

        // Ambil pengumuman dan berita terbaru yang dipublikasikan
        $announcements = PmbAnnouncement::where('is_published', true)
            ->orderBy('is_pinned', 'desc')
            ->orderBy('event_date', 'asc')
            ->orderBy('id', 'desc')
            ->limit(10)
            ->get();

        return response()->json([
            'status' => 'success',
            'data' => [
                'active_batch' => $batch,
                'total_registered' => $totalRegistered,
                'quota_remaining' => $quotaRemaining,
                'pmb_is_open' => (bool)$pmbIsOpen,
                'pmb_closed_message' => $pmbClosedMessage,
                'pmb_visible_to_pengurus' => (bool) PmbCmsSetting::getValue('pmb_visible_to_pengurus', false),
                'profil' => $profil,
                'announcements' => $announcements,
            ]
        ]);
    }

    /**
     * [PUBLIC] Pendaftaran Santri Baru Online (Hanya jika PMB Dibuka)
     */
    public function register(Request $request): JsonResponse
    {
        // 1. Cek Apakah PMB sedang dibuka
        $pmbIsOpen = PmbCmsSetting::getValue('pmb_is_open', true);
        if (!$pmbIsOpen) {
            $msg = PmbCmsSetting::getValue('pmb_closed_message', 'Mohon maaf, Pendaftaran Santri Baru (PMB) saat ini sedang DITUTUP oleh Panitia PMB. Silakan pantau pengumuman resmi berkala di halaman ini.');
            return response()->json([
                'status' => 'error',
                'message' => $msg,
            ], 403);
        }

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

        // Tentukan Batch Aktif
        $batchId = $validated['pmb_batch_id'] ?? null;
        $batch = null;
        if ($batchId) {
            $batch = PmbBatch::find($batchId);
        }
        if (!$batch) {
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

        // Generate Password Acak untuk Akun Wali/Santri (Format: QMR + 4 digit angka acak)
        $randomPassword = 'QMR' . mt_rand(1000, 9999);
        $waliEmail = strtolower($regNumber) . '@pmb.qomaruddin.ponpes.id';

        // Buat Akun Login Pengguna (Role: Wali)
        $user = User::create([
            'name' => $validated['nama_wali'] ?? ($validated['nama_ayah'] ?? $validated['nama_lengkap']),
            'email' => $waliEmail,
            'nis' => $regNumber,
            'no_hp' => trim($validated['no_whatsapp_wali']),
            'role' => 'wali',
            'status' => 'Aktif',
            'password' => Hash::make($randomPassword),
            'password_current_encrypted' => Crypt::encryptString($randomPassword),
            'password_default_encrypted' => Crypt::encryptString($randomPassword),
            'must_change_password' => false,
        ]);

        // Simpan ke Staging PMB (Status: pending, BELUM masuk ke Buku Induk)
        $biayaBatch = (float)($batch->biaya_pendaftaran ?? 150000);
        $registration = PmbRegistration::create([
            'registration_number' => $regNumber,
            'pmb_batch_id' => $batchId,
            'user_id' => $user->id,
            'account_username' => $regNumber,
            'account_initial_password' => $randomPassword,
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
            'payment_status' => 'pending',
            'payment_amount' => $biayaBatch,
            'payment_notes' => 'Menunggu verifikasi audit administrasi pendaftaran oleh Panitia PMB.',
            'wa_notif_sent' => false,
        ]);

        // Kirim Notifikasi Otomatis WhatsApp ke Nomor Wali Santri
        $portalUrl = rtrim(config('app.url') ?: 'https://ppqomaruddin.itqom.net', '/') . '/?pmb=1';
        $waMessage = "*PENERIMAAN SANTRI BARU (PMB)*\n"
            . "*PONDOK PESANTREN QOMARUDDIN*\n"
            . "_Sampurnan, Bungah, Gresik, Jawa Timur (Sejak 1775 M)_\n"
            . "======================================\n\n"
            . "Assalamu'alaikum Warahmatullahi Wabarakatuh,\n\n"
            . "Yth. Bapak/Ibu Wali dari calon santri *{$registration->nama_lengkap}*,\n\n"
            . "Alhamdulillah, formulir pendaftaran santri baru telah *BERHASIL KAMI TERIMA* secara realtime.\n\n"
            . "Rincian pendaftaran & akun login portal Anda:\n"
            . "--------------------------------------\n"
            . "📋 *No. Registrasi* : *{$regNumber}*\n"
            . "👤 *Nama Santri*     : {$registration->nama_lengkap}\n"
            . "🌊 *Gelombang*       : {$batch->nama_gelombang}\n"
            . "📅 *Waktu Daftar*    : " . $registration->created_at->format('d M Y H:i') . " WIB\n"
            . "🏢 *Pilihan Program* : {$registration->pilihan_jenjang}\n"
            . "🏠 *Pilihan Asrama*  : {$registration->pilihan_asrama}\n\n"
            . "🔐 *AKUN LOGIN PORTAL PMB*:\n"
            . "• *Username / ID* : *{$regNumber}*\n"
            . "• *Password*      : *{$randomPassword}*\n"
            . "--------------------------------------\n\n"
            . "🌐 *Lacak Status & Melengkapi Berkas*:\n"
            . "{$portalUrl}\n\n"
            . "📌 *PANDUAN TAHAPAN SELANJUTNYA*:\n"
            . "1. Berkas Anda saat ini masuk ke antrian audit panitia PMB.\n"
            . "2. Anda dapat memantau status audit & rincian pembayaran melalui link portal di atas.\n"
            . "3. Setelah diaudit dan di-ACC oleh Admin PMB, santri resmi terdaftar di Buku Induk Santri.\n\n"
            . "Jazakumullahu Khairan Katsiran atas kepercayaan Bapak/Ibu kepada Pondok Pesantren Qomaruddin.\n\n"
            . "Wassalamu'alaikum Warahmatullahi Wabarakatuh.\n"
            . "--------------------------------------\n"
            . "*Panitia PMB Pondok Pesantren Qomaruddin*\n"
            . "📞 Narahubung: 0812-3456-7890\n"
            . "🌐 Website: https://ppqomaruddin.itqom.net";

        $waSent = false;
        try {
            if (class_exists(WhatsAppNotificationService::class)) {
                $notifService = app(WhatsAppNotificationService::class);
                $log = $notifService->queueManual($registration->no_whatsapp_wali, $waMessage);
                if ($log) {
                    $waSent = true;
                    $registration->update([
                        'wa_notif_sent' => true,
                        'wa_notif_at' => now(),
                    ]);
                }
            }
        } catch (\Throwable $e) {
            Log::warning("Gagal mengirim notifikasi WA PMB {$regNumber}: " . $e->getMessage());
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Pendaftaran online berhasil dikirim! Akun login telah dibuat dan notifikasi dikirimkan ke WhatsApp Anda.',
            'data' => [
                'registration_number' => $registration->registration_number,
                'nama_lengkap' => $registration->nama_lengkap,
                'tanggal_daftar' => $registration->created_at->format('d M Y H:i'),
                'status' => $registration->status,
                'no_whatsapp_wali' => $registration->no_whatsapp_wali,
                'username' => $regNumber,
                'random_password' => $randomPassword,
                'wa_notif_sent' => $waSent,
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

        $cleanPhone = preg_replace('/[^0-9]/', '', $queryStr);
        $registrations = PmbRegistration::with(['batch:id,nama_gelombang,tahun_akademik', 'siswa:id,nis,nama,kelas,kamar'])
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
                    'pending' => 'Menunggu Verifikasi Audit',
                    'reviewed' => 'Sedang Diaudit Berkas',
                    'accepted' => 'Diterima Resmi (Lolos Seleksi)',
                    'rejected' => 'Perlu Perbaikan / Belum Lolos',
                    default => 'Diproses'
                },
                'payment_status' => $item->payment_status ?? 'pending',
                'payment_amount' => (float)($item->payment_amount ?? 0),
                'payment_notes' => $item->payment_notes,
                'catatan_admin' => $item->catatan_admin,
                'gelombang' => $item->batch?->nama_gelombang ?? '-',
                'tahun_akademik' => $item->batch?->tahun_akademik ?? '-',
                'tanggal_daftar' => $item->created_at?->format('d M Y H:i'),
                'is_converted' => $item->is_converted,
                'nis_resmi' => $item->siswa?->nis,
                'kelas_resmi' => $item->siswa?->kelas,
                'kamar_resmi' => $item->siswa?->kamar,
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
        $this->checkPmbAccess();
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

        $pmbIsOpen = PmbCmsSetting::getValue('pmb_is_open', true);
        $pmbVisibleToPengurus = (bool) PmbCmsSetting::getValue('pmb_visible_to_pengurus', false);

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
                'pmb_is_open' => (bool)$pmbIsOpen,
                'pmb_visible_to_pengurus' => $pmbVisibleToPengurus,
            ]
        ]);
    }

    /**
     * [ADMIN] List Data Pendaftar PMB dengan Filter & Pagination
     */
    public function getRegistrations(Request $request): JsonResponse
    {
        $this->checkPmbAccess($request);
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

        // Filter status pembayaran
        if ($request->filled('payment_status') && $request->payment_status !== 'all') {
            $query->where('payment_status', $request->payment_status);
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
        $this->checkPmbAccess();
        $registration = PmbRegistration::with(['batch', 'verifier:id,name', 'siswa'])->findOrFail($id);

        return response()->json([
            'status' => 'success',
            'data' => $registration,
        ]);
    }

    /**
     * [ADMIN] Audit Calon Santri (Ubah Status ke Reviewed/Pending/Rejected + Set Instruksi Pembayaran + Kirim WA)
     */
    public function auditRegistration(Request $request, $id): JsonResponse
    {
        $this->checkPmbAccess($request);
        $registration = PmbRegistration::findOrFail($id);

        $validated = $request->validate([
            'status' => 'required|in:pending,reviewed,accepted,rejected',
            'catatan_admin' => 'nullable|string',
            'payment_status' => 'nullable|in:pending,perlu_pelunasan,lunas,gratis',
            'payment_amount' => 'nullable|numeric|min:0',
            'payment_notes' => 'nullable|string',
            'send_wa' => 'boolean',
        ]);

        $registration->update([
            'status' => $validated['status'],
            'catatan_admin' => $validated['catatan_admin'] ?? $registration->catatan_admin,
            'payment_status' => $validated['payment_status'] ?? $registration->payment_status,
            'payment_amount' => isset($validated['payment_amount']) ? (float)$validated['payment_amount'] : $registration->payment_amount,
            'payment_notes' => $validated['payment_notes'] ?? $registration->payment_notes,
            'verified_at' => now(),
            'verified_by' => auth()->id(),
        ]);

        // Kirim WhatsApp Audit / Instruksi Pelunasan jika diminta
        if (!empty($validated['send_wa']) && !empty($registration->no_whatsapp_wali)) {
            $portalUrl = rtrim(config('app.url') ?: 'https://ppqomaruddin.itqom.net', '/') . '/?pmb=1';
            $statusLabel = match($registration->status) {
                'reviewed' => 'SEDANG DIAUDIT / PERLU TINDAK LANJUT',
                'accepted' => 'DITERIMA (ACC)',
                'rejected' => 'PERLU PERBAIKAN BERKAS',
                default => 'PENDING'
            };

            $waMsg = "*UPDATE AUDIT & ADMINISTRASI PMB*\n"
                . "*PONDOK PESANTREN QOMARUDDIN*\n"
                . "--------------------------------------\n\n"
                . "Assalamu'alaikum Warahmatullahi Wabarakatuh,\n\n"
                . "Yth. Bapak/Ibu Wali dari calon santri *{$registration->nama_lengkap}*,\n"
                . "📋 *No. Registrasi* : *{$registration->registration_number}*\n\n"
                . "Hasil Audit Panitia: *" . $statusLabel . "*\n"
                . ($registration->catatan_admin ? "📝 *Catatan Panitia* : {$registration->catatan_admin}\n" : "")
                . ($registration->payment_status ? "💳 *Status Pembayaran* : *" . strtoupper(str_replace('_', ' ', $registration->payment_status)) . "* (Rp " . number_format((float)$registration->payment_amount, 0, ',', '.') . ")\n" : "")
                . ($registration->payment_notes ? "📌 *Instruksi* : {$registration->payment_notes}\n\n" : "\n")
                . "Silakan login ke portal untuk melengkapi berkas atau melihat rincian:\n"
                . "{$portalUrl}\n\n"
                . "Wassalamu'alaikum Warahmatullahi Wabarakatuh.\n"
                . "--------------------------------------\n"
                . "*Panitia PMB PP Qomaruddin*";

            try {
                if (class_exists(WhatsAppNotificationService::class)) {
                    app(WhatsAppNotificationService::class)->queueManual($registration->no_whatsapp_wali, $waMsg);
                }
            } catch (\Throwable $e) {
                Log::warning("Gagal mengirim WA audit PMB {$registration->registration_number}: " . $e->getMessage());
            }
        }

        return response()->json([
            'status' => 'success',
            'message' => "Audit berkas {$registration->registration_number} berhasil disimpan.",
            'data' => $registration->fresh(['batch', 'verifier:id,name', 'siswa']),
        ]);
    }

    /**
     * [ADMIN] Update Status Pembayaran Formulir PMB
     */
    public function updatePayment(Request $request, $id): JsonResponse
    {
        $this->checkPmbAccess($request);
        $registration = PmbRegistration::findOrFail($id);

        $validated = $request->validate([
            'payment_status' => 'required|in:pending,perlu_pelunasan,lunas,gratis',
            'payment_amount' => 'nullable|numeric|min:0',
            'payment_notes' => 'nullable|string',
            'send_wa' => 'boolean',
        ]);

        $isLunas = in_array($validated['payment_status'], ['lunas', 'gratis']);

        $registration->update([
            'payment_status' => $validated['payment_status'],
            'payment_amount' => isset($validated['payment_amount']) ? (float)$validated['payment_amount'] : $registration->payment_amount,
            'payment_notes' => $validated['payment_notes'] ?? $registration->payment_notes,
            'payment_verified_at' => $isLunas ? now() : null,
        ]);

        if (!empty($validated['send_wa']) && !empty($registration->no_whatsapp_wali)) {
            $statusLabel = strtoupper(str_replace('_', ' ', $registration->payment_status));
            $nominalFmt = number_format((float)$registration->payment_amount, 0, ',', '.');
            $waMsg = "*STATUS PEMBAYARAN PMB*\n"
                . "*PONDOK PESANTREN QOMARUDDIN*\n"
                . "--------------------------------------\n\n"
                . "Yth. Bapak/Ibu Wali dari *{$registration->nama_lengkap}*,\n"
                . "📋 *No. Registrasi* : *{$registration->registration_number}*\n\n"
                . "Status Pembayaran: *{$statusLabel}*\n"
                . "Nominal: *Rp {$nominalFmt}*\n"
                . ($registration->payment_notes ? "Catatan Panitia: {$registration->payment_notes}\n\n" : "\n")
                . ($isLunas
                    ? "Alhamdulillah, pembayaran pendaftaran Anda telah *TERVERIFIKASI & LUNAS*.\n"
                    : "Mohon segera menyelesaikan administrasi pendaftaran sesuai petunjuk di atas.\n")
                . "Wassalamu'alaikum Warahmatullahi Wabarakatuh.\n"
                . "--------------------------------------\n"
                . "*Panitia PMB PP Qomaruddin*";

            try {
                if (class_exists(WhatsAppNotificationService::class)) {
                    app(WhatsAppNotificationService::class)->queueManual($registration->no_whatsapp_wali, $waMsg);
                }
            } catch (\Throwable $e) {
                Log::warning("Gagal mengirim WA pembayaran PMB: " . $e->getMessage());
            }
        }

        return response()->json([
            'status' => 'success',
            'message' => "Status pembayaran {$registration->registration_number} berhasil diperbarui.",
            'data' => $registration->fresh(['batch', 'verifier:id,name', 'siswa']),
        ]);
    }

    /**
     * [ADMIN] Ubah Status Verifikasi Umum (Review / Tolak / Pending)
     */
    public function updateStatus(Request $request, $id): JsonResponse
    {
        $this->checkPmbAccess($request);
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
     * [ADMIN] Kirim / Kirim Ulang Notifikasi WhatsApp Berisi Kredensial Akun Calon Santri
     */
    public function resendWaNotification($id): JsonResponse
    {
        $this->checkPmbAccess();
        $registration = PmbRegistration::with('user')->findOrFail($id);
        $password = $registration->account_initial_password;

        if (!$password) {
            $password = 'QMR' . mt_rand(1000, 9999);
            $registration->update(['account_initial_password' => $password]);
            if ($registration->user) {
                $registration->user->update([
                    'password' => Hash::make($password),
                    'password_current_encrypted' => Crypt::encryptString($password),
                    'password_default_encrypted' => Crypt::encryptString($password),
                ]);
            }
        }

        $portalUrl = rtrim(config('app.url') ?: 'https://ppqomaruddin.itqom.net', '/') . '/?pmb=1';
        $waMessage = "*PENERIMAAN SANTRI BARU (PMB)*\n"
            . "*PONDOK PESANTREN QOMARUDDIN*\n"
            . "_Sampurnan, Bungah, Gresik, Jawa Timur (Sejak 1775 M)_\n"
            . "======================================\n\n"
            . "Assalamu'alaikum Warahmatullahi Wabarakatuh,\n\n"
            . "Yth. Bapak/Ibu Wali dari calon santri *{$registration->nama_lengkap}*,\n\n"
            . "Berikut kami kirimkan kembali rincian pendaftaran & akun login portal Anda:\n"
            . "--------------------------------------\n"
            . "📋 *No. Registrasi* : *{$registration->registration_number}*\n"
            . "👤 *Nama Santri*     : {$registration->nama_lengkap}\n"
            . "🏢 *Pilihan Program* : {$registration->pilihan_jenjang}\n"
            . "🏠 *Pilihan Asrama*  : {$registration->pilihan_asrama}\n\n"
            . "🔐 *AKUN LOGIN PORTAL PMB*:\n"
            . "• *Username / ID* : *{$registration->registration_number}*\n"
            . "• *Password*      : *{$password}*\n"
            . "--------------------------------------\n\n"
            . "🌐 *Lacak Status & Cetak Kartu Digital*:\n"
            . "{$portalUrl}\n\n"
            . "📌 *Catatan*: Simpan informasi ini dengan baik untuk memantau status verifikasi dan seleksi santri baru.\n\n"
            . "Wassalamu'alaikum Warahmatullahi Wabarakatuh.\n"
            . "--------------------------------------\n"
            . "*Panitia PMB Pondok Pesantren Qomaruddin*\n"
            . "📞 Narahubung: 0812-3456-7890\n"
            . "🌐 Website: https://ppqomaruddin.itqom.net";

        try {
            $notifService = app(WhatsAppNotificationService::class);
            $notifService->queueManual($registration->no_whatsapp_wali, $waMessage);
            $registration->update([
                'wa_notif_sent' => true,
                'wa_notif_at' => now(),
            ]);

            return response()->json([
                'status' => 'success',
                'message' => "Notifikasi WhatsApp berhasil dikirimkan ke {$registration->no_whatsapp_wali}",
                'data' => [
                    'username' => $registration->registration_number,
                    'password' => $password,
                    'wa_notif_sent' => true,
                ]
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'Gagal mengirim pesan WhatsApp: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * [ADMIN] FITUR INTI: 1-Klik ACC & Konversi Calon Santri ke Santri Resmi (Tabel Siswa / Buku Induk)
     * Otomatis catat histori Gelombang PMB & kirim WhatsApp Resmi Pengumuman Penerimaan ke Wali!
     */
    public function convertToSiswa(Request $request, $id): JsonResponse
    {
        $this->checkPmbAccess($request);
        $registration = PmbRegistration::with('batch')->findOrFail($id);

        if ($registration->is_converted && $registration->converted_siswa_id) {
            return response()->json([
                'status' => 'error',
                'message' => 'Calon santri ini sudah pernah di-ACC dan dikonversi menjadi santri resmi sebelumnya.',
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

            // 2. Hubungkan atau Buat Akun Wali Santri
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

            // 5. Simpan Histori Gelombang PMB ke catatan santri & tahun akademik masuk
            $batchName = $registration->batch?->nama_gelombang ?? 'Gelombang 1';
            $batchTahun = $registration->batch?->tahun_akademik ?? (date('Y') . '/' . (date('Y') + 1));
            $historiPmb = "[Diterima via PMB {$batchName} | No. Reg: {$registration->registration_number}]";
            $finalCatatan = trim($historiPmb . ' ' . ($registration->catatan_khusus ?? ''));

            // 6. Simpan Data Siswa Resmi ke tabel 'siswa' (Buku Induk Santri)
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
                'catatan_santri' => $finalCatatan,
                'tahun_akademik_masuk' => $batchTahun,
                'tanggal_masuk' => now()->toDateString(),
                'tanggal_diterima_pondok' => now()->toDateString(),
            ]);

            // 7. Update status pendaftaran menjadi 'accepted' & 'is_converted'
            $registration->update([
                'status' => 'accepted',
                'is_converted' => true,
                'converted_siswa_id' => $siswa->id,
                'verified_at' => now(),
                'verified_by' => auth()->id(),
                'catatan_admin' => $validated['catatan_admin'] ?? "Diterima resmi sebagai santri PP Qomaruddin via {$batchName}.",
            ]);

            // 8. Kirim Notifikasi WhatsApp Resmi Penerimaan / Kelulusan PMB ke Wali Santri
            $portalUrl = rtrim(config('app.url') ?: 'https://ppqomaruddin.itqom.net', '/') . '/?pmb=1';
            $agendaInfo = PmbCmsSetting::getValue('agenda_kedatangan_info', 'Santri baru wajib diantar ke pondok sesuai kalender pesantren dan membawa berkas administrasi fisik.');
            
            $waAcceptMsg = "*PENGUMUMAN RESMI KELULUSAN & PENERIMAAN PMB*\n"
                . "*PONDOK PESANTREN QOMARUDDIN SAMPURNAN*\n"
                . "======================================\n\n"
                . "Assalamu'alaikum Warahmatullahi Wabarakatuh,\n\n"
                . "Kabar Gembira! Kami ucapkan *SELAMAT* kepada Bapak/Ibu Wali,\n"
                . "Calon santri berikut telah resmi *DITERIMA (ACC)* sebagai Santri Baru Pondok Pesantren Qomaruddin:\n\n"
                . "👤 *Nama Santri*     : *{$registration->nama_lengkap}*\n"
                . "📋 *No. Registrasi* : {$registration->registration_number}\n"
                . "🆔 *NIS Resmi*       : *{$nis}*\n"
                . "🌊 *Gelombang*       : {$batchName} (TA {$batchTahun})\n"
                . ($className ? "📚 *Kelas Madin*     : {$className}\n" : "")
                . ($roomName ? "🏠 *Kamar / Asrama*  : {$roomName} ({$komplekName})\n" : "")
                . "📅 *Tahun Masuk*     : {$batchTahun}\n\n"
                . "📌 *INFORMASI KEDATANGAN & MASUK ASRAMA*:\n"
                . "{$agendaInfo}\n\n"
                . "Cetak Kartu Santri & Pantau Agenda Resmi:\n"
                . "{$portalUrl}\n\n"
                . "Ahlan Wa Sahlan Bi Khudurikum di Pondok Pesantren Qomaruddin.\n\n"
                . "Wassalamu'alaikum Warahmatullahi Wabarakatuh.\n"
                . "--------------------------------------\n"
                . "*Panitia PMB & Pengurus PP Qomaruddin*\n"
                . "📞 Narahubung: 0812-3456-7890";

            try {
                if (class_exists(WhatsAppNotificationService::class)) {
                    app(WhatsAppNotificationService::class)->queueManual($registration->no_whatsapp_wali, $waAcceptMsg);
                }
            } catch (\Throwable $e) {
                Log::warning("Gagal mengirim WA penerimaan santri {$nis}: " . $e->getMessage());
            }

            return response()->json([
                'status' => 'success',
                'message' => "Alhamdulillah! Calon santri {$registration->nama_lengkap} berhasil di-ACC dan dikonversi ke Buku Induk Santri dengan NIS: {$nis}.",
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
        $this->checkPmbAccess();
        $batches = PmbBatch::withCount('registrations')->orderBy('id', 'desc')->get();
        return response()->json([
            'status' => 'success',
            'data' => $batches,
        ]);
    }

    public function storeBatch(Request $request): JsonResponse
    {
        $this->checkPmbAccess($request);
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
        $this->checkPmbAccess($request);
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
        $this->checkPmbAccess();
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

    // =========================================================================
    // CMS WEB PROFIL PESANTREN (ALA WORDPRESS) & MASTER TOGGLE PMB
    // =========================================================================

    /**
     * [ADMIN] Sakelar Cerdas: Buka / Tutup Pendaftaran PMB
     */
    public function togglePmbStatus(Request $request): JsonResponse
    {
        $this->checkPmbAccess($request);
        $validated = $request->validate([
            'is_open' => 'nullable|boolean',
            'closed_message' => 'nullable|string',
        ]);

        $current = PmbCmsSetting::getValue('pmb_is_open', true);
        $newStatus = isset($validated['is_open']) ? (bool)$validated['is_open'] : !$current;

        PmbCmsSetting::setValue('pmb_is_open', $newStatus, 'general', 'Status Pendaftaran PMB Dibuka/Ditutup', 'boolean');

        if (!empty($validated['closed_message'])) {
            PmbCmsSetting::setValue('pmb_closed_message', $validated['closed_message'], 'general', 'Pesan Penutupan PMB', 'textarea');
        }

        $statusText = $newStatus ? 'DIBUKA' : 'DITUTUP';

        return response()->json([
            'status' => 'success',
            'message' => "Pendaftaran PMB berhasil di-{$statusText}.",
            'data' => [
                'pmb_is_open' => $newStatus,
                'pmb_closed_message' => PmbCmsSetting::getValue('pmb_closed_message'),
            ]
        ]);
    }

    /**
     * [PUBLIC] Dapatkan Setting CMS Web Profil
     */
    public function getCmsSettings(): JsonResponse
    {
        $settings = PmbCmsSetting::all();
        $map = [];
        foreach ($settings as $s) {
            if ($s->type === 'boolean') {
                $map[$s->key] = filter_var($s->value, FILTER_VALIDATE_BOOLEAN);
            } elseif ($s->type === 'json') {
                $map[$s->key] = json_decode($s->value, true);
            } else {
                $map[$s->key] = $s->value;
            }
        }

        return response()->json([
            'status' => 'success',
            'data' => $map,
        ]);
    }

    /**
     * [ADMIN] Dapatkan Seluruh Setting CMS Lengkap dengan Metadata Form
     */
    public function getCmsSettingsAdmin(): JsonResponse
    {
        $this->checkPmbAccess();
        // Pastikan pmb_visible_to_pengurus ada di setting
        PmbCmsSetting::firstOrCreate(
            ['key' => 'pmb_visible_to_pengurus'],
            [
                'value' => 'false',
                'group' => 'system',
                'type' => 'boolean',
                'label' => 'Tampilkan Modul & Manajemen PMB ke Admin Pengurus',
            ]
        );

        $settings = PmbCmsSetting::orderBy('group')->orderBy('id')->get();
        return response()->json([
            'status' => 'success',
            'data' => $settings,
            'pmb_visible_to_pengurus' => (bool) PmbCmsSetting::getValue('pmb_visible_to_pengurus', false),
        ]);
    }

    /**
     * [ADMIN] Update Pengaturan CMS Web Profil ala WordPress
     */
    public function updateCmsSettings(Request $request): JsonResponse
    {
        $this->checkPmbAccess($request);
        $validated = $request->validate([
            'settings' => 'required|array',
            'settings.*.key' => 'required|string',
            'settings.*.value' => 'nullable',
            'settings.*.group' => 'nullable|string',
            'settings.*.label' => 'nullable|string',
            'settings.*.type' => 'nullable|string|in:text,textarea,json,boolean,image',
        ]);

        foreach ($validated['settings'] as $item) {
            $key = $item['key'];
            $value = $item['value'] ?? null;
            $group = $item['group'] ?? 'general';
            $label = $item['label'] ?? null;
            $type = $item['type'] ?? 'text';

            PmbCmsSetting::setValue($key, $value, $group, $label, $type);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Pengaturan Web Profil Pesantren (CMS) berhasil diperbarui.',
        ]);
    }

    // =========================================================================
    // BERITA, PENGUMUMAN & AGENDA KEDATANGAN SANTRI BARU
    // =========================================================================

    /**
     * [PUBLIC] Dapatkan Pengumuman & Berita yang Dipublikasikan
     */
    public function getPublicAnnouncements(Request $request): JsonResponse
    {
        $category = $request->query('category');
        $query = PmbAnnouncement::where('is_published', true);

        if ($category && $category !== 'all') {
            $query->where('category', $category);
        }

        $announcements = $query->orderBy('is_pinned', 'desc')
            ->orderBy('event_date', 'asc')
            ->orderBy('id', 'desc')
            ->get();

        return response()->json([
            'status' => 'success',
            'data' => $announcements,
        ]);
    }

    /**
     * [ADMIN] Dapatkan Daftar Berita & Agenda PMB
     */
    public function getAnnouncementsAdmin(Request $request): JsonResponse
    {
        $this->checkPmbAccess($request);
        $query = PmbAnnouncement::with('author:id,name');

        if ($request->filled('category') && $request->category !== 'all') {
            $query->where('category', $request->category);
        }

        if ($request->filled('search')) {
            $search = trim($request->search);
            $query->where(function ($q) use ($search) {
                $q->where('title', 'ILIKE', "%{$search}%")
                  ->orWhere('content', 'ILIKE', "%{$search}%");
            });
        }

        $announcements = $query->orderBy('is_pinned', 'desc')->orderBy('id', 'desc')->get();

        return response()->json([
            'status' => 'success',
            'data' => $announcements,
        ]);
    }

    /**
     * [ADMIN] Buat Berita / Agenda Santri Baru
     */
    public function storeAnnouncement(Request $request): JsonResponse
    {
        $this->checkPmbAccess($request);
        $validated = $request->validate([
            'title' => 'required|string|max:200',
            'content' => 'required|string',
            'category' => 'required|in:agenda_kedatangan,pengumuman,berita',
            'event_date' => 'nullable|date',
            'is_pinned' => 'boolean',
            'is_published' => 'boolean',
        ]);

        $validated['author_id'] = auth()->id();

        $announcement = PmbAnnouncement::create($validated);

        return response()->json([
            'status' => 'success',
            'message' => 'Berita / Agenda PMB berhasil dibuat.',
            'data' => $announcement,
        ], 201);
    }

    /**
     * [ADMIN] Update Berita / Agenda PMB
     */
    public function updateAnnouncement(Request $request, $id): JsonResponse
    {
        $this->checkPmbAccess($request);
        $announcement = PmbAnnouncement::findOrFail($id);

        $validated = $request->validate([
            'title' => 'required|string|max:200',
            'content' => 'required|string',
            'category' => 'required|in:agenda_kedatangan,pengumuman,berita',
            'event_date' => 'nullable|date',
            'is_pinned' => 'boolean',
            'is_published' => 'boolean',
        ]);

        $announcement->update($validated);

        return response()->json([
            'status' => 'success',
            'message' => 'Berita / Agenda PMB berhasil diperbarui.',
            'data' => $announcement,
        ]);
    }

    /**
     * [ADMIN] Hapus Berita / Agenda PMB
     */
    public function deleteAnnouncement($id): JsonResponse
    {
        $this->checkPmbAccess();
        $announcement = PmbAnnouncement::findOrFail($id);
        $announcement->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Berita / Agenda PMB berhasil dihapus.',
        ]);
    }
}
