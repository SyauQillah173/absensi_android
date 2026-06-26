import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../../services/cache_service.dart';
import '../../services/sync_service.dart';

class KelompokBelajarScreen extends StatefulWidget {
  const KelompokBelajarScreen({super.key});

  @override
  State<KelompokBelajarScreen> createState() => _KelompokBelajarScreenState();
}

class _KelompokBelajarScreenState extends State<KelompokBelajarScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _animController;
  late Animation<double> _fadeIn;

  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';
  int _expandedCategory = -1;
  bool _isFromCache = false;

  List<Map<String, dynamic>> _groupedData = [];
  bool _isLoading = true;
  String? _errorMessage;

  // Gradient colors per sifir level (matching Ruang Sifir)
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
      _sifirGradients[sifir] ??
      [const Color(0xFF636E72), const Color(0xFF95A5A6)];
  IconData _getIcon(String sifir) => _sifirIcons[sifir] ?? Icons.school_rounded;

  // Sifir level options for adding new kelompok
  static const List<Map<String, String>> _sifirOptions = [
    {'label': 'Sifir Awal', 'value': 'awal'},
    {'label': 'Sifir Tsani', 'value': 'tsani'},
    {'label': 'Sifir Tsalis', 'value': 'tsalis'},
    {'label': "Sifir Robi'", 'value': 'robi'},
    {'label': 'Sifir Khomis', 'value': 'khomis'},
    {'label': 'Sifir Sadis', 'value': 'sadis'},
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
    _loadKelompok();
  }

  Future<void> _loadKelompok() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    final result = await CacheService.fetchWithCache(
      cacheKey: 'kelompok_belajar',
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

  @override
  void dispose() {
    _animController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  List<Map<String, dynamic>> get _filteredData {
    if (_searchQuery.isEmpty) return _groupedData;
    final q = _searchQuery.toLowerCase();
    return _groupedData.where((group) {
      final kategori = (group['kategori'] ?? '').toString().toLowerCase();
      if (kategori.contains(q)) return true;
      final kelas = List<Map<String, dynamic>>.from(group['kelas'] ?? []);
      return kelas.any(
        (k) => (k['nama'] ?? '').toString().toLowerCase().contains(q),
      );
    }).toList();
  }

  // ==================== ADD KELOMPOK (NEW KELAS) ====================
  void _showAddKelasDialog(String? presetKategori, String? presetSifir) {
    final namaController = TextEditingController();
    String? selectedSifir = presetSifir;
    String? selectedGender;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) {
          // Auto-generate kategori from sifir + gender
          String kategori = presetKategori ?? '';
          if (presetKategori == null &&
              selectedSifir != null &&
              selectedGender != null) {
            final sifirLabel = _sifirOptions.firstWhere(
              (s) => s['value'] == selectedSifir,
              orElse: () => {'label': ''},
            )['label']!;
            kategori = '$sifirLabel $selectedGender';
          }

          return Container(
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
            child: SingleChildScrollView(
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
                  Text(
                    presetKategori != null
                        ? 'Tambah Kelas di $presetKategori'
                        : 'Tambah Kelas Baru',
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF2D3436),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Nama Kelas
                  const Text(
                    'Nama Kelas',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF636E72),
                    ),
                  ),
                  const SizedBox(height: 6),
                  TextField(
                    controller: namaController,
                    textCapitalization: TextCapitalization.words,
                    decoration: InputDecoration(
                      filled: true,
                      fillColor: Colors.white,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(14),
                        borderSide: BorderSide.none,
                      ),
                      hintText: 'Contoh: Sifir Awal F PA',
                    ),
                  ),
                  const SizedBox(height: 14),

                  // Sifir Level (only if not preset)
                  if (presetKategori == null) ...[
                    const Text(
                      'Tingkat Sifir',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF636E72),
                      ),
                    ),
                    const SizedBox(height: 6),
                    Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      children: _sifirOptions.map((s) {
                        final isSelected = selectedSifir == s['value'];
                        final grad = _getGradient(s['value']!);
                        return GestureDetector(
                          onTap: () =>
                              setModalState(() => selectedSifir = s['value']),
                          child: AnimatedContainer(
                            duration: const Duration(milliseconds: 200),
                            padding: const EdgeInsets.symmetric(
                              horizontal: 12,
                              vertical: 8,
                            ),
                            decoration: BoxDecoration(
                              gradient: isSelected
                                  ? LinearGradient(colors: grad)
                                  : null,
                              color: isSelected ? null : Colors.white,
                              borderRadius: BorderRadius.circular(10),
                              border: isSelected
                                  ? null
                                  : Border.all(
                                      color: grad[0].withValues(alpha: 0.3),
                                    ),
                            ),
                            child: Text(
                              s['label']!,
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                                color: isSelected ? Colors.white : grad[0],
                              ),
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                    const SizedBox(height: 14),

                    // Gender PA/PI
                    const Text(
                      'Jenis Kelamin',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF636E72),
                      ),
                    ),
                    const SizedBox(height: 6),
                    Row(
                      children: ['PA', 'PI'].map((g) {
                        final isSelected = selectedGender == g;
                        return Expanded(
                          child: GestureDetector(
                            onTap: () =>
                                setModalState(() => selectedGender = g),
                            child: AnimatedContainer(
                              duration: const Duration(milliseconds: 200),
                              margin: EdgeInsets.only(
                                right: g == 'PA' ? 8 : 0,
                                left: g == 'PI' ? 8 : 0,
                              ),
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              decoration: BoxDecoration(
                                color: isSelected
                                    ? const Color(0xFF138F81)
                                    : Colors.white,
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Center(
                                child: Text(
                                  g == 'PA' ? '👦 Putra (PA)' : '👧 Putri (PI)',
                                  style: TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w700,
                                    color: isSelected
                                        ? Colors.white
                                        : const Color(0xFF2D3436),
                                  ),
                                ),
                              ),
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                    const SizedBox(height: 14),

                    // Preview kategori
                    if (selectedSifir != null && selectedGender != null)
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: _getGradient(
                            selectedSifir!,
                          )[0].withValues(alpha: 0.08),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: _getGradient(
                              selectedSifir!,
                            )[0].withValues(alpha: 0.2),
                          ),
                        ),
                        child: Row(
                          children: [
                            Icon(
                              Icons.category_rounded,
                              size: 16,
                              color: _getGradient(selectedSifir!)[0],
                            ),
                            const SizedBox(width: 8),
                            Text(
                              'Kelompok: $kategori',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: _getGradient(selectedSifir!)[0],
                              ),
                            ),
                          ],
                        ),
                      ),
                  ],
                  const SizedBox(height: 20),

                  // Simpan
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: ElevatedButton.icon(
                      onPressed: () async {
                        final nama = namaController.text.trim();
                        final sifir = presetSifir ?? selectedSifir;
                        final kat = presetKategori ?? kategori;
                        if (nama.isEmpty || sifir == null || kat.isEmpty) {
                          ScaffoldMessenger.of(ctx).showSnackBar(
                            SnackBar(
                              content: const Text('Lengkapi semua field'),
                              backgroundColor: const Color(0xFFD63031),
                              behavior: SnackBarBehavior.floating,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                            ),
                          );
                          return;
                        }
                        try {
                          await ApiService.createKelompokBelajar({
                            'nama': nama,
                            'kategori': kat,
                            'sifir': sifir,
                          });
                          await SyncService.notifyDataChanged(
                            SyncTopics.kelas,
                            message: 'Daftar kelas telah diperbarui',
                          );
                          if (!mounted || !ctx.mounted) return;
                          Navigator.pop(ctx);
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text(
                                'Kelas "$nama" berhasil ditambahkan!',
                              ),
                              backgroundColor: const Color(0xFF138F81),
                              behavior: SnackBarBehavior.floating,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                            ),
                          );
                          _loadKelompok();
                        } catch (e) {
                          if (ctx.mounted) {
                            ScaffoldMessenger.of(ctx).showSnackBar(
                              SnackBar(
                                content: Text('Gagal: $e'),
                                backgroundColor: const Color(0xFFD63031),
                                behavior: SnackBarBehavior.floating,
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(12),
                                ),
                              ),
                            );
                          }
                        }
                      },
                      icon: const Icon(Icons.add_rounded, size: 20),
                      label: const Text(
                        'Tambah Kelas',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF138F81),
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                        ),
                        elevation: 0,
                      ),
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

  void _showEditKelasNameDialog(Map<String, dynamic> kelas) {
    final id = kelas['id'] as int?;
    if (id == null) return;

    final namaLama = kelas['nama']?.toString() ?? '';
    final namaController = TextEditingController(text: namaLama);
    final kategori = kelas['kategori']?.toString() ?? '';
    final sifir = kelas['sifir']?.toString() ?? '';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        bool saving = false;
        return StatefulBuilder(
          builder: (ctx, setModalState) {
            return Container(
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
                    'Edit Nama Kelas',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF2D3436),
                    ),
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'Nama Kelas',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF636E72),
                    ),
                  ),
                  const SizedBox(height: 6),
                  TextField(
                    controller: namaController,
                    textCapitalization: TextCapitalization.words,
                    decoration: InputDecoration(
                      filled: true,
                      fillColor: Colors.white,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(14),
                        borderSide: BorderSide.none,
                      ),
                      hintText: 'Contoh: Sifir Awal A PA',
                    ),
                  ),
                  const SizedBox(height: 20),
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: ElevatedButton.icon(
                      onPressed: saving
                          ? null
                          : () async {
                              final namaBaru = namaController.text.trim();
                              if (namaBaru.isEmpty) {
                                ScaffoldMessenger.of(ctx).showSnackBar(
                                  SnackBar(
                                    content: const Text(
                                      'Nama kelas wajib diisi',
                                    ),
                                    backgroundColor: const Color(0xFFD63031),
                                    behavior: SnackBarBehavior.floating,
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                  ),
                                );
                                return;
                              }

                              setModalState(() => saving = true);
                              try {
                                await ApiService.updateKelompokBelajar(id, {
                                  'nama': namaBaru,
                                  if (kategori.isNotEmpty) 'kategori': kategori,
                                  if (sifir.isNotEmpty) 'sifir': sifir,
                                });
                                await SyncService.notifyDataChanged(
                                  SyncTopics.kelas,
                                  message: 'Nama kelas telah diperbarui',
                                );
                                if (!mounted || !ctx.mounted) return;
                                Navigator.pop(ctx);
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(
                                    content: Text(
                                      'Kelas "$namaBaru" berhasil diperbarui',
                                    ),
                                    backgroundColor: const Color(0xFF138F81),
                                    behavior: SnackBarBehavior.floating,
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                  ),
                                );
                                _loadKelompok();
                              } catch (e) {
                                if (ctx.mounted) {
                                  setModalState(() => saving = false);
                                  ScaffoldMessenger.of(ctx).showSnackBar(
                                    SnackBar(
                                      content: Text('Gagal: $e'),
                                      backgroundColor: const Color(0xFFD63031),
                                      behavior: SnackBarBehavior.floating,
                                      shape: RoundedRectangleBorder(
                                        borderRadius: BorderRadius.circular(12),
                                      ),
                                    ),
                                  );
                                }
                              }
                            },
                      icon: saving
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(
                                color: Colors.white,
                                strokeWidth: 2,
                              ),
                            )
                          : const Icon(Icons.save_rounded, size: 20),
                      label: const Text(
                        'Simpan Nama Kelas',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF138F81),
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                        ),
                        elevation: 0,
                      ),
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  // ==================== DELETE KELAS ====================
  void _showDeleteKelasDialog(Map<String, dynamic> kelas) {
    final nama = kelas['nama']?.toString() ?? '';
    final id = kelas['id'] as int?;
    if (id == null) return;

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        backgroundColor: const Color(0xFFE1EFF7),
        title: const Row(
          children: [
            Icon(
              Icons.warning_amber_rounded,
              color: Color(0xFFD63031),
              size: 24,
            ),
            SizedBox(width: 8),
            Text(
              'Hapus Kelas?',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Apakah anda yakin ingin menghapus kelas:',
              style: const TextStyle(fontSize: 13, color: Color(0xFF636E72)),
            ),
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: const Color(0xFFD63031).withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(
                children: [
                  const Icon(
                    Icons.class_rounded,
                    color: Color(0xFFD63031),
                    size: 18,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      nama,
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFFD63031),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'Semua siswa yang terkait akan dilepas dari kelas ini.',
              style: TextStyle(fontSize: 11, color: Color(0xFF636E72)),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text(
              'Batal',
              style: TextStyle(color: Color(0xFF636E72)),
            ),
          ),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(ctx);
              try {
                await ApiService.deleteKelompokBelajar(id);
                await SyncService.notifyDataChanged(
                  SyncTopics.kelas,
                  message: 'Daftar kelas telah diperbarui',
                );
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('"$nama" berhasil dihapus'),
                      backgroundColor: const Color(0xFFD63031),
                      behavior: SnackBarBehavior.floating,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                  );
                  _loadKelompok();
                }
              } catch (e) {
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('Gagal menghapus: $e'),
                      backgroundColor: const Color(0xFFD63031),
                      behavior: SnackBarBehavior.floating,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                  );
                }
              }
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFD63031),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
            child: const Text(
              'Hapus',
              style: TextStyle(fontWeight: FontWeight.w700),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _filteredData;
    final totalKelas = _groupedData.fold<int>(
      0,
      (sum, g) => sum + (List.from(g['kelas'] ?? []).length),
    );
    final totalSiswa = _groupedData.fold<int>(0, (sum, g) {
      final kelas = List<Map<String, dynamic>>.from(g['kelas'] ?? []);
      return sum +
          kelas.fold<int>(0, (s, k) => s + ((k['jumlah_siswa'] as int?) ?? 0));
    });

    return Scaffold(
      backgroundColor: const Color(0xFFFFDC80),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showAddKelasDialog(null, null),
        backgroundColor: const Color(0xFF138F81),
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add_rounded),
        label: const Text(
          'Tambah Kelas',
          style: TextStyle(fontWeight: FontWeight.w700),
        ),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      ),
      body: SafeArea(
        child: FadeTransition(
          opacity: _fadeIn,
          child: Column(
            children: [
              // ===== HEADER =====
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
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: const Color(
                            0xFF138F81,
                          ).withValues(alpha: 0.15),
                        ),
                        child: const Icon(
                          Icons.groups_rounded,
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
                                const Text(
                                  'Kelompok Belajar',
                                  style: TextStyle(
                                    fontSize: 17,
                                    fontWeight: FontWeight.w700,
                                    color: Color(0xFF2D3436),
                                  ),
                                ),
                                if (_isFromCache) ...[
                                  const SizedBox(width: 6),
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 6,
                                      vertical: 2,
                                    ),
                                    decoration: BoxDecoration(
                                      color: const Color(
                                        0xFFE65100,
                                      ).withValues(alpha: 0.12),
                                      borderRadius: BorderRadius.circular(6),
                                    ),
                                    child: const Text(
                                      'Offline',
                                      style: TextStyle(
                                        fontSize: 8,
                                        fontWeight: FontWeight.w700,
                                        color: Color(0xFFE65100),
                                      ),
                                    ),
                                  ),
                                ],
                              ],
                            ),
                            Text(
                              '$totalKelas kelas • $totalSiswa santri',
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
                        icon: const Icon(
                          Icons.arrow_back_ios_rounded,
                          size: 20,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12),

              // ===== SEARCH =====
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(21),
                  ),
                  child: Row(
                    children: [
                      const Icon(
                        Icons.search_rounded,
                        size: 22,
                        color: Color(0xFF636E72),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: TextField(
                          controller: _searchController,
                          onChanged: (val) =>
                              setState(() => _searchQuery = val),
                          decoration: const InputDecoration(
                            hintText: 'Cari Kelas...',
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
              ),
              const SizedBox(height: 8),

              // ===== CONTENT =====
              if (_isLoading)
                const Expanded(
                  child: Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        CircularProgressIndicator(color: Color(0xFF138F81)),
                        SizedBox(height: 16),
                        Text(
                          'Memuat kelompok belajar...',
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
                          style: const TextStyle(
                            fontSize: 13,
                            color: Color(0xFF636E72),
                          ),
                        ),
                        const SizedBox(height: 16),
                        ElevatedButton.icon(
                          onPressed: _loadKelompok,
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
                  ),
                )
              else
                Expanded(
                  child: RefreshIndicator(
                    onRefresh: _loadKelompok,
                    color: const Color(0xFF138F81),
                    child: ListView.builder(
                      physics: const AlwaysScrollableScrollPhysics(
                        parent: BouncingScrollPhysics(),
                      ),
                      padding: const EdgeInsets.fromLTRB(16, 4, 16, 80),
                      itemCount: filtered.length,
                      itemBuilder: (context, index) {
                        return _buildCategoryCard(filtered[index], index);
                      },
                    ),
                  ),
                ),
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
    final sifir = kelasList.isNotEmpty
        ? kelasList[0]['sifir']?.toString() ?? ''
        : '';
    final gradient = _getGradient(sifir);
    final icon = _getIcon(sifir);
    final totalSiswa = kelasList.fold<int>(
      0,
      (sum, k) => sum + ((k['jumlah_siswa'] as int?) ?? 0),
    );

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
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: gradient[0].withValues(alpha: 0.1)),
        ),
        child: Column(
          children: [
            // Kategori Header (tap to expand)
            InkWell(
              borderRadius: BorderRadius.circular(20),
              onTap: () => setState(() {
                _expandedCategory = isExpanded ? -1 : catIndex;
              }),
              child: Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      gradient[0].withValues(alpha: 0.08),
                      gradient[1].withValues(alpha: 0.03),
                    ],
                  ),
                  borderRadius: BorderRadius.vertical(
                    top: Radius.circular(20),
                    bottom: isExpanded
                        ? Radius.zero
                        : const Radius.circular(20),
                  ),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 48,
                      height: 48,
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: gradient,
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        borderRadius: BorderRadius.circular(15),
                      ),
                      child: Icon(icon, color: Colors.white, size: 24),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            kategori,
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                              color: gradient[0],
                            ),
                          ),
                          const SizedBox(height: 3),
                          Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 6,
                                  vertical: 2,
                                ),
                                decoration: BoxDecoration(
                                  color: gradient[0].withValues(alpha: 0.1),
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: Text(
                                  '${kelasList.length} Kelas',
                                  style: TextStyle(
                                    fontSize: 9,
                                    fontWeight: FontWeight.w700,
                                    color: gradient[0],
                                  ),
                                ),
                              ),
                              const SizedBox(width: 4),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 6,
                                  vertical: 2,
                                ),
                                decoration: BoxDecoration(
                                  color: const Color(
                                    0xFF636E72,
                                  ).withValues(alpha: 0.08),
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: Text(
                                  '$totalSiswa Siswa',
                                  style: const TextStyle(
                                    fontSize: 9,
                                    fontWeight: FontWeight.w700,
                                    color: Color(0xFF636E72),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    AnimatedRotation(
                      turns: isExpanded ? 0.25 : 0,
                      duration: const Duration(milliseconds: 200),
                      child: Icon(
                        Icons.chevron_right_rounded,
                        color: gradient[0],
                      ),
                    ),
                  ],
                ),
              ),
            ),

            // Expanded kelas list
            AnimatedSize(
              duration: const Duration(milliseconds: 250),
              curve: Curves.easeInOut,
              child: isExpanded
                  ? Column(
                      children: [
                        Container(
                          margin: const EdgeInsets.symmetric(horizontal: 14),
                          height: 1,
                          color: gradient[0].withValues(alpha: 0.1),
                        ),
                        ...kelasList.map(
                          (kelas) => _buildKelasItem(kelas, gradient),
                        ),

                        // + Tambah Kelas Button
                        Padding(
                          padding: const EdgeInsets.fromLTRB(14, 4, 14, 12),
                          child: GestureDetector(
                            onTap: () => _showAddKelasDialog(kategori, sifir),
                            child: Container(
                              padding: const EdgeInsets.symmetric(vertical: 10),
                              decoration: BoxDecoration(
                                color: gradient[0].withValues(alpha: 0.06),
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(
                                  color: gradient[0].withValues(alpha: 0.2),
                                  style: BorderStyle.solid,
                                ),
                              ),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(
                                    Icons.add_circle_outline_rounded,
                                    size: 16,
                                    color: gradient[0],
                                  ),
                                  const SizedBox(width: 6),
                                  Text(
                                    'Tambah Kelas',
                                    style: TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.w700,
                                      color: gradient[0],
                                    ),
                                  ),
                                ],
                              ),
                            ),
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

  Widget _buildKelasItem(Map<String, dynamic> kelas, List<Color> gradient) {
    final jumlahSiswa = (kelas['jumlah_siswa'] as int?) ?? 0;
    final nama = kelas['nama']?.toString() ?? '';

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: gradient[0].withValues(alpha: 0.04),
          borderRadius: BorderRadius.circular(14),
        ),
        child: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: gradient[0].withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(Icons.class_rounded, color: gradient[0], size: 18),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    nama,
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF2D3436),
                    ),
                  ),
                  Text(
                    '$jumlahSiswa Siswa',
                    style: const TextStyle(
                      fontSize: 10,
                      color: Color(0xFF636E72),
                    ),
                  ),
                ],
              ),
            ),
            // Edit Button
            GestureDetector(
              onTap: () => _showEditKelasNameDialog(kelas),
              child: Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: gradient[0].withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(Icons.edit_rounded, size: 14, color: gradient[0]),
              ),
            ),
            const SizedBox(width: 6),
            // Delete Button
            GestureDetector(
              onTap: () => _showDeleteKelasDialog(kelas),
              child: Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: const Color(0xFFD63031).withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(
                  Icons.delete_outline_rounded,
                  size: 14,
                  color: Color(0xFFD63031),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
