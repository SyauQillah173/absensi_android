import 'package:flutter/material.dart';

class DetailInformasiScreen extends StatelessWidget {
  final String judul;
  final String deskripsi;
  final String tanggal;

  const DetailInformasiScreen({
    super.key,
    required this.judul,
    required this.deskripsi,
    required this.tanggal,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFFDC80),
      body: SafeArea(
        child: Column(
          children: [
            // ===== APP BAR =====
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
              child: Row(
                children: [
                  IconButton(
                    onPressed: () => Navigator.pop(context),
                    icon: const Icon(
                      Icons.arrow_back_ios_rounded,
                      color: Color(0xFF2D3436),
                      size: 20,
                    ),
                  ),
                  const Expanded(
                    child: Text(
                      'Detail Informasi',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF2D3436),
                      ),
                    ),
                  ),
                  const SizedBox(width: 48), // balance the back button
                ],
              ),
            ),

            // ===== SCROLL CONTENT =====
            Expanded(
              child: SingleChildScrollView(
                physics: const BouncingScrollPhysics(),
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Hero image
                    Container(
                      width: double.infinity,
                      height: 200,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(25),
                        color: const Color(0xFFE1EFF7),
                      ),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(25),
                        child: Stack(
                          fit: StackFit.expand,
                          children: [
                            // Gradient background
                            Container(
                              decoration: const BoxDecoration(
                                gradient: LinearGradient(
                                  begin: Alignment.topLeft,
                                  end: Alignment.bottomRight,
                                  colors: [
                                    Color(0xFF138F81),
                                    Color(0xFF0D6B61),
                                  ],
                                ),
                              ),
                            ),
                            // Pattern overlay
                            Positioned(
                              right: -20,
                              bottom: -20,
                              child: Icon(
                                Icons.article_rounded,
                                size: 160,
                                color: Colors.white.withValues(alpha: 0.1),
                              ),
                            ),
                            // Label
                            Positioned(
                              left: 24,
                              bottom: 24,
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 10,
                                      vertical: 4,
                                    ),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFFFDC80),
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: const Text(
                                      'Informasi',
                                      style: TextStyle(
                                        fontSize: 11,
                                        fontWeight: FontWeight.w600,
                                        color: Color(0xFF2D3436),
                                      ),
                                    ),
                                  ),
                                  const SizedBox(height: 8),
                                  const Text(
                                    'Pondok Pesantren\nQomaruddin',
                                    style: TextStyle(
                                      fontSize: 20,
                                      fontWeight: FontWeight.w700,
                                      color: Colors.white,
                                      height: 1.3,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 20),

                    // ===== ARTICLE CONTENT =====
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        color: const Color(0xFFE1EFF7),
                        borderRadius: BorderRadius.circular(25),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Title
                          Text(
                            judul,
                            style: const TextStyle(
                              fontSize: 22,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF2D3436),
                              height: 1.3,
                            ),
                          ),
                          const SizedBox(height: 10),

                          // Date & read time
                          Row(
                            children: [
                              Icon(
                                Icons.calendar_today_rounded,
                                size: 14,
                                color: Colors.grey[500],
                              ),
                              const SizedBox(width: 6),
                              Text(
                                tanggal,
                                style: TextStyle(
                                  fontSize: 12,
                                  color: Colors.grey[500],
                                ),
                              ),
                              const SizedBox(width: 16),
                              Icon(
                                Icons.access_time_rounded,
                                size: 14,
                                color: Colors.grey[500],
                              ),
                              const SizedBox(width: 4),
                              Text(
                                '3 menit baca',
                                style: TextStyle(
                                  fontSize: 12,
                                  color: Colors.grey[500],
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 16),

                          // Divider
                          Container(
                            height: 1.5,
                            color: const Color(
                              0xFF2D3436,
                            ).withValues(alpha: 0.1),
                          ),
                          const SizedBox(height: 16),

                          // Short desc (bold)
                          Text(
                            deskripsi,
                            style: const TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                              color: Color(0xFF2D3436),
                              height: 1.6,
                            ),
                          ),
                          const SizedBox(height: 16),

                          // Demo article body
                          const Text(
                            'Pondok Pesantren Qomaruddin merupakan salah satu lembaga pendidikan Islam tertua '
                            'di daerah Gresik, Jawa Timur. Didirikan oleh KH. Qomaruddin pada abad ke-18, '
                            'pesantren ini telah menjadi pusat pendidikan agama Islam yang terpercaya selama '
                            'berabad-abad.\n\n'
                            'Pesantren ini memiliki berbagai program pendidikan, mulai dari Madrasah Diniyah '
                            'hingga pendidikan formal. Para santri tidak hanya belajar ilmu agama, tetapi juga '
                            'dibekali dengan keterampilan yang berguna untuk kehidupan sehari-hari.\n\n'
                            'Visi pesantren adalah mencetak generasi yang berilmu, berakhlak mulia, dan '
                            'bermanfaat bagi masyarakat. Dengan kurikulum yang terintegrasi antara '
                            'pendidikan agama dan umum, pesantren berupaya menghasilkan lulusan yang '
                            'siap menghadapi tantangan zaman.\n\n'
                            'Program unggulan meliputi:\n'
                            '• Tahfidzul Quran\n'
                            '• Kajian Kitab Kuning\n'
                            '• Bahasa Arab dan Inggris\n'
                            '• Keterampilan Teknologi Informasi\n'
                            '• Pengembangan Karakter dan Kepemimpinan',
                            style: TextStyle(
                              fontSize: 14,
                              color: Color(0xFF2D3436),
                              height: 1.8,
                            ),
                          ),
                          const SizedBox(height: 20),

                          // Info box
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              color: const Color(
                                0xFF138F81,
                              ).withValues(alpha: 0.08),
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(
                                color: const Color(
                                  0xFF138F81,
                                ).withValues(alpha: 0.2),
                              ),
                            ),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Icon(
                                  Icons.info_outline_rounded,
                                  size: 20,
                                  color: Color(0xFF138F81),
                                ),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Text(
                                    'Informasi ini dipublikasikan oleh '
                                    'Admin Madrasah Diniah Qomaruddin. '
                                    'Untuk pertanyaan lebih lanjut, '
                                    'silakan hubungi pihak pesantren.',
                                    style: TextStyle(
                                      fontSize: 12,
                                      color: Colors.grey[700],
                                      height: 1.5,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),

                    // ===== SHARE & ACTIONS =====
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(
                        horizontal: 20,
                        vertical: 16,
                      ),
                      decoration: BoxDecoration(
                        color: const Color(0xFFE1EFF7),
                        borderRadius: BorderRadius.circular(25),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                        children: [
                          _buildActionButton(
                            icon: Icons.share_rounded,
                            label: 'Bagikan',
                            color: const Color(0xFF138F81),
                            onTap: () {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: const Text(
                                    'Fitur bagikan segera hadir',
                                  ),
                                  behavior: SnackBarBehavior.floating,
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  backgroundColor: const Color(0xFF138F81),
                                  duration: const Duration(seconds: 1),
                                ),
                              );
                            },
                          ),
                          _buildActionButton(
                            icon: Icons.bookmark_outline_rounded,
                            label: 'Simpan',
                            color: const Color(0xFFFFB74D),
                            onTap: () {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: const Text('Informasi disimpan'),
                                  behavior: SnackBarBehavior.floating,
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  backgroundColor: const Color(0xFFFFB74D),
                                  duration: const Duration(seconds: 1),
                                ),
                              );
                            },
                          ),
                          _buildActionButton(
                            icon: Icons.print_rounded,
                            label: 'Cetak',
                            color: const Color(0xFF636E72),
                            onTap: () {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: const Text(
                                    'Fitur cetak segera hadir',
                                  ),
                                  behavior: SnackBarBehavior.floating,
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  backgroundColor: const Color(0xFF636E72),
                                  duration: const Duration(seconds: 1),
                                ),
                              );
                            },
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildActionButton({
    required IconData icon,
    required String label,
    required Color color,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: color, size: 22),
          ),
          const SizedBox(height: 6),
          Text(
            label,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w500,
              color: color,
            ),
          ),
        ],
      ),
    );
  }
}
