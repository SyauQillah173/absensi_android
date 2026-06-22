import 'dart:async';

import 'package:flutter/material.dart';

import '../../services/api_service.dart';
import '../../services/cache_service.dart';
import '../../services/cetak_siswa_pdf.dart';
import '../../services/session_service.dart';
import '../../services/sync_service.dart';
import '../../utils/siswa_view_mapper.dart';
import '../../widgets/app_feedback.dart';
import '../../widgets/responsive_layout.dart';

class BiodataSiswaOrtuScreen extends StatefulWidget {
  const BiodataSiswaOrtuScreen({super.key});

  @override
  State<BiodataSiswaOrtuScreen> createState() => _BiodataSiswaOrtuScreenState();
}

class _BiodataSiswaOrtuScreenState extends State<BiodataSiswaOrtuScreen> {
  StreamSubscription<AppDataEvent>? _syncSubscription;

  List<Map<String, dynamic>> _anakList = [];
  int _activeSiswaId = 0;
  String _activeSiswaName = '';
  Map<String, String>? _biodata;
  bool _isLoading = true;
  bool _isOfflineMode = false;
  String _errorMessage = '';

  @override
  void initState() {
    super.initState();
    _syncSubscription = SyncService.dataEvents.listen(_handleDataEvent);
    _loadAnakData();
  }

  @override
  void dispose() {
    _syncSubscription?.cancel();
    super.dispose();
  }

  void _handleDataEvent(AppDataEvent event) {
    if (!mounted) return;
    if (event.topic == SyncTopics.session) {
      unawaited(_loadAnakData(silent: true));
      return;
    }
    if (_activeSiswaId > 0 &&
        (event.topic == SyncTopics.siswa ||
            event.topic == SyncTopics.heartbeat)) {
      unawaited(_loadBiodata(silent: true));
    }
  }

  Future<void> _loadAnakData({bool silent = false}) async {
    if (!silent) {
      setState(() {
        _isLoading = true;
        _errorMessage = '';
      });
    }

    final userId = await SessionService.getUserId();
    var anakList = await SessionService.getAnakList();

    try {
      final remote = await ApiService.getAnakWali(userId);
      if (remote['success'] == true) {
        anakList = List<Map<String, dynamic>>.from(remote['data'] ?? const []);
        await SessionService.setAnakList(anakList);
      }
    } catch (_) {
      // Keep session children if the server is temporarily unreachable.
    }

    final activeSiswaId = await SessionService.getActiveSiswaId();
    final activeSiswaName = await SessionService.getActiveSiswaNama();
    final resolved = _resolveActiveChild(
      anakList,
      activeSiswaId,
      activeSiswaName,
    );

    if (!mounted) return;
    setState(() {
      _anakList = anakList;
      _activeSiswaId = resolved.$1;
      _activeSiswaName = resolved.$2;
      _isLoading = resolved.$1 <= 0 ? false : _isLoading;
      _errorMessage = resolved.$1 <= 0 ? 'Data anak tidak ditemukan' : '';
    });

    if (resolved.$1 > 0) {
      await _loadBiodata(silent: silent);
    }
  }

  (int, String) _resolveActiveChild(
    List<Map<String, dynamic>> anakList,
    int currentId,
    String currentName,
  ) {
    if (anakList.isEmpty) return (0, '');
    final found = anakList.firstWhere(
      (item) => (item['id'] as num?)?.toInt() == currentId,
      orElse: () => anakList.first,
    );
    final id = (found['id'] as num?)?.toInt() ?? currentId;
    final name = found['nama']?.toString() ?? currentName;
    return (id, name);
  }

