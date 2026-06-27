import 'dart:async';

import 'package:flutter/material.dart';

import '../../services/api_service.dart';
import '../../services/cache_service.dart';
import '../../services/sync_service.dart';

class DataKelasScreen extends StatefulWidget {
  final bool readOnly;

  const DataKelasScreen({super.key, this.readOnly = false});

  @override
  State<DataKelasScreen> createState() => _DataKelasScreenState();
}

class _DataKelasScreenState extends State<DataKelasScreen> {
  static const _cacheKey = 'classes_skripsi_all_v1';

  final TextEditingController _searchController = TextEditingController();
  StreamSubscription<AppDataEvent>? _syncSubscription;

  List<Map<String, dynamic>> _classes = [];
  bool _isLoading = true;
  bool _isOfflineMode = false;
  String _searchQuery = '';
  String? _errorMessage;
  final Set<int> _pendingIds = <int>{};

  List<Map<String, dynamic>> get _filteredClasses {
    if (_searchQuery.trim().isEmpty) return _classes;
    final query = _searchQuery.toLowerCase();
    return _classes.where((item) {
      final name = item['name']?.toString().toLowerCase() ?? '';
      final code = item['code']?.toString().toLowerCase() ?? '';
      final category = item['category']?.toString().toLowerCase() ?? '';
      return name.contains(query) ||
          code.contains(query) ||
          category.contains(query);
    }).toList();
  }

  @override
  void initState() {
    super.initState();
    _loadClasses();
    _syncSubscription = SyncService.dataEvents.listen((event) {
      if (!mounted) return;
      if (event.topic == SyncTopics.kelas ||
          event.topic == SyncTopics.connectivity ||
          event.topic == SyncTopics.heartbeat) {
        _loadClasses(silent: true);
      }
    });
  }

  @override
  void dispose() {
    _syncSubscription?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadClasses({bool silent = false}) async {
    if (!silent) {
      setState(() {
        _isLoading = _classes.isEmpty;
        _errorMessage = null;
      });
    }

    final result = await CacheService.fetchWithCache(
      cacheKey: _cacheKey,
      apiFetch: () => ApiService.getClasses(includeInactive: true),
    );

    if (!mounted) return;
    if (result != null && result['success'] == true) {
      final data = List<Map<String, dynamic>>.from(result['data'] ?? const []);
      data.sort((a, b) {
        final left = '${a['category'] ?? ''}${a['name'] ?? ''}';
        final right = '${b['category'] ?? ''}${b['name'] ?? ''}';
        return left.compareTo(right);
      });
      setState(() {
        _classes = data;
        _isLoading = false;
        _isOfflineMode = result['_fromCache'] == true;
        _errorMessage = null;
      });
      return;
    }

    setState(() {
      _isLoading = false;
      _isOfflineMode = false;
      _errorMessage =
          'Data kelas belum bisa dimuat.\nCoba cek koneksi atau backend.';
    });
  }

  Future<void> _persistCache() async {
    await CacheService.save(_cacheKey, {'success': true, 'data': _classes});
  }

  void _showSnack(String message, {bool isError = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          content: Text(message),
          backgroundColor: isError
              ? const Color(0xFFE65100)
              : const Color(0xFF138F81),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
        ),
      );
  }

  void _replaceLocal(Map<String, dynamic> updated) {
    final id = (updated['id'] as num?)?.toInt();
    if (id == null) return;
    final next = List<Map<String, dynamic>>.from(_classes);
    final index = next.indexWhere((item) => (item['id'] as num?)?.toInt() == id);
    if (index >= 0) {
      next[index] = Map<String, dynamic>.from(updated);
    } else {
      next.add(Map<String, dynamic>.from(updated));
    }
    next.sort((a, b) {
      final left = '${a['category'] ?? ''}${a['name'] ?? ''}';
      final right = '${b['category'] ?? ''}${b['name'] ?? ''}';
      return left.compareTo(right);
    });
    _classes = next;
  }

  Future<void> _notifyKelasChanged(String message) async {
    await SyncService.notifyDataChanged(SyncTopics.kelas, message: message);
    await SyncService.notifyDataChanged(
      SyncTopics.absensi,
      message: 'Daftar absensi perlu diperbarui',
    );
  }

