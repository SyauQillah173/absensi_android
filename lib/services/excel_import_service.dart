import 'dart:io';

import 'package:excel/excel.dart';
import 'package:file_picker/file_picker.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

enum ImportTemplateType { user, guru }

class ExcelImportService {
  static const List<String> schoolUnitOptions = [
    "SMP Assa'adah",
    "SMA Assa'adah",
    "MTs Assa'adah 1",
    "MTs Assa'adah 2",
    "Aliyah Assa'adah",
    "MI Assa'adah",
    "TK Muslimat Assa'adah",
  ];

  static const List<String> guruCategoryOptions = [
    'guru',
    'karyawan',
    'pejabat',
    'sertifikasi',
  ];

  static const List<String> _userHeaders = [
    'name',
    'email',
    'phone',
    'role',
    'password',
    'status',
  ];

  static const List<String> _guruHeaders = [
    'unit_sekolah',
    'name',
    'kode_guru',
    'phone',
    'email',
    'jenis_kelamin',
    'alamat',
    'status',
    'status_sebagai',
    'password',
  ];

  static Future<File> generateTemplate(ImportTemplateType type) async {
    final excel = Excel.createExcel();
    final sheetName = excel.getDefaultSheet() ?? 'Sheet1';
    final sheet = excel[sheetName];

    if (type == ImportTemplateType.user) {
      sheet.appendRow(_userHeaders.map(TextCellValue.new).toList());
      sheet.appendRow([
        TextCellValue('Admin Baru'),
        TextCellValue('adminbaru@absensi.com'),
        TextCellValue('081234567890'),
        TextCellValue('admin'),
        TextCellValue('password123'),
        TextCellValue('Aktif'),
      ]);
      sheet.appendRow([
        TextCellValue('Guru Baru'),
        TextCellValue('gurubaru@absensi.com'),
        TextCellValue('081298765432'),
        TextCellValue('guru'),
        TextCellValue('password123'),
        TextCellValue('Aktif'),
      ]);
    } else {
      sheet.appendRow(_guruHeaders.map(TextCellValue.new).toList());
      sheet.appendRow([
        TextCellValue("MTs Assa'adah 1|Aliyah Assa'adah"),
        TextCellValue('Ust. Contoh Guru'),
        TextCellValue('GRU099'),
        TextCellValue('081234567890'),
        TextCellValue('gurucontoh@absensi.com'),
        TextCellValue('L'),
        TextCellValue('Bungah, Gresik'),
        TextCellValue('Aktif'),
        TextCellValue('guru|sertifikasi'),
        TextCellValue('password123'),
      ]);
    }

    final bytes = excel.encode();
    if (bytes == null) {
      throw Exception('Gagal membuat file template Excel');
    }

    final dir = await getTemporaryDirectory();
    final file = File(
      '${dir.path}\\${type == ImportTemplateType.user ? 'template_import_user' : 'template_import_guru'}.xlsx',
    );
    await file.writeAsBytes(bytes, flush: true);
    return file;
  }

  static Future<void> shareTemplate(ImportTemplateType type) async {
    final file = await generateTemplate(type);
    await Share.shareXFiles(
      [XFile(file.path)],
      text: type == ImportTemplateType.user
          ? 'Template import user/admin/guru/wali'
          : 'Template import data guru',
    );
  }

  static Future<List<Map<String, dynamic>>> pickAndParseRows(
    ImportTemplateType type,
  ) async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['xlsx'],
      withData: true,
    );

    if (result == null || result.files.isEmpty) {
      return [];
    }

    final picked = result.files.single;
    final bytes = picked.bytes ?? await File(picked.path!).readAsBytes();
    final excel = Excel.decodeBytes(bytes);
    final firstSheet = excel.tables.values.first;
    final rows = firstSheet.rows;

    if (rows.isEmpty) return [];

    final headerMap = <int, String>{};
    for (var i = 0; i < rows.first.length; i++) {
      final normalized = _normalizeHeader(_cellText(rows.first[i]));
      if (normalized.isNotEmpty) {
        headerMap[i] = normalized;
      }
    }

    final parsed = <Map<String, dynamic>>[];
    for (var rowIndex = 1; rowIndex < rows.length; rowIndex++) {
      final row = rows[rowIndex];
      final data = <String, dynamic>{};

      for (var colIndex = 0; colIndex < row.length; colIndex++) {
        final header = headerMap[colIndex];
        if (header == null) continue;
        data[header] = _cellText(row[colIndex]).trim();
      }

      if (_isEmptyRow(data)) continue;

      if (type == ImportTemplateType.user) {
        parsed.add({
          'name': data['name'] ?? '',
          'email': data['email'] ?? '',
          'no_hp': data['phone'] ?? data['no_hp'] ?? '',
          'role': (data['role'] ?? '').toLowerCase(),
          'password': data['password'] ?? '',
          'status': _normalizeStatus(data['status']),
        });
      } else {
        parsed.add({
          'name': data['name'] ?? '',
          'email': data['email'] ?? '',
          'no_hp': data['phone'] ?? data['no_hp'] ?? '',
          'role': 'guru',
          'password': data['password'] ?? '',
          'status': _normalizeStatus(data['status']),
          'kode_guru': data['kode_guru'] ?? '',
          'jenis_kelamin': _normalizeGender(data['jenis_kelamin']),
          'alamat': data['alamat'] ?? '',
          'unit_kerja': _splitList(data['unit_sekolah'] ?? data['unit_kerja']),
          'kategori_guru': _splitList(
            data['status_sebagai'] ?? data['kategori_guru'],
          ),
        });
      }
    }

    return parsed;
  }

  static bool _isEmptyRow(Map<String, dynamic> data) {
    for (final value in data.values) {
      if (value.toString().trim().isNotEmpty) {
        return false;
      }
    }
    return true;
  }

  static String _normalizeHeader(String value) {
    return value
        .toLowerCase()
        .replaceAll(RegExp(r'[^a-z0-9]+'), '_')
        .replaceAll(RegExp(r'_+'), '_')
        .replaceAll(RegExp(r'^_|_$'), '');
  }

  static List<String> _splitList(String input) {
    return input
        .split(RegExp(r'[|,;]'))
        .map((item) => item.trim())
        .where((item) => item.isNotEmpty)
        .toList();
  }

  static String _normalizeStatus(dynamic value) {
    final raw = value.toString().trim().toLowerCase();
    if (raw == 'nonaktif') return 'Nonaktif';
    return 'Aktif';
  }

  static String _normalizeGender(dynamic value) {
    final raw = value.toString().trim().toUpperCase();
    if (raw == 'P' || raw == 'PEREMPUAN') return 'P';
    if (raw == 'L' || raw == 'LAKI-LAKI' || raw == 'LAKI LAKI') return 'L';
    return '';
  }

  static String _cellText(Data? cell) {
    final value = cell?.value;
    switch (value) {
      case null:
        return '';
      case TextCellValue():
        return value.value.text?.trim() ?? '';
      default:
        return value.toString().trim();
    }
  }
}
