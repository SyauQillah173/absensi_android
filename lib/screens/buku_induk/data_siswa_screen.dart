import 'dart:io';

import 'package:flutter/material.dart';

import '../../services/api_service.dart';
import '../../services/cache_service.dart';
import '../../services/cetak_siswa_pdf.dart';
import '../../services/excel_import_service.dart';
import '../../services/sync_service.dart';
import '../../utils/siswa_view_mapper.dart';
import '../../widgets/adaptive_bottom_sheet.dart';
import '../../widgets/app_feedback.dart';
import '../../widgets/responsive_layout.dart';
import 'detail_siswa_screen.dart';
import 'edit_siswa_screen.dart';

class DataSiswaScreen extends StatefulWidget {
  const DataSiswaScreen({super.key});

  @override
  State<DataSiswaScreen> createState() => _DataSiswaScreenState();
}

class _DataSiswaScreenState extends State<DataSiswaScreen>
    with SingleTickerProviderStateMixin {
  static const List<String> _statusFilters = [
    'Semua',
    'Aktif',
    'Nonaktif',
    'Lulus',
  ];

  late AnimationController _animController;
  late Animation<double> _fadeIn;

  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';
  String _statusFilter = 'Semua';
  int? _expandedIndex;

  List<Map<String, dynamic>> _siswaList = [];
  bool _isLoading = true;
  String? _errorMessage;
  bool _isOfflineMode = false;

  bool _isSelectionMode = false;
  bool _isBulkUpdating = false;
  final Set<int> _selectedIds = <int>{};
  final Set<int> _pendingStatusIds = <int>{};

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

  @override
  void dispose() {
    _animController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  String _val(Map<String, dynamic> siswa, String key, [String fallback = '-']) {
    final value = siswa[key];
    if (value == null || value.toString().trim().isEmpty) return fallback;
    return value.toString();
  }

  int _siswaId(Map<String, dynamic> siswa) {
    return int.tryParse(siswa['id']?.toString() ?? '') ?? 0;
  }

  String _normalizeStatus(dynamic value) {
    final raw = value?.toString().trim().toLowerCase() ?? '';
    if (raw == 'lulus' || raw == 'alumni' || raw == 'graduated') {
      return 'Lulus';
    }
    if (raw == 'nonaktif') return 'Nonaktif';
    return 'Aktif';
  }

  String _jkDisplay(Map<String, dynamic> siswa) {
    return siswa['jenis_kelamin'] == 'L' ? 'Laki-laki' : 'Perempuan';
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

  Map<String, dynamic> _normalizeSiswa(Map<String, dynamic> siswa) {
    final data = Map<String, dynamic>.from(siswa);
    data['status'] = _normalizeStatus(data['status']);
    return data;
  }

  List<Map<String, dynamic>> get _filteredSiswa {
    return _siswaList.where((siswa) {
      final matchesStatus =
          _statusFilter == 'Semua' ||
          _normalizeStatus(siswa['status']) == _statusFilter;
      if (!matchesStatus) return false;

      if (_searchQuery.trim().isEmpty) return true;
      final q = _searchQuery.toLowerCase();
      return _val(siswa, 'nama').toLowerCase().contains(q) ||
          _val(siswa, 'nis').toLowerCase().contains(q) ||
          _val(siswa, 'nisn').toLowerCase().contains(q) ||
          _val(siswa, 'kelas').toLowerCase().contains(q);
    }).toList();
  }

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
      final data = List<Map<String, dynamic>>.from(
        result['data'] ?? const [],
      ).map(_normalizeSiswa).toList();
      setState(() {
        _siswaList = data;
        _isLoading = false;
        _isOfflineMode = result['_fromCache'] == true;
      });
      return;
    }

    if (result != null && result['data'] != null) {
      final data = List<Map<String, dynamic>>.from(
        result['data'] ?? const [],
      ).map(_normalizeSiswa).toList();
      setState(() {
        _siswaList = data;
        _isLoading = false;
        _isOfflineMode = true;
      });
      return;
    }

    setState(() {
      _errorMessage =
          'Tidak dapat memuat data siswa.\nHubungkan ke server terlebih dahulu agar data dapat tersimpan offline.';
      _isLoading = false;
    });
  }

  Future<void> _clearSiswaCache() async {
    await CacheService.delete('siswa_list');
  }

  void _showSnack(String message, {bool isError = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          content: Text(message),
          backgroundColor: isError
              ? const Color(0xFFE65100)
              : const Color(0xFF138F81),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
        ),
      );
  }

  Map<String, String> _toEditFormat(Map<String, dynamic> s) {
    return SiswaViewMapper.toDetailFormat(s);
  }

  Map<String, dynamic> _buildApiData(Map<String, String> r) {
    String clean(String? value) {
      final cleaned = value?.trim() ?? '';
      if (cleaned.isEmpty ||
          cleaned == '-' ||
          cleaned == '— Pilih —' ||
          cleaned == '-- Pilih --') {
        return '';
      }
      return cleaned;
    }

    String? nullableMaster(String? value) {
      final cleanValue = clean(value);
      return cleanValue.isEmpty ? null : cleanValue;
    }

    String? optionalText(String? value) {
      final cleanValue = clean(value);
      return cleanValue.isEmpty ? null : cleanValue;
    }

    String? normalizeWali(String? value) {
      final cleanValue = clean(value).toLowerCase();
      if (cleanValue == 'ayah') return 'Ayah';
      if (cleanValue == 'ibu') return 'Ibu';
      if (cleanValue == 'wali' ||
          cleanValue == 'lainnya' ||
          cleanValue == 'lain') {
        return 'Wali';
      }
      return null;
    }

    int? parseId(String? value) {
      final id = int.tryParse(clean(value));
      return id != null && id > 0 ? id : null;
    }

    String? convertDate(String? dateStr) {
      if (dateStr == null || dateStr.trim().isEmpty || dateStr == '-') {
        return null;
      }
      try {
        final parts = dateStr.split('-');
        if (parts.length == 3) {
          return '${parts[2]}-${parts[1]}-${parts[0]}';
        }
      } catch (_) {}
      return dateStr;
    }

    final provinceId = parseId(r['provinceId']);
    final cityId = parseId(r['cityId']);
    final districtId = parseId(r['districtId']);
    final villageId = parseId(r['villageId']);
    final schoolOriginId = parseId(r['schoolOriginId']);
    final previousSchoolOriginId = parseId(r['previousSchoolOriginId']);
    final classId = parseId(r['classId']);
    final boardingRoomId = parseId(r['boardingRoomId']);
    final waliSamaDengan = normalizeWali(r['waliSamaDengan']);
    final namaWali = waliSamaDengan == 'Ayah'
        ? optionalText(r['namaAyah'])
        : waliSamaDengan == 'Ibu'
        ? optionalText(r['namaIbu'])
        : optionalText(r['namaWali']);
    final telpWali = waliSamaDengan == 'Ayah'
        ? optionalText(r['noWhatsappAyah'])
        : waliSamaDengan == 'Ibu'
        ? optionalText(r['noWhatsappIbu'])
        : optionalText(r['telpWali']);
    final pekerjaanWali = waliSamaDengan == 'Ayah'
        ? nullableMaster(r['pekerjaanAyah'])
        : waliSamaDengan == 'Ibu'
        ? nullableMaster(r['pekerjaanIbu'])
        : nullableMaster(r['pekerjaanWali']);
    final alamatWali = (waliSamaDengan == 'Ayah' || waliSamaDengan == 'Ibu')
        ? optionalText(r['alamat'])
        : optionalText(r['alamatWali']);

    final payload = <String, dynamic>{
      'nis': clean(r['nis']),
      'nisn': optionalText(r['nisn']),
      'nama': clean(r['nama']),
      'nama_panggilan': optionalText(r['namaPanggilan']),
      'tempat_lahir': optionalText(r['tempatLahir']),
      'tanggal_lahir': convertDate(r['tglLahir']),
      'jenis_kelamin': r['jk'] == 'Laki-laki' ? 'L' : 'P',
      'nik': optionalText(r['nik']),
      'no_kk': optionalText(r['noKk']),
      'no_akta': optionalText(r['noAkta']),
      'dokumen_akta': optionalText(r['dokumenAkta']),
      'alamat': optionalText(r['alamat']),
      'kewarganegaraan': optionalText(r['kewarganegaraan']),
      'provinsi': provinceId != null ? clean(r['provinsi']) : '',
      'province_id': provinceId,
      'kota': cityId != null ? clean(r['kota']) : '',
      'city_id': cityId,
      'kecamatan': districtId != null ? clean(r['kecamatan']) : '',
      'district_id': districtId,
      'kelurahan': villageId != null ? clean(r['kelurahan']) : '',
      'village_id': villageId,
      'kode_pos': optionalText(r['kodePos']),
      'no_whatsapp': optionalText(r['noWhatsapp']),
      'email_siswa': optionalText(r['emailSiswa']),
      'asal_sekolah': schoolOriginId != null
          ? optionalText(r['asalSekolah'])
          : null,
      'school_origin_id': schoolOriginId,
      'previous_asal_sekolah': previousSchoolOriginId != null
          ? optionalText(r['previousAsalSekolah'])
          : null,
      'previous_school_origin_id': previousSchoolOriginId,
      'tahun_lulus': optionalText(r['tahunLulus']),
      'tahun_akademik_masuk': optionalText(r['tahunAkademikMasuk']),
      'tanggal_diterima_sekolah': convertDate(r['tanggalDiterimaSekolah']),
      'jenis_santri': nullableMaster(r['jenisSantri']),
      'kelas': classId != null ? clean(r['kelas']) : '',
      'class_id': classId,
      'status': r['status'] ?? 'Aktif',
      'nama_ayah': optionalText(r['namaAyah']),
      'nik_ayah': optionalText(r['nikAyah']),
      'tempat_lahir_ayah': optionalText(r['tempatLahirAyah']),
      'tanggal_lahir_ayah': convertDate(r['tglLahirAyah']),
      'no_whatsapp_ayah': optionalText(r['noWhatsappAyah']),
      'pekerjaan_ayah': nullableMaster(r['pekerjaanAyah']),
      'penghasilan_ayah': nullableMaster(r['penghasilanAyah']),
      'pendidikan_ayah': nullableMaster(r['pendidikanAyah']),
      'alamat_lengkap_ayah': optionalText(r['alamatLengkapAyah']),
      'alamat_ayah': optionalText(r['alamatLengkapAyah']),
      'nama_ibu': optionalText(r['namaIbu']),
      'nik_ibu': optionalText(r['nikIbu']),
      'tempat_lahir_ibu': optionalText(r['tempatLahirIbu']),
      'tanggal_lahir_ibu': convertDate(r['tglLahirIbu']),
      'no_whatsapp_ibu': optionalText(r['noWhatsappIbu']),
      'pekerjaan_ibu': nullableMaster(r['pekerjaanIbu']),
      'penghasilan_ibu': nullableMaster(r['penghasilanIbu']),
      'pendidikan_ibu': nullableMaster(r['pendidikanIbu']),
      'alamat_lengkap_ibu': optionalText(r['alamatLengkapIbu']),
      'alamat_ibu': optionalText(r['alamatLengkapIbu']),
      'no_ayah': optionalText(r['noAyah']),
      'no_ibu': optionalText(r['noIbu']),
      'nama_wali_keluarga': namaWali,
      'pekerjaan_wali_keluarga': pekerjaanWali,
      'alamat_wali_keluarga': alamatWali,
      'no_telepon_wali': telpWali,
      'wali_sama_dengan': waliSamaDengan,
      'tempat_tinggal': nullableMaster(r['tempatTinggal']),
      'status_mondok': optionalText(r['statusMondok']) ?? 'tidak_mondok',
      'boarding_room_id': boardingRoomId,
      'komplek': optionalText(r['komplek']),
      'kamar': optionalText(r['kamar']),
      'tanggal_diterima_pondok': r['statusMondok'] == 'mondok'
          ? convertDate(r['tanggalDiterimaPondok'])
          : null,
      'transportasi': nullableMaster(r['transportasi']),
      'tinggi_badan': optionalText(r['tinggiBadan']),
      'berat_badan': optionalText(r['beratBadan']),
      'golongan_darah': nullableMaster(r['golonganDarah']),
      'foto_santri': optionalText(r['fotoSantri']),
      'catatan_santri': optionalText(r['catatanSantri']),
    };

    payload.removeWhere((key, value) => value == '');
    return payload;
  }

  Future<Map<String, dynamic>> _buildApiDataWithUploads(
    Map<String, String> result,
  ) async {
    final prepared = Map<String, String>.from(result);
    final fotoPath = prepared['fotoSantri']?.trim() ?? '';
    if (fotoPath.isNotEmpty && await File(fotoPath).exists()) {
      final uploaded = await ApiService.uploadFile(fotoPath, 'foto_santri');
      prepared['fotoSantri'] = uploaded['path']?.toString() ?? '';
    }

    final aktaPath = prepared['dokumenAkta']?.trim() ?? '';
    if (aktaPath.isNotEmpty && await File(aktaPath).exists()) {
      final uploaded = await ApiService.uploadFile(aktaPath, 'dokumen_akta');
      prepared['dokumenAkta'] = uploaded['path']?.toString() ?? '';
    }

    return _buildApiData(prepared);
  }

  Future<void> _handleImportSiswa() async {
    if (_isOfflineMode) {
      _showSnack(
        'Mode offline hanya untuk melihat data. Sambungkan ke server untuk import siswa.',
        isError: true,
      );
      return;
    }

    try {
      final rows = await ExcelImportService.pickAndParseRows(
        ImportTemplateType.siswa,
      );
      if (rows.isEmpty) {
        _showSnack('Import dibatalkan atau file kosong.', isError: true);
        return;
      }

      final result = await ApiService.importSiswa(rows);
      await _clearSiswaCache();
      await _loadSiswa();
      _showImportSummary(result: result);
    } catch (e) {
      _showSnack('Gagal import data siswa: $e', isError: true);
    }
  }

  Future<void> _downloadTemplate() async {
    try {
      await ExcelImportService.shareTemplate(ImportTemplateType.siswa);
      _showSnack('Template Excel siswa berhasil dibuat.');
    } catch (e) {
      _showSnack('Gagal membuat template: $e', isError: true);
    }
  }

  void _showImportGuide() {
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text(
          'Petunjuk Import Siswa',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
        ),
        content: const Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Kolom wajib:'),
            SizedBox(height: 8),
            Text('nis, nama_lengkap_siswa, jenis_kelamin'),
            SizedBox(height: 12),
            Text('Kolom disarankan:'),
            SizedBox(height: 8),
            Text('nama_wali, status_siswa, kelompok_belajar'),
            SizedBox(height: 12),
            Text('Aturan penting:'),
            SizedBox(height: 6),
            Text('- NIS wajib unik'),
            Text('- jenis_kelamin isi L atau P'),
            Text('- status_siswa isi Aktif, Nonaktif, atau Lulus'),
            Text('- kelompok_belajar boleh dikosongkan jika belum ditentukan'),
            Text(
              '- kelompok_belajar harus sama dengan nama kelompok di master agar otomatis masuk kelompok',
            ),
            Text('- wilayah/jenis santri harus sesuai master jika diisi'),
            Text('- kolom lain boleh dilengkapi bertahap'),
            SizedBox(height: 12),
            Text(
              'Jika ada baris gagal, baris lain yang valid tetap akan diproses ke database.',
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Tutup'),
          ),
        ],
      ),
    );
  }

  void _showImportSummary({required Map<String, dynamic> result}) {
    final total = result['total_baris'] ?? 0;
    final success = result['berhasil'] ?? 0;
    final failed = result['gagal'] ?? 0;
    final errors = List<Map<String, dynamic>>.from(
      result['errors'] ?? const [],
    );

    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text(
          'Hasil Import Siswa',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
        ),
        content: SizedBox(
          width: double.maxFinite,
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('Total baris: $total'),
                Text('Berhasil: $success'),
                Text('Gagal: $failed'),
                if (errors.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  const Text(
                    'Detail baris gagal:',
                    style: TextStyle(fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 8),
                  ...errors.map((error) {
                    final alasan = error['alasan'] is List
                        ? (error['alasan'] as List).join(', ')
                        : error['alasan']?.toString() ?? '-';
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Text(
                        'Baris ${error['row']}: $alasan',
                        style: const TextStyle(
                          fontSize: 12,
                          color: Color(0xFF636E72),
                        ),
                      ),
                    );
                  }),
                ],
              ],
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Tutup'),
          ),
        ],
      ),
    );
  }

  void _toggleSelectionMode([bool value = true]) {
    setState(() {
      _isSelectionMode = value;
      _expandedIndex = null;
      if (!value) {
        _selectedIds.clear();
      }
    });
  }

  void _selectAllFilteredSiswa() {
    final ids = _filteredSiswa
        .map(_siswaId)
        .where((id) => id > 0)
        .toSet();
    if (ids.isEmpty) {
      _showSnack('Tidak ada siswa pada filter ini.', isError: true);
      return;
    }
    setState(() {
      _isSelectionMode = true;
      _expandedIndex = null;
      _selectedIds
        ..clear()
        ..addAll(ids);
    });
  }

  void _clearSelection() {
    setState(() => _selectedIds.clear());
  }

  void _toggleStudentSelection(Map<String, dynamic> siswa) {
    final id = _siswaId(siswa);
    if (id <= 0) return;
    setState(() {
      if (_selectedIds.contains(id)) {
        _selectedIds.remove(id);
      } else {
        _selectedIds.add(id);
      }
    });
  }

  Future<void> _handleTambahSiswa() async {
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
      'provinceId': '',
      'kota': '',
      'cityId': '',
      'kecamatan': '',
      'districtId': '',
      'kelurahan': '',
      'villageId': '',
      'kodePos': '',
      'noWhatsapp': '',
      'emailSiswa': '',
      'asalSekolah': '',
      'schoolOriginId': '',
      'previousAsalSekolah': '',
      'previousSchoolOriginId': '',
      'tahunLulus': '',
      'tahunAkademikMasuk': '',
      'jenisSantri': '',
      'kelas': '',
      'classId': '',
      'boardingRoomId': '',
      'komplek': '',
      'kamar': '',
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

    if (result == null || result is! Map<String, String>) return;

    if ((result['nama'] ?? '').trim().isEmpty) {
      _showSnack('Nama siswa wajib diisi.', isError: true);
      return;
    }

    try {
      final apiData = await _buildApiDataWithUploads(result);
      await ApiService.createSiswa(apiData);
      await _clearSiswaCache();
      await _loadSiswa();
      await SyncService.notifyDataChanged(
        SyncTopics.siswa,
        message: 'Data santri berhasil ditambahkan',
      );
      if (!mounted) return;
      AppSuccessOverlay.show(
        context,
        'Data ${result['nama']} berhasil ditambahkan',
      );
    } catch (e) {
      _showSnack('Gagal menyimpan data siswa: $e', isError: true);
    }
  }

  Future<void> _handleEditData(Map<String, dynamic> siswa) async {
    setState(() => _expandedIndex = null);
    final result = await Navigator.push(
      context,
      PageRouteBuilder(
        pageBuilder: (context, animation, _) =>
            EditSiswaScreen(siswa: _toEditFormat(siswa)),
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

    if (result == null || result is! Map<String, String>) return;

    try {
      final id = _siswaId(siswa);
      await ApiService.updateSiswa(id, await _buildApiDataWithUploads(result));
      await _clearSiswaCache();
      await _loadSiswa();
      await SyncService.notifyDataChanged(
        SyncTopics.siswa,
        message: 'Data santri berhasil diperbarui',
      );
      if (!mounted) return;
      AppSuccessOverlay.show(
        context,
        'Data ${result['nama']} berhasil diperbarui',
      );
    } catch (e) {
      _showSnack('Gagal memperbarui data siswa: $e', isError: true);
    }
  }

  Future<void> _handleDetail(Map<String, dynamic> siswa) async {
    setState(() => _expandedIndex = null);
    await Navigator.push(
      context,
      PageRouteBuilder(
        pageBuilder: (context, animation, _) =>
            DetailSiswaScreen(siswa: _toEditFormat(siswa)),
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

  Future<void> _handleHapus(Map<String, dynamic> siswa) async {
    setState(() => _expandedIndex = null);
    final confirmed = await showDialog<bool>(
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
        content: Text(
          'Apakah Anda yakin ingin menghapus data "${siswa['nama']}"?',
          style: const TextStyle(fontSize: 13),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Batal'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFE65100),
              foregroundColor: Colors.white,
            ),
            child: const Text('Ya, Hapus'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    try {
      await ApiService.deleteSiswa(_siswaId(siswa));
      await _clearSiswaCache();
      await _loadSiswa();
      _showSnack('Data ${siswa['nama']} berhasil dihapus.');
    } catch (e) {
      _showSnack('Gagal menghapus siswa: $e', isError: true);
    }
  }

  Future<void> _applySingleStatus(
    Map<String, dynamic> siswa,
    String newStatus,
  ) async {
    if (_isOfflineMode) {
      _showSnack(
        'Mode offline hanya untuk melihat data. Sambungkan ke server untuk mengubah status siswa.',
        isError: true,
      );
      return;
    }

    final id = _siswaId(siswa);
    final oldStatus = _normalizeStatus(siswa['status']);
    if (id <= 0 || oldStatus == newStatus) return;

    setState(() {
      _pendingStatusIds.add(id);
      _expandedIndex = null;
      _siswaList = _siswaList.map((item) {
        return _siswaId(item) == id ? {...item, 'status': newStatus} : item;
      }).toList();
    });

    try {
      await ApiService.updateSiswa(id, {'status': newStatus});
      await _clearSiswaCache();
      _showSnack('Status ${siswa['nama']} → $newStatus');
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _siswaList = _siswaList.map((item) {
          return _siswaId(item) == id ? {...item, 'status': oldStatus} : item;
        }).toList();
      });
      _showSnack('Gagal mengubah status siswa: $e', isError: true);
    } finally {
      if (mounted) {
        setState(() => _pendingStatusIds.remove(id));
      }
    }
  }

  void _showStatusSheet(Map<String, dynamic> siswa) {
    setState(() => _expandedIndex = null);
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => AdaptiveBottomSheet(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 42,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.grey[400],
                borderRadius: BorderRadius.circular(4),
              ),
            ),
            const SizedBox(height: 16),
            Text(
              'Ubah Status ${siswa['nama']}',
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: Color(0xFF2D3436),
              ),
            ),
            const SizedBox(height: 14),
            ...['Aktif', 'Nonaktif', 'Lulus'].map((status) {
              return _buildSheetAction(
                icon: _statusIcon(status),
                color: _statusColor(status),
                title: 'Set $status',
                subtitle: 'Pindahkan data siswa ke kategori $status.',
                onTap: () {
                  Navigator.pop(ctx);
                  _applySingleStatus(siswa, status);
                },
              );
            }),
          ],
        ),
      ),
    );
  }

  Future<void> _confirmBulkStatus(String status) async {
    if (_selectedIds.isEmpty) {
      _showSnack('Pilih siswa terlebih dahulu.', isError: true);
      return;
    }

    if (_isOfflineMode) {
      _showSnack(
        'Mode offline hanya untuk melihat data. Sambungkan ke server untuk aksi massal.',
        isError: true,
      );
      return;
    }

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(
          children: [
            Icon(_statusIcon(status), color: _statusColor(status)),
            const SizedBox(width: 8),
            Text(
              'Set $status',
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
            ),
          ],
        ),
        content: Text(
          'Ubah ${_selectedIds.length} siswa terpilih menjadi $status?',
          style: const TextStyle(fontSize: 13),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Batal'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: _statusColor(status),
              foregroundColor: Colors.white,
            ),
            child: const Text('Lanjutkan'),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      await _applyBulkStatus(status);
    }
  }

  Future<void> _applyBulkStatus(String status) async {
    final ids = _selectedIds.toList();
    final oldStatus = <int, String>{};
    for (final siswa in _siswaList) {
      final id = _siswaId(siswa);
      if (ids.contains(id)) {
        oldStatus[id] = _normalizeStatus(siswa['status']);
      }
    }

    setState(() {
      _isBulkUpdating = true;
      _pendingStatusIds.addAll(ids);
      _siswaList = _siswaList.map((item) {
        final id = _siswaId(item);
        return ids.contains(id) ? {...item, 'status': status} : item;
      }).toList();
    });

    try {
      await ApiService.bulkUpdateSiswaStatus(ids: ids, status: status);
      await _clearSiswaCache();
      if (!mounted) return;
      setState(() {
        _isBulkUpdating = false;
        _pendingStatusIds.removeAll(ids);
        _selectedIds.clear();
        _isSelectionMode = false;
      });
      _showSnack('${ids.length} siswa berhasil diubah ke $status.');
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isBulkUpdating = false;
        _pendingStatusIds.removeAll(ids);
        _siswaList = _siswaList.map((item) {
          final id = _siswaId(item);
          if (!oldStatus.containsKey(id)) return item;
          return {...item, 'status': oldStatus[id]};
        }).toList();
      });
      _showSnack('Gagal mengubah status massal: $e', isError: true);
    }
  }

  void _showQuickActions() {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => AdaptiveBottomSheet(
        maxHeightFactor: 0.84,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 42,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.grey[400],
                borderRadius: BorderRadius.circular(4),
              ),
            ),
            const SizedBox(height: 16),
            const Text(
              'Kelola Data Siswa/Santri',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: Color(0xFF2D3436),
              ),
            ),
            const SizedBox(height: 14),
            _buildSheetAction(
              icon: Icons.person_add_alt_1_rounded,
              color: const Color(0xFF138F81),
              title: 'Tambah Siswa Baru',
              subtitle: 'Input data siswa satu per satu seperti biasa.',
              onTap: () {
                Navigator.pop(ctx);
                _handleTambahSiswa();
              },
            ),
            _buildSheetAction(
              icon: Icons.done_all_rounded,
              color: const Color(0xFF2E86DE),
              title: 'Pilih Banyak Siswa',
              subtitle: 'Aktifkan mode multi-select untuk aksi status massal.',
              onTap: () {
                Navigator.pop(ctx);
                _toggleSelectionMode(true);
              },
            ),
            _buildSheetAction(
              icon: Icons.file_upload_rounded,
              color: const Color(0xFF6C5CE7),
              title: 'Import Excel',
              subtitle: 'Masukkan banyak data siswa sekaligus dari template.',
              onTap: () {
                Navigator.pop(ctx);
                _handleImportSiswa();
              },
            ),
            _buildSheetAction(
              icon: Icons.download_rounded,
              color: const Color(0xFFF39C12),
              title: 'Download Template',
              subtitle: 'Ambil template Excel import siswa terbaru.',
              onTap: () {
                Navigator.pop(ctx);
                _downloadTemplate();
              },
            ),
            _buildSheetAction(
              icon: Icons.info_outline_rounded,
              color: const Color(0xFFE65100),
              title: 'Petunjuk Import',
              subtitle: 'Lihat format kolom dan aturan import siswa.',
              onTap: () {
                Navigator.pop(ctx);
                _showImportGuide();
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSheetAction({
    required IconData icon,
    required Color color,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
  }) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(18),
        child: Container(
          width: double.infinity,
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(18),
          ),
          child: Row(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(icon, color: color, size: 22),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF2D3436),
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      style: const TextStyle(
                        fontSize: 10,
                        color: Color(0xFF636E72),
                        height: 1.4,
                      ),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right_rounded, color: Color(0xFF636E72)),
            ],
          ),
        ),
      ),
    );
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'Lulus':
        return const Color(0xFF2E86DE);
      case 'Nonaktif':
        return const Color(0xFFE65100);
      case 'Aktif':
      default:
        return const Color(0xFF138F81);
    }
  }

  IconData _statusIcon(String status) {
    switch (status) {
      case 'Lulus':
        return Icons.school_rounded;
      case 'Nonaktif':
        return Icons.pause_circle_filled_rounded;
      case 'Aktif':
      default:
        return Icons.check_circle_rounded;
    }
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
            const Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Data Siswa/Santri',
                    style: TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF2D3436),
                    ),
                  ),
                  Text(
                    'Buku Induk → Data Siswa/Santri',
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

  Widget _buildStatusFilterBar() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: _statusFilters.map((status) {
            final selected = _statusFilter == status;
            final color = status == 'Semua'
                ? const Color(0xFF636E72)
                : _statusColor(status);
            return Padding(
              padding: const EdgeInsets.only(right: 8),
              child: ChoiceChip(
                label: Text(status),
                selected: selected,
                onSelected: (_) => setState(() => _statusFilter = status),
                labelStyle: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: selected ? Colors.white : color,
                ),
                selectedColor: color,
                backgroundColor: color.withValues(alpha: 0.10),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(99),
                  side: BorderSide(color: color.withValues(alpha: 0.25)),
                ),
              ),
            );
          }).toList(),
        ),
      ),
    );
  }

  Widget _buildSelectionBanner() {
    final hasSelection = _selectedIds.isNotEmpty;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: const Color(0xFFE1EFF7),
          borderRadius: BorderRadius.circular(20),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(
                    color: const Color(0xFF2E86DE).withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(11),
                  ),
                  child: const Icon(
                    Icons.done_all_rounded,
                    color: Color(0xFF2E86DE),
                    size: 18,
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        hasSelection
                            ? '${_selectedIds.length} siswa dipilih'
                            : 'Mode pilih banyak aktif',
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF2D3436),
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        hasSelection
                            ? 'Pilih status baru tanpa menutup daftar siswa.'
                            : 'Sentuh card siswa untuk memilih beberapa data sekaligus.',
                        style: const TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w500,
                          color: Color(0xFF636E72),
                          height: 1.35,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                TextButton.icon(
                  onPressed: _isBulkUpdating
                      ? null
                      : () => _toggleSelectionMode(false),
                  icon: const Icon(Icons.close_rounded, size: 16),
                  label: const Text('Selesai'),
                  style: TextButton.styleFrom(
                    foregroundColor: const Color(0xFF138F81),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 8,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  OutlinedButton.icon(
                    onPressed: _isBulkUpdating ? null : _selectAllFilteredSiswa,
                    icon: const Icon(Icons.select_all_rounded, size: 16),
                    label: const Text('Pilih Semua Siswa'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: const Color(0xFF138F81),
                      side: const BorderSide(color: Color(0xFF138F81)),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 10,
                      ),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  OutlinedButton.icon(
                    onPressed: _isBulkUpdating || _selectedIds.isEmpty
                        ? null
                        : _clearSelection,
                    icon: const Icon(Icons.playlist_remove_rounded, size: 16),
                    label: const Text('Bersihkan'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: const Color(0xFFE65100),
                      side: const BorderSide(color: Color(0xFFE65100)),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 10,
                      ),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  _buildCompactBulkButton('Aktif'),
                  const SizedBox(width: 8),
                  _buildCompactBulkButton('Nonaktif'),
                  const SizedBox(width: 8),
                  _buildCompactBulkButton('Lulus'),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCompactBulkButton(String status) {
    final color = _statusColor(status);
    return FilledButton.icon(
      onPressed: _isBulkUpdating ? null : () => _confirmBulkStatus(status),
      icon: _isBulkUpdating
          ? const SizedBox(
              width: 14,
              height: 14,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: Colors.white,
              ),
            )
          : Icon(_statusIcon(status), size: 16),
      label: Text(
        status,
        style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700),
      ),
      style: FilledButton.styleFrom(
        backgroundColor: color,
        foregroundColor: Colors.white,
        minimumSize: const Size(0, 40),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
    );
  }

  Widget _buildCountRow(List<Map<String, dynamic>> filtered) {
    int countByStatus(String status) {
      return filtered
          .where((s) => _normalizeStatus(s['status']) == status)
          .length;
    }

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Row(
        children: [
          Expanded(
            child: Text(
              '${filtered.length} Siswa Ditemukan',
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: Color(0xFF636E72),
              ),
            ),
          ),
          _buildFilterChip('A', countByStatus('Aktif'), _statusColor('Aktif')),
          const SizedBox(width: 6),
          _buildFilterChip(
            'N',
            countByStatus('Nonaktif'),
            _statusColor('Nonaktif'),
          ),
          const SizedBox(width: 6),
          _buildFilterChip('L', countByStatus('Lulus'), _statusColor('Lulus')),
        ],
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

  Widget _buildOfflineBanner() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: const Color(0xFFFFF3E0),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFFFB74D)),
        ),
        child: const Row(
          children: [
            Icon(Icons.wifi_off_rounded, size: 16, color: Color(0xFFE65100)),
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
    );
  }

  Widget _buildSiswaCard(Map<String, dynamic> siswa, int index) {
    final id = _siswaId(siswa);
    final isExpanded = _expandedIndex == index;
    final isMale = siswa['jenis_kelamin'] == 'L';
    final status = _normalizeStatus(siswa['status']);
    final statusColor = _statusColor(status);
    final cardColor = isMale
        ? const Color(0xFF2E86DE)
        : const Color(0xFFE65100);
    final kelas = _val(siswa, 'kelas', '');
    final isSelected = _selectedIds.contains(id);
    final isPending = _pendingStatusIds.contains(id);

    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0.0, end: 1.0),
      duration: Duration(milliseconds: 350 + (index * 40)),
      curve: Curves.easeOutCubic,
      builder: (context, value, child) {
        return Transform.translate(
          offset: Offset(0, 18 * (1 - value)),
          child: Opacity(opacity: value, child: child),
        );
      },
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: isSelected
              ? Border.all(color: const Color(0xFF2E86DE), width: 1.4)
              : null,
        ),
        child: Column(
          children: [
            InkWell(
              borderRadius: BorderRadius.circular(20),
              onTap: () {
                if (_isSelectionMode) {
                  _toggleStudentSelection(siswa);
                  return;
                }
                setState(() {
                  _expandedIndex = isExpanded ? null : index;
                });
              },
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Row(
                  children: [
                    if (_isSelectionMode) ...[
                      GestureDetector(
                        onTap: () => _toggleStudentSelection(siswa),
                        child: Container(
                          width: 24,
                          height: 24,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: isSelected
                                ? const Color(0xFF2E86DE)
                                : const Color(0xFFE1EFF7),
                            border: Border.all(
                              color: isSelected
                                  ? const Color(0xFF2E86DE)
                                  : const Color(0xFFB2BEC3),
                            ),
                          ),
                          child: Icon(
                            isSelected
                                ? Icons.check_rounded
                                : Icons.circle_outlined,
                            size: 14,
                            color: isSelected
                                ? Colors.white
                                : const Color(0xFF95A5A6),
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                    ],
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
                          Wrap(
                            spacing: 4,
                            runSpacing: 4,
                            children: [
                              _buildInlinePill(
                                'NIS: ${_val(siswa, 'nis')}',
                                cardColor,
                              ),
                              _buildInlinePill(status, statusColor),
                              if (kelas.isNotEmpty)
                                _buildInlinePill(
                                  kelas,
                                  const Color(0xFF6C5CE7),
                                ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    if (isPending)
                      const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Color(0xFF138F81),
                        ),
                      )
                    else if (!_isSelectionMode)
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
            if (!_isSelectionMode)
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
                                _buildDetailRow(
                                  'Kelas',
                                  kelas.isEmpty ? '-' : kelas,
                                ),
                                _buildDetailRow('Status', status),
                                _buildDetailRow(
                                  'Kamar Pondok',
                                  [
                                            _val(siswa, 'komplek', ''),
                                            _val(siswa, 'kamar', ''),
                                          ]
                                          .where((v) => v.trim().isNotEmpty)
                                          .join(' - ')
                                          .isEmpty
                                      ? '-'
                                      : [
                                              _val(siswa, 'komplek', ''),
                                              _val(siswa, 'kamar', ''),
                                            ]
                                            .where((v) => v.trim().isNotEmpty)
                                            .join(' - '),
                                ),
                                _buildDetailRow(
                                  'Telp. Wali',
                                  _val(siswa, 'no_telepon_wali'),
                                ),
                              ],
                            ),
                          ),
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
                                  'Status',
                                  Icons.toggle_on_rounded,
                                  const Color(0xFFF39C12),
                                  () => _showStatusSheet(siswa),
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

  Widget _buildInlinePill(String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 8,
          fontWeight: FontWeight.w700,
          color: color,
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

  @override
  Widget build(BuildContext context) {
    final filtered = _filteredSiswa;

    return Scaffold(
      backgroundColor: const Color(0xFFFFDC80),
      floatingActionButton: _isSelectionMode
          ? null
          : FloatingActionButton(
              onPressed: _showQuickActions,
              backgroundColor: const Color(0xFF138F81),
              child: const Icon(Icons.person_add_rounded, color: Colors.white),
            ),
      body: SafeArea(
        child: FadeTransition(
          opacity: _fadeIn,
          child: Column(
            children: [
              _buildProfileBar(),
              const SizedBox(height: 12),
              _buildSearchBar(),
              const SizedBox(height: 8),
              _buildStatusFilterBar(),
              const SizedBox(height: 8),
              if (_isOfflineMode) ...[
                _buildOfflineBanner(),
                const SizedBox(height: 8),
              ],
              if (_isSelectionMode) ...[
                _buildSelectionBanner(),
                const SizedBox(height: 8),
              ],
              if (_isLoading)
                const Expanded(
                  child: Center(
                    child: CircularProgressIndicator(color: Color(0xFF138F81)),
                  ),
                )
              else if (_errorMessage != null)
                Expanded(
                  child: Center(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 24),
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
                  ),
                )
              else ...[
                _buildCountRow(filtered),
                const SizedBox(height: 8),
                Expanded(
                  child: AppRefreshIndicator(
                    onRefresh: _loadSiswa,
                    child: AppResponsive(
                      child: ListView.builder(
                        physics: const AlwaysScrollableScrollPhysics(
                          parent: BouncingScrollPhysics(),
                        ),
                        padding: EdgeInsets.fromLTRB(
                          AppResponsive.pageMargin(context),
                          0,
                          AppResponsive.pageMargin(context),
                          MediaQuery.of(context).viewPadding.bottom + 96,
                        ),
                        itemCount: filtered.length,
                        itemBuilder: (context, index) {
                          return _buildSiswaCard(filtered[index], index);
                        },
                      ),
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
}
