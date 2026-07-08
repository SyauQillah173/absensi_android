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

  Future<List<Map<String, dynamic>>> mapels() => _list('mapels');

  Future<List<Map<String, dynamic>>> gurus() => _list('gurus');

  Future<List<Map<String, dynamic>>> allStudents() => _list('allStudents');

  Future<List<Map<String, dynamic>>> students(int classId) =>
      _list('students', {'classId': classId});

  Future<String> saveAttendance({
    required int classId,
    required int mapelId,
    required String date,
    required String startTime,
    required List<Map<String, dynamic>> details,
    String? mapel,
    String? note,
  }) async {
    const uuid = Uuid();
    final operationId = uuid.v4();
    return await _channel.invokeMethod<String>('saveAttendance', {
          'operationId': operationId,
          'classId': classId,
          'mapelId': mapelId,
          'date': date,
          'startTime': startTime,
          'mapel': mapel,
          'details': details,
          'note': note,
          'updatedAt': DateTime.now().toIso8601String(),
        }) ??
        operationId;
  }

  Future<Map<String, dynamic>?> attendance(String localId) async {
    final result = await _channel.invokeMapMethod<dynamic, dynamic>(
      'attendance',
      {'localId': localId},
    );
    return result == null ? null : Map<String, dynamic>.from(result);
  }

  Future<Map<String, dynamic>?> attendanceByScope({
    required int classId,
    required int mapelId,
    required String date,
    required String startTime,
  }) async {
    final result = await _channel.invokeMapMethod<dynamic, dynamic>(
      'attendanceByScope',
      {
        'classId': classId,
        'mapelId': mapelId,
        'date': date,
        'startTime': startTime,
      },
    );
    return result == null ? null : Map<String, dynamic>.from(result);
  }

  Future<String> updateAttendance({
    required String localId,
    required int classId,
    required int mapelId,
    required String date,
    required String startTime,
    required List<Map<String, dynamic>> details,
    String? mapel,
    String? note,
  }) async {
    const uuid = Uuid();
    final operationId = uuid.v4();
    return await _channel.invokeMethod<String>('updateAttendance', {
          'localId': localId,
          'operationId': operationId,
          'classId': classId,
          'mapelId': mapelId,
          'date': date,
          'startTime': startTime,
          'mapel': mapel,
          'details': details,
          'note': note,
          'updatedAt': DateTime.now().toIso8601String(),
        }) ??
        operationId;
  }

  Future<void> deleteAttendance(String localId) async {
    const uuid = Uuid();
    await _channel.invokeMethod<bool>('deleteAttendance', {
      'localId': localId,
      'operationId': uuid.v4(),
      'updatedAt': DateTime.now().toIso8601String(),
    });
  }

  Future<Map<String, dynamic>> saveMaster({
    required String entity,
    required Map<String, dynamic> data,
  }) async {
    const uuid = Uuid();
    final result = await _channel
        .invokeMapMethod<dynamic, dynamic>('saveMaster', {
          'entity': entity,
          'operationId': uuid.v4(),
          'data': data,
          'updatedAt': DateTime.now().toIso8601String(),
        });
    return Map<String, dynamic>.from(result ?? const {});
  }

  Future<void> deleteMaster({required String entity, required int id}) async {
    const uuid = Uuid();
    await _channel.invokeMethod<bool>('deleteMaster', {
      'entity': entity,
      'id': id,
      'operationId': uuid.v4(),
      'updatedAt': DateTime.now().toIso8601String(),
    });
  }

  Future<int> pendingCount() async =>
      await _channel.invokeMethod<int>('pendingCount') ?? 0;

  Future<Map<String, dynamic>> syncStatus() async {
    final result = await _channel.invokeMapMethod<dynamic, dynamic>(
      'syncStatus',
    );
    return Map<String, dynamic>.from(result ?? const {});
  }

  Future<List<Map<String, dynamic>>> history() => _list('history');

  Future<void> requestSync() async {
    await _channel.invokeMethod<bool>('requestSync');
  }

  Future<Map<String, dynamic>> syncNow() async {
    final result = await _channel.invokeMapMethod<dynamic, dynamic>('syncNow');
    return Map<String, dynamic>.from(result ?? const {});
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
