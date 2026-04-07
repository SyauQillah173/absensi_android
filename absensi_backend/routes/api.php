<?php

use App\Http\Controllers\Api\SiswaController;
use App\Http\Controllers\Api\MataPelajaranController;
use App\Http\Controllers\Api\JadwalController;
use App\Http\Controllers\Api\AbsensiController;
use App\Http\Controllers\Api\PembayaranController;
use App\Http\Controllers\Api\KelompokBelajarController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\WaliController;
use App\Http\Controllers\Api\UserProfileController;
use App\Http\Controllers\Api\UserManagementController;
use App\Http\Controllers\Api\PaymentTypeController;
use App\Http\Controllers\Api\MateriController;
use App\Http\Controllers\Api\KegiatanController;
use App\Http\Controllers\Api\NilaiController;
use App\Http\Controllers\Api\HafalanController;
use Illuminate\Support\Facades\Route;

// ===== AUTH =====
Route::post('login', [AuthController::class, 'login']);

/*
|--------------------------------------------------------------------------
| API Routes — Absensi Madrasah Diniah
|--------------------------------------------------------------------------
|
| Semua endpoint di bawah ini otomatis punya prefix /api/
| Contoh: GET /api/siswa → SiswaController@index
|
*/

// ===== SISWA =====
Route::apiResource('siswa', SiswaController::class);

// ===== MATA PELAJARAN =====
Route::apiResource('mata-pelajaran', MataPelajaranController::class);

// ===== JADWAL =====
Route::apiResource('jadwal', JadwalController::class);

// ===== ABSENSI =====
Route::get('absensi', [AbsensiController::class, 'index']);
Route::post('absensi', [AbsensiController::class, 'store']);
Route::post('absensi/bulk', [AbsensiController::class, 'storeBulk']);
Route::get('absensi/rekap', [AbsensiController::class, 'rekap']);
Route::put('absensi/{absensi}', [AbsensiController::class, 'update']);
Route::delete('absensi/{absensi}', [AbsensiController::class, 'destroy']);

// ===== PEMBAYARAN =====
Route::apiResource('pembayaran', PembayaranController::class);

// ===== KELOMPOK BELAJAR =====
Route::get('kelompok-belajar', [KelompokBelajarController::class, 'index']);
Route::get('kelompok-belajar/by-kelas/{nama}', [KelompokBelajarController::class, 'byKelas']);
Route::get('kelompok-belajar/{kelompokBelajar}', [KelompokBelajarController::class, 'show']);
Route::post('kelompok-belajar', [KelompokBelajarController::class, 'store']);
Route::post('kelompok-belajar/{kelompokBelajar}/siswa', [KelompokBelajarController::class, 'addSiswa']);
Route::put('kelompok-belajar/{kelompokBelajar}', [KelompokBelajarController::class, 'update']);
Route::delete('kelompok-belajar/{kelompokBelajar}', [KelompokBelajarController::class, 'destroy']);
Route::delete('kelompok-belajar/{kelompokBelajar}/siswa/{siswaId}', [KelompokBelajarController::class, 'removeSiswa']);

// ===== NILAI =====
Route::get('nilai', [NilaiController::class, 'index']);
Route::post('nilai', [NilaiController::class, 'store']);
Route::post('nilai/bulk', [NilaiController::class, 'storeBulk']);
Route::get('nilai/rekap', [NilaiController::class, 'rekap']);
Route::get('nilai/{nilai}', [NilaiController::class, 'show']);
Route::put('nilai/{nilai}', [NilaiController::class, 'update']);
Route::delete('nilai/{nilai}', [NilaiController::class, 'destroy']);

// ===== HAFALAN =====
Route::apiResource('hafalan', HafalanController::class);

// ===== GURU LIST (for dropdowns) =====
Route::get('guru', function () {
    return response()->json([
        'success' => true,
        'data' => \App\Models\User::where('role', 'guru')->select('id', 'name', 'email', 'nis')->orderBy('name')->get(),
    ]);
});

