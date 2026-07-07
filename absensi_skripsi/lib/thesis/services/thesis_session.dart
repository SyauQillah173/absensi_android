import 'dart:convert';

import 'package:crypto/crypto.dart';
import 'package:shared_preferences/shared_preferences.dart';

class ThesisSession {
  static const _session = 'thesis_session';
  static const _offlineAccounts = 'thesis_offline_accounts';

  static Future<Map<String, dynamic>?> current() async {
    final raw = (await SharedPreferences.getInstance()).getString(_session);
    if (raw == null) return null;
    return Map<String, dynamic>.from(jsonDecode(raw) as Map);
  }

  static Future<bool> hasValidSession() async {
    final data = await current();
    if (data == null || (data['token']?.toString().isEmpty ?? true)) {
      return false;
    }
    final expiresAt = DateTime.tryParse(data['expires_at']?.toString() ?? '');
    return expiresAt != null && expiresAt.isAfter(DateTime.now());
  }

  static Future<String> token() async =>
      (await current())?['token']?.toString() ?? '';

  static Future<String> role() async =>
      (await current())?['role']?.toString().toLowerCase() ?? '';

  static Future<String> name() async =>
      (await current())?['nama']?.toString() ?? '';

  static Future<void> saveOnline({
    required String username,
    required String password,
    required String token,
    required int expiresIn,
    required Map<String, dynamic> user,
  }) async {
    final session = <String, dynamic>{
      ...user,
      'token': token,
      'expires_at': DateTime.now()
          .add(Duration(seconds: expiresIn))
          .toIso8601String(),
    };
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_session, jsonEncode(session));

    final accounts = _readAccounts(prefs);
    accounts.removeWhere(
      (item) =>
          item['username'].toString().toLowerCase() == username.toLowerCase(),
    );
    accounts.add({
      'username': username,
      'password_hash': sha256.convert(utf8.encode(password)).toString(),
      'session': session,
    });
    await prefs.setString(_offlineAccounts, jsonEncode(accounts));
  }

  static Future<bool> loginOffline(String username, String password) async {
    final prefs = await SharedPreferences.getInstance();
    final passwordHash = sha256.convert(utf8.encode(password)).toString();
    final account = _readAccounts(prefs)
        .cast<Map<String, dynamic>?>()
        .firstWhere(
          (item) =>
              item?['username'].toString().toLowerCase() ==
                  username.toLowerCase() &&
              item?['password_hash'] == passwordHash,
          orElse: () => null,
        );
    if (account == null) return false;

    final session = Map<String, dynamic>.from(account['session'] as Map);
    final expiresAt = DateTime.tryParse(
      session['expires_at']?.toString() ?? '',
    );
    if (expiresAt == null || expiresAt.isBefore(DateTime.now())) return false;
    await prefs.setString(_session, jsonEncode(session));
    return true;
  }

  static Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_session);
  }

  static List<Map<String, dynamic>> _readAccounts(SharedPreferences prefs) {
    final raw = prefs.getString(_offlineAccounts) ?? '[]';
    return List<Map<String, dynamic>>.from(
      (jsonDecode(raw) as List).map((item) => Map<String, dynamic>.from(item)),
    );
  }
}
