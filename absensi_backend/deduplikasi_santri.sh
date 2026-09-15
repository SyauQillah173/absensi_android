#!/bin/bash
# ===============================================================
# SCRIPT RUNNER DEDUPLIKASI SANTRI - YAYASAN PONDOK PESANTREN QOMARUDDIN
# ===============================================================

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'

clear
echo -e "${CYAN}===================================================================${NC}"
echo -e "${CYAN}       YAYASAN PONDOK PESANTREN QOMARUDDIN SAMPURNAN BUNGAH        ${NC}"
echo -e "${CYAN}            TOOLS AUDIT & DEDUPLIKASI DATA SANTRI PONDOK           ${NC}"
echo -e "${CYAN}===================================================================${NC}"
echo ""
echo "Pilih mode yang ingin Anda jalankan:"
echo -e "  ${GREEN}[1] Analisa Saja (Dry-Run: Tinjau calon duplikat tanpa mengubah apapun)${NC}"
echo -e "  ${YELLOW}[2] Eksekusi Penggabungan & Hapus Duplikat (Merge: Aman 100% Berelasi)${NC}"
echo -e "  ${RED}[3] Keluar${NC}"
echo ""
read -p "Masukkan pilihan Anda [1-3]: " choice

case $choice in
    1)
        echo ""
        echo -e "${GREEN}Menjalankan analisa santri duplikat (Dry-Run)...${NC}"
        php artisan siswa:deduplicate --dry-run
        ;;
    2)
        echo ""
        echo -e "${YELLOW}PERINGATAN: Anda akan menggabungkan & membersihkan data duplikat.${NC}"
        php artisan siswa:deduplicate --merge
        ;;
    3)
        echo -e "${CYAN}Proses dibatalkan.${NC}"
        exit 0
        ;;
    *)
        echo -e "${RED}Pilihan tidak valid!${NC}"
        exit 1
        ;;
esac