// ===== ALL USERS (for Data Admin + Data Guru realtime) =====
Route::get('users', [UserManagementController::class, 'index']);
Route::post('users', [UserManagementController::class, 'store']);
Route::post('users/import', [UserManagementController::class, 'import']);
Route::post('users/import-guru', [UserManagementController::class, 'importGuru']);
Route::put('users/{user}', [UserManagementController::class, 'update']);
Route::delete('users/{user}', [UserManagementController::class, 'destroy']);

// ===== PAYMENT TYPES =====
Route::get('payment-types', [PaymentTypeController::class, 'index']);
Route::post('payment-types', [PaymentTypeController::class, 'store']);
Route::put('payment-types/{paymentType}', [PaymentTypeController::class, 'update']);
Route::delete('payment-types/{paymentType}', [PaymentTypeController::class, 'destroy']);

// ===== MATERI PELAJARAN =====
Route::get('materi', [MateriController::class, 'index']);
Route::post('materi', [MateriController::class, 'store']);
Route::delete('materi/{id}', [MateriController::class, 'destroy']);

// ===== KEGIATAN =====
Route::get('kegiatan', [KegiatanController::class, 'index']);
Route::post('kegiatan', [KegiatanController::class, 'store']);
Route::delete('kegiatan/{id}', [KegiatanController::class, 'destroy']);

// ===== WALI (ORANG TUA) — Read-only monitoring =====
Route::get('wali/anak', [WaliController::class, 'anak']);
Route::get('wali/absensi', [WaliController::class, 'absensi']);
Route::get('wali/pembayaran', [WaliController::class, 'pembayaran']);
Route::get('wali/nilai', [WaliController::class, 'nilai']);
Route::get('wali/materi', [MateriController::class, 'materiAnak']);
Route::get('wali/kegiatan', [KegiatanController::class, 'kegiatanWali']);

// ===== PROFILE USER =====
Route::get('profile', [UserProfileController::class, 'show']);
Route::put('profile', [UserProfileController::class, 'update']);
Route::post('profile/foto', [UserProfileController::class, 'uploadFoto']);

// ===== FILE UPLOAD =====
Route::post('upload', [SiswaController::class, 'uploadFile']);

// ===== INFO / DASHBOARD =====
Route::get('dashboard', function () {
    $today = now()->toDateString();

    $absensiHariIni = \App\Models\Absensi::with('siswa')->where('tanggal', $today)->get();
    $pembayaranHariIni = \App\Models\Pembayaran::where('tanggal', $today)->get();

    // Group absensi by kelas + mapel (so each subject gets its own card)
    $absensiPerKelas = $absensiHariIni->groupBy(function ($item) {
        return ($item->kelas ?? 'Unknown') . '|' . ($item->mapel ?? '-');
    })->map(function ($items) {
        return [
            'kelas' => $items->first()->kelas ?? 'Unknown',
            'mapel' => $items->first()->mapel ?? '-',
            'total' => $items->count(),
            'hadir' => $items->where('status', 'Hadir')->count(),
            'izin' => $items->where('status', 'Izin')->count(),
            'sakit' => $items->where('status', 'Sakit')->count(),
            'alfa' => $items->where('status', 'Alfa')->count(),
            'diinput_oleh' => $items->first()->diinput_oleh ?? 'Admin',
            'diinput_via' => $items->first()->diinput_via ?? 'online',
            'waktu' => $items->first()->created_at->format('H:i'),
        ];
    })->values();

    return response()->json([
        'success' => true,
        'tanggal' => $today,
        'absensi' => [
            'total' => $absensiHariIni->count(),
            'hadir' => $absensiHariIni->where('status', 'Hadir')->count(),
            'izin' => $absensiHariIni->where('status', 'Izin')->count(),
            'sakit' => $absensiHariIni->where('status', 'Sakit')->count(),
            'alfa' => $absensiHariIni->where('status', 'Alfa')->count(),
            'per_kelas' => $absensiPerKelas,
        ],
        'pembayaran' => [
            'total_masuk' => $pembayaranHariIni->sum('jumlah'),
            'jumlah_transaksi' => $pembayaranHariIni->count(),
        ],
        'statistik' => [
            'total_siswa' => \App\Models\Siswa::count(),
            'siswa_aktif' => \App\Models\Siswa::where('status', 'Aktif')->count(),
            'total_mapel' => \App\Models\MataPelajaran::where('status', 'Aktif')->count(),
        ],
    ]);
});
