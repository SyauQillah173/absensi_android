import 'package:flutter/material.dart';

import '../../services/api_service.dart';

class EditKelompokSifirScreen extends StatefulWidget {
  final int kelompokId;
  final String namaKelas;

  const EditKelompokSifirScreen({
    super.key,
    required this.kelompokId,
    required this.namaKelas,
  });

  @override
  State<EditKelompokSifirScreen> createState() =>
      _EditKelompokSifirScreenState();
}

class _EditKelompokSifirScreenState extends State<EditKelompokSifirScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _animController;
  late Animation<double> _fadeIn;

  List<Map<String, dynamic>> _siswaList = [];
  List<Map<String, dynamic>> _allSiswa = []; // For adding new siswa
  bool _isLoading = true;
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
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });
    try {
      final results = await Future.wait([
        ApiService.getKelompokDetail(widget.kelompokId),
        ApiService.getSiswa(),
      ]);

      if (mounted) {
        final kelompokData = results[0];
        final allSiswaData = results[1];

        final siswaInKelompok = List<Map<String, dynamic>>.from(
          kelompokData['data']?['siswa'] ?? [],
        );
        final allSiswa = List<Map<String, dynamic>>.from(
          allSiswaData['data'] ?? [],
        );

        setState(() {
          _siswaList = siswaInKelompok;
          _allSiswa = allSiswa;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = 'Gagal memuat data: $e';
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _addStudent(Map<String, dynamic> siswa) async {
    try {
      await ApiService.addSiswaToKelompok(widget.kelompokId, siswa['id']);
      await _loadData();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('${siswa['nama']} berhasil ditambahkan'),
            backgroundColor: const Color(0xFF138F81),
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Gagal menambahkan: $e'),
            backgroundColor: const Color(0xFFE65100),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  Future<void> _removeStudent(Map<String, dynamic> siswa) async {
    try {
      await ApiService.removeSiswaFromKelompok(widget.kelompokId, siswa['id']);
      await _loadData();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('${siswa['nama']} berhasil dihapus'),
            backgroundColor: const Color(0xFFE65100),
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Gagal menghapus: $e'),
            backgroundColor: const Color(0xFFE65100),
          ),
        );
      }
    }
  }

  void _showAddSiswaDialog() {
    // Filter out students already in the kelompok
    final siswaIds = _siswaList.map((s) => s['id']).toSet();
    final available = _allSiswa
        .where((s) => !siswaIds.contains(s['id']))
        .toList();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        String searchTerm = '';
        return StatefulBuilder(
          builder: (ctx, setModalState) {
            final filtered = available.where((s) {
              final nama = (s['nama'] ?? '').toString().toLowerCase();
              return searchTerm.isEmpty ||
                  nama.contains(searchTerm.toLowerCase());
            }).toList();

            return Container(
              height: MediaQuery.of(context).size.height * 0.7,
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.vertical(top: Radius.circular(25)),
              ),
              child: Column(
                children: [
                  const SizedBox(height: 8),
                  Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: const Color(0xFF636E72).withValues(alpha: 0.3),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'Tambah Siswa ke Kelompok',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF2D3436),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF0F0F0),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: TextField(
                        onChanged: (val) =>
                            setModalState(() => searchTerm = val),
                        decoration: const InputDecoration(
                          hintText: 'Cari nama siswa...',
                          border: InputBorder.none,
                          icon: Icon(Icons.search, size: 20),
                          hintStyle: TextStyle(fontSize: 13),
                        ),
                        style: const TextStyle(fontSize: 13),
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Expanded(
                    child: filtered.isEmpty
                        ? const Center(
                            child: Text(
                              'Tidak ada siswa yang bisa ditambahkan',
                              style: TextStyle(
                                fontSize: 13,
                                color: Color(0xFF636E72),
                              ),
                            ),
                          )
                        : ListView.builder(
                            itemCount: filtered.length,
                            itemBuilder: (ctx, i) {
                              final s = filtered[i];
                              return ListTile(
                                leading: CircleAvatar(
                                  backgroundColor: s['jenis_kelamin'] == 'L'
                                      ? const Color(
                                          0xFF2E86DE,
                                        ).withValues(alpha: 0.15)
                                      : const Color(
                                          0xFFE65100,
                                        ).withValues(alpha: 0.15),
                                  child: Icon(
                                    s['jenis_kelamin'] == 'L'
                                        ? Icons.boy_rounded
                                        : Icons.girl_rounded,
                                    color: s['jenis_kelamin'] == 'L'
                                        ? const Color(0xFF2E86DE)
                                        : const Color(0xFFE65100),
                                    size: 20,
                                  ),
                                ),
                                title: Text(
                                  s['nama'] ?? '',
                                  style: const TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                                subtitle: Text(
                                  'NIS: ${s['nis'] ?? '-'} • ${s['kelas'] ?? '-'}',
                                  style: const TextStyle(fontSize: 10),
                                ),
                                trailing: IconButton(
                                  icon: const Icon(
                                    Icons.add_circle_rounded,
                                    color: Color(0xFF138F81),
                                  ),
                                  onPressed: () {
                                    Navigator.pop(ctx);
                                    _addStudent(s);
                                  },
                                ),
                              );
                            },
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

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
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
              _buildHeader(),
              const SizedBox(height: 12),
              _buildAddButton(),
              const SizedBox(height: 8),

              if (_isLoading)
                const Expanded(
                  child: Center(
                    child: CircularProgressIndicator(color: Color(0xFF138F81)),
                  ),
                )
              else if (_errorMessage != null)
                Expanded(
                  child: Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          _errorMessage!,
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            fontSize: 13,
                            color: Color(0xFF636E72),
                          ),
                        ),
                        const SizedBox(height: 12),
                        ElevatedButton.icon(
                          onPressed: _loadData,
                          icon: const Icon(Icons.refresh_rounded),
                          label: const Text('Coba Lagi'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF138F81),
                            foregroundColor: Colors.white,
                          ),
                        ),
                      ],
                    ),
                  ),
                )
              else ...[
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  child: Align(
                    alignment: Alignment.centerLeft,
                    child: Text(
                      '${_siswaList.length} Siswa dalam kelompok',
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF636E72),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                Expanded(
                  child: RefreshIndicator(
                    onRefresh: _loadData,
                    color: const Color(0xFF138F81),
                    child: _siswaList.isEmpty
                        ? ListView(
                            children: const [
                              SizedBox(height: 80),
                              Center(
                                child: Column(
                                  children: [
                                    Icon(
                                      Icons.people_outline_rounded,
                                      size: 48,
                                      color: Color(0xFF636E72),
                                    ),
                                    SizedBox(height: 12),
                                    Text(
                                      'Belum ada siswa di kelompok ini',
                                      style: TextStyle(
                                        fontSize: 13,
                                        color: Color(0xFF636E72),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          )
                        : ListView.builder(
                            physics: const AlwaysScrollableScrollPhysics(
                              parent: BouncingScrollPhysics(),
                            ),
                            padding: const EdgeInsets.symmetric(horizontal: 16),
                            itemCount: _siswaList.length,
                            itemBuilder: (context, index) {
                              return _buildSiswaItem(_siswaList[index], index);
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

  Widget _buildHeader() {
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
                Icons.edit_note_rounded,
                color: Color(0xFF138F81),
                size: 26,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    widget.namaKelas,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF2D3436),
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const Text(
                    'Edit Kelompok Sifir',
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

  Widget _buildAddButton() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: GestureDetector(
        onTap: _showAddSiswaDialog,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(21),
          ),
          child: Row(
            children: [
              Container(
                width: 30,
                height: 30,
                decoration: BoxDecoration(
                  color: const Color(0xFF138F81).withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(
                  Icons.person_add_rounded,
                  color: Color(0xFF138F81),
                  size: 16,
                ),
              ),
              const SizedBox(width: 12),
              const Text(
                'Tambah Siswa ke Kelompok',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF138F81),
                ),
              ),
              const Spacer(),
              const Icon(
                Icons.add_circle_rounded,
                color: Color(0xFF138F81),
                size: 24,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSiswaItem(Map<String, dynamic> siswa, int index) {
    final isMale = siswa['jenis_kelamin'] == 'L';
    final color = isMale ? const Color(0xFF2E86DE) : const Color(0xFFE65100);

    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0.0, end: 1.0),
      duration: Duration(milliseconds: 300 + (index * 50)),
      builder: (context, value, child) {
        return Transform.translate(
          offset: Offset(0, 15 * (1 - value)),
          child: Opacity(opacity: value, child: child),
        );
      },
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [color, color.withValues(alpha: 0.7)],
                ),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Center(
                child: Icon(
                  isMale ? Icons.boy_rounded : Icons.girl_rounded,
                  color: Colors.white,
                  size: 22,
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    siswa['nama']?.toString() ?? '',
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF2D3436),
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'NIS: ${siswa['nis'] ?? '-'}',
                    style: const TextStyle(
                      fontSize: 10,
                      color: Color(0xFF636E72),
                    ),
                  ),
                ],
              ),
            ),
            IconButton(
              icon: const Icon(
                Icons.remove_circle_rounded,
                color: Color(0xFFE65100),
                size: 22,
              ),
              onPressed: () {
                showDialog(
                  context: context,
                  builder: (ctx) => AlertDialog(
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(20),
                    ),
                    title: const Text(
                      'Hapus dari Kelompok?',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    content: Text(
                      'Hapus ${siswa['nama']} dari ${widget.namaKelas}?',
                      style: const TextStyle(fontSize: 13),
                    ),
                    actions: [
                      TextButton(
                        onPressed: () => Navigator.pop(ctx),
                        child: const Text('Batal'),
                      ),
                      ElevatedButton(
                        onPressed: () {
                          Navigator.pop(ctx);
                          _removeStudent(siswa);
                        },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFFE65100),
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                        child: const Text('Hapus'),
                      ),
                    ],
                  ),
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}
