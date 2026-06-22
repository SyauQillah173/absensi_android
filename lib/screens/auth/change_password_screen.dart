import 'package:flutter/material.dart';

import '../../services/api_service.dart';
import '../../services/session_service.dart';

class ChangePasswordScreen extends StatefulWidget {
  final bool forced;
  final String? initialIdentifier;
  final String? initialCurrentPassword;

  const ChangePasswordScreen({
    super.key,
    this.forced = false,
    this.initialIdentifier,
    this.initialCurrentPassword,
  });

  @override
  State<ChangePasswordScreen> createState() => _ChangePasswordScreenState();
}

class _ChangePasswordScreenState extends State<ChangePasswordScreen> {
  final _identifierController = TextEditingController();
  final _currentPasswordController = TextEditingController();
  final _newPasswordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();

  bool _isSaving = false;
  bool _showCurrent = false;
  bool _showNew = false;
  bool _showConfirm = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _identifierController.text = widget.initialIdentifier ?? '';
    _currentPasswordController.text = widget.initialCurrentPassword ?? '';
  }

  @override
  void dispose() {
    _identifierController.dispose();
    _currentPasswordController.dispose();
    _newPasswordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  Future<void> _handleSubmit() async {
    final identifier = _identifierController.text.trim();
    final currentPassword = _currentPasswordController.text.trim();
    final newPassword = _newPasswordController.text.trim();
    final confirmPassword = _confirmPasswordController.text.trim();

    if (identifier.isEmpty ||
        currentPassword.isEmpty ||
        newPassword.isEmpty ||
        confirmPassword.isEmpty) {
      setState(() {
        _errorMessage = 'Semua field wajib diisi.';
      });
      return;
    }

    if (newPassword.length < 6) {
      setState(() {
        _errorMessage = 'Password baru minimal 6 karakter.';
      });
      return;
    }

    if (newPassword != confirmPassword) {
      setState(() {
        _errorMessage = 'Konfirmasi password baru tidak cocok.';
      });
      return;
    }

    setState(() {
      _isSaving = true;
      _errorMessage = null;
    });

    try {
      final result = await ApiService.changePassword(
        identifier: identifier,
        currentPassword: currentPassword,
        newPassword: newPassword,
        confirmPassword: confirmPassword,
      );

      final userData = Map<String, dynamic>.from(result['data'] ?? const {});
      if (userData.isNotEmpty) {
        userData['must_change_password'] = false;
        await SessionService.upsertOfflineAccount(
          identifier: identifier,
          password: newPassword,
          userData: userData,
        );
        await SessionService.updateOfflineAccountPassword(
          identifier: identifier,
          oldPassword: currentPassword,
          newPassword: newPassword,
        );
      }
      await SessionService.setMustChangePassword(false);

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            result['message']?.toString() ?? 'Password berhasil diperbarui',
          ),
          backgroundColor: const Color(0xFF138F81),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
        ),
      );
      if (widget.forced) {
        await SessionService.clearSession();
        if (!mounted) return;
        Navigator.pushNamedAndRemoveUntil(context, '/login', (_) => false);
      } else {
        Navigator.pop(context, {
          'identifier': identifier,
          'password': newPassword,
        });
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _errorMessage = e.toString();
      });
    } finally {
      if (mounted) {
        setState(() {
          _isSaving = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: !widget.forced,
      child: Scaffold(
        backgroundColor: const Color(0xFFFFDC80),
        body: SafeArea(
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 12,
                  ),
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
                          color: const Color(
                            0xFF138F81,
                          ).withValues(alpha: 0.15),
                        ),
                        child: const Icon(
                          Icons.lock_reset_rounded,
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
                              widget.forced
                                  ? 'Wajib Ganti Password'
                                  : 'Ganti Password',
                              style: const TextStyle(
                                fontSize: 17,
                                fontWeight: FontWeight.w700,
                                color: Color(0xFF2D3436),
                              ),
                            ),
                            Text(
                              widget.forced
                                  ? 'Khusus guru/wali pada login pertama'
                                  : 'Berlaku untuk Guru dan Orang Tua',
                              style: const TextStyle(
                                fontSize: 11,
                                color: Color(0xFF636E72),
                              ),
                            ),
                          ],
                        ),
                      ),
                      if (!widget.forced)
                        IconButton(
                          onPressed: () => Navigator.pop(context),
                          icon: const Icon(
                            Icons.arrow_back_ios_rounded,
                            size: 20,
                          ),
                        ),
                    ],
                  ),
                ),
              ),
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(16),
                  child: Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: const Color(0xFFE1EFF7),
                      borderRadius: BorderRadius.circular(36),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          widget.forced
                              ? 'Guru/wali wajib mengganti password default, lalu login ulang dengan password baru.'
                              : 'Verifikasi akun Anda dengan identitas login dan password lama/default, lalu masukkan password baru.',
                          style: const TextStyle(
                            fontSize: 12,
                            color: Color(0xFF636E72),
                            height: 1.5,
                          ),
                        ),
                        const SizedBox(height: 18),
                        if (_errorMessage != null) ...[
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: const Color(0xFFFFF3E0),
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(
                                color: const Color(0xFFFFB74D),
                              ),
                            ),
                            child: Text(
                              _errorMessage!,
                              style: const TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: Color(0xFFE65100),
                              ),
                            ),
                          ),
                          const SizedBox(height: 14),
                        ],
                        _buildInput(
                          controller: _identifierController,
                          label: 'Username / Email / NIS / NISN',
                          icon: Icons.person_rounded,
                        ),
                        const SizedBox(height: 12),
                        _buildInput(
                          controller: _currentPasswordController,
                          label: 'Password Lama / Password Default',
                          icon: Icons.lock_outline_rounded,
                          obscureText: !_showCurrent,
                          onToggle: () =>
                              setState(() => _showCurrent = !_showCurrent),
                        ),
                        const SizedBox(height: 12),
                        _buildInput(
                          controller: _newPasswordController,
                          label: 'Password Baru',
                          icon: Icons.lock_reset_rounded,
                          obscureText: !_showNew,
                          onToggle: () => setState(() => _showNew = !_showNew),
                        ),
                        const SizedBox(height: 12),
                        _buildInput(
                          controller: _confirmPasswordController,
                          label: 'Konfirmasi Password Baru',
                          icon: Icons.verified_user_rounded,
                          obscureText: !_showConfirm,
                          onToggle: () =>
                              setState(() => _showConfirm = !_showConfirm),
                        ),
                        const SizedBox(height: 18),
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: const Color(
                              0xFF138F81,
                            ).withValues(alpha: 0.08),
                            borderRadius: BorderRadius.circular(16),
                          ),
                          child: const Text(
                            'Catatan: perubahan password butuh koneksi internet karena harus langsung disimpan ke server utama. Setelah berhasil, password baru juga akan dipakai untuk login offline di perangkat ini.',
                            style: TextStyle(
                              fontSize: 11,
                              color: Color(0xFF138F81),
                              height: 1.5,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                        const SizedBox(height: 18),
                        SizedBox(
                          width: double.infinity,
                          child: ElevatedButton(
                            onPressed: _isSaving ? null : _handleSubmit,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF138F81),
                              foregroundColor: Colors.white,
                              disabledBackgroundColor: const Color(
                                0xFF138F81,
                              ).withValues(alpha: 0.45),
                              padding: const EdgeInsets.symmetric(vertical: 16),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(18),
                              ),
                            ),
                            child: _isSaving
                                ? const SizedBox(
                                    width: 20,
                                    height: 20,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      color: Colors.white,
                                    ),
                                  )
                                : const Text(
                                    'Simpan Password Baru',
                                    style: TextStyle(
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
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildInput({
    required TextEditingController controller,
    required String label,
    required IconData icon,
    bool obscureText = false,
    VoidCallback? onToggle,
  }) {
    return TextField(
      controller: controller,
      obscureText: obscureText,
      decoration: InputDecoration(
        labelText: label,
        prefixIcon: Icon(icon, color: const Color(0xFF138F81), size: 20),
        suffixIcon: onToggle == null
            ? null
            : IconButton(
                onPressed: onToggle,
                icon: Icon(
                  obscureText
                      ? Icons.visibility_off_rounded
                      : Icons.visibility_rounded,
                  size: 20,
                  color: const Color(0xFF636E72),
                ),
              ),
        filled: true,
        fillColor: Colors.white,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(18),
          borderSide: BorderSide.none,
        ),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 16,
          vertical: 15,
        ),
      ),
    );
  }
}
