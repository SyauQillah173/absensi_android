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
import 'package:workmanager/workmanager.dart';

import 'api_service.dart';
import 'local_db_service.dart';

class SyncService {
  static final Connectivity _connectivity = Connectivity();
  static StreamSubscription? _subscription;
  static final FlutterLocalNotificationsPlugin _notifications =
      FlutterLocalNotificationsPlugin();
  static final StreamController<AppDataEvent> _dataEvents =
      StreamController<AppDataEvent>.broadcast();
  static bool _isSyncing = false;
  static Timer? _heartbeatTimer;
  static bool? _lastConnectivityState;
  static const String workManagerTaskSyncAbsensi = 'sync_pending_absensi';
  static const String _workManagerOneOffSync = 'sync_pending_absensi_once';
  static const String _workManagerPeriodicSync =
      'sync_pending_absensi_periodic';
  static const String _workManagerTag = 'absensi_madin_sync';

  // Callback untuk update UI
  static Function()? onSyncComplete;
  static Stream<AppDataEvent> get dataEvents => _dataEvents.stream;

  // ===== INIT =====
  static Future<void> init() async {
    await _initNotifications();
    await _requestNotificationPermission();

    // Listen to connectivity changes
    _subscription = _connectivity.onConnectivityChanged.listen((results) {
      // results is List<ConnectivityResult>
      final hasInternet = results.any((r) => r != ConnectivityResult.none);
      if (_lastConnectivityState != hasInternet) {
        _lastConnectivityState = hasInternet;
        _emitEvent(
          AppDataEvent(
            topic: SyncTopics.connectivity,
            message: hasInternet ? 'online' : 'offline',
          ),
        );
      }
      if (hasInternet) {
        // === AUTO-SYNC saat internet tersedia ===
        // Guru cukup nyalakan WiFi → absensi offline otomatis di-sync
        // WorkManager menjadi pengaman background retry saat aplikasi tidak aktif.
        syncPendingAbsensi();
        scheduleOneOffSync();
        _emitEvent(const AppDataEvent(topic: SyncTopics.heartbeat));
      }
    });

    // Cleanup old synced data (>7 hari) saat app start
    await LocalDbService.cleanupOldSyncedData();
    _startHeartbeat();
  }

  static Future<void> initForBackgroundWorker() async {
    await _initNotifications();
  }

  static Future<void> _initNotifications() async {
    const androidSettings = AndroidInitializationSettings(
      '@drawable/ic_stat_notification',
    );
    const initSettings = InitializationSettings(android: androidSettings);
    await _notifications.initialize(initSettings);
  }

  static Future<void> registerBackgroundSync() async {
    if (!Platform.isAndroid) return;
    try {
      await Workmanager().registerPeriodicTask(
        _workManagerPeriodicSync,
        workManagerTaskSyncAbsensi,
        frequency: const Duration(minutes: 15),
        constraints: Constraints(networkType: NetworkType.connected),
        existingWorkPolicy: ExistingPeriodicWorkPolicy.update,
        backoffPolicy: BackoffPolicy.exponential,
        backoffPolicyDelay: const Duration(minutes: 1),
        tag: _workManagerTag,
      );
    } catch (_) {
      // WorkManager tidak boleh mengganggu alur utama aplikasi.
    }
  }

  static Future<void> scheduleOneOffSync() async {
    if (!Platform.isAndroid) return;
    try {
      await Workmanager().registerOneOffTask(
        _workManagerOneOffSync,
        workManagerTaskSyncAbsensi,
        initialDelay: const Duration(minutes: 1),
        constraints: Constraints(networkType: NetworkType.connected),
        existingWorkPolicy: ExistingWorkPolicy.replace,
        backoffPolicy: BackoffPolicy.exponential,
        backoffPolicyDelay: const Duration(minutes: 1),
        tag: _workManagerTag,
      );
    } catch (_) {
      // Sync foreground tetap berjalan walau worker gagal dijadwalkan.
    }
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
    final hasInternet = results.any((r) => r != ConnectivityResult.none);
    _lastConnectivityState = hasInternet;
    return hasInternet;
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
          await LocalDbService.markAsSyncing(item['id'] as int);
          final response = await ApiService.createAbsensi({
            'siswa_id': item['siswa_id'],
            'tanggal': item['tanggal'],
            'status': item['status'],
            'attendance_status_id': item['attendance_status_id'],
            'keterangan': item['keterangan'],
            'kelas': item['kelas'],
            'class_id': item['class_id'],
            'mapel': item['mapel'],
            'mapel_id': item['mapel_id'],
            'jadwal_id': item['jadwal_id'],
            'diinput_oleh': item['diinput_oleh'],
            'actor_user_id': item['actor_user_id'],
            'diinput_via': 'offline_sync',
            'device_id': item['device_id'],
            'attendance_key': item['attendance_key'],
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
          final detail = _syncErrorMessage(e);
          await LocalDbService.markAsFailed(
            item['id'] as int,
            'Sinkronisasi gagal: $detail',
          );
          errors++;
        }
      }

      // === KIRIM NOTIFIKASI DETAIL ===
      if (synced > 0 || conflicts > 0) {
        await _showSyncNotification(synced, conflicts, conflictMessages);
      }

      // Callback UI — update dashboard
      onSyncComplete?.call();
      if (synced > 0 || conflicts > 0 || errors > 0) {
        _emitEvent(
          AppDataEvent(
            topic: SyncTopics.absensi,
            message: errors > 0
                ? 'Ada absensi offline yang gagal sinkron'
                : 'Sinkronisasi absensi berhasil diperbarui',
          ),
        );
      }
    } catch (e) {
      errors++;
    }

