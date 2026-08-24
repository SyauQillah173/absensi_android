@echo off
title DIKI NOBITAKUN - RESET SISTEM KEUANGAN & TESTING
color 0A
cls

:MENU
cls
echo ===================================================================
echo    DIKI NOBITAKUN - PUSAT RESET SISTEM KEUANGAN & TESTING PESANTREN
echo ===================================================================
echo.
echo  PILIH OPSI RESET SESUAI KEBUTUHAN PENGUJIAN:
echo.
echo  [1] RESET TRANSAKSI LENGKAP (STANDAR)
echo      - Bersihkan: Transaksi Santri, Tagihan, Kas Masuk Lain, Pengeluaran
echo      - Auto-Generate: Tagihan 12 Bulan Bersih untuk Semester Aktif
echo      - Setting Tahun Ajaran: TETAP DIPERTAHANKAN
echo.
echo  [2] RESET TOTAL DENGAN TAHUN AJARAN DEFAULT (2025/2026 GANJIL)
echo      - Bersihkan: Seluruh Transaksi & Tagihan Keuangan
echo      - Reset Akademik: Kembalikan Tahun Ajaran ke 2025/2026 (Ganjil Aktif)
echo      - Auto-Generate: Tagihan 12 Bulan Bersih
echo.
echo  [3] RESET TOTAL KOSONG (UNTUK TESTING INPUT TAHUN AJARAN BARU DARI NOL)
echo      - Bersihkan: Seluruh Transaksi & Tagihan Keuangan
echo      - Kosongkan: Seluruh Tahun Ajaran & Semester (0 Data)
echo      - Siap untuk pengujian input Tahun Ajaran baru dari awal di web
echo.
echo  [4] RESET KAS MASUK LAIN & PENGELUARAN SAJA
echo      - Bersihkan: Data Kas Masuk Lain (Non-Santri) & Pengeluaran
echo      - Transaksi & Tagihan Santri: TETAP AMAN
echo.
echo  [0] KELUAR / BATAL
echo.
echo ===================================================================
set /p pilihan="Masukkan Nomor Pilihan (0/1/2/3/4): "

if "%pilihan%"=="1" goto RESET_STANDAR
if "%pilihan%"=="2" goto RESET_WITH_ACADEMIC
if "%pilihan%"=="3" goto RESET_FRESH_ACADEMIC
if "%pilihan%"=="4" goto RESET_KAS_ONLY
if "%pilihan%"=="0" goto KELUAR

echo.
echo Pilihan tidak valid! Silakan coba lagi.
timeout /t 2 >nul
goto MENU

:RESET_STANDAR
cls
echo ===================================================================
echo  MENJALANKAN RESET TRANSAKSI LENGKAP...
echo ===================================================================
echo.
cd /d "%~dp0absensi_backend"
php artisan finance:reset
echo.
pause
goto MENU

:RESET_WITH_ACADEMIC
cls
echo ===================================================================
echo  MENJALANKAN RESET DENGAN INISIALISASI TAHUN AJARAN DEFAULT...
echo ===================================================================
echo.
cd /d "%~dp0absensi_backend"
php artisan finance:reset --with-academic
echo.
pause
goto MENU

:RESET_FRESH_ACADEMIC
cls
echo ===================================================================
echo  MENJALANKAN RESET TOTAL (KOSONGKAN TAHUN AJARAN DARI NOL)...
echo ===================================================================
echo.
cd /d "%~dp0absensi_backend"
php artisan finance:reset --fresh-academic
echo.
pause
goto MENU

:RESET_KAS_ONLY
cls
echo ===================================================================
echo  MENJALANKAN RESET KAS MASUK LAIN & PENGELUARAN SAJA...
echo ===================================================================
echo.
cd /d "%~dp0absensi_backend"
php artisan finance:reset --kas-only
echo.
pause
goto MENU

:KELUAR
cls
echo Terima kasih Bang Nobita! Selamat menguji sistem keuangan pesantren.
timeout /t 2 >nul
exit
