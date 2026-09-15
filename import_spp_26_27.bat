@echo off
title DIKI NOBITAKUN - PUSAT MIGRASI SPP 26-27 YAYASAN PP QOMARUDDIN
color 0B
cls

:MENU
cls
echo ===================================================================
echo     DIKI NOBITAKUN - SISTEM MIGRASI DATA SPP 26-27 PESANTREN       
echo ===================================================================
echo.
echo  PILIH AKSI MIGRASI / PENGUJIAN SESUAI KEBUTUHAN:
echo.
echo  [1] SIMULASI & VALIDASI DATA (DRY-RUN)
echo      - Cek pembacaan Excel PONPES QOMARUDDIN sheet SPP 26-27
echo      - Verifikasi pencocokan nama 477 santri dan 12 bulan tagihan
echo      - Aman 100%%: TIDAK ADA perubahan atau penambahan ke database server
echo.
echo  [2] MIGRASI PENUH BERSIH KE SERVER (FRESH RESET + AUTO-CREATE SANTRI)
echo      - Bersihkan tagihan SPP 2026/2027 lama agar tidak terjadi duplikasi
echo      - Otomatis daftarkan santri baru ke buku induk jika belum ada di DB
echo      - Generate 5.724 record tagihan untuk 12 bulan (Jul 2026 - Jun 2027)
echo      - Otomatis sinkronkan transaksi kas untuk bulan yang sudah LUNAS
echo.
echo  [3] MIGRASI STANDAR (INSERT / UPDATE TANPA HAPUS)
echo      - Masukkan data baru atau perbarui tagihan yang sudah ada
echo.
echo  [4] RESET KHUSUS TAGIHAN SPP 2026/2027 SAJA
echo      - Hapus seluruh tagihan & transaksi SPP 2026/2027 dari database
echo      - Data santri, guru, dan tagihan tahun ajaran lain TETAP AMAN
echo.
echo  [0] KELUAR
echo.
echo ===================================================================
set /p pilihan="Masukkan Pilihan (0/1/2/3/4): "

if "%pilihan%"=="1" goto DRY_RUN
if "%pilihan%"=="2" goto FRESH_MIGRATE
if "%pilihan%"=="3" goto STANDARD_MIGRATE
if "%pilihan%"=="4" goto RESET_ONLY
if "%pilihan%"=="0" goto KELUAR

echo.
echo Pilihan tidak valid! Silakan coba lagi.
timeout /t 2 >nul
goto MENU

:DRY_RUN
cls
echo ===================================================================
echo  MENJALANKAN SIMULASI VALIDASI DATA (DRY RUN)...
echo ===================================================================
echo.
cd /d "%~dp0absensi_backend"
php artisan spp:import-excel-2627 --dry-run --auto-create-students --force
echo.
pause
goto MENU

:FRESH_MIGRATE
cls
echo ===================================================================
echo  MENJALANKAN MIGRASI PENUH SPP 26-27 KE DATABASE SERVER...
echo ===================================================================
echo.
cd /d "%~dp0absensi_backend"
php artisan spp:import-excel-2627 --fresh --auto-create-students
echo.
pause
goto MENU

:STANDARD_MIGRATE
cls
echo ===================================================================
echo  MENJALANKAN MIGRASI STANDAR SPP 26-27...
echo ===================================================================
echo.
cd /d "%~dp0absensi_backend"
php artisan spp:import-excel-2627 --auto-create-students
echo.
pause
goto MENU

:RESET_ONLY
cls
echo ===================================================================
echo  MERESET SELURUH TAGIHAN SPP 2026/2027...
echo ===================================================================
echo.
cd /d "%~dp0absensi_backend"
php artisan spp:import-excel-2627 --fresh --dry-run
echo.
pause
goto MENU

:KELUAR
cls
echo Terima kasih Bang Nobita! Data SPP 26-27 siap digunakan.
timeout /t 2 >nul
exit
