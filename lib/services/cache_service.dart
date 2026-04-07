// ================================================================
// CACHE SERVICE — Offline Data Cache (SQLite)
// ================================================================
// File: lib/services/cache_service.dart
//
// Menyimpan response API ke SQLite lokal.
// Saat offline, data terakhir ditampilkan (bukan error kosong).
// Saat online, data di-refresh dari API dan cache diupdate.
// ================================================================

import 'dart:convert';

import 'package:path/path.dart';
import 'package:sqflite/sqflite.dart';

class CacheService {
  static Database? _db;

  static Future<Database> get database async {
    if (_db != null) return _db!;
    _db = await _init();
    return _db!;
  }

  static Future<Database> _init() async {
    final path = join(await getDatabasesPath(), 'app_cache.db');
    return await openDatabase(
      path,
      version: 1,
      onCreate: (db, version) async {
        await db.execute('''
          CREATE TABLE api_cache (
            cache_key TEXT PRIMARY KEY,
            data TEXT NOT NULL,
            updated_at TEXT NOT NULL
          )
        ''');
      },
    );
  }

  // ===== SAVE CACHE =====
  static Future<void> save(String key, dynamic data) async {
    final db = await database;
    await db.insert('api_cache', {
      'cache_key': key,
      'data': jsonEncode(data),
      'updated_at': DateTime.now().toIso8601String(),
    }, conflictAlgorithm: ConflictAlgorithm.replace);
  }

  // ===== GET CACHE =====
  static Future<dynamic> get(String key) async {
    final db = await database;
    final rows = await db.query(
      'api_cache',
      where: 'cache_key = ?',
      whereArgs: [key],
      limit: 1,
    );
    if (rows.isEmpty) return null;
    return jsonDecode(rows.first['data'] as String);
  }

  // ===== DELETE CACHE =====
  static Future<void> delete(String key) async {
    final db = await database;
    await db.delete('api_cache', where: 'cache_key = ?', whereArgs: [key]);
  }

  // ===== CLEAR ALL CACHE =====
  static Future<void> clearAll() async {
    final db = await database;
    await db.delete('api_cache');
  }

  // ===== HELPER: Fetch with Cache =====
  /// Tries to fetch from API first. If success, caches and returns.
  /// If fails (offline), returns cached data.
  /// Returns null only if no cache exists AND API fails.
  static Future<Map<String, dynamic>?> fetchWithCache({
    required String cacheKey,
    required Future<Map<String, dynamic>> Function() apiFetch,
  }) async {
    try {
      // Try API first
      final response = await apiFetch();
      // Cache the successful response
      await save(cacheKey, response);
      return response;
    } catch (_) {
      // API failed (offline) — try cache
      final cached = await get(cacheKey);
      if (cached != null) {
        final result = Map<String, dynamic>.from(cached as Map);
        result['_fromCache'] = true;
        return result;
      }
      return null; // No cache available
    }
  }
}
