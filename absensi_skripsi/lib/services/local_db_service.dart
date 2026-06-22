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
      version: 8, // v8: jenis absensi sholat pada queue offline
      onCreate: (db, version) async {
        // Tabel absensi offline — queue yang belum di-sync
        await db.execute('''
          CREATE TABLE absensi_pending (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            siswa_id INTEGER NOT NULL,
            tanggal TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'Hadir',
            attendance_status_id INTEGER,
            keterangan TEXT,
            kelas TEXT,
            class_id INTEGER,
            mapel TEXT,
            mapel_id INTEGER,
            jadwal_id INTEGER,
            diinput_oleh TEXT,
            actor_user_id INTEGER,
            device_id TEXT,
            created_at TEXT NOT NULL,
            sync_status TEXT NOT NULL DEFAULT 'pending',
            sync_message TEXT,
            last_attempt_at TEXT,
            synced_at TEXT,
            retry_count INTEGER NOT NULL DEFAULT 0,
            attendance_key TEXT NOT NULL UNIQUE
          )
        ''');
        await _createAbsensiSholatPending(db);
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
              attendance_status_id INTEGER,
              keterangan TEXT,
              kelas TEXT,
              class_id INTEGER,
              mapel TEXT,
              mapel_id INTEGER,
              jadwal_id INTEGER,
              diinput_oleh TEXT,
              actor_user_id INTEGER,
              device_id TEXT,
              created_at TEXT NOT NULL,
              sync_status TEXT NOT NULL DEFAULT 'pending',
              sync_message TEXT,
              last_attempt_at TEXT,
              synced_at TEXT,
              retry_count INTEGER NOT NULL DEFAULT 0,
              UNIQUE(siswa_id, tanggal, class_id, mapel_id, kelas, mapel)
            )
          ''');
          // Migrate existing data
          await db.execute('''
            INSERT OR IGNORE INTO absensi_pending 
            (id, siswa_id, tanggal, status, keterangan, kelas, diinput_oleh, actor_user_id, device_id, created_at, sync_status, sync_message)
            SELECT id, siswa_id, tanggal, status, keterangan, kelas, diinput_oleh, NULL, device_id, created_at, sync_status, sync_message
            FROM absensi_pending_old
          ''');
          await db.execute('DROP TABLE absensi_pending_old');
        }
        if (oldVersion < 3) {
          await db.execute(
            "ALTER TABLE absensi_pending ADD COLUMN last_attempt_at TEXT",
          );
          await db.execute(
            "ALTER TABLE absensi_pending ADD COLUMN synced_at TEXT",
          );
          await db.execute(
            "ALTER TABLE absensi_pending ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0",
          );
        }
        if (oldVersion < 4) {
          await db.execute(
            "ALTER TABLE absensi_pending ADD COLUMN actor_user_id INTEGER",
          );
        }
        if (oldVersion < 5) {
          await _addColumnIfMissing(db, 'attendance_status_id INTEGER');
          await _addColumnIfMissing(db, 'class_id INTEGER');
          await _addColumnIfMissing(db, 'mapel_id INTEGER');
          await _addColumnIfMissing(db, 'jadwal_id INTEGER');
        }
        if (oldVersion < 6) {
          await db.execute(
            'ALTER TABLE absensi_pending RENAME TO absensi_pending_old_v6',
          );
          await db.execute('''
            CREATE TABLE absensi_pending (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              siswa_id INTEGER NOT NULL,
              tanggal TEXT NOT NULL,
              status TEXT NOT NULL DEFAULT 'Hadir',
              attendance_status_id INTEGER,
              keterangan TEXT,
              kelas TEXT,
              class_id INTEGER,
              mapel TEXT,
              mapel_id INTEGER,
              jadwal_id INTEGER,
              diinput_oleh TEXT,
              actor_user_id INTEGER,
              device_id TEXT,
              created_at TEXT NOT NULL,
              sync_status TEXT NOT NULL DEFAULT 'pending',
              sync_message TEXT,
              last_attempt_at TEXT,
              synced_at TEXT,
              retry_count INTEGER NOT NULL DEFAULT 0,
              attendance_key TEXT NOT NULL UNIQUE
            )
          ''');
          await db.execute('''
            INSERT OR IGNORE INTO absensi_pending
            (id, siswa_id, tanggal, status, attendance_status_id, keterangan, kelas,
             class_id, mapel, mapel_id, jadwal_id, diinput_oleh, actor_user_id,
             device_id, created_at, sync_status, sync_message, last_attempt_at,
             synced_at, retry_count, attendance_key)
            SELECT id, siswa_id, tanggal, status, attendance_status_id, keterangan, kelas,
             class_id, mapel, mapel_id, jadwal_id, diinput_oleh, actor_user_id,
             device_id, created_at, sync_status, sync_message, last_attempt_at,
             synced_at, retry_count,
             CASE
               WHEN class_id IS NOT NULL AND mapel_id IS NOT NULL AND jadwal_id IS NOT NULL
                 THEN substr(tanggal, 1, 10) || '_' || class_id || '_' || mapel_id || '_' || jadwal_id || '_' || siswa_id
               ELSE 'legacy_' || id
             END
            FROM absensi_pending_old_v6
          ''');
          await db.execute('DROP TABLE absensi_pending_old_v6');
        }
        if (oldVersion < 7) {
          await _createAbsensiSholatPending(db);
        }
        if (oldVersion < 8) {
          await _addColumnIfMissingForTable(
            db,
            'absensi_sholat_pending',
            'prayer_attendance_type_id INTEGER',
          );
        }
      },
    );
  }

  static Future<void> _createAbsensiSholatPending(Database db) async {
    await db.execute('''
      CREATE TABLE IF NOT EXISTS absensi_sholat_pending (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        siswa_id INTEGER NOT NULL,
        boarding_room_id INTEGER NOT NULL,
        prayer_attendance_type_id INTEGER,
        tanggal TEXT NOT NULL,
        status_code TEXT NOT NULL,
        status_label TEXT NOT NULL,
        keterangan TEXT,
        diinput_oleh TEXT,
        actor_user_id INTEGER,
        device_id TEXT,
        created_at TEXT NOT NULL,
        sync_status TEXT NOT NULL DEFAULT 'pending',
        sync_message TEXT,
        last_attempt_at TEXT,
        synced_at TEXT,
        retry_count INTEGER NOT NULL DEFAULT 0,
        attendance_key TEXT NOT NULL UNIQUE
      )
    ''');
  }

  static Future<void> _addColumnIfMissing(
    Database db,
    String definition,
  ) async {
    await _addColumnIfMissingForTable(db, 'absensi_pending', definition);
  }

  static Future<void> _addColumnIfMissingForTable(
    Database db,
    String table,
    String definition,
  ) async {
    final columnName = definition.split(' ').first;
    final columns = await db.rawQuery('PRAGMA table_info($table)');
    final exists = columns.any((column) => column['name'] == columnName);
    if (!exists) {
      await db.execute('ALTER TABLE $table ADD COLUMN $definition');
    }
  }

  // ===== INSERT ABSENSI PENDING =====
  static Future<int> insertAbsensiPending(Map<String, dynamic> data) async {
    final db = await database;
    data['attendance_key'] = buildAttendanceKey(data);
    final existing = await db.query(
      'absensi_pending',
      where: 'attendance_key = ? AND sync_status IN (?, ?, ?)',
      whereArgs: [data['attendance_key'], 'pending', 'failed', 'syncing'],
      limit: 1,
    );
    if (existing.isNotEmpty) {
      final existingActor = existing.first['actor_user_id']?.toString() ?? '';
      final nextActor = data['actor_user_id']?.toString() ?? '';
      if (existingActor.isNotEmpty &&
          nextActor.isNotEmpty &&
          existingActor != nextActor) {
        return -1;
      }
    }
    data['created_at'] = DateTime.now().toIso8601String();
    data['sync_status'] = 'pending';
    data['sync_message'] = 'Menunggu sinkronisasi ke server';
    data['retry_count'] = 0;
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
      where: 'sync_status IN (?, ?, ?)',
      whereArgs: ['pending', 'failed', 'syncing'],
      orderBy: 'created_at DESC',
    );
  }

  static Future<int> insertAbsensiSholatPending(
    Map<String, dynamic> data,
  ) async {
    final db = await database;
    data['attendance_key'] = buildPrayerAttendanceKey(data);
    final existing = await db.query(
      'absensi_sholat_pending',
      where: 'attendance_key = ? AND sync_status IN (?, ?, ?)',
      whereArgs: [data['attendance_key'], 'pending', 'failed', 'syncing'],
      limit: 1,
    );
    if (existing.isNotEmpty) {
      final existingActor = existing.first['actor_user_id']?.toString() ?? '';
      final nextActor = data['actor_user_id']?.toString() ?? '';
      if (existingActor.isNotEmpty &&
          nextActor.isNotEmpty &&
          existingActor != nextActor) {
        return -1;
      }
    }
    data['created_at'] = DateTime.now().toIso8601String();
    data['sync_status'] = 'pending';
    data['sync_message'] = 'Menunggu sinkronisasi absensi sholat';
    data['retry_count'] = 0;
    return await db.insert(
      'absensi_sholat_pending',
      data,
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  static Future<List<Map<String, dynamic>>> getPendingAbsensiSholat() async {
    final db = await database;
    return await db.query(
      'absensi_sholat_pending',
      where: 'sync_status IN (?, ?, ?)',
      whereArgs: ['pending', 'failed', 'syncing'],
      orderBy: 'created_at DESC',
    );
  }

  static Future<List<Map<String, dynamic>>> getPendingSholatByScope({
    required String tanggal,
    required int boardingRoomId,
    int? prayerAttendanceTypeId,
    int? actorUserId,
  }) async {
    final db = await database;
    final where = <String>[
      'tanggal = ?',
      'boarding_room_id = ?',
      'COALESCE(prayer_attendance_type_id, 0) = ?',
      'sync_status IN (?, ?, ?)',
    ];
    final args = <Object?>[
      tanggal,
      boardingRoomId,
      prayerAttendanceTypeId ?? 0,
      'pending',
      'failed',
      'syncing',
    ];
    if ((actorUserId ?? 0) > 0) {
      where.add('actor_user_id = ?');
      args.add(actorUserId);
    }

    return await db.query(
      'absensi_sholat_pending',
      where: where.join(' AND '),
      whereArgs: args,
      orderBy: 'created_at DESC',
    );
  }

  static Future<int> deletePendingSholatByScope({
    required String tanggal,
    required int boardingRoomId,
    int? actorUserId,
  }) async {
    final db = await database;
    final where = <String>[
      'tanggal = ?',
      'boarding_room_id = ?',
      'sync_status IN (?, ?, ?)',
    ];
    final args = <Object?>[
      tanggal,
      boardingRoomId,
      'pending',
      'failed',
      'syncing',
    ];
    if ((actorUserId ?? 0) > 0) {
      where.add('actor_user_id = ?');
      args.add(actorUserId);
    }

    return db.delete(
      'absensi_sholat_pending',
      where: where.join(' AND '),
      whereArgs: args,
    );
  }

  // ===== GET COUNT PENDING =====
  static Future<int> countPending() async {
    final db = await database;
    final result = await db.rawQuery(
      '''
      SELECT COUNT(*) as count
      FROM absensi_pending
      WHERE sync_status IN (?, ?, ?)
      ''',
      ['pending', 'failed', 'syncing'],
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
      {
        'sync_status': 'synced',
        'sync_message': message ?? 'Berhasil di-sync',
        'synced_at': DateTime.now().toIso8601String(),
      },
      where: 'id = ?',
      whereArgs: [id],
    );
  }

  static Future<void> markPrayerAsSynced(int id, {String? message}) async {
    final db = await database;
    await db.update(
      'absensi_sholat_pending',
      {
        'sync_status': 'synced',
        'sync_message': message ?? 'Berhasil di-sync',
        'synced_at': DateTime.now().toIso8601String(),
      },
      where: 'id = ?',
      whereArgs: [id],
    );
  }

  static Future<void> markAsSyncing(int id) async {
    final db = await database;
    await db.update(
      'absensi_pending',
      {
        'sync_status': 'syncing',
        'sync_message': 'Sedang mencoba sinkronisasi...',
        'last_attempt_at': DateTime.now().toIso8601String(),
      },
      where: 'id = ?',
      whereArgs: [id],
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
    await db.rawUpdate(
      '''
      UPDATE absensi_pending
      SET retry_count = COALESCE(retry_count, 0) + 1
      WHERE id = ?
      ''',
      [id],
    );
  }

  static Future<void> markPrayerAsSyncing(int id) async {
    final db = await database;
    await db.update(
      'absensi_sholat_pending',
      {
        'sync_status': 'syncing',
        'sync_message': 'Sedang mencoba sinkronisasi...',
        'last_attempt_at': DateTime.now().toIso8601String(),
      },
      where: 'id = ?',
      whereArgs: [id],
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
    await db.rawUpdate(
      '''
      UPDATE absensi_sholat_pending
      SET retry_count = COALESCE(retry_count, 0) + 1
      WHERE id = ?
      ''',
      [id],
    );
  }

  static Future<void> markAsFailed(int id, String message) async {
    final db = await database;
    await db.update(
      'absensi_pending',
      {
        'sync_status': 'failed',
        'sync_message': message,
        'last_attempt_at': DateTime.now().toIso8601String(),
      },
      where: 'id = ?',
      whereArgs: [id],
    );
  }

  static Future<void> markPrayerAsFailed(int id, String message) async {
    final db = await database;
    await db.update(
      'absensi_sholat_pending',
      {
        'sync_status': 'failed',
        'sync_message': message,
        'last_attempt_at': DateTime.now().toIso8601String(),
      },
      where: 'id = ?',
      whereArgs: [id],
    );
  }

  static Future<void> markAsConflict(int id, String message) async {
    final db = await database;
    await db.update(
      'absensi_pending',
      {
        'sync_status': 'conflict',
        'sync_message': message,
        'last_attempt_at': DateTime.now().toIso8601String(),
      },
      where: 'id = ?',
      whereArgs: [id],
    );
  }

  static Future<void> markPrayerAsConflict(int id, String message) async {
    final db = await database;
    await db.update(
      'absensi_sholat_pending',
      {
        'sync_status': 'conflict',
        'sync_message': message,
        'last_attempt_at': DateTime.now().toIso8601String(),
      },
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
    int? classId,
    int? mapelId,
    int? jadwalId,
    int? actorUserId,
  }) async {
    final db = await database;
    final where = <String>['tanggal = ?', 'sync_status IN (?, ?, ?)'];
    final args = <Object?>[tanggal, 'pending', 'failed', 'syncing'];

    if ((classId ?? 0) > 0 && (mapelId ?? 0) > 0 && (jadwalId ?? 0) > 0) {
      where.add('class_id = ? AND mapel_id = ? AND jadwal_id = ?');
      args.addAll([classId, mapelId, jadwalId]);
    } else {
      where.add('kelas = ? AND mapel = ?');
      args.addAll([kelas, mapel]);
    }

    if ((actorUserId ?? 0) > 0) {
      where.add('actor_user_id = ?');
      args.add(actorUserId);
    }

    return await db.query(
      'absensi_pending',
      where: where.join(' AND '),
      whereArgs: args,
      orderBy: 'created_at DESC',
    );
  }

  // ===== DELETE ALL PENDING IN ONE CLASS + SUBJECT =====
  static Future<int> deletePendingByScope({
    required String tanggal,
    required String kelas,
    required String mapel,
    int? classId,
    int? mapelId,
    int? jadwalId,
    int? actorUserId,
  }) async {
    final db = await database;
    final where = <String>['tanggal = ?', 'sync_status IN (?, ?, ?)'];
    final args = <Object?>[tanggal, 'pending', 'failed', 'syncing'];

    if ((classId ?? 0) > 0 && (mapelId ?? 0) > 0 && (jadwalId ?? 0) > 0) {
      where.add('class_id = ? AND mapel_id = ? AND jadwal_id = ?');
      args.addAll([classId, mapelId, jadwalId]);
    } else {
      where.add('kelas = ? AND mapel = ?');
      args.addAll([kelas, mapel]);
    }

    if ((actorUserId ?? 0) > 0) {
      where.add('actor_user_id = ?');
      args.add(actorUserId);
    }

    return await db.delete(
      'absensi_pending',
      where: where.join(' AND '),
      whereArgs: args,
    );
  }

  static String buildAttendanceKey(Map<String, dynamic> data) {
    final tanggal = (data['tanggal']?.toString() ?? '').split('T').first;
    final classId = data['class_id'];
    final mapelId = data['mapel_id'];
    final jadwalId = data['jadwal_id'];
    final siswaId = data['siswa_id'];

    if (tanggal.isEmpty ||
        classId == null ||
        mapelId == null ||
        jadwalId == null ||
        siswaId == null) {
      throw ArgumentError(
        'Absensi offline wajib punya tanggal, class_id, mapel_id, jadwal_id, dan siswa_id.',
      );
    }

    return '${tanggal}_${classId}_${mapelId}_${jadwalId}_$siswaId';
  }

  static String buildPrayerAttendanceKey(Map<String, dynamic> data) {
    final tanggal = (data['tanggal']?.toString() ?? '').split('T').first;
    final siswaId = data['siswa_id'];
    final roomId = data['boarding_room_id'];
    final prayerTypeId = data['prayer_attendance_type_id'] ?? 0;

    if (tanggal.isEmpty || siswaId == null || roomId == null) {
      throw ArgumentError(
        'Absensi sholat offline wajib punya tanggal, boarding_room_id, dan siswa_id.',
      );
    }

    return '${tanggal}_${siswaId}_${roomId}_$prayerTypeId';
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
        ) +
        await db.delete(
          'absensi_sholat_pending',
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
      where: 'tanggal = ? AND sync_status IN (?, ?, ?, ?)',
      whereArgs: [today, 'pending', 'failed', 'syncing', 'conflict'],
      orderBy: 'created_at DESC',
    );
  }
}
