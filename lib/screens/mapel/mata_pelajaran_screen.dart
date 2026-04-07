import 'package:flutter/material.dart';

import '../../services/api_service.dart';
import '../../services/cache_service.dart';
import 'edit_mapel_screen.dart';

class MataPelajaranScreen extends StatefulWidget {
  const MataPelajaranScreen({super.key});

  @override
  State<MataPelajaranScreen> createState() => _MataPelajaranScreenState();
}

class _MataPelajaranScreenState extends State<MataPelajaranScreen> {
  static const _cacheKey = 'mata_pelajaran_all';

  final TextEditingController _searchController = TextEditingController();

  List<Map<String, dynamic>> _allMapel = [];
  List<Map<String, dynamic>> _filteredMapel = [];
  bool _isLoading = true;
  bool _isOfflineMode = false;
  bool _isSyncing = false;
  String _searchQuery = '';
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _loadMapel();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadMapel({bool forceRefresh = false}) async {
    if (!mounted) return;

    if (forceRefresh) {
      setState(() {
        _isSyncing = true;
        _errorMessage = null;
      });
    } else {
      setState(() {
        _isLoading = _allMapel.isEmpty;
        _isSyncing = true;
        _errorMessage = null;
      });
    }

    final cached = await CacheService.get(_cacheKey);
    if (cached is Map<String, dynamic> &&
        mounted &&
        cached['success'] == true &&
        (_allMapel.isEmpty || !forceRefresh)) {
      final cachedList = List<Map<String, dynamic>>.from(cached['data'] ?? []);
      setState(() {
        _allMapel = cachedList;
        _applySearch();
        _isLoading = false;
        _isOfflineMode = true;
      });
    }

    try {
      final result = await ApiService.getMataPelajaran();
      await CacheService.save(_cacheKey, result);

      if (!mounted) return;
      setState(() {
        _allMapel = List<Map<String, dynamic>>.from(result['data'] ?? []);
        _applySearch();
        _isLoading = false;
        _isOfflineMode = false;
        _isSyncing = false;
        _errorMessage = null;
      });
    } catch (e) {
      if (!mounted) return;

      if (_allMapel.isEmpty) {
        setState(() {
          _isLoading = false;
          _isSyncing = false;
          _isOfflineMode = false;
          _errorMessage =
              'Data mata pelajaran belum bisa dimuat.\nCoba cek koneksi atau nyalakan backend.';
        });
      } else {
        setState(() {
          _isLoading = false;
          _isSyncing = false;
          _isOfflineMode = true;
        });
        _showSnackBar(
          'Mode offline aktif, menampilkan data terakhir tersimpan.',
        );
      }
    }
  }

  void _applySearch() {
    if (_searchQuery.trim().isEmpty) {
      _filteredMapel = List<Map<String, dynamic>>.from(_allMapel);
      return;
    }

    final q = _searchQuery.toLowerCase();
    _filteredMapel = _allMapel.where((mapel) {
      final nama = (mapel['nama'] ?? '').toString().toLowerCase();
      final kode = (mapel['kode'] ?? '').toString().toLowerCase();
      final guruList = List<Map<String, dynamic>>.from(mapel['guru'] ?? []);
      final guruNames = guruList
          .map((guru) => (guru['name'] ?? '').toString().toLowerCase())
          .join(' ');
      return nama.contains(q) || kode.contains(q) || guruNames.contains(q);
    }).toList();
  }

  void _showSnackBar(String message, {bool isError = false}) {
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

  Future<void> _toggleStatus(Map<String, dynamic> mapel) async {
    final id = mapel['id'] as int;
    final currentStatus = mapel['status']?.toString() ?? 'Aktif';
    final newStatus = currentStatus == 'Aktif' ? 'Nonaktif' : 'Aktif';

    try {
      await ApiService.toggleMapelStatus(id, newStatus);
      _showSnackBar('${mapel['nama']} -> $newStatus');
      await _loadMapel(forceRefresh: true);
    } catch (e) {
      _showSnackBar('Gagal mengubah status: $e', isError: true);
    }
  }

  Future<void> _deleteMapel(Map<String, dynamic> mapel) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('Hapus Mata Pelajaran?'),
        content: Text(
          'Apakah kamu yakin ingin menghapus "${mapel['nama']}"?',
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
      await ApiService.deleteMataPelajaran(mapel['id'] as int);
      _showSnackBar('${mapel['nama']} berhasil dihapus');
      await _loadMapel(forceRefresh: true);
    } catch (e) {
      _showSnackBar('Gagal menghapus: $e', isError: true);
    }
  }

