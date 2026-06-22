import 'package:flutter/material.dart';

import 'detail_informasi_screen.dart';
import 'edit_informasi_screen.dart';
import 'tambah_informasi_screen.dart';

class JelajahScreen extends StatefulWidget {
  const JelajahScreen({super.key});

  @override
  State<JelajahScreen> createState() => _JelajahScreenState();
}

class _JelajahScreenState extends State<JelajahScreen> {
  // Demo data informasi
  final List<Map<String, String>> _informasiList = [
    {
      'judul': 'Sejarah Pondok Qomaruddin',
      'deskripsi': 'Sejarah Singkat Berdirinya Pondok Pesantren Qomaruddin',
      'tanggal': '12 Februari 2026',
    },
    {
      'judul': 'Pendaftaran Santri Baru',
      'deskripsi': 'Informasi Pendaftaran Santri Baru Tahun Ajaran 2026/2027',
      'tanggal': '10 Februari 2026',
    },
    {
      'judul': 'Jadwal Ujian Semester',
      'deskripsi': 'Jadwal Ujian Akhir Semester Genap Madrasah Diniah',
      'tanggal': '8 Februari 2026',
    },
    {
      'judul': 'Kegiatan Haflah Akhirussanah',
      'deskripsi':
          'Rangkaian Acara Haflah Akhirussanah Pondok Pesantren Qomaruddin',
      'tanggal': '5 Februari 2026',
    },
  ];

  final bool _isAdmin = true; // Demo: set as admin

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // ===== FIXED PROFILE BAR (does NOT scroll) =====
        Padding(
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
                  child: const Icon(
                    Icons.explore_rounded,
                    color: Color(0xFFD63031),
                    size: 28,
                  ),
                ),
                const SizedBox(width: 12),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Jelajah',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF2D3436),
                        ),
                      ),
                      Text(
                        'Beragam Informasi Pondok Pesantren Qomaruddin',
                        style: TextStyle(
                          fontSize: 11,
                          color: Color(0xFF636E72),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 14),

        // ===== SCROLLABLE INFO CARDS (only this part scrolls) =====
        Expanded(
          child: Container(
            width: double.infinity,
            margin: const EdgeInsets.symmetric(horizontal: 16),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFFE1EFF7),
              borderRadius: BorderRadius.circular(50),
            ),
            child: Column(
              children: [
                // Admin: Tambah Informasi button
                if (_isAdmin)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: SizedBox(
                      width: double.infinity,
                      child: ElevatedButton.icon(
                        onPressed: () async {
                          final result = await Navigator.push(
                            context,
                            PageRouteBuilder(
                              pageBuilder: (context, animation, _) =>
                                  const TambahInformasiScreen(),
                              transitionsBuilder:
                                  (context, animation, _, child) {
                                    return SlideTransition(
                                      position:
                                          Tween<Offset>(
                                            begin: const Offset(0, 1),
                                            end: Offset.zero,
                                          ).animate(
                                            CurvedAnimation(
                                              parent: animation,
                                              curve: Curves.easeOutCubic,
                                            ),
                                          ),
                                      child: child,
                                    );
                                  },
                              transitionDuration: const Duration(
                                milliseconds: 400,
                              ),
                            ),
                          );
                          if (result != null && result is Map<String, String>) {
                            setState(() {
                              _informasiList.insert(0, result);
                            });
                          }
                        },
                        icon: const Icon(Icons.add_rounded, size: 20),
                        label: const Text('Tambah Informasi'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF138F81),
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(21),
                          ),
                          elevation: 2,
                        ),
                      ),
                    ),
                  ),

                // Scrollable card list
                Expanded(
                  child: ListView.builder(
                    physics: const BouncingScrollPhysics(),
                    itemCount: _informasiList.length,
                    itemBuilder: (context, index) {
                      return _buildInfoCard(_informasiList[index], index);
                    },
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 8),
      ],
    );
  }

  Widget _buildInfoCard(Map<String, String> info, int index) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0.0, end: 1.0),
      duration: Duration(milliseconds: 400 + (index * 100)),
      curve: Curves.easeOutCubic,
      builder: (context, value, child) {
        return Opacity(
          opacity: value,
          child: Transform.translate(
            offset: Offset(0, 20 * (1 - value)),
            child: child,
          ),
        );
      },
      child: GestureDetector(
        onTap: () {
          // Navigate to detail screen
          Navigator.push(
            context,
            PageRouteBuilder(
              pageBuilder: (context, animation, _) => DetailInformasiScreen(
                judul: info['judul']!,
                deskripsi: info['deskripsi']!,
                tanggal: info['tanggal']!,
              ),
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
          );
        },
        child: Container(
          width: double.infinity,
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(21),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                info['judul']!,
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF2D3436),
                ),
              ),
              const SizedBox(height: 6),
              Text(
                info['deskripsi']!,
                style: const TextStyle(
                  fontSize: 12,
                  color: Color(0xFF636E72),
                  height: 1.4,
                ),
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Icon(
                    Icons.calendar_today_rounded,
                    size: 12,
                    color: Colors.grey[400],
                  ),
                  const SizedBox(width: 4),
                  Text(
                    info['tanggal']!,
                    style: TextStyle(fontSize: 10, color: Colors.grey[400]),
                  ),
                  if (_isAdmin) ...[
                    const Spacer(),
                    GestureDetector(
                      onTap: () {
                        _showEditDeleteDialog(index);
                      },
                      child: Icon(
                        Icons.more_vert_rounded,
                        size: 18,
                        color: Colors.grey[500],
                      ),
                    ),
                  ],
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showEditDeleteDialog(int index) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (context) {
        return Container(
          margin: const EdgeInsets.all(16),
          padding: const EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(21),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 40,
                height: 4,
                margin: const EdgeInsets.only(bottom: 8),
                decoration: BoxDecoration(
                  color: Colors.grey[300],
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              ListTile(
                leading: const Icon(
                  Icons.edit_rounded,
                  color: Color(0xFF138F81),
                ),
                title: const Text('Edit Informasi'),
                onTap: () async {
                  Navigator.pop(context);
                  final result = await Navigator.push(
                    this.context,
                    PageRouteBuilder(
                      pageBuilder: (context, animation, _) =>
                          EditInformasiScreen(informasi: _informasiList[index]),
                      transitionsBuilder: (context, animation, _, child) {
                        return SlideTransition(
                          position:
                              Tween<Offset>(
                                begin: const Offset(1, 0),
                                end: Offset.zero,
                              ).animate(
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
                  if (result != null && result is Map<String, String>) {
                    setState(() {
                      _informasiList[index] = result;
                    });
                    if (mounted) {
                      ScaffoldMessenger.of(this.context).showSnackBar(
                        SnackBar(
                          content: const Text('Informasi berhasil diupdate'),
                          backgroundColor: const Color(0xFF138F81),
                          behavior: SnackBarBehavior.floating,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                      );
                    }
                  }
                },
              ),
              ListTile(
                leading: const Icon(
                  Icons.delete_rounded,
                  color: Colors.redAccent,
                ),
                title: const Text('Hapus Informasi'),
                onTap: () {
                  Navigator.pop(context);
                  setState(() {
                    _informasiList.removeAt(index);
                  });
                },
              ),
            ],
          ),
        );
      },
    );
  }
}
