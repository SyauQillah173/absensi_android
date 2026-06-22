import 'dart:async';

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../services/api_service.dart';
import '../../services/session_service.dart';
import '../../services/sync_service.dart';
import '../../widgets/responsive_layout.dart';

class DataDiriGuruScreen extends StatefulWidget {
  const DataDiriGuruScreen({super.key});

  @override
  State<DataDiriGuruScreen> createState() => _DataDiriGuruScreenState();
}

class _DataDiriGuruScreenState extends State<DataDiriGuruScreen> {
  StreamSubscription<AppDataEvent>? _syncSubscription;
  Map<String, dynamic>? _profile;
  bool _isLoading = true;
  String? _errorMessage;
  int _userId = 0;

  @override
  void initState() {
    super.initState();
    _loadProfile();
    _syncSubscription = SyncService.dataEvents.listen((event) {
      if (event.topic == SyncTopics.user ||
          event.topic == SyncTopics.profile ||
          event.topic == SyncTopics.heartbeat) {
        _loadProfile(silent: true);
      }
    });
  }

  @override
  void dispose() {
    _syncSubscription?.cancel();
    super.dispose();
  }

  Future<void> _loadProfile({bool silent = false}) async {
    if (!silent) {
      setState(() {
        _isLoading = true;
        _errorMessage = null;
      });
    }

    try {
      _userId = await SessionService.getUserId();
      final result = await ApiService.getProfile(_userId);
      if (!mounted) return;
      final data = result['data'];
      if (data is Map) {
        setState(() {
          _profile = Map<String, dynamic>.from(data);
          _isLoading = false;
          _errorMessage = null;
        });
      } else {
        setState(() {
          _isLoading = false;
          _errorMessage = 'Data diri guru belum tersedia';
        });
      }
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _isLoading = false;
        _errorMessage = 'Tidak dapat memuat data diri guru';
      });
    }
  }

  String _text(String key) {
    final value = _profile?[key];
    if (value is List) return value.whereType<Object>().join(', ');
    final text = value?.toString().trim() ?? '';
    return text.isEmpty ? '-' : text;
  }

  String _genderLabel(String value) {
    if (value == 'L') return 'Laki-laki';
    if (value == 'P') return 'Perempuan';
    return value.isEmpty || value == '-' ? '-' : value;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFFDC80),
      body: SafeArea(
        child: AppResponsive(
          child: Column(
            children: [
              _buildHeader(context),
              const SizedBox(height: 12),
              Expanded(
                child: RefreshIndicator(
                  color: const Color(0xFF138F81),
                  onRefresh: _loadProfile,
                  child: ListView(
                    physics: const AlwaysScrollableScrollPhysics(
                      parent: BouncingScrollPhysics(),
                    ),
                    padding: EdgeInsets.symmetric(
                      horizontal: AppResponsive.pageMargin(context),
                      vertical: 4,
                    ),
                    children: [_buildBody()],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context) {
    return Container(
      margin: EdgeInsets.fromLTRB(
        AppResponsive.pageMargin(context),
        10,
        AppResponsive.pageMargin(context),
        0,
      ),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFE1EFF7),
        borderRadius: BorderRadius.circular(30),
      ),
      child: Row(
        children: [
          Container(
            width: 58,
            height: 58,
            decoration: BoxDecoration(
              color: const Color(0xFFFFDC80),
              borderRadius: BorderRadius.circular(18),
            ),
            child: const Icon(
              Icons.badge_rounded,
              color: Color(0xFF138F81),
              size: 32,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Data Diri Guru',
                  style: GoogleFonts.poppins(
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                    color: const Color(0xFF2D3436),
                  ),
                ),
                Text(
                  _profile?['name']?.toString() ?? 'Profil guru',
                  style: GoogleFonts.poppins(
                    fontSize: 12,
                    color: const Color(0xFF636E72),
                  ),
                ),
              ],
            ),
          ),
          IconButton(
            onPressed: () => Navigator.pop(context),
            icon: const Icon(Icons.close_rounded, size: 30),
          ),
        ],
      ),
    );
  }

  Widget _buildBody() {
    if (_isLoading) {
      return const SizedBox(
        height: 420,
        child: Center(
          child: CircularProgressIndicator(color: Color(0xFF138F81)),
        ),
      );
    }

    if (_errorMessage != null) {
      return _buildEmptyState(_errorMessage!);
    }

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFE1EFF7),
        borderRadius: BorderRadius.circular(30),
      ),
      child: Column(
        children: [
          _buildAvatar(),
          const SizedBox(height: 14),
          _buildSection('Identitas Guru', [
            ('Nama Lengkap', _text('name')),
            ('Kode Guru', _text('kode_guru')),
            ('NIS/NIP', _text('nis')),
            ('NIK', _text('nik_user')),
            ('Jenis Kelamin', _genderLabel(_text('jenis_kelamin'))),
          ]),
          _buildSection('Kontak', [
            ('Email', _text('email')),
            ('No HP', _text('no_hp')),
            ('Alamat', _text('alamat')),
          ]),
          _buildSection('Unit Mengajar', [
            ('Unit Kerja', _text('unit_kerja')),
            ('Kategori Guru', _text('kategori_guru')),
          ]),
        ],
      ),
    );
  }

  Widget _buildAvatar() {
    final photo = _profile?['foto_url']?.toString() ?? '';
    return CircleAvatar(
      radius: 42,
      backgroundColor: const Color(0xFF138F81).withValues(alpha: 0.12),
      backgroundImage: photo.isNotEmpty ? NetworkImage(photo) : null,
      child: photo.isEmpty
          ? const Icon(Icons.person_rounded, size: 48, color: Color(0xFF138F81))
          : null,
    );
  }

  Widget _buildSection(String title, List<(String, String)> rows) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: GoogleFonts.poppins(
              fontSize: 14,
              fontWeight: FontWeight.w800,
              color: const Color(0xFF138F81),
            ),
          ),
          const SizedBox(height: 8),
          ...rows.map((row) => _buildRow(row.$1, row.$2)),
        ],
      ),
    );
  }

  Widget _buildRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 118,
            child: Text(
              label,
              style: GoogleFonts.poppins(
                fontSize: 11,
                color: const Color(0xFF636E72),
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              value,
              style: GoogleFonts.poppins(
                fontSize: 12,
                color: const Color(0xFF2D3436),
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyState(String message) {
    return Container(
      height: 420,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFFE1EFF7),
        borderRadius: BorderRadius.circular(30),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.badge_outlined, size: 46, color: Color(0xFF636E72)),
          const SizedBox(height: 12),
          Text(
            message,
            textAlign: TextAlign.center,
            style: GoogleFonts.poppins(
              fontSize: 13,
              color: const Color(0xFF636E72),
            ),
          ),
          const SizedBox(height: 16),
          ElevatedButton(
            onPressed: _loadProfile,
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF138F81),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
              ),
            ),
            child: const Text('Muat Ulang'),
          ),
        ],
      ),
    );
  }
}
