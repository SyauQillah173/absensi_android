<?php

use App\Http\Controllers\Api\AbsensiController;
use App\Http\Controllers\Api\AbsensiNgajiController;
use App\Http\Controllers\Api\AbsensiSholatController;
use App\Http\Controllers\Api\AcademicPeriodController;
use App\Http\Controllers\Api\AdminPaymentSecuritySettingController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BoardingController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\DocumentSettingController;
use App\Http\Controllers\Api\HafalanController;
use App\Http\Controllers\Api\JadwalController;
use App\Http\Controllers\Api\KegiatanController;
use App\Http\Controllers\Api\KelompokBelajarController;
use App\Http\Controllers\Api\MataPelajaranController;
use App\Http\Controllers\Api\MateriController;
use App\Http\Controllers\Api\NilaiController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\MasterReferensiController;
use App\Http\Controllers\Api\PaymentBillController;
use App\Http\Controllers\Api\PaymentMethodController;
use App\Http\Controllers\Api\PaymentPeriodTypeController;
use App\Http\Controllers\Api\PaymentTypeController;
use App\Http\Controllers\Api\PembayaranController;
use App\Http\Controllers\Api\PemasukanLainController;
use App\Http\Controllers\Api\PengeluaranController;
use App\Http\Controllers\Api\PenilaianController;
use App\Http\Controllers\Api\PermissionController;
use App\Http\Controllers\Api\ReferenceController;
use App\Http\Controllers\Api\RegionController;
use App\Http\Controllers\Api\SiswaController;
use App\Http\Controllers\Api\UserManagementController;
use App\Http\Controllers\Api\UserProfileController;
use App\Http\Controllers\Api\WaliController;
use App\Http\Controllers\Api\WhatsAppController;
use App\Models\User;
use Illuminate\Support\Facades\Route;

// Public auth endpoints.
Route::get('health', fn() => response()->json([
    'success' => true,
    'message' => 'API aktif',
    'timestamp' => now()->toIso8601String(),
]));

// Route::get('/health-check', function () {
//     $dbStatus = 'Connected';
//     $dbError = null;

//     try {
//         // Cek koneksi database
//         DB::connection()->getPdo();
//     } catch (\Exception $e) {
//         $dbStatus = 'Disconnected';
//         $dbError = $e->getMessage();
//     }

//     return response()->json([
//         'status' => 'success',
//         'php_version' => PHP_VERSION,
//         'database' => [
//             'status' => $dbStatus,
//             'connection_name' => DB::getDefaultConnection(),
//             'error' => $dbError,
//         ],
//         'timestamp' => now(),
//     ]);
// });

Route::get('captcha', fn() => app('captcha')->create('default', true));
Route::middleware('throttle:60,1')->group(function () {
    Route::post('login', [AuthController::class, 'login']);
    Route::post('change-password', [AuthController::class, 'changePassword']);
});

