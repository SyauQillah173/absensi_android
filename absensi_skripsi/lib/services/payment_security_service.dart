import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:local_auth/local_auth.dart';
import 'package:shared_preferences/shared_preferences.dart';

class PaymentSecurityService {
  static const _cachePrefix = 'payment_security_setting_';
  static const _platform = MethodChannel('absensi_android/payment_security');
  static final LocalAuthentication _auth = LocalAuthentication();

  static Future<Map<String, dynamic>> getCapabilities() async {
    try {
      final canCheck = await _auth.canCheckBiometrics;
      final deviceSupported = await _auth.isDeviceSupported();
      final canAuthenticate = canCheck || deviceSupported;
      final available = canAuthenticate
          ? await _auth.getAvailableBiometrics()
          : <BiometricType>[];
      final nativeStatus = await _getNativeBiometricStatus();
      final nativeAnyEnrolled =
          nativeStatus['any_biometric_enrolled'] == true ||
          nativeStatus['biometric_weak_available'] == true ||
          nativeStatus['biometric_strong_available'] == true;
      final nativeFingerprintSupported =
          nativeStatus['fingerprint_supported'] == true;
      final nativeFingerprintEnrolled =
          nativeStatus['fingerprint_enrolled'] == true;

      final names = available.map((item) => item.name).toList();
      final hasFaceType = available.contains(BiometricType.face);
      final hasFingerprintType = available.contains(BiometricType.fingerprint);
      final hasWeakType = names.contains('weak');
      final hasStrongType = names.contains('strong');
      final hasAnyLocalAuthBiometric = available.isNotEmpty;

      // Face ID tidak boleh disamakan dengan "biometrik umum" di Android.
      // Jika OS hanya mengekspos fingerprint/biometric prompt umum, aplikasi
      // tidak bisa memaksa kamera wajah dan tidak boleh menandainya sebagai Face ID.
      final androidGenericBiometricAvailable =
          Platform.isAndroid && (nativeAnyEnrolled || hasAnyLocalAuthBiometric);
      final faceEnrolled = hasFaceType;
      final fingerprintEnrolled =
          hasFingerprintType || nativeFingerprintEnrolled;
      final anyBiometricEnrolled =
          faceEnrolled ||
          fingerprintEnrolled ||
          androidGenericBiometricAvailable;
      final deviceCanAuthenticate = canAuthenticate || anyBiometricEnrolled;
      final faceUnavailableReason =
          Platform.isAndroid && !hasFaceType && androidGenericBiometricAvailable
          ? 'Face Unlock perangkat tidak diekspos sebagai biometrik wajah untuk aplikasi pihak ketiga. Android hanya mengizinkan prompt biometrik umum/fingerprint pada device ini, sehingga aplikasi tidak bisa membuka kamera wajah untuk verifikasi Face ID.'
          : '';

      return {
        'can_authenticate': deviceCanAuthenticate,
        'device_supported': deviceSupported,
        'can_check_biometrics': canCheck,
        'available_biometrics': names,
        'native_status': nativeStatus,
        'has_any_biometric': anyBiometricEnrolled,
        'device_biometric_enrolled': anyBiometricEnrolled,
        'has_face': faceEnrolled,
        'has_fingerprint': fingerprintEnrolled,
        'face_supported': hasFaceType,
        'fingerprint_supported':
            hasFingerprintType || nativeFingerprintSupported,
        'face_detection_source': hasFaceType ? 'typed_face' : 'not_available',
        'fingerprint_detection_source': hasFingerprintType
            ? 'typed_fingerprint'
            : nativeFingerprintEnrolled
            ? 'android_fingerprint_manager'
            : 'not_available',
        'android_generic_biometric_available': androidGenericBiometricAvailable,
        'face_unavailable_reason': faceUnavailableReason,
        'has_weak_biometric':
            hasWeakType || nativeStatus['biometric_weak_available'] == true,
        'has_strong_biometric':
            hasStrongType || nativeStatus['biometric_strong_available'] == true,
        'device_label': _deviceLabel(),
        'platform_note':
            'Verifikasi dijalankan oleh sistem biometrik perangkat. Fingerprint menjadi metode utama yang stabil di Android. Face Unlock dipakai hanya jika OS mengeksposnya ke aplikasi. Jika biometrik tidak tersedia, transaksi tetap dikunci dengan password admin.',
      };
    } catch (e) {
      return {
        'can_authenticate': false,
        'device_supported': false,
        'can_check_biometrics': false,
        'available_biometrics': const <String>[],
        'native_status': const <String, dynamic>{},
        'has_any_biometric': false,
        'device_biometric_enrolled': false,
        'has_face': false,
        'has_fingerprint': false,
        'face_supported': false,
        'fingerprint_supported': false,
        'face_detection_source': 'error',
        'fingerprint_detection_source': 'error',
        'android_generic_biometric_available': false,
        'face_unavailable_reason': '',
        'has_weak_biometric': false,
        'has_strong_biometric': false,
        'device_label': _deviceLabel(),
        'platform_note':
            'Biometrik perangkat belum bisa dibaca aplikasi pada device ini: $e',
      };
    }
  }

  static Future<Map<String, dynamic>> _getNativeBiometricStatus() async {
    if (!Platform.isAndroid) {
      return const <String, dynamic>{};
    }

    try {
      final result = await _platform.invokeMethod<Map<dynamic, dynamic>>(
        'getBiometricStatus',
      );
      return Map<String, dynamic>.from(result ?? const {});
    } catch (_) {
      return const <String, dynamic>{};
    }
  }

