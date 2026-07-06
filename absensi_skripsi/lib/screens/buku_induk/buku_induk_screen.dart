import 'package:flutter/material.dart';

import '../../services/api_service.dart';
import '../../services/cache_service.dart';
import '../sifir/kelompok_belajar_screen.dart';
import 'data_admin_screen.dart';
import 'data_kelas_screen.dart';
import 'data_siswa_screen.dart';

class BukuIndukScreen extends StatefulWidget {
  final String userRole;
  const BukuIndukScreen({super.key, this.userRole = 'admin'});

  @override
  State<BukuIndukScreen> createState() => _BukuIndukScreenState();
}

class _BukuIndukScreenState extends State<BukuIndukScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _animController;
  late Animation<double> _fadeIn;

  // Realtime counts dari API
  int _siswaCount = 0;
  int _loginCount = 0;
  int _kelasCount = 0;
  int _kelompokCount = 0;
  bool _isLoadingCounts = true;
  bool _hasLoadedCountSnapshot = false;

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
    _loadRealtimeCounts(forceLoader: true);
  }

  static const List<String> _countCacheKeys = [
    'siswa_list',
    'users_all',
    'classes_skripsi_all_v1',
    'kelompok_belajar_skripsi_v2',
  ];

  int _extractCount(dynamic snapshot) {
    if (snapshot is Map && snapshot['data'] is List) {
      return (snapshot['data'] as List).length;
    }
    return 0;
  }

  int _extractLoginCount(dynamic snapshot) {
    if (snapshot is Map && snapshot['data'] is List) {
      return (snapshot['data'] as List).where((item) {
        if (item is! Map) return false;
        final role = item['role']?.toString().trim().toLowerCase();
        return role == 'admin' || role == 'guru';
      }).length;
    }
    return 0;
  }

  int _extractKelompokCount(dynamic snapshot) {
    if (snapshot is! Map || snapshot['data'] is! List) return 0;
    return (snapshot['data'] as List).fold<int>(0, (total, group) {
      if (group is! Map || group['kelas'] is! List) return total;
      return total + (group['kelas'] as List).length;
    });
  }

  void _applyCountSnapshots(List<dynamic> snapshots) {
    _siswaCount = _extractCount(snapshots[0]);
    _loginCount = _extractLoginCount(snapshots[1]);
    _kelasCount = _extractCount(snapshots[2]);
    _kelompokCount = _extractKelompokCount(snapshots[3]);
  }

  Future<void> _loadCachedCounts() async {
    final cachedSnapshots = await Future.wait(
      _countCacheKeys.map(CacheService.get),
    );
    if (!mounted) return;

    final hasCache = cachedSnapshots.any((snapshot) => snapshot is Map);
    if (!hasCache) return;

    setState(() {
      _applyCountSnapshots(cachedSnapshots);
      _hasLoadedCountSnapshot = true;
      _isLoadingCounts = false;
    });
  }

  /// Cache tampil dulu agar layar terasa cepat, lalu API menyusul di belakang.
  Future<void> _loadRealtimeCounts({bool forceLoader = false}) async {
    if (mounted && (forceLoader || !_hasLoadedCountSnapshot)) {
      setState(() => _isLoadingCounts = true);
    }

    await _loadCachedCounts();

    try {
      final results = await Future.wait([
        CacheService.fetchWithCache(
          cacheKey: 'siswa_list',
          apiFetch: () => ApiService.getSiswa(),
        ),
        CacheService.fetchWithCache(
          cacheKey: 'users_all',
          apiFetch: () => ApiService.getAllUsers(),
        ),
        CacheService.fetchWithCache(
          cacheKey: 'classes_skripsi_all_v1',
          apiFetch: () => ApiService.getClasses(includeInactive: true),
        ),
        CacheService.fetchWithCache(
          cacheKey: 'kelompok_belajar_skripsi_v2',
          apiFetch: () => ApiService.getKelompokBelajar(),
        ),
      ]);

      if (!mounted) return;

      setState(() {
        _applyCountSnapshots(results);
        _hasLoadedCountSnapshot = true;
        _isLoadingCounts = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _isLoadingCounts = !_hasLoadedCountSnapshot);
    }
  }

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
  }

  void _navigateTo(Widget screen) {
    Navigator.push(
      context,
      PageRouteBuilder(
        pageBuilder: (context, animation, _) => screen,
        transitionsBuilder: (context, animation, _, child) {
          return FadeTransition(
            opacity: animation,
            child: SlideTransition(
              position:
                  Tween<Offset>(
                    begin: const Offset(0.0, 0.05),
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
    ).then((_) {
      // Refresh counts saat kembali dari sub-screen
      if (mounted) _loadRealtimeCounts();
    });
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
              // ===== PROFILE BAR =====
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 12,
                  ),
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
                          Icons.library_books_rounded,
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
                              'Buku Induk',
                              style: TextStyle(
                                fontSize: 17,
                                fontWeight: FontWeight.w700,
                                color: Color(0xFF2D3436),
                              ),
                            ),
                            Text(
                              'Data Utama Madrasah',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w500,
                                color: Color(0xFF636E72),
                              ),
                            ),
                          ],
                        ),
                      ),
                      IconButton(
                        onPressed: () => Navigator.pop(context),
                        icon: const Icon(
                          Icons.arrow_back_ios_rounded,
                          size: 20,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 24),

              // ===== TITLE =====
              const Text(
                'Pilih Kategori Data',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF2D3436),
                ),
              ),
              const SizedBox(height: 6),
              Text(
                widget.userRole == 'guru'
                    ? 'Lihat data siswa, kelas, dan login admin/guru'
                    : 'Kelola data siswa, kelas, dan login admin/guru',
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w400,
                  color: Color(0xFF636E72),
                  height: 1.4,
                ),
              ),
              const SizedBox(height: 24),

              // ===== CARDS =====
              Expanded(
                child: RefreshIndicator(
                  onRefresh: _loadRealtimeCounts,
                  color: const Color(0xFF138F81),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 24),
                    child: ListView(
                      physics: const AlwaysScrollableScrollPhysics(
                        parent: BouncingScrollPhysics(),
                      ),
                      children: [
                        _buildCategoryCard(
                          index: 0,
                          icon: Icons.people_rounded,
                          title: 'Data Siswa/Santri',
                          subtitle: _isLoadingCounts
                              ? 'Memuat...'
                              : '$_siswaCount Data Tersimpan',
                          description: widget.userRole == 'guru'
                              ? 'Mode lihat data siswa tanpa edit/hapus.'
                              : 'NIS, NISN, Nama, TTL, Wali, Status, dll.',
                          color: const Color(0xFF2E86DE),
                          onTap: () => _navigateTo(
                            DataSiswaScreen(
                              readOnly: widget.userRole == 'guru',
                            ),
                          ),
                        ),
                        const SizedBox(height: 16),
                        _buildCategoryCard(
                          index: 1,
                          icon: Icons.school_rounded,
                          title: 'Data Kelas Sifir',
                          subtitle: _isLoadingCounts
                              ? 'Memuat...'
                              : '$_kelasCount Kelas Tersimpan',
                          description: widget.userRole == 'guru'
                              ? 'Mode lihat kelas sifir tanpa edit/hapus.'
                              : 'Tambah, edit, nonaktifkan, dan hapus kelas.',
                          color: const Color(0xFF138F81),
                          onTap: () => _navigateTo(
                            DataKelasScreen(
                              readOnly: widget.userRole == 'guru',
                            ),
                          ),
                        ),
                        const SizedBox(height: 16),
                        if (widget.userRole == 'admin') ...[
                          _buildCategoryCard(
                            index: 2,
                            icon: Icons.groups_rounded,
                            title: 'Kelompok Belajar',
                            subtitle: _isLoadingCounts
                                ? 'Memuat...'
                                : '$_kelompokCount Kelompok Tersimpan',
                            description:
                                'Atur kelas dan keanggotaan santri Madin.',
                            color: const Color(0xFF6C5CE7),
                            onTap: () =>
                                _navigateTo(const KelompokBelajarScreen()),
                          ),
                          const SizedBox(height: 16),
                        ],
                        _buildCategoryCard(
                          index: 3,
                          icon: Icons.manage_accounts_rounded,
                          title: 'Data Login Admin/Guru',
                          subtitle: _isLoadingCounts
                              ? 'Memuat...'
                              : '$_loginCount Akun Tersimpan',
                          description: widget.userRole == 'guru'
                              ? 'Mode lihat akun admin dan guru tanpa edit.'
                              : 'Tambah dan kelola akun login admin/guru.',
                          color: const Color(0xFFE65100),
                          onTap: () => _navigateTo(
                            DataAdminScreen(
                              readOnly: widget.userRole == 'guru',
                            ),
                          ),
                        ),
                        const SizedBox(height: 24),
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

  Widget _buildCategoryCard({
    required int index,
    required IconData icon,
    required String title,
    required String subtitle,
    required String description,
    required Color color,
    required VoidCallback onTap,
  }) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0.0, end: 1.0),
      duration: Duration(milliseconds: 500 + (index * 150)),
      curve: Curves.easeOutCubic,
      builder: (context, value, child) {
        return Transform.translate(
          offset: Offset(0, 30 * (1 - value)),
          child: Opacity(opacity: value, child: child),
        );
      },
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(24),
          ),
          child: Row(
            children: [
              // Icon Container
              Container(
                width: 60,
                height: 60,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(18),
                ),
                child: Icon(icon, color: color, size: 30),
              ),
              const SizedBox(width: 16),

              // Text
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: color,
                      ),
                    ),
                    const SizedBox(height: 2),
                    _isLoadingCounts
                        ? _buildShimmerText()
                        : Text(
                            subtitle,
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: Color(0xFF2D3436),
                            ),
                          ),
                    const SizedBox(height: 4),
                    Text(
                      description,
                      style: const TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w400,
                        color: Color(0xFF636E72),
                      ),
                    ),
                  ],
                ),
              ),

              // Arrow
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(
                  Icons.arrow_forward_ios_rounded,
                  color: color,
                  size: 16,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// Shimmer loading text placeholder
  Widget _buildShimmerText() {
    return Container(
      width: 100,
      height: 14,
      decoration: BoxDecoration(
        color: const Color(0xFF636E72).withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(7),
      ),
    );
  }
}
