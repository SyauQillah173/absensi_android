import 'package:flutter/material.dart';
import '../../services/api_service.dart';

class NilaiInputScreen extends StatefulWidget {
  const NilaiInputScreen({super.key});

  @override
  State<NilaiInputScreen> createState() => _NilaiInputScreenState();
}

class _NilaiInputScreenState extends State<NilaiInputScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  bool _isLoading = true;
  // Flat list of kelas for dropdown: [{nama: 'Sifir Awal A PA', id: 1, ...}]
  List<Map<String, dynamic>> _kelasFlatList = [];
  List<Map<String, dynamic>> _mapelList = [];
  String? _selectedKelas;

  List<Map<String, dynamic>> _siswaList = [];
  List<Map<String, dynamic>> _nilaiList = [];
  List<Map<String, dynamic>> _hafalanList = [];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _loadInitialData();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadInitialData() async {
    setState(() => _isLoading = true);
    try {
      final kelasResult = await ApiService.getKelompokBelajar();
      final mapelResult = await ApiService.getMataPelajaran();
      if (mounted) {
        // API returns grouped: [{kategori, kelas: [{id, nama, sifir, jumlah_siswa}]}]
        // Flatten to simple list for dropdown
        final groupedData = List<Map<String, dynamic>>.from(kelasResult['data'] ?? []);
        final flatList = <Map<String, dynamic>>[];
        for (var group in groupedData) {
          final kelasList = List<Map<String, dynamic>>.from(group['kelas'] ?? []);
          for (var kelas in kelasList) {
            flatList.add({
              'id': kelas['id'],
              'nama': kelas['nama']?.toString() ?? '',
              'sifir': kelas['sifir']?.toString() ?? '',
              'kategori': group['kategori']?.toString() ?? '',
            });
          }
        }
        setState(() {
          _kelasFlatList = flatList;
          _mapelList = List<Map<String, dynamic>>.from(mapelResult['data'] ?? []);
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Gagal memuat data: $e'),
            backgroundColor: const Color(0xFFD63031),
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
        );
      }
    }
  }

  Future<void> _loadSiswaByKelas(String kelas) async {
    try {
      final result = await ApiService.getSiswa(kelas: kelas);
      if (mounted) {
        setState(() {
          _siswaList = List<Map<String, dynamic>>.from(result['data'] ?? []);
        });
      }
    } catch (_) {}
  }

  Future<void> _loadNilai() async {
    try {
      final result = await ApiService.getNilai(kelas: _selectedKelas);
      if (mounted) {
        setState(() {
          _nilaiList = List<Map<String, dynamic>>.from(result['data'] ?? []);
        });
      }
    } catch (_) {}
  }

  Future<void> _loadHafalan() async {
    try {
      final result = await ApiService.getHafalan(kelas: _selectedKelas);
      if (mounted) {
        setState(() {
          _hafalanList = List<Map<String, dynamic>>.from(result['data'] ?? []);
        });
      }
    } catch (_) {}
  }

  String _calculateGrade(double nilai) {
    if (nilai >= 85) return 'A';
    if (nilai >= 75) return 'B';
    if (nilai >= 65) return 'BC';
    if (nilai >= 55) return 'C';
    if (nilai >= 45) return 'D';
    return 'E';
  }

  Color _getGradeColor(String grade) {
    switch (grade) {
      case 'A': return const Color(0xFF138F81);
      case 'B': return const Color(0xFF2E86DE);
      case 'BC': return const Color(0xFF6C5CE7);
      case 'C': return const Color(0xFFFFB74D);
      case 'D': return const Color(0xFFE65100);
      case 'E': return const Color(0xFFD63031);
      default: return const Color(0xFF636E72);
    }
  }

  void _showInputNilaiDialog(Map<String, dynamic> siswa) {
    int? selectedMapelId;
    String selectedJenis = 'Harian';
    final nilaiController = TextEditingController();
    final keteranganController = TextEditingController();
    String autoGrade = '-';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => StatefulBuilder(
        builder: (context, setModalState) {
          return Container(
            padding: EdgeInsets.fromLTRB(
              24, 20, 24,
              MediaQuery.of(context).viewInsets.bottom + 24,
            ),
            decoration: const BoxDecoration(
              color: Color(0xFFE1EFF7),
              borderRadius: BorderRadius.vertical(top: Radius.circular(30)),
            ),
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Center(
                    child: Container(
                      width: 40, height: 4,
                      decoration: BoxDecoration(color: Colors.grey[400], borderRadius: BorderRadius.circular(2)),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'Input Nilai — ${siswa['nama'] ?? ''}',
                    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Color(0xFF2D3436)),
                  ),
                  const SizedBox(height: 16),

                  // Pilih Mapel
                  const Text('Mata Pelajaran', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF636E72))),
                  const SizedBox(height: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14),
                    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14)),
                    child: DropdownButtonHideUnderline(
                      child: DropdownButton<int>(
                        isExpanded: true,
                        value: selectedMapelId,
                        hint: const Text('Pilih mata pelajaran'),
                        items: _mapelList.where((m) => m['status'] == 'Aktif').map((m) {
                          return DropdownMenuItem<int>(
                            value: m['id'],
                            child: Text(m['nama'] ?? '', style: const TextStyle(fontSize: 14)),
                          );
                        }).toList(),
                        onChanged: (v) => setModalState(() => selectedMapelId = v),
                      ),
                    ),
                  ),
                  const SizedBox(height: 14),

                  // Jenis Ujian
                  const Text('Jenis Ujian', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF636E72))),
                  const SizedBox(height: 6),
                  Wrap(
                    spacing: 8, runSpacing: 8,
                    children: ['Harian', 'UTS', 'UAS', 'Tugas', 'Hafalan'].map((j) {
                      final isSelected = selectedJenis == j;
                      return GestureDetector(
                        onTap: () => setModalState(() => selectedJenis = j),
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 200),
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                          decoration: BoxDecoration(
                            color: isSelected ? const Color(0xFF138F81) : Colors.white,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Text(
                            j,
                            style: TextStyle(
                              fontSize: 12, fontWeight: FontWeight.w700,
                              color: isSelected ? Colors.white : const Color(0xFF2D3436),
                            ),
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 14),

                  // Nilai
                  Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('Nilai (0-100)', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF636E72))),
                            const SizedBox(height: 6),
                            TextField(
                              controller: nilaiController,
                              keyboardType: TextInputType.number,
                              onChanged: (v) {
                                final n = double.tryParse(v);
                                setModalState(() {
                                  autoGrade = n != null ? _calculateGrade(n) : '-';
                                });
                              },
                              decoration: InputDecoration(
                                filled: true, fillColor: Colors.white,
                                border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
                                hintText: '85',
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 16),
                      Column(
                        children: [
                          const Text('Grade', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF636E72))),
                          const SizedBox(height: 6),
                          Container(
                            width: 60, height: 50,
                            decoration: BoxDecoration(
                              color: _getGradeColor(autoGrade).withValues(alpha: 0.15),
                              borderRadius: BorderRadius.circular(14),
                              border: Border.all(color: _getGradeColor(autoGrade)),
                            ),
                            child: Center(
                              child: Text(
                                autoGrade,
                                style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: _getGradeColor(autoGrade)),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),

                  // Keterangan
                  const Text('Keterangan (opsional)', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF636E72))),
                  const SizedBox(height: 6),
                  TextField(
                    controller: keteranganController,
                    maxLines: 2,
                    decoration: InputDecoration(
                      filled: true, fillColor: Colors.white,
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
                      hintText: 'Catatan tambahan...',
                    ),
                  ),
                  const SizedBox(height: 20),

                  // Simpan
                  SizedBox(
                    width: double.infinity, height: 48,
                    child: ElevatedButton(
                      onPressed: () async {
                        final nilai = double.tryParse(nilaiController.text);
                        if (selectedMapelId == null || nilai == null) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: const Text('Lengkapi semua field'),
                              backgroundColor: const Color(0xFFD63031),
                              behavior: SnackBarBehavior.floating,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            ),
                          );
                          return;
                        }
                        try {
                          await ApiService.createNilai({
                            'siswa_id': siswa['id'],
                            'mapel_id': selectedMapelId,
                            'jenis_ujian': selectedJenis,
                            'nilai': nilai,
                            'semester': 'Ganjil 2025',
                            'keterangan': keteranganController.text,
                            'tahun_ajaran': '2025/2026',
                          });
                          if (context.mounted) {
                            Navigator.pop(context);
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text('Nilai ${siswa['nama']} berhasil disimpan!'),
                                backgroundColor: const Color(0xFF138F81),
                                behavior: SnackBarBehavior.floating,
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                              ),
                            );
                            _loadNilai();
                          }
                        } catch (e) {
                          if (context.mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text('Gagal: $e'),
                                backgroundColor: const Color(0xFFD63031),
                                behavior: SnackBarBehavior.floating,
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                              ),
                            );
                          }
                        }
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF138F81),
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                        elevation: 0,
                      ),
                      child: const Text('Simpan Nilai', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFFDC80),
      body: SafeArea(
        child: Column(
          children: [
            // ===== PROFILE BAR =====
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                decoration: BoxDecoration(color: const Color(0xFFE1EFF7), borderRadius: BorderRadius.circular(25)),
                child: Row(
                  children: [
                    Container(
                      width: 50, height: 50,
                      decoration: const BoxDecoration(shape: BoxShape.circle, color: Color(0xFFFFDC80)),
                      child: const Icon(Icons.assignment_rounded, color: Color(0xFF138F81), size: 26),
                    ),
                    const SizedBox(width: 12),
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Nilai & Hafalan', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: Color(0xFF2D3436))),
                          Text('Input nilai pelajaran & hafalan Al-Quran', style: TextStyle(fontSize: 11, color: Color(0xFF636E72))),
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
            ),

            // ===== KELAS PICKER =====
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14),
                decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(25)),
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<String>(
                    isExpanded: true,
                    value: _selectedKelas,
                    hint: const Text('Pilih kelas...', style: TextStyle(fontSize: 14, color: Color(0xFF636E72))),
                    items: _kelasFlatList.map((k) {
                      final nama = k['nama']?.toString() ?? '';
                      return DropdownMenuItem<String>(
                        value: nama,
                        child: Text(nama, style: const TextStyle(fontSize: 14)),
                      );
                    }).toList(),
                    onChanged: (v) {
                      setState(() => _selectedKelas = v);
                      if (v != null) {
                        _loadSiswaByKelas(v);
                        _loadNilai();
                        _loadHafalan();
                      }
                    },
                  ),
                ),
              ),
            ),
            const SizedBox(height: 12),

            // ===== TABS =====
            Container(
              margin: const EdgeInsets.symmetric(horizontal: 16),
              decoration: BoxDecoration(color: const Color(0xFFE1EFF7), borderRadius: BorderRadius.circular(16)),
              child: TabBar(
                controller: _tabController,
                indicator: BoxDecoration(color: const Color(0xFF138F81), borderRadius: BorderRadius.circular(16)),
                labelColor: Colors.white,
                unselectedLabelColor: const Color(0xFF636E72),
                labelStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
                tabs: const [
                  Tab(text: 'Nilai Pelajaran'),
                  Tab(text: 'Hafalan Al-Quran'),
                ],
              ),
            ),
            const SizedBox(height: 12),

            // ===== CONTENT =====
            Expanded(
              child: Container(
                width: double.infinity,
                margin: const EdgeInsets.symmetric(horizontal: 16),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 16),
                decoration: BoxDecoration(color: const Color(0xFFE1EFF7), borderRadius: BorderRadius.circular(30)),
                child: _isLoading
                    ? const Center(child: CircularProgressIndicator(color: Color(0xFF138F81)))
                    : _selectedKelas == null
                        ? const Center(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.school_rounded, size: 48, color: Color(0xFF636E72)),
                                SizedBox(height: 12),
                                Text('Pilih kelas terlebih dahulu', style: TextStyle(fontSize: 14, color: Color(0xFF636E72))),
                              ],
                            ),
                          )
                        : TabBarView(
                            controller: _tabController,
                            children: [
                              _buildNilaiTab(),
                              _buildHafalanTab(),
                            ],
                          ),
              ),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  Widget _buildNilaiTab() {
    if (_siswaList.isEmpty) {
      return const Center(child: Text('Belum ada siswa di kelas ini', style: TextStyle(color: Color(0xFF636E72))));
    }
    return ListView.builder(
      physics: const BouncingScrollPhysics(),
      itemCount: _siswaList.length,
      itemBuilder: (context, index) {
        final siswa = _siswaList[index];
        final siswaId = siswa['id'];
        final nilaiCount = _nilaiList.where((n) => n['siswa_id'] == siswaId).length;
        return Padding(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: GestureDetector(
            onTap: () => _showInputNilaiDialog(siswa),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(21)),
              child: Row(
                children: [
                  Container(
                    width: 36, height: 36,
                    decoration: BoxDecoration(
                      color: const Color(0xFF138F81).withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Center(
                      child: Text(
                        '${index + 1}',
                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF138F81)),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(siswa['nama'] ?? '', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF2D3436)), maxLines: 1, overflow: TextOverflow.ellipsis),
                        Text('NIS: ${siswa['nis'] ?? '-'} • $nilaiCount nilai', style: const TextStyle(fontSize: 10, color: Color(0xFF636E72))),
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(color: const Color(0xFF138F81), borderRadius: BorderRadius.circular(12)),
                    child: const Text('+ Nilai', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Colors.white)),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildHafalanTab() {
    if (_siswaList.isEmpty) {
      return const Center(child: Text('Belum ada siswa di kelas ini', style: TextStyle(color: Color(0xFF636E72))));
    }
    return ListView.builder(
      physics: const BouncingScrollPhysics(),
      itemCount: _siswaList.length,
      itemBuilder: (context, index) {
        final siswa = _siswaList[index];
        final siswaId = siswa['id'];
        final hafalanCount = _hafalanList.where((h) => h['siswa_id'] == siswaId).length;
        final selesaiCount = _hafalanList.where((h) => h['siswa_id'] == siswaId && h['status'] == 'Selesai').length;

        return Padding(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: GestureDetector(
            onTap: () => _showInputHafalanDialog(siswa),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(21)),
              child: Row(
                children: [
                  Container(
                    width: 36, height: 36,
                    decoration: BoxDecoration(
                      color: const Color(0xFF6C5CE7).withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.menu_book_rounded, size: 18, color: Color(0xFF6C5CE7)),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(siswa['nama'] ?? '', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF2D3436)), maxLines: 1, overflow: TextOverflow.ellipsis),
                        Text('$selesaiCount/$hafalanCount hafalan selesai', style: const TextStyle(fontSize: 10, color: Color(0xFF636E72))),
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(color: const Color(0xFF6C5CE7), borderRadius: BorderRadius.circular(12)),
                    child: const Text('+ Hafalan', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Colors.white)),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  void _showInputHafalanDialog(Map<String, dynamic> siswa) {
    int? selectedJuz;
    String selectedStatus = 'Proses';
    final surahController = TextEditingController();
    final nilaiController = TextEditingController();
    final keteranganController = TextEditingController();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => StatefulBuilder(
        builder: (context, setModalState) {
          return Container(
            padding: EdgeInsets.fromLTRB(24, 20, 24, MediaQuery.of(context).viewInsets.bottom + 24),
            decoration: const BoxDecoration(color: Color(0xFFE1EFF7), borderRadius: BorderRadius.vertical(top: Radius.circular(30))),
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Center(child: Container(width: 40, height: 4, decoration: BoxDecoration(color: Colors.grey[400], borderRadius: BorderRadius.circular(2)))),
                  const SizedBox(height: 16),
                  Text('Input Hafalan — ${siswa['nama'] ?? ''}', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Color(0xFF2D3436))),
                  const SizedBox(height: 16),

                  // Juz
                  const Text('Juz (1-30)', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF636E72))),
                  const SizedBox(height: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14),
                    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14)),
                    child: DropdownButtonHideUnderline(
                      child: DropdownButton<int>(
                        isExpanded: true,
                        value: selectedJuz,
                        hint: const Text('Pilih Juz'),
                        items: List.generate(30, (i) => i + 1).map((j) {
                          return DropdownMenuItem<int>(value: j, child: Text('Juz $j'));
                        }).toList(),
                        onChanged: (v) => setModalState(() => selectedJuz = v),
                      ),
                    ),
                  ),
                  const SizedBox(height: 14),

                  // Surah
                  const Text('Nama Surah (opsional)', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF636E72))),
                  const SizedBox(height: 6),
                  TextField(
                    controller: surahController,
                    decoration: InputDecoration(
                      filled: true, fillColor: Colors.white,
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
                      hintText: 'Al-Baqarah',
                    ),
                  ),
                  const SizedBox(height: 14),

                  // Status
                  const Text('Status', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF636E72))),
                  const SizedBox(height: 6),
                  Wrap(
                    spacing: 8,
                    children: ['Belum', 'Proses', 'Selesai'].map((s) {
                      final isSelected = selectedStatus == s;
                      final color = s == 'Selesai' ? const Color(0xFF138F81) : s == 'Proses' ? const Color(0xFFFFB74D) : const Color(0xFF636E72);
                      return GestureDetector(
                        onTap: () => setModalState(() => selectedStatus = s),
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 200),
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                          decoration: BoxDecoration(color: isSelected ? color : Colors.white, borderRadius: BorderRadius.circular(12)),
                          child: Text(s, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: isSelected ? Colors.white : color)),
                        ),
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 14),

                  // Nilai
                  const Text('Nilai Hafalan (0-100)', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF636E72))),
                  const SizedBox(height: 6),
                  TextField(
                    controller: nilaiController,
                    keyboardType: TextInputType.number,
                    decoration: InputDecoration(
                      filled: true, fillColor: Colors.white,
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
                      hintText: '90',
                    ),
                  ),
                  const SizedBox(height: 14),

                  // Keterangan
                  const Text('Keterangan', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF636E72))),
                  const SizedBox(height: 6),
                  TextField(
                    controller: keteranganController,
                    maxLines: 2,
                    decoration: InputDecoration(
                      filled: true, fillColor: Colors.white,
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
                      hintText: 'Lancar, tajwid baik...',
                    ),
                  ),
                  const SizedBox(height: 20),

                  // Simpan
                  SizedBox(
                    width: double.infinity, height: 48,
                    child: ElevatedButton(
                      onPressed: () async {
                        if (selectedJuz == null) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: const Text('Pilih Juz'), backgroundColor: const Color(0xFFD63031), behavior: SnackBarBehavior.floating, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
                          );
                          return;
                        }
                        try {
                          await ApiService.createHafalan({
                            'siswa_id': siswa['id'],
                            'juz': selectedJuz,
                            'surah': surahController.text,
                            'status': selectedStatus,
                            'tanggal_setor': DateTime.now().toIso8601String().split('T')[0],
                            'nilai_hafalan': int.tryParse(nilaiController.text),
                            'keterangan': keteranganController.text,
                          });
                          if (context.mounted) {
                            Navigator.pop(context);
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(content: Text('Hafalan ${siswa['nama']} berhasil!'), backgroundColor: const Color(0xFF6C5CE7), behavior: SnackBarBehavior.floating, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
                            );
                            _loadHafalan();
                          }
                        } catch (e) {
                          if (context.mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(content: Text('Gagal: $e'), backgroundColor: const Color(0xFFD63031), behavior: SnackBarBehavior.floating, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
                            );
                          }
                        }
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF6C5CE7),
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                        elevation: 0,
                      ),
                      child: const Text('Simpan Hafalan', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}
