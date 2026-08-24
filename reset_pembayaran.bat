@echo off
title Reset Sistem Keuangan & Tagihan
echo ====================================================
echo    DIKI NOBITAKUN - RESET SISTEM KEUANGAN LENGKAP
echo ====================================================
echo.
echo Menjalankan reset database transaksi keuangan...
cd /d "%~dp0absensi_backend"
php artisan finance:reset
echo.
pause
