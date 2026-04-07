// ================================================================
// SYNC SERVICE — Auto Sync Offline → Online
// ================================================================
// File: lib/services/sync_service.dart
//
// Mendeteksi koneksi internet dan auto-sync data pending.
// Anti-duplikat: server akan reject jika sudah ada (409 Conflict).
// Notifikasi detail saat conflict: siapa yang sudah input.
// Sync berjalan BACKGROUND — guru tidak perlu buka app.
// ================================================================

import 'dart:async';
import 'dart:io' show Platform;

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import 'api_service.dart';
import 'local_db_service.dart';

class SyncService {
  static final Connectivity _connectivity = Connectivity();
  static StreamSubscription? _subscription;
  static final FlutterLocalNotificationsPlugin _notifications =
      FlutterLocalNotificationsPlugin();
  static bool _isSyncing = false;

  // Callback untuk update UI
  static Function()? onSyncComplete;

  // ===== INIT =====
  static Future<void> init() async {
    // Init notifications
    const androidSettings = AndroidInitializationSettings(
      '@drawable/ic_stat_notification',
    );
    const initSettings = InitializationSettings(android: androidSettings);
    await _notifications.initialize(initSettings);

    // Request notification permission for Android 13+
    await _requestNotificationPermission();

    // Listen to connectivity changes
    _subscription = _connectivity.onConnectivityChanged.listen((results) {
      // results is List<ConnectivityResult>
      final hasInternet = results.any((r) => r != ConnectivityResult.none);
      if (hasInternet) {
        // === AUTO-SYNC saat internet tersedia ===
        // Guru cukup nyalakan WiFi → absensi offline otomatis di-sync
        // Notifikasi muncul meskipun guru TIDAK buka app
        syncPendingAbsensi();
      }
    });

    // Cleanup old synced data (>7 hari) saat app start
    await LocalDbService.cleanupOldSyncedData();
  }

  // ===== REQUEST NOTIFICATION PERMISSION (Android 13+) =====
  static Future<void> _requestNotificationPermission() async {
    if (Platform.isAndroid) {
      final androidPlugin = _notifications
          .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin
          >();
      if (androidPlugin != null) {
        await androidPlugin.requestNotificationsPermission();
      }
    }
  }

  // ===== CHECK CONNECTIVITY =====
  static Future<bool> isOnline() async {
    final results = await _connectivity.checkConnectivity();
    return results.any((r) => r != ConnectivityResult.none);
  }

  // ===== SYNC ALL PENDING =====
  static Future<SyncResult> syncPendingAbsensi() async {
    if (_isSyncing) return SyncResult(synced: 0, conflicts: 0, errors: 0);
    _isSyncing = true;

    int synced = 0;
    int conflicts = 0;
    int errors = 0;
    final conflictMessages = <String>[];

    try {
      // Cek apakah server bisa dihubungi
      final serverOk = await ApiService.testConnection();
      if (!serverOk) {
        _isSyncing = false;
        return SyncResult(synced: 0, conflicts: 0, errors: 0, serverDown: true);
      }

      final pendingList = await LocalDbService.getPendingAbsensi();
      if (pendingList.isEmpty) {
        _isSyncing = false;
        return SyncResult(synced: 0, conflicts: 0, errors: 0);
      }

      for (final item in pendingList) {
        try {
          final response = await ApiService.createAbsensi({
            'siswa_id': item['siswa_id'],
            'tanggal': item['tanggal'],
            'status': item['status'],
            'keterangan': item['keterangan'],
            'kelas': item['kelas'],
            'mapel': item['mapel'],
            'diinput_oleh': item['diinput_oleh'],
            'diinput_via': 'offline_sync',
            'device_id': item['device_id'],
          });

          if (response['success'] == true) {
            await LocalDbService.markAsSynced(item['id'] as int);
            synced++;
          } else if (response['conflict'] == true) {
            // === CONFLICT: Absensi sudah diinput oleh orang lain ===
            final conflictMsg = response['message'] ?? 'Absensi sudah ada';
            await LocalDbService.markAsConflict(item['id'] as int, conflictMsg);
            conflicts++;
            // Simpan detail conflict untuk notifikasi
            conflictMessages.add(conflictMsg);
          }
        } catch (e) {
          errors++;
        }
      }

      // === KIRIM NOTIFIKASI DETAIL ===
      if (synced > 0 || conflicts > 0) {
        await _showSyncNotification(synced, conflicts, conflictMessages);
      }

      // Callback UI — update dashboard
      onSyncComplete?.call();
    } catch (e) {
      errors++;
    }

    _isSyncing = false;
    return SyncResult(synced: synced, conflicts: conflicts, errors: errors);
  }

