// ================================================================
// LOCAL DB SERVICE — SQLite Offline Storage
// ================================================================
// File: lib/services/local_db_service.dart
//
// Menyimpan absensi yang diinput saat offline di SQLite lokal.
// Data akan di-sync ke server saat internet tersedia.
// Data pending TIDAK pernah dihapus otomatis — tetap ada sampai
// berhasil di-sync atau di-resolve manual.
// ================================================================

import 'package:path/path.dart';
import 'package:sqflite/sqflite.dart';

class LocalDbService {
  static Database? _database;

  static Future<Database> get database async {
    if (_database != null) return _database!;
    _database = await _initDatabase();
    return _database!;
  }

  static Future<Database> _initDatabase() async {
    String path = join(await getDatabasesPath(), 'absensi_offline.db');
    return await openDatabase(
      path,
      version: 2, // v2: tambah kolom mapel di unique constraint
      onCreate: (db, version) async {
        // Tabel absensi offline — queue yang belum di-sync
        await db.execute('''
          CREATE TABLE absensi_pending (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            siswa_id INTEGER NOT NULL,
            tanggal TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'Hadir',
            keterangan TEXT,
            kelas TEXT,
            mapel TEXT,
            diinput_oleh TEXT,
            device_id TEXT,
            created_at TEXT NOT NULL,
            sync_status TEXT NOT NULL DEFAULT 'pending',
            sync_message TEXT,
            UNIQUE(siswa_id, tanggal, kelas, mapel)
          )
        ''');
      },
      onUpgrade: (db, oldVersion, newVersion) async {
        if (oldVersion < 2) {
          // === MIGRASI v1 → v2 ===
          // Tambah kolom mapel + update UNIQUE constraint
          // SQLite tidak support ALTER UNIQUE, jadi recreate table
          await db.execute(
            'ALTER TABLE absensi_pending RENAME TO absensi_pending_old',
          );
          await db.execute('''
            CREATE TABLE absensi_pending (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              siswa_id INTEGER NOT NULL,
              tanggal TEXT NOT NULL,
              status TEXT NOT NULL DEFAULT 'Hadir',
              keterangan TEXT,
              kelas TEXT,
              mapel TEXT,
              diinput_oleh TEXT,
              device_id TEXT,
              created_at TEXT NOT NULL,
              sync_status TEXT NOT NULL DEFAULT 'pending',
              sync_message TEXT,
              UNIQUE(siswa_id, tanggal, kelas, mapel)
            )
          ''');
          // Migrate existing data
          await db.execute('''
            INSERT OR IGNORE INTO absensi_pending 
            (id, siswa_id, tanggal, status, keterangan, kelas, diinput_oleh, device_id, created_at, sync_status, sync_message)
            SELECT id, siswa_id, tanggal, status, keterangan, kelas, diinput_oleh, device_id, created_at, sync_status, sync_message
            FROM absensi_pending_old
          ''');
          await db.execute('DROP TABLE absensi_pending_old');
        }
      },
    );
  }

  // ===== INSERT ABSENSI PENDING =====
  static Future<int> insertAbsensiPending(Map<String, dynamic> data) async {
    final db = await database;
    data['created_at'] = DateTime.now().toIso8601String();
    data['sync_status'] = 'pending';
    return await db.insert(
      'absensi_pending',
      data,
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  // ===== GET ALL PENDING =====
  static Future<List<Map<String, dynamic>>> getPendingAbsensi() async {
    final db = await database;
    return await db.query(
      'absensi_pending',
      where: 'sync_status = ?',
      whereArgs: ['pending'],
      orderBy: 'created_at DESC',
    );
  }

  // ===== GET COUNT PENDING =====
  static Future<int> countPending() async {
    final db = await database;
    final result = await db.rawQuery(
      'SELECT COUNT(*) as count FROM absensi_pending WHERE sync_status = ?',
      ['pending'],
    );
    return result.first['count'] as int;
  }

  // ===== GET COUNT SYNCED =====
  static Future<int> countSynced() async {
    final db = await database;
    final result = await db.rawQuery(
      'SELECT COUNT(*) as count FROM absensi_pending WHERE sync_status = ?',
      ['synced'],
    );
    return result.first['count'] as int;
  }

  // ===== UPDATE SYNC STATUS =====
  static Future<void> markAsSynced(int id, {String? message}) async {
    final db = await database;
    await db.update(
      'absensi_pending',
      {'sync_status': 'synced', 'sync_message': message ?? 'Berhasil di-sync'},
      where: 'id = ?',
      whereArgs: [id],
    );
  }

  static Future<void> markAsConflict(int id, String message) async {
    final db = await database;
    await db.update(
      'absensi_pending',
      {'sync_status': 'conflict', 'sync_message': message},
      where: 'id = ?',
      whereArgs: [id],
    );
  }

  // ===== DELETE PENDING (batalkan) =====
  static Future<void> deletePending(int id) async {
    final db = await database;
    await db.delete('absensi_pending', where: 'id = ?', whereArgs: [id]);
  }

  // ===== GET PENDING BY KELAS + MAPEL (hari ini / scope tertentu) =====
  static Future<List<Map<String, dynamic>>> getPendingByScope({
    required String tanggal,
    required String kelas,
    required String mapel,
  }) async {
    final db = await database;
    return await db.query(
      'absensi_pending',
      where: 'tanggal = ? AND kelas = ? AND mapel = ? AND sync_status = ?',
      whereArgs: [tanggal, kelas, mapel, 'pending'],
      orderBy: 'created_at DESC',
    );
  }

  // ===== DELETE ALL PENDING IN ONE CLASS + SUBJECT =====
  static Future<int> deletePendingByScope({
    required String tanggal,
    required String kelas,
    required String mapel,
  }) async {
    final db = await database;
    return await db.delete(
      'absensi_pending',
      where: 'tanggal = ? AND kelas = ? AND mapel = ? AND sync_status = ?',
      whereArgs: [tanggal, kelas, mapel, 'pending'],
    );
  }

  // ===== CLEAR ALL SYNCED =====
  static Future<void> clearSynced() async {
    final db = await database;
    await db.delete(
      'absensi_pending',
      where: 'sync_status = ?',
      whereArgs: ['synced'],
    );
  }

  // ===== CLEANUP OLD SYNCED DATA (>7 hari) =====
  // Bersihkan data synced yang sudah lama untuk hemat storage
  // Data pending TETAP dipertahankan — tidak pernah dihapus otomatis
  static Future<int> cleanupOldSyncedData() async {
    final db = await database;
    final weekAgo = DateTime.now().subtract(const Duration(days: 7));
    return await db.delete(
      'absensi_pending',
      where: 'sync_status IN (?, ?) AND created_at < ?',
      whereArgs: ['synced', 'conflict', weekAgo.toIso8601String()],
    );
  }

  // ===== GET ALL (for dashboard) =====
  static Future<List<Map<String, dynamic>>> getAllAbsensiToday() async {
    final db = await database;
    final today = DateTime.now().toIso8601String().split('T')[0];
    return await db.query(
      'absensi_pending',
      where: 'tanggal = ? AND sync_status IN (?, ?)',
      whereArgs: [today, 'pending', 'conflict'],
      orderBy: 'created_at DESC',
    );
  }
}
