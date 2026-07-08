<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ThesisMasterController;
use App\Http\Controllers\Api\ThesisNotificationController;
use App\Http\Controllers\Api\ThesisPresensiController;
use Illuminate\Support\Facades\Route;

Route::get('health', fn () => response()->json([
    'success' => true,
    'message' => 'API presensi skripsi aktif',
    'scope' => 'presensi_madrasah_diniyah',
]));

Route::prefix('auth')->group(function (): void {
    Route::post('login', [AuthController::class, 'login']);
});
// Alias sementara agar APK lama tetap dapat login selama proses pembaruan.
Route::post('login', [AuthController::class, 'login']);

Route::middleware('api.auth')->group(function (): void {
    Route::post('auth/logout', [AuthController::class, 'logout']);
    Route::post('auth/refresh-token', [AuthController::class, 'refresh']);
    Route::post('logout', [AuthController::class, 'logout']);
    Route::post('refresh-token', [AuthController::class, 'refresh']);
    Route::get('sync/bootstrap', [ThesisMasterController::class, 'bootstrap']);
    Route::post('sync/batch', [ThesisPresensiController::class, 'syncBatch']);

    Route::middleware('role:admin,guru')->group(function (): void {
        Route::get('kelas', [ThesisMasterController::class, 'kelasIndex']);
        Route::get('mata-pelajaran', [ThesisMasterController::class, 'mapelIndex']);
        Route::get('santri', [ThesisMasterController::class, 'santriIndex']);

        Route::get('presensi', [ThesisPresensiController::class, 'index']);
        Route::get('presensi/riwayat', [ThesisPresensiController::class, 'index']);
        Route::get('presensi/rekap/export', [ThesisPresensiController::class, 'export']);
        Route::get('presensi/rekap', [ThesisPresensiController::class, 'rekap']);
        Route::post('presensi', [ThesisPresensiController::class, 'store']);
        Route::put('presensi/{presensi}', [ThesisPresensiController::class, 'store']);
        Route::delete('presensi/{presensi}', [ThesisPresensiController::class, 'destroy']);
    });

    Route::middleware('role:admin')->group(function (): void {
        Route::get('guru', [ThesisMasterController::class, 'guruIndex']);
        Route::post('guru', [ThesisMasterController::class, 'guruStore']);
        Route::put('guru/{guru}', [ThesisMasterController::class, 'guruUpdate']);
        Route::delete('guru/{guru}', [ThesisMasterController::class, 'guruDestroy']);

        Route::post('kelas', [ThesisMasterController::class, 'kelasStore']);
        Route::put('kelas/{kelas}', [ThesisMasterController::class, 'kelasUpdate']);
        Route::delete('kelas/{kelas}', [ThesisMasterController::class, 'kelasDestroy']);

        Route::post('mata-pelajaran', [ThesisMasterController::class, 'mapelStore']);
        Route::put('mata-pelajaran/{mataPelajaran}', [ThesisMasterController::class, 'mapelUpdate']);
        Route::delete('mata-pelajaran/{mataPelajaran}', [ThesisMasterController::class, 'mapelDestroy']);

        Route::post('santri', [ThesisMasterController::class, 'santriStore']);
        Route::put('santri/{santri}', [ThesisMasterController::class, 'santriUpdate']);
        Route::delete('santri/{santri}', [ThesisMasterController::class, 'santriDestroy']);

        Route::get('notifikasi', [ThesisNotificationController::class, 'index']);
        Route::post('notifikasi/whatsapp', [ThesisNotificationController::class, 'whatsapp']);
        Route::post('notifikasi/{notification}/retry', [ThesisNotificationController::class, 'retry']);
    });
});
