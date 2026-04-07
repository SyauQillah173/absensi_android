import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../services/api_service.dart';

class KegiatanBelajarOrtuScreen extends StatefulWidget {
  const KegiatanBelajarOrtuScreen({super.key});

  @override
  State<KegiatanBelajarOrtuScreen> createState() => _KegiatanBelajarOrtuScreenState();
}

class _KegiatanBelajarOrtuScreenState extends State<KegiatanBelajarOrtuScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  bool _isLoading = true;
  String _kelasAnak = '';
  String _namaAnak = '';

  List<Map<String, dynamic>> _materiList = [];
  List<Map<String, dynamic>> _kegiatanList = [];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _loadAnakAndData();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadAnakAndData() async {
    final prefs = await SharedPreferences.getInstance();
    final anakJson = prefs.getString('anak_list') ?? '[]';
    final anakList = List<Map<String, dynamic>>.from(
      (jsonDecode(anakJson) as List).map((a) => Map<String, dynamic>.from(a)),
    );
    _namaAnak = prefs.getString('active_siswa_nama') ?? '';

    if (anakList.isNotEmpty) {
      final activeId = prefs.getInt('active_siswa_id') ?? 0;
      final anak = anakList.firstWhere(
        (a) => a['id'] == activeId,
        orElse: () => anakList.first,
      );
      _kelasAnak = anak['kelas']?.toString() ?? '';
      _namaAnak = anak['nama']?.toString() ?? _namaAnak;
    }

    await _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    try {
      // Load materi by kelas anak & all kegiatan
      final results = await Future.wait([
        _kelasAnak.isNotEmpty
            ? ApiService.getMateriAnak(_kelasAnak)
            : Future.value({'data': []}),
        ApiService.getKegiatanWali(),
      ]);

      if (mounted) {
        setState(() {
          _materiList = List<Map<String, dynamic>>.from(results[0]['data'] ?? []);
          _kegiatanList = List<Map<String, dynamic>>.from(results[1]['data'] ?? []);
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFFDC80),
      body: SafeArea(
        child: Column(
          children: [
            _buildProfileBar(),
            const SizedBox(height: 8),
            _buildTabBar(),
            const SizedBox(height: 8),
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
                shape: BoxShape.circle, color: Color(0xFFFFDC80),
              ),
              child: const Icon(
                Icons.auto_stories_rounded,
                color: Color(0xFFD63031),
                size: 28,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Kegiatan Belajar', style: TextStyle(
                    fontSize: 18, fontWeight: FontWeight.w700,
                    color: Color(0xFF2D3436),
                  )),
                  Text(
                    _namaAnak.isNotEmpty
                        ? '$_namaAnak • $_kelasAnak'
                        : 'Memuat...',
                    style: const TextStyle(fontSize: 11, color: Color(0xFF636E72)),
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
    if (_materiList.isEmpty) {
      return _buildEmptyState('Belum ada materi untuk kelas $_kelasAnak', Icons.menu_book_rounded);
    }
    return ListView.builder(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      itemCount: _materiList.length,
      itemBuilder: (context, index) => _buildMateriCard(_materiList[index]),
    );
  }

  Widget _buildMateriCard(Map<String, dynamic> materi) {
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
                    Text('${materi['mapel']} • ${materi['guru_nama']}', style: const TextStyle(
                      fontSize: 11, color: Color(0xFF636E72),
                    )),
                  ],
                ),
              ),
            ],
          ),
          if (materi['deskripsi'] != null && materi['deskripsi'].toString().isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(materi['deskripsi'], style: const TextStyle(
              fontSize: 12, color: Color(0xFF636E72), height: 1.4,
            )),
          ],
          if (isPhoto && materi['file_url'] != null) ...[
            const SizedBox(height: 8),
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
          ],
          const SizedBox(height: 8),
          Row(
            children: [
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
    if (_kegiatanList.isEmpty) {
      return _buildEmptyState('Belum ada foto kegiatan', Icons.photo_library_rounded);
    }
    return ListView.builder(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      itemCount: _kegiatanList.length,
      itemBuilder: (context, index) => _buildKegiatanCard(_kegiatanList[index]),
    );
  }

  Widget _buildKegiatanCard(Map<String, dynamic> kegiatan) {
    final fotos = List<Map<String, dynamic>>.from(kegiatan['fotos'] ?? []);

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
            ],
          ),
          if (kegiatan['deskripsi'] != null && kegiatan['deskripsi'].toString().isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(kegiatan['deskripsi'], style: const TextStyle(
              fontSize: 12, color: Color(0xFF636E72), height: 1.4,
            )),
          ],
          if (fotos.isNotEmpty) ...[
            const SizedBox(height: 10),
            SizedBox(
              height: 120,
              child: ListView.builder(
                scrollDirection: Axis.horizontal,
                physics: const BouncingScrollPhysics(),
                itemCount: fotos.length,
                itemBuilder: (context, index) {
                  return GestureDetector(
                    onTap: () => _showFullImage(fotos[index]['file_url'] ?? '', fotos[index]['caption']),
                    child: Container(
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

  void _showFullImage(String url, String? caption) {
    showDialog(
      context: context,
      builder: (context) => Dialog(
        backgroundColor: Colors.transparent,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(16),
              child: Image.network(url, fit: BoxFit.contain),
            ),
            if (caption != null && caption.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(caption, style: const TextStyle(
                  color: Colors.white, fontSize: 13,
                )),
              ),
          ],
        ),
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
}
