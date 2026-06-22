import 'dart:io';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../services/api_service.dart';

class KelolaProfilScreen extends StatefulWidget {
  const KelolaProfilScreen({super.key});

  @override
  State<KelolaProfilScreen> createState() => _KelolaProfilScreenState();
}

class _KelolaProfilScreenState extends State<KelolaProfilScreen> {
  final _formKey = GlobalKey<FormState>();
  bool _isLoading = true;
  bool _isSaving = false;
  bool _isUploadingPhoto = false;
  bool _hasPendingPhotoUpload = false;
  File? _newFotoFile;

  late TextEditingController _nameCtrl;
  late TextEditingController _emailCtrl;
  late TextEditingController _nisCtrl;
  late TextEditingController _nikCtrl;
  late TextEditingController _noHpCtrl;
  String _jk = 'Laki-laki';
  String _role = '';
  String? _fotoUrl;
  int _userId = 0;

  @override
  void initState() {
    super.initState();
    _nameCtrl = TextEditingController();
    _emailCtrl = TextEditingController();
    _nisCtrl = TextEditingController();
    _nikCtrl = TextEditingController();
    _noHpCtrl = TextEditingController();
    _loadProfile();
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _emailCtrl.dispose();
    _nisCtrl.dispose();
    _nikCtrl.dispose();
    _noHpCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadProfile() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      _userId = prefs.getInt('user_id') ?? 0;
      _role = prefs.getString('user_role') ?? '';

      // Load foto from prefs first (instant display)
      final savedFoto = prefs.getString('user_foto_url');
      if (savedFoto != null && savedFoto.isNotEmpty) {
        _fotoUrl = savedFoto;
      }

      if (_userId > 0) {
        final result = await ApiService.getProfile(_userId);
        if (result['success'] == true) {
          final data = result['data'];
          _nameCtrl.text = data['name'] ?? '';
          _emailCtrl.text = data['email'] ?? '';
          _nisCtrl.text = data['nis'] ?? '';
          _nikCtrl.text = data['nik_user'] ?? '';
          _noHpCtrl.text = data['no_hp'] ?? '';
          _jk = data['jenis_kelamin'] == 'L'
              ? 'Laki-laki'
              : (data['jenis_kelamin'] == 'P' ? 'Perempuan' : 'Laki-laki');
          _role = data['role'] ?? _role;
          final fotoUrl =
              data['foto_url']?.toString() ?? data['foto_profil']?.toString();
          if (fotoUrl != null && fotoUrl.isNotEmpty) {
            _fotoUrl = fotoUrl;
            await prefs.setString('user_foto_url', _fotoUrl!);
          }
        }
      } else {
        // Fallback to local prefs
        _nameCtrl.text = prefs.getString('user_name') ?? '';
        _emailCtrl.text = prefs.getString('user_email') ?? '';
      }
    } catch (_) {
      // Use local prefs if API fails
      final prefs = await SharedPreferences.getInstance();
      _nameCtrl.text = prefs.getString('user_name') ?? '';
      _emailCtrl.text = prefs.getString('user_email') ?? '';
    }
    if (mounted) setState(() => _isLoading = false);
  }

  Future<void> _pickPhoto() async {
    final hasPhoto = _newFotoFile != null || (_fotoUrl?.isNotEmpty ?? false);
    final action = await showModalBottomSheet<String>(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => Container(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'Ubah Foto Profil',
              style: GoogleFonts.poppins(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: const Color(0xFF2D3436),
              ),
            ),
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                _buildSourceOption(
                  Icons.camera_alt_rounded,
                  'Kamera',
                  () => Navigator.pop(ctx, 'camera'),
                ),
                _buildSourceOption(
                  Icons.photo_library_rounded,
                  'Galeri',
                  () => Navigator.pop(ctx, 'gallery'),
                ),
                if (hasPhoto)
                  _buildSourceOption(
                    Icons.delete_rounded,
                    'Hapus',
                    () => Navigator.pop(ctx, 'delete'),
                    color: const Color(0xFFE65100),
                  ),
              ],
            ),
            const SizedBox(height: 12),
          ],
        ),
      ),
    );

    if (action == null) return;
    if (action == 'delete') {
      await _deletePhoto();
      return;
    }

    final source = action == 'camera'
        ? ImageSource.camera
        : ImageSource.gallery;
    final picker = ImagePicker();
    final xFile = await picker.pickImage(
      source: source,
      imageQuality: 80,
      maxWidth: 800,
    );
    if (xFile == null) return;

    setState(() {
      _newFotoFile = File(xFile.path);
      _hasPendingPhotoUpload = true;
    });

    if (_userId > 0) {
      await _uploadSelectedPhoto(showSuccessSnack: true);
    }
  }

  Future<void> _deletePhoto() async {
    final hasServerPhoto = _fotoUrl != null && _fotoUrl!.isNotEmpty;

    if (!hasServerPhoto && _newFotoFile == null) return;

    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text(
          'Hapus Foto Profil',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
        ),
        content: const Text(
          'Foto profil akan dikosongkan dan kembali memakai avatar default.',
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

    setState(() {
      _isUploadingPhoto = true;
      _newFotoFile = null;
      _hasPendingPhotoUpload = false;
    });

    try {
      if (hasServerPhoto && _userId > 0) {
        await ApiService.deleteFotoProfil(_userId);
      }
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove('user_foto_url');

      if (!mounted) return;
      setState(() {
        _fotoUrl = null;
      });
      _showSnack('Foto profil berhasil dihapus');
    } catch (e) {
      if (mounted) {
        _showSnack('Gagal menghapus foto profil: $e', isError: true);
      }
    } finally {
      if (mounted) {
        setState(() => _isUploadingPhoto = false);
      }
    }
  }

  Future<bool> _uploadSelectedPhoto({bool showSuccessSnack = false}) async {
    final selectedFile = _newFotoFile;
    if (selectedFile == null || _userId <= 0) return true;
    if (!selectedFile.existsSync()) {
      _showSnack(
        'File foto tidak ditemukan. Pilih ulang foto profil.',
        isError: true,
      );
      return false;
    }

    setState(() => _isUploadingPhoto = true);
    try {
      final result = await ApiService.uploadFotoProfil(
        _userId,
        selectedFile.path,
      );
      final fotoUrl =
          result['foto_url']?.toString() ??
          result['url']?.toString() ??
          result['path']?.toString();
      if (fotoUrl == null || fotoUrl.isEmpty) {
        throw Exception('Server tidak mengirim URL foto profil');
      }

      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('user_foto_url', fotoUrl);

      if (!mounted) return true;
      setState(() {
        _fotoUrl = fotoUrl;
        _hasPendingPhotoUpload = false;
      });

      if (showSuccessSnack) {
        _showSnack('Foto berhasil diperbarui');
      }
      return true;
    } catch (e) {
      if (mounted) {
        setState(() => _hasPendingPhotoUpload = true);
        _showSnack(
          'Foto sudah dipilih, tapi belum tersimpan ke server. Tekan Simpan Profil untuk mencoba lagi.',
          isError: true,
        );
      }
      return false;
    } finally {
      if (mounted) {
        setState(() => _isUploadingPhoto = false);
      }
    }
  }

  Future<void> _handleSave() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isSaving = true);
    try {
      if (_hasPendingPhotoUpload) {
        final uploaded = await _uploadSelectedPhoto();
        if (!uploaded) {
          throw Exception('Foto profil belum berhasil diupload');
        }
      }

      final data = {
        'user_id': _userId,
        'name': _nameCtrl.text,
        'email': _emailCtrl.text,
        'nis': _nisCtrl.text,
        'nik_user': _nikCtrl.text,
        'no_hp': _noHpCtrl.text,
        'jenis_kelamin': _jk == 'Laki-laki' ? 'L' : 'P',
      };
      await ApiService.updateProfile(data);

      // Update SharedPreferences for local display
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('user_name', _nameCtrl.text);
      await prefs.setString('user_email', _emailCtrl.text);

      if (mounted) {
        _showSnack('Profil berhasil diperbarui');
        Navigator.pop(context, true);
      }
    } catch (e) {
      if (mounted) {
        _showSnack('Gagal menyimpan: $e', isError: true);
      }
    }
    if (mounted) setState(() => _isSaving = false);
  }

  void _showSnack(String message, {bool isError = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: isError
            ? const Color(0xFFE65100)
            : const Color(0xFF138F81),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }

  Widget _buildSourceOption(
    IconData icon,
    String label,
    VoidCallback onTap, {
    Color color = const Color(0xFF138F81),
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        children: [
          Container(
            width: 60,
            height: 60,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Icon(icon, color: color, size: 28),
          ),
          const SizedBox(height: 6),
          Text(
            label,
            style: GoogleFonts.poppins(
              fontSize: 12,
              color: const Color(0xFF636E72),
            ),
          ),
        ],
      ),
    );
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
                  ? const Center(
                      child: CircularProgressIndicator(
                        color: Color(0xFF138F81),
                      ),
                    )
                  : Container(
                      margin: const EdgeInsets.symmetric(horizontal: 16),
                      decoration: BoxDecoration(
                        color: const Color(0xFFE1EFF7),
                        borderRadius: BorderRadius.circular(30),
                      ),
                      child: Form(
                        key: _formKey,
                        child: ListView(
                          physics: const BouncingScrollPhysics(),
                          padding: const EdgeInsets.all(16),
                          children: [
                            // Foto profil
                            Center(child: _buildPhotoWidget()),
                            const SizedBox(height: 20),

                            // Role badge
                            Center(
                              child: Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 16,
                                  vertical: 6,
                                ),
                                decoration: BoxDecoration(
                                  gradient: const LinearGradient(
                                    colors: [
                                      Color(0xFF138F81),
                                      Color(0xFF1BA897),
                                    ],
                                  ),
                                  borderRadius: BorderRadius.circular(20),
                                ),
                                child: Text(
                                  _role.toUpperCase(),
                                  style: GoogleFonts.poppins(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w700,
                                    color: Colors.white,
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(height: 20),

                            _buildField(
                              'Nama Lengkap',
                              _nameCtrl,
                              Icons.person_rounded,
                            ),
                            _buildField(
                              'Email',
                              _emailCtrl,
                              Icons.email_rounded,
                              keyboardType: TextInputType.emailAddress,
                            ),
                            _buildField('NIS', _nisCtrl, Icons.badge_rounded),
                            _buildField(
                              'NIK',
                              _nikCtrl,
                              Icons.credit_card_rounded,
                            ),
                            _buildField(
                              'No. HP / WhatsApp',
                              _noHpCtrl,
                              Icons.phone_rounded,
                              keyboardType: TextInputType.phone,
                            ),
                            _buildDropdown(),
                            const SizedBox(height: 20),

                            SizedBox(
                              width: double.infinity,
                              height: 50,
                              child: ElevatedButton(
                                onPressed: _isSaving ? null : _handleSave,
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: const Color(0xFF138F81),
                                  foregroundColor: Colors.white,
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(18),
                                  ),
                                  elevation: 3,
                                ),
                                child: _isSaving
                                    ? const SizedBox(
                                        width: 20,
                                        height: 20,
                                        child: CircularProgressIndicator(
                                          color: Colors.white,
                                          strokeWidth: 2,
                                        ),
                                      )
                                    : Text(
                                        'Simpan Profil',
                                        style: GoogleFonts.poppins(
                                          fontSize: 16,
                                          fontWeight: FontWeight.w700,
                                        ),
                                      ),
                              ),
                            ),
                            const SizedBox(height: 16),
                          ],
                        ),
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
              width: 46,
              height: 46,
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF138F81), Color(0xFF1BA897)],
                ),
                borderRadius: BorderRadius.circular(14),
              ),
              child: const Icon(
                Icons.person_rounded,
                color: Colors.white,
                size: 24,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Kelola Profil',
                    style: GoogleFonts.poppins(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: const Color(0xFF2D3436),
                    ),
                  ),
                  Text(
                    'Edit informasi akun Anda',
                    style: GoogleFonts.poppins(
                      fontSize: 11,
                      color: const Color(0xFF636E72),
                    ),
                  ),
                ],
              ),
            ),
            IconButton(
              onPressed: () => Navigator.pop(context),
              icon: const Icon(
                Icons.close_rounded,
                size: 22,
                color: Color(0xFF636E72),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPhotoWidget() {
    final fotoUrl = _resolveFotoUrl(_fotoUrl);

    return GestureDetector(
      onTap: _pickPhoto,
      child: Stack(
        alignment: Alignment.bottomRight,
        children: [
          Container(
            width: 100,
            height: 100,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: const Color(0xFF138F81).withValues(alpha: 0.15),
              border: Border.all(color: const Color(0xFF138F81), width: 2),
              image: _newFotoFile != null
                  ? DecorationImage(
                      image: FileImage(_newFotoFile!),
                      fit: BoxFit.cover,
                    )
                  : fotoUrl != null
                  ? DecorationImage(
                      image: NetworkImage(fotoUrl),
                      fit: BoxFit.cover,
                    )
                  : null,
            ),
            child: _newFotoFile == null && _fotoUrl == null
                ? const Icon(
                    Icons.person_rounded,
                    size: 48,
                    color: Color(0xFF138F81),
                  )
                : _isUploadingPhoto
                ? Container(
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.28),
                      shape: BoxShape.circle,
                    ),
                    child: const Center(
                      child: CircularProgressIndicator(
                        color: Colors.white,
                        strokeWidth: 2,
                      ),
                    ),
                  )
                : null,
          ),
          if (_hasPendingPhotoUpload && !_isUploadingPhoto)
            Positioned(
              left: 0,
              bottom: 0,
              child: Container(
                width: 28,
                height: 28,
                decoration: BoxDecoration(
                  color: const Color(0xFFE65100),
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.white, width: 2),
                ),
                child: const Icon(
                  Icons.sync_problem_rounded,
                  color: Colors.white,
                  size: 14,
                ),
              ),
            ),
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: const Color(0xFF138F81),
              shape: BoxShape.circle,
              border: Border.all(color: Colors.white, width: 2),
            ),
            child: const Icon(
              Icons.camera_alt_rounded,
              color: Colors.white,
              size: 16,
            ),
          ),
        ],
      ),
    );
  }

  String? _resolveFotoUrl(String? value) {
    if (value == null || value.isEmpty) return null;
    if (value.startsWith('http://') || value.startsWith('https://')) {
      return value;
    }
    return '${ApiService.baseUrl.replaceAll('/api', '')}/storage/$value';
  }

  Widget _buildField(
    String label,
    TextEditingController ctrl,
    IconData icon, {
    TextInputType? keyboardType,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: GoogleFonts.poppins(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: const Color(0xFF636E72),
            ),
          ),
          const SizedBox(height: 4),
          TextFormField(
            controller: ctrl,
            keyboardType: keyboardType,
            style: GoogleFonts.poppins(
              fontSize: 13,
              color: const Color(0xFF2D3436),
            ),
            decoration: InputDecoration(
              isDense: true,
              prefixIcon: Icon(icon, size: 18, color: const Color(0xFF138F81)),
              contentPadding: const EdgeInsets.symmetric(
                horizontal: 12,
                vertical: 12,
              ),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0xFFDFE6E9)),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0xFFDFE6E9)),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(
                  color: Color(0xFF138F81),
                  width: 1.5,
                ),
              ),
              filled: true,
              fillColor: Colors.white,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDropdown() {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Jenis Kelamin',
            style: GoogleFonts.poppins(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: const Color(0xFF636E72),
            ),
          ),
          const SizedBox(height: 4),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFDFE6E9)),
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                isExpanded: true,
                value: _jk,
                items: ['Laki-laki', 'Perempuan']
                    .map(
                      (o) => DropdownMenuItem(
                        value: o,
                        child: Text(
                          o,
                          style: GoogleFonts.poppins(fontSize: 13),
                        ),
                      ),
                    )
                    .toList(),
                onChanged: (v) => setState(() => _jk = v!),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
