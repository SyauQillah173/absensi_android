@echo off
title Reset Data Pembayaran & Tagihan
echo ====================================================
echo    DIKI NOBITAKUN - RESET DATA PEMBAYARAN & TAGIHAN
echo ====================================================
echo.
echo Menjalankan reset database pembayaran...
cd /d "%~dp0absensi_backend"
php artisan payment:reset
echo.
pause
