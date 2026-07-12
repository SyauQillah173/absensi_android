import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';

import 'thesis_api.dart';
import 'thesis_database.dart';
import 'thesis_logger.dart';
import 'thesis_session.dart';

class ThesisSync {
  static const taskName = 'thesis-presensi-sync';
  static StreamSubscription<List<ConnectivityResult>>? _subscription;

  static Future<void> initialize() async {
    _subscription ??= Connectivity().onConnectivityChanged.listen((results) {
      if (results.any((item) => item != ConnectivityResult.none)) {
        ThesisLogger.unawaitedInfo(
          'Koneksi internet terdeteksi',
          message: 'Aplikasi menjalankan sinkronisasi otomatis.',
          category: 'online-first',
        );
        unawaited(syncPending());
      } else {
        ThesisLogger.unawaitedInfo(
          'Aplikasi masuk mode offline',
          message:
              'Data presensi akan disimpan lokal sampai jaringan tersedia.',
          category: 'offline-first',
        );
      }
    });
    ThesisLogger.unawaitedInfo(
      'Offline-first diinisialisasi',
      message: 'Cache lokal, listener koneksi, dan WorkManager disiapkan.',
      category: 'offline-first',
    );
    await refreshBootstrap();
    await syncPending();
  }

  static Future<void> requestNow() async {
    await ThesisDatabase.instance.requestSync();
  }

  static Future<Map<String, dynamic>> syncPending() async {
    if (!await ThesisSession.hasValidSession()) {
      ThesisLogger.unawaitedInfo(
        'Sinkronisasi dilewati',
        message: 'Sesi login belum valid.',
        category: 'sync',
      );
      return const {'pending': 0, 'synced': 0, 'failed': 0};
    }
    await ThesisDatabase.instance.requestSync();
    if (!await ThesisDatabase.instance.hasInternet()) {
      ThesisLogger.unawaitedInfo(
        'Sinkronisasi menunggu internet',
        message:
            'Data tetap tersimpan lokal dan akan otomatis dikirim saat jaringan valid tersedia.',
        category: 'offline-first',
      );
      final status = await ThesisDatabase.instance.syncStatus();
      return <String, dynamic>{
        ...status,
        'online': false,
        'synced': 0,
        'failed': status['failed'] ?? 0,
      };
    }
    try {
      final result = await ThesisDatabase.instance.syncNow();
      ThesisLogger.unawaitedInfo(
        'Sinkronisasi pending selesai',
        message:
            'Synced ${result['synced'] ?? 0}, failed ${result['failed'] ?? 0}, pending ${result['pending'] ?? 0}.',
        category: 'sync',
      );
      if ((result['synced'] as num? ?? 0) > 0 ||
          (result['pending'] as num? ?? 0) == 0) {
        await refreshBootstrap();
      }
      return result;
    } catch (_) {
      // WorkManager tetap menyimpan retry ketika sinkronisasi foreground gagal.
      ThesisLogger.unawaitedInfo(
        'Sinkronisasi foreground gagal',
        message: 'WorkManager tetap menyimpan retry otomatis.',
        category: 'sync',
      );
      return ThesisDatabase.instance.syncStatus();
    }
  }

  static Future<void> refreshBootstrap() async {
    if (!await ThesisSession.hasValidSession()) return;
    try {
      final response = await ThesisApi.get('/sync/bootstrap');
      await ThesisDatabase.instance.replaceBootstrap(
        Map<String, dynamic>.from(response['data'] as Map),
      );
      ThesisLogger.unawaitedInfo(
        'Data master berhasil diperbarui',
        message: 'Aplikasi menerima data guru, kelas, dan santri dari server.',
        category: 'sync',
      );
    } catch (_) {
      // Cache Room/SQLite tetap dipakai saat server atau jaringan tidak tersedia.
      ThesisLogger.unawaitedInfo(
        'Data master memakai cache lokal',
        message:
            'Server atau jaringan belum tersedia, aplikasi tetap menggunakan data lokal.',
        category: 'offline-first',
      );
    }
  }
}
