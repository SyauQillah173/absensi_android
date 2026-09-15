#!/bin/bash
# ===================================================================
#   DIKI NOBITAKUN - PUSAT RESET SISTEM KEUANGAN & TESTING (LINUX)
# ===================================================================

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$DIR/absensi_backend"

show_menu() {
    clear
    echo "==================================================================="
    echo "   DIKI NOBITAKUN - PUSAT RESET SISTEM KEUANGAN & TESTING PESANTREN"
    echo "==================================================================="
    echo ""
    echo " PILIH OPSI RESET SESUAI KEBUTUHAN PENGUJIAN:"
    echo ""
    echo " [1] RESET TRANSAKSI LENGKAP (STANDAR)"
    echo "     - Bersihkan: Transaksi Santri, Tagihan, Kas Masuk Lain, Pengeluaran"
    echo "     - Auto-Generate: Tagihan 12 Bulan Bersih untuk Semester Aktif"
    echo "     - Setting Tahun Ajaran: TETAP DIPERTAHANKAN"
    echo ""
    echo " [2] RESET TOTAL DENGAN TAHUN AJARAN DEFAULT (2025/2026 GANJIL)"
    echo "     - Bersihkan: Seluruh Transaksi & Tagihan Keuangan"
    echo "     - Reset Akademik: Kembalikan Tahun Ajaran ke 2025/2026 (Ganjil Aktif)"
    echo "     - Auto-Generate: Tagihan 12 Bulan Bersih"
    echo ""
    echo " [3] RESET TOTAL KOSONG (UNTUK TESTING INPUT TAHUN AJARAN BARU DARI NOL)"
    echo "     - Bersihkan: Seluruh Transaksi & Tagihan Keuangan"
    echo "     - Kosongkan: Seluruh Tahun Ajaran & Semester (0 Data)"
    echo "     - Siap untuk pengujian input Tahun Ajaran baru dari awal di web"
    echo ""
    echo " [4] RESET KAS MASUK LAIN & PENGELUARAN SAJA"
    echo "     - Bersihkan: Data Kas Masuk Lain (Non-Santri) & Pengeluaran"
    echo "     - Transaksi & Tagihan Santri: TETAP AMAN"
    echo ""
    echo " [5] MIGRASI / IMPORT DATA SPP 26-27 (EXCEL PONPES QOMARUDDIN)"
    echo "     - Buka menu import data SPP 26-27 dari dokumen Excel pondok"
    echo ""
    echo " [0] KELUAR / BATAL"
    echo ""
    echo "==================================================================="
    read -p "Masukkan Nomor Pilihan (0/1/2/3/4/5): " pilihan

    case "$pilihan" in
        1)
            clear
            echo "==================================================================="
            echo " MENJALANKAN RESET TRANSAKSI LENGKAP..."
            echo "==================================================================="
            echo ""
            cd "$BACKEND_DIR" && php artisan finance:reset
            echo ""
            read -p "Tekan [Enter] untuk kembali ke menu..."
            show_menu
            ;;
        2)
            clear
            echo "==================================================================="
            echo " MENJALANKAN RESET DENGAN INISIALISASI TAHUN AJARAN DEFAULT..."
            echo "==================================================================="
            echo ""
            cd "$BACKEND_DIR" && php artisan finance:reset --with-academic
            echo ""
            read -p "Tekan [Enter] untuk kembali ke menu..."
            show_menu
            ;;
        3)
            clear
            echo "==================================================================="
            echo " MENJALANKAN RESET TOTAL (KOSONGKAN TAHUN AJARAN DARI NOL)..."
            echo "==================================================================="
            echo ""
            cd "$BACKEND_DIR" && php artisan finance:reset --fresh-academic
            echo ""
            read -p "Tekan [Enter] untuk kembali ke menu..."
            show_menu
            ;;
        4)
            clear
            echo "==================================================================="
            echo " MENJALANKAN RESET KAS MASUK LAIN & PENGELUARAN SAJA..."
            echo "==================================================================="
            echo ""
            cd "$BACKEND_DIR" && php artisan finance:reset --kas-only
            echo ""
            read -p "Tekan [Enter] untuk kembali ke menu..."
            show_menu
            ;;
        5)
            clear
            bash "$DIR/import_spp_26_27.sh"
            show_menu
            ;;
        0)
            clear
            echo "Terima kasih Bang Nobita! Selamat menguji sistem keuangan pesantren."
            exit 0
            ;;
        *)
            echo "Pilihan tidak valid!"
            sleep 1
            show_menu
            ;;
    esac
}

show_menu