    _isSyncing = false;
    return SyncResult(synced: synced, conflicts: conflicts, errors: errors);
  }

  // Fitur di luar scope Bab 1-3 skripsi. Method dipertahankan sebagai guard
  // agar file layar lama yang belum dihapus fisik tidak menyentuh database.
  static Future<SyncResult> syncPendingAbsensiSholat() async {
    return SyncResult(synced: 0, conflicts: 0, errors: 0);
  }

  static String _syncErrorMessage(Object error) {
    final raw = error
        .toString()
        .replaceFirst(RegExp(r'^Exception:\s*'), '')
        .trim();
    if (raw.isEmpty) {
      return 'Akan dicoba lagi saat online.';
    }
    if (raw.length <= 180) {
      return raw;
    }
    return '${raw.substring(0, 180)}...';
  }

  static Future<AbsensiResult> inputAbsensi({
    required int siswaId,
    required String tanggal,
    required String status,
    required String kelas,
    int? classId,
    String? mapel,
    int? mapelId,
    int? jadwalId,
    int? attendanceStatusId,
    String? keterangan,
    required String diinputOleh,
    int? actorUserId,
    String? deviceId,
  }) async {
    final data = {
      'siswa_id': siswaId,
      'tanggal': tanggal,
      'status': status,
      'attendance_status_id': attendanceStatusId,
      'kelas': kelas,
      'class_id': classId,
      'mapel': mapel,
      'mapel_id': mapelId,
      'jadwal_id': jadwalId,
      'keterangan': keterangan,
      'diinput_oleh': diinputOleh,
      'actor_user_id': actorUserId,
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
    final localId = await LocalDbService.insertAbsensiPending(data);
    if (localId < 0) {
      return AbsensiResult(
        success: false,
        mode: 'conflict',
        message:
            'Absensi pending sudah dibuat oleh akun lain di perangkat ini. Gunakan akun pemilik pending atau sinkronkan dulu.',
      );
    }
    await scheduleOneOffSync();
    return AbsensiResult(
      success: true,
      mode: 'offline',
      message: 'Disimpan offline ⏳ Akan di-sync saat ada internet',
    );
  }

  // ===== GUARD FITUR DI LUAR SCOPE SKRIPSI =====
  static Future<AbsensiResult> inputAbsensiSholat({
    required int siswaId,
    required int boardingRoomId,
    int? prayerAttendanceTypeId,
    required String tanggal,
    required String statusCode,
    String? keterangan,
    required String diinputOleh,
    int? actorUserId,
    String? deviceId,
  }) async {
    return AbsensiResult(
      success: false,
      mode: 'disabled',
      message: 'Absensi sholat tidak termasuk scope aplikasi skripsi ini.',
    );
  }

  static Future<AbsensiResult> inputAbsensiSholatBulk({
    required int boardingRoomId,
    int? prayerAttendanceTypeId,
    required String tanggal,
    required List<Map<String, dynamic>> items,
    required String diinputOleh,
    int? actorUserId,
    String? deviceId,
  }) async {
    return AbsensiResult(
      success: false,
      mode: 'disabled',
      message: 'Absensi sholat tidak termasuk scope aplikasi skripsi ini.',
    );
  }

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

  static Future<void> notifyDataChanged(
    String topic, {
    String? message,
    bool showNotification = false,
  }) async {
    _emitEvent(AppDataEvent(topic: topic, message: message));
    onSyncComplete?.call();

    if (showNotification) {
      await showSystemNotification(
        'Data baru tersedia',
        message ?? 'Perubahan data sudah tersinkron',
      );
    }
  }

  static Future<void> showSystemNotification(String title, String body) async {
    await _notifications.show(
      4,
      title,
      body,
      NotificationDetails(
        android: AndroidNotificationDetails(
          'app_updates_channel',
          'Pembaruan Data',
          channelDescription: 'Notifikasi pembaruan data aplikasi',
          importance: Importance.defaultImportance,
          priority: Priority.defaultPriority,
          icon: '@drawable/ic_stat_notification',
          styleInformation: BigTextStyleInformation(body),
        ),
      ),
    );
  }

  static void _startHeartbeat() {
    _heartbeatTimer?.cancel();
    _heartbeatTimer = Timer.periodic(const Duration(seconds: 15), (_) async {
      if (await isOnline()) {
        _emitEvent(const AppDataEvent(topic: SyncTopics.heartbeat));
      }
    });
  }

  static void _emitEvent(AppDataEvent event) {
    if (_dataEvents.isClosed) return;
    _dataEvents.add(event);
  }

  // ===== DISPOSE =====
  static void dispose() {
    _subscription?.cancel();
    _heartbeatTimer?.cancel();
  }
}

class SyncTopics {
  static const String heartbeat = 'heartbeat';
  static const String connectivity = 'connectivity';
  static const String absensi = 'absensi';
  static const String absensiSholat = 'absensi_sholat';
  static const String absensiNgaji = 'absensi_ngaji';
  static const String siswa = 'siswa';
  static const String mapel = 'mapel';
  static const String kelas = 'kelas';
  static const String materi = 'materi';
  static const String kegiatan = 'kegiatan';
  static const String nilai = 'nilai';
  static const String hafalan = 'hafalan';
  static const String pembayaran = 'pembayaran';
  static const String documentSettings = 'document_settings';
  static const String session = 'session';
  static const String user = 'user';
  static const String profile = 'profile';
}

class AppDataEvent {
  final String topic;
  final String? message;

  const AppDataEvent({required this.topic, this.message});
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
