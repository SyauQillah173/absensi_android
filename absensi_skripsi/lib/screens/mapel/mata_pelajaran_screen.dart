import 'dart:async';

import 'package:flutter/material.dart';

import '../../services/api_service.dart';
import '../../services/cache_service.dart';
import '../../services/sync_service.dart';
import '../../widgets/adaptive_bottom_sheet.dart';
import 'edit_mapel_screen.dart';

class MataPelajaranScreen extends StatefulWidget {
  final bool readOnly;

  const MataPelajaranScreen({super.key, this.readOnly = false});

  @override
  State<MataPelajaranScreen> createState() => _MataPelajaranScreenState();
}

class _MataPelajaranScreenState extends State<MataPelajaranScreen> {
  static const _cacheVersion = 'v3';

  final TextEditingController _searchController = TextEditingController();
  StreamSubscription<AppDataEvent>? _syncSubscription;

  List<Map<String, dynamic>> _allMapel = [];
  List<Map<String, dynamic>> _filteredMapel = [];
  bool _isLoading = true;
  bool _isOfflineMode = false;
  bool _isSyncing = false;
  String _searchQuery = '';
  String? _errorMessage;
  final Set<int> _pendingToggleIds = <int>{};
  final Set<int> _pendingDeleteIds = <int>{};
  int _skipNextMapelSyncReloads = 0;

  String get _cacheKey =>
      'mata_pelajaran_skripsi_${widget.readOnly ? 'guru_aktif' : 'admin_all'}_$_cacheVersion';

  @override
  void initState() {
    super.initState();
    _loadMapel();
    _syncSubscription = SyncService.dataEvents.listen((event) {
      if (!mounted) return;
      if (event.topic == SyncTopics.mapel) {
        if (_skipNextMapelSyncReloads > 0) {
          _skipNextMapelSyncReloads--;
          return;
        }
        _loadMapel();
      } else if (event.topic == SyncTopics.heartbeat) {
        _loadMapel();
      }
    });
  }

  @override
  void dispose() {
    _syncSubscription?.cancel();
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
        _allMapel.isEmpty) {
      final cachedList = List<Map<String, dynamic>>.from(cached['data'] ?? []);
      setState(() {
        _allMapel = cachedList;
        _applySearch();
        _isLoading = false;
        _isOfflineMode = true;
      });
    }

