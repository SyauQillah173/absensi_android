import 'dart:convert';

import 'package:crypto/crypto.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'sync_service.dart';

class SessionService {
  static const _keyIsLoggedIn = 'is_logged_in';
  static const _keyUserId = 'user_id';
  static const _keyUserName = 'user_name';
  static const _keyUserEmail = 'user_email';
  static const _keyUserRole = 'user_role';
  static const _keyAdminType = 'admin_type';
  static const _keyUserFotoUrl = 'user_foto_url';
  static const _keyAuthToken = 'auth_token';
  static const _keyMustChangePassword = 'must_change_password';
  static const _keyAnakList = 'anak_list';
  static const _keyActiveSiswaId = 'active_siswa_id';
  static const _keyActiveSiswaNama = 'active_siswa_nama';
  static const _keyOfflineAccounts = 'offline_accounts';

  static Future<SharedPreferences> get _prefs async =>
      SharedPreferences.getInstance();

  static Future<bool> isLoggedIn() async {
    final prefs = await _prefs;
    return prefs.getBool(_keyIsLoggedIn) ?? false;
  }

  static Future<int> getUserId() async {
    final prefs = await _prefs;
    return prefs.getInt(_keyUserId) ?? 0;
  }

  static Future<String> getUserRole() async {
    final prefs = await _prefs;
    return prefs.getString(_keyUserRole) ?? '';
  }

  static Future<String> getAdminType() async {
    final prefs = await _prefs;
    return prefs.getString(_keyAdminType) ?? '';
  }

  static Future<String> getUserName() async {
    final prefs = await _prefs;
    return prefs.getString(_keyUserName) ?? '';
  }

  static Future<String> getUserEmail() async {
    final prefs = await _prefs;
    return prefs.getString(_keyUserEmail) ?? '';
  }

  static Future<String> getAuthToken() async {
    final prefs = await _prefs;
    return prefs.getString(_keyAuthToken) ?? '';
  }

  static Future<bool> mustChangePassword() async {
    final prefs = await _prefs;
    return prefs.getBool(_keyMustChangePassword) ?? false;
  }

  static Future<List<Map<String, dynamic>>> getAnakList() async {
    final prefs = await _prefs;
    final raw = prefs.getString(_keyAnakList);
    if (raw == null || raw.isEmpty) return [];
    return List<Map<String, dynamic>>.from(
      (jsonDecode(raw) as List).map(
        (item) => Map<String, dynamic>.from(item as Map),
      ),
    );
  }

  static Future<int> getActiveSiswaId() async {
    final prefs = await _prefs;
    return prefs.getInt(_keyActiveSiswaId) ?? 0;
  }

  static Future<String> getActiveSiswaNama() async {
    final prefs = await _prefs;
    return prefs.getString(_keyActiveSiswaNama) ?? '';
  }

  static Future<void> setActiveSiswa({
    required int siswaId,
    required String siswaNama,
  }) async {
    final prefs = await _prefs;
    await prefs.setInt(_keyActiveSiswaId, siswaId);
    await prefs.setString(_keyActiveSiswaNama, siswaNama);
    await SyncService.notifyDataChanged(SyncTopics.session);
  }

  static Future<void> setAnakList(List<Map<String, dynamic>> anak) async {
    final prefs = await _prefs;
    await prefs.setString(_keyAnakList, jsonEncode(anak));
    if (anak.isNotEmpty) {
      final currentId = prefs.getInt(_keyActiveSiswaId) ?? 0;
      final active = anak.firstWhere(
        (item) => int.tryParse(item['id']?.toString() ?? '') == currentId,
        orElse: () => anak.first,
      );
      await prefs.setInt(
        _keyActiveSiswaId,
        int.tryParse(active['id']?.toString() ?? '') ?? 0,
      );
      await prefs.setString(
        _keyActiveSiswaNama,
        active['nama']?.toString() ?? '',
      );
    } else {
      await prefs.remove(_keyActiveSiswaId);
      await prefs.remove(_keyActiveSiswaNama);
    }
  }

