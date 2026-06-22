import 'package:flutter/material.dart';

import '../../services/api_service.dart';
import '../../services/payment_security_service.dart';
import '../../services/session_service.dart';

class PaymentSecuritySettingsScreen extends StatefulWidget {
  const PaymentSecuritySettingsScreen({super.key});

  @override
  State<PaymentSecuritySettingsScreen> createState() =>
      _PaymentSecuritySettingsScreenState();
}

class _PaymentSecuritySettingsScreenState
    extends State<PaymentSecuritySettingsScreen>
    with WidgetsBindingObserver {
  bool _isLoading = true;
  bool _isSaving = false;
  bool _isAdmin = false;
  int _userId = 0;
  String _userRole = '';
  bool _faceEnabled = false;
  bool _fingerprintEnabled = false;
  bool _pinEnabled = false;
  String _mode = 'face_only';
  String? _faceRegisteredAt;
  String? _fingerprintRegisteredAt;
  String? _pinSetAt;
  String? _lastVerifiedAt;
  String? _lastVerificationMethod;
  String? _lastDeviceLabel;
  String? _pendingEnrollmentType;
  DateTime? _lastActivationVerifiedAt;
  Map<String, dynamic> _capabilities = const {};

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _loadData();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && _pendingEnrollmentType != null) {
      _completePendingEnrollmentCheck();
    }
  }

  Future<void> _loadData() async {
    final userId = await SessionService.getUserId();
    final userRole = await SessionService.getUserRole();
    final capabilities = await PaymentSecurityService.getCapabilities();

    if (!mounted) return;

    if (userRole != 'admin') {
      setState(() {
        _userId = userId;
        _userRole = userRole;
        _capabilities = capabilities;
        _isAdmin = false;
        _isLoading = false;
      });
      return;
    }

    try {
      final result = await ApiService.getPaymentSecuritySettings(userId);
      final data = Map<String, dynamic>.from(result['data'] ?? const {});
      await PaymentSecurityService.cacheSetting(userId, data);
      if (!mounted) return;
      _applySettingState(
        userId: userId,
        userRole: userRole,
        capabilities: capabilities,
        data: data,
      );
    } catch (_) {
      final cached = await PaymentSecurityService.getCachedSetting(userId);
      if (!mounted) return;
      _applySettingState(
        userId: userId,
        userRole: userRole,
        capabilities: capabilities,
        data: cached ?? const {},
      );
    }
  }

  void _applySettingState({
    required int userId,
    required String userRole,
    required Map<String, dynamic> capabilities,
    required Map<String, dynamic> data,
  }) {
    final faceAvailableOnThisDevice = capabilities['has_face'] == true;
    final fingerprintAvailableOnThisDevice =
        capabilities['has_fingerprint'] == true;
    final safeFaceEnabled =
        data['face_enabled'] == true && faceAvailableOnThisDevice;
    final safeFingerprintEnabled =
        data['fingerprint_enabled'] == true && fingerprintAvailableOnThisDevice;
    final safeMode = _resolveSafeMode(
      data['verification_mode']?.toString(),
      faceEnabled: safeFaceEnabled,
      fingerprintEnabled: safeFingerprintEnabled,
    );

    setState(() {
      _userId = userId;
      _userRole = userRole;
      _capabilities = capabilities;
      _isAdmin = true;
      _faceEnabled = safeFaceEnabled;
      _fingerprintEnabled = safeFingerprintEnabled;
      _pinEnabled = data['pin_enabled'] == true;
      _mode = safeMode;
      _faceRegisteredAt = safeFaceEnabled
          ? data['face_registered_at']?.toString()
          : null;
      _fingerprintRegisteredAt = safeFingerprintEnabled
          ? data['fingerprint_registered_at']?.toString()
          : null;
      _pinSetAt = data['pin_set_at']?.toString();
      _lastVerifiedAt = data['last_verified_at']?.toString();
      _lastVerificationMethod = data['last_verification_method']?.toString();
      _lastDeviceLabel = data['last_device_label']?.toString();
      _isLoading = false;
      _isSaving = false;
    });
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

  bool get _deviceSupportsBiometric {
    return _capabilities['device_supported'] == true ||
        _capabilities['can_authenticate'] == true;
  }

  bool get _deviceHasPrimaryBiometric {
    return _capabilities['has_face'] == true;
  }

  bool get _deviceHasFingerprint {
    return _capabilities['has_fingerprint'] == true;
  }

  bool get _androidHasGenericBiometricOnly {
    return _capabilities['android_generic_biometric_available'] == true &&
        _capabilities['has_face'] != true;
  }

  String get _primaryBiometricLabel {
    return 'Face ID / scan wajah';
  }

  String get _primaryBiometricAvailabilityLabel {
    if (!_deviceSupportsBiometric) {
      return 'Perangkat belum mendukung biometrik';
    }
    if (_deviceHasPrimaryBiometric) {
      return 'Tersedia dan ter-enroll di perangkat';
    }
    if (_androidHasGenericBiometricOnly) {
      return 'Face Unlock tidak dibuka Android untuk aplikasi ini';
    }
    return 'Belum ter-enroll di perangkat';
  }

  String get _faceUnavailableMessage {
    final reason = _capabilities['face_unavailable_reason']?.toString() ?? '';
    if (reason.isNotEmpty) return reason;
    if (_androidHasGenericBiometricOnly) {
      return 'Android/device ini hanya membuka biometrik umum atau fingerprint untuk aplikasi. Karena itu aplikasi tidak bisa memaksa kamera wajah sebagai Face ID.';
    }
    return 'Face ID / scan wajah belum tersedia untuk aplikasi ini.';
  }

  String get _fingerprintAvailabilityLabel {
    if (_capabilities['fingerprint_supported'] != true) {
      return 'Hardware fingerprint tidak terdeteksi';
    }
    if (_deviceHasFingerprint) {
      return 'Sidik jari ter-enroll di perangkat';
    }
    return 'Sidik jari belum ter-enroll di perangkat';
  }

  Future<void> _persistSetting({
    required bool faceEnabled,
    required bool fingerprintEnabled,
    required String mode,
    bool requireBiometricConfirmation = true,
  }) async {
    final hasFace = _deviceHasPrimaryBiometric;
    final hasFingerprint = _deviceHasFingerprint;

    if (!_isAdmin) {
      _showSnack(
        'Keamanan pembayaran hanya dapat diatur oleh akun admin.',
        isError: true,
      );
      return;
    }

    if (faceEnabled && !hasFace) {
      _showSnack(
        'Perangkat ini belum memiliki $_primaryBiometricLabel yang siap dipakai aplikasi.',
        isError: true,
      );
      return;
    }

    if (fingerprintEnabled && !hasFingerprint) {
      _showSnack(
        'Perangkat ini belum memiliki fingerprint yang terdaftar.',
        isError: true,
      );
      return;
    }

    final needsFreshConfirmation =
        requireBiometricConfirmation && !_hasRecentActivationVerification();

    if ((faceEnabled || fingerprintEnabled) && needsFreshConfirmation) {
      final verify = await PaymentSecurityService.confirmBiometricRegistration(
        reason:
            'Konfirmasi biometrik perangkat admin untuk mengaktifkan keamanan pembayaran.',
        method: _confirmationMethodFor(
          faceEnabled: faceEnabled,
          fingerprintEnabled: fingerprintEnabled,
          mode: mode,
        ),
      );
      if (verify['success'] != true) {
        _showSnack(
          verify['message']?.toString() ??
              'Verifikasi biometrik tidak berhasil.',
          isError: true,
        );
        return;
      }
    }

    setState(() => _isSaving = true);
    try {
      final safeMode = _resolveSafeMode(
        mode,
        faceEnabled: faceEnabled,
        fingerprintEnabled: fingerprintEnabled,
      );
      final result = await ApiService.updatePaymentSecuritySettings(_userId, {
        'face_enabled': faceEnabled,
        'fingerprint_enabled': fingerprintEnabled,
        'verification_mode': safeMode,
        'pin_enabled': _pinEnabled,
        'device_label': _capabilities['device_label'],
      });
      final data = Map<String, dynamic>.from(result['data'] ?? const {});
      await PaymentSecurityService.cacheSetting(_userId, data);
      if (!mounted) return;
      _showSnack(
        faceEnabled || fingerprintEnabled
            ? 'Keamanan pembayaran admin berhasil diperbarui.'
            : 'Keamanan pembayaran admin berhasil dinonaktifkan.',
      );
      Navigator.pop(context, data);
    } catch (e) {
      if (!mounted) return;
      setState(() => _isSaving = false);
      _showSnack('Gagal menyimpan keamanan pembayaran: $e', isError: true);
    }
  }

  Future<void> _save() async {
    await _persistSetting(
      faceEnabled: _faceEnabled,
      fingerprintEnabled: _fingerprintEnabled,
      mode: _resolveSafeMode(
        _mode,
        faceEnabled: _faceEnabled,
        fingerprintEnabled: _fingerprintEnabled,
      ),
    );
  }

  Future<void> _showPinSetupDialog() async {
    final pinController = TextEditingController();
    final confirmController = TextEditingController();
    try {
      final pin = await showDialog<String>(
        context: context,
        barrierDismissible: false,
        builder: (dialogContext) {
          return AlertDialog(
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(18),
            ),
            title: const Text(
              'Atur PIN Transaksi',
              style: TextStyle(fontWeight: FontWeight.w700),
            ),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'PIN ini khusus admin saat menyimpan pembayaran jika biometrik perangkat tidak tersedia. Gunakan 4-12 angka.',
                  style: TextStyle(
                    fontSize: 12,
                    color: Color(0xFF636E72),
                    height: 1.45,
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: pinController,
                  autofocus: true,
                  obscureText: true,
                  maxLength: 12,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(
                    hintText: 'PIN transaksi',
                    counterText: '',
                  ),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: confirmController,
                  obscureText: true,
                  maxLength: 12,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(
                    hintText: 'Ulangi PIN',
                    counterText: '',
                  ),
                  onSubmitted: (_) {
                    Navigator.pop(dialogContext, pinController.text);
                  },
                ),
              ],
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(dialogContext),
                child: const Text('Batal'),
              ),
              ElevatedButton(
                onPressed: () {
                  final pin = pinController.text.trim();
                  final confirm = confirmController.text.trim();
                  if (pin.length < 4 || pin != confirm) {
                    ScaffoldMessenger.of(dialogContext).showSnackBar(
                      const SnackBar(
                        content: Text(
                          'PIN minimal 4 angka dan konfirmasi harus sama.',
                        ),
                      ),
                    );
                    return;
                  }
                  Navigator.pop(dialogContext, pin);
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF138F81),
                  foregroundColor: Colors.white,
                ),
                child: const Text('Simpan PIN'),
              ),
            ],
          );
        },
      );

      if (pin == null || pin.trim().isEmpty) return;

      setState(() => _isSaving = true);
      final result = await ApiService.updatePaymentSecuritySettings(_userId, {
        'face_enabled': _faceEnabled,
        'fingerprint_enabled': _fingerprintEnabled,
        'verification_mode': _resolveSafeMode(
          _mode,
          faceEnabled: _faceEnabled,
          fingerprintEnabled: _fingerprintEnabled,
        ),
        'pin_enabled': true,
        'transaction_pin': pin.trim(),
        'device_label': _capabilities['device_label'],
      });
      final data = Map<String, dynamic>.from(result['data'] ?? const {});
      await PaymentSecurityService.cacheSetting(_userId, data);
      if (!mounted) return;
      _showSnack('PIN transaksi admin berhasil disimpan.');
      _applySettingState(
        userId: _userId,
        userRole: _userRole,
        capabilities: _capabilities,
        data: data,
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => _isSaving = false);
      _showSnack('Gagal menyimpan PIN transaksi: $e', isError: true);
    } finally {
      pinController.dispose();
      confirmController.dispose();
    }
  }

  Future<void> _disablePin() async {
    setState(() => _isSaving = true);
    try {
      final result = await ApiService.updatePaymentSecuritySettings(_userId, {
        'face_enabled': _faceEnabled,
        'fingerprint_enabled': _fingerprintEnabled,
        'verification_mode': _resolveSafeMode(
          _mode,
          faceEnabled: _faceEnabled,
          fingerprintEnabled: _fingerprintEnabled,
        ),
        'pin_enabled': false,
        'device_label': _capabilities['device_label'],
      });
      final data = Map<String, dynamic>.from(result['data'] ?? const {});
      await PaymentSecurityService.cacheSetting(_userId, data);
      if (!mounted) return;
      _showSnack('PIN transaksi admin dinonaktifkan.');
      _applySettingState(
        userId: _userId,
        userRole: _userRole,
        capabilities: _capabilities,
        data: data,
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => _isSaving = false);
      _showSnack('Gagal menonaktifkan PIN: $e', isError: true);
    }
  }

  String _resolveSafeMode(
    String? requested, {
    required bool faceEnabled,
    required bool fingerprintEnabled,
  }) {
    if (faceEnabled && fingerprintEnabled) {
      return 'face_or_fingerprint';
    }
    if (faceEnabled) return 'face_only';
    if (fingerprintEnabled) return 'fingerprint_only';
    return 'fingerprint_only';
  }

  String _confirmationMethodFor({
    required bool faceEnabled,
    required bool fingerprintEnabled,
    required String mode,
  }) {
    if (faceEnabled && !fingerprintEnabled) return 'face';
    if (fingerprintEnabled && !faceEnabled) return 'fingerprint';
    return 'biometric';
  }

  bool _hasRecentActivationVerification() {
    final verifiedAt = _lastActivationVerifiedAt;
    if (verifiedAt == null) return false;
    return DateTime.now().difference(verifiedAt) < const Duration(minutes: 2);
  }

  Future<void> _handleFaceToggle(bool value) async {
    if (!value) {
      setState(() {
        _faceEnabled = false;
        _mode = _resolveSafeMode(
          _mode,
          faceEnabled: false,
          fingerprintEnabled: _fingerprintEnabled,
        );
      });
      return;
    }

    await _activateBiometricMethod('face');
  }

  Future<void> _handleFingerprintToggle(bool value) async {
    if (!value) {
      setState(() {
        _fingerprintEnabled = false;
        _mode = _resolveSafeMode(
          _mode,
          faceEnabled: _faceEnabled,
          fingerprintEnabled: false,
        );
      });
      return;
    }

    await _activateBiometricMethod('fingerprint');
  }

  Future<void> _activateBiometricMethod(
    String type, {
    bool allowOpenSettings = true,
  }) async {
    if (_isSaving) return;

    final capabilities = await PaymentSecurityService.getCapabilities();
    if (!mounted) return;
    setState(() => _capabilities = capabilities);

    final readyKey = type == 'fingerprint' ? 'has_fingerprint' : 'has_face';
    final label = type == 'fingerprint'
        ? 'Fingerprint'
        : _primaryBiometricLabel;

    if (capabilities[readyKey] != true) {
      if (type == 'face' && _androidHasGenericBiometricOnly) {
        _showFaceUnavailableDialog();
        return;
      }
      if (allowOpenSettings) {
        await _showEnrollmentDialog(type, label);
      } else {
        _showSnack(
          '$label belum terdeteksi setelah kembali dari pengaturan perangkat. Pastikan biometrik sudah didaftarkan di sistem perangkat.',
          isError: true,
        );
      }
      return;
    }

    final verify = await PaymentSecurityService.confirmBiometricRegistration(
      reason: 'Konfirmasi $label untuk keamanan pembayaran admin.',
      method: type,
    );
    if (verify['success'] != true) {
      _showSnack(
        verify['message']?.toString() ?? 'Verifikasi $label tidak berhasil.',
        isError: true,
      );
      return;
    }

    if (!mounted) return;
    setState(() {
      if (type == 'fingerprint') {
        _fingerprintEnabled = true;
      } else {
        _faceEnabled = true;
      }
      _mode = _resolveSafeMode(
        _mode,
        faceEnabled: _faceEnabled,
        fingerprintEnabled: _fingerprintEnabled,
      );
      _lastActivationVerifiedAt = DateTime.now();
      _pendingEnrollmentType = null;
    });
    _showSnack(
      '$label berhasil diverifikasi. Tekan Simpan untuk menyimpan pengaturan admin.',
    );
  }

  Future<void> _showEnrollmentDialog(String type, String label) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) {
        return AlertDialog(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(18),
          ),
          title: Text(
            '$label Belum Terdaftar',
            style: const TextStyle(fontWeight: FontWeight.w700),
          ),
          content: Text(
            'Aplikasi tidak menyimpan template biometrik sendiri. Daftarkan $label di pengaturan perangkat, lalu kembali ke aplikasi. Sistem akan mengecek ulang dan meminta verifikasi nyata.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext, false),
              child: const Text('Nanti'),
            ),
            ElevatedButton(
              onPressed: () => Navigator.pop(dialogContext, true),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF138F81),
                foregroundColor: Colors.white,
              ),
              child: const Text('Buka Pengaturan'),
            ),
          ],
        );
      },
    );

    if (confirmed != true) return;

    setState(() => _pendingEnrollmentType = type);
    final opened = await PaymentSecurityService.openBiometricEnrollment(
      type: type,
    );
    if (!mounted) return;
    _showSnack(
      opened
          ? 'Selesaikan pendaftaran $label di pengaturan perangkat, lalu kembali ke aplikasi.'
          : 'Pengaturan biometrik perangkat tidak bisa dibuka otomatis. Buka pengaturan perangkat secara manual.',
      isError: !opened,
    );
  }

  Future<void> _showFaceUnavailableDialog() async {
    await showDialog<void>(
      context: context,
      builder: (dialogContext) {
        return AlertDialog(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(18),
          ),
          title: const Text(
            'Face ID Belum Bisa Dipakai',
            style: TextStyle(fontWeight: FontWeight.w700),
          ),
          content: Text(
            'Fingerprint sudah bisa dipakai karena Android mengeksposnya ke aplikasi.\n\n'
            'Untuk Face ID, aplikasi tidak boleh membuka kamera dan membuat verifikasi wajah sendiri. Verifikasi wajah harus datang dari sistem biometrik Android.\n\n'
            'Status perangkat ini: $_faceUnavailableMessage',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext),
              child: const Text('Mengerti'),
            ),
            ElevatedButton(
              onPressed: () async {
                Navigator.pop(dialogContext);
                setState(() => _pendingEnrollmentType = 'face');
                final opened =
                    await PaymentSecurityService.openBiometricEnrollment(
                      type: 'face',
                    );
                if (!mounted) return;
                _showSnack(
                  opened
                      ? 'Cek pengaturan wajah Android, lalu kembali ke aplikasi. Jika Android tetap tidak mengekspos Face ID, gunakan fingerprint sebagai biometrik resmi perangkat.'
                      : 'Pengaturan biometrik perangkat tidak bisa dibuka otomatis.',
                  isError: !opened,
                );
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF138F81),
                foregroundColor: Colors.white,
              ),
              child: const Text('Buka Pengaturan'),
            ),
          ],
        );
      },
    );
  }

  Future<void> _completePendingEnrollmentCheck() async {
    final type = _pendingEnrollmentType;
    if (type == null) return;

    await Future<void>.delayed(const Duration(milliseconds: 600));
    if (!mounted) return;
    _pendingEnrollmentType = null;
    await _activateBiometricMethod(type, allowOpenSettings: false);
  }

  Future<void> _disableSecurity() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) {
        return AlertDialog(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(18),
          ),
          title: const Text(
            'Reset Biometrik Pembayaran?',
            style: TextStyle(fontWeight: FontWeight.w700),
          ),
          content: const Text(
            'Face ID/Fingerprint akan dinonaktifkan dari pengaturan aplikasi. Transaksi pembayaran admin tetap aman karena sistem akan meminta password admin saat menyimpan pembayaran.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext, false),
              child: const Text('Batal'),
            ),
            ElevatedButton(
              onPressed: () => Navigator.pop(dialogContext, true),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFE65100),
                foregroundColor: Colors.white,
              ),
              child: const Text('Reset'),
            ),
          ],
        );
      },
    );

    if (confirmed != true) return;

    setState(() {
      _faceEnabled = false;
      _fingerprintEnabled = false;
      _mode = 'fingerprint_only';
      _lastActivationVerifiedAt = null;
    });
    await _persistSetting(
      faceEnabled: false,
      fingerprintEnabled: false,
      mode: 'fingerprint_only',
      requireBiometricConfirmation: false,
    );
  }

  String _modeLabel(String mode) {
    switch (mode) {
      case 'fingerprint_only':
        return 'Fingerprint wajib';
      case 'face_or_fingerprint':
        return 'Biometrik perangkat';
      default:
        return 'Face ID wajib';
    }
  }

  String _modeDescription(String mode) {
    switch (mode) {
      case 'fingerprint_only':
        return 'Fingerprint menjadi satu-satunya syarat sebelum transaksi pembayaran disimpan.';
      case 'face_or_fingerprint':
        return 'Sistem Android memilih biometrik resmi yang tersedia, misalnya fingerprint atau Face Unlock jika didukung aplikasi.';
      default:
        return 'Face ID menjadi syarat utama sebelum transaksi pembayaran disimpan.';
    }
  }

  String _formatIsoDate(String? value) {
    if (value == null || value.isEmpty) return '-';
    final parsed = DateTime.tryParse(value)?.toLocal();
    if (parsed == null) return value;
    final day = parsed.day.toString().padLeft(2, '0');
    final month = parsed.month.toString().padLeft(2, '0');
    final year = parsed.year.toString();
    final hour = parsed.hour.toString().padLeft(2, '0');
    final minute = parsed.minute.toString().padLeft(2, '0');
    return '$day/$month/$year $hour:$minute';
  }

  String _methodLabel(String? method) {
    switch (method) {
      case 'face':
        return 'Face ID';
      case 'fingerprint':
        return 'Fingerprint';
      case 'face_or_fingerprint':
        return 'Biometrik perangkat';
      case 'device_biometric':
        return 'Biometrik perangkat';
      case 'admin_password':
        return 'Password admin';
      case 'admin_pin':
        return 'PIN transaksi';
      default:
        return '-';
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
                        borderRadius: BorderRadius.circular(28),
                      ),
                      child: !_isAdmin ? _buildAccessDenied() : _buildContent(),
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
                color: const Color(0xFFFFDC80),
                borderRadius: BorderRadius.circular(14),
              ),
              child: const Icon(
                Icons.shield_rounded,
                color: Color(0xFF138F81),
                size: 24,
              ),
            ),
            const SizedBox(width: 12),
            const Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Keamanan Pembayaran',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF2D3436),
                    ),
                  ),
                  Text(
                    'Khusus admin, bukan bagian dari login umum',
                    style: TextStyle(fontSize: 11, color: Color(0xFF636E72)),
                  ),
                ],
              ),
            ),
            IconButton(
              onPressed: () => Navigator.pop(context),
              icon: const Icon(Icons.close_rounded),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAccessDenied() {
    return Center(
      child: Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(22),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.lock_person_rounded,
              size: 40,
              color: Color(0xFFE65100),
            ),
            const SizedBox(height: 12),
            const Text(
              'Menu ini khusus admin',
              style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w700,
                color: Color(0xFF2D3436),
              ),
            ),
            const SizedBox(height: 6),
            Text(
              'Role ${_userRole.isEmpty ? '-' : _userRole} tidak memerlukan biometrik pembayaran. Login tetap normal memakai email/username dan password.',
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 11,
                color: Color(0xFF636E72),
                height: 1.5,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildContent() {
    return ListView(
      physics: const BouncingScrollPhysics(),
      children: [
        _buildIntroCard(),
        const SizedBox(height: 14),
        _buildCapabilityCard(),
        const SizedBox(height: 14),
        _buildRegistrationStatusCard(),
        const SizedBox(height: 14),
        _buildSwitchTile(
          title: _primaryBiometricLabel,
          subtitle:
              'Dipakai jika Android mengekspos Face Unlock ke aplikasi. Status: $_primaryBiometricAvailabilityLabel.',
          value: _faceEnabled,
          accent: const Color(0xFF138F81),
          onChanged: _handleFaceToggle,
        ),
        const SizedBox(height: 10),
        _buildSwitchTile(
          title: 'Fingerprint / Biometrik Utama',
          subtitle:
              'Disarankan sebagai metode utama Android. Bisa menjadi satu-satunya biometrik pembayaran. Status: $_fingerprintAvailabilityLabel.',
          value: _fingerprintEnabled,
          accent: const Color(0xFF2E86DE),
          onChanged: _handleFingerprintToggle,
        ),
        const SizedBox(height: 14),
        _buildPinSection(),
        const SizedBox(height: 14),
        _buildModeSection(),
        const SizedBox(height: 14),
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(18),
          ),
          child: Text(
            _capabilities['platform_note']?.toString() ??
                'Verifikasi tetap dikelola sistem operasi perangkat.',
            style: const TextStyle(
              fontSize: 11,
              color: Color(0xFF636E72),
              height: 1.5,
            ),
          ),
        ),
        const SizedBox(height: 20),
        Row(
          children: [
            Expanded(
              child: OutlinedButton.icon(
                onPressed: _isSaving ? null : _disableSecurity,
                icon: const Icon(Icons.restart_alt_rounded),
                label: const Text('Reset'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: const Color(0xFFE65100),
                  side: const BorderSide(color: Color(0xFFE65100)),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              flex: 2,
              child: SizedBox(
                height: 50,
                child: ElevatedButton.icon(
                  onPressed: _isSaving ? null : _save,
                  icon: _isSaving
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : const Icon(Icons.verified_user_rounded),
                  label: Text(
                    _isSaving ? 'Menyimpan...' : 'Simpan Pengaturan',
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF138F81),
                    foregroundColor: Colors.white,
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildIntroCard() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: const [
          Text(
            'Flow Yang Benar',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: Color(0xFF2D3436),
            ),
          ),
          SizedBox(height: 8),
          Text(
            '1. Admin login normal memakai email/username dan password.\n'
            '2. Setelah masuk, buka Akun > Pengaturan > Keamanan Pembayaran.\n'
            '3. Fingerprint menjadi metode utama yang stabil di Android. Face Unlock dipakai jika OS mendukung aplikasi.\n'
            '4. Saat simpan pembayaran, sistem meminta biometrik. Jika tidak tersedia, transaksi dikunci password admin.',
            style: TextStyle(
              fontSize: 11,
              color: Color(0xFF636E72),
              height: 1.5,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPinSection() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 46,
                height: 46,
                decoration: BoxDecoration(
                  color: const Color(0xFFFFDC80).withValues(alpha: 0.45),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: const Icon(Icons.pin_rounded, color: Color(0xFFE65100)),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'PIN Transaksi Admin',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF2D3436),
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      _pinEnabled
                          ? 'Aktif sejak ${_formatIsoDate(_pinSetAt)}'
                          : 'Belum aktif. Dipakai saat biometrik perangkat tidak tersedia.',
                      style: const TextStyle(
                        fontSize: 10,
                        color: Color(0xFF636E72),
                        height: 1.35,
                      ),
                    ),
                  ],
                ),
              ),
              _statusChip(
                _pinEnabled ? 'Aktif' : 'Belum',
                _pinEnabled ? const Color(0xFF138F81) : const Color(0xFFE65100),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _isSaving ? null : _showPinSetupDialog,
                  icon: const Icon(Icons.edit_rounded, size: 18),
                  label: Text(_pinEnabled ? 'Ubah PIN' : 'Buat PIN'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: const Color(0xFF138F81),
                    side: const BorderSide(color: Color(0xFF138F81)),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                ),
              ),
              if (_pinEnabled) ...[
                const SizedBox(width: 8),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _isSaving ? null : _disablePin,
                    icon: const Icon(Icons.lock_open_rounded, size: 18),
                    label: const Text('Matikan'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: const Color(0xFFE65100),
                      side: const BorderSide(color: Color(0xFFE65100)),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                    ),
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildCapabilityCard() {
    final canAuthenticate = _capabilities['can_authenticate'] == true;
    final deviceSupported = _deviceSupportsBiometric;
    final hasPrimary = _deviceHasPrimaryBiometric;
    final hasFingerprint = _deviceHasFingerprint;
    final available = List<String>.from(
      _capabilities['available_biometrics'] ?? const [],
    );
    final nativeStatus = Map<String, dynamic>.from(
      _capabilities['native_status'] ?? const {},
    );

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Status Perangkat',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: Color(0xFF2D3436),
            ),
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _statusChip(
                deviceSupported
                    ? 'Device support: ya'
                    : 'Device support: belum',
                deviceSupported
                    ? const Color(0xFF138F81)
                    : const Color(0xFFE65100),
              ),
              _statusChip(
                canAuthenticate
                    ? 'Izin pakai biometric: siap'
                    : 'Izin pakai biometric: belum',
                canAuthenticate
                    ? const Color(0xFF138F81)
                    : const Color(0xFFE65100),
              ),
              _statusChip(
                hasPrimary
                    ? 'Face ID aplikasi: ada'
                    : 'Face ID aplikasi: belum',
                hasPrimary ? const Color(0xFF138F81) : const Color(0xFFE65100),
              ),
              _statusChip(
                hasFingerprint
                    ? 'Fingerprint: ter-enroll'
                    : 'Fingerprint: belum',
                hasFingerprint
                    ? const Color(0xFF2E86DE)
                    : const Color(0xFFE65100),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            'Tipe terdeteksi: ${available.isEmpty ? '-' : available.join(', ')}',
            style: const TextStyle(
              fontSize: 10,
              color: Color(0xFF636E72),
              height: 1.4,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            nativeStatus['status_hint']?.toString() ??
                _capabilities['platform_note']?.toString() ??
                'Status biometrik dibaca dari sistem perangkat.',
            style: const TextStyle(
              fontSize: 10,
              color: Color(0xFF636E72),
              height: 1.4,
            ),
          ),
          if (_androidHasGenericBiometricOnly) ...[
            const SizedBox(height: 8),
            Text(
              _faceUnavailableMessage,
              style: const TextStyle(
                fontSize: 10,
                color: Color(0xFFE65100),
                height: 1.45,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildRegistrationStatusCard() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Status Pendaftaran Di Aplikasi',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: Color(0xFF2D3436),
            ),
          ),
          const SizedBox(height: 10),
          _buildStatusRow(
            title: 'Face ID / Wajah',
            value: _faceEnabled ? 'Aktif' : 'Belum aktif',
            subtitle:
                'Terdaftar di aplikasi: ${_formatIsoDate(_faceRegisteredAt)}',
            color: _faceEnabled
                ? const Color(0xFF138F81)
                : const Color(0xFFE65100),
          ),
          const SizedBox(height: 10),
          _buildStatusRow(
            title: 'Fingerprint',
            value: _fingerprintEnabled ? 'Aktif' : 'Belum aktif',
            subtitle:
                'Terdaftar di aplikasi: ${_formatIsoDate(_fingerprintRegisteredAt)}',
            color: _fingerprintEnabled
                ? const Color(0xFF2E86DE)
                : const Color(0xFFE65100),
          ),
          const SizedBox(height: 10),
          _buildStatusRow(
            title: 'PIN Transaksi',
            value: _pinEnabled ? 'Aktif' : 'Belum aktif',
            subtitle: 'Diatur pada: ${_formatIsoDate(_pinSetAt)}',
            color: _pinEnabled
                ? const Color(0xFF138F81)
                : const Color(0xFFE65100),
          ),
          const SizedBox(height: 10),
          _buildStatusRow(
            title: 'Verifikasi Terakhir',
            value: _formatIsoDate(_lastVerifiedAt),
            subtitle:
                'Metode: ${_methodLabel(_lastVerificationMethod)} • Device: ${_lastDeviceLabel ?? '-'}',
            color: const Color(0xFF636E72),
          ),
          const SizedBox(height: 10),
          const Text(
            'Catatan: pendaftaran biometrik fisik tetap dilakukan di pengaturan perangkat. Layar ini hanya mengaktifkan dan mengaudit penggunaannya untuk transaksi pembayaran admin.',
            style: TextStyle(
              fontSize: 10,
              color: Color(0xFF636E72),
              height: 1.5,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatusRow({
    required String title,
    required String value,
    required String subtitle,
    required Color color,
  }) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(
              title.contains('Fingerprint')
                  ? Icons.fingerprint_rounded
                  : title.contains('PIN')
                  ? Icons.pin_rounded
                  : Icons.shield_rounded,
              color: color,
              size: 20,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF2D3436),
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: const TextStyle(
                    fontSize: 10,
                    color: Color(0xFF636E72),
                    height: 1.4,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          Text(
            value,
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w700,
              color: color,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildModeSection() {
    final options = ['face_only', 'fingerprint_only', 'face_or_fingerprint'];

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Mode Verifikasi',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: Color(0xFF2D3436),
            ),
          ),
          const SizedBox(height: 10),
          ...options.map((option) {
            final enabled = _isModeOptionEnabled(option);
            final selected = _mode == option;
            return GestureDetector(
              onTap: enabled ? () => setState(() => _mode = option) : null,
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 180),
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: selected
                      ? const Color(0xFF138F81).withValues(alpha: 0.1)
                      : const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(
                    color: selected
                        ? const Color(0xFF138F81)
                        : const Color(0xFFDFE6E9),
                  ),
                ),
                child: Row(
                  children: [
                    Icon(
                      selected
                          ? Icons.radio_button_checked_rounded
                          : Icons.radio_button_off_rounded,
                      color: selected
                          ? const Color(0xFF138F81)
                          : const Color(0xFF636E72),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            _modeLabel(option),
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: enabled
                                  ? const Color(0xFF2D3436)
                                  : const Color(0xFFB2BEC3),
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            _modeDescription(option),
                            style: TextStyle(
                              fontSize: 10,
                              color: enabled
                                  ? const Color(0xFF636E72)
                                  : const Color(0xFFB2BEC3),
                              height: 1.4,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            );
          }),
        ],
      ),
    );
  }

  bool _isModeOptionEnabled(String option) {
    switch (option) {
      case 'face_only':
        return _faceEnabled && !_fingerprintEnabled;
      case 'fingerprint_only':
        return _fingerprintEnabled && !_faceEnabled;
      case 'face_or_fingerprint':
        return _faceEnabled && _fingerprintEnabled;
      default:
        return false;
    }
  }

  Widget _buildSwitchTile({
    required String title,
    required String subtitle,
    required bool value,
    required Color accent,
    required ValueChanged<bool>? onChanged,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
      ),
      child: Row(
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: accent.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(
              title.contains('Face')
                  ? Icons.face_retouching_natural_rounded
                  : Icons.fingerprint_rounded,
              color: accent,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF2D3436),
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: const TextStyle(
                    fontSize: 10,
                    color: Color(0xFF636E72),
                    height: 1.4,
                  ),
                ),
              ],
            ),
          ),
          Switch(value: value, onChanged: onChanged, activeThumbColor: accent),
        ],
      ),
    );
  }

  Widget _statusChip(String text, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Text(
        text,
        style: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w700,
          color: color,
        ),
      ),
    );
  }
}
