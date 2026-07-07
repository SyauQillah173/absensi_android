import 'package:flutter/services.dart';
import 'package:uuid/uuid.dart';

class ThesisDatabase {
  ThesisDatabase._();
  static final instance = ThesisDatabase._();
  static const _channel = MethodChannel('absensi_skripsi/room');

  Future<void> initialize() async {
    await _channel.invokeMethod<bool>('initialize');
  }

  Future<void> replaceBootstrap(Map<String, dynamic> data) async {
    await _channel.invokeMethod<bool>('replaceBootstrap', {'data': data});
  }

  Future<List<Map<String, dynamic>>> classes() => _list('classes');

  Future<List<Map<String, dynamic>>> gurus() => _list('gurus');

  Future<List<Map<String, dynamic>>> allStudents() => _list('allStudents');

  Future<List<Map<String, dynamic>>> students(int classId) =>
      _list('students', {'classId': classId});

  Future<String> saveAttendance({
    required int classId,
    required String date,
    required String startTime,
    required List<Map<String, dynamic>> details,
    String? note,
  }) async {
    const uuid = Uuid();
    final operationId = uuid.v4();
    return await _channel.invokeMethod<String>('saveAttendance', {
          'operationId': operationId,
          'classId': classId,
          'date': date,
          'startTime': startTime,
          'details': details,
          'note': note,
          'updatedAt': DateTime.now().toIso8601String(),
        }) ??
        operationId;
  }

  Future<int> pendingCount() async =>
      await _channel.invokeMethod<int>('pendingCount') ?? 0;

  Future<List<Map<String, dynamic>>> history() => _list('history');

  Future<void> requestSync() async {
    await _channel.invokeMethod<bool>('requestSync');
  }

  Future<List<Map<String, dynamic>>> _list(
    String method, [
    Map<String, dynamic>? arguments,
  ]) async {
    final rows = await _channel.invokeListMethod<dynamic>(method, arguments);
    return (rows ?? const [])
        .map((row) => Map<String, dynamic>.from(row as Map))
        .toList();
  }
}
