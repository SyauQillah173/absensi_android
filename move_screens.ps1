$screens = "c:\Users\User\absensi_android\lib\screens"

# Create directories
'beranda','jelajah','absensi','sifir','mapel','buku_induk','akun' | ForEach-Object {
    New-Item -ItemType Directory -Force -Path "$screens\$_" | Out-Null
}

# Delete old auth root files (already copied via write_to_file to auth/)
Remove-Item "$screens\login_screen.dart" -Force -ErrorAction SilentlyContinue
Remove-Item "$screens\welcome_screen.dart" -Force -ErrorAction SilentlyContinue
Remove-Item "$screens\onboarding_wrapper.dart" -Force -ErrorAction SilentlyContinue
Remove-Item "$screens\splash_screen.dart" -Force -ErrorAction SilentlyContinue

# Move beranda
Move-Item "$screens\dashboard_screen.dart" "$screens\beranda\" -Force
Move-Item "$screens\placeholder_screen.dart" "$screens\beranda\" -Force

# Move jelajah
Move-Item "$screens\jelajah_screen.dart" "$screens\jelajah\" -Force
Move-Item "$screens\tambah_informasi_screen.dart" "$screens\jelajah\" -Force
Move-Item "$screens\detail_informasi_screen.dart" "$screens\jelajah\" -Force
Move-Item "$screens\edit_informasi_screen.dart" "$screens\jelajah\" -Force

# Move absensi
Move-Item "$screens\absensi_sifir_screen.dart" "$screens\absensi\" -Force
Move-Item "$screens\absensi_mapel_screen.dart" "$screens\absensi\" -Force
Move-Item "$screens\absensi_murid_screen.dart" "$screens\absensi\" -Force

# Move sifir
Move-Item "$screens\ruang_sifir_screen.dart" "$screens\sifir\" -Force
Move-Item "$screens\kelompok_belajar_screen.dart" "$screens\sifir\" -Force
Move-Item "$screens\edit_kelompok_sifir_screen.dart" "$screens\sifir\" -Force

# Move mapel
Move-Item "$screens\mata_pelajaran_screen.dart" "$screens\mapel\" -Force
Move-Item "$screens\edit_mapel_screen.dart" "$screens\mapel\" -Force

# Move buku_induk
Move-Item "$screens\buku_induk_screen.dart" "$screens\buku_induk\" -Force
Move-Item "$screens\data_guru_screen.dart" "$screens\buku_induk\" -Force
Move-Item "$screens\data_siswa_screen.dart" "$screens\buku_induk\" -Force
Move-Item "$screens\data_admin_screen.dart" "$screens\buku_induk\" -Force
Move-Item "$screens\detail_siswa_screen.dart" "$screens\buku_induk\" -Force
Move-Item "$screens\edit_siswa_screen.dart" "$screens\buku_induk\" -Force

# Move akun
Move-Item "$screens\akun_screen.dart" "$screens\akun\" -Force
Move-Item "$screens\kelola_profil_screen.dart" "$screens\akun\" -Force
Move-Item "$screens\file_library_screen.dart" "$screens\akun\" -Force
Move-Item "$screens\pengaturan_screen.dart" "$screens\akun\" -Force

Write-Host "ALL MOVES COMPLETE"