  static Future<void> saveLoginSession(
    Map<String, dynamic> userData, {
    bool preserveExistingToken = false,
  }) async {
    final prefs = await _prefs;
    final userId = int.tryParse(userData['id']?.toString() ?? '') ?? 0;
    await prefs.setString(_keyUserName, userData['name']?.toString() ?? '');
    await prefs.setString(_keyUserEmail, userData['email']?.toString() ?? '');
    await prefs.setString(_keyUserRole, userData['role']?.toString() ?? '');
    await prefs.setString(
      _keyAdminType,
      userData['admin_type']?.toString() ?? '',
    );
    await prefs.setBool(
      _keyMustChangePassword,
      _asBool(userData['must_change_password']),
    );
    await prefs.setInt(_keyUserId, userId);
    final token = userData['token']?.toString() ?? '';
    if (token.isNotEmpty) {
      await prefs.setString(_keyAuthToken, token);
    } else if (!preserveExistingToken) {
      await prefs.remove(_keyAuthToken);
    }
    await prefs.setBool(_keyIsLoggedIn, true);

    final anak = userData['anak'];
    if (anak is List) {
      await prefs.setString(_keyAnakList, jsonEncode(anak));
      if (anak.isNotEmpty) {
        final first = Map<String, dynamic>.from(anak.first as Map);
        await prefs.setInt(
          _keyActiveSiswaId,
          int.tryParse(first['id']?.toString() ?? '') ?? 0,
        );
        await prefs.setString(
          _keyActiveSiswaNama,
          first['nama']?.toString() ?? '',
        );
      }
    } else {
      await prefs.remove(_keyAnakList);
      await prefs.remove(_keyActiveSiswaId);
      await prefs.remove(_keyActiveSiswaNama);
    }

    await SyncService.notifyDataChanged(SyncTopics.session);
  }

  static Future<void> setMustChangePassword(bool value) async {
    final prefs = await _prefs;
    await prefs.setBool(_keyMustChangePassword, value);
    await SyncService.notifyDataChanged(SyncTopics.session);
  }

  static Future<void> clearSession() async {
    final prefs = await _prefs;
    await prefs.setBool(_keyIsLoggedIn, false);
    await prefs.remove(_keyUserId);
    await prefs.remove(_keyUserName);
    await prefs.remove(_keyUserRole);
    await prefs.remove(_keyAdminType);
    await prefs.remove(_keyUserEmail);
    await prefs.remove(_keyUserFotoUrl);
    await prefs.remove(_keyAuthToken);
    await prefs.remove(_keyMustChangePassword);
    await prefs.remove(_keyAnakList);
    await prefs.remove(_keyActiveSiswaId);
    await prefs.remove(_keyActiveSiswaNama);
    await SyncService.notifyDataChanged(SyncTopics.session);
  }

  static Future<void> upsertOfflineAccount({
    required String identifier,
    required String password,
    required Map<String, dynamic> userData,
  }) async {
    final prefs = await _prefs;
    final accounts = await getOfflineAccounts();
    final normalizedIdentifier = _normalizeIdentifier(identifier);
    final userId = int.tryParse(userData['id']?.toString() ?? '') ?? 0;
    final aliases = _buildIdentifierAliases(identifier, userData);

    accounts.removeWhere((account) {
      final accountId = int.tryParse(account['id']?.toString() ?? '') ?? 0;
      final accountAliases = List<String>.from(
        account['identifier_aliases'] ?? [],
      );
      return accountId == userId ||
          accountAliases.any(aliases.contains) ||
          _normalizeIdentifier(account['identifier']?.toString() ?? '') ==
              normalizedIdentifier;
    });

    final accountData = <String, dynamic>{
      'identifier': identifier,
      'identifier_aliases': aliases,
      'pw_hash': _hashPassword(password),
      'name': userData['name'] ?? '',
      'email': userData['email'] ?? '',
      'role': userData['role'] ?? '',
      'admin_type': userData['admin_type'] ?? '',
      'id': userData['id'] ?? 0,
      'nis': userData['nis'] ?? '',
      'nisn': userData['nisn'] ?? '',
      'must_change_password': _asBool(userData['must_change_password']),
      if ((userData['token']?.toString() ?? '').isNotEmpty)
        'token': userData['token'].toString(),
    };

    if (userData['role'] == 'wali' && userData['anak'] != null) {
      accountData['anak'] = userData['anak'];
    }

    accounts.add(accountData);
    await prefs.setString(_keyOfflineAccounts, jsonEncode(accounts));
  }

