#!/bin/bash
# ===================================================================
#   DIKI NOBITAKUN - SISTEM MIGRASI DATA SPP 26-27 PESANTREN (LINUX)
# ===================================================================

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$DIR/absensi_backend"

show_menu() {
    clear
    echo "==================================================================="
    echo "    DIKI NOBITAKUN - SISTEM MIGRASI DATA SPP 26-27 PESANTREN       "
    echo "==================================================================="
    echo ""
    echo " PILIH AKSI MIGRASI / PENGUJIAN SESUAI KEBUTUHAN:"
    echo ""
    echo " [1] SIMULASI & VALIDASI DATA (DRY-RUN)"
    echo "     - Cek pembacaan Excel PONPES QOMARUDDIN sheet SPP 26-27"
    echo "     - Verifikasi pencocokan nama 477 santri dan 12 bulan tagihan"
    echo "     - Aman 100%: TIDAK ADA perubahan atau penambahan ke database"
    echo ""
    echo " [2] MIGRASI PENUH BERSIH KE SERVER (FRESH RESET + AUTO-CREATE SANTRI)"
    echo "     - Bersihkan tagihan SPP 2026/2027 lama agar tidak duplikasi"
    echo "     - Otomatis daftarkan santri baru ke buku induk jika belum ada"
    echo "     - Generate 5.712 record tagihan untuk 12 bulan (Jul 2026 - Jun 2027)"
    echo "     - Otomatis sinkronkan transaksi kas untuk bulan yang sudah LUNAS"
    echo ""
    echo " [3] MIGRASI STANDAR (INSERT / UPDATE TANPA HAPUS)"
    echo "     - Masukkan data baru atau perbarui tagihan yang sudah ada"
    echo ""
    echo " [4] RESET KHUSUS TAGIHAN SPP 2026/2027 SAJA"
    echo "     - Hapus seluruh tagihan & transaksi SPP 2026/2027 dari database"
    echo "     - Data santri, guru, dan tagihan tahun ajaran lain TETAP AMAN"
    echo ""
    echo " [0] KELUAR"
    echo ""
    echo "==================================================================="
    read -p "Masukkan Pilihan (0/1/2/3/4): " pilihan

    case "$pilihan" in
        1)
            clear
            echo "==================================================================="
            echo " MENJALANKAN SIMULASI VALIDASI DATA (DRY RUN)..."
            echo "==================================================================="
            echo ""
            cd "$BACKEND_DIR" && php artisan spp:import-excel-2627 --dry-run --auto-create-students --force
            echo ""
            read -p "Tekan [Enter] untuk kembali ke menu..."
            show_menu
            ;;
        2)
            clear
            echo "==================================================================="
            echo " MENJALANKAN MIGRASI PENUH SPP 26-27 KE DATABASE SERVER..."
            echo "==================================================================="
            echo ""
            cd "$BACKEND_DIR" && php artisan spp:import-excel-2627 --fresh --auto-create-students --force
            echo ""
            read -p "Tekan [Enter] untuk kembali ke menu..."
            show_menu
            ;;
        3)
            clear
            echo "==================================================================="
            echo " MENJALANKAN MIGRASI STANDAR SPP 26-27..."
            echo "==================================================================="
            echo ""
            cd "$BACKEND_DIR" && php artisan spp:import-excel-2627 --auto-create-students --force
            echo ""
            read -p "Tekan [Enter] untuk kembali ke menu..."
            show_menu
            ;;
        4)
            clear
            echo "==================================================================="
            echo " MERESET SELURUH TAGIHAN SPP 2026/2027..."
            echo "==================================================================="
            echo ""
            cd "$BACKEND_DIR" && php artisan spp:import-excel-2627 --fresh --dry-run --force
            echo ""
            read -p "Tekan [Enter] untuk kembali ke menu..."
            show_menu
            ;;
        0)
            clear
            echo "Terima kasih Bang Nobita! Data SPP 26-27 siap digunakan."
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