  static Future<Map<String, dynamic>> confirmBiometricRegistration({
    required String reason,
    String method = 'biometric',
  }) async {
    if (method == 'face') {
      final capabilities = await getCapabilities();
      if (capabilities['has_face'] != true) {
        return {
          'success': false,
          'message':
              capabilities['face_unavailable_reason']?.toString().isNotEmpty ==
                  true
              ? capabilities['face_unavailable_reason'].toString()
              : 'Face ID / scan wajah tidak tersedia untuk aplikasi ini.',
        };
      }
    }

    if (method == 'fingerprint') {
      final capabilities = await getCapabilities();
      if (capabilities['has_fingerprint'] != true) {
        return {
          'success': false,
          'message':
              'Fingerprint belum tersedia atau belum terdaftar di perangkat ini.',
        };
      }
    }

    return _authenticate(reason: reason);
  }

  static Future<bool> openBiometricEnrollment({required String type}) async {
    try {
      final result = await _platform.invokeMethod<bool>(
        'openBiometricEnrollment',
        {'type': type},
      );
      return result == true;
    } catch (_) {
      return false;
    }
  }

  static Future<Map<String, dynamic>> verifyPayment({
    required Map<String, dynamic> setting,
    required String reason,
  }) async {
    final capabilities = await getCapabilities();
    if (capabilities['can_authenticate'] != true) {
      return {
        'success': false,
        'message':
            'Perangkat ini belum siap untuk verifikasi biometrik pembayaran.',
      };
    }
    final hasFace = capabilities['has_face'] == true;
    final hasFingerprint = capabilities['has_fingerprint'] == true;
    final faceEnabled = setting['face_enabled'] == true;
    final fingerprintEnabled = setting['fingerprint_enabled'] == true;
    final mode =
        setting['verification_mode']?.toString() ??
        _defaultModeForSetting(
          faceEnabled: faceEnabled,
          fingerprintEnabled: fingerprintEnabled,
        );

    if (!faceEnabled && !fingerprintEnabled) {
      return {
        'success': false,
        'message':
            'Biometrik perangkat belum aktif. Transaksi dapat diamankan dengan password admin sebagai fallback.',
      };
    }

    if (faceEnabled && !hasFace) {
      final faceReason = capabilities['face_unavailable_reason']?.toString();
      return {
        'success': false,
        'message': faceReason != null && faceReason.isNotEmpty
            ? faceReason
            : 'Face ID / scan wajah belum tersedia untuk pembayaran admin.',
      };
    }

    if (fingerprintEnabled && !hasFingerprint) {
      return {
        'success': false,
        'message':
            'Fingerprint diaktifkan, tetapi perangkat ini belum memiliki sidik jari yang terdaftar.',
      };
    }

    final result = await _authenticate(reason: reason);
    if (result['success'] != true) {
      return result;
    }

    final method = _resolveVerifiedMethod(
      faceEnabled: faceEnabled,
      fingerprintEnabled: fingerprintEnabled,
      mode: mode,
    );

    return {
      ...result,
      'method': method,
      'mode': mode,
      'device_label': capabilities['device_label'],
    };
  }

  static Future<void> cacheSetting(
    int userId,
    Map<String, dynamic> data,
  ) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('$_cachePrefix$userId', jsonEncode(data));
  }

  static Future<Map<String, dynamic>?> getCachedSetting(int userId) async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString('$_cachePrefix$userId');
    if (raw == null || raw.isEmpty) return null;
    return Map<String, dynamic>.from(jsonDecode(raw) as Map);
  }

  static Future<Map<String, dynamic>> _authenticate({
    required String reason,
  }) async {
    try {
      final authenticated = await _auth.authenticate(
        localizedReason: reason,
        options: const AuthenticationOptions(
          biometricOnly: true,
          stickyAuth: true,
        ),
      );

      if (!authenticated) {
        return {
          'success': false,
          'message': 'Verifikasi biometrik dibatalkan atau gagal.',
        };
      }

      return {'success': true, 'verified_at': DateTime.now().toIso8601String()};
    } catch (e) {
      return {
        'success': false,
        'message': 'Perangkat tidak dapat memproses biometrik: $e',
      };
    }
  }

  static String _resolveVerifiedMethod({
    required bool faceEnabled,
    required bool fingerprintEnabled,
    required String mode,
  }) {
    if (fingerprintEnabled && !faceEnabled) {
      return 'fingerprint';
    }
    if (faceEnabled && !fingerprintEnabled) {
      return 'face';
    }
    if (mode == 'fingerprint_only') {
      return 'fingerprint';
    }
    return 'face_or_fingerprint';
  }

  static String _defaultModeForSetting({
    required bool faceEnabled,
    required bool fingerprintEnabled,
  }) {
    if (fingerprintEnabled && !faceEnabled) {
      return 'fingerprint_only';
    }
    if (faceEnabled && !fingerprintEnabled) {
      return 'face_only';
    }
    return 'face_or_fingerprint';
  }

  static String _deviceLabel() {
    if (kIsWeb) return 'web-browser';
    if (Platform.isAndroid) return 'android-device';
    if (Platform.isIOS) return 'ios-device';
    if (Platform.isMacOS) return 'macos-device';
    if (Platform.isWindows) return 'windows-device';
    if (Platform.isLinux) return 'linux-device';
    return 'unknown-device';
  }
}