  Future<void> _loadBiodata({bool silent = false}) async {
    if (_activeSiswaId <= 0) return;
    if (!silent) {
      setState(() {
        _isLoading = true;
        _errorMessage = '';
      });
    }

    final cacheKey = 'wali_biodata_siswa_$_activeSiswaId';
    try {
      final result = await ApiService.getBiodataAnak(_activeSiswaId);
      if (result['success'] != true) {
        throw Exception(result['message'] ?? 'Gagal memuat biodata');
      }

      final data = Map<String, dynamic>.from(result['data'] ?? const {});
      await CacheService.save(cacheKey, {'success': true, 'data': data});
      if (!mounted) return;
      setState(() {
        _biodata = SiswaViewMapper.toDetailFormat(data);
        _isLoading = false;
        _isOfflineMode = false;
        _errorMessage = '';
      });
    } catch (_) {
      final cached = await CacheService.get(cacheKey);
      if (cached is Map<String, dynamic> && cached['data'] is Map) {
        if (!mounted) return;
        setState(() {
          _biodata = SiswaViewMapper.toDetailFormat(
            Map<String, dynamic>.from(cached['data'] as Map),
          );
          _isLoading = false;
          _isOfflineMode = true;
          _errorMessage = '';
        });
        return;
      }
      if (!mounted) return;
      setState(() {
        _isLoading = false;
        _isOfflineMode = false;
        _errorMessage = 'Tidak dapat memuat biodata siswa';
      });
    }
  }

  Future<void> _selectAnak(int? siswaId) async {
    if (siswaId == null || siswaId <= 0) return;
    final anak = _anakList.firstWhere(
      (item) => (item['id'] as num?)?.toInt() == siswaId,
      orElse: () => const <String, dynamic>{},
    );
    final nama = anak['nama']?.toString() ?? '';
    await SessionService.setActiveSiswa(siswaId: siswaId, siswaNama: nama);
    if (!mounted) return;
    setState(() {
      _activeSiswaId = siswaId;
      _activeSiswaName = nama;
      _biodata = null;
    });
    await _loadBiodata();
  }

  Future<void> _printBiodata() async {
    final data = _biodata;
    if (data == null) return;
    await CetakSiswaPdf.cetakAtauDownload(data);
  }

