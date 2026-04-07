@echo off
set S=c:\Users\User\absensi_android\lib\screens

rem Create directories
mkdir "%S%\beranda" 2>nul
mkdir "%S%\jelajah" 2>nul
mkdir "%S%\absensi" 2>nul
mkdir "%S%\sifir" 2>nul
mkdir "%S%\mapel" 2>nul
mkdir "%S%\buku_induk" 2>nul
mkdir "%S%\akun" 2>nul

rem Delete old auth root files (already copied via write_to_file)
del "%S%\login_screen.dart"
del "%S%\welcome_screen.dart"
del "%S%\onboarding_wrapper.dart"
del "%S%\splash_screen.dart"

rem Move beranda
move "%S%\dashboard_screen.dart" "%S%\beranda\"
move "%S%\placeholder_screen.dart" "%S%\beranda\"

rem Move jelajah
move "%S%\jelajah_screen.dart" "%S%\jelajah\"
move "%S%\tambah_informasi_screen.dart" "%S%\jelajah\"
move "%S%\detail_informasi_screen.dart" "%S%\jelajah\"
move "%S%\edit_informasi_screen.dart" "%S%\jelajah\"

rem Move absensi
move "%S%\absensi_sifir_screen.dart" "%S%\absensi\"
move "%S%\absensi_mapel_screen.dart" "%S%\absensi\"
move "%S%\absensi_murid_screen.dart" "%S%\absensi\"

rem Move sifir
move "%S%\ruang_sifir_screen.dart" "%S%\sifir\"
move "%S%\kelompok_belajar_screen.dart" "%S%\sifir\"
move "%S%\edit_kelompok_sifir_screen.dart" "%S%\sifir\"

rem Move mapel
move "%S%\mata_pelajaran_screen.dart" "%S%\mapel\"
move "%S%\edit_mapel_screen.dart" "%S%\mapel\"

rem Move buku_induk
move "%S%\buku_induk_screen.dart" "%S%\buku_induk\"
move "%S%\data_guru_screen.dart" "%S%\buku_induk\"
move "%S%\data_siswa_screen.dart" "%S%\buku_induk\"
move "%S%\data_admin_screen.dart" "%S%\buku_induk\"
move "%S%\detail_siswa_screen.dart" "%S%\buku_induk\"
move "%S%\edit_siswa_screen.dart" "%S%\buku_induk\"

rem Move akun
move "%S%\akun_screen.dart" "%S%\akun\"
move "%S%\kelola_profil_screen.dart" "%S%\akun\"
move "%S%\file_library_screen.dart" "%S%\akun\"
move "%S%\pengaturan_screen.dart" "%S%\akun\"

echo ALL DONE
