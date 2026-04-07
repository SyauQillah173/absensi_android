import 'package:flutter/material.dart';

import '../../services/api_service.dart';
import '../../services/cache_service.dart';
import '../../services/cetak_siswa_pdf.dart';
import 'detail_siswa_screen.dart';
import 'edit_siswa_screen.dart';

class DataSiswaScreen extends StatefulWidget {
  const DataSiswaScreen({super.key});

  @override
  State<DataSiswaScreen> createState() => _DataSiswaScreenState();
}

class _DataSiswaScreenState extends State<DataSiswaScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _animController;
  late Animation<double> _fadeIn;

  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';
  int? _expandedIndex;

  // Data dari API
  List<Map<String, dynamic>> _siswaList = [];
  bool _isLoading = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 500),
    );
    _fadeIn = Tween<double>(
      begin: 0.0,
      end: 1.0,
    ).animate(CurvedAnimation(parent: _animController, curve: Curves.easeOut));
    _animController.forward();
    _loadSiswa();
  }

  bool _isOfflineMode = false;

  Future<void> _loadSiswa() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
      _isOfflineMode = false;
    });

    final result = await CacheService.fetchWithCache(
      cacheKey: 'siswa_list',
      apiFetch: () => ApiService.getSiswa(),
    );

    if (!mounted) return;

    if (result != null && result['success'] == true) {
      setState(() {
        _siswaList = List<Map<String, dynamic>>.from(result['data'] ?? []);
        _isLoading = false;
        // Check if this was from cache (no fresh API response)
        _isOfflineMode = result['_fromCache'] == true;
      });
    } else if (result != null) {
      // Got cached data but format might differ
      final cachedData = result['data'];
      if (cachedData != null) {
        setState(() {
          _siswaList = List<Map<String, dynamic>>.from(cachedData);
          _isLoading = false;
          _isOfflineMode = true;
        });
      } else {
        setState(() {
          _errorMessage =
              'Tidak ada data tersimpan.\nHubungkan ke server terlebih dahulu.';
          _isLoading = false;
        });
      }
    } else {
      setState(() {
        _errorMessage =
            'Tidak dapat terhubung ke server.\n'
            'Belum ada data offline tersimpan.\n'
            'Hubungkan ke server terlebih dahulu.';
        _isLoading = false;
      });
    }
  }

  @override
  void dispose() {
    _animController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  // Helper to get display value from API field
  String _val(Map<String, dynamic> s, String key, [String fallback = '-']) {
    final v = s[key];
    if (v == null || v.toString().isEmpty) return fallback;
    return v.toString();
  }

  String _jkDisplay(Map<String, dynamic> s) {
    return s['jenis_kelamin'] == 'L' ? 'Laki-laki' : 'Perempuan';
  }

  String _tglDisplay(String? tgl) {
    if (tgl == null || tgl.isEmpty) return '-';
    try {
      final dt = DateTime.parse(tgl);
      return '${dt.day.toString().padLeft(2, '0')}-${dt.month.toString().padLeft(2, '0')}-${dt.year}';
    } catch (_) {
      return tgl;
    }
  }

  List<Map<String, dynamic>> get _filteredSiswa {
    if (_searchQuery.isEmpty) return _siswaList;
    return _siswaList
        .where(
          (s) =>
              _val(
                s,
                'nama',
              ).toLowerCase().contains(_searchQuery.toLowerCase()) ||
              _val(s, 'nis').contains(_searchQuery) ||
              _val(s, 'nisn').contains(_searchQuery) ||
              _val(
                s,
                'kelas',
              ).toLowerCase().contains(_searchQuery.toLowerCase()),
        )
        .toList();
  }

  // ===== CONVERT API DATA → EDIT SCREEN FORMAT =====
  Map<String, String> _toEditFormat(Map<String, dynamic> s) {
    return {
      'nis': _val(s, 'nis'),
      'nisn': _val(s, 'nisn'),
      'nama': _val(s, 'nama'),
      'namaPanggilan': _val(s, 'nama_panggilan'),
      'tempatLahir': _val(s, 'tempat_lahir'),
      'tglLahir': _tglDisplay(s['tanggal_lahir']?.toString()),
      'jk': _jkDisplay(s),
      'nik': _val(s, 'nik'),
      'noKk': _val(s, 'no_kk'),
      'noAkta': _val(s, 'no_akta'),
      'dokumenAkta': _val(s, 'dokumen_akta', ''),
      'alamat': _val(s, 'alamat'),
      'kewarganegaraan': _val(s, 'kewarganegaraan', 'Indonesia'),
      'provinsi': _val(s, 'provinsi'),
      'kota': _val(s, 'kota'),
      'kecamatan': _val(s, 'kecamatan'),
      'kelurahan': _val(s, 'kelurahan'),
      'kodePos': _val(s, 'kode_pos'),
      'noWhatsapp': _val(s, 'no_whatsapp'),
      'emailSiswa': _val(s, 'email_siswa'),
      'asalSekolah': _val(s, 'asal_sekolah'),
      'tahunLulus': _val(s, 'tahun_lulus'),
      'tahunAkademikMasuk': _val(s, 'tahun_akademik_masuk'),
      'jenisSantri': _val(s, 'jenis_santri', ''),
      'kelas': _val(s, 'kelas'),
      'status': _val(s, 'status'),
      'namaAyah': _val(s, 'nama_ayah'),
      'nikAyah': _val(s, 'nik_ayah'),
      'tempatLahirAyah': _val(s, 'tempat_lahir_ayah'),
      'tglLahirAyah': _tglDisplay(s['tanggal_lahir_ayah']?.toString()),
      'noWhatsappAyah': _val(s, 'no_whatsapp_ayah'),
      'pekerjaanAyah': _val(s, 'pekerjaan_ayah'),
      'penghasilanAyah': _val(s, 'penghasilan_ayah'),
      'pendidikanAyah': _val(s, 'pendidikan_ayah'),
      'namaIbu': _val(s, 'nama_ibu'),
      'nikIbu': _val(s, 'nik_ibu'),
      'tempatLahirIbu': _val(s, 'tempat_lahir_ibu'),
      'tglLahirIbu': _tglDisplay(s['tanggal_lahir_ibu']?.toString()),
      'noWhatsappIbu': _val(s, 'no_whatsapp_ibu'),
      'pekerjaanIbu': _val(s, 'pekerjaan_ibu'),
      'penghasilanIbu': _val(s, 'penghasilan_ibu'),
      'pendidikanIbu': _val(s, 'pendidikan_ibu'),
      'noAyah': _val(s, 'no_ayah'),
      'noIbu': _val(s, 'no_ibu'),
      'namaWali': _val(s, 'nama_wali_keluarga'),
      'pekerjaanWali': _val(s, 'pekerjaan_wali_keluarga'),
      'alamatWali': _val(s, 'alamat_wali_keluarga'),
      'telpWali': _val(s, 'no_telepon_wali'),
      'waliSamaDengan': _val(s, 'wali_sama_dengan', ''),
      'tempatTinggal': _val(s, 'tempat_tinggal', ''),
      'transportasi': _val(s, 'transportasi', ''),
      'tinggiBadan': _val(s, 'tinggi_badan'),
      'beratBadan': _val(s, 'berat_badan'),
      'golonganDarah': _val(s, 'golongan_darah', ''),
      'fotoSantri': _val(s, 'foto_santri', ''),
      'catatanSantri': _val(s, 'catatan_santri'),
    };
  }

  // ===== CONVERT EDIT FORMAT → API FORMAT =====
  Map<String, dynamic> _buildApiData(Map<String, String> r) {
    String? convertDate(String? dateStr) {
      if (dateStr == null || dateStr.isEmpty || dateStr == '-') return null;
      try {
        final parts = dateStr.split('-');
        if (parts.length == 3) {
          return '${parts[2]}-${parts[1]}-${parts[0]}'; // DD-MM-YYYY → YYYY-MM-DD
        }
      } catch (_) {}
      return dateStr;
    }

    return {
      'nis': r['nis'],
      'nisn': r['nisn'],
      'nama': r['nama'],
      'nama_panggilan': r['namaPanggilan'],
      'tempat_lahir': r['tempatLahir'],
      'tanggal_lahir': convertDate(r['tglLahir']),
      'jenis_kelamin': r['jk'] == 'Laki-laki' ? 'L' : 'P',
      'nik': r['nik'],
      'no_kk': r['noKk'],
      'no_akta': r['noAkta'],
      'dokumen_akta': r['dokumenAkta'],
      'alamat': r['alamat'],
      'kewarganegaraan': r['kewarganegaraan'],
      'provinsi': r['provinsi'],
      'kota': r['kota'],
      'kecamatan': r['kecamatan'],
      'kelurahan': r['kelurahan'],
      'kode_pos': r['kodePos'],
      'no_whatsapp': r['noWhatsapp'],
      'email_siswa': r['emailSiswa'],
      'asal_sekolah': r['asalSekolah'],
      'tahun_lulus': r['tahunLulus'],
      'tahun_akademik_masuk': r['tahunAkademikMasuk'],
      'jenis_santri': r['jenisSantri'],
      'kelas': r['kelas'],
      'status': r['status'] ?? 'Aktif',
      'nama_ayah': r['namaAyah'],
      'nik_ayah': r['nikAyah'],
      'tempat_lahir_ayah': r['tempatLahirAyah'],
      'tanggal_lahir_ayah': convertDate(r['tglLahirAyah']),
      'no_whatsapp_ayah': r['noWhatsappAyah'],
      'pekerjaan_ayah': r['pekerjaanAyah'],
      'penghasilan_ayah': r['penghasilanAyah'],
      'pendidikan_ayah': r['pendidikanAyah'],
      'nama_ibu': r['namaIbu'],
      'nik_ibu': r['nikIbu'],
      'tempat_lahir_ibu': r['tempatLahirIbu'],
      'tanggal_lahir_ibu': convertDate(r['tglLahirIbu']),
      'no_whatsapp_ibu': r['noWhatsappIbu'],
      'pekerjaan_ibu': r['pekerjaanIbu'],
      'penghasilan_ibu': r['penghasilanIbu'],
      'pendidikan_ibu': r['pendidikanIbu'],
      'no_ayah': r['noAyah'],
      'no_ibu': r['noIbu'],
      'nama_wali_keluarga': r['namaWali'],
      'pekerjaan_wali_keluarga': r['pekerjaanWali'],
      'alamat_wali_keluarga': r['alamatWali'],
      'no_telepon_wali': r['telpWali'],
      'wali_sama_dengan': r['waliSamaDengan'],
      'tempat_tinggal': r['tempatTinggal'],
      'transportasi': r['transportasi'],
      'tinggi_badan': r['tinggiBadan'],
      'berat_badan': r['beratBadan'],
      'golongan_darah': r['golonganDarah'],
      'foto_santri': r['fotoSantri'],
      'catatan_santri': r['catatanSantri'],
    };
  }

  // ===== CRUD ACTIONS =====
  // ========== TAMBAH SISWA BARU ==========
  void _handleTambahSiswa() async {
    // Open EditSiswaScreen with empty data (add mode)
    final emptyData = <String, String>{
      'nis': '',
      'nisn': '',
      'nama': '',
      'namaPanggilan': '',
      'tempatLahir': '',
      'tglLahir': '',
      'jk': 'Laki-laki',
      'nik': '',
      'noKk': '',
      'noAkta': '',
      'dokumenAkta': '',
      'alamat': '',
      'kewarganegaraan': 'Indonesia',
      'provinsi': '',
      'kota': '',
      'kecamatan': '',
      'kelurahan': '',
      'kodePos': '',
      'noWhatsapp': '',
      'emailSiswa': '',
      'asalSekolah': '',
      'tahunLulus': '',
      'tahunAkademikMasuk': '',
      'jenisSantri': '',
      'kelas': '',
      'status': 'Aktif',
      'namaAyah': '',
      'nikAyah': '',
      'tempatLahirAyah': '',
      'tglLahirAyah': '',
      'noWhatsappAyah': '',
      'pekerjaanAyah': '',
      'penghasilanAyah': '',
      'pendidikanAyah': '',
      'namaIbu': '',
      'nikIbu': '',
      'tempatLahirIbu': '',
      'tglLahirIbu': '',
      'noWhatsappIbu': '',
      'pekerjaanIbu': '',
      'penghasilanIbu': '',
      'pendidikanIbu': '',
      'noAyah': '',
      'noIbu': '',
      'namaWali': '',
      'pekerjaanWali': '',
      'alamatWali': '',
      'telpWali': '',
      'waliSamaDengan': '',
      'tempatTinggal': '',
      'transportasi': '',
      'tinggiBadan': '',
      'beratBadan': '',
      'golonganDarah': '',
      'fotoSantri': '',
      'catatanSantri': '',
    };

    final result = await Navigator.push(
      context,
      PageRouteBuilder(
        pageBuilder: (context, animation, _) =>
            EditSiswaScreen(siswa: emptyData),
        transitionsBuilder: (context, animation, _, child) {
          return SlideTransition(
            position: Tween<Offset>(begin: const Offset(1, 0), end: Offset.zero)
                .animate(
                  CurvedAnimation(
                    parent: animation,
                    curve: Curves.easeOutCubic,
                  ),
                ),
            child: child,
          );
        },
        transitionDuration: const Duration(milliseconds: 350),
      ),
    );

    if (result != null && result is Map<String, String>) {
      // Check if nama is filled (minimum required)
      if (result['nama'] == null || result['nama']!.trim().isEmpty) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: const Text('Nama siswa wajib diisi'),
              backgroundColor: const Color(0xFFE65100),
              behavior: SnackBarBehavior.floating,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
          );
        }
        return;
      }

      try {
        // Show loading
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: const Row(
                children: [
                  SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
                    ),
                  ),
                  SizedBox(width: 12),
                  Text('Menyimpan data siswa baru...'),
                ],
              ),
              backgroundColor: const Color(0xFF138F81),
              behavior: SnackBarBehavior.floating,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
              duration: const Duration(seconds: 10),
            ),
          );
        }

        final apiData = _buildApiData(result);

        final response = await ApiService.createSiswa(apiData);

        // Dismiss loading snackbar
        if (mounted) {
          ScaffoldMessenger.of(context).hideCurrentSnackBar();
        }

        if (response['success'] == true) {
          await _loadSiswa(); // Refresh list from API

          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text('✅ Data ${result['nama']} berhasil ditambahkan!'),
                backgroundColor: const Color(0xFF138F81),
                behavior: SnackBarBehavior.floating,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                duration: const Duration(seconds: 3),
              ),
            );
          }
        } else {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(
                  'Gagal: ${response['message'] ?? 'Unknown error'}',
                ),
                backgroundColor: const Color(0xFFE65100),
                behavior: SnackBarBehavior.floating,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            );
          }
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).hideCurrentSnackBar();
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Gagal menyimpan: $e'),
              backgroundColor: const Color(0xFFE65100),
              behavior: SnackBarBehavior.floating,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
          );
        }
      }
    }
  }

  void _handleEditData(Map<String, dynamic> siswa) async {
    setState(() => _expandedIndex = null);
    final editData = _toEditFormat(siswa);
    final result = await Navigator.push(
      context,
      PageRouteBuilder(
        pageBuilder: (context, animation, _) =>
            EditSiswaScreen(siswa: editData),
        transitionsBuilder: (context, animation, _, child) {
          return SlideTransition(
            position: Tween<Offset>(begin: const Offset(1, 0), end: Offset.zero)
                .animate(
                  CurvedAnimation(
                    parent: animation,
                    curve: Curves.easeOutCubic,
                  ),
                ),
            child: child,
          );
        },
        transitionDuration: const Duration(milliseconds: 350),
      ),
    );

    if (result != null && result is Map<String, String>) {
      // Convert edit format back to API format and update
      try {
        final id = siswa['id'];
        final apiData = _buildApiData(result);

        await ApiService.updateSiswa(id, apiData);
        await _loadSiswa(); // Refresh from API

        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Data ${result['nama']} berhasil diperbarui'),
              backgroundColor: const Color(0xFF138F81),
              behavior: SnackBarBehavior.floating,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
              duration: const Duration(seconds: 2),
            ),
          );
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Gagal menyimpan: $e'),
              backgroundColor: const Color(0xFFE65100),
              behavior: SnackBarBehavior.floating,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
          );
        }
      }
    }
  }

  void _handleEditStatus(Map<String, dynamic> siswa) {
    setState(() => _expandedIndex = null);
    final isActive = siswa['status'] == 'Aktif';

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(
          children: [
            Icon(
              Icons.toggle_on_rounded,
              color: isActive
                  ? const Color(0xFFE65100)
                  : const Color(0xFF138F81),
              size: 28,
            ),
            const SizedBox(width: 8),
            const Text(
              'Edit Status',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
            ),
          ],
        ),
        content: Text(
          isActive
              ? 'Nonaktifkan siswa "${siswa['nama']}"?'
              : 'Aktifkan kembali siswa "${siswa['nama']}"?',
          style: const TextStyle(fontSize: 13),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text(
              'Batal',
              style: TextStyle(color: Color(0xFF636E72)),
            ),
          ),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(ctx);
              try {
                final newStatus = isActive ? 'Nonaktif' : 'Aktif';
                await ApiService.updateSiswa(siswa['id'], {
                  'status': newStatus,
                });
                await _loadSiswa();
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('Status ${siswa['nama']} → $newStatus'),
                      backgroundColor: isActive
                          ? const Color(0xFFE65100)
                          : const Color(0xFF138F81),
                      behavior: SnackBarBehavior.floating,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                      duration: const Duration(seconds: 2),
                    ),
                  );
                }
              } catch (e) {
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('Gagal mengubah status: $e'),
                      backgroundColor: const Color(0xFFE65100),
                    ),
                  );
                }
              }
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: isActive
                  ? const Color(0xFFE65100)
                  : const Color(0xFF138F81),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
            child: Text(isActive ? 'Nonaktifkan' : 'Aktifkan'),
          ),
        ],
      ),
    );
  }

  void _handleDetail(Map<String, dynamic> siswa) {
    setState(() => _expandedIndex = null);
    final detailData = _toEditFormat(siswa);
    Navigator.push(
      context,
      PageRouteBuilder(
        pageBuilder: (context, animation, _) =>
            DetailSiswaScreen(siswa: detailData),
        transitionsBuilder: (context, animation, _, child) {
          return FadeTransition(
            opacity: animation,
            child: SlideTransition(
              position:
                  Tween<Offset>(
                    begin: const Offset(0, 0.05),
                    end: Offset.zero,
                  ).animate(
                    CurvedAnimation(
                      parent: animation,
                      curve: Curves.easeOutCubic,
                    ),
                  ),
              child: child,
            ),
          );
        },
        transitionDuration: const Duration(milliseconds: 350),
      ),
    );
  }

  void _handleHapus(Map<String, dynamic> siswa) {
    setState(() => _expandedIndex = null);
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Row(
          children: [
            Icon(Icons.delete_rounded, color: Color(0xFFE65100), size: 28),
            SizedBox(width: 8),
            Text(
              'Hapus Siswa',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
            ),
          ],
        ),
        content: RichText(
          text: TextSpan(
            style: const TextStyle(fontSize: 13, color: Color(0xFF2D3436)),
            children: [
              const TextSpan(text: 'Apakah Anda yakin ingin menghapus data '),
              TextSpan(
                text: '"${siswa['nama']}"',
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
              const TextSpan(text: '? Tindakan ini tidak dapat dibatalkan.'),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text(
              'Tidak',
              style: TextStyle(
                color: Color(0xFF636E72),
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(ctx);
              try {
                final nama = siswa['nama'];
                await ApiService.deleteSiswa(siswa['id']);
                await _loadSiswa();
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('Data $nama berhasil dihapus'),
                      backgroundColor: const Color(0xFFE65100),
                      behavior: SnackBarBehavior.floating,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                      duration: const Duration(seconds: 2),
                    ),
                  );
                }
              } catch (e) {
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('Gagal menghapus: $e'),
                      backgroundColor: const Color(0xFFE65100),
                    ),
                  );
                }
              }
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFE65100),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
            child: const Text('Ya, Hapus'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _filteredSiswa;

    return Scaffold(
      backgroundColor: const Color(0xFFFFDC80),
      floatingActionButton: FloatingActionButton(
        onPressed: _handleTambahSiswa,
        backgroundColor: const Color(0xFF138F81),
        child: const Icon(Icons.person_add_rounded, color: Colors.white),
      ),
      body: SafeArea(
        child: FadeTransition(
          opacity: _fadeIn,
          child: Column(
            children: [
              // ===== PROFILE BAR =====
              _buildProfileBar(),
              const SizedBox(height: 12),

              // ===== SEARCH BAR =====
              _buildSearchBar(),
              const SizedBox(height: 8),

              // ===== OFFLINE BANNER =====
              if (_isOfflineMode)
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 8,
                    ),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFFF3E0),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFFFB74D)),
                    ),
                    child: const Row(
                      children: [
                        Icon(
                          Icons.wifi_off_rounded,
                          size: 16,
                          color: Color(0xFFE65100),
                        ),
                        SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'Mode Offline — menampilkan data terakhir tersimpan',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              color: Color(0xFFE65100),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              if (_isOfflineMode) const SizedBox(height: 8),

              // ===== CONTENT =====
              if (_isLoading)
                const Expanded(
                  child: Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        CircularProgressIndicator(color: Color(0xFF138F81)),
                        SizedBox(height: 16),
                        Text(
                          'Memuat data siswa...',
                          style: TextStyle(
                            fontSize: 13,
                            color: Color(0xFF636E72),
                          ),
                        ),
                      ],
                    ),
                  ),
                )
              else if (_errorMessage != null)
                Expanded(
                  child: Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(
                          Icons.wifi_off_rounded,
                          size: 48,
                          color: Color(0xFFE65100),
                        ),
                        const SizedBox(height: 12),
                        Text(
                          _errorMessage!,
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            fontSize: 13,
                            color: Color(0xFF636E72),
                          ),
                        ),
                        const SizedBox(height: 16),
                        ElevatedButton.icon(
                          onPressed: _loadSiswa,
                          icon: const Icon(Icons.refresh_rounded),
                          label: const Text('Coba Lagi'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF138F81),
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                )
              else ...[
                // ===== COUNT =====
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        '${filtered.length} Siswa Ditemukan',
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF636E72),
                        ),
                      ),
                      Row(
                        children: [
                          _buildFilterChip(
                            'L',
                            filtered
                                .where((s) => s['jenis_kelamin'] == 'L')
                                .length,
                            const Color(0xFF2E86DE),
                          ),
                          const SizedBox(width: 6),
                          _buildFilterChip(
                            'P',
                            filtered
                                .where((s) => s['jenis_kelamin'] == 'P')
                                .length,
                            const Color(0xFFE65100),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 8),

                // ===== LIST =====
                Expanded(
                  child: RefreshIndicator(
                    onRefresh: _loadSiswa,
                    color: const Color(0xFF138F81),
                    child: ListView.builder(
                      physics: const AlwaysScrollableScrollPhysics(
                        parent: BouncingScrollPhysics(),
                      ),
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      itemCount: filtered.length,
                      itemBuilder: (context, index) {
                        return _buildSiswaCard(filtered[index], index);
                      },
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildFilterChip(String label, int count, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        '$label: $count',
        style: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w700,
          color: color,
        ),
      ),
    );
  }

  Widget _buildProfileBar() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: const Color(0xFFE1EFF7),
          borderRadius: BorderRadius.circular(25),
        ),
        child: Row(
          children: [
            Container(
              width: 50,
              height: 50,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: const Color(0xFF2E86DE).withValues(alpha: 0.15),
              ),
              child: const Icon(
                Icons.people_rounded,
                color: Color(0xFF2E86DE),
                size: 26,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Data Siswa',
                    style: TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF2D3436),
                    ),
                  ),
                  Text(
                    'Buku Induk → Data Siswa',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w500,
                      color: Color(0xFF636E72),
                    ),
                  ),
                ],
              ),
            ),
            IconButton(
              onPressed: () => Navigator.pop(context),
              icon: const Icon(Icons.arrow_back_ios_rounded, size: 20),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSearchBar() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(21),
        ),
        child: Row(
          children: [
            const Icon(
              Icons.search_rounded,
              size: 22,
              color: Color(0xFF636E72),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: TextField(
                controller: _searchController,
                onChanged: (val) => setState(() => _searchQuery = val),
                decoration: const InputDecoration(
                  hintText: 'Cari Nama / NIS / NISN / Kelas...',
                  border: InputBorder.none,
                  hintStyle: TextStyle(fontSize: 13, color: Color(0xFF636E72)),
                ),
                style: const TextStyle(fontSize: 13),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSiswaCard(Map<String, dynamic> siswa, int index) {
    final isExpanded = _expandedIndex == index;
    final isActive = siswa['status'] == 'Aktif';
    final isMale = siswa['jenis_kelamin'] == 'L';
    final cardColor = isMale
        ? const Color(0xFF2E86DE)
        : const Color(0xFFE65100);
    final kelas = _val(siswa, 'kelas', '');

    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0.0, end: 1.0),
      duration: Duration(milliseconds: 400 + (index * 60)),
      curve: Curves.easeOutCubic,
      builder: (context, value, child) {
        return Transform.translate(
          offset: Offset(0, 20 * (1 - value)),
          child: Opacity(opacity: value, child: child),
        );
      },
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
        ),
        child: Column(
          children: [
            // Main content
            InkWell(
              borderRadius: BorderRadius.circular(20),
              onTap: () {
                setState(() {
                  _expandedIndex = isExpanded ? null : index;
                });
              },
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Row(
                  children: [
                    // Avatar
                    Container(
                      width: 48,
                      height: 48,
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: [cardColor, cardColor.withValues(alpha: 0.7)],
                        ),
                        borderRadius: BorderRadius.circular(15),
                      ),
                      child: Center(
                        child: Icon(
                          isMale ? Icons.boy_rounded : Icons.girl_rounded,
                          color: Colors.white,
                          size: 26,
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),

                    // Info
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            _val(siswa, 'nama'),
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF2D3436),
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          const SizedBox(height: 3),
                          Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 6,
                                  vertical: 2,
                                ),
                                decoration: BoxDecoration(
                                  color: cardColor.withValues(alpha: 0.1),
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: Text(
                                  'NIS: ${_val(siswa, 'nis')}',
                                  style: TextStyle(
                                    fontSize: 8,
                                    fontWeight: FontWeight.w700,
                                    color: cardColor,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 4),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 6,
                                  vertical: 2,
                                ),
                                decoration: BoxDecoration(
                                  color: isActive
                                      ? const Color(
                                          0xFF138F81,
                                        ).withValues(alpha: 0.1)
                                      : const Color(
                                          0xFFE65100,
                                        ).withValues(alpha: 0.1),
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: Text(
                                  _val(siswa, 'status'),
                                  style: TextStyle(
                                    fontSize: 8,
                                    fontWeight: FontWeight.w700,
                                    color: isActive
                                        ? const Color(0xFF138F81)
                                        : const Color(0xFFE65100),
                                  ),
                                ),
                              ),
                              if (kelas.isNotEmpty) ...[
                                const SizedBox(width: 4),
                                Flexible(
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 6,
                                      vertical: 2,
                                    ),
                                    decoration: BoxDecoration(
                                      color: const Color(
                                        0xFF6C5CE7,
                                      ).withValues(alpha: 0.1),
                                      borderRadius: BorderRadius.circular(6),
                                    ),
                                    child: Text(
                                      kelas,
                                      style: const TextStyle(
                                        fontSize: 8,
                                        fontWeight: FontWeight.w700,
                                        color: Color(0xFF6C5CE7),
                                      ),
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ],
                      ),
                    ),

                    // Chevron
                    AnimatedRotation(
                      turns: isExpanded ? 0.25 : 0,
                      duration: const Duration(milliseconds: 200),
                      child: const Icon(
                        Icons.chevron_right_rounded,
                        color: Color(0xFF636E72),
                        size: 24,
                      ),
                    ),
                  ],
                ),
              ),
            ),

            // Expanded detail
            AnimatedSize(
              duration: const Duration(milliseconds: 250),
              curve: Curves.easeInOut,
              child: isExpanded
                  ? Column(
                      children: [
                        Container(
                          margin: const EdgeInsets.symmetric(horizontal: 14),
                          height: 1,
                          color: const Color(
                            0xFF000000,
                          ).withValues(alpha: 0.06),
                        ),
                        Padding(
                          padding: const EdgeInsets.fromLTRB(14, 10, 14, 6),
                          child: Column(
                            children: [
                              _buildDetailRow('NIS', _val(siswa, 'nis')),
                              _buildDetailRow('NISN', _val(siswa, 'nisn')),
                              _buildDetailRow(
                                'Nama Lengkap',
                                _val(siswa, 'nama'),
                              ),
                              _buildDetailRow(
                                'TTL',
                                '${_val(siswa, 'tempat_lahir')}, ${_tglDisplay(siswa['tanggal_lahir']?.toString())}',
                              ),
                              _buildDetailRow(
                                'Jenis Kelamin',
                                _jkDisplay(siswa),
                              ),
                              _buildDetailRow('Kelas', kelas),
                              _buildDetailRow(
                                'Tanggal Masuk',
                                _tglDisplay(siswa['tanggal_masuk']?.toString()),
                              ),
                              _buildDetailRow(
                                'Telp. Wali',
                                _val(siswa, 'no_telepon_wali'),
                              ),
                              _buildDetailRow('Status', _val(siswa, 'status')),
                            ],
                          ),
                        ),

                        // Action buttons (4 buttons)
                        Container(
                          margin: const EdgeInsets.fromLTRB(14, 0, 14, 12),
                          child: Row(
                            children: [
                              _buildActionBtn(
                                'Edit Data',
                                Icons.edit_rounded,
                                const Color(0xFF2E86DE),
                                () => _handleEditData(siswa),
                              ),
                              const SizedBox(width: 6),
                              _buildActionBtn(
                                'Edit Status',
                                Icons.toggle_on_rounded,
                                const Color(0xFFFFB74D),
                                () => _handleEditStatus(siswa),
                              ),
                              const SizedBox(width: 6),
                              _buildActionBtn(
                                'Detail',
                                Icons.visibility_rounded,
                                const Color(0xFF138F81),
                                () => _handleDetail(siswa),
                              ),
                              const SizedBox(width: 6),
                              _buildActionBtn(
                                'Cetak',
                                Icons.print_rounded,
                                const Color(0xFF6C5CE7),
                                () => CetakSiswaPdf.cetakAtauDownload(
                                  _toEditFormat(siswa),
                                ),
                              ),
                              const SizedBox(width: 6),
                              _buildActionBtn(
                                'Hapus',
                                Icons.delete_rounded,
                                const Color(0xFFE65100),
                                () => _handleHapus(siswa),
                              ),
                            ],
                          ),
                        ),
                      ],
                    )
                  : const SizedBox.shrink(),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDetailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 100,
            child: Text(
              label,
              style: const TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w500,
                color: Color(0xFF636E72),
              ),
            ),
          ),
          const Text(
            ': ',
            style: TextStyle(fontSize: 10, color: Color(0xFF636E72)),
          ),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w600,
                color: Color(0xFF2D3436),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActionBtn(
    String label,
    IconData icon,
    Color color,
    VoidCallback onTap,
  ) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: color.withValues(alpha: 0.3), width: 1),
          ),
          child: Column(
            children: [
              Icon(icon, color: color, size: 14),
              const SizedBox(height: 2),
              Text(
                label,
                style: TextStyle(
                  fontSize: 8,
                  fontWeight: FontWeight.w700,
                  color: color,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
