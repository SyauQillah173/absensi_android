import 'dart:async';
import 'dart:io';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';
import 'package:share_plus/share_plus.dart';

import '../../services/api_service.dart';
import '../../services/sync_service.dart';
import '../../widgets/responsive_layout.dart';

class EditSiswaScreen extends StatefulWidget {
  final Map<String, String> siswa;

  const EditSiswaScreen({super.key, required this.siswa});

  @override
  State<EditSiswaScreen> createState() => _EditSiswaScreenState();
}

class _EditSiswaScreenState extends State<EditSiswaScreen> {
  final _formKey = GlobalKey<FormState>();
  late final Map<String, TextEditingController> _c;

  // Dropdown values
  String _selectedJK = 'Laki-laki';
  String _jenisSantri = '';
  String _tempatTinggal = '';
  String _transportasi = '';
  String _golonganDarah = '';
  String _waliSamaDengan = '';
  String _statusMondok = 'tidak_mondok';

  // File paths
  String? _dokumenAktaPath;
  String? _fotoSantriPath;
  File? _dokumenAktaFile;
  File? _fotoSantriFile;

  // Wilayah data
  List<Map<String, dynamic>> _provinsiList = [];
  List<Map<String, dynamic>> _kotaList = [];
  List<Map<String, dynamic>> _kecamatanList = [];
  List<Map<String, dynamic>> _kelurahanList = [];
  List<Map<String, dynamic>> _schoolOriginList = [];
  List<Map<String, dynamic>> _classList = [];
  String? _selectedProvinsiId;
  String? _selectedKotaId;
  String? _selectedKecamatanId;
  String? _selectedKelurahanId;
  String? _selectedPreviousSchoolOriginId;
  String? _selectedSchoolOriginId;
  String? _selectedClassId;

  final List<String> _jkOptions = ['Laki-laki', 'Perempuan'];
  final List<String> _jenisSantriOptions = [
    '',
    'Santri Madin',
    'Santri Pondok',
    'Keduanya',
  ];
  static const Set<String> _allowedStudentTypeNames = {
    'Santri Madin',
    'Santri Pondok',
    'Keduanya',
  };
  static const Map<String, String> _knownOfficialCities = {
    'gresik': 'Kabupaten Gresik',
  };
  final List<String> _tempatTinggalOptions = [
    '',
    'Bersama Orang Tua',
    'Bersama Wali',
    'Pondok Pesantren',
    'Lainnya',
  ];
  final List<String> _transportasiOptions = [
    '',
    'Jalan Kaki',
    'Sepeda',
    'Motor',
    'Mobil',
    'Angkutan Umum',
  ];
  final List<String> _golonganDarahOptions = [
    '',
    'A',
    'B',
    'AB',
    'O',
    'Tidak Tahu',
  ];
  final List<String> _statusMondokOptions = ['tidak_mondok', 'mondok'];
  static const Map<String, String> _statusMondokLabels = {
    'mondok': 'Mondok',
    'tidak_mondok': 'Tidak Mondok',
  };
  final List<String> _pekerjaanAyahOptions = [
    '',
    'Petani',
    'Nelayan',
    'Pedagang',
    'Karyawan',
    'Wiraswasta',
    'PNS',
    'Guru',
    'Lainnya',
  ];
  final List<String> _pekerjaanIbuOptions = [
    '',
    'Petani',
    'Nelayan',
    'Pedagang',
    'Karyawan',
    'Wiraswasta',
    'PNS',
    'Guru',
    'Ibu Rumah Tangga',
    'Lainnya',
  ];
  final List<String> _pekerjaanWaliOptions = [
    '',
    'Petani',
    'Nelayan',
    'Pedagang',
    'Karyawan',
    'Wiraswasta',
    'PNS',
    'Guru',
    'Ibu Rumah Tangga',
    'Lainnya',
  ];
  final List<String> _penghasilanOptions = [
    '',
    '< Rp 1.000.000',
    'Rp 1.000.000 - Rp 3.000.000',
    'Rp 3.000.000 - Rp 5.000.000',
    '> Rp 5.000.000',
    'Lainnya',
  ];
  final List<String> _pendidikanOptions = [
    '',
    'SD/MI',
    'SMP/MTs',
    'SMA/MA',
    'Diploma',
    'S1',
    'S2',
    'S3',
  ];

  @override
  void initState() {
    super.initState();
    final s = widget.siswa;
    _selectedJK = s['jk'] ?? 'Laki-laki';
    _jenisSantri = s['jenisSantri'] ?? '';
    _tempatTinggal = s['tempatTinggal'] ?? '';
    _transportasi = s['transportasi'] ?? '';
    _golonganDarah = s['golonganDarah'] ?? '';
    _waliSamaDengan = _normalizeWaliSamaDengan(s['waliSamaDengan']);
    _statusMondok = _normalizeStatusMondok(
      s['statusMondok'] ?? s['status_mondok'],
    );
    _selectedProvinsiId = _nonEmpty(s['provinceId']);
    _selectedKotaId = _nonEmpty(s['cityId']);
    _selectedKecamatanId = _nonEmpty(s['districtId']);
    _selectedKelurahanId = _nonEmpty(s['villageId']);
    _selectedPreviousSchoolOriginId = _nonEmpty(s['previousSchoolOriginId']);
    _selectedSchoolOriginId = _nonEmpty(s['schoolOriginId']);
    _selectedClassId = _nonEmpty(s['classId']);
    _dokumenAktaPath = (s['dokumenAkta']?.isNotEmpty == true)
        ? s['dokumenAkta']
        : null;
    _fotoSantriPath = (s['fotoSantri']?.isNotEmpty == true)
        ? s['fotoSantri']
        : null;

    _c = {
      // Data Santri
      'nis': TextEditingController(text: s['nis'] ?? ''),
      'nisn': TextEditingController(text: s['nisn'] ?? ''),
      'nama': TextEditingController(text: s['nama'] ?? ''),
      'namaPanggilan': TextEditingController(text: s['namaPanggilan'] ?? ''),
      'tempatLahir': TextEditingController(text: s['tempatLahir'] ?? ''),
      'tglLahir': TextEditingController(text: s['tglLahir'] ?? ''),
      'nik': TextEditingController(text: s['nik'] ?? ''),
      'noKk': TextEditingController(text: s['noKk'] ?? ''),
      'noAkta': TextEditingController(text: s['noAkta'] ?? ''),
      'alamat': TextEditingController(text: s['alamat'] ?? ''),
      'kewarganegaraan': TextEditingController(
        text: s['kewarganegaraan'] ?? 'Indonesia',
      ),
      'provinsi': TextEditingController(text: s['provinsi'] ?? ''),
      'kota': TextEditingController(text: s['kota'] ?? ''),
      'kecamatan': TextEditingController(text: s['kecamatan'] ?? ''),
      'kelurahan': TextEditingController(text: s['kelurahan'] ?? ''),
      'kodePos': TextEditingController(text: s['kodePos'] ?? ''),
      'noWhatsapp': TextEditingController(text: s['noWhatsapp'] ?? ''),
      'emailSiswa': TextEditingController(text: s['emailSiswa'] ?? ''),
      'previousAsalSekolah': TextEditingController(
        text: s['previousAsalSekolah'] ?? '',
      ),
      'asalSekolah': TextEditingController(text: s['asalSekolah'] ?? ''),
      'tahunLulus': TextEditingController(text: s['tahunLulus'] ?? ''),
      'tahunAkademikMasuk': TextEditingController(
        text: s['tahunAkademikMasuk'] ?? '',
      ),
      'tanggalDiterimaSekolah': TextEditingController(
        text: s['tanggalDiterimaSekolah'] ?? '',
      ),
      // Data Orang Tua
      'namaAyah': TextEditingController(text: s['namaAyah'] ?? ''),
      'nikAyah': TextEditingController(text: s['nikAyah'] ?? ''),
      'tempatLahirAyah': TextEditingController(
        text: s['tempatLahirAyah'] ?? '',
      ),
      'tglLahirAyah': TextEditingController(text: s['tglLahirAyah'] ?? ''),
      'noWhatsappAyah': TextEditingController(text: s['noWhatsappAyah'] ?? ''),
      'pekerjaanAyah': TextEditingController(text: s['pekerjaanAyah'] ?? ''),
      'penghasilanAyah': TextEditingController(
        text: s['penghasilanAyah'] ?? '',
      ),
      'pendidikanAyah': TextEditingController(text: s['pendidikanAyah'] ?? ''),
      'alamatLengkapAyah': TextEditingController(
        text: s['alamatLengkapAyah'] ?? s['alamatAyah'] ?? '',
      ),
      'namaIbu': TextEditingController(text: s['namaIbu'] ?? ''),
      'nikIbu': TextEditingController(text: s['nikIbu'] ?? ''),
      'tempatLahirIbu': TextEditingController(text: s['tempatLahirIbu'] ?? ''),
      'tglLahirIbu': TextEditingController(text: s['tglLahirIbu'] ?? ''),
      'noWhatsappIbu': TextEditingController(text: s['noWhatsappIbu'] ?? ''),
      'pekerjaanIbu': TextEditingController(text: s['pekerjaanIbu'] ?? ''),
      'penghasilanIbu': TextEditingController(text: s['penghasilanIbu'] ?? ''),
      'pendidikanIbu': TextEditingController(text: s['pendidikanIbu'] ?? ''),
      'alamatLengkapIbu': TextEditingController(
        text: s['alamatLengkapIbu'] ?? s['alamatIbu'] ?? '',
      ),
      'namaWali': TextEditingController(text: s['namaWali'] ?? ''),
      'pekerjaanWali': TextEditingController(text: s['pekerjaanWali'] ?? ''),
      'alamatWali': TextEditingController(text: s['alamatWali'] ?? ''),
      'telpWali': TextEditingController(text: s['telpWali'] ?? ''),
      // Data Profil
      'tinggiBadan': TextEditingController(text: s['tinggiBadan'] ?? ''),
      'beratBadan': TextEditingController(text: s['beratBadan'] ?? ''),
      'catatanSantri': TextEditingController(text: s['catatanSantri'] ?? ''),
      'tanggalDiterimaPondok': TextEditingController(
        text: s['tanggalDiterimaPondok'] ?? '',
      ),
      'boardingRoomId': TextEditingController(text: s['boardingRoomId'] ?? ''),
      'komplek': TextEditingController(text: s['komplek'] ?? ''),
      'kamar': TextEditingController(text: s['kamar'] ?? ''),
      // Kelas (legacy)
      'kelas': TextEditingController(text: s['kelas'] ?? ''),
    };

    _hydrateBirthPlaceControllers();
    _loadInitialWilayah();
    _loadSchoolOrigins();
    _loadClasses();
    _loadMasterOptions();
  }

