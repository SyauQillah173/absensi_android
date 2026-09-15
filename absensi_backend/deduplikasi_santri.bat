@echo off
chcp 65001 >nul
cls
echo ===================================================================
echo        YAYASAN PONDOK PESANTREN QOMARUDDIN SAMPURNAN BUNGAH
echo             TOOLS AUDIT & DEDUPLIKASI DATA SANTRI PONDOK
echo ===================================================================
echo.
echo Pilih mode yang ingin Anda jalankan:
echo   [1] Analisa Saja (Dry-Run: Tinjau calon duplikat tanpa mengubah apapun)
echo   [2] Eksekusi Penggabungan & Hapus Duplikat (Merge: Aman 100%% Berelasi)
echo   [3] Keluar
echo.
set /p choice="Masukkan pilihan Anda [1-3]: "

if "%choice%"=="1" (
    echo.
    echo Menjalankan analisa santri duplikat (Dry-Run)...
    php artisan siswa:deduplicate --dry-run
    pause
    exit /b 0
)

if "%choice%"=="2" (
    echo.
    echo PERINGATAN: Anda akan menggabungkan & membersihkan data duplikat.
    php artisan siswa:deduplicate --merge
    pause
    exit /b 0
)

if "%choice%"=="3" (
    echo Proses dibatalkan.
    exit /b 0
)

echo Pilihan tidak valid!
pause