  // ===== SMART ABSENSI — Online atau Offline =====
  static Future<AbsensiResult> inputAbsensi({
    required int siswaId,
    required String tanggal,
    required String status,
    required String kelas,
    String? mapel,
    String? keterangan,
    required String diinputOleh,
    String? deviceId,
  }) async {
    final data = {
      'siswa_id': siswaId,
      'tanggal': tanggal,
      'status': status,
      'kelas': kelas,
      'mapel': mapel,
      'keterangan': keterangan,
      'diinput_oleh': diinputOleh,
      'device_id': deviceId,
    };

    final online = await isOnline();

    if (online) {
      try {
        final serverOk = await ApiService.testConnection();
        if (serverOk) {
          // Kirim langsung ke server
          data['diinput_via'] = 'online';
          final response = await ApiService.createAbsensi(data);

          if (response['success'] == true) {
            return AbsensiResult(
              success: true,
              mode: 'online',
              message: 'Absensi berhasil disimpan ke server ✅',
            );
          } else if (response['conflict'] == true) {
            return AbsensiResult(
              success: false,
              mode: 'conflict',
              message: response['message'] ?? 'Absensi sudah ada',
            );
          }
        }
      } catch (e) {
        // Server error, simpan offline
      }
    }

    // Simpan ke SQLite lokal (offline)
    // Data TIDAK pernah expire — tetap ada sampai berhasil sync
    await LocalDbService.insertAbsensiPending(data);
    return AbsensiResult(
      success: true,
      mode: 'offline',
      message: 'Disimpan offline ⏳ Akan di-sync saat ada internet',
    );
  }

  // ===== NOTIFIKASI SYNC (DETAIL) =====
  static Future<void> _showSyncNotification(
    int synced,
    int conflicts,
    List<String> conflictMessages,
  ) async {
    String title = '';
    String body = '';

    if (synced > 0 && conflicts == 0) {
      // Semua berhasil sync
      title = 'Absensi Berhasil Di-sync ✅';
      body = '$synced absensi offline berhasil masuk ke server';
    } else if (synced == 0 && conflicts > 0) {
      // Semua conflict — admin sudah input
      title = 'Absensi Sudah Diinput ⚠️';
      body = conflictMessages.isNotEmpty
          ? conflictMessages.first
          : '$conflicts absensi sudah diinput oleh orang lain';
    } else if (synced > 0 && conflicts > 0) {
      // Sebagian berhasil, sebagian conflict
      title = 'Sinkronisasi Absensi';
      body =
          '$synced berhasil di-sync ✅\n$conflicts sudah diinput sebelumnya ⚠️';
      if (conflictMessages.isNotEmpty) {
        body += '\n${conflictMessages.first}';
      }
    }

    if (title.isEmpty) return;

    await _notifications.show(
      1,
      title,
      body,
      NotificationDetails(
        android: AndroidNotificationDetails(
          'sync_channel',
          'Sinkronisasi',
          channelDescription: 'Notifikasi sinkronisasi absensi',
          importance: Importance.high,
          priority: Priority.high,
          icon: '@drawable/ic_stat_notification',
          styleInformation: BigTextStyleInformation(body),
        ),
      ),
    );
  }

  /// Show notification when absensi saved online (immediate feedback)
  static Future<void> showOnlineSaveNotification(
    String kelas,
    int count,
  ) async {
    await _notifications.show(
      2,
      'Absensi Berhasil ✅',
      '$count siswa kelas $kelas berhasil disimpan ke server',
      const NotificationDetails(
        android: AndroidNotificationDetails(
          'absensi_channel',
          'Absensi',
          channelDescription: 'Notifikasi absensi berhasil',
          importance: Importance.high,
          priority: Priority.high,
          icon: '@drawable/ic_stat_notification',
        ),
      ),
    );
  }

  /// Show notification when absensi saved offline (pending)
  static Future<void> showOfflineSaveNotification(
    String kelas,
    int count,
  ) async {
    await _notifications.show(
      3,
      'Absensi Tersimpan Offline ⏳',
      '$count siswa kelas $kelas disimpan lokal — akan di-sync saat online',
      const NotificationDetails(
        android: AndroidNotificationDetails(
          'absensi_channel',
          'Absensi',
          channelDescription: 'Notifikasi absensi offline',
          importance: Importance.defaultImportance,
          priority: Priority.defaultPriority,
          icon: '@drawable/ic_stat_notification',
        ),
      ),
    );
  }

  // ===== DISPOSE =====
  static void dispose() {
    _subscription?.cancel();
  }
}

// ===== RESULT CLASSES =====
class SyncResult {
  final int synced;
  final int conflicts;
  final int errors;
  final bool serverDown;

  SyncResult({
    required this.synced,
    required this.conflicts,
    required this.errors,
    this.serverDown = false,
  });
}

class AbsensiResult {
  final bool success;
  final String mode; // 'online', 'offline', 'conflict'
  final String message;

  AbsensiResult({
    required this.success,
    required this.mode,
    required this.message,
  });
}