  @override
  void dispose() {
    for (final c in _c.values) {
      c.dispose();
    }
    super.dispose();
  }

  String? _nonEmpty(String? value) {
    final clean = value?.trim() ?? '';
    return clean.isEmpty || clean == '-' ? null : clean;
  }

  String _normalizeWaliSamaDengan(String? value) {
    final clean = value?.trim().toLowerCase() ?? '';
    if (clean == 'ayah') return 'Ayah';
    if (clean == 'ibu') return 'Ibu';
    if (clean == 'wali' || clean == 'lainnya' || clean == 'lain') {
      return 'Wali';
    }
    return '';
  }

  String _normalizeStatusMondok(String? value) {
    final clean = value?.trim().toLowerCase() ?? '';
    if (clean.contains('mondok') && !clean.contains('tidak')) return 'mondok';
    return 'tidak_mondok';
  }

  List<Map<String, dynamic>> _dataList(Map<String, dynamic> result) {
    final data = result['data'];
    if (data is! List) return [];
    return data
        .whereType<Map>()
        .map((item) => Map<String, dynamic>.from(item))
        .toList();
  }

  Future<void> _loadInitialWilayah() async {
    await _loadProvinsi();
    if (_selectedProvinsiId != null) await _loadKota(_selectedProvinsiId!);
    if (_selectedKotaId != null) await _loadKecamatan(_selectedKotaId!);
    if (_selectedKecamatanId != null) {
      await _loadKelurahan(_selectedKecamatanId!);
    }
  }

  // ===== WILAYAH API BACKEND =====
  Future<void> _loadProvinsi() async {
    try {
      final result = await ApiService.getProvinces();
      if (!mounted) return;
      setState(() => _provinsiList = _dataList(result));
    } catch (_) {}
  }

  Future<void> _loadKota(String provinsiId) async {
    try {
      final result = await ApiService.getCities(
        provinceId: int.tryParse(provinsiId),
      );
      if (!mounted) return;
      setState(() {
        _kotaList = _dataList(result);
        _kecamatanList = [];
        _kelurahanList = [];
      });
    } catch (_) {}
  }

  Future<void> _loadKecamatan(String kotaId) async {
    try {
      final result = await ApiService.getDistricts(
        cityId: int.tryParse(kotaId),
      );
      if (!mounted) return;
      setState(() {
        _kecamatanList = _dataList(result);
        _kelurahanList = [];
      });
    } catch (_) {}
  }

  Future<void> _loadKelurahan(String kecamatanId) async {
    try {
      final result = await ApiService.getVillages(
        districtId: int.tryParse(kecamatanId),
      );
      if (!mounted) return;
      setState(() => _kelurahanList = _dataList(result));
    } catch (_) {}
  }

  Future<void> _loadSchoolOrigins({String? search}) async {
    try {
      final result = await ApiService.getSchoolOrigins(
        search: search,
        limit: 1000,
      );
      if (!mounted) return;
      setState(() => _schoolOriginList = _dataList(result));
    } catch (_) {}
  }

  Future<void> _loadClasses() async {
    try {
      final result = await ApiService.getClasses();
      if (!mounted) return;
      setState(() => _classList = _dataList(result));
    } catch (_) {}
  }

  Future<void> _loadMasterOptions() async {
    try {
      final results = await Future.wait([
        ApiService.getReferenceMaster('student_types'),
        ApiService.getReferenceMaster('residence_types'),
        ApiService.getReferenceMaster('transport_modes'),
        ApiService.getReferenceMaster('blood_types'),
        ApiService.getReferenceMaster('occupations'),
        ApiService.getReferenceMaster('income_ranges'),
        ApiService.getReferenceMaster('education_levels'),
      ]);
      if (!mounted) return;
      setState(() {
        _replaceOptions(
          _jenisSantriOptions,
          results[0],
          allowedNames: _allowedStudentTypeNames,
        );
        _jenisSantriOptions
          ..clear()
          ..add('')
          ..addAll(['Santri Madin', 'Santri Pondok', 'Keduanya']);
        _replaceOptions(_tempatTinggalOptions, results[1]);
        _replaceOptions(_transportasiOptions, results[2]);
        _replaceOptions(_golonganDarahOptions, results[3]);
        _replaceOccupationOptions(results[4]);
        _replaceOptions(_penghasilanOptions, results[5], includeLainnya: true);
        _replaceOptions(_pendidikanOptions, results[6]);
        if (!_jenisSantriOptions.contains(_jenisSantri)) {
          _jenisSantri = '';
        }
      });
    } catch (_) {}
  }

  void _replaceOccupationOptions(Map<String, dynamic> result) {
    final names = _dataList(result)
        .map((item) => item['name']?.toString().trim() ?? '')
        .where((name) => name.isNotEmpty)
        .toList();
    if (names.isEmpty) return;
    final ibuOptions = <String>{...names, 'Lainnya'}.toList();
    final ayahOptions = ibuOptions
        .where((name) => name.toLowerCase() != 'ibu rumah tangga')
        .toList();
    _pekerjaanAyahOptions
      ..clear()
      ..add('')
      ..addAll(ayahOptions.where((name) => name.isNotEmpty));
    _pekerjaanIbuOptions
      ..clear()
      ..add('')
      ..addAll(ibuOptions.where((name) => name.isNotEmpty));
    _pekerjaanWaliOptions
      ..clear()
      ..add('')
      ..addAll(ibuOptions.where((name) => name.isNotEmpty));
  }

  void _replaceOptions(
    List<String> target,
    Map<String, dynamic> result, {
    Set<String>? allowedNames,
    bool includeLainnya = false,
  }) {
    final names = _dataList(result)
        .map((item) => item['name']?.toString().trim() ?? '')
        .where((name) => name.isNotEmpty)
        .where((name) => allowedNames == null || allowedNames.contains(name))
        .toList();
    final merged = <String>{...names};
    if (includeLainnya) merged.add('Lainnya');
    if (merged.isEmpty) return;
    target
      ..clear()
      ..add('')
      ..addAll(merged);
  }

