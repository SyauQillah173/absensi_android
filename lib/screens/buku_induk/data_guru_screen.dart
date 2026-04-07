import 'package:flutter/material.dart';

import '../../services/api_service.dart';
import '../../services/cache_service.dart';
import '../../services/excel_import_service.dart';
import 'edit_user_screen.dart';

class DataGuruScreen extends StatefulWidget {
  const DataGuruScreen({super.key});

  @override
  State<DataGuruScreen> createState() => _DataGuruScreenState();
}

class _DataGuruScreenState extends State<DataGuruScreen>
    with SingleTickerProviderStateMixin {
  static const _cacheKey = 'users_guru';

  late final AnimationController _animController;
  late final Animation<double> _fadeIn;

  final TextEditingController _searchController = TextEditingController();

  String _searchQuery = '';
  int? _expandedIndex;
  List<Map<String, dynamic>> _guruList = [];
  bool _isLoading = true;
  bool _isOfflineMode = false;
  bool _isSyncing = false;
  String? _errorMessage;

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
    _loadGuru();
  }

  @override
  void dispose() {
    _animController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadGuru({bool forceRefresh = false}) async {
    if (!mounted) return;

    setState(() {
      _isLoading = _guruList.isEmpty;
      _isSyncing = true;
      _errorMessage = null;
    });

    final cached = await CacheService.get(_cacheKey);
    if (cached is Map<String, dynamic> &&
        mounted &&
        cached['success'] == true &&
        (_guruList.isEmpty || !forceRefresh)) {
      setState(() {
        _guruList = List<Map<String, dynamic>>.from(cached['data'] ?? []);
        _isLoading = false;
        _isOfflineMode = true;
      });
    }

    try {
      final result = await ApiService.getAllUsers(role: 'guru');
      await CacheService.save(_cacheKey, result);

      if (!mounted) return;
      setState(() {
        _guruList = List<Map<String, dynamic>>.from(result['data'] ?? []);
        _isLoading = false;
        _isOfflineMode = false;
        _isSyncing = false;
        _errorMessage = null;
      });
    } catch (e) {
      if (!mounted) return;

      if (_guruList.isEmpty) {
        setState(() {
          _isLoading = false;
          _isSyncing = false;
          _errorMessage =
              'Tidak dapat memuat data guru.\nPastikan backend dan koneksi aktif.';
        });
      } else {
        setState(() {
          _isLoading = false;
          _isSyncing = false;
          _isOfflineMode = true;
        });
      }
    }
  }

  Future<void> _clearUserCaches() async {
    await CacheService.delete(_cacheKey);
    await CacheService.delete('users_all');
  }

  void _showSnack(String message, {bool isError = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: isError
            ? const Color(0xFFE65100)
            : const Color(0xFF138F81),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }

  void _showOfflineActionMessage() {
    _showSnack(
      'Mode offline hanya untuk melihat data terakhir. Sambungkan ke server untuk tambah/edit/import.',
      isError: true,
    );
  }

  Future<void> _openGuruForm({Map<String, dynamic>? guru}) async {
    if (_isOfflineMode) {
      _showOfflineActionMessage();
      return;
    }

    final changed = await Navigator.push<bool>(
      context,
      PageRouteBuilder(
        pageBuilder: (context, animation, secondaryAnimation) => EditUserScreen(
          user: guru,
          allowRoleEdit: false,
          showGuruFields: true,
          lockedRole: 'guru',
          title: guru == null ? 'Tambah Guru Baru' : 'Edit Data Guru',
          subtitle: 'Buku Induk - Data Guru',
          icon: guru == null
              ? Icons.person_add_alt_1_rounded
              : Icons.school_rounded,
          accentColor: const Color(0xFF138F81),
        ),
        transitionsBuilder: (
          context,
          animation,
          secondaryAnimation,
          child,
        ) {
          return FadeTransition(
            opacity: animation,
            child: SlideTransition(
              position: Tween<Offset>(
                begin: const Offset(0, 0.05),
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
      ),
    );

    if (changed == true) {
      await _clearUserCaches();
      await _loadGuru(forceRefresh: true);
    }
  }

  Future<void> _handleImportGuru() async {
    if (_isOfflineMode) {
      _showOfflineActionMessage();
      return;
    }

    try {
      final rows = await ExcelImportService.pickAndParseRows(
        ImportTemplateType.guru,
      );
      if (rows.isEmpty) {
        _showSnack('Import dibatalkan atau file kosong.', isError: true);
        return;
      }

      final result = await ApiService.importGuru(rows);
      if (!mounted) return;

      await _clearUserCaches();
      await _loadGuru(forceRefresh: true);
      _showImportSummary(result);
    } catch (e) {
      _showSnack('Gagal import guru: $e', isError: true);
    }
  }

  Future<void> _downloadTemplate() async {
    try {
      await ExcelImportService.shareTemplate(ImportTemplateType.guru);
      _showSnack('Template Excel guru berhasil dibuat.');
    } catch (e) {
      _showSnack('Gagal membuat template: $e', isError: true);
    }
  }

  void _showImportGuide() {
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text(
          'Petunjuk Import Guru',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
        ),
        content: const Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Kolom wajib template:'),
            SizedBox(height: 8),
            Text(
              'unit_sekolah, name, kode_guru, phone, email, jenis_kelamin, alamat, status, status_sebagai, password',
            ),
            SizedBox(height: 12),
            Text('Catatan penting:'),
            SizedBox(height: 6),
            Text('- unit_sekolah bisa lebih dari satu, pisahkan dengan |'),
            Text('- status_sebagai bisa lebih dari satu, pisahkan dengan |'),
            Text('- kode_guru dan email harus unik'),
            Text('- password minimal 6 karakter'),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Tutup'),
          ),
        ],
      ),
    );
  }

  void _showImportSummary(Map<String, dynamic> result) {
    final errors = List<Map<String, dynamic>>.from(result['errors'] ?? []);

    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text(
          'Hasil Import Guru',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
        ),
        content: SizedBox(
          width: 340,
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _summaryRow('Total baris', '${result['total_baris'] ?? 0}'),
                _summaryRow('Berhasil', '${result['berhasil'] ?? 0}'),
                _summaryRow('Gagal', '${result['gagal'] ?? 0}'),
                if (errors.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  const Text(
                    'Baris gagal:',
                    style: TextStyle(fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 8),
                  ...errors.map((error) {
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFFF3E0),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Text(
                          'Baris ${error['baris']}: ${error['alasan']}',
                          style: const TextStyle(
                            fontSize: 11,
                            color: Color(0xFFE65100),
                            height: 1.4,
                          ),
                        ),
                      ),
                    );
                  }),
                ],
              ],
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Selesai'),
          ),
        ],
      ),
    );
  }

  Widget _summaryRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        children: [
          SizedBox(
            width: 82,
            child: Text(
              label,
              style: const TextStyle(fontSize: 12, color: Color(0xFF636E72)),
            ),
          ),
          const Text(': '),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: Color(0xFF2D3436),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _handleEditStatus(Map<String, dynamic> guru) async {
    setState(() => _expandedIndex = null);
    if (_isOfflineMode) {
      _showOfflineActionMessage();
      return;
    }

    final isActive = _val(guru, 'status', 'Aktif') == 'Aktif';
    final newStatus = isActive ? 'Nonaktif' : 'Aktif';
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text(
          'Edit Status Guru',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
        ),
        content: Text(
          isActive
              ? 'Nonaktifkan guru "${guru['name']}"?'
              : 'Aktifkan kembali guru "${guru['name']}"?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Batal'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: isActive
                  ? const Color(0xFFE65100)
                  : const Color(0xFF138F81),
            ),
            child: Text(
              isActive ? 'Nonaktifkan' : 'Aktifkan',
              style: const TextStyle(color: Colors.white),
            ),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    try {
      await ApiService.updateUser(guru['id'] as int, {'status': newStatus});
      await _clearUserCaches();
      await _loadGuru(forceRefresh: true);
      _showSnack('Status ${guru['name']} -> $newStatus');
    } catch (e) {
      _showSnack('Gagal mengubah status: $e', isError: true);
    }
  }

  Future<void> _handleDelete(Map<String, dynamic> guru) async {
    setState(() => _expandedIndex = null);
    if (_isOfflineMode) {
      _showOfflineActionMessage();
      return;
    }

    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text(
          'Hapus Guru',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
        ),
        content: Text(
          'Apakah Anda yakin ingin menghapus "${guru['name']}"? Tindakan ini tidak bisa dibatalkan.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Batal'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFE65100),
            ),
            child: const Text(
              'Hapus',
              style: TextStyle(color: Colors.white),
            ),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    try {
      await ApiService.deleteUser(guru['id'] as int);
      await _clearUserCaches();
      await _loadGuru(forceRefresh: true);
      _showSnack('Data ${guru['name']} berhasil dihapus');
    } catch (e) {
      _showSnack('Gagal menghapus guru: $e', isError: true);
    }
  }

  void _showQuickActions() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        padding: const EdgeInsets.fromLTRB(20, 18, 20, 24),
        decoration: const BoxDecoration(
          color: Color(0xFFE1EFF7),
          borderRadius: BorderRadius.vertical(top: Radius.circular(30)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 42,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.grey[400],
                borderRadius: BorderRadius.circular(4),
              ),
            ),
            const SizedBox(height: 16),
            const Text(
              'Kelola Guru',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: Color(0xFF2D3436),
              ),
            ),
            const SizedBox(height: 14),
            _buildSheetAction(
              icon: Icons.person_add_alt_1_rounded,
              color: const Color(0xFF138F81),
              title: 'Tambah Guru Baru',
              subtitle: 'Buat data guru dan akun login langsung ke database.',
              onTap: () {
                Navigator.pop(ctx);
                _openGuruForm();
              },
            ),
            _buildSheetAction(
              icon: Icons.file_upload_rounded,
              color: const Color(0xFF2E86DE),
              title: 'Import Excel',
              subtitle: 'Input massal data guru dari file template.',
              onTap: () {
                Navigator.pop(ctx);
                _handleImportGuru();
              },
            ),
            _buildSheetAction(
              icon: Icons.download_rounded,
              color: const Color(0xFFE65100),
              title: 'Download Template',
              subtitle: 'Ambil format Excel guru yang sudah sesuai.',
              onTap: () {
                Navigator.pop(ctx);
                _downloadTemplate();
              },
            ),
            _buildSheetAction(
              icon: Icons.help_outline_rounded,
              color: const Color(0xFF6C3483),
              title: 'Petunjuk Format',
              subtitle: 'Lihat aturan kolom, unit sekolah, dan validasi.',
              onTap: () {
                Navigator.pop(ctx);
                _showImportGuide();
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSheetAction({
    required IconData icon,
    required Color color,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(18),
      child: Container(
        width: double.infinity,
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(18),
        ),
        child: Row(
          children: [
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Icon(icon, color: color, size: 22),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF2D3436),
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: const TextStyle(
                      fontSize: 10,
                      color: Color(0xFF636E72),
                      height: 1.4,
                    ),
                  ),
                ],
              ),
            ),
            const Icon(
              Icons.chevron_right_rounded,
              color: Color(0xFF636E72),
            ),
          ],
        ),
      ),
    );
  }

  String _val(Map<String, dynamic> guru, String key, [String fallback = '-']) {
    final value = guru[key];
    if (value == null || value.toString().trim().isEmpty) {
      return fallback;
    }
    return value.toString();
  }

  List<Map<String, dynamic>> get _filteredGuru {
    if (_searchQuery.trim().isEmpty) return _guruList;
    final q = _searchQuery.toLowerCase();
    return _guruList.where((guru) {
      return _val(guru, 'name').toLowerCase().contains(q) ||
          _val(guru, 'email').toLowerCase().contains(q) ||
          _val(guru, 'kode_guru').toLowerCase().contains(q) ||
          _val(guru, 'no_hp').toLowerCase().contains(q);
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _filteredGuru;

    return Scaffold(
      backgroundColor: const Color(0xFFFFDC80),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _showQuickActions,
        backgroundColor: const Color(0xFF138F81),
        foregroundColor: Colors.white,
        icon: const Icon(Icons.school_rounded),
        label: const Text(
          'Kelola Guru',
          style: TextStyle(fontWeight: FontWeight.w700),
        ),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      ),
      body: SafeArea(
        child: FadeTransition(
          opacity: _fadeIn,
          child: Column(
            children: [
              _buildProfileBar(),
              const SizedBox(height: 12),
              _buildSearchBar(),
              const SizedBox(height: 10),
              if (_isLoading)
                const Expanded(child: _GuruLoadingState())
              else if (_errorMessage != null)
                Expanded(
                  child: _GuruErrorState(message: _errorMessage!, onRetry: _loadGuru),
                )
              else ...[
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  child: Row(
                    children: [
                      Text(
                        '${filtered.length} Guru Ditemukan',
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF636E72),
                        ),
                      ),
                      const Spacer(),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: const Color(0xFF138F81).withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Text(
                          'Total: ${_guruList.length}',
                          style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF138F81),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 8),
                Expanded(
                  child: RefreshIndicator(
                    onRefresh: () => _loadGuru(forceRefresh: true),
                    color: const Color(0xFF138F81),
                    child: ListView.builder(
                      physics: const AlwaysScrollableScrollPhysics(
                        parent: BouncingScrollPhysics(),
                      ),
                      padding: const EdgeInsets.fromLTRB(16, 0, 16, 90),
                      itemCount: filtered.length,
                      itemBuilder: (context, index) {
                        return _buildGuruCard(filtered[index], index);
                      },
                    ),
                  ),
                ),
              ],
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
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: const Color(0xFF138F81).withValues(alpha: 0.15),
              ),
              child: const Icon(
                Icons.school_rounded,
                color: Color(0xFF138F81),
                size: 26,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Expanded(
                        child: Text(
                          'Data Guru',
                          style: TextStyle(
                            fontSize: 17,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF2D3436),
                          ),
                        ),
                      ),
                      if (_isOfflineMode)
                        _buildMiniBadge(
                          label: 'Offline',
                          color: const Color(0xFFE65100),
                        ),
                      if (_isSyncing && !_isLoading) ...[
                        const SizedBox(width: 6),
                        _buildMiniBadge(
                          label: 'Sync',
                          color: const Color(0xFF138F81),
                        ),
                      ],
                    ],
                  ),
                  const Text(
                    'Buku Induk - Data Guru',
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

  Widget _buildMiniBadge({required String label, required Color color}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 8,
          fontWeight: FontWeight.w700,
          color: color,
        ),
      ),
    );
  }

  Widget _buildSearchBar() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(21),
        ),
        child: Row(
          children: [
            const Icon(
              Icons.search_rounded,
              color: Color(0xFF138F81),
              size: 22,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: TextField(
                controller: _searchController,
                onChanged: (value) => setState(() => _searchQuery = value),
                decoration: const InputDecoration(
                  hintText: 'Cari nama / email / kode guru...',
                  border: InputBorder.none,
                  hintStyle: TextStyle(
                    fontSize: 13,
                    color: Color(0xFF636E72),
                  ),
                ),
                style: const TextStyle(fontSize: 13),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildGuruCard(Map<String, dynamic> guru, int index) {
    final isExpanded = _expandedIndex == index;
    final name = _val(guru, 'name');
    final initial = name.isNotEmpty ? name[0].toUpperCase() : 'G';
    final status = _val(guru, 'status', 'Aktif');

    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: Duration(milliseconds: 350 + (index * 70)),
      curve: Curves.easeOutCubic,
      builder: (context, value, child) {
        return Transform.translate(
          offset: Offset(0, 18 * (1 - value)),
          child: Opacity(opacity: value, child: child),
        );
      },
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
        ),
        child: Column(
          children: [
            InkWell(
              borderRadius: BorderRadius.circular(20),
              onTap: () {
                setState(() {
                  _expandedIndex = isExpanded ? null : index;
                });
              },
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Row(
                  children: [
                    Container(
                      width: 48,
                      height: 48,
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: [
                            Color(0xFF138F81),
                            Color(0xFF3CB8A9),
                          ],
                        ),
                        borderRadius: BorderRadius.circular(15),
                      ),
                      child: Center(
                        child: Text(
                          initial,
                          style: const TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.w700,
                            color: Colors.white,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            name,
                            style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF2D3436),
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          const SizedBox(height: 3),
                          Wrap(
                            spacing: 6,
                            runSpacing: 4,
                            children: [
                              _buildInfoChip(
                                _val(guru, 'kode_guru'),
                                const Color(0xFF138F81),
                              ),
                              _buildInfoChip('Guru', const Color(0xFF2E86DE)),
                              _buildInfoChip(
                                status,
                                status == 'Aktif'
                                    ? const Color(0xFF138F81)
                                    : const Color(0xFFE65100),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    AnimatedRotation(
                      turns: isExpanded ? 0.25 : 0,
                      duration: const Duration(milliseconds: 200),
                      child: const Icon(
                        Icons.chevron_right_rounded,
                        color: Color(0xFF636E72),
                        size: 24,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            AnimatedSize(
              duration: const Duration(milliseconds: 250),
              curve: Curves.easeInOut,
              child: isExpanded
                  ? Column(
                      children: [
                        Container(
                          margin: const EdgeInsets.symmetric(horizontal: 14),
                          height: 1,
                          color: const Color(0xFF000000).withValues(alpha: 0.06),
                        ),
                        Padding(
                          padding: const EdgeInsets.fromLTRB(14, 10, 14, 12),
                          child: Column(
                            children: [
                              _buildDetailRow('Nama Lengkap', name),
                              _buildDetailRow('Email', _val(guru, 'email')),
                              _buildDetailRow('No. HP', _val(guru, 'no_hp')),
                              _buildDetailRow('Kode Guru', _val(guru, 'kode_guru')),
                              _buildDetailRow(
                                'Jenis Kelamin',
                                _genderLabel(_val(guru, 'jenis_kelamin')),
                              ),
                              _buildDetailRow(
                                'Unit Mengajar',
                                _joinList(guru['unit_kerja']),
                              ),
                              _buildDetailRow(
                                'Status Sebagai',
                                _joinList(guru['kategori_guru']),
                              ),
                              _buildDetailRow('Alamat', _val(guru, 'alamat')),
                            ],
                          ),
                        ),
                        Container(
                          margin: const EdgeInsets.fromLTRB(14, 0, 14, 12),
                          child: Row(
                            children: [
                              _buildActionBtn(
                                'Edit',
                                Icons.edit_rounded,
                                const Color(0xFF2E86DE),
                                () => _openGuruForm(guru: guru),
                              ),
                              const SizedBox(width: 6),
                              _buildActionBtn(
                                'Status',
                                Icons.toggle_on_rounded,
                                const Color(0xFFFFB74D),
                                () => _handleEditStatus(guru),
                              ),
                              const SizedBox(width: 6),
                              _buildActionBtn(
                                'Hapus',
                                Icons.delete_rounded,
                                const Color(0xFFE65100),
                                () => _handleDelete(guru),
                              ),
                            ],
                          ),
                        ),
                      ],
                    )
                  : const SizedBox.shrink(),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildInfoChip(String text, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        text,
        style: TextStyle(
          fontSize: 8,
          fontWeight: FontWeight.w700,
          color: color,
        ),
      ),
    );
  }

  Widget _buildDetailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 96,
            child: Text(
              label,
              style: const TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w500,
                color: Color(0xFF636E72),
              ),
            ),
          ),
          const Text(
            ': ',
            style: TextStyle(fontSize: 10, color: Color(0xFF636E72)),
          ),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w600,
                color: Color(0xFF2D3436),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActionBtn(
    String label,
    IconData icon,
    Color color,
    VoidCallback onTap,
  ) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: color.withValues(alpha: 0.3), width: 1),
          ),
          child: Column(
            children: [
              Icon(icon, color: color, size: 14),
              const SizedBox(height: 2),
              Text(
                label,
                style: TextStyle(
                  fontSize: 8,
                  fontWeight: FontWeight.w700,
                  color: color,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _genderLabel(String value) {
    if (value == 'L') return 'Laki-laki';
    if (value == 'P') return 'Perempuan';
    return value;
  }

  String _joinList(dynamic values) {
    if (values is List && values.isNotEmpty) {
      return values.join(', ');
    }
    return '-';
  }
}

class _GuruLoadingState extends StatelessWidget {
  const _GuruLoadingState();

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          CircularProgressIndicator(color: Color(0xFF138F81)),
          SizedBox(height: 16),
          Text(
            'Memuat data guru...',
            style: TextStyle(fontSize: 13, color: Color(0xFF636E72)),
          ),
        ],
      ),
    );
  }
}

class _GuruErrorState extends StatelessWidget {
  final String message;
  final Future<void> Function({bool forceRefresh}) onRetry;

  const _GuruErrorState({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
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
            message,
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 13, color: Color(0xFF636E72)),
          ),
          const SizedBox(height: 16),
          ElevatedButton.icon(
            onPressed: () => onRetry(forceRefresh: true),
            icon: const Icon(Icons.refresh_rounded),
            label: const Text('Coba Lagi'),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF138F81),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