  Future<void> _toggleStatus(Map<String, dynamic> item) async {
    if (widget.readOnly) {
      _showSnack('Guru hanya dapat melihat data kelas.', isError: true);
      return;
    }
    final id = (item['id'] as num?)?.toInt();
    if (id == null || _pendingIds.contains(id)) return;
    final nextStatus = item['is_active'] != true;

    setState(() => _pendingIds.add(id));
    try {
      final result = await ApiService.toggleClassStatus(id, nextStatus);
      final updated = result['data'];
      if (updated is Map && mounted) {
        setState(() => _replaceLocal(Map<String, dynamic>.from(updated)));
        await _persistCache();
      }
      await _notifyKelasChanged('Status kelas telah diperbarui');
      _showSnack('Kelas menjadi ${nextStatus ? 'Aktif' : 'Nonaktif'}');
    } catch (e) {
      _showSnack('Gagal mengubah status kelas: $e', isError: true);
    } finally {
      if (mounted) setState(() => _pendingIds.remove(id));
    }
  }

  Future<void> _deleteClass(Map<String, dynamic> item) async {
    if (widget.readOnly) {
      _showSnack('Guru hanya dapat melihat data kelas.', isError: true);
      return;
    }
    final id = (item['id'] as num?)?.toInt();
    if (id == null || _pendingIds.contains(id)) return;
    final name = item['name']?.toString() ?? 'Kelas';

    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('Hapus Kelas Sifir?'),
        content: Text(
          '"$name" akan dihapus. Jika sudah dipakai siswa/absensi, sistem akan menonaktifkan kelas ini.',
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
            child: const Text('Hapus', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
    if (confirm != true) return;

    setState(() => _pendingIds.add(id));
    try {
      final result = await ApiService.deleteClass(id);
      final updated = result['data'];
      if (updated is Map) {
        if (mounted) {
          setState(() => _replaceLocal(Map<String, dynamic>.from(updated)));
        }
      } else if (mounted) {
        setState(() {
          _classes.removeWhere((row) => (row['id'] as num?)?.toInt() == id);
        });
      }
      await _persistCache();
      await _notifyKelasChanged('Data kelas telah diperbarui');
      _showSnack(result['message']?.toString() ?? '$name berhasil diproses');
    } catch (e) {
      _showSnack('Gagal menghapus kelas: $e', isError: true);
    } finally {
      if (mounted) setState(() => _pendingIds.remove(id));
    }
  }

  void _showClassForm({Map<String, dynamic>? item}) {
    if (widget.readOnly) {
      _showSnack('Guru hanya dapat melihat data kelas.', isError: true);
      return;
    }

    final nameController = TextEditingController(
      text: item?['name']?.toString() ?? '',
    );
    final codeController = TextEditingController(
      text: item?['code']?.toString() ?? '',
    );
    String category = item?['category']?.toString() ?? 'Sifir Awal';
    String genderGroup = item?['gender_group']?.toString() ?? 'PA';
    bool isActive = item?['is_active'] != false;
    bool isSaving = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) {
          Future<void> save() async {
            final name = nameController.text.trim();
            final code = codeController.text.trim();
            if (name.isEmpty) {
              _showSnack('Nama kelas wajib diisi', isError: true);
              return;
            }

            setModalState(() => isSaving = true);
            final payload = {
              'name': name,
              if (code.isNotEmpty) 'code': code,
              'category': category,
              'gender_group': genderGroup,
              'is_active': isActive,
            };

            try {
              final id = (item?['id'] as num?)?.toInt();
              final result = id == null
                  ? await ApiService.createClass(payload)
                  : await ApiService.updateClass(id, payload);
              final updated = result['data'];
              if (updated is Map && mounted) {
                setState(() => _replaceLocal(Map<String, dynamic>.from(updated)));
                await _persistCache();
              }
              await _notifyKelasChanged('Data kelas telah diperbarui');
              if (!mounted || !ctx.mounted) return;
              Navigator.pop(ctx);
              _showSnack(result['message']?.toString() ?? 'Kelas tersimpan');
            } catch (e) {
              _showSnack('Gagal menyimpan kelas: $e', isError: true);
            } finally {
              if (ctx.mounted) setModalState(() => isSaving = false);
            }
          }

          return Padding(
            padding: EdgeInsets.only(
              bottom: MediaQuery.of(ctx).viewInsets.bottom,
            ),
            child: Container(
              padding: const EdgeInsets.fromLTRB(24, 18, 24, 24),
              decoration: const BoxDecoration(
                color: Color(0xFFE1EFF7),
                borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
              ),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Center(
                      child: Container(
                        width: 42,
                        height: 4,
                        decoration: BoxDecoration(
                          color: Colors.grey[400],
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                    ),
                    const SizedBox(height: 18),
                    Text(
                      item == null ? 'Tambah Kelas Sifir' : 'Edit Kelas Sifir',
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF2D3436),
                      ),
                    ),
                    const SizedBox(height: 16),
                    _formLabel('Nama Kelas'),
                    TextField(
                      controller: nameController,
                      enabled: !isSaving,
                      textCapitalization: TextCapitalization.words,
                      decoration: _inputDecoration('Contoh: Sifir Awal A PA'),
                    ),
                    const SizedBox(height: 12),
                    _formLabel('Kode Kelas'),
                    TextField(
                      controller: codeController,
                      enabled: !isSaving,
                      textCapitalization: TextCapitalization.characters,
                      decoration: _inputDecoration('Opsional'),
                    ),
                    const SizedBox(height: 12),
                    _formLabel('Kategori'),
                    DropdownButtonFormField<String>(
                      initialValue: category,
                      decoration: _inputDecoration('Kategori'),
                      items: const [
                        'Sifir Awal',
                        'Sifir Tsani',
                        'Sifir Tsalis',
                        'Sifir Robi',
                        'Sifir Khomis',
                        'Sifir Sadis',
                      ]
                          .map(
                            (value) => DropdownMenuItem(
                              value: value,
                              child: Text(value),
                            ),
                          )
                          .toList(),
                      onChanged: isSaving
                          ? null
                          : (value) => setModalState(
                                () => category = value ?? category,
                              ),
                    ),
                    const SizedBox(height: 12),
                    _formLabel('Kelompok'),
                    DropdownButtonFormField<String>(
                      initialValue: genderGroup,
                      decoration: _inputDecoration('Kelompok'),
                      items: const ['PA', 'PI']
                          .map(
                            (value) => DropdownMenuItem(
                              value: value,
                              child: Text(value),
                            ),
                          )
                          .toList(),
                      onChanged: isSaving
                          ? null
                          : (value) => setModalState(
                                () => genderGroup = value ?? genderGroup,
                              ),
                    ),
                    const SizedBox(height: 10),
                    SwitchListTile(
                      value: isActive,
                      contentPadding: EdgeInsets.zero,
                      activeThumbColor: const Color(0xFF138F81),
                      title: const Text(
                        'Kelas Aktif',
                        style: TextStyle(fontWeight: FontWeight.w700),
                      ),
                      onChanged: isSaving
                          ? null
                          : (value) => setModalState(() => isActive = value),
                    ),
                    const SizedBox(height: 16),
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
                            : const Text('Simpan Kelas'),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _formLabel(String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Text(
        text,
        style: const TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w700,
          color: Color(0xFF636E72),
        ),
      ),
    );
  }

  InputDecoration _inputDecoration(String hint) {
    return InputDecoration(
      filled: true,
      fillColor: Colors.white,
      hintText: hint,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide.none,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final data = _filteredClasses;
    final activeCount = _classes.where((item) => item['is_active'] == true).length;

    return Scaffold(
      backgroundColor: const Color(0xFFFFDC80),
      floatingActionButton: widget.readOnly
          ? null
          : FloatingActionButton(
              onPressed: () => _showClassForm(),
              backgroundColor: const Color(0xFF138F81),
              foregroundColor: Colors.white,
              child: const Icon(Icons.add_rounded),
            ),
      body: SafeArea(
        child: Column(
          children: [
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
                          const Text(
                            'Data Kelas Sifir',
                            style: TextStyle(
                              fontSize: 17,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF2D3436),
                            ),
                          ),
                          Text(
                            '$activeCount aktif - ${_classes.length} total',
                            style: const TextStyle(
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
                      icon: const Icon(Icons.close_rounded, size: 24),
                    ),
                  ],
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 20, 16, 12),
              child: TextField(
                controller: _searchController,
                onChanged: (value) => setState(() => _searchQuery = value),
                decoration: InputDecoration(
                  filled: true,
                  fillColor: Colors.white,
                  prefixIcon: const Icon(Icons.search, color: Color(0xFF138F81)),
                  hintText: 'Cari kelas sifir...',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(22),
                    borderSide: BorderSide.none,
                  ),
                ),
              ),
            ),
            if (_isOfflineMode)
              const Padding(
                padding: EdgeInsets.fromLTRB(20, 0, 20, 8),
                child: Text(
                  'Mode offline, menampilkan data kelas terakhir tersimpan.',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFFE65100),
                  ),
                ),
              ),
            Expanded(
              child: Container(
                margin: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFFE1EFF7),
                  borderRadius: BorderRadius.circular(30),
                ),
                child: RefreshIndicator(
                  onRefresh: () => _loadClasses(),
                  color: const Color(0xFF138F81),
                  child: _buildBody(data),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBody(List<Map<String, dynamic>> data) {
    if (_isLoading) {
      return const Center(
        child: CircularProgressIndicator(color: Color(0xFF138F81)),
      );
    }
    if (_errorMessage != null) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          const SizedBox(height: 140),
          const Icon(Icons.cloud_off_rounded, size: 56, color: Color(0xFF636E72)),
          const SizedBox(height: 12),
          Text(
            _errorMessage!,
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: Color(0xFF636E72),
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      );
    }
    if (data.isEmpty) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: const [
          SizedBox(height: 140),
          Icon(Icons.school_rounded, size: 56, color: Color(0xFF636E72)),
          SizedBox(height: 12),
          Text(
            'Belum ada kelas sifir tersimpan',
            textAlign: TextAlign.center,
            style: TextStyle(color: Color(0xFF636E72)),
          ),
        ],
      );
    }

    return ListView.separated(
      physics: const AlwaysScrollableScrollPhysics(
        parent: BouncingScrollPhysics(),
      ),
      itemCount: data.length,
      separatorBuilder: (context, index) => const SizedBox(height: 12),
      itemBuilder: (context, index) => _buildClassCard(data[index]),
    );
  }

  Widget _buildClassCard(Map<String, dynamic> item) {
    final id = (item['id'] as num?)?.toInt();
    final isActive = item['is_active'] == true;
    final isPending = id != null && _pendingIds.contains(id);
    final name = item['name']?.toString() ?? '-';
    final category = item['category']?.toString() ?? 'Sifir';
    final gender = item['gender_group']?.toString() ?? '-';

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(22),
      ),
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: (isActive ? const Color(0xFF138F81) : Colors.grey)
                  .withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Icon(
              isActive ? Icons.check_circle_rounded : Icons.pause_circle_rounded,
              color: isActive ? const Color(0xFF138F81) : Colors.grey,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF2D3436),
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  '$category - $gender - ${isActive ? 'Aktif' : 'Nonaktif'}',
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF636E72),
                  ),
                ),
              ],
            ),
          ),
          if (isPending)
            const SizedBox(
              width: 22,
              height: 22,
              child: CircularProgressIndicator(strokeWidth: 2),
            )
          else if (!widget.readOnly)
            PopupMenuButton<String>(
              onSelected: (value) {
                if (value == 'edit') _showClassForm(item: item);
                if (value == 'toggle') _toggleStatus(item);
                if (value == 'delete') _deleteClass(item);
              },
              itemBuilder: (_) => [
                const PopupMenuItem(value: 'edit', child: Text('Edit')),
                PopupMenuItem(
                  value: 'toggle',
                  child: Text(isActive ? 'Nonaktifkan' : 'Aktifkan'),
                ),
                const PopupMenuItem(value: 'delete', child: Text('Hapus')),
              ],
            ),
        ],
      ),
    );
  }
}