Route::middleware(['api.auth', 'throttle:60,1'])->group(function () {
    Route::post('logout', [AuthController::class, 'logout']);

    // Shared authenticated endpoints.
    Route::get('dashboard', [DashboardController::class, 'index']);
    Route::get('academic-periods/active', [AcademicPeriodController::class, 'active']);
    Route::get('profile', [UserProfileController::class, 'show']);
    Route::put('profile', [UserProfileController::class, 'update']);
    Route::post('profile/foto', [UserProfileController::class, 'uploadFoto'])->middleware('throttle:15,1');
    Route::delete('profile/foto', [UserProfileController::class, 'deleteFoto']);
    Route::get('notifications', [NotificationController::class, 'index']);
    Route::post('notifications/mark-all-read', [NotificationController::class, 'markAllRead']);
    Route::patch('notifications/{notification}/read', [NotificationController::class, 'markRead']);
    Route::delete('notifications/{notification}', [NotificationController::class, 'destroy']);

    Route::middleware('role:admin,wali')->group(function () {
        Route::get('pembayaran/rekap-siswa', [PembayaranController::class, 'studentRekap'])
            ->middleware('permission:pembayaran_wali,view');
    });

    Route::get('pembayaran/chart', [PembayaranController::class, 'chart'])->middleware('role:admin');

    // Wali can only monitor data connected to their own token account.
    Route::middleware('role:wali')->group(function () {
        Route::get('wali/anak', [WaliController::class, 'anak']);
        Route::get('wali/biodata', [WaliController::class, 'biodata'])->middleware('permission:biodata_siswa,view');
        Route::get('wali/absensi', [WaliController::class, 'absensi'])->middleware('permission:absensi,view');
        Route::get('wali/absensi-sholat', [WaliController::class, 'absensiSholat'])->middleware('permission:absensi,view');
        Route::get('wali/absensi-ngaji', [WaliController::class, 'absensiNgaji'])->middleware('permission:absensi,view');
        Route::get('wali/pembayaran', [WaliController::class, 'pembayaran'])->middleware('permission:pembayaran_wali,view');
        Route::get('wali/nilai', [WaliController::class, 'nilai'])->middleware('permission:nilai_wali,view');
        Route::get('wali/materi', [MateriController::class, 'materiAnak'])->middleware('permission:kegiatan_belajar,view');
        Route::get('wali/kegiatan', [KegiatanController::class, 'kegiatanWali'])->middleware('permission:kegiatan_belajar,view');
    });

    // Read access needed by admin and guru operational screens.
    Route::middleware('role:admin,guru')->group(function () {
        Route::get('siswa', [SiswaController::class, 'index']);
        Route::get('siswa/{siswa}', [SiswaController::class, 'show']);

        Route::get('regions/provinces', [RegionController::class, 'provinces']);
        Route::get('regions/cities', [RegionController::class, 'cities']);
        Route::get('regions/districts', [RegionController::class, 'districts']);
        Route::get('regions/villages', [RegionController::class, 'villages']);
        Route::get('classes', [ReferenceController::class, 'classes']);
        Route::post('classes', [ReferenceController::class, 'storeClass']);
        Route::put('classes/{schoolClass}', [ReferenceController::class, 'updateClass']);
        Route::delete('classes/{schoolClass}', [ReferenceController::class, 'destroyClass']);
        Route::get('school-origins', [ReferenceController::class, 'schoolOrigins']);
        Route::get('references/{table}', [ReferenceController::class, 'master']);

        Route::get('master-referensi', [MasterReferensiController::class, 'index']);
        Route::post('master-referensi', [MasterReferensiController::class, 'store']);
        Route::put('master-referensi/{referensi}', [MasterReferensiController::class, 'update']);
        Route::delete('master-referensi/{referensi}', [MasterReferensiController::class, 'destroy']);

        Route::get('mata-pelajaran', [MataPelajaranController::class, 'index'])->middleware('permission:mata_pelajaran,view');
        Route::get('mata-pelajaran/{mataPelajaran}', [MataPelajaranController::class, 'show'])->middleware('permission:mata_pelajaran,view');

        Route::get('jadwal', [JadwalController::class, 'index']);
        Route::get('jadwal/{jadwal}', [JadwalController::class, 'show']);

        Route::get('absensi', [AbsensiController::class, 'index'])->middleware('permission:absensi,view');
        Route::post('absensi', [AbsensiController::class, 'store'])->middleware('permission:absensi,create');
        Route::post('absensi/bulk', [AbsensiController::class, 'storeBulk'])->middleware(['permission:absensi,create', 'throttle:30,1']);
        Route::get('absensi/rekap', [AbsensiController::class, 'rekap'])->middleware('permission:absensi,view');
        Route::put('absensi/{absensi}', [AbsensiController::class, 'update'])->middleware('permission:absensi,update');
        Route::delete('absensi/{absensi}', [AbsensiController::class, 'destroy'])->middleware('permission:absensi,cancel');

        Route::get('boarding/complexes', [BoardingController::class, 'complexes'])->middleware('permission:absensi,view');
        Route::get('boarding/students', [BoardingController::class, 'students'])->middleware('permission:absensi,view');
        Route::get('absensi-sholat', [AbsensiSholatController::class, 'index'])->middleware('permission:absensi,view');
        Route::get('absensi-sholat/types', [AbsensiSholatController::class, 'types'])->middleware('permission:absensi,view');
        Route::get('absensi-sholat/context', [AbsensiSholatController::class, 'context'])->middleware('permission:absensi,view');
        Route::get('absensi-sholat/rekap', [AbsensiSholatController::class, 'rekap'])->middleware('permission:absensi,view');
        Route::post('absensi-sholat/bulk', [AbsensiSholatController::class, 'storeBulk'])->middleware(['permission:absensi,create', 'throttle:30,1']);
        Route::post('absensi-sholat/cancel', [AbsensiSholatController::class, 'cancel'])->middleware('permission:absensi,cancel');

        Route::get('absensi-ngaji/sessions', [AbsensiNgajiController::class, 'sessions'])->middleware('permission:absensi,view');
        Route::get('absensi-ngaji/books', [AbsensiNgajiController::class, 'books'])->middleware('permission:absensi,view');
        Route::get('absensi-ngaji/schedules', [AbsensiNgajiController::class, 'schedules'])->middleware('permission:absensi,view');
        Route::get('absensi-ngaji/context', [AbsensiNgajiController::class, 'context'])->middleware('permission:absensi,view');
        Route::get('absensi-ngaji/rekap', [AbsensiNgajiController::class, 'rekap'])->middleware('permission:absensi,view');
        Route::post('absensi-ngaji/bulk', [AbsensiNgajiController::class, 'storeBulk'])->middleware(['permission:absensi,create', 'throttle:30,1']);
        Route::post('absensi-ngaji/cancel', [AbsensiNgajiController::class, 'cancel'])->middleware('permission:absensi,cancel');

        Route::get('kelompok-belajar', [KelompokBelajarController::class, 'index'])->middleware('permission:ruang_sifir,view');
        Route::get('kelompok-belajar/by-kelas/{nama}', [KelompokBelajarController::class, 'byKelas'])->middleware('permission:ruang_sifir,view');
        Route::get('kelompok-belajar/{kelompokBelajar}', [KelompokBelajarController::class, 'show'])->middleware('permission:ruang_sifir,view');

        Route::get('nilai', [NilaiController::class, 'index'])->middleware('permission:nilai,view');
        Route::post('nilai', [NilaiController::class, 'store'])->middleware('permission:nilai,create');
        Route::post('nilai/bulk', [NilaiController::class, 'storeBulk'])->middleware(['permission:nilai,create', 'throttle:30,1']);
        Route::get('nilai/rekap', [NilaiController::class, 'rekap'])->middleware('permission:nilai,view');
        Route::get('nilai/{nilai}', [NilaiController::class, 'show'])->middleware('permission:nilai,view');
        Route::put('nilai/{nilai}', [NilaiController::class, 'update'])->middleware('permission:nilai,update');

        Route::get('hafalan', [HafalanController::class, 'index'])->middleware('permission:nilai,view');
        Route::post('hafalan', [HafalanController::class, 'store'])->middleware('permission:nilai,create');
        Route::get('hafalan/{hafalan}', [HafalanController::class, 'show'])->middleware('permission:nilai,view');
        Route::put('hafalan/{hafalan}', [HafalanController::class, 'update'])->middleware('permission:nilai,update');
        Route::patch('hafalan/{hafalan}', [HafalanController::class, 'update'])->middleware('permission:nilai,update');

        Route::get('penilaian/dokumen', [PenilaianController::class, 'documentData']);
        Route::get('penilaian/rekap-export', [PenilaianController::class, 'rekapExport']);

        Route::get('guru', function () {
            return response()->json([
                'success' => true,
                'data' => User::where('role', 'guru')
                    ->where('status', 'Aktif')
                    ->select('id', 'name', 'email', 'nis', 'status')
                    ->orderBy('name')
                    ->get(),
            ]);
        });

        Route::get('materi', [MateriController::class, 'index'])->middleware('permission:materi_kegiatan,view');
        Route::post('materi', [MateriController::class, 'store'])->middleware('permission:materi_kegiatan,create');
        Route::delete('materi/{id}', [MateriController::class, 'destroy'])->middleware('permission:materi_kegiatan,delete');

        Route::get('kegiatan', [KegiatanController::class, 'index'])->middleware('permission:materi_kegiatan,view');
        Route::post('kegiatan', [KegiatanController::class, 'store'])->middleware('permission:materi_kegiatan,create');
        Route::delete('kegiatan/{id}', [KegiatanController::class, 'destroy'])->middleware('permission:materi_kegiatan,delete');
    });

    // Admin-only data management and finance endpoints.
    Route::middleware('role:admin')->group(function () {
        Route::get('settings/menus', [PermissionController::class, 'menus'])->middleware('permission:hak_akses,view');
        Route::get('settings/permissions', [PermissionController::class, 'index'])->middleware('permission:hak_akses,view');
        Route::put('settings/permissions', [PermissionController::class, 'update'])->middleware('permission:hak_akses,update');

        Route::get('whatsapp/status', [WhatsAppController::class, 'status'])->middleware('permission:whatsapp_bot,view');
        Route::post('whatsapp/connect', [WhatsAppController::class, 'connect'])->middleware(['permission:whatsapp_bot,create', 'throttle:20,1']);
        Route::get('whatsapp/qr', [WhatsAppController::class, 'qr'])->middleware('permission:whatsapp_bot,view');
        Route::post('whatsapp/reconnect', [WhatsAppController::class, 'reconnect'])->middleware(['permission:whatsapp_bot,update', 'throttle:20,1']);
        Route::post('whatsapp/logout', [WhatsAppController::class, 'logout'])->middleware('permission:whatsapp_bot,delete');
        Route::post('whatsapp/send', [WhatsAppController::class, 'send'])->middleware(['permission:whatsapp_bot,create', 'throttle:20,1']);
        Route::get('whatsapp/messages', [WhatsAppController::class, 'messages'])->middleware('permission:whatsapp_bot,view');
        Route::post('whatsapp/messages/{message}/retry', [WhatsAppController::class, 'retry'])->middleware('permission:whatsapp_bot,approve');
        Route::get('whatsapp/templates', [WhatsAppController::class, 'templates'])->middleware('permission:whatsapp_bot,view');
        Route::post('whatsapp/templates', [WhatsAppController::class, 'storeTemplate'])->middleware('permission:whatsapp_bot,create');
        Route::put('whatsapp/templates/{template}', [WhatsAppController::class, 'updateTemplate'])->middleware('permission:whatsapp_bot,update');
        Route::delete('whatsapp/templates/{template}', [WhatsAppController::class, 'deleteTemplate'])->middleware('permission:whatsapp_bot,delete');
        Route::get('notification-settings', [WhatsAppController::class, 'settings'])->middleware('permission:whatsapp_bot,view');
        Route::put('notification-settings', [WhatsAppController::class, 'updateSettings'])->middleware('permission:whatsapp_bot,update');

        Route::get('academic-periods', [AcademicPeriodController::class, 'index'])->middleware('permission:buku_induk,view');
        Route::post('academic-periods', [AcademicPeriodController::class, 'store'])->middleware('permission:buku_induk,create');
        Route::put('academic-periods/{academicYear}', [AcademicPeriodController::class, 'update'])->middleware('permission:buku_induk,update');
        Route::post('academic-periods/{academicYear}/activate', [AcademicPeriodController::class, 'activate'])->middleware('permission:buku_induk,update');
        Route::post('academic-periods/{academicYear}/semester', [AcademicPeriodController::class, 'semester'])->middleware('permission:buku_induk,update');
        Route::post('academic-periods/{academicYear}/sync-siswa', [AcademicPeriodController::class, 'syncSiswa'])->middleware('permission:buku_induk,update');
        Route::post('academic-periods/{academicYear}/auto-promote', [AcademicPeriodController::class, 'autoPromote'])->middleware('permission:buku_induk,update');
        Route::delete('academic-periods/{academicYear}', [AcademicPeriodController::class, 'destroy'])->middleware('permission:buku_induk,delete');

        Route::post('siswa/import', [SiswaController::class, 'import'])->middleware('permission:buku_induk,create');
        Route::post('siswa/bulk-status', [SiswaController::class, 'bulkStatus'])->middleware('permission:buku_induk,update');
        Route::post('siswa/{siswa}/restore-alumni', [SiswaController::class, 'restoreAlumni'])->middleware('permission:buku_induk,update');
        Route::post('siswa', [SiswaController::class, 'store'])->middleware('permission:buku_induk,create');
        Route::put('siswa/{siswa}', [SiswaController::class, 'update'])->middleware('permission:buku_induk,update');
        Route::delete('siswa/{siswa}', [SiswaController::class, 'destroy'])->middleware('permission:buku_induk,delete');

        Route::post('boarding/complexes', [BoardingController::class, 'storeComplex'])->middleware('permission:absensi,create');
        Route::put('boarding/complexes/{complex}', [BoardingController::class, 'updateComplex'])->middleware('permission:absensi,update');
        Route::delete('boarding/complexes/{complex}', [BoardingController::class, 'destroyComplex'])->middleware('permission:absensi,delete');
        Route::post('boarding/rooms', [BoardingController::class, 'storeRoom'])->middleware('permission:absensi,create');
        Route::put('boarding/rooms/{room}', [BoardingController::class, 'updateRoom'])->middleware('permission:absensi,update');
        Route::delete('boarding/rooms/{room}', [BoardingController::class, 'destroyRoom'])->middleware('permission:absensi,delete');
        Route::post('boarding/assign-students', [BoardingController::class, 'assignStudents'])->middleware('permission:absensi,update');
        Route::post('boarding/santri', [BoardingController::class, 'storeSantri'])->middleware('permission:absensi,update');
        Route::put('boarding/santri/{santri}', [BoardingController::class, 'updateSantri'])->middleware('permission:absensi,update');
        Route::delete('boarding/santri/{santri}', [BoardingController::class, 'destroySantri'])->middleware('permission:absensi,delete');
        Route::get('boarding/santri/export', [BoardingController::class, 'exportSantri'])->middleware('permission:absensi,view');
        Route::post('boarding/santri/import', [BoardingController::class, 'importSantri'])->middleware('permission:absensi,update');
        Route::post('absensi-sholat/types', [AbsensiSholatController::class, 'storeType'])->middleware('permission:absensi,create');
        Route::put('absensi-sholat/types/{type}', [AbsensiSholatController::class, 'updateType'])->middleware('permission:absensi,update');
        Route::delete('absensi-sholat/types/{type}', [AbsensiSholatController::class, 'destroyType'])->middleware('permission:absensi,delete');
        Route::post('absensi-ngaji/sessions', [AbsensiNgajiController::class, 'storeSession'])->middleware('permission:absensi,create');
        Route::put('absensi-ngaji/sessions/{session}', [AbsensiNgajiController::class, 'updateSession'])->middleware('permission:absensi,update');
        Route::delete('absensi-ngaji/sessions/{session}', [AbsensiNgajiController::class, 'destroySession'])->middleware('permission:absensi,delete');
        Route::post('absensi-ngaji/books', [AbsensiNgajiController::class, 'storeBook'])->middleware('permission:absensi,create');
        Route::put('absensi-ngaji/books/{book}', [AbsensiNgajiController::class, 'updateBook'])->middleware('permission:absensi,update');
        Route::delete('absensi-ngaji/books/{book}', [AbsensiNgajiController::class, 'destroyBook'])->middleware('permission:absensi,delete');
        Route::post('absensi-ngaji/schedules', [AbsensiNgajiController::class, 'storeSchedule'])->middleware('permission:absensi,create');
        Route::put('absensi-ngaji/schedules/{schedule}', [AbsensiNgajiController::class, 'updateSchedule'])->middleware('permission:absensi,update');
        Route::delete('absensi-ngaji/schedules/{schedule}', [AbsensiNgajiController::class, 'destroySchedule'])->middleware('permission:absensi,delete');
        Route::get('boarding/guru-access', [BoardingController::class, 'guruAccess'])->middleware('permission:hak_akses,view');
        Route::post('boarding/guru-access', [BoardingController::class, 'saveGuruAccess'])->middleware('permission:hak_akses,update');
        Route::delete('boarding/guru-access/{access}', [BoardingController::class, 'deleteGuruAccess'])->middleware('permission:hak_akses,delete');

        Route::post('school-origins', [ReferenceController::class, 'storeSchoolOrigin']);
        Route::put('school-origins/{schoolOrigin}', [ReferenceController::class, 'updateSchoolOrigin']);
        Route::delete('school-origins/{schoolOrigin}', [ReferenceController::class, 'destroySchoolOrigin']);

        Route::post('mata-pelajaran', [MataPelajaranController::class, 'store']);
        Route::put('mata-pelajaran/{mataPelajaran}', [MataPelajaranController::class, 'update']);
        Route::delete('mata-pelajaran/{mataPelajaran}', [MataPelajaranController::class, 'destroy']);

        Route::post('jadwal/sync-group', [JadwalController::class, 'syncGroup']);
        Route::post('jadwal/delete-group', [JadwalController::class, 'destroyGroup']);
        Route::post('jadwal', [JadwalController::class, 'store']);
        Route::put('jadwal/{jadwal}', [JadwalController::class, 'update']);
        Route::delete('jadwal/{jadwal}', [JadwalController::class, 'destroy']);

        Route::get('pembayaran/rekap-export', [PembayaranController::class, 'rekapExport'])->middleware('permission:keuangan,view');
        Route::get('payment-bills', [PaymentBillController::class, 'index'])->middleware('permission:keuangan,view');
        Route::get('payment-bills/student-summary', [PaymentBillController::class, 'studentSummary'])->middleware('permission:keuangan,view');
        Route::get('payment-bills/monthly-options', [PaymentBillController::class, 'monthlyOptions'])->middleware('permission:keuangan,view');
        Route::get('payment-bill-rules', [PaymentBillController::class, 'rules'])->middleware('permission:keuangan,view');
        Route::post('payment-bills/generate', [PaymentBillController::class, 'generate'])->middleware('permission:keuangan,create');
        Route::post('payment-bills/student/{siswaId}/notify', [PaymentBillController::class, 'notifyStudent'])->middleware('permission:keuangan,approve');
        Route::post('payment-bills/{paymentBill}/notify', [PaymentBillController::class, 'notify'])->middleware('permission:keuangan,approve');
        Route::get('pembayaran/transaksi/{paymentTransaction}', [PembayaranController::class, 'showTransaction'])->middleware('permission:keuangan,view');
        Route::delete('pembayaran/transaksi/{paymentTransaction}', [PembayaranController::class, 'destroyTransaction'])->middleware('permission:keuangan,delete');
        Route::post('pembayaran/transaksi/{paymentTransaction}/notify-wa', [PembayaranController::class, 'notifyWa'])->middleware('permission:keuangan,create');
        Route::apiResource('pembayaran', PembayaranController::class)->middleware('permission:keuangan,view');

        Route::get('payment-security-settings', [AdminPaymentSecuritySettingController::class, 'show']);
        Route::put('payment-security-settings', [AdminPaymentSecuritySettingController::class, 'update']);

        Route::post('kelompok-belajar', [KelompokBelajarController::class, 'store']);
        Route::post('kelompok-belajar/{kelompokBelajar}/siswa', [KelompokBelajarController::class, 'addSiswa']);
        Route::put('kelompok-belajar/{kelompokBelajar}', [KelompokBelajarController::class, 'update']);
        Route::delete('kelompok-belajar/{kelompokBelajar}', [KelompokBelajarController::class, 'destroy']);
        Route::delete('kelompok-belajar/{kelompokBelajar}/siswa/{siswaId}', [KelompokBelajarController::class, 'removeSiswa']);

        Route::delete('nilai/{nilai}', [NilaiController::class, 'destroy'])->middleware('permission:nilai,delete');
        Route::delete('hafalan/{hafalan}', [HafalanController::class, 'destroy'])->middleware('permission:nilai,delete');

        Route::get('document-settings', [DocumentSettingController::class, 'show']);
        Route::put('document-settings', [DocumentSettingController::class, 'update']);
        Route::post('document-settings/signature', [DocumentSettingController::class, 'uploadSignature'])->middleware('throttle:15,1');
        Route::post('document-settings/logo', [DocumentSettingController::class, 'uploadLogo'])->middleware('throttle:15,1');

        Route::get('users', [UserManagementController::class, 'index']);
        Route::post('users', [UserManagementController::class, 'store']);
        Route::post('users/import', [UserManagementController::class, 'import'])->middleware('throttle:15,1');
        Route::post('users/import-guru', [UserManagementController::class, 'importGuru'])->middleware('throttle:15,1');
        Route::post('users/{user}/reset-password', [UserManagementController::class, 'resetPassword']);
        Route::put('users/{user}', [UserManagementController::class, 'update']);
        Route::delete('users/{user}', [UserManagementController::class, 'destroy']);

        Route::get('payment-types', [PaymentTypeController::class, 'index'])->middleware('permission:keuangan,view');
        Route::post('payment-types', [PaymentTypeController::class, 'store'])->middleware('permission:keuangan,create');
        Route::put('payment-types/{paymentType}', [PaymentTypeController::class, 'update'])->middleware('permission:keuangan,update');
        Route::delete('pembayaran/types/{type}', [PembayaranController::class, 'destroyType'])->middleware('permission:keuangan,delete');

        // PEMASUKAN LAIN / SUMBER DANA KAS
        Route::get('pemasukan-lain/export', [PemasukanLainController::class, 'export'])->middleware('permission:keuangan,view');
        Route::get('pemasukan-lain', [PemasukanLainController::class, 'index'])->middleware('permission:keuangan,view');
        Route::get('pemasukan-lain/{id}', [PemasukanLainController::class, 'show'])->middleware('permission:keuangan,view');
        Route::post('pemasukan-lain', [PemasukanLainController::class, 'store'])->middleware('permission:keuangan,create');
        Route::put('pemasukan-lain/{id}', [PemasukanLainController::class, 'update'])->middleware('permission:keuangan,update');
        Route::delete('pemasukan-lain/{id}', [PemasukanLainController::class, 'destroy'])->middleware('permission:keuangan,delete');

        // PENGELUARAN
        Route::get('pengeluaran/export', [PengeluaranController::class, 'export'])->middleware('permission:keuangan,view');
        Route::get('pengeluaran', [PengeluaranController::class, 'index'])->middleware('permission:keuangan,view');
        Route::get('pengeluaran/{id}', [PengeluaranController::class, 'show'])->middleware('permission:keuangan,view');
        Route::post('pengeluaran', [PengeluaranController::class, 'store'])->middleware('permission:keuangan,create');
        Route::put('pengeluaran/{id}', [PengeluaranController::class, 'update'])->middleware('permission:keuangan,update');
        Route::delete('pengeluaran/{id}', [PengeluaranController::class, 'destroy'])->middleware('permission:keuangan,delete');

        Route::post('academic-years', [ReferenceController::class, 'storeAcademicYear']);
        Route::get('payment-methods', [PaymentMethodController::class, 'index'])->middleware('permission:keuangan,view');
        Route::post('payment-methods', [PaymentMethodController::class, 'store'])->middleware('permission:keuangan,create');
        Route::put('payment-methods/{paymentMethod}', [PaymentMethodController::class, 'update'])->middleware('permission:keuangan,update');
        Route::delete('payment-methods/{paymentMethod}', [PaymentMethodController::class, 'destroy'])->middleware('permission:keuangan,delete');
        Route::get('payment-period-types', [PaymentPeriodTypeController::class, 'index'])->middleware('permission:keuangan,view');
        Route::post('payment-period-types', [PaymentPeriodTypeController::class, 'store'])->middleware('permission:keuangan,create');
        Route::put('payment-period-types/{paymentPeriodType}', [PaymentPeriodTypeController::class, 'update'])->middleware('permission:keuangan,update');
        Route::delete('payment-period-types/{paymentPeriodType}', [PaymentPeriodTypeController::class, 'destroy'])->middleware('permission:keuangan,delete');

        Route::post('upload', [SiswaController::class, 'uploadFile'])->middleware('throttle:15,1');
    });
});
