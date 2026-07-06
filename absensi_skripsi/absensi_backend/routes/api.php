<?php

use App\Http\Controllers\Api\AbsensiController;
use App\Http\Controllers\Api\AcademicPeriodController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\JadwalController;
use App\Http\Controllers\Api\KelompokBelajarController;
use App\Http\Controllers\Api\MataPelajaranController;
use App\Http\Controllers\Api\NotificationController;
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

Route::get('health', fn () => response()->json([
    'success' => true,
    'message' => 'API presensi skripsi aktif',
    'scope' => 'presensi_madrasah_diniyah',
    'timestamp' => now()->toIso8601String(),
]));

Route::post('login', [AuthController::class, 'login']);
Route::post('change-password', [AuthController::class, 'changePassword']);

Route::middleware('api.auth')->group(function () {
    Route::post('logout', [AuthController::class, 'logout']);

    Route::get('dashboard', [DashboardController::class, 'index']);
    Route::get('academic-periods/active', [AcademicPeriodController::class, 'active']);
    Route::get('profile', [UserProfileController::class, 'show']);
    Route::put('profile', [UserProfileController::class, 'update']);
    Route::post('profile/foto', [UserProfileController::class, 'uploadFoto']);
    Route::delete('profile/foto', [UserProfileController::class, 'deleteFoto']);
    Route::get('notifications', [NotificationController::class, 'index']);
    Route::patch('notifications/{notification}/read', [NotificationController::class, 'markRead']);

    Route::middleware('role:wali')->group(function () {
        Route::get('wali/anak', [WaliController::class, 'anak']);
        Route::get('wali/biodata', [WaliController::class, 'biodata'])->middleware('permission:biodata_siswa,view');
        Route::get('wali/absensi', [WaliController::class, 'absensi'])->middleware('permission:absensi,view');
    });

    Route::middleware('role:admin,guru')->group(function () {
        Route::get('siswa', [SiswaController::class, 'index']);
        Route::get('siswa/{siswa}', [SiswaController::class, 'show']);
        Route::get('users', [UserManagementController::class, 'index']);

        Route::get('regions/provinces', [RegionController::class, 'provinces']);
        Route::get('regions/cities', [RegionController::class, 'cities']);
        Route::get('regions/districts', [RegionController::class, 'districts']);
        Route::get('regions/villages', [RegionController::class, 'villages']);
        Route::get('classes', [ReferenceController::class, 'classes']);
        Route::get('school-origins', [ReferenceController::class, 'schoolOrigins']);
        Route::get('references/{table}', [ReferenceController::class, 'master']);

        Route::get('mata-pelajaran', [MataPelajaranController::class, 'index']);
        Route::get('mata-pelajaran/{mataPelajaran}', [MataPelajaranController::class, 'show']);

        Route::get('jadwal', [JadwalController::class, 'index']);
        Route::get('jadwal/{jadwal}', [JadwalController::class, 'show']);

        Route::get('kelompok-belajar', [KelompokBelajarController::class, 'index']);
        Route::get('kelompok-belajar/by-kelas/{nama}', [KelompokBelajarController::class, 'byKelas']);
        Route::get('kelompok-belajar/{kelompokBelajar}', [KelompokBelajarController::class, 'show']);

        Route::get('absensi', [AbsensiController::class, 'index']);
        Route::post('absensi', [AbsensiController::class, 'store']);
        Route::post('absensi/bulk', [AbsensiController::class, 'storeBulk']);
        Route::get('absensi/rekap', [AbsensiController::class, 'rekap']);
        Route::put('absensi/{absensi}', [AbsensiController::class, 'update']);
        Route::delete('absensi/{absensi}', [AbsensiController::class, 'destroy']);

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
    });

    Route::middleware('role:admin')->group(function () {
        Route::get('settings/menus', [PermissionController::class, 'menus'])->middleware('permission:hak_akses,view');
        Route::get('settings/permissions', [PermissionController::class, 'index'])->middleware('permission:hak_akses,view');
        Route::put('settings/permissions', [PermissionController::class, 'update'])->middleware('permission:hak_akses,update');

        Route::get('whatsapp/status', [WhatsAppController::class, 'status'])->middleware('permission:whatsapp_bot,view');
        Route::post('whatsapp/connect', [WhatsAppController::class, 'connect'])->middleware('permission:whatsapp_bot,create');
        Route::get('whatsapp/qr', [WhatsAppController::class, 'qr'])->middleware('permission:whatsapp_bot,view');
        Route::post('whatsapp/reconnect', [WhatsAppController::class, 'reconnect'])->middleware('permission:whatsapp_bot,update');
        Route::post('whatsapp/logout', [WhatsAppController::class, 'logout'])->middleware('permission:whatsapp_bot,delete');
        Route::post('whatsapp/send', [WhatsAppController::class, 'send'])->middleware('permission:whatsapp_bot,create');
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

        Route::post('siswa/import', [SiswaController::class, 'import'])->middleware('permission:buku_induk,create');
        Route::post('siswa/bulk-status', [SiswaController::class, 'bulkStatus'])->middleware('permission:buku_induk,update');
        Route::post('siswa', [SiswaController::class, 'store'])->middleware('permission:buku_induk,create');
        Route::put('siswa/{siswa}', [SiswaController::class, 'update'])->middleware('permission:buku_induk,update');
        Route::delete('siswa/{siswa}', [SiswaController::class, 'destroy'])->middleware('permission:buku_induk,delete');

        Route::post('school-origins', [ReferenceController::class, 'storeSchoolOrigin']);
        Route::put('school-origins/{schoolOrigin}', [ReferenceController::class, 'updateSchoolOrigin']);
        Route::delete('school-origins/{schoolOrigin}', [ReferenceController::class, 'destroySchoolOrigin']);

        Route::post('classes', [ReferenceController::class, 'storeClass']);
        Route::put('classes/{class}', [ReferenceController::class, 'updateClass']);
        Route::delete('classes/{class}', [ReferenceController::class, 'destroyClass']);

        Route::post('mata-pelajaran', [MataPelajaranController::class, 'store']);
        Route::put('mata-pelajaran/{mataPelajaran}', [MataPelajaranController::class, 'update']);
        Route::delete('mata-pelajaran/{mataPelajaran}', [MataPelajaranController::class, 'destroy']);

        Route::post('jadwal/sync-group', [JadwalController::class, 'syncGroup']);
        Route::post('jadwal/delete-group', [JadwalController::class, 'destroyGroup']);
        Route::post('jadwal', [JadwalController::class, 'store']);
        Route::put('jadwal/{jadwal}', [JadwalController::class, 'update']);
        Route::delete('jadwal/{jadwal}', [JadwalController::class, 'destroy']);

        Route::post('kelompok-belajar', [KelompokBelajarController::class, 'store']);
        Route::post('kelompok-belajar/{kelompokBelajar}/siswa', [KelompokBelajarController::class, 'addSiswa']);
        Route::put('kelompok-belajar/{kelompokBelajar}', [KelompokBelajarController::class, 'update']);
        Route::delete('kelompok-belajar/{kelompokBelajar}', [KelompokBelajarController::class, 'destroy']);
        Route::delete('kelompok-belajar/{kelompokBelajar}/siswa/{siswaId}', [KelompokBelajarController::class, 'removeSiswa']);

        Route::post('users', [UserManagementController::class, 'store']);
        Route::post('users/import', [UserManagementController::class, 'import']);
        Route::post('users/import-guru', [UserManagementController::class, 'importGuru']);
        Route::post('users/{user}/reset-password', [UserManagementController::class, 'resetPassword']);
        Route::put('users/{user}', [UserManagementController::class, 'update']);
        Route::delete('users/{user}', [UserManagementController::class, 'destroy']);

        Route::post('upload', [SiswaController::class, 'uploadFile']);
    });
});
