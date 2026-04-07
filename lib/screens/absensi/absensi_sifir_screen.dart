import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../../services/cache_service.dart';
import 'absensi_mapel_screen.dart';
import 'rekap_absensi_screen.dart';

class AbsensiSifirScreen extends StatefulWidget {
  const AbsensiSifirScreen({super.key});

  @override
  State<AbsensiSifirScreen> createState() => _AbsensiSifirScreenState();
}

class _AbsensiSifirScreenState extends State<AbsensiSifirScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _animController;
  late Animation<double> _fadeIn;

  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';
  bool _isLoading = true;
  bool _isFromCache = false;
  String? _errorMessage;
  int _expandedCategory = -1;

  // Grouped from API: [{kategori, kelas: [{id, nama, sifir, jumlah_siswa}]}]
  List<Map<String, dynamic>> _groupedData = [];

  // Gradient colors per sifir level
  static const Map<String, List<Color>> _sifirGradients = {
    'awal': [Color(0xFF2E86DE), Color(0xFF54A0FF)],
    'tsani': [Color(0xFF138F81), Color(0xFF1ABC9C)],
    'tsalis': [Color(0xFF6C5CE7), Color(0xFFA29BFE)],
    'robi': [Color(0xFFE65100), Color(0xFFFF8A50)],
    'khomis': [Color(0xFFD63031), Color(0xFFFF6B6B)],
    'sadis': [Color(0xFF7B2D8E), Color(0xFFBE2EDD)],
  };

  static const Map<String, IconData> _sifirIcons = {
    'awal': Icons.looks_one_rounded,
    'tsani': Icons.looks_two_rounded,
    'tsalis': Icons.looks_3_rounded,
    'robi': Icons.looks_4_rounded,
    'khomis': Icons.looks_5_rounded,
    'sadis': Icons.looks_6_rounded,
  };

  List<Color> _getGradient(String sifir) =>
      _sifirGradients[sifir] ?? [const Color(0xFF636E72), const Color(0xFF95A5A6)];
  IconData _getIcon(String sifir) => _sifirIcons[sifir] ?? Icons.school_rounded;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(vsync: this, duration: const Duration(milliseconds: 500));
    _fadeIn = Tween<double>(begin: 0, end: 1).animate(CurvedAnimation(parent: _animController, curve: Curves.easeOut));
    _animController.forward();
    _loadFromApi();
  }

  @override
  void dispose() {
    _animController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadFromApi() async {
    setState(() { _isLoading = true; _errorMessage = null; });

    final result = await CacheService.fetchWithCache(
      cacheKey: 'absensi_sifir',
      apiFetch: () => ApiService.getKelompokBelajar(),
    );

    if (!mounted) return;

    if (result != null && result['success'] == true) {
      setState(() {
        _groupedData = List<Map<String, dynamic>>.from(result['data'] ?? []);
        _isFromCache = result['_fromCache'] == true;
        _isLoading = false;
      });
    } else {
      setState(() {
        _errorMessage = 'Tidak dapat terhubung ke server';
        _isLoading = false;
      });
    }
  }

  List<Map<String, dynamic>> get _filteredData {
    if (_searchQuery.isEmpty) return _groupedData;
    final q = _searchQuery.toLowerCase();
    return _groupedData.where((group) {
      final kategori = (group['kategori'] ?? '').toString().toLowerCase();
      if (kategori.contains(q)) return true;
      final kelas = List<Map<String, dynamic>>.from(group['kelas'] ?? []);
      return kelas.any((k) => (k['nama'] ?? '').toString().toLowerCase().contains(q));
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _filteredData;
    final totalKelas = _groupedData.fold<int>(0, (sum, g) => sum + List.from(g['kelas'] ?? []).length);

    return Scaffold(
      backgroundColor: const Color(0xFFFFDC80),
      body: SafeArea(
        child: FadeTransition(
          opacity: _fadeIn,
          child: Column(
            children: [
              // ===== PROFILE BAR =====
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  decoration: BoxDecoration(color: const Color(0xFFE1EFF7), borderRadius: BorderRadius.circular(25)),
                  child: Row(
                    children: [
                      Container(
                        width: 50, height: 50,
                        decoration: const BoxDecoration(shape: BoxShape.circle, color: Color(0xFFFFDC80)),
                        child: const Icon(Icons.fact_check_rounded, color: Color(0xFF138F81), size: 28),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                const Text('Absensi Sifir', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: Color(0xFF2D3436))),
                                if (_isFromCache) ...[
                                  const SizedBox(width: 6),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                    decoration: BoxDecoration(color: const Color(0xFFE65100).withValues(alpha: 0.12), borderRadius: BorderRadius.circular(6)),
                                    child: const Text('Offline', style: TextStyle(fontSize: 8, fontWeight: FontWeight.w700, color: Color(0xFFE65100))),
                                  ),
                                ],
                              ],
                            ),
                            Text('$totalKelas kelas • Madrasah Diniah PP Qomaruddin', style: const TextStyle(fontSize: 10, color: Color(0xFF636E72))),
                          ],
                        ),
                      ),
                      IconButton(onPressed: () => Navigator.pop(context), icon: const Icon(Icons.close_rounded, size: 22)),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12),

              // ===== SEARCH BAR =====
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                  decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(21)),
                  child: Row(
                    children: [
                      const Icon(Icons.search_rounded, size: 22, color: Color(0xFF636E72)),
                      const SizedBox(width: 10),
                      Expanded(
                        child: TextField(
                          controller: _searchController,
                          onChanged: (val) => setState(() => _searchQuery = val),
                          decoration: const InputDecoration(
                            hintText: 'Cari Sifir...', border: InputBorder.none,
                            hintStyle: TextStyle(fontSize: 13, color: Color(0xFF636E72)),
                          ),
                          style: const TextStyle(fontSize: 13),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12),

              // ===== REKAP ABSENSI BUTTON =====
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: GestureDetector(
                  onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const RekapAbsensiScreen())),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(21)),
                    child: Row(
                      children: [
                        Container(
                          width: 36, height: 36,
                          decoration: BoxDecoration(
                            gradient: const LinearGradient(colors: [Color(0xFF138F81), Color(0xFF1ABC9C)]),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: const Icon(Icons.assessment_rounded, color: Colors.white, size: 20),
                        ),
                        const SizedBox(width: 12),
                        const Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('Rekap Absensi', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Color(0xFF138F81))),
                              Text('Laporan bulanan + Download Excel', style: TextStyle(fontSize: 10, color: Color(0xFF636E72))),
                            ],
                          ),
                        ),
                        const Icon(Icons.chevron_right_rounded, color: Color(0xFF138F81)),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 8),

              // ===== SIFIR LIST (COLLAPSIBLE) =====
              if (_isLoading)
                const Expanded(child: Center(child: CircularProgressIndicator(color: Color(0xFF138F81))))
              else if (_errorMessage != null)
                Expanded(
                  child: Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
                    const Icon(Icons.wifi_off_rounded, size: 48, color: Color(0xFFE65100)),
                    const SizedBox(height: 12),
                    Text(_errorMessage!, textAlign: TextAlign.center, style: const TextStyle(fontSize: 13, color: Color(0xFF636E72))),
                    const SizedBox(height: 16),
                    ElevatedButton.icon(
                      onPressed: _loadFromApi,
                      icon: const Icon(Icons.refresh_rounded),
                      label: const Text('Coba Lagi'),
                      style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF138F81), foregroundColor: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
                    ),
                  ])),
                )
              else
                Expanded(
                  child: RefreshIndicator(
                    onRefresh: _loadFromApi,
                    color: const Color(0xFF138F81),
                    child: ListView.builder(
                      physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                      itemCount: filtered.length,
                      itemBuilder: (context, index) => _buildCategoryCard(filtered[index], index),
                    ),
                  ),
                ),
              const SizedBox(height: 8),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildCategoryCard(Map<String, dynamic> group, int catIndex) {
    final isExpanded = _expandedCategory == catIndex;
    final kategori = group['kategori']?.toString() ?? '';
    final kelasList = List<Map<String, dynamic>>.from(group['kelas'] ?? []);
    final sifir = kelasList.isNotEmpty ? kelasList[0]['sifir']?.toString() ?? '' : '';
    final gradient = _getGradient(sifir);
    final icon = _getIcon(sifir);
    final totalSiswa = kelasList.fold<int>(0, (sum, k) => sum + ((k['jumlah_siswa'] as int?) ?? 0));

    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0.0, end: 1.0),
      duration: Duration(milliseconds: 400 + (catIndex * 80)),
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
          color: Colors.white, borderRadius: BorderRadius.circular(20),
          border: Border.all(color: gradient[0].withValues(alpha: 0.1)),
        ),
        child: Column(
          children: [
            // Category Header (tap to expand/collapse)
            InkWell(
              borderRadius: BorderRadius.circular(20),
              onTap: () => setState(() => _expandedCategory = isExpanded ? -1 : catIndex),
              child: Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  gradient: LinearGradient(colors: [gradient[0].withValues(alpha: 0.08), gradient[1].withValues(alpha: 0.03)]),
                  borderRadius: BorderRadius.vertical(
                    top: const Radius.circular(20),
                    bottom: isExpanded ? Radius.zero : const Radius.circular(20),
                  ),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 48, height: 48,
                      decoration: BoxDecoration(
                        gradient: LinearGradient(colors: gradient, begin: Alignment.topLeft, end: Alignment.bottomRight),
                        borderRadius: BorderRadius.circular(15),
                      ),
                      child: Icon(icon, color: Colors.white, size: 24),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(kategori, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: gradient[0])),
                          const SizedBox(height: 3),
                          Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(color: gradient[0].withValues(alpha: 0.1), borderRadius: BorderRadius.circular(6)),
                                child: Text('${kelasList.length} Kelas', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: gradient[0])),
                              ),
                              const SizedBox(width: 4),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(color: const Color(0xFF636E72).withValues(alpha: 0.08), borderRadius: BorderRadius.circular(6)),
                                child: Text('$totalSiswa Santri', style: const TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: Color(0xFF636E72))),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    AnimatedRotation(
                      turns: isExpanded ? 0.25 : 0,
                      duration: const Duration(milliseconds: 200),
                      child: Icon(Icons.chevron_right_rounded, color: gradient[0]),
                    ),
                  ],
                ),
              ),
            ),

            // Expanded kelas list (clickable → navigate to absensi)
            AnimatedSize(
              duration: const Duration(milliseconds: 250),
              curve: Curves.easeInOut,
              child: isExpanded
                  ? Column(
                      children: [
                        Container(margin: const EdgeInsets.symmetric(horizontal: 14), height: 1, color: gradient[0].withValues(alpha: 0.1)),
                        ...kelasList.map((kelas) => _buildKelasItem(kelas, gradient)),
                        const SizedBox(height: 8),
                      ],
                    )
                  : const SizedBox.shrink(),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildKelasItem(Map<String, dynamic> kelas, List<Color> gradient) {
    final nama = kelas['nama']?.toString() ?? '';
    final jumlahSiswa = (kelas['jumlah_siswa'] as int?) ?? 0;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
      child: GestureDetector(
        onTap: () {
          Navigator.push(
            context,
            PageRouteBuilder(
              pageBuilder: (context, animation, _) => AbsensiMapelScreen(namaKelas: nama),
              transitionsBuilder: (context, animation, _, child) {
                return FadeTransition(
                  opacity: animation,
                  child: SlideTransition(
                    position: Tween<Offset>(begin: const Offset(1.0, 0.0), end: Offset.zero).animate(
                      CurvedAnimation(parent: animation, curve: Curves.easeOutCubic),
                    ),
                    child: child,
                  ),
                );
              },
              transitionDuration: const Duration(milliseconds: 350),
            ),
          );
        },
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
          decoration: BoxDecoration(
            color: gradient[0].withValues(alpha: 0.04),
            borderRadius: BorderRadius.circular(14),
          ),
          child: Row(
            children: [
              Container(
                width: 36, height: 36,
                decoration: BoxDecoration(color: gradient[0].withValues(alpha: 0.1), borderRadius: BorderRadius.circular(10)),
                child: Icon(Icons.how_to_reg_rounded, color: gradient[0], size: 18),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(nama, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF2D3436))),
                    Text('$jumlahSiswa Santri', style: const TextStyle(fontSize: 10, color: Color(0xFF636E72))),
                  ],
                ),
              ),
              Icon(Icons.chevron_right_rounded, color: gradient[0], size: 20),
            ],
          ),
        ),
      ),
    );
  }
}
