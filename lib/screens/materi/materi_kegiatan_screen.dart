import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../services/api_service.dart';
import 'upload_materi_screen.dart';
import 'upload_kegiatan_screen.dart';

class MateriKegiatanScreen extends StatefulWidget {
  const MateriKegiatanScreen({super.key});

  @override
  State<MateriKegiatanScreen> createState() => _MateriKegiatanScreenState();
}

class _MateriKegiatanScreenState extends State<MateriKegiatanScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  bool _isLoading = true;
  String _userRole = '';
  int _userId = 0;

  List<Map<String, dynamic>> _materiList = [];
  List<Map<String, dynamic>> _kegiatanList = [];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _loadUserAndData();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadUserAndData() async {
    final prefs = await SharedPreferences.getInstance();
    _userRole = prefs.getString('user_role') ?? '';
    _userId = prefs.getInt('user_id') ?? 0;
    await _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    try {
      final materiResult = await ApiService.getMateri();
      final kegiatanResult = await ApiService.getKegiatan();
      if (mounted) {
        setState(() {
          _materiList = List<Map<String, dynamic>>.from(materiResult['data'] ?? []);
          _kegiatanList = List<Map<String, dynamic>>.from(kegiatanResult['data'] ?? []);
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _deleteMateri(int id) async {
    try {
      await ApiService.deleteMateri(id, userId: _userId);
      _loadData();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Materi berhasil dihapus'),
          backgroundColor: Color(0xFF138F81),
          behavior: SnackBarBehavior.floating,
        ));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Gagal menghapus: $e'),
          backgroundColor: Colors.redAccent,
          behavior: SnackBarBehavior.floating,
        ));
      }
    }
  }

  Future<void> _deleteKegiatan(int id) async {
    try {
      await ApiService.deleteKegiatan(id);
      _loadData();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Kegiatan berhasil dihapus'),
          backgroundColor: Color(0xFF138F81),
          behavior: SnackBarBehavior.floating,
        ));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Gagal menghapus: $e'),
          backgroundColor: Colors.redAccent,
          behavior: SnackBarBehavior.floating,
        ));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFFDC80),
      body: SafeArea(
        child: Column(
          children: [
            // Profile bar
            _buildProfileBar(),
            const SizedBox(height: 8),
            // Tabs
            _buildTabBar(),
            const SizedBox(height: 8),
            // Content
            Expanded(
              child: RefreshIndicator(
                onRefresh: _loadData,
                color: const Color(0xFF138F81),
                child: TabBarView(
                  controller: _tabController,
                  children: [
                    _buildMateriTab(),
                    _buildKegiatanTab(),
                  ],
                ),
              ),
            ),
          ],
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
              width: 50, height: 50,
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                color: Color(0xFFFFDC80),
              ),
              child: const Icon(
                Icons.photo_library_rounded,
                color: Color(0xFFD63031),
                size: 28,
              ),
            ),
            const SizedBox(width: 12),
            const Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Materi & Kegiatan', style: TextStyle(
                    fontSize: 18, fontWeight: FontWeight.w700,
                    color: Color(0xFF2D3436),
                  )),
                  Text('Upload dan Kelola Materi Pembelajaran', style: TextStyle(
                    fontSize: 11, color: Color(0xFF636E72),
                  )),
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

  Widget _buildTabBar() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(
        color: const Color(0xFFE1EFF7),
        borderRadius: BorderRadius.circular(16),
      ),
      child: TabBar(
        controller: _tabController,
        indicator: BoxDecoration(
          color: const Color(0xFF138F81),
          borderRadius: BorderRadius.circular(16),
        ),
        labelColor: Colors.white,
        unselectedLabelColor: const Color(0xFF636E72),
        labelStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
        unselectedLabelStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500),
        tabs: const [
          Tab(text: 'Materi Pelajaran'),
          Tab(text: 'Foto Kegiatan'),
        ],
      ),
    );
  }

  // ===== MATERI TAB =====
  Widget _buildMateriTab() {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator(color: Color(0xFF138F81)));
    }

    return Column(
      children: [
        // Upload button for guru/admin
        if (_userRole == 'admin' || _userRole == 'guru')
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
            child: SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: () async {
                  final result = await Navigator.push(context,
                    MaterialPageRoute(builder: (_) => const UploadMateriScreen()),
                  );
                  if (result == true) _loadData();
                },
                icon: const Icon(Icons.upload_file_rounded, size: 20),
                label: const Text('Upload Materi'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF138F81),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                ),
              ),
            ),
          ),
        const SizedBox(height: 8),
        // List
        Expanded(
          child: _materiList.isEmpty
              ? _buildEmptyState('Belum ada materi', Icons.menu_book_rounded)
              : ListView.builder(
                  physics: const BouncingScrollPhysics(),
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  itemCount: _materiList.length,
                  itemBuilder: (context, index) => _buildMateriCard(_materiList[index]),
                ),
        ),
      ],
    );
  }

  Widget _buildMateriCard(Map<String, dynamic> materi) {
    final isOwner = materi['guru_id'] == _userId;
    final canDelete = _userRole == 'admin' || isOwner;
    final isPhoto = materi['file_type'] == 'foto';

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFE1EFF7),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 36, height: 36,
                decoration: BoxDecoration(
                  color: const Color(0xFF138F81).withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(
                  isPhoto ? Icons.image_rounded : Icons.description_rounded,
                  color: const Color(0xFF138F81), size: 20,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(materi['judul'] ?? '', style: const TextStyle(
                      fontSize: 14, fontWeight: FontWeight.w700, color: Color(0xFF2D3436),
                    )),
                    Text('${materi['mapel']} • Kelas ${materi['kelas']}', style: const TextStyle(
                      fontSize: 11, color: Color(0xFF636E72),
                    )),
                  ],
                ),
              ),
              if (canDelete)
                GestureDetector(
                  onTap: () => _showDeleteDialog('materi', materi['id']),
                  child: Icon(Icons.delete_outline_rounded, size: 20, color: Colors.grey[400]),
                ),
            ],
          ),
          if (materi['deskripsi'] != null && materi['deskripsi'].toString().isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(materi['deskripsi'], style: const TextStyle(
              fontSize: 12, color: Color(0xFF636E72), height: 1.4,
            )),
          ],
          const SizedBox(height: 8),
          // Preview image if foto
          if (isPhoto && materi['file_url'] != null)
            ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: Image.network(
                materi['file_url'],
                height: 160,
                width: double.infinity,
                fit: BoxFit.cover,
                errorBuilder: (_, _, _) => Container(
                  height: 80,
                  decoration: BoxDecoration(
                    color: Colors.grey[200],
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Center(child: Icon(Icons.broken_image, color: Colors.grey)),
                ),
              ),
            ),
          const SizedBox(height: 8),
          Row(
            children: [
              Icon(Icons.person_rounded, size: 13, color: Colors.grey[500]),
              const SizedBox(width: 4),
              Text(materi['guru_nama'] ?? '', style: TextStyle(fontSize: 10, color: Colors.grey[500])),
              const Spacer(),
              Icon(Icons.calendar_today_rounded, size: 13, color: Colors.grey[500]),
              const SizedBox(width: 4),
              Text(materi['tanggal'] ?? '', style: TextStyle(fontSize: 10, color: Colors.grey[500])),
            ],
          ),
        ],
      ),
    );
  }

  // ===== KEGIATAN TAB =====
  Widget _buildKegiatanTab() {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator(color: Color(0xFF138F81)));
    }

    return Column(
      children: [
        // Upload button for admin only
        if (_userRole == 'admin')
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
            child: SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: () async {
                  final result = await Navigator.push(context,
                    MaterialPageRoute(builder: (_) => const UploadKegiatanScreen()),
                  );
                  if (result == true) _loadData();
                },
                icon: const Icon(Icons.add_a_photo_rounded, size: 20),
                label: const Text('Upload Foto Kegiatan'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFE65100),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                ),
              ),
            ),
          ),
        const SizedBox(height: 8),
        // List
        Expanded(
          child: _kegiatanList.isEmpty
              ? _buildEmptyState('Belum ada kegiatan', Icons.photo_library_rounded)
              : ListView.builder(
                  physics: const BouncingScrollPhysics(),
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  itemCount: _kegiatanList.length,
                  itemBuilder: (context, index) => _buildKegiatanCard(_kegiatanList[index]),
                ),
        ),
      ],
    );
  }

  Widget _buildKegiatanCard(Map<String, dynamic> kegiatan) {
    final fotos = List<Map<String, dynamic>>.from(kegiatan['fotos'] ?? []);
    final canDelete = _userRole == 'admin';

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFE1EFF7),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 36, height: 36,
                decoration: BoxDecoration(
                  color: const Color(0xFFE65100).withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(Icons.event_rounded, color: Color(0xFFE65100), size: 20),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(kegiatan['judul'] ?? '', style: const TextStyle(
                      fontSize: 14, fontWeight: FontWeight.w700, color: Color(0xFF2D3436),
                    )),
                    Text('${kegiatan['foto_count'] ?? 0} foto • ${kegiatan['tanggal'] ?? ''}',
                      style: const TextStyle(fontSize: 11, color: Color(0xFF636E72)),
                    ),
                  ],
                ),
              ),
              if (canDelete)
                GestureDetector(
                  onTap: () => _showDeleteDialog('kegiatan', kegiatan['id']),
                  child: Icon(Icons.delete_outline_rounded, size: 20, color: Colors.grey[400]),
                ),
            ],
          ),
          if (kegiatan['deskripsi'] != null && kegiatan['deskripsi'].toString().isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(kegiatan['deskripsi'], style: const TextStyle(
              fontSize: 12, color: Color(0xFF636E72), height: 1.4,
            )),
          ],
          // Photo grid
          if (fotos.isNotEmpty) ...[
            const SizedBox(height: 10),
            SizedBox(
              height: 120,
              child: ListView.builder(
                scrollDirection: Axis.horizontal,
                physics: const BouncingScrollPhysics(),
                itemCount: fotos.length,
                itemBuilder: (context, index) {
                  return Container(
                    margin: const EdgeInsets.only(right: 8),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(12),
                      child: Image.network(
                        fotos[index]['file_url'] ?? '',
                        width: 120, height: 120,
                        fit: BoxFit.cover,
                        errorBuilder: (_, _, _) => Container(
                          width: 120, height: 120,
                          color: Colors.grey[200],
                          child: const Icon(Icons.broken_image, color: Colors.grey),
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildEmptyState(String message, IconData icon) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, size: 56, color: Colors.grey[400]),
          const SizedBox(height: 12),
          Text(message, style: TextStyle(fontSize: 14, color: Colors.grey[500])),
        ],
      ),
    );
  }

  void _showDeleteDialog(String type, int id) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(21)),
        title: const Text('Hapus?', style: TextStyle(fontWeight: FontWeight.w700)),
        content: Text('$type ini akan dihapus secara permanen.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text('Batal', style: TextStyle(color: Colors.grey[600])),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(context);
              if (type == 'materi') {
                _deleteMateri(id);
              } else {
                _deleteKegiatan(id);
              }
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.redAccent,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            child: const Text('Hapus'),
          ),
        ],
      ),
    );
  }
}
