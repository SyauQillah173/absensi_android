import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../services/api_service.dart';
import '../../services/cache_service.dart';
import '../../services/sync_service.dart';
import '../../widgets/app_feedback.dart';

class RiwayatAbsensiOrtuScreen extends StatefulWidget {
  const RiwayatAbsensiOrtuScreen({super.key});

  @override
  State<RiwayatAbsensiOrtuScreen> createState() =>
      _RiwayatAbsensiOrtuScreenState();
}

class _RiwayatAbsensiOrtuScreenState extends State<RiwayatAbsensiOrtuScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _animController;
  late Animation<double> _fadeIn;
  StreamSubscription<AppDataEvent>? _syncSubscription;

  bool _isLoading = true;
  bool _isOfflineMode = false;
  String _errorMessage = '';

  // Data anak
  List<Map<String, dynamic>> _anakList = [];
  int _activeSiswaId = 0;
  String _activeSiswaName = '';

  // Absensi data
  Map<String, dynamic> _stats = {};
  List<dynamic> _absensiGrouped = [];
  String _jenisAbsensi = 'madin';

  // Filter bulan
  int _selectedBulan = DateTime.now().month;
  int _selectedTahun = DateTime.now().year;

  static const _bulanNames = [
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
      duration: const Duration(milliseconds: 600),
    );
    _fadeIn = Tween<double>(
      begin: 0.0,
      end: 1.0,
    ).animate(CurvedAnimation(parent: _animController, curve: Curves.easeOut));
    _animController.forward();
    _syncSubscription = SyncService.dataEvents.listen(_handleDataEvent);
    _loadAnakData();
  }

  @override
  void dispose() {
    _syncSubscription?.cancel();
    _animController.dispose();
    super.dispose();
  }

  void _handleDataEvent(AppDataEvent event) {
    if (!mounted || _activeSiswaId <= 0) return;
    if (event.topic == SyncTopics.absensi ||
        event.topic == SyncTopics.absensiSholat ||
        event.topic == SyncTopics.heartbeat) {
      unawaited(_loadAbsensi(silent: true));
    }
  }

  Future<void> _loadAnakData() async {
    final prefs = await SharedPreferences.getInstance();
    final anakJson = prefs.getString('anak_list') ?? '[]';
    final anakList = List<Map<String, dynamic>>.from(
      (jsonDecode(anakJson) as List).map((a) => Map<String, dynamic>.from(a)),
    );
    final activeSiswaId = prefs.getInt('active_siswa_id') ?? 0;
    final activeSiswaName = prefs.getString('active_siswa_nama') ?? '';

    setState(() {
      _anakList = anakList;
      _activeSiswaId = activeSiswaId;
      _activeSiswaName = activeSiswaName;
    });

    if (_activeSiswaId > 0) {
      _loadAbsensi();
    } else {
      setState(() {
        _isLoading = false;
        _errorMessage = 'Data anak tidak ditemukan';
      });
    }
  }

  Future<void> _loadAbsensi({bool silent = false}) async {
    if (!silent) {
      setState(() {
        _isLoading = true;
        _errorMessage = '';
      });
    }

    final cacheKey =
        'wali_absensi_${_jenisAbsensi}_${_activeSiswaId}_${_selectedBulan}_$_selectedTahun';

    try {
      final result = _jenisAbsensi == 'sholat'
          ? await ApiService.getAbsensiSholatAnak(
              _activeSiswaId,
              bulan: _selectedBulan,
              tahun: _selectedTahun,
            )
          : await ApiService.getAbsensiAnak(
              _activeSiswaId,
              bulan: _selectedBulan,
              tahun: _selectedTahun,
            );

      if (mounted) {
        if (result['success'] == true) {
          await CacheService.save(cacheKey, result);
          setState(() {
            _stats = Map<String, dynamic>.from(result['stats'] ?? {});
            _absensiGrouped = List.from(result['data'] ?? []);
            _isLoading = false;
            _isOfflineMode = false;
          });
        } else {
          setState(() {
            _errorMessage = result['message'] ?? 'Gagal memuat data';
            _isLoading = false;
          });
        }
      }
    } catch (e) {
      final cached = await CacheService.get(cacheKey);
      if (cached is Map<String, dynamic> && mounted) {
        setState(() {
          _stats = Map<String, dynamic>.from(cached['stats'] ?? {});
          _absensiGrouped = List.from(cached['data'] ?? []);
          _isLoading = false;
          _isOfflineMode = true;
          _errorMessage = '';
        });
        return;
      }

      if (mounted) {
        setState(() {
          _errorMessage = 'Tidak dapat terhubung ke server';
          _isLoading = false;
          _isOfflineMode = false;
        });
      }
    }
  }

  Color _getStatusColor(String status) {
    switch (status) {
      case 'Hadir':
      case 'Masuk':
        return const Color(0xFF138F81);
      case 'Sakit':
        return const Color(0xFF2E86DE);
      case 'Izin':
        return const Color(0xFFE65100);
      case 'Alfa':
        return const Color(0xFFD63031);
      default:
        return const Color(0xFF636E72);
    }
  }

  IconData _getStatusIcon(String status) {
    switch (status) {
      case 'Hadir':
      case 'Masuk':
        return Icons.check_circle_rounded;
      case 'Sakit':
        return Icons.local_hospital_rounded;
      case 'Izin':
        return Icons.event_note_rounded;
      case 'Alfa':
        return Icons.cancel_rounded;
      default:
        return Icons.help_rounded;
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
              _buildProfileBar(),
              const SizedBox(height: 12),
              Expanded(
                child: AppRefreshIndicator(
                  onRefresh: _loadAbsensi,
                  child: SingleChildScrollView(
                    physics: const AlwaysScrollableScrollPhysics(
                      parent: BouncingScrollPhysics(),
                    ),
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Column(
                      children: [
                        if (_anakList.length > 1) _buildAnakSelector(),
                        if (_anakList.length > 1) const SizedBox(height: 10),
                        _buildJenisSelector(),
                        const SizedBox(height: 10),
                        _buildMonthSelector(),
                        const SizedBox(height: 10),
                        _buildStatsCard(),
                        const SizedBox(height: 14),
                        _buildAbsensiList(),
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
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                color: Color(0xFFFFDC80),
              ),
              child: const Icon(
                Icons.fact_check_rounded,
                color: Color(0xFF138F81),
                size: 28,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Riwayat Absensi',
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF2D3436),
                    ),
                  ),
                  Text(
                    _activeSiswaName.isNotEmpty
                        ? _activeSiswaName
                        : 'Memuat...',
                    style: TextStyle(fontSize: 11, color: Colors.grey[600]),
                  ),
                  if (_isOfflineMode)
                    Container(
                      margin: const EdgeInsets.only(top: 4),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 3,
                      ),
                      decoration: BoxDecoration(
                        color: const Color(0xFFE65100).withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Text(
                        'Offline - menampilkan cache final terakhir',
                        style: TextStyle(
                          fontSize: 9,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFFE65100),
                        ),
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
          value: _activeSiswaId,
          isExpanded: true,
          icon: const Icon(Icons.keyboard_arrow_down_rounded),
          style: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w600,
            color: Color(0xFF2D3436),
          ),
          items: _anakList.map((anak) {
            return DropdownMenuItem<int>(
              value: anak['id'] as int,
              child: Text(
                '${anak['nama']} — ${anak['kelas'] ?? ''}',
                style: const TextStyle(fontSize: 13),
              ),
            );
          }).toList(),
          onChanged: (value) async {
            if (value != null && value != _activeSiswaId) {
              final anak = _anakList.firstWhere((a) => a['id'] == value);
              final prefs = await SharedPreferences.getInstance();
              await prefs.setInt('active_siswa_id', value);
              await prefs.setString('active_siswa_nama', anak['nama'] ?? '');
              setState(() {
                _activeSiswaId = value;
                _activeSiswaName = anak['nama'] ?? '';
              });
              _loadAbsensi();
            }
          },
        ),
      ),
    );
  }

  Widget _buildJenisSelector() {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: const Color(0xFFE1EFF7),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          _buildJenisButton('madin', 'Absensi Madin'),
          _buildJenisButton('sholat', 'Jamaah Sholat'),
        ],
      ),
    );
  }

  Widget _buildJenisButton(String value, String label) {
    final selected = _jenisAbsensi == value;
    return Expanded(
      child: GestureDetector(
        onTap: () {
          if (_jenisAbsensi == value) return;
          setState(() => _jenisAbsensi = value);
          _loadAbsensi();
        },
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          padding: const EdgeInsets.symmetric(vertical: 11),
          decoration: BoxDecoration(
            color: selected ? const Color(0xFF138F81) : Colors.transparent,
            borderRadius: BorderRadius.circular(13),
          ),
          alignment: Alignment.center,
          child: Text(
            label,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w800,
              color: selected ? Colors.white : const Color(0xFF636E72),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildMonthSelector() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFFE1EFF7),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          GestureDetector(
            onTap: () {
              setState(() {
                if (_selectedBulan == 1) {
                  _selectedBulan = 12;
                  _selectedTahun--;
                } else {
                  _selectedBulan--;
                }
              });
              _loadAbsensi();
            },
            child: Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: const Color(0xFF138F81).withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(
                Icons.chevron_left_rounded,
                size: 20,
                color: Color(0xFF138F81),
              ),
            ),
          ),
          Text(
            '${_bulanNames[_selectedBulan - 1]} $_selectedTahun',
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: Color(0xFF2D3436),
            ),
          ),
          GestureDetector(
            onTap: () {
              setState(() {
                if (_selectedBulan == 12) {
                  _selectedBulan = 1;
                  _selectedTahun++;
                } else {
                  _selectedBulan++;
                }
              });
              _loadAbsensi();
            },
            child: Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: const Color(0xFF138F81).withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(
                Icons.chevron_right_rounded,
                size: 20,
                color: Color(0xFF138F81),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatsCard() {
    final hadir = _jenisAbsensi == 'sholat' ? (_stats['masuk'] ?? 0) : (_stats['hadir'] ?? 0);
    final sakit = _stats['sakit'] ?? 0;
    final izin = _stats['izin'] ?? 0;
    final alfa = _stats['alfa'] ?? 0;
    final total = _stats['total'] ?? 0;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFE1EFF7),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 24,
                height: 24,
                decoration: BoxDecoration(
                  color: const Color(0xFF138F81).withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(7),
                ),
                child: const Icon(
                  Icons.analytics_rounded,
                  size: 14,
                  color: Color(0xFF138F81),
                ),
              ),
              const SizedBox(width: 8),
              const Text(
                'Ringkasan Bulan Ini',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF2D3436),
                ),
              ),
              const Spacer(),
              Text(
                'Total: $total',
                style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF636E72),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              _buildStatItem(_jenisAbsensi == 'sholat' ? 'Masuk' : 'Hadir', hadir, const Color(0xFF138F81)),
              const SizedBox(width: 8),
              _buildStatItem('Sakit', sakit, const Color(0xFF2E86DE)),
              const SizedBox(width: 8),
              _buildStatItem('Izin', izin, const Color(0xFFE65100)),
              const SizedBox(width: 8),
              _buildStatItem('Alfa', alfa, const Color(0xFFD63031)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildStatItem(String label, int count, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          children: [
            Text(
              '$count',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w800,
                color: color,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w600,
                color: color,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAbsensiList() {
    if (_isLoading) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 40),
        child: Center(
          child: CircularProgressIndicator(color: Color(0xFF138F81)),
        ),
      );
    }

    if (_errorMessage.isNotEmpty) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 40),
        child: Center(
          child: Column(
            children: [
              const Icon(
                Icons.error_outline,
                size: 48,
                color: Color(0xFFD63031),
              ),
              const SizedBox(height: 8),
              Text(
                _errorMessage,
                style: const TextStyle(color: Color(0xFF636E72), fontSize: 13),
              ),
            ],
          ),
        ),
      );
    }

    if (_absensiGrouped.isEmpty) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 40),
        child: Center(
          child: Column(
            children: [
              Icon(
                Icons.event_available_rounded,
                size: 48,
                color: Colors.grey[400],
              ),
              const SizedBox(height: 8),
              Text(
                'Belum ada data absensi bulan ini',
                style: TextStyle(color: Colors.grey[500], fontSize: 13),
              ),
            ],
          ),
        ),
      );
    }

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFE1EFF7),
        borderRadius: BorderRadius.circular(25),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Riwayat Absensi',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: Color(0xFF2D3436),
            ),
          ),
          const SizedBox(height: 12),
          ...List.generate(
            _absensiGrouped.length,
            (index) => _buildDayCard(_absensiGrouped[index], index),
          ),
        ],
      ),
    );
  }

  Widget _buildDayCard(dynamic dayData, int index) {
    final tanggal = dayData['tanggal']?.toString() ?? '';
    final hari = dayData['hari']?.toString() ?? '';
    final records = List.from(dayData['records'] ?? []);

    // Format tanggal: "1 Maret 2026"
    String formattedDate = tanggal;
    try {
      final dt = DateTime.parse(tanggal);
      formattedDate = '${dt.day} ${_bulanNames[dt.month - 1]} ${dt.year}';
    } catch (_) {}

    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0.0, end: 1.0),
      duration: Duration(milliseconds: 400 + (index * 80)),
      curve: Curves.easeOutCubic,
      builder: (context, value, child) {
        return Opacity(
          opacity: value,
          child: Transform.translate(
            offset: Offset(0, 20 * (1 - value)),
            child: child,
          ),
        );
      },
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Date header
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0xFF2E86DE).withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    hari,
                    style: const TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF2E86DE),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  formattedDate,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF2D3436),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            // Records per mapel
            ...records.map<Widget>((record) {
              final status = record['status']?.toString() ?? '';
              final mapel = record['mapel']?.toString() ?? '-';
              final keterangan = record['keterangan']?.toString() ?? '';
              final diinputOleh = record['diinput_oleh']?.toString() ?? '';
              final waktu = record['waktu']?.toString() ?? '';
              final statusColor = _getStatusColor(status);
              final statusIcon = _getStatusIcon(status);

              return Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.04),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: statusColor.withValues(alpha: 0.15),
                    width: 1,
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(statusIcon, size: 18, color: statusColor),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            mapel,
                            style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF2D3436),
                            ),
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 3,
                          ),
                          decoration: BoxDecoration(
                            color: statusColor.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            status,
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w800,
                              color: statusColor,
                            ),
                          ),
                        ),
                      ],
                    ),
                    if (diinputOleh.isNotEmpty) ...[
                      const SizedBox(height: 6),
                      Row(
                        children: [
                          const SizedBox(width: 26),
                          Icon(
                            Icons.person_rounded,
                            size: 12,
                            color: Colors.grey[500],
                          ),
                          const SizedBox(width: 4),
                          Text(
                            'Oleh: $diinputOleh',
                            style: TextStyle(
                              fontSize: 10,
                              color: Colors.grey[600],
                            ),
                          ),
                          const Spacer(),
                          if (waktu.isNotEmpty)
                            Text(
                              waktu,
                              style: TextStyle(
                                fontSize: 10,
                                color: Colors.grey[500],
                              ),
                            ),
                        ],
                      ),
                    ],
                    if (status == 'Alfa' && keterangan.isNotEmpty) ...[
                      const SizedBox(height: 6),
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(8),
                        margin: const EdgeInsets.only(left: 26),
                        decoration: BoxDecoration(
                          color: const Color(
                            0xFFD63031,
                          ).withValues(alpha: 0.06),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Icon(
                              Icons.info_outline_rounded,
                              size: 14,
                              color: Color(0xFFD63031),
                            ),
                            const SizedBox(width: 6),
                            Expanded(
                              child: Text(
                                'Alasan: $keterangan',
                                style: const TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w500,
                                  color: Color(0xFFD63031),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ],
                ),
              );
            }),
          ],
        ),
      ),
    );
  }
}