  String _text(String key) {
    if (key == 'pekerjaanWali') {
      final wali = (_biodata?['waliSamaDengan'] ?? '').trim().toLowerCase();
      final existing = _biodata?[key]?.trim() ?? '';
      if (existing.isNotEmpty) return existing;
      if (wali == 'ayah') {
        final value = _biodata?['pekerjaanAyah']?.trim() ?? '';
        return value.isEmpty ? '-' : value;
      }
      if (wali == 'ibu') {
        final value = _biodata?['pekerjaanIbu']?.trim() ?? '';
        return value.isEmpty ? '-' : value;
      }
    }
    final value = _biodata?[key]?.trim() ?? '';
    return value.isEmpty ? '-' : value;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFFDC80),
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(),
            const SizedBox(height: 12),
            Expanded(
              child: AppRefreshIndicator(
                onRefresh: () => _loadBiodata(),
                child: SingleChildScrollView(
                  physics: const AlwaysScrollableScrollPhysics(
                    parent: BouncingScrollPhysics(),
                  ),
                  padding: EdgeInsets.symmetric(
                    horizontal: AppResponsive.pageMargin(context),
                  ),
                  child: AppResponsive(
                    child: Column(
                      children: [
                        if (_anakList.length > 1) _buildAnakSelector(),
                        if (_anakList.length > 1) const SizedBox(height: 10),
                        if (_isOfflineMode) _buildOfflineBanner(),
                        if (_isOfflineMode) const SizedBox(height: 10),
                        _buildBody(),
                        const SizedBox(height: 18),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

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
              width: 50,
              height: 50,
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                color: Color(0xFFFFDC80),
              ),
              child: const Icon(
                Icons.badge_rounded,
                color: Color(0xFF138F81),
                size: 28,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Biodata Siswa',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF2D3436),
                    ),
                  ),
                  Text(
                    _activeSiswaName.isEmpty
                        ? 'Monitoring data anak'
                        : _activeSiswaName,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 11,
                      color: Color(0xFF636E72),
                    ),
                  ),
                ],
              ),
            ),
            IconButton(
              onPressed: () => Navigator.pop(context),
              icon: const Icon(Icons.close_rounded, size: 22),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAnakSelector() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<int>(
          value: _activeSiswaId > 0 ? _activeSiswaId : null,
          isExpanded: true,
          icon: const Icon(Icons.keyboard_arrow_down_rounded),
          items: _anakList.map((anak) {
            final id = (anak['id'] as num?)?.toInt();
            return DropdownMenuItem<int>(
              value: id,
              child: Text(
                '${anak['nama'] ?? '-'} - ${anak['kelas'] ?? '-'}',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            );
          }).toList(),
          onChanged: _selectAnak,
        ),
      ),
    );
  }

  Widget _buildOfflineBanner() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF3E0),
        borderRadius: BorderRadius.circular(16),
      ),
      child: const Text(
        'Mode offline - menampilkan biodata terakhir tersimpan.',
        style: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          color: Color(0xFFE65100),
        ),
      ),
    );
  }

  Widget _buildBody() {
    if (_isLoading) {
      return const SizedBox(
        height: 360,
        child: Center(
          child: CircularProgressIndicator(color: Color(0xFF138F81)),
        ),
      );
    }

    if (_errorMessage.isNotEmpty) {
      return _buildEmptyState(_errorMessage);
    }

    if (_biodata == null) {
      return _buildEmptyState('Biodata siswa belum tersedia');
    }

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFE1EFF7),
        borderRadius: BorderRadius.circular(30),
      ),
      child: Column(
        children: [
          _buildSection('Data Santri', [
            ('Nama Lengkap', _text('nama')),
            ('NIS', _text('nis')),
            ('NISN', _text('nisn')),
            ('Jenis Kelamin', _text('jk')),
            (
              'Tempat/Tgl Lahir',
              '${_text('tempatLahir')}, ${_text('tglLahir')}',
            ),
            ('Kelas', _text('kelas')),
            ('Jenis Santri', _text('jenisSantri')),
            ('Sekolah Asal', _text('asalSekolah')),
            ('Alamat', _text('alamat')),
            ('No WhatsApp', _text('noWhatsapp')),
          ]),
          _buildSection('Data Orang Tua', [
            ('Nama Ayah', _text('namaAyah')),
            ('Pekerjaan Ayah', _text('pekerjaanAyah')),
            ('No WA Ayah', _text('noWhatsappAyah')),
            ('Nama Ibu', _text('namaIbu')),
            ('Pekerjaan Ibu', _text('pekerjaanIbu')),
            ('No WA Ibu', _text('noWhatsappIbu')),
          ]),
          _buildSection('Data Wali', [
            ('Wali Sama Dengan', _waliLabel(_text('waliSamaDengan'))),
            ('Nama Wali', _text('namaWali')),
            ('Pekerjaan Wali', _text('pekerjaanWali')),
            ('Alamat Wali', _text('alamatWali')),
            ('No Telp Wali', _text('telpWali')),
          ]),
          _buildSection('Data Profil', [
            ('Tempat Tinggal', _text('tempatTinggal')),
            ('Transportasi', _text('transportasi')),
            ('Tinggi Badan', '${_text('tinggiBadan')} cm'),
            ('Berat Badan', '${_text('beratBadan')} kg'),
            ('Golongan Darah', _text('golonganDarah')),
            ('Catatan', _text('catatanSantri')),
          ]),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: _printBiodata,
              icon: const Icon(Icons.print_rounded, size: 20),
              label: const Text('Cetak / Download PDF Biodata'),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF138F81),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(18),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSection(String title, List<(String, String)> rows) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w800,
              color: Color(0xFF138F81),
            ),
          ),
          const SizedBox(height: 8),
          ...rows.map((row) => _buildRow(row.$1, row.$2)),
        ],
      ),
    );
  }

  Widget _buildRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 122,
            child: Text(
              label,
              style: const TextStyle(
                fontSize: 11,
                color: Color(0xFF636E72),
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(
                fontSize: 12,
                color: Color(0xFF2D3436),
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyState(String message) {
    return Container(
      width: double.infinity,
      height: 340,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFFE1EFF7),
        borderRadius: BorderRadius.circular(30),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.badge_outlined, size: 46, color: Color(0xFF636E72)),
          const SizedBox(height: 12),
          Text(
            message,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 13,
              color: Color(0xFF636E72),
              height: 1.4,
            ),
          ),
          const SizedBox(height: 16),
          ElevatedButton(
            onPressed: _loadAnakData,
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF138F81),
              foregroundColor: Colors.white,
            ),
            child: const Text('Muat Ulang'),
          ),
        ],
      ),
    );
  }

  String _waliLabel(String value) {
    final clean = value.trim().toLowerCase();
    if (clean == 'ayah') return 'Ayah';
    if (clean == 'ibu') return 'Ibu';
    if (clean == 'wali' || clean == 'lainnya' || clean == 'lain') {
      return 'Wali';
    }
    return value == '-' ? '-' : value;
  }
}
