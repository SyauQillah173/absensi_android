import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../services/api_service.dart';

class NilaiOrtuScreen extends StatefulWidget {
  const NilaiOrtuScreen({super.key});

  @override
  State<NilaiOrtuScreen> createState() => _NilaiOrtuScreenState();
}

class _NilaiOrtuScreenState extends State<NilaiOrtuScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _animController;
  late Animation<double> _fadeIn;

  bool _isLoading = true;
  String _errorMessage = '';

  // Data anak
  List<Map<String, dynamic>> _anakList = [];
  int _activeSiswaId = 0;
  String _activeSiswaName = '';

  // Nilai data
  double _rataRataTotal = 0;
  String _predikatTotal = '';
  int _totalMapel = 0;
  List<dynamic> _nilaiPerMapel = [];
  List<dynamic> _semesters = [];
  String? _selectedSemester;

  // Expanded mapel detail
  final Set<int> _expandedMapel = {};

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
    _loadAnakData();
  }

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
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
      _loadNilai();
    } else {
      setState(() {
        _isLoading = false;
        _errorMessage = 'Data anak tidak ditemukan';
      });
    }
  }

  Future<void> _loadNilai() async {
    setState(() {
      _isLoading = true;
      _errorMessage = '';
    });

    try {
      final result = await ApiService.getNilaiAnak(
        _activeSiswaId,
        semester: _selectedSemester,
      );

      if (mounted) {
        if (result['success'] == true) {
          setState(() {
            _rataRataTotal = (result['rata_rata_total'] ?? 0).toDouble();
            _predikatTotal = result['predikat_total']?.toString() ?? '-';
            _totalMapel = result['total_mapel'] ?? 0;
            _nilaiPerMapel = List.from(result['data'] ?? []);
            _semesters = List.from(result['semesters'] ?? []);
            _isLoading = false;

            // Auto-select first semester if not selected
            if (_selectedSemester == null && _semesters.isNotEmpty) {
              _selectedSemester = _semesters.first.toString();
            }
          });
        } else {
          setState(() {
            _errorMessage = result['message'] ?? 'Gagal memuat data';
            _isLoading = false;
          });
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = 'Tidak dapat terhubung ke server';
          _isLoading = false;
        });
      }
    }
  }

  Color _getPredikatColor(String predikat) {
    switch (predikat) {
      case 'A':
        return const Color(0xFF138F81);
      case 'B':
        return const Color(0xFF2E86DE);
      case 'C':
        return const Color(0xFFE65100);
      case 'D':
        return const Color(0xFFD63031);
      default:
        return const Color(0xFF636E72);
    }
  }

  Color _getJenisUjianColor(String jenis) {
    switch (jenis) {
      case 'UTS':
        return const Color(0xFF2E86DE);
      case 'UAS':
        return const Color(0xFF138F81);
      case 'Hafalan':
        return const Color(0xFF6C5CE7);
      case 'Tugas':
        return const Color(0xFFE65100);
      default:
        return const Color(0xFF636E72);
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
                        _buildSummaryCard(),
                        const SizedBox(height: 14),
                        if (_semesters.length > 1) _buildSemesterSelector(),
                        if (_semesters.length > 1) const SizedBox(height: 10),
                        _buildNilaiList(),
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
                        : 'Memuat...',
                    style: TextStyle(fontSize: 11, color: Colors.grey[600]),
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
              _loadNilai();
            }
          },
        ),
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
          items: _semesters.map((sem) {
            return DropdownMenuItem<String>(
              value: sem.toString(),
              child: Text(sem.toString(), style: const TextStyle(fontSize: 13)),
            );
          }).toList(),
          onChanged: (value) {
            if (value != null) {
              setState(() => _selectedSemester = value);
              _loadNilai();
            }
          },
        ),
      ),
    );
  }

  Widget _buildSummaryCard() {
    // ignore: unused_local_variable
    final predikatColor = _getPredikatColor(_predikatTotal);

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
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'RATA-RATA',
                    style: TextStyle(
                      fontSize: 9,
                      fontWeight: FontWeight.w600,
                      color: Colors.white.withValues(alpha: 0.6),
                      letterSpacing: 1.5,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    _rataRataTotal.toStringAsFixed(1),
                    style: const TextStyle(
                      fontSize: 42,
                      fontWeight: FontWeight.w800,
                      color: Colors.white,
                      height: 1,
                    ),
                  ),
                ],
              ),
              Container(
                width: 60,
                height: 60,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Center(
                  child: Text(
                    _predikatTotal,
                    style: const TextStyle(
                      fontSize: 32,
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
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'JUMLAH MAPEL',
                    style: TextStyle(
                      fontSize: 8,
                      fontWeight: FontWeight.w600,
                      color: Colors.white.withValues(alpha: 0.5),
                      letterSpacing: 1,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '$_totalMapel Mata Pelajaran',
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: Colors.white,
                    ),
                  ),
                ],
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    'PREDIKAT',
                    style: TextStyle(
                      fontSize: 8,
                      fontWeight: FontWeight.w600,
                      color: Colors.white.withValues(alpha: 0.5),
                      letterSpacing: 1,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 3,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      _predikatTotal == 'A'
                          ? 'Sangat Baik'
                          : _predikatTotal == 'B'
                          ? 'Baik'
                          : _predikatTotal == 'C'
                          ? 'Cukup'
                          : 'Kurang',
                      style: const TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        color: Colors.white,
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildNilaiList() {
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

    if (_nilaiPerMapel.isEmpty) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 40),
        child: Center(
          child: Column(
            children: [
              Icon(Icons.school_rounded, size: 48, color: Colors.grey[400]),
              const SizedBox(height: 8),
              Text(
                'Belum ada data nilai',
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
            'Nilai Per Mata Pelajaran',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: Color(0xFF2D3436),
            ),
          ),
          const SizedBox(height: 12),
          ...List.generate(
            _nilaiPerMapel.length,
            (index) => _buildMapelCard(_nilaiPerMapel[index], index),
          ),
        ],
      ),
    );
  }

  Widget _buildMapelCard(dynamic mapelData, int index) {
    final mapelNama = mapelData['mapel_nama']?.toString() ?? '-';
    final mapelKode = mapelData['mapel_kode']?.toString() ?? '-';
    final rataRata = (mapelData['rata_rata'] ?? 0).toDouble();
    final predikat = mapelData['predikat']?.toString() ?? '-';
    final detail = List.from(mapelData['detail'] ?? []);
    final predikatColor = _getPredikatColor(predikat);
    final isExpanded = _expandedMapel.contains(index);

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
      child: GestureDetector(
        onTap: () {
          setState(() {
            if (isExpanded) {
              _expandedMapel.remove(index);
            } else {
              _expandedMapel.add(index);
            }
          });
        },
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 300),
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: isExpanded
                ? Border.all(
                    color: predikatColor.withValues(alpha: 0.3),
                    width: 1.5,
                  )
                : null,
          ),
          child: Column(
            children: [
              // Header row
              Row(
                children: [
                  // Mapel initial
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: predikatColor.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Center(
                      child: Text(
                        mapelKode,
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                          color: predikatColor,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  // Mapel name + progress
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          mapelNama,
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF2D3436),
                          ),
                        ),
                        const SizedBox(height: 6),
                        // Progress bar
                        ClipRRect(
                          borderRadius: BorderRadius.circular(4),
                          child: LinearProgressIndicator(
                            value: rataRata / 100,
                            backgroundColor: predikatColor.withValues(
                              alpha: 0.1,
                            ),
                            valueColor: AlwaysStoppedAnimation(predikatColor),
                            minHeight: 6,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  // Score + predikat
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        rataRata.toStringAsFixed(1),
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                          color: predikatColor,
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 2,
                        ),
                        decoration: BoxDecoration(
                          color: predikatColor.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          predikat,
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w800,
                            color: predikatColor,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(width: 4),
                  Icon(
                    isExpanded
                        ? Icons.keyboard_arrow_up_rounded
                        : Icons.keyboard_arrow_down_rounded,
                    size: 20,
                    color: Colors.grey[400],
                  ),
                ],
              ),

              // Expanded detail
              if (isExpanded) ...[
                const SizedBox(height: 12),
                Container(
                  height: 1,
                  color: const Color(0xFF2D3436).withValues(alpha: 0.08),
                ),
                const SizedBox(height: 10),
                // Detail per jenis ujian
                ...detail.map<Widget>((d) {
                  final jenisUjian = d['jenis_ujian']?.toString() ?? '';
                  final nilai = (d['nilai'] ?? 0).toDouble();
                  final ujianColor = _getJenisUjianColor(jenisUjian);

                  return Padding(
                    padding: const EdgeInsets.only(bottom: 6),
                    child: Row(
                      children: [
                        Container(
                          width: 28,
                          height: 28,
                          decoration: BoxDecoration(
                            color: ujianColor.withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Icon(
                            jenisUjian == 'Hafalan'
                                ? Icons.menu_book_rounded
                                : jenisUjian == 'Tugas'
                                ? Icons.assignment_rounded
                                : Icons.quiz_rounded,
                            size: 14,
                            color: ujianColor,
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            jenisUjian,
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: Color(0xFF2D3436),
                            ),
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 4,
                          ),
                          decoration: BoxDecoration(
                            color: ujianColor.withValues(alpha: 0.08),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            nilai.toStringAsFixed(0),
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w800,
                              color: ujianColor,
                            ),
                          ),
                        ),
                      ],
                    ),
                  );
                }),
                // Average footer
                const SizedBox(height: 4),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 8,
                  ),
                  decoration: BoxDecoration(
                    color: predikatColor.withValues(alpha: 0.06),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'Rata-rata',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: predikatColor,
                        ),
                      ),
                      Text(
                        '${rataRata.toStringAsFixed(1)} — Predikat $predikat',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w800,
                          color: predikatColor,
                        ),
                      ),
                    ],
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
