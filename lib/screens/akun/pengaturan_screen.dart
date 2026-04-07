import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:shared_preferences/shared_preferences.dart';

class PengaturanScreen extends StatefulWidget {
  const PengaturanScreen({super.key});

  @override
  State<PengaturanScreen> createState() => _PengaturanScreenState();
}

class _PengaturanScreenState extends State<PengaturanScreen> {
  bool _notifEnabled = true;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadSettings();
  }

  Future<void> _loadSettings() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      _notifEnabled = prefs.getBool('notif_enabled') ?? true;
      _isLoading = false;
    });
  }



  Future<void> _setNotif(bool val) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('notif_enabled', val);
    setState(() => _notifEnabled = val);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFFDC80),
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(),
            const SizedBox(height: 8),
            Expanded(
              child: _isLoading
                ? const Center(child: CircularProgressIndicator(color: Color(0xFF138F81)))
                : Container(
                    margin: const EdgeInsets.symmetric(horizontal: 16),
                    decoration: BoxDecoration(
                      color: const Color(0xFFE1EFF7),
                      borderRadius: BorderRadius.circular(30),
                    ),
                    child: ListView(
                      physics: const BouncingScrollPhysics(),
                      padding: const EdgeInsets.all(16),
                      children: [
                        // ===== NOTIFIKASI =====
                        _buildSectionTitle('Notifikasi', Icons.notifications_rounded),
                        const SizedBox(height: 10),
                        _buildNotifToggle(),
                        const SizedBox(height: 20),

                        // ===== INFO GOOGLE DRIVE (Future) =====
                        _buildSectionTitle('Penyimpanan Cloud', Icons.cloud_rounded),
                        const SizedBox(height: 10),
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(color: const Color(0xFFDFE6E9)),
                          ),
                          child: Row(
                            children: [
                              Container(
                                width: 40, height: 40,
                                decoration: BoxDecoration(
                                  color: const Color(0xFFFFF3E0),
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: const Icon(Icons.cloud_off_rounded, color: Color(0xFFE65100), size: 20),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text('Google Drive', style: GoogleFonts.poppins(
                                      fontSize: 13, fontWeight: FontWeight.w600, color: const Color(0xFF2D3436),
                                    )),
                                    Text('Akan tersedia di update mendatang', style: GoogleFonts.poppins(
                                      fontSize: 11, color: const Color(0xFF636E72),
                                    )),
                                  ],
                                ),
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFFFF3E0),
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                child: Text('COMING SOON', style: GoogleFonts.poppins(
                                  fontSize: 9, fontWeight: FontWeight.w700, color: const Color(0xFFE65100),
                                )),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 20),

                        // ===== TENTANG APLIKASI =====
                        _buildSectionTitle('Tentang Aplikasi', Icons.info_rounded),
                        const SizedBox(height: 10),
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(14),
                          ),
                          child: Column(
                            children: [
                              Text('SI Madrasah Diniah', style: GoogleFonts.poppins(
                                fontSize: 14, fontWeight: FontWeight.w700, color: const Color(0xFF138F81),
                              )),
                              Text('PP Qomaruddin', style: GoogleFonts.poppins(
                                fontSize: 12, color: const Color(0xFF636E72),
                              )),
                              const SizedBox(height: 6),
                              Text('Versi 1.0.0', style: GoogleFonts.poppins(
                                fontSize: 11, color: const Color(0xFF636E72),
                              )),
                            ],
                          ),
                        ),
                        const SizedBox(height: 16),
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
              width: 46, height: 46,
              decoration: BoxDecoration(
                gradient: const LinearGradient(colors: [Color(0xFF6C5CE7), Color(0xFFA29BFE)]),
                borderRadius: BorderRadius.circular(14),
              ),
              child: const Icon(Icons.settings_rounded, color: Colors.white, size: 24),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Pengaturan', style: GoogleFonts.poppins(
                    fontSize: 16, fontWeight: FontWeight.w700, color: const Color(0xFF2D3436),
                  )),
                  Text('Atur preferensi aplikasi', style: GoogleFonts.poppins(
                    fontSize: 11, color: const Color(0xFF636E72),
                  )),
                ],
              ),
            ),
            IconButton(
              onPressed: () => Navigator.pop(context),
              icon: const Icon(Icons.close_rounded, size: 22, color: Color(0xFF636E72)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSectionTitle(String title, IconData icon) {
    return Row(
      children: [
        Icon(icon, size: 18, color: const Color(0xFF138F81)),
        const SizedBox(width: 8),
        Text(title, style: GoogleFonts.poppins(
          fontSize: 14, fontWeight: FontWeight.w700, color: const Color(0xFF2D3436),
        )),
      ],
    );
  }


  Widget _buildNotifToggle() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFDFE6E9)),
      ),
      child: Row(
        children: [
          Container(
            width: 40, height: 40,
            decoration: BoxDecoration(
              color: (_notifEnabled ? const Color(0xFF138F81) : const Color(0xFFE65100)).withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(
              _notifEnabled ? Icons.notifications_active_rounded : Icons.notifications_off_rounded,
              color: _notifEnabled ? const Color(0xFF138F81) : const Color(0xFFE65100),
              size: 20,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Notifikasi Pengingat', style: GoogleFonts.poppins(
                  fontSize: 13, fontWeight: FontWeight.w600, color: const Color(0xFF2D3436),
                )),
                Text(
                  _notifEnabled ? 'Aktif — Anda akan menerima notifikasi' : 'Nonaktif — Notifikasi dimatikan',
                  style: GoogleFonts.poppins(fontSize: 11, color: const Color(0xFF636E72)),
                ),
              ],
            ),
          ),
          Switch(
            value: _notifEnabled,
            onChanged: _setNotif,
            activeThumbColor: const Color(0xFF138F81),
          ),
        ],
      ),
    );
  }
}