  // ===== DATE PICKER =====
  Future<void> _pickDate(String controllerKey) async {
    final initial = _parseDate(_c[controllerKey]?.text ?? '');
    final picked = await showDatePicker(
      context: context,
      initialDate: initial ?? DateTime(2010),
      firstDate: DateTime(1950),
      lastDate: DateTime.now(),
      locale: const Locale('id', 'ID'),
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: const ColorScheme.light(
              primary: Color(0xFF138F81),
              onPrimary: Colors.white,
              surface: Colors.white,
              onSurface: Color(0xFF2D3436),
            ),
          ),
          child: child!,
        );
      },
    );
    if (picked != null) {
      if (!mounted) return;
      _c[controllerKey]?.text =
          '${picked.day.toString().padLeft(2, '0')}-${picked.month.toString().padLeft(2, '0')}-${picked.year}';
      setState(() {});
    }
  }

  DateTime? _parseDate(String text) {
    if (text.isEmpty) return null;
    try {
      final parts = text.split('-');
      if (parts.length == 3) {
        return DateTime(
          int.parse(parts[2]),
          int.parse(parts[1]),
          int.parse(parts[0]),
        );
      }
    } catch (_) {}
    return null;
  }

  // ===== IMAGE PICKER =====
  Future<void> _pickImage(String type) async {
    if (type == 'akta') {
      await _pickAktaFile();
      return;
    }

    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => Container(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              type == 'foto' ? 'Pilih Foto Santri' : 'Upload Dokumen Akta',
              style: GoogleFonts.poppins(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: const Color(0xFF2D3436),
              ),
            ),
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                _buildImageSourceButton(Icons.camera_alt_rounded, 'Kamera', () {
                  Navigator.pop(ctx, ImageSource.camera);
                }),
                _buildImageSourceButton(
                  Icons.photo_library_rounded,
                  'Galeri',
                  () {
                    Navigator.pop(ctx, ImageSource.gallery);
                  },
                ),
              ],
            ),
            const SizedBox(height: 12),
          ],
        ),
      ),
    );

    if (source == null) return;

    final picker = ImagePicker();
    final xFile = await picker.pickImage(
      source: source,
      imageQuality: 80,
      maxWidth: 1200,
    );
    if (xFile == null) return;

    setState(() {
      if (type == 'foto') {
        _fotoSantriFile = File(xFile.path);
        _fotoSantriPath = xFile.path;
      } else {
        _dokumenAktaFile = File(xFile.path);
        _dokumenAktaPath = xFile.path;
      }
    });
  }

  Future<void> _pickAktaFile() async {
    final source = await showModalBottomSheet<String>(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => Container(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'Upload Dokumen Akta',
              style: GoogleFonts.poppins(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: const Color(0xFF2D3436),
              ),
            ),
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                _buildImageSourceButton(
                  Icons.camera_alt_rounded,
                  'Kamera',
                  () => Navigator.pop(ctx, 'camera'),
                ),
                _buildImageSourceButton(
                  Icons.photo_library_rounded,
                  'Galeri',
                  () => Navigator.pop(ctx, 'gallery'),
                ),
                _buildImageSourceButton(
                  Icons.picture_as_pdf_rounded,
                  'PDF',
                  () => Navigator.pop(ctx, 'file'),
                ),
              ],
            ),
            const SizedBox(height: 12),
          ],
        ),
      ),
    );

    if (source == null) return;

    if (source == 'file') {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['pdf', 'jpg', 'jpeg', 'png'],
        allowMultiple: false,
      );
      final path = result?.files.single.path;
      if (path == null || path.isEmpty) return;
      setState(() {
        _dokumenAktaFile = File(path);
        _dokumenAktaPath = path;
      });
      return;
    }

    final picker = ImagePicker();
    final xFile = await picker.pickImage(
      source: source == 'camera' ? ImageSource.camera : ImageSource.gallery,
      imageQuality: 80,
      maxWidth: 1200,
    );
    if (xFile == null) return;

    setState(() {
      _dokumenAktaFile = File(xFile.path);
      _dokumenAktaPath = xFile.path;
    });
  }

  Widget _buildImageSourceButton(
    IconData icon,
    String label,
    VoidCallback onTap,
  ) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        children: [
          Container(
            width: 60,
            height: 60,
            decoration: BoxDecoration(
              color: const Color(0xFF138F81).withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Icon(icon, color: const Color(0xFF138F81), size: 28),
          ),
          const SizedBox(height: 6),
          Text(
            label,
            style: GoogleFonts.poppins(
              fontSize: 12,
              color: const Color(0xFF636E72),
            ),
          ),
        ],
      ),
    );
  }

  String _storageUrl(String path) {
    final clean = path.trim();
    if (clean.startsWith('http://') || clean.startsWith('https://')) {
      return clean;
    }
    final root = ApiService.baseUrl.replaceFirst(RegExp(r'/api/?$'), '');
    return '$root/storage/$clean';
  }

  bool _isImagePath(String path) {
    final lower = path.toLowerCase();
    return lower.endsWith('.jpg') ||
        lower.endsWith('.jpeg') ||
        lower.endsWith('.png') ||
        lower.endsWith('.webp');
  }

  Future<void> _previewFile(String type, String? path, File? file) async {
    final cleanPath = path?.trim() ?? '';
    if (file != null && await file.exists() && _isImagePath(file.path)) {
      if (!mounted) return;
      await showDialog<void>(
        context: context,
        builder: (_) => Dialog(
          insetPadding: const EdgeInsets.all(18),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(18),
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(18),
            child: Image.file(file, fit: BoxFit.contain),
          ),
        ),
      );
      return;
    }
    if (file != null && await file.exists()) {
      await Share.shareXFiles([
        XFile(file.path),
      ], text: type == 'foto' ? 'Foto Santri' : 'Dokumen Akta');
      return;
    }

    if (cleanPath.isEmpty) return;
    if (_isImagePath(cleanPath)) {
      final localFile = File(cleanPath);
      final imageUrl = cleanPath.startsWith('http')
          ? cleanPath
          : localFile.existsSync()
          ? cleanPath
          : _storageUrl(cleanPath);
      if (!mounted) return;
      await showDialog<void>(
        context: context,
        builder: (_) => Dialog(
          insetPadding: const EdgeInsets.all(18),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(18),
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(18),
            child: localFile.existsSync()
                ? Image.file(localFile, fit: BoxFit.contain)
                : Image.network(imageUrl, fit: BoxFit.contain),
          ),
        ),
      );
      return;
    }

    final url = cleanPath.startsWith('http')
        ? cleanPath
        : _storageUrl(cleanPath);
    await Share.share(
      url,
      subject: type == 'foto' ? 'Foto Santri' : 'Dokumen Akta',
    );
  }

  // ===== SEARCHABLE DROPDOWN =====
  Future<void> _showSearchableDropdown({
    required String title,
    required List<Map<String, dynamic>> items,
    required String nameKey,
    required Function(Map<String, dynamic>) onSelect,
  }) async {
    final selected = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => _SearchableDropdownSheet(
        title: title,
        items: items,
        nameKey: nameKey,
      ),
    );
    if (!mounted || selected == null) return;
    onSelect(selected);
  }

  Future<List<Map<String, dynamic>>> _fetchCityOptions([
    String query = '',
  ]) async {
    final result = await ApiService.getCities(q: query, limit: 1000);
    return _dataList(result);
  }

  String _cityCore(String value) {
    return value
        .toLowerCase()
        .replaceAll(RegExp(r'\b(kabupaten|kab\.?|kota)\b'), '')
        .replaceAll(RegExp(r'[^a-z0-9]+'), ' ')
        .trim()
        .replaceAll(RegExp(r'\s+'), ' ');
  }

  bool _isOfficialCityName(String value) {
    final clean = value.trim().toLowerCase();
    return clean.startsWith('kabupaten ') ||
        clean.startsWith('kab. ') ||
        clean.startsWith('kota ');
  }

  String _normalizeKnownCityName(String value) {
    final clean = value.trim();
    if (clean.isEmpty || clean == '-' || _isOfficialCityName(clean)) {
      return clean;
    }
    return _knownOfficialCities[_cityCore(clean)] ?? clean;
  }

  void _setControllerTextAtStart(
    TextEditingController controller,
    String text,
  ) {
    controller.value = TextEditingValue(
      text: text,
      selection: const TextSelection.collapsed(offset: 0),
    );
  }

  void _hydrateBirthPlaceControllers() {
    final addressCity = widget.siswa['kota']?.trim() ?? '';
    final tempatLahir = _c['tempatLahir']?.text.trim() ?? '';
    if (_isOfficialCityName(addressCity) &&
        tempatLahir.isNotEmpty &&
        _cityCore(addressCity) == _cityCore(tempatLahir)) {
      final controller = _c['tempatLahir'];
      if (controller != null) {
        _setControllerTextAtStart(controller, addressCity);
      }
    }

    for (final key in const [
      'tempatLahir',
      'tempatLahirAyah',
      'tempatLahirIbu',
    ]) {
      final controller = _c[key];
      if (controller != null) {
        final normalized = _normalizeKnownCityName(controller.text);
        if (normalized != controller.text.trim()) {
          _setControllerTextAtStart(controller, normalized);
        }
      }
      _normalizeBirthPlaceController(key);
    }
  }

  Future<void> _normalizeBirthPlaceController(String controllerKey) async {
    final controller = _c[controllerKey];
    final current = controller?.text.trim() ?? '';
    if (controller == null ||
        current.isEmpty ||
        current == '-' ||
        _isOfficialCityName(current)) {
      return;
    }

    try {
      final candidates = await _fetchCityOptions(current);
      if (!mounted) return;
      final currentCore = _cityCore(current);
      Map<String, dynamic>? match;
      for (final city in candidates) {
        final name = city['name']?.toString().trim() ?? '';
        if (name.isEmpty) continue;
        if (_cityCore(name) == currentCore) {
          match = city;
          break;
        }
      }
      final officialName = match?['name']?.toString().trim() ?? '';
      if (officialName.isNotEmpty) {
        _setControllerTextAtStart(controller, officialName);
      }
    } catch (_) {
      // Nilai lama tetap dipakai jika master wilayah belum bisa diakses.
    }
  }

  Future<void> _showCityPicker({
    required String title,
    required String controllerKey,
  }) async {
    final selected = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => _CityPickerSheet(title: title),
    );
    if (!mounted || selected == null) return;

    final name = selected['name']?.toString().trim() ?? '';
    if (name.isEmpty) return;
    setState(() {
      final controller = _c[controllerKey];
      if (controller != null) _setControllerTextAtStart(controller, name);
    });
  }

  // ===== SIMPAN =====
  void _handleSimpan() {
    if (_formKey.currentState!.validate()) {
      final updated = Map<String, String>.from(widget.siswa);
      for (final entry in _c.entries) {
        updated[entry.key] = entry.value.text;
      }
      updated['jk'] = _selectedJK;
      updated['jenisSantri'] = _officialOrEmpty(
        _jenisSantri,
        _jenisSantriOptions,
      );
      updated['tempatTinggal'] = _officialOrEmpty(
        _tempatTinggal,
        _tempatTinggalOptions,
      );
      updated['transportasi'] = _officialOrEmpty(
        _transportasi,
        _transportasiOptions,
      );
      updated['golonganDarah'] = _officialOrEmpty(
        _golonganDarah,
        _golonganDarahOptions,
      );
      updated['waliSamaDengan'] = _waliSamaDengan;
      updated['statusMondok'] = _statusMondok;
      updated['boardingRoomId'] = _c['boardingRoomId']?.text ?? '';
      updated['komplek'] = _c['komplek']?.text ?? '';
      updated['kamar'] = _c['kamar']?.text ?? '';
      if (_statusMondok != 'mondok') {
        _c['tanggalDiterimaPondok']?.text = '';
        updated['tanggalDiterimaPondok'] = '';
        updated['boardingRoomId'] = '';
        updated['komplek'] = '';
        updated['kamar'] = '';
      }
      updated['provinceId'] = _selectedProvinsiId ?? '';
      updated['cityId'] = _selectedKotaId ?? '';
      updated['districtId'] = _selectedKecamatanId ?? '';
      updated['villageId'] = _selectedKelurahanId ?? '';
      updated['previousSchoolOriginId'] = _selectedPreviousSchoolOriginId ?? '';
      updated['schoolOriginId'] = _selectedSchoolOriginId ?? '';
      updated['classId'] = _selectedClassId ?? '';
      updated['pekerjaanAyah'] = _officialOrEmpty(
        _c['pekerjaanAyah']?.text ?? '',
        _pekerjaanAyahOptions,
      );
      updated['pekerjaanIbu'] = _officialOrEmpty(
        _c['pekerjaanIbu']?.text ?? '',
        _pekerjaanIbuOptions,
      );
      updated['pekerjaanWali'] = _officialOrEmpty(
        _c['pekerjaanWali']?.text ?? '',
        _pekerjaanWaliOptions,
      );
      updated['penghasilanAyah'] = _officialOrEmpty(
        _c['penghasilanAyah']?.text ?? '',
        _penghasilanOptions,
      );
      updated['penghasilanIbu'] = _officialOrEmpty(
        _c['penghasilanIbu']?.text ?? '',
        _penghasilanOptions,
      );
      updated['pendidikanAyah'] = _officialOrEmpty(
        _c['pendidikanAyah']?.text ?? '',
        _pendidikanOptions,
      );
      updated['pendidikanIbu'] = _officialOrEmpty(
        _c['pendidikanIbu']?.text ?? '',
        _pendidikanOptions,
      );
      _applyGuardianMirror(updated);
      updated['dokumenAkta'] = _dokumenAktaPath ?? '';
      updated['fotoSantri'] = _fotoSantriPath ?? '';

      Navigator.pop(context, updated);
    }
  }

  void _applyGuardianMirror(Map<String, String> updated) {
    if (_waliSamaDengan == 'Ayah') {
      updated['namaWali'] = updated['namaAyah'] ?? '';
      updated['pekerjaanWali'] = updated['pekerjaanAyah'] ?? '';
      updated['alamatWali'] = updated['alamat'] ?? '';
      updated['telpWali'] = updated['noWhatsappAyah'] ?? '';
    } else if (_waliSamaDengan == 'Ibu') {
      updated['namaWali'] = updated['namaIbu'] ?? '';
      updated['pekerjaanWali'] = updated['pekerjaanIbu'] ?? '';
      updated['alamatWali'] = updated['alamat'] ?? '';
      updated['telpWali'] = updated['noWhatsappIbu'] ?? '';
    }
  }

  String _officialOrEmpty(String value, List<String> options) {
    final clean = value.trim();
    if (clean.isEmpty) return '';
    return options.contains(clean) ? clean : '';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFFDC80),
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(),
            const SizedBox(height: 8),
            Expanded(
              child: AppResponsive(
                child: Container(
                  margin: EdgeInsets.symmetric(
                    horizontal: AppResponsive.pageMargin(context),
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0xFFE1EFF7),
                    borderRadius: BorderRadius.circular(30),
                  ),
                  child: Form(
                    key: _formKey,
                    child: ListView(
                      physics: const BouncingScrollPhysics(),
                      padding: const EdgeInsets.all(16),
                      children: [
                        // ===== 1. DATA SANTRI =====
                        _buildSectionTitle('1. DATA SANTRI'),
                        _buildDivider(),
                        _buildSubSectionTitle('Edit Informasi Santri'),
                        _buildRequiredLegend(),
                        Row(
                          children: [
                            Expanded(
                              child: _buildField('NIS', 'nis', required: true),
                            ),
                            const SizedBox(width: 10),
                            Expanded(child: _buildField('NISN', 'nisn')),
                          ],
                        ),
                        _buildField('Nama Lengkap', 'nama', required: true),
                        _buildField('Nama Panggilan', 'namaPanggilan'),
                        _buildDropdownField(
                          'Jenis Kelamin',
                          _selectedJK,
                          _jkOptions,
                          (v) => setState(() => _selectedJK = v!),
                          required: true,
                        ),
                        _buildCityPickerField('Tempat Lahir', 'tempatLahir'),
                        _buildDateField('Tanggal Lahir', 'tglLahir'),
                        _buildRow2('NIK', 'nik', 'No KK', 'noKk'),
                        _buildField('No Akta', 'noAkta'),
                        _buildFileUploadField(
                          'Dokumen Akta',
                          'akta',
                          _dokumenAktaPath,
                          _dokumenAktaFile,
                        ),
                        _buildField('Alamat Lengkap', 'alamat', maxLines: 2),
                        _buildField('Kewarganegaraan', 'kewarganegaraan'),
                        _buildWilayahField(
                          'Provinsi',
                          'provinsi',
                          _provinsiList,
                          (item) {
                            _c['provinsi']?.text = item['name'] ?? '';
                            _selectedProvinsiId = item['id']?.toString();
                            _selectedKotaId = null;
                            _selectedKecamatanId = null;
                            _selectedKelurahanId = null;
                            _c['kota']?.text = '';
                            _c['kecamatan']?.text = '';
                            _c['kelurahan']?.text = '';
                            _c['kodePos']?.text = '';
                            if (_selectedProvinsiId?.isNotEmpty == true) {
                              _loadKota(_selectedProvinsiId!);
                            }
                            _loadSchoolOrigins();
                            setState(() {});
                          },
                        ),
                        _buildWilayahField(
                          'Kota/Kabupaten',
                          'kota',
                          _kotaList,
                          (item) {
                            _c['kota']?.text = item['name'] ?? '';
                            _selectedKotaId = item['id']?.toString();
                            _selectedKecamatanId = null;
                            _selectedKelurahanId = null;
                            _c['kecamatan']?.text = '';
                            _c['kelurahan']?.text = '';
                            _c['kodePos']?.text = '';
                            if (_selectedKotaId?.isNotEmpty == true) {
                              _loadKecamatan(_selectedKotaId!);
                            }
                            _loadSchoolOrigins();
                            setState(() {});
                          },
                        ),
                        _buildWilayahField(
                          'Kecamatan',
                          'kecamatan',
                          _kecamatanList,
                          (item) {
                            _c['kecamatan']?.text = item['name'] ?? '';
                            _selectedKecamatanId = item['id']?.toString();
                            _selectedKelurahanId = null;
                            _c['kelurahan']?.text = '';
                            _c['kodePos']?.text = '';
                            if (_selectedKecamatanId?.isNotEmpty == true) {
                              _loadKelurahan(_selectedKecamatanId!);
                            }
                            _loadSchoolOrigins();
                            setState(() {});
                          },
                        ),
                        _buildWilayahField(
                          'Kelurahan/Desa',
                          'kelurahan',
                          _kelurahanList,
                          (item) {
                            _c['kelurahan']?.text = item['name'] ?? '';
                            _selectedKelurahanId = item['id']?.toString();
                            _c['kodePos']?.text =
                                item['postal_code']?.toString() ?? '';
                            setState(() {});
                          },
                        ),
                        _buildField('Kode Pos', 'kodePos'),
                        _buildRow2(
                          'No WhatsApp',
                          'noWhatsapp',
                          'Email',
                          'emailSiswa',
                        ),
                        _buildMasterPickerField(
                          'Sekolah Asal Sebelumnya',
                          'previousAsalSekolah',
                          _schoolOriginList,
                          'name',
                          (item) {
                            _c['previousAsalSekolah']?.text =
                                item['name']?.toString() ?? '';
                            _selectedPreviousSchoolOriginId = item['id']
                                ?.toString();
                            setState(() {});
                          },
                        ),
                        _buildMasterPickerField(
                          'Sekolah Asal Siswa Sekarang',
                          'asalSekolah',
                          _schoolOriginList,
                          'name',
                          (item) {
                            _c['asalSekolah']?.text =
                                item['name']?.toString() ?? '';
                            _selectedSchoolOriginId = item['id']?.toString();
                            setState(() {});
                          },
                        ),
                        _buildRow2(
                          'Tahun Lulus',
                          'tahunLulus',
                          'Tahun Akademik Masuk',
                          'tahunAkademikMasuk',
                        ),
                        _buildDateField(
                          'Tanggal Diterima di Akademik/Sekolah Sekarang',
                          'tanggalDiterimaSekolah',
                        ),
                        _buildDropdownField(
                          'Jenis Santri',
                          _jenisSantri,
                          _jenisSantriOptions,
                          (v) => setState(() => _jenisSantri = v!),
                        ),
                        _buildMasterPickerField(
                          'Kelas',
                          'kelas',
                          _classList,
                          'name',
                          (item) {
                            _c['kelas']?.text = item['name']?.toString() ?? '';
                            _selectedClassId = item['id']?.toString();
                            setState(() {});
                          },
                        ),
                        const SizedBox(height: 16),

                        // ===== 2. DATA ORANG TUA =====
                        _buildSectionTitle('2. DATA ORANG TUA'),
                        _buildDivider(),
                        _buildSubSectionTitle('Edit Informasi Data Orang Tua'),
                        // Ayah & Ibu — dual column
                        _buildRow2Label(
                          'Nama',
                          'Ayah',
                          'namaAyah',
                          'Ibu',
                          'namaIbu',
                        ),
                        _buildRow2Label(
                          'NIK',
                          'Ayah',
                          'nikAyah',
                          'Ibu',
                          'nikIbu',
                        ),
                        _buildCityPickerRow2(
                          'Tempat Lahir',
                          'Ayah',
                          'tempatLahirAyah',
                          'Ibu',
                          'tempatLahirIbu',
                        ),
                        _buildDateRow2(
                          'Tanggal Lahir',
                          'tglLahirAyah',
                          'tglLahirIbu',
                        ),
                        _buildRow2Label(
                          'No WhatsApp',
                          'Ayah',
                          'noWhatsappAyah',
                          'Ibu',
                          'noWhatsappIbu',
                        ),
                        _buildDropdownRow2Select(
                          'Pekerjaan',
                          'pekerjaanAyah',
                          'pekerjaanIbu',
                          _pekerjaanAyahOptions,
                          ibuOptions: _pekerjaanIbuOptions,
                        ),
                        _buildDropdownRow2Select(
                          'Penghasilan',
                          'penghasilanAyah',
                          'penghasilanIbu',
                          _penghasilanOptions,
                        ),
                        _buildDropdownRow2Select(
                          'Pendidikan',
                          'pendidikanAyah',
                          'pendidikanIbu',
                          _pendidikanOptions,
                        ),
                        _buildRow2(
                          'Alamat Lengkap Ayah',
                          'alamatLengkapAyah',
                          'Alamat Lengkap Ibu',
                          'alamatLengkapIbu',
                          maxLines: 3,
                        ),
                        const SizedBox(height: 8),
                        _buildSubSectionTitle('Data Wali'),
                        _buildWaliSelector(),
                        if (_waliSamaDengan.isEmpty) ...[
                          _buildField('Nama Wali', 'namaWali'),
                          _buildSingleDropdownField(
                            'Pekerjaan Wali',
                            'pekerjaanWali',
                            _pekerjaanWaliOptions,
                          ),
                          _buildField('Alamat Wali', 'alamatWali', maxLines: 2),
                          _buildField('No. Telp Wali', 'telpWali'),
                        ],
                        const SizedBox(height: 16),

                        // ===== 3. DATA PROFIL =====
                        _buildSectionTitle('3. DATA PROFIL'),
                        _buildDivider(),
                        _buildSubSectionTitle('Isi Data Profil Santri'),
                        _buildDropdownField(
                          'Tempat Tinggal',
                          _tempatTinggal,
                          _tempatTinggalOptions,
                          (v) => setState(() => _tempatTinggal = v!),
                        ),
                        _buildStatusMondokField(),
                        if (_statusMondok == 'mondok')
                          _buildDateField(
                            'Tanggal Diterima di Pondok',
                            'tanggalDiterimaPondok',
                          ),
                        if (_statusMondok == 'mondok')
                          _buildRow2('Komplek', 'komplek', 'Kamar', 'kamar'),
                        _buildDropdownField(
                          'Transportasi',
                          _transportasi,
                          _transportasiOptions,
                          (v) => setState(() => _transportasi = v!),
                        ),
                        _buildRow2(
                          'Tinggi Badan (cm)',
                          'tinggiBadan',
                          'Berat Badan (kg)',
                          'beratBadan',
                        ),
                        _buildDropdownField(
                          'Golongan Darah',
                          _golonganDarah,
                          _golonganDarahOptions,
                          (v) => setState(() => _golonganDarah = v!),
                        ),
                        _buildFileUploadField(
                          'Foto Santri',
                          'foto',
                          _fotoSantriPath,
                          _fotoSantriFile,
                        ),
                        _buildField(
                          'Catatan Santri',
                          'catatanSantri',
                          maxLines: 3,
                        ),
                        const SizedBox(height: 20),

                        // SIMPAN
                        SizedBox(
                          width: double.infinity,
                          height: 50,
                          child: ElevatedButton(
                            onPressed: _handleSimpan,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF138F81),
                              foregroundColor: Colors.white,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(18),
                              ),
                              elevation: 3,
                            ),
                            child: Text(
                              'Simpan Data',
                              style: GoogleFonts.poppins(
                                fontSize: 16,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(height: 16),
                      ],
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  // ===========================
  //  WIDGET BUILDERS
  // ===========================

  Widget _buildHeader() {
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
              width: 46,
              height: 46,
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF2E86DE), Color(0xFF54A0FF)],
                ),
                borderRadius: BorderRadius.circular(14),
              ),
              child: const Icon(
                Icons.edit_note_rounded,
                color: Colors.white,
                size: 24,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Edit Data Santri',
                    style: GoogleFonts.poppins(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: const Color(0xFF2D3436),
                    ),
                  ),
                  Text(
                    widget.siswa['nama'] ?? '',
                    style: GoogleFonts.poppins(
                      fontSize: 11,
                      color: const Color(0xFF636E72),
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
            IconButton(
              onPressed: () => Navigator.pop(context),
              icon: const Icon(
                Icons.close_rounded,
                size: 22,
                color: Color(0xFF636E72),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSectionTitle(String title) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 14),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF138F81), Color(0xFF1BA897)],
        ),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Text(
        title,
        style: GoogleFonts.poppins(
          fontSize: 14,
          fontWeight: FontWeight.w700,
          color: Colors.white,
          letterSpacing: 0.5,
        ),
      ),
    );
  }

  Widget _buildSubSectionTitle(String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
        decoration: BoxDecoration(
          color: const Color(0xFFFFDC80).withValues(alpha: 0.5),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: const Color(0xFFFFDC80)),
        ),
        child: Text(
          title,
          style: GoogleFonts.poppins(
            fontSize: 12,
            fontWeight: FontWeight.w700,
            color: const Color(0xFF2D3436),
          ),
        ),
      ),
    );
  }

  Widget _buildDivider() {
    return const Padding(
      padding: EdgeInsets.only(bottom: 10, top: 6),
      child: Divider(height: 1, color: Color(0xFFB2BEC3)),
    );
  }

  Widget _buildRequiredLegend() {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          const Text(
            '*',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w800,
              color: Color(0xFFE65100),
            ),
          ),
          const SizedBox(width: 4),
          Expanded(
            child: Text(
              'Wajib diisi. Field tanpa tanda bintang bersifat opsional.',
              style: GoogleFonts.poppins(
                fontSize: 10,
                fontWeight: FontWeight.w500,
                color: const Color(0xFF636E72),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _fieldLabel(String label, {bool required = false, Color? color}) {
    final textColor = color ?? const Color(0xFF636E72);
    if (!required) {
      return Text(
        label,
        style: GoogleFonts.poppins(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          color: textColor,
        ),
      );
    }

    return RichText(
      text: TextSpan(
        text: label,
        style: GoogleFonts.poppins(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          color: textColor,
        ),
        children: const [
          TextSpan(
            text: ' *',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w800,
              color: Color(0xFFE65100),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildField(
    String label,
    String key, {
    int maxLines = 1,
    bool required = false,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _fieldLabel(label, required: required),
          const SizedBox(height: 4),
          TextFormField(
            controller: _c[key],
            maxLines: maxLines,
            style: GoogleFonts.poppins(
              fontSize: 13,
              color: const Color(0xFF2D3436),
            ),
            decoration: _inputDecor(),
            validator: required
                ? (value) {
                    if ((value ?? '').trim().isEmpty) {
                      return '$label wajib diisi';
                    }
                    return null;
                  }
                : null,
          ),
        ],
      ),
    );
  }

  Widget _buildCityPickerField(String label, String key) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _fieldLabel(label),
          const SizedBox(height: 4),
          TextFormField(
            controller: _c[key],
            readOnly: true,
            onTap: () => _showCityPicker(title: label, controllerKey: key),
            style: GoogleFonts.poppins(
              fontSize: 13,
              color: const Color(0xFF2D3436),
            ),
            decoration: _inputDecor(
              hint: 'Pilih kota/kabupaten resmi',
              suffix: const Icon(
                Icons.location_city_rounded,
                color: Color(0xFF138F81),
                size: 20,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDateField(String label, String key) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: GoogleFonts.poppins(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: const Color(0xFF636E72),
            ),
          ),
          const SizedBox(height: 4),
          Row(
            children: [
              Expanded(
                child: TextFormField(
                  controller: _c[key],
                  readOnly: true,
                  style: GoogleFonts.poppins(
                    fontSize: 13,
                    color: const Color(0xFF2D3436),
                  ),
                  decoration: _inputDecor(hint: 'DD-MM-YYYY'),
                ),
              ),
              const SizedBox(width: 8),
              GestureDetector(
                onTap: () => _pickDate(key),
                child: Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: const Color(0xFF138F81),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(
                    Icons.calendar_month_rounded,
                    color: Colors.white,
                    size: 22,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildDateRow2(String label, String keyAyah, String keyIbu) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: GoogleFonts.poppins(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: const Color(0xFF636E72),
            ),
          ),
          const SizedBox(height: 4),
          Row(
            children: [
              Expanded(
                child: _buildMiniDateField(
                  'Ayah',
                  keyAyah,
                  const Color(0xFF2E86DE),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _buildMiniDateField(
                  'Ibu',
                  keyIbu,
                  const Color(0xFFE65100),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildMiniDateField(String sublabel, String key, Color labelColor) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          sublabel,
          style: GoogleFonts.poppins(
            fontSize: 10,
            fontWeight: FontWeight.w500,
            color: labelColor,
          ),
        ),
        const SizedBox(height: 2),
        Row(
          children: [
            Expanded(
              child: TextFormField(
                controller: _c[key],
                style: GoogleFonts.poppins(
                  fontSize: 12,
                  color: const Color(0xFF2D3436),
                ),
                decoration: _inputDecor(hint: 'DD-MM-YYYY'),
              ),
            ),
            const SizedBox(width: 4),
            GestureDetector(
              onTap: () => _pickDate(key),
              child: Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: const Color(0xFF138F81),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(
                  Icons.calendar_month_rounded,
                  color: Colors.white,
                  size: 16,
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildRow2(
    String l1,
    String k1,
    String l2,
    String k2, {
    int maxLines = 1,
  }) {
    if (l2.isEmpty) {
      return _buildField(l1, k1, maxLines: maxLines);
    }
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          Expanded(child: _buildField(l1, k1, maxLines: maxLines)),
          const SizedBox(width: 10),
          Expanded(child: _buildField(l2, k2, maxLines: maxLines)),
        ],
      ),
    );
  }

  Widget _buildRow2Label(
    String sectionLabel,
    String l1,
    String k1,
    String l2,
    String k2,
  ) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            sectionLabel,
            style: GoogleFonts.poppins(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: const Color(0xFF636E72),
            ),
          ),
          const SizedBox(height: 4),
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      l1,
                      style: GoogleFonts.poppins(
                        fontSize: 10,
                        fontWeight: FontWeight.w500,
                        color: const Color(0xFF2E86DE),
                      ),
                    ),
                    const SizedBox(height: 2),
                    TextFormField(
                      controller: _c[k1],
                      style: GoogleFonts.poppins(
                        fontSize: 12,
                        color: const Color(0xFF2D3436),
                      ),
                      decoration: _inputDecor(),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      l2,
                      style: GoogleFonts.poppins(
                        fontSize: 10,
                        fontWeight: FontWeight.w500,
                        color: const Color(0xFFE65100),
                      ),
                    ),
                    const SizedBox(height: 2),
                    TextFormField(
                      controller: _c[k2],
                      style: GoogleFonts.poppins(
                        fontSize: 12,
                        color: const Color(0xFF2D3436),
                      ),
                      decoration: _inputDecor(),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildCityPickerRow2(
    String sectionLabel,
    String l1,
    String k1,
    String l2,
    String k2,
  ) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            sectionLabel,
            style: GoogleFonts.poppins(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: const Color(0xFF636E72),
            ),
          ),
          const SizedBox(height: 4),
          Row(
            children: [
              Expanded(
                child: _buildMiniCityPickerField(
                  l1,
                  k1,
                  const Color(0xFF2E86DE),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _buildMiniCityPickerField(
                  l2,
                  k2,
                  const Color(0xFFE65100),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildMiniCityPickerField(String label, String key, Color labelColor) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: GoogleFonts.poppins(
            fontSize: 10,
            fontWeight: FontWeight.w500,
            color: labelColor,
          ),
        ),
        const SizedBox(height: 2),
        TextFormField(
          controller: _c[key],
          readOnly: true,
          onTap: () =>
              _showCityPicker(title: 'Tempat Lahir $label', controllerKey: key),
          style: GoogleFonts.poppins(
            fontSize: 12,
            color: const Color(0xFF2D3436),
          ),
          decoration: _inputDecor(
            suffix: const Icon(
              Icons.location_city_rounded,
              color: Color(0xFF138F81),
              size: 18,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildDropdownField(
    String label,
    String value,
    List<String> options,
    ValueChanged<String?> onChanged, {
    bool required = false,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _fieldLabel(label, required: required),
          const SizedBox(height: 4),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFDFE6E9)),
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                isExpanded: true,
                value: options.contains(value) ? value : options.first,
                items: options
                    .map(
                      (o) => DropdownMenuItem(
                        value: o,
                        child: Text(
                          o.isEmpty ? '— Pilih —' : o,
                          style: GoogleFonts.poppins(fontSize: 13),
                        ),
                      ),
                    )
                    .toList(),
                onChanged: onChanged,
              ),
            ),
          ),
          if (required && value.trim().isEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 4, left: 4),
              child: Text(
                '$label wajib dipilih',
                style: GoogleFonts.poppins(
                  fontSize: 10,
                  color: const Color(0xFFE65100),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildStatusMondokField() {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _fieldLabel('Status Mondok'),
          const SizedBox(height: 4),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFDFE6E9)),
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                value: _statusMondokOptions.contains(_statusMondok)
                    ? _statusMondok
                    : 'tidak_mondok',
                isExpanded: true,
                icon: const Icon(
                  Icons.keyboard_arrow_down_rounded,
                  color: Color(0xFF138F81),
                ),
                items: _statusMondokOptions
                    .map(
                      (value) => DropdownMenuItem(
                        value: value,
                        child: Text(
                          _statusMondokLabels[value] ?? value,
                          style: GoogleFonts.poppins(fontSize: 13),
                        ),
                      ),
                    )
                    .toList(),
                onChanged: (value) {
                  if (value == null) return;
                  setState(() {
                    _statusMondok = value;
                    if (value != 'mondok') {
                      _c['tanggalDiterimaPondok']?.text = '';
                    }
                  });
                },
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSingleDropdownField(
    String label,
    String key,
    List<String> options,
  ) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _fieldLabel(label),
          const SizedBox(height: 4),
          _buildMiniDropdownWithCustom(
            label,
            key,
            options,
            const Color(0xFF636E72),
          ),
        ],
      ),
    );
  }

  Widget _buildDropdownRow2Select(
    String label,
    String keyAyah,
    String keyIbu,
    List<String> ayahOptions, {
    List<String>? ibuOptions,
  }) {
    final rightOptions = ibuOptions ?? ayahOptions;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: GoogleFonts.poppins(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: const Color(0xFF636E72),
            ),
          ),
          const SizedBox(height: 4),
          Row(
            children: [
              Expanded(
                child: _buildMiniDropdownWithCustom(
                  'Ayah',
                  keyAyah,
                  ayahOptions,
                  const Color(0xFF2E86DE),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _buildMiniDropdownWithCustom(
                  'Ibu',
                  keyIbu,
                  rightOptions,
                  const Color(0xFFE65100),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildMiniDropdownWithCustom(
    String sublabel,
    String key,
    List<String> options,
    Color labelColor,
  ) {
    final currentVal = _c[key]?.text ?? '';
    final isCustom = currentVal.isNotEmpty && !options.contains(currentVal);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          sublabel,
          style: GoogleFonts.poppins(
            fontSize: 10,
            fontWeight: FontWeight.w500,
            color: labelColor,
          ),
        ),
        const SizedBox(height: 2),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFDFE6E9)),
          ),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              isExpanded: true,
              value: isCustom
                  ? ''
                  : (options.contains(currentVal) ? currentVal : ''),
              items: [...options, if (!options.contains('Lainnya')) 'Lainnya']
                  .map(
                    (o) => DropdownMenuItem(
                      value: o,
                      child: Text(
                        o.isEmpty ? '— Pilih —' : o,
                        style: GoogleFonts.poppins(fontSize: 11),
                      ),
                    ),
                  )
                  .toList(),
              onChanged: (v) {
                _c[key]?.text = v ?? '';
                setState(() {});
              },
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildWilayahField(
    String label,
    String key,
    List<Map<String, dynamic>> items,
    Function(Map<String, dynamic>) onSelect,
  ) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _fieldLabel(label),
          const SizedBox(height: 4),
          GestureDetector(
            onTap: () {
              if (items.isEmpty) {
                return;
              }
              _showSearchableDropdown(
                title: label,
                items: items,
                nameKey: 'name',
                onSelect: onSelect,
              );
            },
            child: AbsorbPointer(
              absorbing: true,
              child: TextFormField(
                controller: _c[key],
                style: GoogleFonts.poppins(
                  fontSize: 13,
                  color: const Color(0xFF2D3436),
                ),
                decoration: _inputDecor(
                  hint: items.isEmpty
                      ? 'Data $label belum tersedia'
                      : 'Tap untuk pilih $label',
                  suffix: items.isNotEmpty
                      ? const Icon(
                          Icons.arrow_drop_down_rounded,
                          color: Color(0xFF138F81),
                        )
                      : null,
                ),
              ),
            ),
          ),
          if (key == 'asalSekolah') ...[
            const SizedBox(height: 6),
            Align(
              alignment: Alignment.centerRight,
              child: TextButton.icon(
                onPressed: _showSchoolOriginManager,
                icon: const Icon(Icons.settings_rounded, size: 16),
                label: const Text('Kelola asal sekolah'),
                style: TextButton.styleFrom(
                  foregroundColor: const Color(0xFF138F81),
                  textStyle: GoogleFonts.poppins(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildMasterPickerField(
    String label,
    String key,
    List<Map<String, dynamic>> items,
    String nameKey,
    Function(Map<String, dynamic>) onSelect,
  ) {
    final isSchoolOrigin = key == 'asalSekolah' || key == 'previousAsalSekolah';
    final emptyHint = 'Data $label belum tersedia';
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _fieldLabel(label),
          const SizedBox(height: 4),
          GestureDetector(
            onTap: () {
              if (isSchoolOrigin) {
                _showSchoolOriginPicker(onSelect);
                return;
              }
              if (items.isEmpty) return;
              _showSearchableDropdown(
                title: label,
                items: items,
                nameKey: nameKey,
                onSelect: onSelect,
              );
            },
            child: AbsorbPointer(
              absorbing: true,
              child: TextFormField(
                controller: _c[key],
                style: GoogleFonts.poppins(
                  fontSize: 13,
                  color: const Color(0xFF2D3436),
                ),
                decoration: _inputDecor(
                  hint: isSchoolOrigin
                      ? 'Tap untuk cari $label'
                      : items.isEmpty
                      ? emptyHint
                      : 'Tap untuk pilih $label',
                  suffix: (items.isNotEmpty || isSchoolOrigin)
                      ? const Icon(
                          Icons.arrow_drop_down_rounded,
                          color: Color(0xFF138F81),
                        )
                      : null,
                ),
                validator: (_) {
                  final value = _c[key]?.text.trim() ?? '';
                  if (value.isEmpty) return null;
                  if (isSchoolOrigin &&
                      (key == 'asalSekolah'
                                  ? _selectedSchoolOriginId
                                  : _selectedPreviousSchoolOriginId)
                              ?.isNotEmpty ==
                          true) {
                    return null;
                  }
                  final official = items.any(
                    (item) => item[nameKey]?.toString() == value,
                  );
                  return official ? null : '$label harus dipilih dari master';
                },
              ),
            ),
          ),
          if (isSchoolOrigin) ...[
            const SizedBox(height: 5),
            Text(
              'Cari sekolah langsung dari master lokal seluruh Indonesia. Jika belum ada, tambahkan melalui Kelola asal sekolah.',
              style: GoogleFonts.poppins(
                fontSize: 10,
                color: const Color(0xFF636E72),
              ),
            ),
            Align(
              alignment: Alignment.centerRight,
              child: TextButton.icon(
                onPressed: _showSchoolOriginManager,
                icon: const Icon(Icons.settings_rounded, size: 16),
                label: const Text('Kelola asal sekolah'),
                style: TextButton.styleFrom(
                  foregroundColor: const Color(0xFF138F81),
                  textStyle: GoogleFonts.poppins(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Future<void> _showSchoolOriginManager() async {
    final changed = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => const _SchoolOriginManagerSheet(),
    );
    if (!mounted || changed != true) return;
    if (!mounted) return;
    await _loadSchoolOrigins();
    if (!mounted) return;
    unawaited(
      SyncService.notifyDataChanged(
        SyncTopics.kelas,
        message: 'Master asal sekolah diperbarui',
      ),
    );
  }

  Future<void> _showSchoolOriginPicker(
    Function(Map<String, dynamic>) onSelect,
  ) async {
    final selected = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => const _SchoolOriginPickerSheet(),
    );
    if (!mounted || selected == null) return;
    onSelect(selected);
    await _loadSchoolOrigins();
  }

  Widget _buildWaliSelector() {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0xFFDFE6E9)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Wali sama dengan:',
              style: GoogleFonts.poppins(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: const Color(0xFF636E72),
              ),
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                _buildWaliChip('Ayah', 'Ayah'),
                const SizedBox(width: 10),
                _buildWaliChip('Ibu', 'Ibu'),
                const SizedBox(width: 10),
                _buildWaliChip('Lainnya', 'Wali'),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildWaliChip(String label, String value) {
    final isSelected = _waliSamaDengan == value;
    return GestureDetector(
      onTap: () => setState(() => _waliSamaDengan = value),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFF138F81) : Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isSelected
                ? const Color(0xFF138F81)
                : const Color(0xFFDFE6E9),
          ),
        ),
        child: Text(
          label,
          style: GoogleFonts.poppins(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: isSelected ? Colors.white : const Color(0xFF636E72),
          ),
        ),
      ),
    );
  }

  Widget _buildFileUploadField(
    String label,
    String type,
    String? path,
    File? file,
  ) {
    final hasFile = file != null || (path?.isNotEmpty == true);
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: GoogleFonts.poppins(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: const Color(0xFF636E72),
            ),
          ),
          const SizedBox(height: 4),
          GestureDetector(
            onTap: () => _pickImage(type),
            child: Container(
              width: double.infinity,
              height: hasFile && type == 'foto' ? 160 : 56,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: hasFile
                      ? const Color(0xFF138F81)
                      : const Color(0xFFDFE6E9),
                  width: hasFile ? 1.5 : 1,
                ),
              ),
              child: hasFile
                  ? type == 'foto' && file != null
                        ? ClipRRect(
                            borderRadius: BorderRadius.circular(11),
                            child: Image.file(
                              file,
                              fit: BoxFit.cover,
                              width: double.infinity,
                            ),
                          )
                        : Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 12),
                            child: Row(
                              children: [
                                const Icon(
                                  Icons.check_circle_rounded,
                                  color: Color(0xFF138F81),
                                  size: 20,
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Text(
                                    path?.split('/').last ?? 'File terpilih',
                                    style: GoogleFonts.poppins(
                                      fontSize: 12,
                                      color: const Color(0xFF138F81),
                                    ),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                                const Icon(
                                  Icons.edit_rounded,
                                  color: Color(0xFF636E72),
                                  size: 16,
                                ),
                              ],
                            ),
                          )
                  : Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(
                          Icons.cloud_upload_rounded,
                          color: Color(0xFF138F81),
                          size: 22,
                        ),
                        const SizedBox(width: 8),
                        Text(
                          'Tap untuk upload $label',
                          style: GoogleFonts.poppins(
                            fontSize: 12,
                            color: const Color(0xFF636E72),
                          ),
                        ),
                      ],
                    ),
            ),
          ),
          if (hasFile)
            Align(
              alignment: Alignment.centerRight,
              child: TextButton.icon(
                onPressed: () => _previewFile(type, path, file),
                icon: const Icon(Icons.visibility_rounded, size: 16),
                label: Text('Lihat', style: GoogleFonts.poppins(fontSize: 11)),
                style: TextButton.styleFrom(
                  foregroundColor: const Color(0xFF138F81),
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                ),
              ),
            ),
        ],
      ),
    );
  }

  InputDecoration _inputDecor({String? hint, Widget? suffix}) {
    return InputDecoration(
      isDense: true,
      hintText: hint,
      hintStyle: GoogleFonts.poppins(fontSize: 12, color: Colors.grey[400]),
      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: Color(0xFFDFE6E9)),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: Color(0xFFDFE6E9)),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: Color(0xFF138F81), width: 1.5),
      ),
      filled: true,
      fillColor: Colors.white,
      suffixIcon: suffix,
    );
  }
}

class _CityPickerSheet extends StatefulWidget {
  final String title;

  const _CityPickerSheet({required this.title});

  @override
  State<_CityPickerSheet> createState() => _CityPickerSheetState();
}

class _CityPickerSheetState extends State<_CityPickerSheet> {
  final TextEditingController _searchCtrl = TextEditingController();
  final FocusNode _focusNode = FocusNode();
  Timer? _debounce;
  int _requestId = 0;
  bool _isLoading = true;
  List<Map<String, dynamic>> _items = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _focusNode.dispose();
    _searchCtrl.dispose();
    super.dispose();
  }

  List<Map<String, dynamic>> _dataList(Map<String, dynamic> result) {
    final data = result['data'];
    if (data is! List) return [];
    return data
        .whereType<Map>()
        .map((item) => Map<String, dynamic>.from(item))
        .toList();
  }

  Future<void> _load([String query = '']) async {
    final requestId = ++_requestId;
    if (mounted) {
      setState(() => _isLoading = _items.isEmpty);
    }

    try {
      final result = await ApiService.getCities(q: query, limit: 1000);
      if (!mounted || requestId != _requestId) return;
      setState(() {
        _items = _dataList(result);
        _isLoading = false;
      });
    } catch (_) {
      if (!mounted || requestId != _requestId) return;
      setState(() => _isLoading = false);
    }
  }

  void _onSearchChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(
      const Duration(milliseconds: 280),
      () => _load(value.trim()),
    );
  }

  void _selectCity(Map<String, dynamic> item) {
    _debounce?.cancel();
    _requestId++;
    FocusManager.instance.primaryFocus?.unfocus();
    Navigator.of(context).pop(item);
  }

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.62,
      maxChildSize: 0.9,
      builder: (_, scrollCtrl) {
        return Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            children: [
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey[300],
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: 12),
              Text(
                widget.title,
                style: GoogleFonts.poppins(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: const Color(0xFF2D3436),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _searchCtrl,
                focusNode: _focusNode,
                onChanged: _onSearchChanged,
                style: GoogleFonts.poppins(fontSize: 13),
                decoration: InputDecoration(
                  hintText: 'Cari kota/kabupaten...',
                  prefixIcon: const Icon(
                    Icons.search,
                    color: Color(0xFF138F81),
                    size: 20,
                  ),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: const BorderSide(color: Color(0xFF138F81)),
                  ),
                  filled: true,
                  fillColor: Colors.white,
                ),
              ),
              const SizedBox(height: 8),
              Expanded(
                child: _isLoading
                    ? const Center(
                        child: CircularProgressIndicator(
                          color: Color(0xFF138F81),
                        ),
                      )
                    : _items.isEmpty
                    ? Center(
                        child: Text(
                          'Kota/kabupaten tidak ditemukan di master wilayah.',
                          textAlign: TextAlign.center,
                          style: GoogleFonts.poppins(
                            fontSize: 12,
                            color: const Color(0xFF636E72),
                          ),
                        ),
                      )
                    : ListView.builder(
                        controller: scrollCtrl,
                        itemCount: _items.length,
                        itemBuilder: (_, index) {
                          final item = _items[index];
                          final name = item['name']?.toString().trim() ?? '';
                          return ListTile(
                            dense: true,
                            title: Text(
                              name,
                              style: GoogleFonts.poppins(
                                fontSize: 13,
                                color: const Color(0xFF2D3436),
                              ),
                            ),
                            onTap: () => _selectCity(item),
                          );
                        },
                      ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _SearchableDropdownSheet extends StatefulWidget {
  final String title;
  final List<Map<String, dynamic>> items;
  final String nameKey;

  const _SearchableDropdownSheet({
    required this.title,
    required this.items,
    required this.nameKey,
  });

  @override
  State<_SearchableDropdownSheet> createState() =>
      _SearchableDropdownSheetState();
}

class _SearchableDropdownSheetState extends State<_SearchableDropdownSheet> {
  final _searchCtrl = TextEditingController();

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final query = _searchCtrl.text.toLowerCase();
    final filtered = widget.items.where((i) {
      final haystack = [
        i[widget.nameKey],
        i['npsn'],
        i['district'],
        i['city'],
        i['province'],
        i['alamat'],
      ].whereType<Object>().join(' ').toLowerCase();
      return haystack.contains(query);
    }).toList();

    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.6,
      maxChildSize: 0.9,
      builder: (_, scrollCtrl) {
        return Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            children: [
              _sheetHandle(),
              const SizedBox(height: 12),
              Text(
                widget.title,
                style: GoogleFonts.poppins(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: const Color(0xFF2D3436),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _searchCtrl,
                onChanged: (_) {
                  if (mounted) setState(() {});
                },
                style: GoogleFonts.poppins(fontSize: 13),
                decoration: _sheetInputDecor(
                  hint: 'Cari ${widget.title}...',
                  icon: Icons.search_rounded,
                ),
              ),
              const SizedBox(height: 8),
              Expanded(
                child: filtered.isEmpty
                    ? _emptySheetText('Data tidak ditemukan.')
                    : ListView.builder(
                        controller: scrollCtrl,
                        itemCount: filtered.length,
                        itemBuilder: (_, index) {
                          final item = filtered[index];
                          final subtitle = _schoolSubtitle(item);
                          return ListTile(
                            dense: true,
                            title: Text(
                              item[widget.nameKey]?.toString() ?? '',
                              style: GoogleFonts.poppins(
                                fontSize: 13,
                                color: const Color(0xFF2D3436),
                              ),
                            ),
                            subtitle: subtitle.isEmpty
                                ? null
                                : Text(
                                    subtitle,
                                    style: GoogleFonts.poppins(
                                      fontSize: 11,
                                      color: const Color(0xFF636E72),
                                    ),
                                  ),
                            onTap: () => Navigator.pop(context, item),
                          );
                        },
                      ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _SchoolOriginPickerSheet extends StatefulWidget {
  const _SchoolOriginPickerSheet();

  @override
  State<_SchoolOriginPickerSheet> createState() =>
      _SchoolOriginPickerSheetState();
}

class _SchoolOriginPickerSheetState extends State<_SchoolOriginPickerSheet> {
  final _searchCtrl = TextEditingController();
  Timer? _debounce;
  List<Map<String, dynamic>> _items = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _load([String? search]) async {
    if (mounted) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }
    try {
      final result = await ApiService.getSchoolOrigins(
        search: search,
        limit: 1000,
      );
      final data = result['data'];
      if (!mounted) return;
      setState(() {
        _items = data is List
            ? data
                  .whereType<Map>()
                  .map((item) => Map<String, dynamic>.from(item))
                  .toList()
            : [];
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = e.toString();
      });
    }
  }

  void _onSearchChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () {
      if (mounted) _load(value);
    });
  }

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.72,
      maxChildSize: 0.92,
      builder: (_, scrollCtrl) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                _sheetHandle(),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        'Pilih Sekolah Asal',
                        style: GoogleFonts.poppins(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          color: const Color(0xFF2D3436),
                        ),
                      ),
                    ),
                    IconButton(
                      tooltip: 'Muat ulang',
                      onPressed: _loading
                          ? null
                          : () => _load(_searchCtrl.text),
                      icon: const Icon(
                        Icons.refresh_rounded,
                        color: Color(0xFF138F81),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: _searchCtrl,
                  onChanged: _onSearchChanged,
                  style: GoogleFonts.poppins(fontSize: 13),
                  decoration: _sheetInputDecor(
                    hint: 'Cari nama sekolah, kota, kecamatan, provinsi...',
                    icon: Icons.search_rounded,
                  ),
                ),
                const SizedBox(height: 10),
                Expanded(
                  child: _loading
                      ? const Center(
                          child: CircularProgressIndicator(
                            color: Color(0xFF138F81),
                          ),
                        )
                      : _error != null
                      ? _emptySheetText('Gagal memuat sekolah. $_error')
                      : _items.isEmpty
                      ? _emptySheetText(
                          'Sekolah belum ditemukan. Tambahkan melalui Kelola asal sekolah.',
                        )
                      : ListView.separated(
                          controller: scrollCtrl,
                          itemCount: _items.length,
                          separatorBuilder: (_, _) => const Divider(height: 1),
                          itemBuilder: (_, index) {
                            final item = _items[index];
                            return ListTile(
                              dense: true,
                              title: Text(
                                item['name']?.toString() ?? '',
                                style: GoogleFonts.poppins(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w600,
                                  color: const Color(0xFF2D3436),
                                ),
                              ),
                              subtitle: Text(
                                _schoolSubtitle(item).isEmpty
                                    ? 'NPSN: ${item['npsn'] ?? '-'}'
                                    : _schoolSubtitle(item),
                                style: GoogleFonts.poppins(
                                  fontSize: 11,
                                  color: const Color(0xFF636E72),
                                ),
                              ),
                              onTap: () => Navigator.pop(context, item),
                            );
                          },
                        ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _SchoolOriginManagerSheet extends StatefulWidget {
  const _SchoolOriginManagerSheet();

  @override
  State<_SchoolOriginManagerSheet> createState() =>
      _SchoolOriginManagerSheetState();
}

class _SchoolOriginManagerSheetState extends State<_SchoolOriginManagerSheet> {
  final _searchCtrl = TextEditingController();
  final _nameCtrl = TextEditingController();
  final _npsnCtrl = TextEditingController();
  final _jenjangCtrl = TextEditingController();
  final _alamatCtrl = TextEditingController();
  Timer? _debounce;
  List<Map<String, dynamic>> _items = [];
  Map<String, dynamic>? _editing;
  bool _isFormOpen = false;
  bool _loading = true;
  bool _saving = false;
  bool _changed = false;
  bool _active = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _searchCtrl.dispose();
    _nameCtrl.dispose();
    _npsnCtrl.dispose();
    _jenjangCtrl.dispose();
    _alamatCtrl.dispose();
    super.dispose();
  }

  Future<void> _load([String? search]) async {
    if (mounted) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }
    try {
      final result = await ApiService.getSchoolOrigins(
        search: search,
        active: true,
        limit: 1000,
      );
      final data = result['data'];
      if (!mounted) return;
      setState(() {
        _items = data is List
            ? data
                  .whereType<Map>()
                  .map((item) => Map<String, dynamic>.from(item))
                  .toList()
            : [];
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = e.toString();
      });
    }
  }

  void _openForm([Map<String, dynamic>? item]) {
    _editing = item;
    _isFormOpen = true;
    _nameCtrl.text = item?['name']?.toString() ?? '';
    _npsnCtrl.text = item?['npsn']?.toString() ?? '';
    _jenjangCtrl.text = item?['jenjang']?.toString() ?? '';
    _alamatCtrl.text = item?['alamat']?.toString() ?? '';
    _active = item?['is_active'] != false;
    setState(() {});
  }

  void _closeForm() {
    _editing = null;
    _isFormOpen = false;
    _nameCtrl.clear();
    _npsnCtrl.clear();
    _jenjangCtrl.clear();
    _alamatCtrl.clear();
    _active = true;
    setState(() {});
  }

  Future<void> _save() async {
    final name = _nameCtrl.text.trim();
    if (name.isEmpty || _saving) return;
    setState(() => _saving = true);
    try {
      final payload = {
        'name': name,
        'npsn': _npsnCtrl.text.trim(),
        'jenjang': _jenjangCtrl.text.trim(),
        'alamat': _alamatCtrl.text.trim(),
        'is_active': _active,
        'source': 'manual',
      };
      final id = int.tryParse(_editing?['id']?.toString() ?? '');
      if (id == null) {
        await ApiService.createSchoolOrigin(payload);
      } else {
        await ApiService.updateSchoolOrigin(id, payload);
      }
      if (!mounted) return;
      _changed = true;
      _closeForm();
      await _load(_searchCtrl.text);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Gagal menyimpan sekolah: $e')));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _deactivate(Map<String, dynamic> item) async {
    final id = int.tryParse(item['id']?.toString() ?? '');
    if (id == null) return;
    try {
      await ApiService.deleteSchoolOrigin(id);
      if (!mounted) return;
      _changed = true;
      await _load(_searchCtrl.text);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Gagal menonaktifkan sekolah: $e')),
      );
    }
  }

  void _onSearchChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () {
      if (mounted) _load(value);
    });
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) return;
        if (_isFormOpen) {
          _closeForm();
          return;
        }
        Navigator.pop(context, _changed);
      },
      child: DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.78,
        maxChildSize: 0.94,
        builder: (_, scrollCtrl) {
          return SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: _isFormOpen ? _buildForm() : _buildList(scrollCtrl),
            ),
          );
        },
      ),
    );
  }

  Widget _buildList(ScrollController scrollCtrl) {
    return Column(
      children: [
        _sheetHandle(),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: Text(
                'Kelola Asal Sekolah',
                style: GoogleFonts.poppins(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: const Color(0xFF2D3436),
                ),
              ),
            ),
            IconButton(
              tooltip: 'Tambah sekolah',
              onPressed: () => _openForm(),
              icon: const Icon(
                Icons.add_circle_rounded,
                color: Color(0xFF138F81),
              ),
            ),
            IconButton(
              tooltip: 'Tutup',
              onPressed: () => Navigator.pop(context, _changed),
              icon: const Icon(Icons.close_rounded),
            ),
          ],
        ),
        const SizedBox(height: 10),
        TextField(
          controller: _searchCtrl,
          onChanged: _onSearchChanged,
          style: GoogleFonts.poppins(fontSize: 13),
          decoration: _sheetInputDecor(
            hint: 'Cari sekolah...',
            icon: Icons.search_rounded,
          ),
        ),
        const SizedBox(height: 10),
        Expanded(
          child: _loading
              ? const Center(
                  child: CircularProgressIndicator(color: Color(0xFF138F81)),
                )
              : _error != null
              ? _emptySheetText('Gagal memuat sekolah. $_error')
              : _items.isEmpty
              ? _emptySheetText('Belum ada sekolah pada pencarian ini.')
              : ListView.separated(
                  controller: scrollCtrl,
                  itemCount: _items.length,
                  separatorBuilder: (_, _) => const Divider(height: 1),
                  itemBuilder: (_, index) {
                    final item = _items[index];
                    return ListTile(
                      dense: true,
                      title: Text(
                        item['name']?.toString() ?? '',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: GoogleFonts.poppins(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      subtitle: Text(
                        _schoolSubtitle(item).isEmpty
                            ? 'NPSN: ${item['npsn'] ?? '-'}'
                            : _schoolSubtitle(item),
                        style: GoogleFonts.poppins(
                          fontSize: 11,
                          color: const Color(0xFF636E72),
                        ),
                      ),
                      trailing: Wrap(
                        spacing: 2,
                        children: [
                          IconButton(
                            tooltip: 'Edit',
                            onPressed: () => _openForm(item),
                            icon: const Icon(
                              Icons.edit_rounded,
                              size: 18,
                              color: Color(0xFF2E86DE),
                            ),
                          ),
                          IconButton(
                            tooltip: 'Nonaktifkan',
                            onPressed: () => _deactivate(item),
                            icon: const Icon(
                              Icons.delete_rounded,
                              size: 18,
                              color: Color(0xFFE65100),
                            ),
                          ),
                        ],
                      ),
                    );
                  },
                ),
        ),
      ],
    );
  }

  Widget _buildForm() {
    return ListView(
      children: [
        _sheetHandle(),
        const SizedBox(height: 12),
        Text(
          _editing == null ? 'Tambah Sekolah' : 'Edit Sekolah',
          style: GoogleFonts.poppins(
            fontSize: 16,
            fontWeight: FontWeight.w700,
            color: const Color(0xFF2D3436),
          ),
        ),
        const SizedBox(height: 14),
        _sheetField('Nama Sekolah', _nameCtrl, required: true),
        _sheetField('NPSN', _npsnCtrl),
        _sheetField('Jenjang', _jenjangCtrl),
        _sheetField('Alamat', _alamatCtrl, maxLines: 3),
        if (_editing != null && _schoolSubtitle(_editing!).isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Text(
              _schoolSubtitle(_editing!),
              style: GoogleFonts.poppins(
                fontSize: 11,
                color: const Color(0xFF636E72),
              ),
            ),
          ),
        Row(
          children: [
            Expanded(
              child: _statusButton('Aktif', _active, () {
                setState(() => _active = true);
              }),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _statusButton('Nonaktif', !_active, () {
                setState(() => _active = false);
              }),
            ),
          ],
        ),
        const SizedBox(height: 18),
        SizedBox(
          height: 50,
          child: ElevatedButton.icon(
            onPressed: _saving ? null : _save,
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF138F81),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
              ),
            ),
            icon: _saving
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
                    ),
                  )
                : const Icon(Icons.save_rounded),
            label: Text(
              _saving ? 'Menyimpan...' : 'Simpan Sekolah',
              style: GoogleFonts.poppins(fontWeight: FontWeight.w700),
            ),
          ),
        ),
        const SizedBox(height: 10),
        TextButton(
          onPressed: _saving ? null : _closeForm,
          child: const Text('Batal'),
        ),
      ],
    );
  }

  Widget _sheetField(
    String label,
    TextEditingController controller, {
    int maxLines = 1,
    bool required = false,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            required ? '$label *' : label,
            style: GoogleFonts.poppins(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: const Color(0xFF636E72),
            ),
          ),
          const SizedBox(height: 4),
          TextField(
            controller: controller,
            maxLines: maxLines,
            style: GoogleFonts.poppins(fontSize: 13),
            decoration: _sheetInputDecor(),
          ),
        ],
      ),
    );
  }

  Widget _statusButton(String label, bool selected, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 44,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: selected ? const Color(0xFF138F81) : Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: selected ? const Color(0xFF138F81) : const Color(0xFFDFE6E9),
          ),
        ),
        child: Text(
          label,
          style: GoogleFonts.poppins(
            fontSize: 12,
            fontWeight: FontWeight.w700,
            color: selected ? Colors.white : const Color(0xFF636E72),
          ),
        ),
      ),
    );
  }
}

