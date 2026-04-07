import 'package:flutter/material.dart';

import 'edit_jadwal_screen.dart';

class JadwalPelajaranScreen extends StatefulWidget {
  const JadwalPelajaranScreen({super.key});

  @override
  State<JadwalPelajaranScreen> createState() => _JadwalPelajaranScreenState();
}

class _JadwalPelajaranScreenState extends State<JadwalPelajaranScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _animController;
  late Animation<double> _fadeIn;

  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';
  int _expandedIndex = -1;

  final List<Map<String, dynamic>> _allJadwal = [
    {
      'nama': 'TAFSIR',
      'guru': 'Ust. Ahmad Fauzi',
      'hari': 'Senin',
      'jamMulai': '08:00',
      'jamSelesai': '09:30',
      'sifir': 'Sifir Tsani',
      'status': 'Aktif',
    },
    {
      'nama': 'FIQIH',
      'guru': 'Ust. Muhammad Hasan',
      'hari': 'Senin',
      'jamMulai': '09:45',
      'jamSelesai': '11:15',
      'sifir': 'Sifir Awal',
      'status': 'Aktif',
    },
    {
      'nama': 'NAHWU',
      'guru': 'Ust. Abdul Karim',
      'hari': 'Selasa',
      'jamMulai': '08:00',
      'jamSelesai': '09:30',
      'sifir': 'Sifir Tsalits',
      'status': 'Aktif',
    },
    {
      'nama': 'SHOROF',
      'guru': 'Ust. Rizal Fahmi',
      'hari': 'Selasa',
      'jamMulai': '09:45',
      'jamSelesai': '11:15',
      'sifir': 'Sifir Robi',
      'status': 'Aktif',
    },
    {
      'nama': 'TAUHID',
      'guru': 'Ust. Syafii Maarif',
      'hari': 'Rabu',
      'jamMulai': '08:00',
      'jamSelesai': '09:30',
      'sifir': 'Sifir Awal',
      'status': 'Aktif',
    },
    {
      'nama': 'AKHLAQ',
      'guru': 'Ust. Lukman Hakim',
      'hari': 'Rabu',
      'jamMulai': '09:45',
      'jamSelesai': '11:15',
      'sifir': 'Sifir Tsani',
      'status': 'Aktif',
    },
    {
      'nama': 'BMK',
      'guru': 'Ust. Zainul Arifin',
      'hari': 'Kamis',
      'jamMulai': '08:00',
      'jamSelesai': '09:30',
      'sifir': 'Sifir Tsalits',
      'status': 'Aktif',
    },
    {
      'nama': 'TAJWID',
      'guru': 'Ust. Hafidz Rahman',
      'hari': 'Kamis',
      'jamMulai': '09:45',
      'jamSelesai': '11:15',
      'sifir': 'Sifir Awal',
      'status': 'Nonaktif',
    },
    {
      'nama': 'USHUL FIQIH',
      'guru': 'Ust. Muhammad Hasan',
      'hari': "Jum'at",
      'jamMulai': '08:00',
      'jamSelesai': '09:30',
      'sifir': 'Sifir Robi',
      'status': 'Aktif',
    },
    {
      'nama': 'BALAGHO',
      'guru': 'Ust. Abdul Karim',
      'hari': 'Sabtu',
      'jamMulai': '08:00',
      'jamSelesai': '09:30',
      'sifir': 'Sifir Tsani',
      'status': 'Aktif',
    },
    {
      'nama': 'TAHAJI',
      'guru': 'Ust. Ahmad Fauzi',
      'hari': 'Sabtu',
      'jamMulai': '09:45',
      'jamSelesai': '11:15',
      'sifir': 'Sifir Tsalits',
      'status': 'Aktif',
    },
    {
      'nama': 'PEGO',
      'guru': 'Ust. Rizal Fahmi',
      'hari': 'Sabtu',
      'jamMulai': '13:00',
      'jamSelesai': '14:30',
      'sifir': 'Sifir Awal',
      'status': 'Nonaktif',
    },
  ];

  List<Map<String, dynamic>> get _filteredJadwal {
    if (_searchQuery.isEmpty) return _allJadwal;
    return _allJadwal
        .where(
          (j) =>
              (j['nama'] as String).toLowerCase().contains(
                _searchQuery.toLowerCase(),
              ) ||
              (j['hari'] as String).toLowerCase().contains(
                _searchQuery.toLowerCase(),
              ) ||
              (j['guru'] as String).toLowerCase().contains(
                _searchQuery.toLowerCase(),
              ),
        )
        .toList();
  }

  Color _getHariColor(String hari) {
    switch (hari) {
      case 'Senin':
        return const Color(0xFF138F81);
      case 'Selasa':
        return const Color(0xFF2E86DE);
      case 'Rabu':
        return const Color(0xFF6C5CE7);
      case 'Kamis':
        return const Color(0xFFE65100);
      case "Jum'at":
        return const Color(0xFF00B894);
      case 'Sabtu':
        return const Color(0xFFD63031);
      default:
        return const Color(0xFF636E72);
    }
  }

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 500),
    );
    _fadeIn = Tween<double>(
      begin: 0.0,
      end: 1.0,
    ).animate(CurvedAnimation(parent: _animController, curve: Curves.easeOut));
    _animController.forward();
  }

  @override
  void dispose() {
    _animController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  // ===== ACTIONS =====

  void _handleEditJadwal(Map<String, dynamic> jadwal) {
    setState(() => _expandedIndex = -1);
    Navigator.push(
      context,
      PageRouteBuilder(
        pageBuilder: (context, animation, _) => EditJadwalScreen(
          namaMapel: jadwal['nama'] as String,
          hari: jadwal['hari'] as String,
          jamMulai: jadwal['jamMulai'] as String,
          jamSelesai: jadwal['jamSelesai'] as String,
        ),
        transitionsBuilder: (context, animation, _, child) {
          return SlideTransition(
            position: Tween<Offset>(begin: const Offset(1, 0), end: Offset.zero)
                .animate(
                  CurvedAnimation(
                    parent: animation,
                    curve: Curves.easeOutCubic,
                  ),
                ),
            child: child,
          );
        },
        transitionDuration: const Duration(milliseconds: 350),
      ),
    );
  }

  void _handleDetail(Map<String, dynamic> jadwal) {
    setState(() => _expandedIndex = -1);
    final isActive = jadwal['status'] == 'Aktif';
    final hariColor = _getHariColor(jadwal['hari'] as String);

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: hariColor.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Icon(Icons.schedule_rounded, color: hariColor, size: 24),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    jadwal['nama'] as String,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  Text(
                    jadwal['guru'] as String,
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w400,
                      color: Color(0xFF636E72),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildDetailRow(
              Icons.calendar_today_rounded,
              'Hari',
              jadwal['hari'] as String,
              hariColor,
            ),
            const SizedBox(height: 10),
            _buildDetailRow(
              Icons.access_time_rounded,
              'Jam',
              '${jadwal['jamMulai']} – ${jadwal['jamSelesai']}',
              null,
            ),
            const SizedBox(height: 10),
            _buildDetailRow(
              Icons.school_rounded,
              'Sifir',
              jadwal['sifir'] as String,
              null,
            ),
            const SizedBox(height: 10),
            _buildDetailRow(
              Icons.circle,
              'Status',
              jadwal['status'] as String,
              isActive ? const Color(0xFF138F81) : const Color(0xFFE65100),
            ),
          ],
        ),
        actions: [
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: () => Navigator.pop(ctx),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF138F81),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: const Text('Tutup'),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDetailRow(
    IconData icon,
    String label,
    String value,
    Color? color,
  ) {
    return Row(
      children: [
        Icon(icon, size: 16, color: color ?? const Color(0xFF636E72)),
        const SizedBox(width: 8),
        Text(
          '$label: ',
          style: const TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w500,
            color: Color(0xFF636E72),
          ),
        ),
        Expanded(
          child: Text(
            value,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: color ?? const Color(0xFF2D3436),
            ),
          ),
        ),
      ],
    );
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
              _buildProfileBar(),
              const SizedBox(height: 12),

              // ===== SEARCH BAR =====
              _buildSearchBar(),
              const SizedBox(height: 12),

              // ===== CONTENT =====
              Expanded(
                child: Container(
                  width: double.infinity,
                  margin: const EdgeInsets.symmetric(horizontal: 16),
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: const Color(0xFFE1EFF7),
                    borderRadius: BorderRadius.circular(30),
                  ),
                  child: Column(
                    children: [
                      // Counter
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text(
                            'Jadwal Pelajaran',
                            style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF2D3436),
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 10,
                              vertical: 4,
                            ),
                            decoration: BoxDecoration(
                              color: const Color(
                                0xFF138F81,
                              ).withValues(alpha: 0.12),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Text(
                              '${_filteredJadwal.length} Jadwal',
                              style: const TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.w700,
                                color: Color(0xFF138F81),
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Container(
                        height: 1.5,
                        color: const Color(0xFF2D3436).withValues(alpha: 0.15),
                      ),
                      const SizedBox(height: 10),
                      Expanded(
                        child: _filteredJadwal.isEmpty
                            ? const Center(
                                child: Text(
                                  'Tidak ada jadwal ditemukan',
                                  style: TextStyle(
                                    fontSize: 13,
                                    color: Color(0xFF636E72),
                                  ),
                                ),
                              )
                            : ListView.builder(
                                physics: const BouncingScrollPhysics(),
                                itemCount: _filteredJadwal.length,
                                itemBuilder: (context, index) {
                                  return _buildJadwalItem(
                                    _filteredJadwal[index],
                                    index,
                                  );
                                },
                              ),
                      ),
                    ],
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
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                color: Color(0xFFFFDC80),
              ),
              child: ClipOval(
                child: Image.asset(
                  'assets/images/Kelola_Profil.png',
                  width: 44,
                  height: 44,
                  fit: BoxFit.contain,
                  gaplessPlayback: true,
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Jadwal Pelajaran',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF2D3436),
                    ),
                  ),
                  Text(
                    'Jadwal Mata Pelajaran Madrasah Diniah',
                    style: TextStyle(fontSize: 10, color: Colors.grey[600]),
                    maxLines: 2,
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
            Image.asset(
              'assets/images/Search.png',
              width: 22,
              height: 22,
              gaplessPlayback: true,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: TextField(
                controller: _searchController,
                onChanged: (val) => setState(() => _searchQuery = val),
                decoration: const InputDecoration(
                  hintText: 'Cari Jadwal / Mapel / Guru...',
                  border: InputBorder.none,
                  hintStyle: TextStyle(fontSize: 13, color: Color(0xFF636E72)),
                ),
                style: const TextStyle(fontSize: 13),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildJadwalItem(Map<String, dynamic> jadwal, int index) {
    final isExpanded = _expandedIndex == index;
    final nama = jadwal['nama'] as String;
    final hari = jadwal['hari'] as String;
    final jam = '${jadwal['jamMulai']} – ${jadwal['jamSelesai']}';
    final guru = jadwal['guru'] as String;
    final isActive = jadwal['status'] == 'Aktif';
    final hariColor = _getHariColor(hari);

    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0.0, end: 1.0),
      duration: Duration(milliseconds: 300 + (index * 60)),
      curve: Curves.easeOutCubic,
      builder: (context, value, child) {
        return Opacity(
          opacity: value,
          child: Transform.translate(
            offset: Offset(0, 15 * (1 - value)),
            child: child,
          ),
        );
      },
      child: Column(
        children: [
          GestureDetector(
            onTap: () {
              setState(() {
                _expandedIndex = isExpanded ? -1 : index;
              });
            },
            child: Container(
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(18),
              ),
              child: Row(
                children: [
                  // Day badge
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: hariColor.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Center(
                      child: Text(
                        hari.substring(0, 3),
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w800,
                          color: hariColor,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  // Info
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          nama,
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF2D3436),
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          guru,
                          style: const TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w500,
                            color: Color(0xFF636E72),
                          ),
                        ),
                        const SizedBox(height: 4),
                        Row(
                          children: [
                            // Time badge
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 6,
                                vertical: 2,
                              ),
                              decoration: BoxDecoration(
                                color: const Color(
                                  0xFF2E86DE,
                                ).withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  const Icon(
                                    Icons.access_time_rounded,
                                    size: 10,
                                    color: Color(0xFF2E86DE),
                                  ),
                                  const SizedBox(width: 3),
                                  Text(
                                    jam,
                                    style: const TextStyle(
                                      fontSize: 9,
                                      fontWeight: FontWeight.w700,
                                      color: Color(0xFF2E86DE),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 4),
                            // Status badge
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 6,
                                vertical: 2,
                              ),
                              decoration: BoxDecoration(
                                color: isActive
                                    ? const Color(
                                        0xFF138F81,
                                      ).withValues(alpha: 0.1)
                                    : const Color(
                                        0xFFE65100,
                                      ).withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(
                                jadwal['status'] as String,
                                style: TextStyle(
                                  fontSize: 8,
                                  fontWeight: FontWeight.w700,
                                  color: isActive
                                      ? const Color(0xFF138F81)
                                      : const Color(0xFFE65100),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  // Arrow
                  AnimatedRotation(
                    turns: isExpanded ? 0.5 : 0.0,
                    duration: const Duration(milliseconds: 250),
                    child: Container(
                      width: 30,
                      height: 30,
                      decoration: const BoxDecoration(
                        shape: BoxShape.circle,
                        color: Color(0xFFFFDC80),
                      ),
                      child: const Icon(
                        Icons.arrow_drop_down_rounded,
                        color: Color(0xFF2D3436),
                        size: 22,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          // Dropdown options
          AnimatedSize(
            duration: const Duration(milliseconds: 250),
            curve: Curves.easeOutCubic,
            child: isExpanded
                ? Container(
                    margin: const EdgeInsets.only(
                      left: 16,
                      right: 16,
                      bottom: 10,
                    ),
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Column(
                      children: [
                        _buildDropdownOption(
                          icon: Icons.edit_calendar_rounded,
                          label: 'Edit Jadwal',
                          color: const Color(0xFF2E86DE),
                          onTap: () => _handleEditJadwal(jadwal),
                        ),
                        const SizedBox(height: 6),
                        _buildDropdownOption(
                          icon: Icons.info_outline_rounded,
                          label: 'Detail',
                          color: const Color(0xFF636E72),
                          onTap: () => _handleDetail(jadwal),
                        ),
                      ],
                    ),
                  )
                : const SizedBox.shrink(),
          ),
        ],
      ),
    );
  }

  Widget _buildDropdownOption({
    required IconData icon,
    required String label,
    required Color color,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            Icon(icon, size: 18, color: color),
            const SizedBox(width: 10),
            Text(
              label,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: color,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