    try {
      final result = await ApiService.getMataPelajaran(
        status: widget.readOnly ? 'Aktif' : null,
        userId: null,
        requireJadwal: false,
      );
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
      return nama.contains(q) || kode.contains(q);
    }).toList();
  }

  void _setLocalMapelList(List<Map<String, dynamic>> items) {
    _allMapel = List<Map<String, dynamic>>.from(
      items.map((item) => Map<String, dynamic>.from(item)),
    );
    _applySearch();
  }

  Future<void> _persistLocalCache() async {
    await CacheService.save(_cacheKey, {'success': true, 'data': _allMapel});
  }

  void _replaceLocalMapel(Map<String, dynamic> updated) {
    final id = (updated['id'] as num?)?.toInt();
    if (id == null) return;

    final next = List<Map<String, dynamic>>.from(_allMapel);
    final index = next.indexWhere((item) => item['id'] == id);
    if (index >= 0) {
      next[index] = Map<String, dynamic>.from(updated);
    } else {
      next.add(Map<String, dynamic>.from(updated));
    }
    next.sort((a, b) {
      final left = a['nama']?.toString() ?? '';
      final right = b['nama']?.toString() ?? '';
      return left.compareTo(right);
    });
    _setLocalMapelList(next);
  }

  void _removeLocalMapel(int id) {
    final next = List<Map<String, dynamic>>.from(_allMapel)
      ..removeWhere((item) => (item['id'] as num?)?.toInt() == id);
    _setLocalMapelList(next);
  }

  void _suppressNextMapelSyncReload() {
    _skipNextMapelSyncReloads++;
  }

  void _showSnackBar(String message, {bool isError = false}) {
    if (!mounted) return;
    final messenger = ScaffoldMessenger.of(context);
    messenger.hideCurrentSnackBar();
    messenger.showSnackBar(
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
    if (widget.readOnly) {
      _showSnackBar('Guru hanya dapat melihat mata pelajaran.', isError: true);
      return;
    }

    final id = (mapel['id'] as num?)?.toInt();
    if (id == null || _pendingToggleIds.contains(id)) return;

    final previous = Map<String, dynamic>.from(mapel);
    final currentStatus = mapel['status']?.toString() == 'Nonaktif'
        ? 'Nonaktif'
        : 'Aktif';
    final nextStatus = currentStatus == 'Aktif' ? 'Nonaktif' : 'Aktif';
    final mapelName = (mapel['nama']?.toString().trim().isNotEmpty ?? false)
        ? mapel['nama'].toString().trim()
        : 'Mata pelajaran';

    setState(() {
      _pendingToggleIds.add(id);
      _replaceLocalMapel({...previous, 'status': nextStatus});
    });

    try {
      final result = await ApiService.toggleMapelStatus(id, nextStatus);
      final updated = result['data'];
      if (updated is Map) {
        _replaceLocalMapel(Map<String, dynamic>.from(updated));
      }
      await _persistLocalCache();
      _suppressNextMapelSyncReload();
      await SyncService.notifyDataChanged(
        SyncTopics.mapel,
        message: 'Status mata pelajaran telah diperbarui',
      );
      await SyncService.notifyDataChanged(
        SyncTopics.absensi,
        message: 'Daftar absensi perlu diperbarui',
      );
      _showSnackBar('$mapelName menjadi $nextStatus');
    } catch (e) {
      if (mounted) {
        setState(() => _replaceLocalMapel(previous));
      }
      _showSnackBar('Gagal mengubah status: $e', isError: true);
    } finally {
      if (mounted) {
        setState(() => _pendingToggleIds.remove(id));
      }
    }
  }

  Future<void> _deleteMapel(Map<String, dynamic> mapel) async {
    if (widget.readOnly) {
      _showSnackBar('Guru hanya dapat melihat mata pelajaran.', isError: true);
      return;
    }

    final id = (mapel['id'] as num?)?.toInt();
    if (id == null || _pendingDeleteIds.contains(id)) return;

    final name = (mapel['nama']?.toString().trim().isNotEmpty ?? false)
        ? mapel['nama'].toString().trim()
        : 'Mata pelajaran';
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('Hapus Mata Pelajaran?'),
        content: Text('"$name" akan dihapus dari data mata pelajaran.'),
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
            child: const Text('Hapus', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    setState(() => _pendingDeleteIds.add(id));
    try {
      await ApiService.deleteMataPelajaran(id);
      if (mounted) {
        setState(() => _removeLocalMapel(id));
      }
      await _persistLocalCache();
      _suppressNextMapelSyncReload();
      await SyncService.notifyDataChanged(
        SyncTopics.mapel,
        message: 'Data mata pelajaran telah diperbarui',
      );
      await SyncService.notifyDataChanged(
        SyncTopics.absensi,
        message: 'Daftar absensi perlu diperbarui',
      );
      _showSnackBar('$name berhasil dihapus');
    } catch (e) {
      _showSnackBar('Gagal menghapus mata pelajaran: $e', isError: true);
    } finally {
      if (mounted) {
        setState(() => _pendingDeleteIds.remove(id));
      }
    }
  }

  void _showTambahMapelDialog() {
    if (widget.readOnly) {
      _showSnackBar('Guru hanya dapat melihat mata pelajaran.', isError: true);
      return;
    }

    final namaController = TextEditingController();
    final kodeController = TextEditingController();
    bool isSaving = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) {
          Future<void> save() async {
            final nama = namaController.text.trim().toUpperCase();
            final kode = kodeController.text.trim().toUpperCase();
            if (nama.isEmpty) {
              _showSnackBar('Nama mata pelajaran wajib diisi', isError: true);
              return;
            }

            setModalState(() => isSaving = true);
            try {
              final result = await ApiService.createMataPelajaran({
                'nama': nama,
                if (kode.isNotEmpty) 'kode': kode,
                'status': 'Aktif',
              });
              final created = result['data'];
              if (created is Map && mounted) {
                setState(
                  () => _replaceLocalMapel(Map<String, dynamic>.from(created)),
                );
                await _persistLocalCache();
              }
              _suppressNextMapelSyncReload();
              await SyncService.notifyDataChanged(
                SyncTopics.mapel,
                message: 'Mata pelajaran baru ditambahkan',
              );
              await SyncService.notifyDataChanged(
                SyncTopics.absensi,
                message: 'Daftar absensi perlu diperbarui',
              );
              if (!mounted || !ctx.mounted) return;
              Navigator.pop(ctx);
              _showSnackBar('$nama berhasil ditambahkan');
            } catch (e) {
              _showSnackBar('Gagal menambah mata pelajaran: $e', isError: true);
            } finally {
              if (ctx.mounted) {
                setModalState(() => isSaving = false);
              }
            }
          }

          return AdaptiveBottomSheet(
            padding: const EdgeInsets.fromLTRB(24, 20, 24, 24),
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
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF2D3436),
                  ),
                ),
                const SizedBox(height: 18),
                const Text(
                  'Nama Mata Pelajaran',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF636E72),
                  ),
                ),
                const SizedBox(height: 6),
                TextField(
                  controller: namaController,
                  textCapitalization: TextCapitalization.characters,
                  enabled: !isSaving,
                  decoration: InputDecoration(
                    filled: true,
                    fillColor: Colors.white,
                    hintText: 'Contoh: TAFSIR',
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(14),
                      borderSide: BorderSide.none,
                    ),
                  ),
                ),
                const SizedBox(height: 14),
                const Text(
                  'Kode Mapel (opsional)',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF636E72),
                  ),
                ),
                const SizedBox(height: 6),
                TextField(
                  controller: kodeController,
                  textCapitalization: TextCapitalization.characters,
                  enabled: !isSaving,
                  decoration: InputDecoration(
                    filled: true,
                    fillColor: Colors.white,
                    hintText: 'TAF',
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(14),
                      borderSide: BorderSide.none,
                    ),
                  ),
                ),
                const SizedBox(height: 22),
                SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: ElevatedButton(
                    onPressed: isSaving ? null : save,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF138F81),
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(18),
                      ),
                    ),
                    child: isSaving
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Text(
                            'Simpan Mata Pelajaran',
                            style: TextStyle(fontWeight: FontWeight.w700),
                          ),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    ).whenComplete(() {
      namaController.dispose();
      kodeController.dispose();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFFDC80),
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
                          Text(
                            widget.readOnly
                                ? 'Lihat semua mata pelajaran'
                                : 'Kelola mata pelajaran',
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
                    hintText: 'Cari mata pelajaran...',
                    hintStyle: TextStyle(
                      fontSize: 14,
                      color: Color(0xFF636E72),
                    ),
                    border: InputBorder.none,
                    icon: Icon(Icons.search_rounded, color: Color(0xFF138F81)),
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
          ],
        ),
      ),
      floatingActionButton: widget.readOnly
          ? null
          : FloatingActionButton.extended(
              onPressed: _showTambahMapelDialog,
              backgroundColor: const Color(0xFF138F81),
              foregroundColor: Colors.white,
              icon: const Icon(Icons.add_rounded),
              label: const Text(
                'Tambah Mapel',
                style: TextStyle(fontWeight: FontWeight.w700),
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
              style: const TextStyle(fontSize: 14, color: Color(0xFF636E72)),
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

  Widget _buildTinyStatusChip({required String label, required Color color}) {
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
    final mapelId = (mapel['id'] as num?)?.toInt() ?? 0;
    final isActive = mapel['status'] == 'Aktif';
    final isToggling = _pendingToggleIds.contains(mapelId);
    final isDeleting = _pendingDeleteIds.contains(mapelId);

    return Padding(
      key: ValueKey('mapel_card_$mapelId'),
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
                    color: isActive ? const Color(0xFF138F81) : Colors.grey,
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
                        'Mata pelajaran ${isActive ? 'aktif' : 'nonaktif'}',
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
                      color: isActive ? const Color(0xFF138F81) : Colors.grey,
                    ),
                  ),
                ),
              ],
            ),

            const SizedBox(height: 10),
            if (!widget.readOnly)
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  GestureDetector(
                    onTap: isToggling ? null : () => _toggleStatus(mapel),
                    child: _buildActionChip(
                      label: isActive ? 'Nonaktifkan' : 'Aktifkan',
                      icon: isActive
                          ? Icons.pause_circle_outline_rounded
                          : Icons.play_circle_outline_rounded,
                      color: isActive
                          ? const Color(0xFFE65100)
                          : const Color(0xFF138F81),
                      isLoading: isToggling,
                    ),
                  ),
                  const SizedBox(width: 8),
                  GestureDetector(
                    onTap: () async {
                      final result = await Navigator.push<dynamic>(
                        context,
                        MaterialPageRoute(
                          builder: (_) => EditMapelScreen(mapelData: mapel),
                        ),
                      );
                      if (result is Map<String, dynamic>) {
                        if (!mounted) return;
                        setState(() => _replaceLocalMapel(result));
                        await _persistLocalCache();
                        _suppressNextMapelSyncReload();
                        await SyncService.notifyDataChanged(
                          SyncTopics.mapel,
                          message: 'Data mata pelajaran telah diperbarui',
                        );
                        _showSnackBar(
                          '${result['nama'] ?? 'Mata pelajaran'} berhasil diperbarui',
                        );
                      } else if (result == true) {
                        await _loadMapel(forceRefresh: true);
                      }
                    },
                    child: _buildActionChip(
                      label: 'Edit',
                      icon: Icons.edit_rounded,
                      color: const Color(0xFF2E86DE),
                    ),
                  ),
                  const SizedBox(width: 8),
                  GestureDetector(
                    onTap: isDeleting ? null : () => _deleteMapel(mapel),
                    child: _buildActionChip(
                      label: 'Hapus',
                      icon: Icons.delete_outline_rounded,
                      color: const Color(0xFFD63031),
                      isLoading: isDeleting,
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
    bool isLoading = false,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        children: [
          if (isLoading)
            SizedBox(
              width: 12,
              height: 12,
              child: CircularProgressIndicator(strokeWidth: 2, color: color),
            )
          else
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