Widget _sheetHandle() {
  return Container(
    width: 44,
    height: 4,
    decoration: BoxDecoration(
      color: const Color(0xFFB2BEC3),
      borderRadius: BorderRadius.circular(2),
    ),
  );
}

Widget _emptySheetText(String text) {
  return Center(
    child: Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Text(
        text,
        textAlign: TextAlign.center,
        style: GoogleFonts.poppins(
          fontSize: 12,
          color: const Color(0xFF636E72),
        ),
      ),
    ),
  );
}

InputDecoration _sheetInputDecor({String? hint, IconData? icon}) {
  return InputDecoration(
    hintText: hint,
    hintStyle: GoogleFonts.poppins(fontSize: 13, color: Colors.grey[400]),
    prefixIcon: icon == null
        ? null
        : Icon(icon, color: const Color(0xFF138F81), size: 20),
    isDense: true,
    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
    enabledBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(12),
      borderSide: const BorderSide(color: Color(0xFFDFE6E9)),
    ),
    focusedBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(12),
      borderSide: const BorderSide(color: Color(0xFF138F81)),
    ),
    filled: true,
    fillColor: Colors.white,
  );
}

String _schoolSubtitle(Map<String, dynamic> item) {
  final location = [item['district'], item['city'], item['province']]
      .where((value) => value != null && value.toString().trim().isNotEmpty)
      .join(' - ');
  final meta = [
    if ((item['npsn']?.toString().trim() ?? '').isNotEmpty)
      'NPSN ${item['npsn']}',
    if ((item['jenjang']?.toString().trim() ?? '').isNotEmpty) item['jenjang'],
  ].join(' | ');

  return [
    meta,
    location,
  ].where((value) => value.toString().trim().isNotEmpty).join(' | ');
}