  void _showTambahMapelDialog() {
    final namaController = TextEditingController();
    final kodeController = TextEditingController();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        padding: EdgeInsets.fromLTRB(
          24,
          20,
          24,
          MediaQuery.of(ctx).viewInsets.bottom + 24,
        ),
        decoration: const BoxDecoration(
          color: Color(0xFFE1EFF7),
          borderRadius: BorderRadius.vertical(top: Radius.circular(30)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey[400],
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 16),
            const Text(
              'Tambah Mata Pelajaran',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: Color(0xFF2D3436),
              ),
            ),
            const SizedBox(height: 16),
            const Text(
              'Nama Mapel',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: Color(0xFF636E72),
              ),
            ),
            const SizedBox(height: 6),
            TextField(
              controller: namaController,
              decoration: InputDecoration(
                filled: true,
                fillColor: Colors.white,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                  borderSide: BorderSide.none,
                ),
                hintText: 'Contoh: TAFSIR',
              ),
            ),
            const SizedBox(height: 14),
            const Text(
              'Kode Mapel (opsional)',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: Color(0xFF636E72),
              ),
            ),
            const SizedBox(height: 6),
            TextField(
              controller: kodeController,
              decoration: InputDecoration(
                filled: true,
                fillColor: Colors.white,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                  borderSide: BorderSide.none,
                ),
                hintText: 'TAF',
              ),
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              height: 48,
              child: ElevatedButton(
                onPressed: () async {
                  if (namaController.text.trim().isEmpty) {
                    _showSnackBar('Nama mapel wajib diisi', isError: true);
                    return;
                  }

                  try {
                    await ApiService.createMataPelajaran({
                      'nama': namaController.text.trim().toUpperCase(),
                      'kode': kodeController.text.trim().isEmpty
                          ? null
                          : kodeController.text.trim().toUpperCase(),
                      'status': 'Aktif',
                    });
                    if (ctx.mounted) Navigator.pop(ctx);
                    _showSnackBar(
                      '${namaController.text.trim().toUpperCase()} berhasil ditambahkan',
                    );
                    await _loadMapel(forceRefresh: true);
                  } catch (e) {
                    _showSnackBar('Gagal menambah mapel: $e', isError: true);
                  }
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF138F81),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                  elevation: 0,
                ),
                child: const Text(
                  'Simpan',
                  style: TextStyle(fontWeight: FontWeight.w700),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFFDC80),
      floatingActionButton: FloatingActionButton(
        onPressed: _showTambahMapelDialog,
        backgroundColor: const Color(0xFF138F81),
        child: const Icon(Icons.add_rounded, color: Colors.white, size: 28),
      ),
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
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
                        Icons.menu_book_rounded,
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
                                  'Mata Pelajaran',
                                  style: TextStyle(
                                    fontSize: 18,
                                    fontWeight: FontWeight.w700,
                                    color: Color(0xFF2D3436),
                                  ),
                                ),
                              ),
                              if (_isOfflineMode)
                                _buildTinyStatusChip(
                                  label: 'Offline',
                                  color: const Color(0xFFE65100),
                                ),
                              if (_isSyncing && !_isLoading) ...[
                                const SizedBox(width: 6),
                                _buildTinyStatusChip(
                                  label: 'Sync',
                                  color: const Color(0xFF138F81),
                                ),
                              ],
                            ],
                          ),
                          const Text(
                            'Kelola mapel, jadwal & guru pengajar',
                            style: TextStyle(
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
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(25),
                ),
                child: TextField(
                  controller: _searchController,
                  onChanged: (value) {
                    setState(() {
                      _searchQuery = value;
                      _applySearch();
                    });
                  },
                  decoration: const InputDecoration(
                    hintText: 'Cari mata pelajaran / guru...',
                    hintStyle: TextStyle(
                      fontSize: 14,
                      color: Color(0xFF636E72),
                    ),
                    border: InputBorder.none,
                    icon: Icon(
                      Icons.search_rounded,
                      color: Color(0xFF138F81),
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 12),
            Expanded(
              child: Container(
                width: double.infinity,
                margin: const EdgeInsets.symmetric(horizontal: 16),
                padding: const EdgeInsets.symmetric(
                  horizontal: 14,
                  vertical: 16,
                ),
                decoration: BoxDecoration(
                  color: const Color(0xFFE1EFF7),
                  borderRadius: BorderRadius.circular(30),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(
                          '${_filteredMapel.length} mapel tampil',
                          style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF636E72),
                          ),
                        ),
                        const Spacer(),
                        if (_isOfflineMode)
                          const Text(
                            'Menampilkan cache terakhir',
                            style: TextStyle(
                              fontSize: 10,
                              color: Color(0xFFE65100),
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Expanded(child: _buildContent()),
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

  Widget _buildContent() {
    if (_isLoading) {
      return ListView(
        physics: const BouncingScrollPhysics(),
        children: List.generate(4, (_) => _buildLoadingSkeleton()),
      );
    }

    if (_errorMessage != null) {
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
              _errorMessage!,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 13,
                color: Color(0xFF636E72),
                height: 1.5,
              ),
            ),
            const SizedBox(height: 14),
            ElevatedButton.icon(
              onPressed: () => _loadMapel(forceRefresh: true),
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

    if (_filteredMapel.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              _allMapel.isEmpty
                  ? Icons.menu_book_outlined
                  : Icons.search_off_rounded,
              size: 48,
              color: const Color(0xFF636E72),
            ),
            const SizedBox(height: 12),
            Text(
              _allMapel.isEmpty
                  ? 'Belum ada mata pelajaran tersimpan'
                  : 'Tidak ada hasil yang cocok',
              style: const TextStyle(
                fontSize: 14,
                color: Color(0xFF636E72),
              ),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: () => _loadMapel(forceRefresh: true),
      color: const Color(0xFF138F81),
      child: ListView.builder(
        physics: const AlwaysScrollableScrollPhysics(
          parent: BouncingScrollPhysics(),
        ),
        itemCount: _filteredMapel.length,
        itemBuilder: (context, index) {
          return _buildMapelCard(_filteredMapel[index]);
        },
      ),
    );
  }

  Widget _buildTinyStatusChip({
    required String label,
    required Color color,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(8),
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

  Widget _buildLoadingSkeleton() {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(21),
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: const Color(0xFF138F81).withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(12),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 120,
                  height: 12,
                  decoration: BoxDecoration(
                    color: const Color(0xFF138F81).withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
                const SizedBox(height: 8),
                Container(
                  width: 180,
                  height: 10,
                  decoration: BoxDecoration(
                    color: const Color(0xFF138F81).withValues(alpha: 0.05),
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMapelCard(Map<String, dynamic> mapel) {
    final isActive = mapel['status'] == 'Aktif';
    final guruList = List<Map<String, dynamic>>.from(mapel['guru'] ?? []);
    final jadwalList = List<Map<String, dynamic>>.from(mapel['jadwal'] ?? []);
    final guruNames = guruList.isNotEmpty
        ? guruList.map((guru) => guru['name'] ?? '').join(', ')
        : 'Belum ada guru';

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 300),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(21),
          border: Border.all(
            color: isActive
                ? const Color(0xFF138F81).withValues(alpha: 0.25)
                : Colors.grey.withValues(alpha: 0.18),
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: isActive
                        ? const Color(0xFF138F81).withValues(alpha: 0.12)
                        : Colors.grey.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(
                    isActive
                        ? Icons.check_circle_rounded
                        : Icons.pause_circle_rounded,
                    size: 18,
                    color: isActive
                        ? const Color(0xFF138F81)
                        : Colors.grey,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        (mapel['nama'] ?? '').toString(),
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: isActive
                              ? const Color(0xFF2D3436)
                              : const Color(0xFF636E72),
                        ),
                      ),
                      Text(
                        '${mapel['kode'] ?? '-'} • $guruNames',
                        style: const TextStyle(
                          fontSize: 10,
                          color: Color(0xFF636E72),
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: isActive
                        ? const Color(0xFF138F81).withValues(alpha: 0.12)
                        : Colors.grey.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    isActive ? 'Aktif' : 'Nonaktif',
                    style: TextStyle(
                      fontSize: 9,
                      fontWeight: FontWeight.w700,
                      color: isActive
                          ? const Color(0xFF138F81)
                          : Colors.grey,
                    ),
                  ),
                ),
              ],
            ),
            if (jadwalList.isNotEmpty) ...[
              const SizedBox(height: 8),
              Wrap(
                spacing: 6,
                runSpacing: 4,
                children: jadwalList.take(3).map((jadwal) {
                  return Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 3,
                    ),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFFDC80).withValues(alpha: 0.4),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      '${jadwal['hari']} ${jadwal['jam_mulai']}-${jadwal['jam_selesai']}',
                      style: const TextStyle(
                        fontSize: 9,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF2D3436),
                      ),
                    ),
                  );
                }).toList(),
              ),
            ],
            const SizedBox(height: 10),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                GestureDetector(
                  onTap: () async {
                    await Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => EditMapelScreen(mapelData: mapel),
                      ),
                    );
                    await _loadMapel(forceRefresh: true);
                  },
                  child: _buildActionChip(
                    label: 'Edit',
                    icon: Icons.edit_rounded,
                    color: const Color(0xFF2E86DE),
                  ),
                ),
                const SizedBox(width: 8),
                GestureDetector(
                  onTap: () => _toggleStatus(mapel),
                  child: _buildActionChip(
                    label: isActive ? 'Nonaktifkan' : 'Aktifkan',
                    icon: isActive
                        ? Icons.pause_rounded
                        : Icons.play_arrow_rounded,
                    color: isActive
                        ? const Color(0xFFE65100)
                        : const Color(0xFF138F81),
                  ),
                ),
                const SizedBox(width: 8),
                GestureDetector(
                  onTap: () => _deleteMapel(mapel),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: const Color(0xFFE65100).withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(
                      Icons.delete_rounded,
                      size: 14,
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

  Widget _buildActionChip({
    required String label,
    required IconData icon,
    required Color color,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        children: [
          Icon(icon, size: 12, color: color),
          const SizedBox(width: 4),
          Text(
            label,
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w700,
              color: color,
            ),
          ),
        ],
      ),
    );
  }
}
