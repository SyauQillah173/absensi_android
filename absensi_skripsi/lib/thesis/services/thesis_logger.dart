import 'dart:async';

import 'thesis_database.dart';

class ThesisLogger {
  ThesisLogger._();

  static Future<void> info(
    String title, {
    String? message,
    String category = 'aplikasi',
  }) => _write(title, message: message, category: category, status: 'info');

  static Future<void> success(
    String title, {
    String? message,
    String category = 'aplikasi',
  }) => _write(title, message: message, category: category, status: 'success');

  static Future<void> pending(
    String title, {
    String? message,
    String category = 'aplikasi',
  }) => _write(title, message: message, category: category, status: 'pending');

  static Future<void> failed(
    String title, {
    String? message,
    String category = 'aplikasi',
  }) => _write(title, message: message, category: category, status: 'failed');

  static Future<void> _write(
    String title, {
    String? message,
    required String category,
    required String status,
  }) async {
    try {
      await ThesisDatabase.instance.addLog(
        title: title,
        message: message,
        category: category,
        status: status,
      );
    } catch (_) {
      // Log pengujian bersifat pendukung, jadi kegagalan log tidak menghentikan fitur utama.
    }
  }

  static void unawaitedInfo(
    String title, {
    String? message,
    String category = 'aplikasi',
  }) {
    unawaited(info(title, message: message, category: category));
  }
}
