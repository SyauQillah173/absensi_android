import 'dart:io';

import 'package:excel/excel.dart';
import 'package:file_picker/file_picker.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

enum ImportTemplateType { user, guru, siswa }

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
  static const _passwordTemplateHint = 'IsiPasswordAwal!2026';
  static const Set<String> _userMandatoryHeaders = {
    'name',
    'email',
    'phone',
    'role',
    'password',
    'status',
  };
  static const Set<String> _guruMandatoryHeaders = {
    'name',
    'kode_guru',
    'phone',
    'email',
    'status',
    'password',
  };

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

  static const List<String> _siswaHeaders = [
    'nis',
    'nisn',
    'nama_lengkap_siswa',
    'jenis_kelamin',
    'nama_wali',
    'status_siswa',
    'kelompok_belajar',
    'tempat_lahir',
    'tanggal_lahir',
    'alamat_lengkap',
    'kewarganegaraan',
    'provinsi',
    'kota',
    'kecamatan',
    'kelurahan',
    'kode_pos',
    'no_hp_whatsapp',
    'email',
    'nama_ayah',
    'nama_ibu',
    'asal_sekolah',
    'tahun_akademik_masuk',
    'jenis_santri',
    'tanggal_masuk',
    'catatan_lain',
  ];

  static Future<File> generateTemplate(ImportTemplateType type) async {
    final excel = Excel.createExcel();
    final sheetName = excel.getDefaultSheet() ?? 'Sheet1';
    final sheet = excel[sheetName];

    if (type == ImportTemplateType.user) {
      sheet.appendRow([TextCellValue('TEMPLATE IMPORT USER / AKUN APLIKASI')]);
      sheet.appendRow([
        TextCellValue(
          'PETUNJUK: Jangan ubah nama header. Kolom bertanda (*) wajib. role isi admin, guru, atau wali. status isi Aktif atau Nonaktif.',
        ),
      ]);
      _appendHeaderRow(sheet, _userHeaders, _userMandatoryHeaders);
      sheet.appendRow([
        TextCellValue('Admin Baru'),
        TextCellValue('adminbaru@absensi.com'),
        TextCellValue('081234567890'),
        TextCellValue('admin'),
        TextCellValue(_passwordTemplateHint),
        TextCellValue('Aktif'),
      ]);
      sheet.appendRow([
        TextCellValue('Wali Baru'),
        TextCellValue('walibaru@absensi.com'),
        TextCellValue('081277788899'),
        TextCellValue('wali'),
        TextCellValue(_passwordTemplateHint),
        TextCellValue('Aktif'),
      ]);
    } else if (type == ImportTemplateType.guru) {
      sheet.appendRow([TextCellValue('TEMPLATE IMPORT DATA GURU')]);
      sheet.appendRow([
        TextCellValue(
          'PETUNJUK: Jangan ubah nama header. Kolom bertanda (*) wajib. unit_sekolah dan status_sebagai bisa lebih dari satu, pisahkan dengan tanda |.',
        ),
      ]);
      _appendHeaderRow(sheet, _guruHeaders, _guruMandatoryHeaders);
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
        TextCellValue(_passwordTemplateHint),
      ]);
    } else {
      _buildSiswaTemplateSheet(sheet);
    }

    final bytes = excel.encode();
    if (bytes == null) {
      throw Exception('Gagal membuat file template Excel');
    }

    final dir = await getTemporaryDirectory();
    final file = File(
      '${dir.path}\\${switch (type) {
        ImportTemplateType.user => 'template_import_user',
        ImportTemplateType.guru => 'template_import_guru',
        ImportTemplateType.siswa => 'template_import_siswa',
      }}.xlsx',
    );
    await file.writeAsBytes(bytes, flush: true);
    return file;
  }

  static Future<void> shareTemplate(ImportTemplateType type) async {
    final file = await generateTemplate(type);
    await Share.shareXFiles(
      [XFile(file.path)],
      text: switch (type) {
        ImportTemplateType.user => 'Template import user/admin/guru/wali',
        ImportTemplateType.guru => 'Template import data guru',
        ImportTemplateType.siswa => 'Template import data siswa',
      },
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
    final expectedHeaders = _expectedHeaders(type);
    List<List<Data?>> rows = const [];
    int headerRowIndex = -1;

    for (final table in excel.tables.values) {
      final candidate = _findHeaderRowIndex(table.rows, expectedHeaders);
      if (candidate != null) {
        rows = table.rows;
        headerRowIndex = candidate;
        break;
      }
    }

    if (rows.isEmpty || headerRowIndex < 0) return [];

    final headerMap = <int, String>{};
    final headerRow = rows[headerRowIndex];
    for (var i = 0; i < headerRow.length; i++) {
      final normalized = _normalizeHeader(_cellText(headerRow[i]));
      if (normalized.isNotEmpty) {
        headerMap[i] = normalized;
      }
    }

    final parsed = <Map<String, dynamic>>[];
    for (
      var rowIndex = headerRowIndex + 1;
      rowIndex < rows.length;
      rowIndex++
    ) {
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
      } else if (type == ImportTemplateType.guru) {
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
      } else {
        parsed.add({
          'nis': data['nis'] ?? '',
          'nisn': data['nisn'] ?? '',
          'nama': data['nama_lengkap_siswa'] ?? data['nama'] ?? '',
          'jenis_kelamin': _normalizeGender(data['jenis_kelamin']),
          'nama_wali':
              data['nama_wali'] ??
              data['nama_wali_orang_tua'] ??
              data['nama_wali_keluarga'] ??
              '',
          'status': _normalizeStatus(data['status_siswa'] ?? data['status']),
          'kelas':
              data['kelompok_belajar'] ??
              data['kelas_sifir'] ??
              data['kelas'] ??
              data['sifir'] ??
              '',
          'tempat_lahir': data['tempat_lahir'] ?? '',
          'tanggal_lahir': _normalizeDateText(data['tanggal_lahir']),
          'alamat': data['alamat_lengkap'] ?? data['alamat'] ?? '',
          'kewarganegaraan': data['kewarganegaraan'] ?? 'Indonesia',
          'provinsi': data['provinsi'] ?? '',
          'kota': data['kota'] ?? '',
          'kecamatan': data['kecamatan'] ?? '',
          'kelurahan': data['kelurahan'] ?? '',
          'kode_pos': data['kode_pos'] ?? '',
          'no_whatsapp': data['no_hp_whatsapp'] ?? data['no_whatsapp'] ?? '',
          'no_telepon_wali':
              data['no_telepon_wali'] ??
              data['no_hp_whatsapp'] ??
              data['no_whatsapp'] ??
              '',
          'email_siswa': data['email'] ?? data['email_siswa'] ?? '',
          'nama_ayah': data['nama_ayah'] ?? '',
          'nama_ibu': data['nama_ibu'] ?? '',
          'asal_sekolah': data['asal_sekolah'] ?? '',
          'tahun_akademik_masuk': data['tahun_akademik_masuk'] ?? '',
          'jenis_santri': data['jenis_santri'] ?? '',
          'tanggal_masuk': _normalizeDateText(data['tanggal_masuk']),
          'catatan_santri':
              data['catatan_lain'] ?? data['catatan_santri'] ?? '',
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

  static Set<String> _expectedHeaders(ImportTemplateType type) {
    switch (type) {
      case ImportTemplateType.user:
        return _userHeaders.map(_normalizeHeader).toSet();
      case ImportTemplateType.guru:
        return _guruHeaders.map(_normalizeHeader).toSet();
      case ImportTemplateType.siswa:
        return _siswaHeaders.map(_normalizeHeader).toSet();
    }
  }

  static int? _findHeaderRowIndex(
    List<List<Data?>> rows,
    Set<String> expectedHeaders,
  ) {
    for (
      var rowIndex = 0;
      rowIndex < rows.length && rowIndex < 12;
      rowIndex++
    ) {
      final row = rows[rowIndex];
      final normalizedHeaders = row
          .map((cell) => _normalizeHeader(_cellText(cell)))
          .where((value) => value.isNotEmpty)
          .toSet();
      final matchCount = normalizedHeaders.intersection(expectedHeaders).length;
      if (matchCount >= 3) {
        return rowIndex;
      }
    }
    return null;
  }

  static void _buildSiswaTemplateSheet(Sheet sheet) {
    final titleStyle = CellStyle(
      bold: true,
      fontSize: 16,
      horizontalAlign: HorizontalAlign.Center,
      verticalAlign: VerticalAlign.Center,
      backgroundColorHex: ExcelColor.fromHexString('#138F81'),
      fontColorHex: ExcelColor.fromHexString('#FFFFFF'),
    );
    final subTitleStyle = CellStyle(
      bold: true,
      fontSize: 11,
      horizontalAlign: HorizontalAlign.Center,
      verticalAlign: VerticalAlign.Center,
      backgroundColorHex: ExcelColor.fromHexString('#EAF6F4'),
      fontColorHex: ExcelColor.fromHexString('#138F81'),
    );
    final infoStyle = CellStyle(
      backgroundColorHex: ExcelColor.fromHexString('#FFF7E6'),
      fontColorHex: ExcelColor.fromHexString('#8A5A00'),
      textWrapping: TextWrapping.WrapText,
      verticalAlign: VerticalAlign.Top,
    );
    final headerMandatoryStyle = CellStyle(
      bold: true,
      backgroundColorHex: ExcelColor.fromHexString('#D8F3EE'),
      fontColorHex: ExcelColor.fromHexString('#0F6D62'),
      horizontalAlign: HorizontalAlign.Center,
      verticalAlign: VerticalAlign.Center,
      textWrapping: TextWrapping.WrapText,
    );
    final headerOptionalStyle = CellStyle(
      bold: true,
      backgroundColorHex: ExcelColor.fromHexString('#EAF1FF'),
      fontColorHex: ExcelColor.fromHexString('#2E5AAC'),
      horizontalAlign: HorizontalAlign.Center,
      verticalAlign: VerticalAlign.Center,
      textWrapping: TextWrapping.WrapText,
    );
    final sampleStyle = CellStyle(
      backgroundColorHex: ExcelColor.fromHexString('#F8FBFF'),
      textWrapping: TextWrapping.WrapText,
      verticalAlign: VerticalAlign.Center,
    );

    sheet.merge(CellIndex.indexByString('A1'), CellIndex.indexByString('Y1'));
    sheet.cell(CellIndex.indexByString('A1'))
      ..value = TextCellValue('TEMPLATE IMPORT DATA SISWA / BUKU INDUK')
      ..cellStyle = titleStyle;

    sheet.merge(CellIndex.indexByString('A2'), CellIndex.indexByString('Y2'));
    sheet.cell(CellIndex.indexByString('A2'))
      ..value = TextCellValue(
        'Gunakan template ini untuk input massal siswa. Kolom wajib ditandai tanda bintang (*), kolom lain boleh dikosongkan.',
      )
      ..cellStyle = subTitleStyle;

    sheet.merge(CellIndex.indexByString('A4'), CellIndex.indexByString('Y4'));
    sheet.cell(CellIndex.indexByString('A4'))
      ..value = TextCellValue(
        'PETUNJUK: 1) Jangan ubah nama header. 2) Kolom wajib: nis, nama_lengkap_siswa, jenis_kelamin. 3) Format tanggal gunakan YYYY-MM-DD. 4) status_siswa isi Aktif, Nonaktif, atau Lulus. 5) jenis_santri resmi: Santri Pondok, Santri Madin, atau Keduanya. 6) kelompok_belajar, asal_sekolah, dan wilayah harus sesuai master jika diisi; data opsional yang tidak cocok akan dikosongkan dengan warning.',
      )
      ..cellStyle = infoStyle;

    final mandatoryHeaders = <String>{
      'nis',
      'nama_lengkap_siswa',
      'jenis_kelamin',
    };

    for (var i = 0; i < _siswaHeaders.length; i++) {
      final isMandatory = mandatoryHeaders.contains(_siswaHeaders[i]);
      final label = isMandatory ? '${_siswaHeaders[i]} *' : _siswaHeaders[i];
      sheet.cell(CellIndex.indexByColumnRow(columnIndex: i, rowIndex: 5))
        ..value = TextCellValue(label)
        ..cellStyle = isMandatory ? headerMandatoryStyle : headerOptionalStyle;
    }

    final sampleRow = [
      '2024001',
      '0012345001',
      'ABDUL HANIF AWINDRA PUTRA',
      'L',
      'Bp. Ahmad Fauzi',
      'Aktif',
      'Sifir Awal A PA',
      'Gresik',
      '2010-03-15',
      'Jl. Contoh No. 1, Gresik',
      'Indonesia',
      '',
      '',
      '',
      '',
      '61152',
      '081234567890',
      'santri@example.com',
      'Ahmad Fauzi',
      'Siti Aisyah',
      'MI Qomaruddin',
      '2025/2026',
      'Santri Madin',
      '2025-07-01',
      'Kolom opsional boleh dikosongkan',
    ];

    for (var i = 0; i < sampleRow.length; i++) {
      sheet.cell(CellIndex.indexByColumnRow(columnIndex: i, rowIndex: 6))
        ..value = TextCellValue(sampleRow[i])
        ..cellStyle = sampleStyle;
    }

    final widths = <int, double>{
      0: 14,
      1: 16,
      2: 28,
      3: 12,
      4: 22,
      5: 14,
      6: 20,
      7: 16,
      8: 16,
      9: 26,
      10: 16,
      11: 16,
      12: 16,
      13: 16,
      14: 18,
      15: 12,
      16: 18,
      17: 22,
      18: 20,
      19: 20,
      20: 18,
      21: 18,
      22: 18,
      23: 16,
      24: 26,
    };

    for (final entry in widths.entries) {
      sheet.setColumnWidth(entry.key, entry.value);
    }
  }

  static void _appendHeaderRow(
    Sheet sheet,
    List<String> headers,
    Set<String> mandatoryHeaders,
  ) {
    sheet.appendRow(
      headers.map((header) {
        final label = mandatoryHeaders.contains(header) ? '$header *' : header;
        return TextCellValue(label);
      }).toList(),
    );
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
    if (raw == 'lulus' || raw == 'alumni' || raw == 'graduated') {
      return 'Lulus';
    }
    if (raw == 'nonaktif') return 'Nonaktif';
    return 'Aktif';
  }

  static String _normalizeGender(dynamic value) {
    final raw = value.toString().trim().toUpperCase();
    if (raw == 'P' || raw == 'PEREMPUAN') return 'P';
    if (raw == 'L' || raw == 'LAKI-LAKI' || raw == 'LAKI LAKI') return 'L';
    return '';
  }

  static String _normalizeDateText(dynamic value) {
    final raw = value.toString().trim();
    if (raw.isEmpty) return '';

    final normalized = raw.replaceAll('/', '-');
    final parts = normalized.split('-');
    if (parts.length == 3 &&
        parts[0].length == 2 &&
        parts[1].length == 2 &&
        parts[2].length == 4) {
      return '${parts[2]}-${parts[1]}-${parts[0]}';
    }

    return normalized;
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
