import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../services/api_service.dart';
import '../../services/session_service.dart';

class DokumenNilaiSettingsScreen extends StatefulWidget {
  const DokumenNilaiSettingsScreen({super.key});

  @override
  State<DokumenNilaiSettingsScreen> createState() =>
      _DokumenNilaiSettingsScreenState();
}

class _DokumenNilaiSettingsScreenState
    extends State<DokumenNilaiSettingsScreen> {
  final _kepalaCtrl = TextEditingController();
  final _jabatanCtrl = TextEditingController();
  final _adminNameCtrl = TextEditingController();
  final _adminTitleCtrl = TextEditingController();

  bool _isLoading = true;
  bool _isSaving = false;
  int _userId = 0;
  String _signatureMode = 'kosong';
  String? _signatureUrl;
  String? _documentLogoUrl;
  String _paymentSignatureMode = 'kosong';
  String? _paymentSignatureUrl;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _kepalaCtrl.dispose();
    _jabatanCtrl.dispose();
    _adminNameCtrl.dispose();
    _adminTitleCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _isLoading = true);
    try {
      final userId = await SessionService.getUserId();
      final result = await ApiService.getDocumentSettings();
      final data = Map<String, dynamic>.from(result['data'] ?? const {});

      if (!mounted) return;
      setState(() {
        _userId = userId;
        _kepalaCtrl.text = data['kepala_madin_nama']?.toString() ?? '';
        _jabatanCtrl.text = data['jabatan']?.toString() ?? '';
        _signatureMode = data['signature_mode']?.toString() ?? 'kosong';
        _signatureUrl = data['signature_url']?.toString();
        _documentLogoUrl = data['document_logo_url']?.toString();
        _adminNameCtrl.text =
            data['payment_admin_name']?.toString() ??
            data['pembayaran']?['admin_name']?.toString() ??
            '';
        _adminTitleCtrl.text =
            data['payment_admin_title']?.toString() ??
            data['pembayaran']?['admin_title']?.toString() ??
            '';
        _paymentSignatureMode =
            data['payment_signature_mode']?.toString() ??
            data['pembayaran']?['signature_mode']?.toString() ??
            'kosong';
        _paymentSignatureUrl =
            data['payment_signature_url']?.toString() ??
            data['pembayaran']?['signature_url']?.toString();
        _isLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _isLoading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Gagal memuat pengaturan dokumen'),
          backgroundColor: const Color(0xFFD63031),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
        ),
      );
    }
  }

  Future<void> _save() async {
    if (_kepalaCtrl.text.trim().isEmpty ||
        _jabatanCtrl.text.trim().isEmpty ||
        _adminNameCtrl.text.trim().isEmpty ||
        _adminTitleCtrl.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text(
            'Nama penandatangan dokumen nilai dan pembayaran wajib diisi',
          ),
          backgroundColor: const Color(0xFFD63031),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
        ),
      );
      return;
    }

    setState(() => _isSaving = true);
    try {
      await ApiService.updateDocumentSettings(_userId, {
        'kepala_madin_nama': _kepalaCtrl.text.trim(),
        'jabatan': _jabatanCtrl.text.trim(),
        'signature_mode': _signatureMode,
      });
      await ApiService.updateDocumentSettings(_userId, {
        'payment_admin_name': _adminNameCtrl.text.trim(),
        'payment_admin_title': _adminTitleCtrl.text.trim(),
        'payment_signature_mode': _paymentSignatureMode,
      }, documentType: 'pembayaran');

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('Pengaturan dokumen berhasil disimpan'),
          backgroundColor: const Color(0xFF138F81),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
        ),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('Gagal menyimpan pengaturan dokumen'),
          backgroundColor: const Color(0xFFD63031),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
        ),
      );
    } finally {
      if (mounted) {
        setState(() => _isSaving = false);
      }
    }
  }

  Future<void> _pickSignature(String documentType) async {
    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['png'],
      );

      final path = result?.files.single.path;
      if (path == null) return;

      setState(() => _isSaving = true);
      final response = await ApiService.uploadDocumentSignature(
        _userId,
        path,
        documentType: documentType,
      );
      final data = Map<String, dynamic>.from(response['data'] ?? const {});

      if (!mounted) return;
      setState(() {
        if (documentType == 'pembayaran') {
          _paymentSignatureMode =
              data['payment_signature_mode']?.toString() ??
              data['pembayaran']?['signature_mode']?.toString() ??
              'uploaded';
          _paymentSignatureUrl =
              data['payment_signature_url']?.toString() ??
              data['pembayaran']?['signature_url']?.toString();
        } else {
          _signatureMode = data['signature_mode']?.toString() ?? 'uploaded';
          _signatureUrl = data['signature_url']?.toString();
        }
      });

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('Tanda tangan digital berhasil diupload'),
          backgroundColor: const Color(0xFF138F81),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
        ),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('Upload tanda tangan gagal'),
          backgroundColor: const Color(0xFFD63031),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
        ),
      );
    } finally {
      if (mounted) {
        setState(() => _isSaving = false);
      }
    }
  }

  Future<void> _pickLogo() async {
    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['png', 'jpg', 'jpeg'],
      );

      final path = result?.files.single.path;
      if (path == null) return;

      setState(() => _isSaving = true);
      final response = await ApiService.uploadDocumentLogo(_userId, path);
      final data = Map<String, dynamic>.from(response['data'] ?? const {});

      if (!mounted) return;
      setState(() {
        _documentLogoUrl = data['document_logo_url']?.toString();
      });

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('Logo dokumen berhasil diupload'),
          backgroundColor: const Color(0xFF138F81),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
        ),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('Upload logo dokumen gagal'),
          backgroundColor: const Color(0xFFD63031),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
        ),
      );
    } finally {
      if (mounted) {
        setState(() => _isSaving = false);
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
            _buildHeader(),
            const SizedBox(height: 10),
            Expanded(
              child: _isLoading
                  ? const Center(
                      child: CircularProgressIndicator(
                        color: Color(0xFF138F81),
                      ),
                    )
                  : Container(
                      margin: const EdgeInsets.symmetric(horizontal: 16),
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: const Color(0xFFE1EFF7),
                        borderRadius: BorderRadius.circular(30),
                      ),
                      child: ListView(
                        physics: const BouncingScrollPhysics(),
                        children: [
                          _buildSectionCard(
                            title: 'Logo Dokumen',
                            subtitle:
                                'Logo ini otomatis dipakai di seluruh PDF resmi',
                            accent: const Color(0xFFE65100),
                            children: [_buildLogoCard()],
                          ),
                          const SizedBox(height: 20),
                          _buildSectionCard(
                            title: 'Dokumen Nilai',
                            subtitle:
                                'Pengaturan penandatangan untuk PDF nilai rapor dan hafalan',
                            accent: const Color(0xFF6C5CE7),
                            children: [
                              _buildField(
                                'Nama Kepala Madin',
                                _kepalaCtrl,
                                Icons.person_rounded,
                              ),
                              const SizedBox(height: 14),
                              _buildField(
                                'Jabatan',
                                _jabatanCtrl,
                                Icons.badge_rounded,
                              ),
                              const SizedBox(height: 18),
                              _buildSignatureMode(
                                title: 'Mode Tanda Tangan Nilai',
                                value: _signatureMode,
                                onChanged: (value) =>
                                    setState(() => _signatureMode = value),
                              ),
                              const SizedBox(height: 14),
                              _buildSignatureCard(
                                title: 'Tanda Tangan Digital Nilai',
                                signatureMode: _signatureMode,
                                signatureUrl: _signatureUrl,
                                onUpload: () => _pickSignature('nilai'),
                              ),
                            ],
                          ),
                          const SizedBox(height: 20),
                          _buildSectionCard(
                            title: 'Dokumen Pembayaran',
                            subtitle:
                                'Pengaturan petugas administrasi untuk PDF rekap pembayaran',
                            accent: const Color(0xFF138F81),
                            children: [
                              _buildField(
                                'Nama Petugas Administrasi',
                                _adminNameCtrl,
                                Icons.manage_accounts_rounded,
                              ),
                              const SizedBox(height: 14),
                              _buildField(
                                'Jabatan / Label Penandatangan',
                                _adminTitleCtrl,
                                Icons.assignment_ind_rounded,
                              ),
                              const SizedBox(height: 18),
                              _buildSignatureMode(
                                title: 'Mode Tanda Tangan Pembayaran',
                                value: _paymentSignatureMode,
                                onChanged: (value) => setState(
                                  () => _paymentSignatureMode = value,
                                ),
                              ),
                              const SizedBox(height: 14),
                              _buildSignatureCard(
                                title: 'Tanda Tangan Digital Pembayaran',
                                signatureMode: _paymentSignatureMode,
                                signatureUrl: _paymentSignatureUrl,
                                onUpload: () => _pickSignature('pembayaran'),
                              ),
                            ],
                          ),
                          const SizedBox(height: 20),
                          _buildGuideCard(),
                          const SizedBox(height: 24),
                          SizedBox(
                            height: 48,
                            child: ElevatedButton(
                              onPressed: _isSaving ? null : _save,
                              style: ElevatedButton.styleFrom(
                                backgroundColor: const Color(0xFF138F81),
                                foregroundColor: Colors.white,
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(16),
                                ),
                                elevation: 0,
                              ),
                              child: Text(
                                _isSaving
                                    ? 'Menyimpan...'
                                    : 'Simpan Pengaturan',
                                style: GoogleFonts.poppins(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
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
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(14),
                gradient: const LinearGradient(
                  colors: [Color(0xFF6C5CE7), Color(0xFFA29BFE)],
                ),
              ),
              child: const Icon(
                Icons.description_rounded,
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
                    'Dokumen Resmi',
                    style: GoogleFonts.poppins(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: const Color(0xFF2D3436),
                    ),
                  ),
                  Text(
                    'Atur logo dan penandatangan dokumen resmi',
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
              icon: const Icon(Icons.close_rounded, size: 22),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildField(
    String label,
    TextEditingController controller,
    IconData icon,
  ) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: GoogleFonts.poppins(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: const Color(0xFF636E72),
          ),
        ),
        const SizedBox(height: 6),
        TextField(
          controller: controller,
          decoration: InputDecoration(
            prefixIcon: Icon(icon, size: 20, color: const Color(0xFF138F81)),
            filled: true,
            fillColor: Colors.white,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(16),
              borderSide: BorderSide.none,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildSectionCard({
    required String title,
    required String subtitle,
    required Color accent,
    required List<Widget> children,
  }) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: accent.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(Icons.description_rounded, color: accent, size: 20),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: GoogleFonts.poppins(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: const Color(0xFF2D3436),
                      ),
                    ),
                    Text(
                      subtitle,
                      style: GoogleFonts.poppins(
                        fontSize: 11,
                        color: const Color(0xFF636E72),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          ...children,
        ],
      ),
    );
  }

  Widget _buildSignatureMode({
    required String title,
    required String value,
    required ValueChanged<String> onChanged,
  }) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FBFF),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: GoogleFonts.poppins(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: const Color(0xFF2D3436),
            ),
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              _buildModeChip(
                chipValue: 'kosong',
                label: 'Kosong / manual',
                value: value,
                onChanged: onChanged,
              ),
              _buildModeChip(
                chipValue: 'uploaded',
                label: 'Upload digital PNG',
                value: value,
                onChanged: onChanged,
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildModeChip({
    required String chipValue,
    required String label,
    required String value,
    required ValueChanged<String> onChanged,
  }) {
    final selected = value == chipValue;
    return GestureDetector(
      onTap: () => onChanged(chipValue),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: selected ? const Color(0xFF138F81) : const Color(0xFFE1EFF7),
          borderRadius: BorderRadius.circular(14),
        ),
        child: Text(
          label,
          style: GoogleFonts.poppins(
            fontSize: 12,
            fontWeight: FontWeight.w700,
            color: selected ? Colors.white : const Color(0xFF138F81),
          ),
        ),
      ),
    );
  }

  Widget _buildLogoCard() {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FBFF),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  'Logo PDF Resmi',
                  style: GoogleFonts.poppins(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: const Color(0xFF2D3436),
                  ),
                ),
              ),
              TextButton.icon(
                onPressed: _isSaving ? null : _pickLogo,
                icon: const Icon(Icons.upload_file_rounded, size: 18),
                label: const Text('Upload Logo'),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Container(
            width: double.infinity,
            height: 120,
            decoration: BoxDecoration(
              color: const Color(0xFFF8FBFF),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFDCE7EF)),
            ),
            child: _documentLogoUrl != null && _documentLogoUrl!.isNotEmpty
                ? ClipRRect(
                    borderRadius: BorderRadius.circular(16),
                    child: Image.network(
                      _documentLogoUrl!,
                      fit: BoxFit.contain,
                    ),
                  )
                : Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Image.asset(
                        'assets/images/Logo_Qomaruddin.png',
                        width: 58,
                        height: 58,
                        fit: BoxFit.contain,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Memakai logo default aplikasi',
                        style: GoogleFonts.poppins(
                          fontSize: 11,
                          color: const Color(0xFF636E72),
                        ),
                      ),
                    ],
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildSignatureCard({
    required String title,
    required String signatureMode,
    required String? signatureUrl,
    required VoidCallback onUpload,
  }) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FBFF),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  title,
                  style: GoogleFonts.poppins(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: const Color(0xFF2D3436),
                  ),
                ),
              ),
              TextButton.icon(
                onPressed: _isSaving ? null : onUpload,
                icon: const Icon(Icons.upload_file_rounded, size: 18),
                label: const Text('Upload PNG'),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Container(
            width: double.infinity,
            height: 120,
            decoration: BoxDecoration(
              color: const Color(0xFFF8FBFF),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFDCE7EF)),
            ),
            child: signatureMode == 'uploaded' && signatureUrl != null
                ? ClipRRect(
                    borderRadius: BorderRadius.circular(16),
                    child: Image.network(signatureUrl, fit: BoxFit.contain),
                  )
                : Center(
                    child: Text(
                      'Tanda tangan dibiarkan kosong\nagar bisa ditandatangani manual',
                      textAlign: TextAlign.center,
                      style: GoogleFonts.poppins(
                        fontSize: 11,
                        color: const Color(0xFF636E72),
                      ),
                    ),
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildGuideCard() {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Panduan Upload Dokumen',
            style: GoogleFonts.poppins(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: const Color(0xFF2D3436),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Logo dapat memakai PNG/JPG. Tanda tangan tetap memakai PNG, dan background transparan lebih disarankan agar hasil dokumen terlihat rapi, formal, dan siap dipakai resmi.',
            style: GoogleFonts.poppins(
              fontSize: 11,
              color: const Color(0xFF636E72),
            ),
          ),
        ],
      ),
    );
  }
}
