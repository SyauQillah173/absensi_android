import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';
import 'package:http/http.dart' as http;

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
  String? _selectedProvinsiId;
  String? _selectedKotaId;
  String? _selectedKecamatanId;

  final List<String> _jkOptions = ['Laki-laki', 'Perempuan'];
  final List<String> _jenisSantriOptions = ['', 'Santri Pondok', 'Umum'];
  final List<String> _tempatTinggalOptions = [
    '', 'Asrama', 'Bersama Orang Tua', 'Kos/Kontrak', 'Panti Asuhan',
    'Pesantren', 'Wali', 'Lainnya',
  ];
  final List<String> _transportasiOptions = [
    '', 'Jalan Kaki', 'Sepeda', 'Sepeda Motor', 'Mobil Pribadi',
    'Angkutan Umum', 'Kereta Api', 'Andong/Bendi/Dokar/Delman/Becak',
    'Ojek Online', 'Bus Sekolah', 'Perahu/Sampan', 'Lainnya',
  ];
  final List<String> _golonganDarahOptions = [
    '', 'A', 'B', 'AB', 'O', 'Tidak Tahu',
  ];
  final List<String> _penghasilanOptions = [
    '', 'Kurang dari Rp 1.000.000', 'Rp 1.000.000 - Rp 3.000.000',
    'Rp 3.000.000 - Rp 5.000.000', 'Rp 5.000.000 - Rp 10.000.000',
    'Lebih dari Rp 10.000.000',
  ];
  final List<String> _pendidikanOptions = [
    '', 'SD/MI', 'SMP/MTs', 'SMA/MA/SMK', 'D1', 'D2', 'D3', 'S1', 'S2', 'S3', 'Lainnya',
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
    _waliSamaDengan = s['waliSamaDengan'] ?? '';
    _dokumenAktaPath = (s['dokumenAkta']?.isNotEmpty == true) ? s['dokumenAkta'] : null;
    _fotoSantriPath = (s['fotoSantri']?.isNotEmpty == true) ? s['fotoSantri'] : null;

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
      'kewarganegaraan': TextEditingController(text: s['kewarganegaraan'] ?? 'Indonesia'),
      'provinsi': TextEditingController(text: s['provinsi'] ?? ''),
      'kota': TextEditingController(text: s['kota'] ?? ''),
      'kecamatan': TextEditingController(text: s['kecamatan'] ?? ''),
      'kelurahan': TextEditingController(text: s['kelurahan'] ?? ''),
      'kodePos': TextEditingController(text: s['kodePos'] ?? ''),
      'noWhatsapp': TextEditingController(text: s['noWhatsapp'] ?? ''),
      'emailSiswa': TextEditingController(text: s['emailSiswa'] ?? ''),
      'asalSekolah': TextEditingController(text: s['asalSekolah'] ?? ''),
      'tahunLulus': TextEditingController(text: s['tahunLulus'] ?? ''),
      'tahunAkademikMasuk': TextEditingController(text: s['tahunAkademikMasuk'] ?? ''),
      // Data Orang Tua
      'namaAyah': TextEditingController(text: s['namaAyah'] ?? ''),
      'nikAyah': TextEditingController(text: s['nikAyah'] ?? ''),
      'tempatLahirAyah': TextEditingController(text: s['tempatLahirAyah'] ?? ''),
      'tglLahirAyah': TextEditingController(text: s['tglLahirAyah'] ?? ''),
      'noWhatsappAyah': TextEditingController(text: s['noWhatsappAyah'] ?? ''),
      'pekerjaanAyah': TextEditingController(text: s['pekerjaanAyah'] ?? ''),
      'penghasilanAyah': TextEditingController(text: s['penghasilanAyah'] ?? ''),
      'pendidikanAyah': TextEditingController(text: s['pendidikanAyah'] ?? ''),
      'namaIbu': TextEditingController(text: s['namaIbu'] ?? ''),
      'nikIbu': TextEditingController(text: s['nikIbu'] ?? ''),
      'tempatLahirIbu': TextEditingController(text: s['tempatLahirIbu'] ?? ''),
      'tglLahirIbu': TextEditingController(text: s['tglLahirIbu'] ?? ''),
      'noWhatsappIbu': TextEditingController(text: s['noWhatsappIbu'] ?? ''),
      'pekerjaanIbu': TextEditingController(text: s['pekerjaanIbu'] ?? ''),
      'penghasilanIbu': TextEditingController(text: s['penghasilanIbu'] ?? ''),
      'pendidikanIbu': TextEditingController(text: s['pendidikanIbu'] ?? ''),
      'namaWali': TextEditingController(text: s['namaWali'] ?? ''),
      'pekerjaanWali': TextEditingController(text: s['pekerjaanWali'] ?? ''),
      'alamatWali': TextEditingController(text: s['alamatWali'] ?? ''),
      'telpWali': TextEditingController(text: s['telpWali'] ?? ''),
      // Data Profil
      'tinggiBadan': TextEditingController(text: s['tinggiBadan'] ?? ''),
      'beratBadan': TextEditingController(text: s['beratBadan'] ?? ''),
      'catatanSantri': TextEditingController(text: s['catatanSantri'] ?? ''),
      // Kelas (legacy)
      'kelas': TextEditingController(text: s['kelas'] ?? ''),
    };

    _loadProvinsi();
  }

  @override
  void dispose() {
    for (final c in _c.values) {
      c.dispose();
    }
    super.dispose();
  }

  // ===== WILAYAH API =====
  Future<void> _loadProvinsi() async {
    try {
      final res = await http.get(
        Uri.parse('https://emsifa.github.io/api-wilayah-indonesia/api/provinces.json'),
      ).timeout(const Duration(seconds: 5));
      if (res.statusCode == 200) {
        setState(() {
          _provinsiList = List<Map<String, dynamic>>.from(json.decode(res.body));
        });
      }
    } catch (_) {}
  }

  Future<void> _loadKota(String provinsiId) async {
    try {
      final res = await http.get(
        Uri.parse('https://emsifa.github.io/api-wilayah-indonesia/api/regencies/$provinsiId.json'),
      ).timeout(const Duration(seconds: 5));
      if (res.statusCode == 200) {
        setState(() {
          _kotaList = List<Map<String, dynamic>>.from(json.decode(res.body));
          _kecamatanList = [];
          _kelurahanList = [];
        });
      }
    } catch (_) {}
  }

  Future<void> _loadKecamatan(String kotaId) async {
    try {
      final res = await http.get(
        Uri.parse('https://emsifa.github.io/api-wilayah-indonesia/api/districts/$kotaId.json'),
      ).timeout(const Duration(seconds: 5));
      if (res.statusCode == 200) {
        setState(() {
          _kecamatanList = List<Map<String, dynamic>>.from(json.decode(res.body));
          _kelurahanList = [];
        });
      }
    } catch (_) {}
  }

  Future<void> _loadKelurahan(String kecamatanId) async {
    try {
      final res = await http.get(
        Uri.parse('https://emsifa.github.io/api-wilayah-indonesia/api/villages/$kecamatanId.json'),
      ).timeout(const Duration(seconds: 5));
      if (res.statusCode == 200) {
        setState(() {
          _kelurahanList = List<Map<String, dynamic>>.from(json.decode(res.body));
        });
      }
    } catch (_) {}
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
        return DateTime(int.parse(parts[2]), int.parse(parts[1]), int.parse(parts[0]));
      }
    } catch (_) {}
    return null;
  }

  // ===== IMAGE PICKER =====
  Future<void> _pickImage(String type) async {
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
                fontSize: 16, fontWeight: FontWeight.w700, color: const Color(0xFF2D3436),
              ),
            ),
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                _buildImageSourceButton(Icons.camera_alt_rounded, 'Kamera', () {
                  Navigator.pop(ctx, ImageSource.camera);
                }),
                _buildImageSourceButton(Icons.photo_library_rounded, 'Galeri', () {
                  Navigator.pop(ctx, ImageSource.gallery);
                }),
              ],
            ),
            const SizedBox(height: 12),
          ],
        ),
      ),
    );

    if (source == null) return;

    final picker = ImagePicker();
    final xFile = await picker.pickImage(source: source, imageQuality: 80, maxWidth: 1200);
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

  Widget _buildImageSourceButton(IconData icon, String label, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        children: [
          Container(
            width: 60, height: 60,
            decoration: BoxDecoration(
              color: const Color(0xFF138F81).withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Icon(icon, color: const Color(0xFF138F81), size: 28),
          ),
          const SizedBox(height: 6),
          Text(label, style: GoogleFonts.poppins(fontSize: 12, color: const Color(0xFF636E72))),
        ],
      ),
    );
  }

  // ===== SEARCHABLE DROPDOWN =====
  void _showSearchableDropdown({
    required String title,
    required List<Map<String, dynamic>> items,
    required String nameKey,
    required Function(Map<String, dynamic>) onSelect,
  }) {
    final searchCtrl = TextEditingController();
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx2, setModalState) {
            final query = searchCtrl.text.toLowerCase();
            final filtered = items.where((i) =>
              (i[nameKey]?.toString() ?? '').toLowerCase().contains(query),
            ).toList();
            return DraggableScrollableSheet(
              expand: false,
              initialChildSize: 0.6,
              maxChildSize: 0.9,
              builder: (_, scrollCtrl) {
                return Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    children: [
                      Container(
                        width: 40, height: 4,
                        decoration: BoxDecoration(
                          color: Colors.grey[300],
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                      const SizedBox(height: 12),
                      Text(title, style: GoogleFonts.poppins(
                        fontSize: 16, fontWeight: FontWeight.w700, color: const Color(0xFF2D3436),
                      )),
                      const SizedBox(height: 12),
                      TextField(
                        controller: searchCtrl,
                        onChanged: (_) => setModalState(() {}),
                        style: GoogleFonts.poppins(fontSize: 13),
                        decoration: InputDecoration(
                          hintText: 'Cari $title...',
                          hintStyle: GoogleFonts.poppins(fontSize: 13, color: Colors.grey[400]),
                          prefixIcon: const Icon(Icons.search, color: Color(0xFF138F81), size: 20),
                          isDense: true,
                          contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: const BorderSide(color: Color(0xFFDFE6E9)),
                          ),
                          focusedBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: const BorderSide(color: Color(0xFF138F81)),
                          ),
                          filled: true, fillColor: Colors.white,
                        ),
                      ),
                      const SizedBox(height: 8),
                      // Opsi ketik sendiri
                      InkWell(
                        onTap: () {
                          if (searchCtrl.text.isNotEmpty) {
                            onSelect({'id': '', nameKey: searchCtrl.text});
                            Navigator.pop(ctx);
                          }
                        },
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFFF3E0),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.edit_rounded, size: 16, color: Color(0xFFE65100)),
                              const SizedBox(width: 8),
                              Text(
                                'Ketik sendiri: "${searchCtrl.text.isEmpty ? '...' : searchCtrl.text}"',
                                style: GoogleFonts.poppins(fontSize: 12, color: const Color(0xFFE65100)),
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 8),
                      Expanded(
                        child: ListView.builder(
                          controller: scrollCtrl,
                          itemCount: filtered.length,
                          itemBuilder: (_, i) {
                            final item = filtered[i];
                            return ListTile(
                              dense: true,
                              title: Text(
                                item[nameKey]?.toString() ?? '',
                                style: GoogleFonts.poppins(fontSize: 13, color: const Color(0xFF2D3436)),
                              ),
                              onTap: () {
                                onSelect(item);
                                Navigator.pop(ctx);
                              },
                            );
                          },
                        ),
                      ),
                    ],
                  ),
                );
              },
            );
          },
        );
      },
    );
  }

  // ===== SIMPAN =====
  void _handleSimpan() {
    if (_formKey.currentState!.validate()) {
      final updated = Map<String, String>.from(widget.siswa);
      for (final entry in _c.entries) {
        updated[entry.key] = entry.value.text;
      }
      updated['jk'] = _selectedJK;
      updated['jenisSantri'] = _jenisSantri;
      updated['tempatTinggal'] = _tempatTinggal;
      updated['transportasi'] = _transportasi;
      updated['golonganDarah'] = _golonganDarah;
      updated['waliSamaDengan'] = _waliSamaDengan;
      updated['dokumenAkta'] = _dokumenAktaPath ?? '';
      updated['fotoSantri'] = _fotoSantriPath ?? '';

      Navigator.pop(context, updated);
    }
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
              child: Container(
                margin: const EdgeInsets.symmetric(horizontal: 16),
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
                      _buildRow2('NIS', 'nis', 'NISN', 'nisn'),
                      _buildField('Nama Lengkap', 'nama'),
                      _buildField('Nama Panggilan', 'namaPanggilan'),
                      _buildDropdownField('Jenis Kelamin', _selectedJK, _jkOptions,
                        (v) => setState(() => _selectedJK = v!)),
                      _buildRow2('Tempat Lahir', 'tempatLahir', '', ''),
                      _buildDateField('Tanggal Lahir', 'tglLahir'),
                      _buildRow2('NIK', 'nik', 'No KK', 'noKk'),
                      _buildField('No Akta', 'noAkta'),
                      _buildFileUploadField('Dokumen Akta', 'akta', _dokumenAktaPath, _dokumenAktaFile),
                      _buildField('Alamat Lengkap', 'alamat', maxLines: 2),
                      _buildField('Kewarganegaraan', 'kewarganegaraan'),
                      _buildWilayahField('Provinsi', 'provinsi', _provinsiList, (item) {
                        _c['provinsi']?.text = item['name'] ?? '';
                        _selectedProvinsiId = item['id']?.toString();
                        _c['kota']?.text = '';
                        _c['kecamatan']?.text = '';
                        _c['kelurahan']?.text = '';
                        if (_selectedProvinsiId?.isNotEmpty == true) {
                          _loadKota(_selectedProvinsiId!);
                        }
                        setState(() {});
                      }),
                      _buildWilayahField('Kota/Kabupaten', 'kota', _kotaList, (item) {
                        _c['kota']?.text = item['name'] ?? '';
                        _selectedKotaId = item['id']?.toString();
                        _c['kecamatan']?.text = '';
                        _c['kelurahan']?.text = '';
                        if (_selectedKotaId?.isNotEmpty == true) {
                          _loadKecamatan(_selectedKotaId!);
                        }
                        setState(() {});
                      }),
                      _buildWilayahField('Kecamatan', 'kecamatan', _kecamatanList, (item) {
                        _c['kecamatan']?.text = item['name'] ?? '';
                        _selectedKecamatanId = item['id']?.toString();
                        _c['kelurahan']?.text = '';
                        if (_selectedKecamatanId?.isNotEmpty == true) {
                          _loadKelurahan(_selectedKecamatanId!);
                        }
                        setState(() {});
                      }),
                      _buildWilayahField('Kelurahan/Desa', 'kelurahan', _kelurahanList, (item) {
                        _c['kelurahan']?.text = item['name'] ?? '';
                        setState(() {});
                      }),
                      _buildField('Kode Pos', 'kodePos'),
                      _buildRow2('No WhatsApp', 'noWhatsapp', 'Email', 'emailSiswa'),
                      _buildField('Sekolah Asal', 'asalSekolah'),
                      _buildRow2('Tahun Lulus', 'tahunLulus', 'Tahun Akademik Masuk', 'tahunAkademikMasuk'),
                      _buildDropdownField('Jenis Santri', _jenisSantri, _jenisSantriOptions,
                        (v) => setState(() => _jenisSantri = v!)),
                      _buildField('Kelas', 'kelas'),
                      const SizedBox(height: 16),

                      // ===== 2. DATA ORANG TUA =====
                      _buildSectionTitle('2. DATA ORANG TUA'),
                      _buildDivider(),
                      _buildSubSectionTitle('Edit Informasi Data Orang Tua'),
                      // Ayah & Ibu — dual column
                      _buildRow2Label('Nama', 'Ayah', 'namaAyah', 'Ibu', 'namaIbu'),
                      _buildRow2Label('NIK', 'Ayah', 'nikAyah', 'Ibu', 'nikIbu'),
                      _buildRow2Label('Tempat Lahir', 'Ayah', 'tempatLahirAyah', 'Ibu', 'tempatLahirIbu'),
                      _buildDateRow2('Tanggal Lahir', 'tglLahirAyah', 'tglLahirIbu'),
                      _buildRow2Label('No WhatsApp', 'Ayah', 'noWhatsappAyah', 'Ibu', 'noWhatsappIbu'),
                      _buildDropdownRow2WithCustom('Pekerjaan', 'pekerjaanAyah', 'pekerjaanIbu'),
                      _buildDropdownRow2Select('Penghasilan', 'penghasilanAyah', 'penghasilanIbu', _penghasilanOptions),
                      _buildDropdownRow2Select('Pendidikan', 'pendidikanAyah', 'pendidikanIbu', _pendidikanOptions),
                      const SizedBox(height: 8),
                      _buildSubSectionTitle('Data Wali'),
                      _buildWaliSelector(),
                      if (_waliSamaDengan.isEmpty) ...[
                        _buildField('Nama Wali', 'namaWali'),
                        _buildField('Pekerjaan Wali', 'pekerjaanWali'),
                        _buildField('Alamat Wali', 'alamatWali', maxLines: 2),
                        _buildField('No. Telp Wali', 'telpWali'),
                      ],
                      const SizedBox(height: 16),

                      // ===== 3. DATA PROFIL =====
                      _buildSectionTitle('3. DATA PROFIL'),
                      _buildDivider(),
                      _buildSubSectionTitle('Isi Data Profil Santri'),
                      _buildDropdownField('Tempat Tinggal', _tempatTinggal, _tempatTinggalOptions,
                        (v) => setState(() => _tempatTinggal = v!)),
                      _buildDropdownField('Transportasi', _transportasi, _transportasiOptions,
                        (v) => setState(() => _transportasi = v!)),
                      _buildRow2('Tinggi Badan (cm)', 'tinggiBadan', 'Berat Badan (kg)', 'beratBadan'),
                      _buildDropdownField('Golongan Darah', _golonganDarah, _golonganDarahOptions,
                        (v) => setState(() => _golonganDarah = v!)),
                      _buildFileUploadField('Foto Santri', 'foto', _fotoSantriPath, _fotoSantriFile),
                      _buildField('Catatan Santri', 'catatanSantri', maxLines: 3),
                      const SizedBox(height: 20),

                      // SIMPAN
                      SizedBox(
                        width: double.infinity, height: 50,
                        child: ElevatedButton(
                          onPressed: _handleSimpan,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF138F81),
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
                            elevation: 3,
                          ),
                          child: Text('Simpan Data', style: GoogleFonts.poppins(
                            fontSize: 16, fontWeight: FontWeight.w700,
                          )),
                        ),
                      ),
                      const SizedBox(height: 16),
                    ],
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
              width: 46, height: 46,
              decoration: BoxDecoration(
                gradient: const LinearGradient(colors: [Color(0xFF2E86DE), Color(0xFF54A0FF)]),
                borderRadius: BorderRadius.circular(14),
              ),
              child: const Icon(Icons.edit_note_rounded, color: Colors.white, size: 24),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Edit Data Santri', style: GoogleFonts.poppins(
                    fontSize: 16, fontWeight: FontWeight.w700, color: const Color(0xFF2D3436),
                  )),
                  Text(widget.siswa['nama'] ?? '', style: GoogleFonts.poppins(
                    fontSize: 11, color: const Color(0xFF636E72),
                  ), maxLines: 1, overflow: TextOverflow.ellipsis),
                ],
              ),
            ),
            IconButton(
              onPressed: () => Navigator.pop(context),
              icon: const Icon(Icons.close_rounded, size: 22, color: Color(0xFF636E72)),
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
        gradient: const LinearGradient(colors: [Color(0xFF138F81), Color(0xFF1BA897)]),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Text(title, style: GoogleFonts.poppins(
        fontSize: 14, fontWeight: FontWeight.w700, color: Colors.white, letterSpacing: 0.5,
      )),
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
        child: Text(title, style: GoogleFonts.poppins(
          fontSize: 12, fontWeight: FontWeight.w700, color: const Color(0xFF2D3436),
        )),
      ),
    );
  }

  Widget _buildDivider() {
    return const Padding(
      padding: EdgeInsets.only(bottom: 10, top: 6),
      child: Divider(height: 1, color: Color(0xFFB2BEC3)),
    );
  }

  Widget _buildField(String label, String key, {int maxLines = 1}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: GoogleFonts.poppins(
            fontSize: 11, fontWeight: FontWeight.w600, color: const Color(0xFF636E72),
          )),
          const SizedBox(height: 4),
          TextFormField(
            controller: _c[key],
            maxLines: maxLines,
            style: GoogleFonts.poppins(fontSize: 13, color: const Color(0xFF2D3436)),
            decoration: _inputDecor(),
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
          Text(label, style: GoogleFonts.poppins(
            fontSize: 11, fontWeight: FontWeight.w600, color: const Color(0xFF636E72),
          )),
          const SizedBox(height: 4),
          Row(
            children: [
              Expanded(
                child: TextFormField(
                  controller: _c[key],
                  style: GoogleFonts.poppins(fontSize: 13, color: const Color(0xFF2D3436)),
                  decoration: _inputDecor(hint: 'DD-MM-YYYY'),
                ),
              ),
              const SizedBox(width: 8),
              GestureDetector(
                onTap: () => _pickDate(key),
                child: Container(
                  width: 44, height: 44,
                  decoration: BoxDecoration(
                    color: const Color(0xFF138F81),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.calendar_month_rounded, color: Colors.white, size: 22),
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
          Text(label, style: GoogleFonts.poppins(
            fontSize: 11, fontWeight: FontWeight.w600, color: const Color(0xFF636E72),
          )),
          const SizedBox(height: 4),
          Row(
            children: [
              Expanded(child: _buildMiniDateField('Ayah', keyAyah, const Color(0xFF2E86DE))),
              const SizedBox(width: 10),
              Expanded(child: _buildMiniDateField('Ibu', keyIbu, const Color(0xFFE65100))),
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
        Text(sublabel, style: GoogleFonts.poppins(
          fontSize: 10, fontWeight: FontWeight.w500, color: labelColor,
        )),
        const SizedBox(height: 2),
        Row(
          children: [
            Expanded(
              child: TextFormField(
                controller: _c[key],
                style: GoogleFonts.poppins(fontSize: 12, color: const Color(0xFF2D3436)),
                decoration: _inputDecor(hint: 'DD-MM-YYYY'),
              ),
            ),
            const SizedBox(width: 4),
            GestureDetector(
              onTap: () => _pickDate(key),
              child: Container(
                width: 32, height: 32,
                decoration: BoxDecoration(
                  color: const Color(0xFF138F81),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(Icons.calendar_month_rounded, color: Colors.white, size: 16),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildRow2(String l1, String k1, String l2, String k2) {
    if (l2.isEmpty) {
      return _buildField(l1, k1);
    }
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          Expanded(child: _buildField(l1, k1)),
          const SizedBox(width: 10),
          Expanded(child: _buildField(l2, k2)),
        ],
      ),
    );
  }

  Widget _buildRow2Label(String sectionLabel, String l1, String k1, String l2, String k2) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(sectionLabel, style: GoogleFonts.poppins(
            fontSize: 11, fontWeight: FontWeight.w600, color: const Color(0xFF636E72),
          )),
          const SizedBox(height: 4),
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(l1, style: GoogleFonts.poppins(
                      fontSize: 10, fontWeight: FontWeight.w500, color: const Color(0xFF2E86DE),
                    )),
                    const SizedBox(height: 2),
                    TextFormField(
                      controller: _c[k1],
                      style: GoogleFonts.poppins(fontSize: 12, color: const Color(0xFF2D3436)),
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
                    Text(l2, style: GoogleFonts.poppins(
                      fontSize: 10, fontWeight: FontWeight.w500, color: const Color(0xFFE65100),
                    )),
                    const SizedBox(height: 2),
                    TextFormField(
                      controller: _c[k2],
                      style: GoogleFonts.poppins(fontSize: 12, color: const Color(0xFF2D3436)),
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

  Widget _buildDropdownField(String label, String value, List<String> options, ValueChanged<String?> onChanged) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: GoogleFonts.poppins(
            fontSize: 11, fontWeight: FontWeight.w600, color: const Color(0xFF636E72),
          )),
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
                items: options.map((o) => DropdownMenuItem(
                  value: o,
                  child: Text(o.isEmpty ? '— Pilih —' : o, style: GoogleFonts.poppins(fontSize: 13)),
                )).toList(),
                onChanged: onChanged,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDropdownRow2WithCustom(String label, String keyAyah, String keyIbu) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: GoogleFonts.poppins(
            fontSize: 11, fontWeight: FontWeight.w600, color: const Color(0xFF636E72),
          )),
          const SizedBox(height: 4),
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Ayah', style: GoogleFonts.poppins(
                      fontSize: 10, fontWeight: FontWeight.w500, color: const Color(0xFF2E86DE),
                    )),
                    const SizedBox(height: 2),
                    TextFormField(
                      controller: _c[keyAyah],
                      style: GoogleFonts.poppins(fontSize: 12, color: const Color(0xFF2D3436)),
                      decoration: _inputDecor(hint: 'Ketik pekerjaan'),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Ibu', style: GoogleFonts.poppins(
                      fontSize: 10, fontWeight: FontWeight.w500, color: const Color(0xFFE65100),
                    )),
                    const SizedBox(height: 2),
                    TextFormField(
                      controller: _c[keyIbu],
                      style: GoogleFonts.poppins(fontSize: 12, color: const Color(0xFF2D3436)),
                      decoration: _inputDecor(hint: 'Ketik pekerjaan'),
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

  Widget _buildDropdownRow2Select(String label, String keyAyah, String keyIbu, List<String> options) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: GoogleFonts.poppins(
            fontSize: 11, fontWeight: FontWeight.w600, color: const Color(0xFF636E72),
          )),
          const SizedBox(height: 4),
          Row(
            children: [
              Expanded(child: _buildMiniDropdownWithCustom('Ayah', keyAyah, options, const Color(0xFF2E86DE))),
              const SizedBox(width: 10),
              Expanded(child: _buildMiniDropdownWithCustom('Ibu', keyIbu, options, const Color(0xFFE65100))),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildMiniDropdownWithCustom(String sublabel, String key, List<String> options, Color labelColor) {
    final currentVal = _c[key]?.text ?? '';
    final isCustom = currentVal.isNotEmpty && !options.contains(currentVal);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(sublabel, style: GoogleFonts.poppins(
          fontSize: 10, fontWeight: FontWeight.w500, color: labelColor,
        )),
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
              value: isCustom ? 'Lainnya' : (options.contains(currentVal) ? currentVal : ''),
              items: [...options, if (!options.contains('Lainnya')) 'Lainnya'].map((o) => DropdownMenuItem(
                value: o,
                child: Text(o.isEmpty ? '— Pilih —' : o, style: GoogleFonts.poppins(fontSize: 11)),
              )).toList(),
              onChanged: (v) {
                if (v == 'Lainnya') {
                  _showCustomInputDialog(key);
                } else {
                  _c[key]?.text = v ?? '';
                  setState(() {});
                }
              },
            ),
          ),
        ),
        if (isCustom)
          Padding(
            padding: const EdgeInsets.only(top: 2),
            child: Text('Custom: $currentVal', style: GoogleFonts.poppins(
              fontSize: 9, color: const Color(0xFF138F81), fontWeight: FontWeight.w500,
            )),
          ),
      ],
    );
  }

  void _showCustomInputDialog(String key) {
    final customCtrl = TextEditingController(text: _c[key]?.text);
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text('Ketik Sendiri', style: GoogleFonts.poppins(fontSize: 16, fontWeight: FontWeight.w700)),
        content: TextField(
          controller: customCtrl,
          style: GoogleFonts.poppins(fontSize: 13),
          decoration: InputDecoration(
            hintText: 'Ketik di sini...',
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text('Batal', style: GoogleFonts.poppins(color: const Color(0xFF636E72))),
          ),
          ElevatedButton(
            onPressed: () {
              _c[key]?.text = customCtrl.text;
              setState(() {});
              Navigator.pop(ctx);
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF138F81),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            child: Text('OK', style: GoogleFonts.poppins(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  Widget _buildWilayahField(String label, String key, List<Map<String, dynamic>> items, Function(Map<String, dynamic>) onSelect) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: GoogleFonts.poppins(
            fontSize: 11, fontWeight: FontWeight.w600, color: const Color(0xFF636E72),
          )),
          const SizedBox(height: 4),
          GestureDetector(
            onTap: () {
              if (items.isEmpty) {
                // Allow manual typing
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
              absorbing: items.isNotEmpty,
              child: TextFormField(
                controller: _c[key],
                style: GoogleFonts.poppins(fontSize: 13, color: const Color(0xFF2D3436)),
                decoration: _inputDecor(
                  hint: items.isEmpty ? 'Ketik $label...' : 'Tap untuk pilih $label',
                  suffix: items.isNotEmpty
                    ? const Icon(Icons.arrow_drop_down_rounded, color: Color(0xFF138F81))
                    : null,
                ),
              ),
            ),
          ),
        ],
      ),
    );
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
            Text('Wali sama dengan:', style: GoogleFonts.poppins(
              fontSize: 11, fontWeight: FontWeight.w600, color: const Color(0xFF636E72),
            )),
            const SizedBox(height: 8),
            Row(
              children: [
                _buildWaliChip('Ayah', 'ayah'),
                const SizedBox(width: 10),
                _buildWaliChip('Ibu', 'ibu'),
                const SizedBox(width: 10),
                _buildWaliChip('Lainnya', ''),
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
            color: isSelected ? const Color(0xFF138F81) : const Color(0xFFDFE6E9),
          ),
        ),
        child: Text(label, style: GoogleFonts.poppins(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          color: isSelected ? Colors.white : const Color(0xFF636E72),
        )),
      ),
    );
  }

  Widget _buildFileUploadField(String label, String type, String? path, File? file) {
    final hasFile = file != null || (path?.isNotEmpty == true);
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: GoogleFonts.poppins(
            fontSize: 11, fontWeight: FontWeight.w600, color: const Color(0xFF636E72),
          )),
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
                  color: hasFile ? const Color(0xFF138F81) : const Color(0xFFDFE6E9),
                  width: hasFile ? 1.5 : 1,
                ),
              ),
              child: hasFile
                ? type == 'foto' && file != null
                  ? ClipRRect(
                      borderRadius: BorderRadius.circular(11),
                      child: Image.file(file, fit: BoxFit.cover, width: double.infinity),
                    )
                  : Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      child: Row(
                        children: [
                          const Icon(Icons.check_circle_rounded, color: Color(0xFF138F81), size: 20),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              path?.split('/').last ?? 'File terpilih',
                              style: GoogleFonts.poppins(fontSize: 12, color: const Color(0xFF138F81)),
                              maxLines: 1, overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          const Icon(Icons.edit_rounded, color: Color(0xFF636E72), size: 16),
                        ],
                      ),
                    )
                : Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.cloud_upload_rounded, color: Color(0xFF138F81), size: 22),
                      const SizedBox(width: 8),
                      Text(
                        'Tap untuk upload $label',
                        style: GoogleFonts.poppins(fontSize: 12, color: const Color(0xFF636E72)),
                      ),
                    ],
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
