import 'dart:async';

import 'package:flutter/material.dart';

import '../../services/api_service.dart';
import '../../services/cache_service.dart';
import '../../services/nilai_export_service.dart';
import '../../services/session_service.dart';
import '../../services/sync_service.dart';

class NilaiOrtuScreen extends StatefulWidget {
  const NilaiOrtuScreen({super.key});

  @override
  State<NilaiOrtuScreen> createState() => _NilaiOrtuScreenState();
}

class _NilaiOrtuScreenState extends State<NilaiOrtuScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _animController;
  late Animation<double> _fadeIn;
  StreamSubscription<AppDataEvent>? _syncSub;

  bool _isLoading = true;
  bool _isUsingCache = false;
  String _statusMessage = '';
  String _errorMessage = '';

  int _waliId = 0;
  List<Map<String, dynamic>> _anakList = [];
  int _activeSiswaId = 0;
  String _activeSiswaName = '';

  double _rataRataPelajaran = 0;
  double _rataRataHafalan = 0;
  String _predikatPelajaran = '-';
  int _totalMapel = 0;
  String _capaianHafalan = '0/0';
  List<Map<String, dynamic>> _nilaiPelajaran = [];
  List<Map<String, dynamic>> _nilaiHafalan = [];
  List<dynamic> _tahunAjaranOptions = [];
  List<dynamic> _semesterOptions = [];
  String? _selectedSemester;
  String? _selectedTahunAjaran;

  final Set<int> _expandedMapel = {};

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    _fadeIn = Tween<double>(
      begin: 0,
      end: 1,
    ).animate(CurvedAnimation(parent: _animController, curve: Curves.easeOut));
    _animController.forward();
    _loadAnakData();
    _syncSub = SyncService.dataEvents.listen((event) {
      if (!mounted) return;
      if (event.topic == SyncTopics.session ||
          event.topic == SyncTopics.nilai ||
          event.topic == SyncTopics.hafalan ||
          event.topic == SyncTopics.heartbeat) {
        _loadAnakData(refreshOnly: true);
      }
    });
  }

  @override
  void dispose() {
    _syncSub?.cancel();
    _animController.dispose();
    super.dispose();
  }

  Future<void> _loadAnakData({bool refreshOnly = false}) async {
    final waliId = await SessionService.getUserId();
    final anakList = await SessionService.getAnakList();
    final activeSiswaId = await SessionService.getActiveSiswaId();
    final activeSiswaName = await SessionService.getActiveSiswaNama();

    final firstAnak = anakList.isNotEmpty
        ? anakList.first
        : <String, dynamic>{};
    final resolvedSiswaId = activeSiswaId > 0
        ? activeSiswaId
        : int.tryParse(firstAnak['id']?.toString() ?? '') ?? 0;
    final resolvedSiswaName = activeSiswaName.isNotEmpty
        ? activeSiswaName
        : firstAnak['nama']?.toString() ?? '';

    if (!refreshOnly && mounted) {
      setState(() {
        _waliId = waliId;
        _anakList = anakList;
        _activeSiswaId = resolvedSiswaId;
        _activeSiswaName = resolvedSiswaName;
      });
    } else {
      _waliId = waliId;
      _anakList = anakList;
      _activeSiswaId = resolvedSiswaId;
      _activeSiswaName = resolvedSiswaName;
    }

    if (_activeSiswaId > 0) {
      await _loadNilai();
    } else if (mounted) {
      setState(() {
        _isLoading = false;
        _errorMessage = 'Data anak belum tersedia di sesi login';
      });
    }
  }

  Future<void> _loadNilai() async {
    setState(() {
      _isLoading = true;
      _errorMessage = '';
      _statusMessage = '';
    });

    final cacheKey =
        'nilai_ortu_v3_${_waliId}_${_activeSiswaId}_${_selectedTahunAjaran ?? 'all'}_${_selectedSemester ?? 'all'}';
    final cached = await CacheService.get(cacheKey);
    if (cached is Map<String, dynamic> && mounted) {
      _applyPayload(cached, fromCache: true);
    }

    try {
      final result = await ApiService.getNilaiAnak(
        _activeSiswaId,
        semester: _selectedSemester,
        tahunAjaran: _selectedTahunAjaran,
        waliId: _waliId,
      );
      await CacheService.save(cacheKey, result);
      if (!mounted) return;
      _applyPayload(result, fromCache: false);
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _isLoading = false;
        if (cached == null) {
          _errorMessage =
              'Tidak ada koneksi internet. Data nilai belum bisa dimuat saat offline.';
        } else {
          _statusMessage =
              'Offline. Menampilkan data nilai terakhir yang sudah tersinkron.';
        }
      });
    }
  }

  void _applyPayload(Map<String, dynamic> result, {required bool fromCache}) {
    var shouldReloadWithDefaultFilter = false;

    setState(() {
      _rataRataPelajaran = (result['rata_rata_total'] as num?)?.toDouble() ?? 0;
      _predikatPelajaran = result['predikat_total']?.toString() ?? '-';
      _totalMapel = (result['total_mapel'] as num?)?.toInt() ?? 0;
      _rataRataHafalan = (result['rata_rata_hafalan'] as num?)?.toDouble() ?? 0;
      _capaianHafalan = result['capaian_hafalan']?.toString() ?? '0/0';
      _nilaiPelajaran = List<Map<String, dynamic>>.from(
        result['nilai_pelajaran'] ?? const [],
      );
      _nilaiHafalan = List<Map<String, dynamic>>.from(
        result['nilai_hafalan'] ?? const [],
      );
      _tahunAjaranOptions = List.from(
        result['tahun_ajaran_options'] ?? const [],
      );
      _semesterOptions = List.from(result['semester_options'] ?? const []);
      _isUsingCache = fromCache;
      _isLoading = false;
      _selectedTahunAjaran ??= result['selected_tahun_ajaran']?.toString();
      _selectedSemester ??= result['selected_semester']?.toString();
      if (_selectedTahunAjaran != null &&
          !_tahunAjaranOptions.contains(_selectedTahunAjaran)) {
        _selectedTahunAjaran = null;
      }
      if (_selectedSemester != null &&
          !_semesterOptions.contains(_selectedSemester)) {
        _selectedSemester = null;
      }
      if ((_selectedTahunAjaran == null || _selectedTahunAjaran!.isEmpty) &&
          _tahunAjaranOptions.isNotEmpty) {
        _selectedTahunAjaran = _tahunAjaranOptions.first.toString();
        shouldReloadWithDefaultFilter =
            shouldReloadWithDefaultFilter ||
            (result['selected_tahun_ajaran']?.toString().isEmpty ?? true);
      }
      if ((_selectedSemester == null || _selectedSemester!.isEmpty) &&
          _semesterOptions.isNotEmpty) {
        _selectedSemester = _semesterOptions.first.toString();
        shouldReloadWithDefaultFilter =
            shouldReloadWithDefaultFilter ||
            (result['selected_semester']?.toString().isEmpty ?? true);
      }
    });

    if (!fromCache &&
        shouldReloadWithDefaultFilter &&
        _selectedTahunAjaran != null &&
        _selectedSemester != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          _loadNilai();
        }
      });
    }
  }

  Future<void> _selectAnak(int siswaId, String siswaNama) async {
    await SessionService.setActiveSiswa(siswaId: siswaId, siswaNama: siswaNama);
    setState(() {
      _activeSiswaId = siswaId;
      _activeSiswaName = siswaNama;
      _selectedTahunAjaran = null;
      _selectedSemester = null;
      _expandedMapel.clear();
    });
    await _loadNilai();
  }

  Future<void> _showExportOptions() async {
    await showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) {
        Widget option(String label, String scope) {
          return ListTile(
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
            ),
            tileColor: const Color(0xFFE1EFF7),
            title: Text(label),
            trailing: const Icon(Icons.arrow_forward_ios_rounded, size: 16),
            onTap: () async {
              Navigator.pop(context);
              try {
                final payload = await ApiService.getPenilaianDokumen(
                  userId: _waliId,
                  siswaId: _activeSiswaId,
                  semester: _selectedSemester,
                  tahunAjaran: _selectedTahunAjaran,
                  reportScope: scope,
                );
                await NilaiExportService.printStudentReport(
                  payload,
                  reportScope: scope,
                );
              } catch (_) {
                if (!mounted) return;
                ScaffoldMessenger.of(this.context).showSnackBar(
                  SnackBar(
                    content: const Text('Gagal membuat dokumen nilai'),
                    backgroundColor: const Color(0xFFD63031),
                    behavior: SnackBarBehavior.floating,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                );
              }
            },
          );
        }

        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text(
                  'Download / Cetak Dokumen Nilai',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 14),
                option('Nilai Pelajaran', 'pelajaran'),
                const SizedBox(height: 8),
                option('Nilai Hafalan', 'hafalan'),
                const SizedBox(height: 8),
                option('Gabungan Nilai + Hafalan', 'gabungan'),
              ],
            ),
          ),
        );
      },
    );
  }

  Color _getPredikatColor(String predikat) {
    switch (predikat) {
      case 'A':
        return const Color(0xFF138F81);
      case 'B':
        return const Color(0xFF2E86DE);
      case 'BC':
        return const Color(0xFF6C5CE7);
      case 'C':
        return const Color(0xFFFFB74D);
      case 'D':
        return const Color(0xFFE65100);
      default:
        return const Color(0xFF636E72);
    }
  }

  Color _getStatusColor(String status) {
    switch (status) {
      case 'Selesai':
        return const Color(0xFF138F81);
      case 'Proses':
        return const Color(0xFFFFB74D);
      case 'Belum':
        return const Color(0xFF636E72);
      default:
        return const Color(0xFF6C5CE7);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFFDC80),
      body: SafeArea(
        child: FadeTransition(
          opacity: _fadeIn,
          child: Column(
            children: [
              _buildHeader(),
              const SizedBox(height: 10),
              Expanded(
                child: RefreshIndicator(
                  onRefresh: _loadNilai,
                  color: const Color(0xFF138F81),
                  child: SingleChildScrollView(
                    physics: const AlwaysScrollableScrollPhysics(
                      parent: BouncingScrollPhysics(),
                    ),
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Column(
                      children: [
                        if (_anakList.length > 1) _buildAnakSelector(),
                        if (_anakList.length > 1) const SizedBox(height: 10),
                        if (_statusMessage.isNotEmpty || _isUsingCache)
                          _buildStatusBanner(),
                        if (_statusMessage.isNotEmpty || _isUsingCache)
                          const SizedBox(height: 10),
                        _buildSummaryCard(),
                        const SizedBox(height: 12),
                        if (_tahunAjaranOptions.length > 1)
                          _buildTahunAjaranSelector(),
                        if (_tahunAjaranOptions.length > 1)
                          const SizedBox(height: 10),
                        if (_semesterOptions.length > 1)
                          _buildSemesterSelector(),
                        if (_semesterOptions.length > 1)
                          const SizedBox(height: 10),
                        _buildActionRow(),
                        const SizedBox(height: 14),
                        _buildPelajaranSection(),
                        const SizedBox(height: 14),
                        _buildHafalanSection(),
                        const SizedBox(height: 20),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
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
                Icons.school_rounded,
                color: Color(0xFF6C5CE7),
                size: 28,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Nilai Rapor',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF2D3436),
                    ),
                  ),
                  Text(
                    _activeSiswaName.isNotEmpty
                        ? _activeSiswaName
                        : 'Memuat data anak...',
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
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        color: const Color(0xFFE1EFF7),
        borderRadius: BorderRadius.circular(16),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<int>(
          value: _activeSiswaId > 0 ? _activeSiswaId : null,
          isExpanded: true,
          hint: const Text('Pilih anak'),
          icon: const Icon(Icons.keyboard_arrow_down_rounded),
          style: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w600,
            color: Color(0xFF2D3436),
          ),
          items: _anakList.map((anak) {
            return DropdownMenuItem<int>(
              value: (anak['id'] as num?)?.toInt(),
              child: Text(
                '${anak['nama']} - ${anak['kelas'] ?? ''}',
                style: const TextStyle(fontSize: 13),
              ),
            );
          }).toList(),
          onChanged: (value) {
            if (value == null || value == _activeSiswaId) return;
            final anak = _anakList.firstWhere((item) => item['id'] == value);
            _selectAnak(value, anak['nama']?.toString() ?? '');
          },
        ),
      ),
    );
  }

  Widget _buildStatusBanner() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: _isUsingCache
            ? const Color(0xFFFFF3E0)
            : const Color(0xFFE8F7F5),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color:
              (_isUsingCache
                      ? const Color(0xFFE65100)
                      : const Color(0xFF138F81))
                  .withValues(alpha: 0.25),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            _isUsingCache ? Icons.cloud_off_rounded : Icons.info_rounded,
            size: 18,
            color: _isUsingCache
                ? const Color(0xFFE65100)
                : const Color(0xFF138F81),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              _statusMessage.isNotEmpty
                  ? _statusMessage
                  : 'Offline. Menampilkan data nilai terakhir yang sudah tersinkron.',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: _isUsingCache
                    ? const Color(0xFFE65100)
                    : const Color(0xFF138F81),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSummaryCard() {
    if (_isLoading) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: const Color(0xFFE1EFF7),
          borderRadius: BorderRadius.circular(22),
        ),
        child: const Center(
          child: CircularProgressIndicator(color: Color(0xFF138F81)),
        ),
      );
    }

    if (_errorMessage.isNotEmpty) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: const Color(0xFFE1EFF7),
          borderRadius: BorderRadius.circular(22),
        ),
        child: Column(
          children: [
            const Icon(
              Icons.cloud_off_rounded,
              size: 42,
              color: Color(0xFFD63031),
            ),
            const SizedBox(height: 10),
            Text(
              _errorMessage,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 13, color: Color(0xFF636E72)),
            ),
          ],
        ),
      );
    }

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(22),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF138F81), Color(0xFF0984E3), Color(0xFF6C5CE7)],
        ),
      ),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Rata-rata Pelajaran',
                      style: TextStyle(
                        fontSize: 10,
                        color: Colors.white.withValues(alpha: 0.7),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      _rataRataPelajaran.toStringAsFixed(1),
                      style: const TextStyle(
                        fontSize: 34,
                        fontWeight: FontWeight.w800,
                        color: Colors.white,
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                width: 62,
                height: 62,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.16),
                  borderRadius: BorderRadius.circular(18),
                ),
                child: Center(
                  child: Text(
                    _predikatPelajaran,
                    style: const TextStyle(
                      fontSize: 28,
                      fontWeight: FontWeight.w900,
                      color: Colors.white,
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: _summaryMini('Jumlah Mapel', '$_totalMapel mapel'),
              ),
              const SizedBox(width: 10),
              Expanded(child: _summaryMini('Capaian Hafalan', _capaianHafalan)),
              const SizedBox(width: 10),
              Expanded(
                child: _summaryMini(
                  'Rata-rata Hafalan',
                  _rataRataHafalan.toStringAsFixed(1),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _summaryMini(String label, String value) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: TextStyle(
              fontSize: 9,
              fontWeight: FontWeight.w600,
              color: Colors.white.withValues(alpha: 0.7),
            ),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: Colors.white,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSemesterSelector() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        color: const Color(0xFFE1EFF7),
        borderRadius: BorderRadius.circular(16),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String>(
          value: _selectedSemester,
          isExpanded: true,
          hint: const Text('Pilih Semester'),
          icon: const Icon(Icons.keyboard_arrow_down_rounded),
          style: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w600,
            color: Color(0xFF2D3436),
          ),
          items: _semesterOptions.map((semester) {
            return DropdownMenuItem<String>(
              value: semester.toString(),
              child: Text(
                semester.toString(),
                style: const TextStyle(fontSize: 13),
              ),
            );
          }).toList(),
          onChanged: (value) {
            if (value == null) return;
            setState(() => _selectedSemester = value);
            _loadNilai();
          },
        ),
      ),
    );
  }

  Widget _buildTahunAjaranSelector() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        color: const Color(0xFFE1EFF7),
        borderRadius: BorderRadius.circular(16),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String>(
          value: _selectedTahunAjaran,
          isExpanded: true,
          hint: const Text('Pilih Tahun Ajaran'),
          icon: const Icon(Icons.keyboard_arrow_down_rounded),
          style: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w600,
            color: Color(0xFF2D3436),
          ),
          items: _tahunAjaranOptions.map((tahun) {
            return DropdownMenuItem<String>(
              value: tahun.toString(),
              child: Text(
                tahun.toString(),
                style: const TextStyle(fontSize: 13),
              ),
            );
          }).toList(),
          onChanged: (value) {
            if (value == null) return;
            setState(() {
              _selectedTahunAjaran = value;
              _selectedSemester = null;
            });
            _loadNilai();
          },
        ),
      ),
    );
  }

  Widget _buildActionRow() {
    return Row(
      children: [
        Expanded(
          child: Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: const Color(0xFFE1EFF7),
              borderRadius: BorderRadius.circular(18),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Ringkasan Wali',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF2D3436),
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  [
                        if (_selectedSemester != null &&
                            _selectedSemester!.trim().isNotEmpty)
                          _selectedSemester,
                        if (_selectedTahunAjaran != null &&
                            _selectedTahunAjaran!.trim().isNotEmpty)
                          _selectedTahunAjaran,
                      ].join(' • ').isNotEmpty
                      ? [
                          if (_selectedSemester != null &&
                              _selectedSemester!.trim().isNotEmpty)
                            _selectedSemester,
                          if (_selectedTahunAjaran != null &&
                              _selectedTahunAjaran!.trim().isNotEmpty)
                            _selectedTahunAjaran,
                        ].join(' • ')
                      : 'Periode aktif',
                  style: const TextStyle(
                    fontSize: 11,
                    color: Color(0xFF636E72),
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(width: 10),
        ElevatedButton.icon(
          onPressed: _activeSiswaId > 0 ? _showExportOptions : null,
          icon: const Icon(Icons.picture_as_pdf_rounded, size: 18),
          label: const Text('Dokumen'),
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFF138F81),
            foregroundColor: Colors.white,
            elevation: 0,
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(18),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildPelajaranSection() {
    return _buildSectionContainer(
      title: 'Nilai Pelajaran',
      subtitle: 'Nilai akademik per mata pelajaran',
      icon: Icons.menu_book_rounded,
      iconColor: const Color(0xFF138F81),
      child: _nilaiPelajaran.isEmpty
          ? _emptyState('Belum ada nilai pelajaran untuk semester ini')
          : Column(children: _nilaiPelajaran.map(_buildMapelCard).toList()),
    );
  }

  Widget _buildHafalanSection() {
    return _buildSectionContainer(
      title: 'Hafalan Al-Quran',
      subtitle: 'Capaian hafalan ditampilkan terpisah',
      icon: Icons.auto_stories_rounded,
      iconColor: const Color(0xFF6C5CE7),
      child: _nilaiHafalan.isEmpty
          ? _emptyState('Belum ada data hafalan untuk semester ini')
          : Column(children: _nilaiHafalan.map(_buildHafalanCard).toList()),
    );
  }

  Widget _buildSectionContainer({
    required String title,
    required String subtitle,
    required IconData icon,
    required Color iconColor,
    required Widget child,
  }) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFE1EFF7),
        borderRadius: BorderRadius.circular(24),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: iconColor.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(icon, color: iconColor, size: 20),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF2D3436),
                      ),
                    ),
                    Text(
                      subtitle,
                      style: const TextStyle(
                        fontSize: 11,
                        color: Color(0xFF636E72),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          child,
        ],
      ),
    );
  }

  Widget _buildMapelCard(Map<String, dynamic> item) {
    final mapelId = (item['mapel_id'] as num?)?.toInt() ?? 0;
    final expanded = _expandedMapel.contains(mapelId);
    final predikat = item['predikat']?.toString() ?? '-';
    final detail = List<Map<String, dynamic>>.from(item['detail'] ?? const []);
    final color = _getPredikatColor(predikat);

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        children: [
          InkWell(
            borderRadius: BorderRadius.circular(16),
            onTap: () {
              setState(() {
                if (expanded) {
                  _expandedMapel.remove(mapelId);
                } else {
                  _expandedMapel.add(mapelId);
                }
              });
            },
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        item['mapel_nama']?.toString() ?? '-',
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF2D3436),
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Penilai: ${item['penilai_nama'] ?? '-'} (${item['penilai_role'] ?? '-'})',
                        style: const TextStyle(
                          fontSize: 11,
                          color: Color(0xFF636E72),
                        ),
                      ),
                    ],
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      '${item['rata_rata'] ?? 0}',
                      style: TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w800,
                        color: color,
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: color.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        predikat,
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: color,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(width: 8),
                Icon(
                  expanded
                      ? Icons.keyboard_arrow_up_rounded
                      : Icons.keyboard_arrow_down_rounded,
                  color: const Color(0xFF636E72),
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),
          LinearProgressIndicator(
            value: ((item['rata_rata'] as num?)?.toDouble() ?? 0) / 100,
            minHeight: 6,
            borderRadius: BorderRadius.circular(6),
            color: color,
            backgroundColor: color.withValues(alpha: 0.15),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: Text(
                  'Update terakhir: ${item['updated_at'] ?? '-'}',
                  style: const TextStyle(
                    fontSize: 11,
                    color: Color(0xFF636E72),
                  ),
                ),
              ),
              Text(
                'Komponen: ${detail.length}',
                style: const TextStyle(fontSize: 11, color: Color(0xFF636E72)),
              ),
            ],
          ),
          if (expanded) ...[
            const SizedBox(height: 10),
            const Divider(height: 1),
            const SizedBox(height: 10),
            ...detail.map((detailItem) {
              return Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        detailItem['jenis_ujian']?.toString() ?? '-',
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF2D3436),
                        ),
                      ),
                    ),
                    Text(
                      '${detailItem['nilai'] ?? '-'} (${detailItem['predikat'] ?? '-'})',
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF2D3436),
                      ),
                    ),
                  ],
                ),
              );
            }),
          ],
        ],
      ),
    );
  }

  Widget _buildHafalanCard(Map<String, dynamic> item) {
    final status = item['status']?.toString() ?? '-';
    final statusColor = _getStatusColor(status);

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  item['item_label']?.toString() ?? '-',
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF2D3436),
                  ),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 5,
                ),
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  status,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: statusColor,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            'Nilai/Capaian: ${item['nilai'] ?? '-'}',
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: Color(0xFF2D3436),
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'Penilai: ${item['penilai_nama'] ?? '-'} (${item['penilai_role'] ?? '-'})',
            style: const TextStyle(fontSize: 11, color: Color(0xFF636E72)),
          ),
          Text(
            'Update terakhir: ${item['updated_at'] ?? '-'}',
            style: const TextStyle(fontSize: 11, color: Color(0xFF636E72)),
          ),
          if ((item['keterangan']?.toString() ?? '').trim().isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              item['keterangan'].toString(),
              style: const TextStyle(fontSize: 11, color: Color(0xFF2D3436)),
            ),
          ],
        ],
      ),
    );
  }

  Widget _emptyState(String message) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 24),
      child: Center(
        child: Column(
          children: [
            Icon(Icons.assignment_rounded, size: 44, color: Colors.grey[400]),
            const SizedBox(height: 8),
            Text(
              message,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 12, color: Color(0xFF636E72)),
            ),
          ],
        ),
      ),
    );
  }
}
