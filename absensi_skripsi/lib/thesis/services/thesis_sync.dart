import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';

import 'thesis_api.dart';
import 'thesis_database.dart';
import 'thesis_session.dart';

class ThesisSync {
  static const taskName = 'thesis-presensi-sync';
  static StreamSubscription<List<ConnectivityResult>>? _subscription;

  static Future<void> initialize() async {
    _subscription ??= Connectivity().onConnectivityChanged.listen((results) {
      if (results.any((item) => item != ConnectivityResult.none)) {
        requestNow();
      }
    });
    await refreshBootstrap();
    await requestNow();
  }

  static Future<void> requestNow() async {
    await ThesisDatabase.instance.requestSync();
  }

  static Future<bool> syncPending() async {
    if (!await ThesisSession.hasValidSession()) return false;
    await ThesisDatabase.instance.requestSync();
    await refreshBootstrap();
    return true;
  }

  static Future<void> refreshBootstrap() async {
    if (!await ThesisSession.hasValidSession()) return;
    try {
      final response = await ThesisApi.get('/sync/bootstrap');
      await ThesisDatabase.instance.replaceBootstrap(
        Map<String, dynamic>.from(response['data'] as Map),
      );
    } catch (_) {
      // Cache Room/SQLite tetap dipakai saat server atau jaringan tidak tersedia.
    }
  }
}
