import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import '../../services/api_service.dart';
import '../../services/cache_service.dart';
import '../../services/reference_data_service.dart';

class RekapAbsensiScreen extends StatefulWidget {
  const RekapAbsensiScreen({super.key});

  @override
  State<RekapAbsensiScreen> createState() => _RekapAbsensiScreenState();
}

class _RekapAbsensiScreenState extends State<RekapAbsensiScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _animController;
  late Animation<double> _fadeIn;

  int _selectedBulan = DateTime.now().month;
  int _selectedTahun = DateTime.now().year;
  String? _selectedKelas;
  DateTime? _tanggalMulai;
  DateTime? _tanggalAkhir;

  List<Map<String, dynamic>> _rekapData = [];
  bool _isLoading = false;
  String? _errorMessage;
  bool _isExporting = false;
  List<String> _kelasList = [];

  final List<String> _bulanNames = [
    'Januari',
    'Februari',
    'Maret',
    'April',
    'Mei',
    'Juni',
    'Juli',
    'Agustus',
    'September',
    'Oktober',
    'November',
    'Desember',
  ];

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 500),
    );
    _fadeIn = Tween<double>(
      begin: 0,
      end: 1,
    ).animate(CurvedAnimation(parent: _animController, curve: Curves.easeOut));
    _animController.forward();
    _loadReferenceKelas();
    _loadRekap();
  }

  Future<void> _loadReferenceKelas() async {
    final cached = await ReferenceDataService.getCached();
    if (cached != null && mounted && _kelasList.isEmpty) {
      setState(() {
        _kelasList = cached.kelas
            .map((item) => item['nama']?.toString() ?? '')
            .where((item) => item.isNotEmpty)
            .toList();
      });
    }

    try {
      final fresh = await ReferenceDataService.refresh();
      if (!mounted) return;
      setState(() {
        _kelasList = fresh.kelas
            .map((item) => item['nama']?.toString() ?? '')
            .where((item) => item.isNotEmpty)
            .toList();
      });
    } catch (_) {}
  }

  Future<void> _loadRekap() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    final cacheKey =
        'rekap_${_selectedBulan}_${_selectedTahun}_${_selectedKelas ?? 'all'}_${_tanggalMulai?.toIso8601String() ?? ''}_${_tanggalAkhir?.toIso8601String() ?? ''}';
    // Clear old cache to ensure fresh data
    await CacheService.delete(cacheKey);
    final result = await CacheService.fetchWithCache(
      cacheKey: cacheKey,
      apiFetch: () => ApiService.getRekapAbsensi(
        bulan: _selectedBulan,
        tahun: _selectedTahun,
        kelas: _selectedKelas,
        tanggalMulai: _tanggalMulai != null
            ? DateFormat('yyyy-MM-dd').format(_tanggalMulai!)
            : null,
        tanggalAkhir: _tanggalAkhir != null
            ? DateFormat('yyyy-MM-dd').format(_tanggalAkhir!)
            : null,
      ),
    );

    if (!mounted) return;

    if (result != null && result['success'] == true) {
      final rawData = List<Map<String, dynamic>>.from(result['data'] ?? []);

      // Map backend format to UI format
      // Backend returns: { siswa: {...}, kelas, mapel, total_hadir, total_sakit, total_izin, total_alfa, diinput_oleh }
      // UI expects: { nama, nis, kelas, mapel, hadir, sakit, izin, alfa, diinput_oleh }
      final mapped = rawData.map((item) {
        final siswa = item['siswa'] as Map<String, dynamic>? ?? {};
        return {
          'nama': siswa['nama'] ?? '-',
          'nis': siswa['nis'] ?? '-',
          'kelas': item['kelas'] ?? siswa['kelas'] ?? '-',
          'mapel': item['mapel'] ?? '-',
          'hadir': item['total_hadir'] ?? item['hadir'] ?? 0,
          'sakit': item['total_sakit'] ?? item['sakit'] ?? 0,
          'izin': item['total_izin'] ?? item['izin'] ?? 0,
          'alfa': item['total_alfa'] ?? item['alfa'] ?? 0,
          'diinput_oleh': item['diinput_oleh'] ?? 'Admin',
        };
      }).toList();

      setState(() {
        _rekapData = mapped;
        _isLoading = false;
      });
    } else {
      setState(() {
        _errorMessage =
            'Gagal memuat rekap.\nBelum ada data offline tersimpan.';
        _isLoading = false;
      });
    }
  }

  Future<void> _exportExcel() async {
    setState(() => _isExporting = true);

    try {
      // Build CSV rows
      final rows = <List<String>>[];

      // Title
      rows.add([
        'REKAP ABSENSI - ${_bulanNames[_selectedBulan - 1]} $_selectedTahun',
      ]);
      rows.add([
        'PP. Qomaruddin Bungah Gresik${_selectedKelas != null ? ' - $_selectedKelas' : ''}',
      ]);
      rows.add([]); // Empty row

      // Headers
      rows.add([
        'No',
        'NIS',
        'Nama Siswa/Santri',
        'Kelas',
        'Mapel',
        'Hadir',
        'Sakit',
        'Izin',
        'Alfa',
        'Kehadiran(%)',
        'Diinput Oleh',
      ]);

      // Data rows
      for (int i = 0; i < _rekapData.length; i++) {
        final d = _rekapData[i];
        final hadir = (d['hadir'] as num?)?.toInt() ?? 0;
        final sakit = (d['sakit'] as num?)?.toInt() ?? 0;
        final izin = (d['izin'] as num?)?.toInt() ?? 0;
        final alfa = (d['alfa'] as num?)?.toInt() ?? 0;
        final total = hadir + sakit + izin + alfa;
        final pct = total > 0 ? (hadir / total * 100).round() : 0;

        rows.add([
          '${i + 1}',
          d['nis']?.toString() ?? '-',
          d['nama']?.toString() ?? '-',
          d['kelas']?.toString() ?? '-',
          d['mapel']?.toString() ?? '-',
          '$hadir',
          '$sakit',
          '$izin',
          '$alfa',
          '$pct%',
          d['diinput_oleh']?.toString() ?? '-',
        ]);
      }

      // Footer
      rows.add([]);
      rows.add([
        'Dicetak: ${DateFormat('dd/MM/yyyy HH:mm').format(DateTime.now())}',
      ]);

      // Convert to CSV string with proper escaping
      final csvContent = StringBuffer();
      // Add UTF-8 BOM for proper character display in Excel
      csvContent.write('\uFEFF');
      for (final row in rows) {
        final escapedCells = row.map((cell) {
          // Escape cells containing comma, quotes, or newlines
          if (cell.contains(',') || cell.contains('"') || cell.contains('\n')) {
            return '"${cell.replaceAll('"', '""')}"';
          }
          return cell;
        });
        csvContent.writeln(escapedCells.join(','));
      }

      // Save as .csv file
      final dir = await getApplicationDocumentsDirectory();
      final fileName =
          'Rekap_Absensi_${_bulanNames[_selectedBulan - 1]}_$_selectedTahun.csv';
      final file = File('${dir.path}/$fileName');
      await file.writeAsString(csvContent.toString(), encoding: utf8);

      setState(() => _isExporting = false);

      if (mounted) {
        await Share.shareXFiles(
          [XFile(file.path)],
          text:
              'Rekap Absensi ${_bulanNames[_selectedBulan - 1]} $_selectedTahun',
        );
      }
    } catch (e) {
      setState(() => _isExporting = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Gagal export: $e'),
            backgroundColor: const Color(0xFFE65100),
          ),
        );
      }
    }
  }

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
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
              const SizedBox(height: 12),
              _buildFilterSection(),
              const SizedBox(height: 8),
              _buildSummaryRow(),
              const SizedBox(height: 8),

              if (_isLoading)
                const Expanded(
                  child: Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        CircularProgressIndicator(color: Color(0xFF138F81)),
                        SizedBox(height: 16),
                        Text(
                          'Memuat rekap absensi...',
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
                          style: const TextStyle(fontSize: 13),
                        ),
                        const SizedBox(height: 16),
                        ElevatedButton.icon(
                          onPressed: _loadRekap,
                          icon: const Icon(Icons.refresh_rounded),
                          label: const Text('Coba Lagi'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF138F81),
                            foregroundColor: Colors.white,
                          ),
                        ),
                      ],
                    ),
                  ),
                )
              else if (_rekapData.isEmpty)
                const Expanded(
                  child: Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          Icons.assignment_outlined,
                          size: 48,
                          color: Color(0xFF636E72),
                        ),
                        SizedBox(height: 12),
                        Text(
                          'Belum ada data absensi\npada bulan ini',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 13,
                            color: Color(0xFF636E72),
                          ),
                        ),
                      ],
                    ),
                  ),
                )
              else
                Expanded(
                  child: RefreshIndicator(
                    onRefresh: _loadRekap,
                    child: ListView.builder(
                      physics: const AlwaysScrollableScrollPhysics(
                        parent: BouncingScrollPhysics(),
                      ),
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      itemCount: _rekapData.length,
                      itemBuilder: (context, index) {
                        return _buildRekapCard(_rekapData[index], index);
                      },
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
      floatingActionButton: _rekapData.isNotEmpty
          ? FloatingActionButton.extended(
              onPressed: _isExporting ? null : _exportExcel,
              backgroundColor: const Color(0xFF138F81),
              foregroundColor: Colors.white,
              icon: _isExporting
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : const Icon(Icons.download_rounded),
              label: Text(_isExporting ? 'Mengexport...' : 'Download Excel'),
            )
          : null,
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
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: const Color(0xFF138F81).withValues(alpha: 0.15),
              ),
              child: const Icon(
                Icons.assessment_rounded,
                color: Color(0xFF138F81),
                size: 26,
              ),
            ),
            const SizedBox(width: 12),
            const Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Rekap Absensi',
                    style: TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF2D3436),
                    ),
                  ),
                  Text(
                    'Laporan bulanan kehadiran siswa',
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

  Widget _buildFilterSection() {
    final dateFormat = DateFormat('dd/MM/yyyy');
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
        ),
        child: Column(
          children: [
            // Bulan & Tahun row
            Row(
              children: [
                Expanded(
                  child: _buildDropdown(
                    label: 'Bulan',
                    value: _selectedBulan,
                    items: List.generate(12, (i) {
                      return DropdownMenuItem(
                        value: i + 1,
                        child: Text(
                          _bulanNames[i],
                          style: const TextStyle(fontSize: 12),
                        ),
                      );
                    }),
                    onChanged: (val) {
                      setState(() => _selectedBulan = val!);
                      _loadRekap();
                    },
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _buildDropdown(
                    label: 'Tahun',
                    value: _selectedTahun,
                    items: List.generate(5, (i) {
                      final year = DateTime.now().year - 2 + i;
                      return DropdownMenuItem(
                        value: year,
                        child: Text(
                          '$year',
                          style: const TextStyle(fontSize: 12),
                        ),
                      );
                    }),
                    onChanged: (val) {
                      setState(() => _selectedTahun = val!);
                      _loadRekap();
                    },
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            // Kelas filter
            _buildDropdown<String?>(
              label: 'Filter Kelas',
              value: _selectedKelas,
              items: [
                const DropdownMenuItem(
                  value: null,
                  child: Text('Semua Kelas', style: TextStyle(fontSize: 12)),
                ),
                ..._kelasList.map(
                  (k) => DropdownMenuItem(
                    value: k,
                    child: Text(k, style: const TextStyle(fontSize: 12)),
                  ),
                ),
              ],
              onChanged: (val) {
                setState(() => _selectedKelas = val);
                _loadRekap();
              },
            ),
            const SizedBox(height: 10),
            // Tanggal range (opsional)
            Row(
              children: [
                Expanded(
                  child: GestureDetector(
                    onTap: () async {
                      final picked = await showDatePicker(
                        context: context,
                        initialDate: _tanggalMulai ?? DateTime.now(),
                        firstDate: DateTime(2020),
                        lastDate: DateTime.now(),
                        helpText: 'Pilih Tanggal Mulai',
                      );
                      if (picked != null) {
                        setState(() => _tanggalMulai = picked);
                        _loadRekap();
                      }
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 10,
                      ),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF5F5F5),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: _tanggalMulai != null
                              ? const Color(0xFF138F81)
                              : const Color(0xFFE0E0E0),
                        ),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            Icons.calendar_today_rounded,
                            size: 14,
                            color: _tanggalMulai != null
                                ? const Color(0xFF138F81)
                                : const Color(0xFF636E72),
                          ),
                          const SizedBox(width: 6),
                          Expanded(
                            child: Text(
                              _tanggalMulai != null
                                  ? dateFormat.format(_tanggalMulai!)
                                  : 'Dari tgl',
                              style: TextStyle(
                                fontSize: 11,
                                color: _tanggalMulai != null
                                    ? const Color(0xFF2D3436)
                                    : const Color(0xFF636E72),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: GestureDetector(
                    onTap: () async {
                      final picked = await showDatePicker(
                        context: context,
                        initialDate: _tanggalAkhir ?? DateTime.now(),
                        firstDate: DateTime(2020),
                        lastDate: DateTime.now(),
                        helpText: 'Pilih Tanggal Akhir',
                      );
                      if (picked != null) {
                        setState(() => _tanggalAkhir = picked);
                        _loadRekap();
                      }
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 10,
                      ),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF5F5F5),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: _tanggalAkhir != null
                              ? const Color(0xFF138F81)
                              : const Color(0xFFE0E0E0),
                        ),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            Icons.calendar_today_rounded,
                            size: 14,
                            color: _tanggalAkhir != null
                                ? const Color(0xFF138F81)
                                : const Color(0xFF636E72),
                          ),
                          const SizedBox(width: 6),
                          Expanded(
                            child: Text(
                              _tanggalAkhir != null
                                  ? dateFormat.format(_tanggalAkhir!)
                                  : 'Sampai tgl',
                              style: TextStyle(
                                fontSize: 11,
                                color: _tanggalAkhir != null
                                    ? const Color(0xFF2D3436)
                                    : const Color(0xFF636E72),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                // Clear date button
                if (_tanggalMulai != null || _tanggalAkhir != null)
                  GestureDetector(
                    onTap: () {
                      setState(() {
                        _tanggalMulai = null;
                        _tanggalAkhir = null;
                      });
                      _loadRekap();
                    },
                    child: const Padding(
                      padding: EdgeInsets.only(left: 6),
                      child: Icon(
                        Icons.close_rounded,
                        size: 18,
                        color: Color(0xFFE65100),
                      ),
                    ),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDropdown<T>({
    required String label,
    required T value,
    required List<DropdownMenuItem<T>> items,
    required ValueChanged<T?> onChanged,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 2),
      decoration: BoxDecoration(
        color: const Color(0xFFF5F5F5),
        borderRadius: BorderRadius.circular(12),
      ),
      child: DropdownButtonFormField<T>(
        initialValue: value,
        items: items,
        onChanged: onChanged,
        decoration: InputDecoration(
          labelText: label,
          labelStyle: const TextStyle(fontSize: 11, color: Color(0xFF636E72)),
          border: InputBorder.none,
          contentPadding: EdgeInsets.zero,
        ),
        style: const TextStyle(fontSize: 12, color: Color(0xFF2D3436)),
        icon: const Icon(Icons.arrow_drop_down, size: 20),
        isExpanded: true,
      ),
    );
  }

  Widget _buildSummaryRow() {
    if (_rekapData.isEmpty || _isLoading) return const SizedBox.shrink();

    int totalHadir = 0, totalSakit = 0, totalIzin = 0, totalAlfa = 0;
    for (final d in _rekapData) {
      totalHadir += (d['hadir'] ?? 0) as int;
      totalSakit += (d['sakit'] ?? 0) as int;
      totalIzin += (d['izin'] ?? 0) as int;
      totalAlfa += (d['alfa'] ?? 0) as int;
    }

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Row(
        children: [
          _buildStatChip('Hadir', totalHadir, const Color(0xFF138F81)),
          const SizedBox(width: 6),
          _buildStatChip('Sakit', totalSakit, const Color(0xFF2E86DE)),
          const SizedBox(width: 6),
          _buildStatChip('Izin', totalIzin, const Color(0xFFFFB74D)),
          const SizedBox(width: 6),
          _buildStatChip('Alfa', totalAlfa, const Color(0xFFE65100)),
        ],
      ),
    );
  }

  Widget _buildStatChip(String label, int count, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 8),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          children: [
            Text(
              '$count',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w800,
                color: color,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: TextStyle(
                fontSize: 9,
                fontWeight: FontWeight.w600,
                color: color.withValues(alpha: 0.7),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildRekapCard(Map<String, dynamic> data, int index) {
    final isMale = (data['jenis_kelamin'] ?? 'L') == 'L';
    final hadir = (data['hadir'] as num?)?.toInt() ?? 0;
    final sakit = (data['sakit'] as num?)?.toInt() ?? 0;
    final izin = (data['izin'] as num?)?.toInt() ?? 0;
    final alfa = (data['alfa'] as num?)?.toInt() ?? 0;
    final total = hadir + sakit + izin + alfa;
    final pct = total > 0 ? (hadir / total * 100) : 0;
    final diinputOleh = data['diinput_oleh']?.toString() ?? 'Admin';

    final color = isMale ? const Color(0xFF2E86DE) : const Color(0xFFE65100);

    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0.0, end: 1.0),
      duration: Duration(milliseconds: 350 + (index * 40)),
      curve: Curves.easeOutCubic,
      builder: (context, value, child) {
        return Transform.translate(
          offset: Offset(0, 15 * (1 - value)),
          child: Opacity(opacity: value, child: child),
        );
      },
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Row(
          children: [
            // Avatar
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [color, color.withValues(alpha: 0.7)],
                ),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Center(
                child: Text(
                  '${index + 1}',
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w700,
                    fontSize: 14,
                  ),
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
                    data['nama']?.toString() ?? '-',
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
                          horizontal: 5,
                          vertical: 1,
                        ),
                        decoration: BoxDecoration(
                          color: const Color(0xFF6C5CE7).withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          data['kelas']?.toString() ?? '-',
                          style: const TextStyle(
                            fontSize: 8,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF6C5CE7),
                          ),
                        ),
                      ),
                      const SizedBox(width: 4),
                      Flexible(
                        child: Text(
                          'Input: $diinputOleh — ${data['mapel'] ?? '-'}',
                          style: const TextStyle(
                            fontSize: 8,
                            color: Color(0xFF636E72),
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  // Progress bar
                  ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: SizedBox(
                      height: 6,
                      child: LinearProgressIndicator(
                        value: total > 0 ? hadir / total : 0,
                        backgroundColor: const Color(0xFFE0E0E0),
                        valueColor: AlwaysStoppedAnimation(
                          pct >= 80
                              ? const Color(0xFF138F81)
                              : pct >= 60
                              ? const Color(0xFFFFB74D)
                              : const Color(0xFFE65100),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),

            // Stats
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  '${pct.toStringAsFixed(0)}%',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                    color: pct >= 80
                        ? const Color(0xFF138F81)
                        : pct >= 60
                        ? const Color(0xFFFFB74D)
                        : const Color(0xFFE65100),
                  ),
                ),
                Text(
                  'Kehadiran',
                  style: TextStyle(
                    fontSize: 7,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF636E72),
                  ),
                ),
                const SizedBox(height: 2),
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    _buildMiniStat('H', hadir, const Color(0xFF138F81)),
                    const SizedBox(width: 3),
                    _buildMiniStat('S', sakit, const Color(0xFF2E86DE)),
                    const SizedBox(width: 3),
                    _buildMiniStat('I', izin, const Color(0xFFFFB74D)),
                    const SizedBox(width: 3),
                    _buildMiniStat('A', alfa, const Color(0xFFE65100)),
                  ],
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMiniStat(String label, int count, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        '$label:$count',
        style: TextStyle(
          fontSize: 7,
          fontWeight: FontWeight.w700,
          color: color,
        ),
      ),
    );
  }
}