  static Future<List<Map<String, dynamic>>> getOfflineAccounts() async {
    final prefs = await _prefs;
    final raw = prefs.getString(_keyOfflineAccounts) ?? '[]';
    return List<Map<String, dynamic>>.from(
      (jsonDecode(raw) as List).map(
        (item) => Map<String, dynamic>.from(item as Map),
      ),
    );
  }

  static Future<Map<String, dynamic>?> findOfflineAccount({
    required String identifier,
    required String password,
  }) async {
    final normalizedIdentifier = _normalizeIdentifier(identifier);
    final passwordHash = _hashPassword(password);
    final legacyHash = password.hashCode.toString();

    for (final account in await getOfflineAccounts()) {
      final aliases = List<String>.from(account['identifier_aliases'] ?? []);
      final identifierMatch =
          aliases.contains(normalizedIdentifier) ||
          _normalizeIdentifier(account['identifier']?.toString() ?? '') ==
              normalizedIdentifier;
      final hashMatch =
          account['pw_hash'] == passwordHash ||
          account['pw_hash'] == legacyHash;

      if (identifierMatch && hashMatch) {
        if (account['pw_hash'] != passwordHash) {
          await upsertOfflineAccount(
            identifier: account['identifier']?.toString() ?? identifier,
            password: password,
            userData: account,
          );
        }
        return account;
      }
    }

    return null;
  }

  static Future<void> updateOfflineAccountPassword({
    required String identifier,
    required String oldPassword,
    required String newPassword,
  }) async {
    final prefs = await _prefs;
    final accounts = await getOfflineAccounts();
    final normalizedIdentifier = _normalizeIdentifier(identifier);
    final oldHash = _hashPassword(oldPassword);
    final oldLegacyHash = oldPassword.hashCode.toString();

    var changed = false;
    for (final account in accounts) {
      final aliases = List<String>.from(account['identifier_aliases'] ?? []);
      final identifierMatch =
          aliases.contains(normalizedIdentifier) ||
          _normalizeIdentifier(account['identifier']?.toString() ?? '') ==
              normalizedIdentifier;
      final hashMatch =
          account['pw_hash'] == oldHash || account['pw_hash'] == oldLegacyHash;

      if (identifierMatch && hashMatch) {
        account['pw_hash'] = _hashPassword(newPassword);
        account['must_change_password'] = false;
        changed = true;
      }
    }

    if (changed) {
      await prefs.setString(_keyOfflineAccounts, jsonEncode(accounts));
    }
  }

  static List<String> _buildIdentifierAliases(
    String identifier,
    Map<String, dynamic> userData,
  ) {
    final raw = <String>{
      identifier,
      userData['email']?.toString() ?? '',
      userData['name']?.toString() ?? '',
      userData['nis']?.toString() ?? '',
      userData['nisn']?.toString() ?? '',
    };

    final children = userData['anak'];
    if (children is List) {
      for (final child in children) {
        final childData = Map<String, dynamic>.from(child as Map);
        raw.add(childData['nis']?.toString() ?? '');
        raw.add(childData['nisn']?.toString() ?? '');
      }
    }

    return raw
        .map(_normalizeIdentifier)
        .where((value) => value.isNotEmpty)
        .toList();
  }

  static String _hashPassword(String password) {
    return sha256.convert(utf8.encode(password)).toString();
  }

  static String _normalizeIdentifier(String value) {
    return value.trim().toLowerCase();
  }

  static bool _asBool(dynamic value) {
    if (value is bool) return value;
    if (value is num) return value != 0;

    final text = value?.toString().trim().toLowerCase() ?? '';
    return text == 'true' || text == '1' || text == 'yes';
  }
}
