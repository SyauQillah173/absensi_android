import 'dart:convert';
import 'dart:io';

import 'package:archive/archive.dart';
import 'package:excel/excel.dart';
import 'package:file_picker/file_picker.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import 'api_service.dart';

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

  static const List<String> _fallbackClasses = [
    'Sifir Awal A PA',
    'Sifir Awal B PI',
    'Sifir Tsani A PA',
    'Sifir Tsani B PI',
  ];
  static const List<String> _fallbackSchoolOrigins = [
    "MI Assa'adah",
    'MI Qomaruddin',
    "MTs Assa'adah 1",
    "SMP Assa'adah",
  ];
  static const List<String> _fallbackProvinces = [
    'Jawa Timur',
    'Jawa Tengah',
    'Jawa Barat',
    'DKI Jakarta',
  ];
  static const List<String> _fallbackCities = [
    'Kabupaten Gresik',
    'Kota Surabaya',
    'Kabupaten Lamongan',
    'Kabupaten Sidoarjo',
  ];
  static const List<String> _fallbackDistricts = [
    'Bungah',
    'Manyar',
    'Sidayu',
    'Dukun',
    'Ujung Pangkah',
  ];
  static const List<String> _fallbackVillages = [
    'Bungah',
    'Sukorejo',
    'Indrodelik',
    'Pegundan',
    'Abar-abir',
  ];
  static const List<String> _studentTypeOptions = [
    'Santri Madin',
    'Santri Pondok',
    'Keduanya',
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
    excel.rename(sheetName, 'Template');
    excel.setDefaultSheet('Template');
    final masterData = await _loadTemplateMasterData();
    final sheet = excel['Template'];

    if (type == ImportTemplateType.user) {
      _buildUserTemplateSheet(sheet);
    } else if (type == ImportTemplateType.guru) {
      _buildGuruTemplateSheet(sheet);
    } else {
      _buildSiswaTemplateSheet(sheet, masterData);
    }
    _buildMasterSheet(excel['Master'], masterData);
    _buildGuideSheet(excel['Petunjuk'], type);

    final bytes = excel.encode();
    if (bytes == null) {
      throw Exception('Gagal membuat file template Excel');
    }
    final outputBytes = type == ImportTemplateType.siswa
        ? _addSiswaDropdownValidations(bytes)
        : bytes;

    final dir = await getTemporaryDirectory();
    final file = File(
      '${dir.path}\\${switch (type) {
        ImportTemplateType.user => 'template_import_user',
        ImportTemplateType.guru => 'template_import_guru',
        ImportTemplateType.siswa => 'template_import_siswa',
      }}.xlsx',
    );
    await file.writeAsBytes(outputBytes, flush: true);
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

  static void _buildUserTemplateSheet(Sheet sheet) {
    _buildBasicTemplateSheet(
      sheet: sheet,
      title: 'TEMPLATE IMPORT USER / AKUN APLIKASI',
      hint:
          'PETUNJUK: Jangan ubah nama header. role isi admin, guru, atau wali. status isi Aktif atau Nonaktif.',
      headers: _userHeaders,
      mandatoryHeaders: _userMandatoryHeaders,
      sampleRows: const [
        [
          'Admin Baru',
          'adminbaru@absensi.com',
          '081234567890',
          'admin',
          _passwordTemplateHint,
          'Aktif',
        ],
        [
          'Wali Baru',
          'walibaru@absensi.com',
          '081277788899',
          'wali',
          _passwordTemplateHint,
          'Aktif',
        ],
      ],
      checks: const [
        _TemplateCheck('cek_role', 'role', 10, true),
        _TemplateCheck('cek_status', 'status', 1, true),
      ],
    );
  }

  static void _buildGuruTemplateSheet(Sheet sheet) {
    _buildBasicTemplateSheet(
      sheet: sheet,
      title: 'TEMPLATE IMPORT DATA GURU',
      hint:
          'PETUNJUK: Jangan ubah nama header. unit_sekolah dan status_sebagai bisa lebih dari satu, pisahkan dengan tanda |.',
      headers: _guruHeaders,
      mandatoryHeaders: _guruMandatoryHeaders,
      sampleRows: const [
        [
          "MTs Assa'adah 1|Aliyah Assa'adah",
          'Ust. Contoh Guru',
          'GRU099',
          '081234567890',
          'gurucontoh@absensi.com',
          'L',
          'Bungah, Gresik',
          'Aktif',
          'guru|sertifikasi',
          _passwordTemplateHint,
        ],
      ],
      checks: const [
        _TemplateCheck('cek_jk', 'jenis_kelamin', 0, false),
        _TemplateCheck('cek_status', 'status', 1, true),
      ],
    );
  }

  static void _buildBasicTemplateSheet({
    required Sheet sheet,
    required String title,
    required String hint,
    required List<String> headers,
    required Set<String> mandatoryHeaders,
    required List<List<String>> sampleRows,
    required List<_TemplateCheck> checks,
  }) {
    final titleStyle = _titleStyle();
    final subTitleStyle = _subTitleStyle();
    final infoStyle = _infoStyle();
    final mandatoryStyle = _mandatoryHeaderStyle();
    final optionalStyle = _optionalHeaderStyle();
    final checkStyle = _checkHeaderStyle();
    final sampleStyle = _sampleStyle();

    final allHeaders = [...headers, ...checks.map((check) => check.label)];
    final lastCell = '${_columnName(allHeaders.length - 1)}1';
    sheet.merge(
      CellIndex.indexByString('A1'),
      CellIndex.indexByString(lastCell),
    );
    sheet.cell(CellIndex.indexByString('A1'))
      ..value = TextCellValue(title)
      ..cellStyle = titleStyle;

    sheet.merge(
      CellIndex.indexByString('A2'),
      CellIndex.indexByString('${_columnName(allHeaders.length - 1)}2'),
    );
    sheet.cell(CellIndex.indexByString('A2'))
      ..value = TextCellValue(hint)
      ..cellStyle = subTitleStyle;

    sheet.merge(
      CellIndex.indexByString('A4'),
      CellIndex.indexByString('${_columnName(allHeaders.length - 1)}4'),
    );
    sheet.cell(CellIndex.indexByString('A4'))
      ..value = TextCellValue(
        'Kolom cek_* berisi rumus bantu. Jika muncul CEK atau WAJIB, periksa lagi sebelum import. Backend tetap memvalidasi data terhadap master database.',
      )
      ..cellStyle = infoStyle;

    for (var i = 0; i < allHeaders.length; i++) {
      final isCheck = i >= headers.length;
      final header = allHeaders[i];
      final isMandatory = mandatoryHeaders.contains(header);
      sheet.cell(CellIndex.indexByColumnRow(columnIndex: i, rowIndex: 5))
        ..value = TextCellValue(isMandatory ? '$header *' : header)
        ..cellStyle = isCheck
            ? checkStyle
            : isMandatory
            ? mandatoryStyle
            : optionalStyle;
      sheet.setColumnWidth(i, isCheck ? 16 : 22);
    }

    for (var rowIndex = 0; rowIndex < sampleRows.length; rowIndex++) {
      final excelRow = rowIndex + 6;
      final row = sampleRows[rowIndex];
      for (var col = 0; col < headers.length; col++) {
        sheet.cell(
            CellIndex.indexByColumnRow(columnIndex: col, rowIndex: excelRow),
          )
          ..value = TextCellValue(row[col])
          ..cellStyle = sampleStyle;
      }
      _appendCheckFormulas(sheet, headers, checks, excelRow);
    }

    for (var excelRow = sampleRows.length + 6; excelRow <= 250; excelRow++) {
      _appendCheckFormulas(sheet, headers, checks, excelRow);
    }
  }

  static void _buildSiswaTemplateSheet(
    Sheet sheet,
    _TemplateMasterData masterData,
  ) {
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
        'PETUNJUK: 1) Jangan ubah nama header. 2) Kolom wajib: nis, nama_lengkap_siswa, jenis_kelamin. 3) Kolom tempat_lahir, tanggal_lahir, alamat_lengkap, kewarganegaraan, provinsi, kota, kecamatan, dan kelurahan diberi dropdown/validasi master. 4) Dropdown bersifat warning, tetap boleh ketik manual jika data belum ada di master. 5) Format tanggal gunakan YYYY-MM-DD. 6) Data opsional yang tidak cocok akan diberi warning saat import.',
      )
      ..cellStyle = infoStyle;

    final mandatoryHeaders = <String>{
      'nis',
      'nama_lengkap_siswa',
      'jenis_kelamin',
      'nama_wali',
      'status_siswa',
      'kelompok_belajar',
    };
    final checks = <_TemplateCheck>[
      const _TemplateCheck('cek_jk', 'jenis_kelamin', 0, true),
      const _TemplateCheck('cek_status', 'status_siswa', 1, true),
      const _TemplateCheck('cek_kelas', 'kelompok_belajar', 2, true),
      const _TemplateCheck('cek_kewarganegaraan', 'kewarganegaraan', 3, false),
      const _TemplateCheck('cek_provinsi', 'provinsi', 4, false),
      const _TemplateCheck('cek_kota', 'kota', 5, false),
      const _TemplateCheck(
        'cek_kecamatan',
        'kecamatan',
        6,
        false,
        'CEK MASTER',
      ),
      const _TemplateCheck(
        'cek_kelurahan',
        'kelurahan',
        7,
        false,
        'CEK MASTER',
      ),
      const _TemplateCheck('cek_asal_sekolah', 'asal_sekolah', 8, false),
      const _TemplateCheck('cek_jenis_santri', 'jenis_santri', 9, false),
      const _TemplateCheck(
        'cek_tgl_lahir',
        'tanggal_lahir',
        null,
        false,
        'YYYY-MM-DD',
      ),
      const _TemplateCheck(
        'cek_tgl_masuk',
        'tanggal_masuk',
        null,
        false,
        'YYYY-MM-DD',
      ),
    ];

    for (var i = 0; i < _siswaHeaders.length; i++) {
      final isMandatory = mandatoryHeaders.contains(_siswaHeaders[i]);
      final label = isMandatory ? '${_siswaHeaders[i]} *' : _siswaHeaders[i];
      sheet.cell(CellIndex.indexByColumnRow(columnIndex: i, rowIndex: 5))
        ..value = TextCellValue(label)
        ..cellStyle = isMandatory ? headerMandatoryStyle : headerOptionalStyle;
    }
    for (var i = 0; i < checks.length; i++) {
      final col = _siswaHeaders.length + i;
      sheet.cell(CellIndex.indexByColumnRow(columnIndex: col, rowIndex: 5))
        ..value = TextCellValue(checks[i].label)
        ..cellStyle = _checkHeaderStyle();
      sheet.setColumnWidth(col, 16);
    }

    final sampleRow = [
      '2024001',
      '0012345001',
      'ABDUL HANIF AWINDRA PUTRA',
      'L',
      'Bp. Ahmad Fauzi',
      'Aktif',
      _firstOr(masterData.classes, 'Sifir Awal A PA'),
      'Gresik',
      '2010-03-15',
      'Jl. Contoh No. 1, Gresik',
      'Indonesia',
      masterData.provinces.firstWhere(
        (item) => item.toLowerCase() == 'jawa timur',
        orElse: () => _firstOr(masterData.provinces, 'Jawa Timur'),
      ),
      masterData.cities.firstWhere(
        (item) => item.toLowerCase().contains('gresik'),
        orElse: () => _firstOr(masterData.cities, 'Kabupaten Gresik'),
      ),
      masterData.districts.firstWhere(
        (item) => item.toLowerCase() == 'bungah',
        orElse: () => _firstOr(masterData.districts, 'Bungah'),
      ),
      masterData.villages.firstWhere(
        (item) => item.toLowerCase() == 'bungah',
        orElse: () => _firstOr(masterData.villages, 'Bungah'),
      ),
      '61152',
      '081234567890',
      'santri@example.com',
      'Ahmad Fauzi',
      'Siti Aisyah',
      _firstOr(masterData.schoolOrigins, 'MI Qomaruddin'),
      '2025/2026',
      _firstOr(masterData.studentTypes, 'Santri Madin'),
      '2025-07-01',
      'Kolom opsional boleh dikosongkan',
    ];

    for (var i = 0; i < sampleRow.length; i++) {
      sheet.cell(CellIndex.indexByColumnRow(columnIndex: i, rowIndex: 6))
        ..value = TextCellValue(sampleRow[i])
        ..cellStyle = sampleStyle;
    }
    _appendCheckFormulas(sheet, _siswaHeaders, checks, 6);
    for (var row = 7; row <= 250; row++) {
      _appendCheckFormulas(sheet, _siswaHeaders, checks, row);
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

  static void _appendCheckFormulas(
    Sheet sheet,
    List<String> headers,
    List<_TemplateCheck> checks,
    int rowIndex,
  ) {
    for (var i = 0; i < checks.length; i++) {
      final check = checks[i];
      final sourceIndex = headers.indexOf(check.sourceHeader);
      if (sourceIndex < 0) continue;
      final checkIndex = headers.length + i;
      final sourceCell = '${_columnName(sourceIndex)}${rowIndex + 1}';
      final checkCell = CellIndex.indexByColumnRow(
        columnIndex: checkIndex,
        rowIndex: rowIndex,
      );
      final formula = check.masterColumn == null
          ? 'IF($sourceCell="","",IF(ISNUMBER(DATEVALUE(TEXT($sourceCell,"yyyy-mm-dd"))),"OK","${check.message}"))'
          : 'IF($sourceCell="","${check.required ? 'WAJIB' : ''}",IF(COUNTIF(Master!\$${_columnName(check.masterColumn!)}\$2:\$${_columnName(check.masterColumn!)}\$1000,$sourceCell)>0,"OK","${check.message}"))';
      sheet.cell(checkCell)
        ..value = FormulaCellValue(formula)
        ..cellStyle = _checkCellStyle();
    }
  }

  static List<int> _addSiswaDropdownValidations(List<int> bytes) {
    try {
      final archive = ZipDecoder().decodeBytes(bytes);
      final templateSheet = archive.findFile('xl/worksheets/sheet1.xml');
      if (templateSheet == null) return bytes;

      final xml = utf8.decode(templateSheet.content as List<int>);
      final patchedXml = _insertWorksheetDataValidations(
        xml,
        _siswaValidationXml(startRow: 7, endRow: 251),
      );
      final patchedBytes = utf8.encode(patchedXml);
      archive.addFile(
        ArchiveFile(
          'xl/worksheets/sheet1.xml',
          patchedBytes.length,
          patchedBytes,
        ),
      );

      return ZipEncoder().encode(archive) ?? bytes;
    } catch (_) {
      return bytes;
    }
  }

  static String _siswaValidationXml({
    required int startRow,
    required int endRow,
  }) {
    final validations = <String>[
      _dataValidationTag(
        type: 'list',
        sqref: 'H$startRow:H$endRow',
        prompt:
            'Pilih dari master kota untuk tempat lahir, atau ketik manual jika belum ada.',
        formula1: r'Master!$F$2:$F$1000',
      ),
      _dataValidationTag(
        type: 'date',
        sqref: 'I$startRow:I$endRow',
        prompt: 'Isi tanggal_lahir format YYYY-MM-DD. Contoh: 2015-01-12.',
        formula1: 'DATE(1900,1,1)',
        formula2: 'DATE(2099,12,31)',
        operator: 'between',
      ),
      _dataValidationTag(
        type: 'textLength',
        sqref: 'J$startRow:J$endRow',
        prompt:
            'Isi alamat lengkap. Boleh ketik manual karena alamat tidak selalu ada di master.',
        formula1: '255',
        operator: 'lessThanOrEqual',
      ),
      _dataValidationTag(
        type: 'list',
        sqref: 'K$startRow:K$endRow',
        prompt:
            'Pilih kewarganegaraan dari Master, atau ketik manual jika belum tersedia.',
        formula1: r'Master!$D$2:$D$1000',
      ),
      _dataValidationTag(
        type: 'list',
        sqref: 'L$startRow:L$endRow',
        prompt: 'Pilih provinsi dari Master agar ejaan sama dengan database.',
        formula1: r'Master!$E$2:$E$1000',
      ),
      _dataValidationTag(
        type: 'list',
        sqref: 'M$startRow:M$endRow',
        prompt: 'Pilih kota/kabupaten dari Master agar tidak typo.',
        formula1: r'Master!$F$2:$F$1000',
      ),
      _dataValidationTag(
        type: 'list',
        sqref: 'N$startRow:N$endRow',
        prompt:
            'Pilih kecamatan dari Master contoh, atau ketik manual jika belum ada.',
        formula1: r'Master!$G$2:$G$1000',
      ),
      _dataValidationTag(
        type: 'list',
        sqref: 'O$startRow:O$endRow',
        prompt:
            'Pilih kelurahan/desa dari Master contoh, atau ketik manual jika belum ada.',
        formula1: r'Master!$H$2:$H$1000',
      ),
    ];
    return '<dataValidations count="${validations.length}">'
        '${validations.join()}'
        '</dataValidations>';
  }

  static String _dataValidationTag({
    required String type,
    required String sqref,
    required String prompt,
    required String formula1,
    String? formula2,
    String? operator,
  }) {
    final operatorAttr =
        operator == null ? '' : ' operator="${_escapeXml(operator)}"';
    final secondFormula =
        formula2 == null ? '' : '<formula2>${_escapeXml(formula2)}</formula2>';
    return '<dataValidation type="${_escapeXml(type)}"$operatorAttr allowBlank="1" errorStyle="warning" showErrorMessage="1" showInputMessage="1" errorTitle="Di luar master" error="Nilai tidak ada di sheet Master. Boleh lanjut jika data memang baru, tapi cek ulang sebelum import." promptTitle="Bantuan input" prompt="${_escapeXml(prompt)}" sqref="${_escapeXml(sqref)}"><formula1>${_escapeXml(formula1)}</formula1>$secondFormula</dataValidation>';
  }

  static String _insertWorksheetDataValidations(
    String xml,
    String validationsXml,
  ) {
    final cleanXml = xml.replaceFirst(
      RegExp(r'<dataValidations[\s\S]*?<\/dataValidations>'),
      '',
    );
    const anchors = [
      '<hyperlinks',
      '<pageMargins',
      '<pageSetup',
      '<headerFooter',
      '<drawing',
      '<legacyDrawing',
      '<extLst',
      '</worksheet>',
    ];
    for (final anchor in anchors) {
      if (cleanXml.contains(anchor)) {
        return cleanXml.replaceFirst(anchor, '$validationsXml$anchor');
      }
    }
    return cleanXml;
  }

  static String _escapeXml(String value) {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&apos;');
  }

  static void _buildMasterSheet(Sheet sheet, _TemplateMasterData data) {
    final columns = <List<String>>[
      ['jenis_kelamin', 'L', 'P'],
      ['status', 'Aktif', 'Nonaktif', 'Lulus'],
      ['kelompok_belajar', ...data.classes],
      ['kewarganegaraan', 'Indonesia', 'WNA'],
      ['provinsi', ...data.provinces],
      ['kota', ...data.cities],
      ['kecamatan_contoh', ...data.districts],
      ['kelurahan_contoh', ...data.villages],
      ['asal_sekolah', ...data.schoolOrigins],
      ['jenis_santri', ...data.studentTypes],
      ['role', 'admin', 'guru', 'wali'],
      ['status_user', 'Aktif', 'Nonaktif'],
    ];
    final maxRows = columns
        .map((col) => col.length)
        .fold<int>(0, (a, b) => a > b ? a : b);
    final headerStyle = _masterHeaderStyle();
    final cellStyle = _masterCellStyle();
    for (var col = 0; col < columns.length; col++) {
      sheet.setColumnWidth(col, 24);
      for (var row = 0; row < maxRows; row++) {
        final value = row < columns[col].length ? columns[col][row] : '';
        sheet.cell(CellIndex.indexByColumnRow(columnIndex: col, rowIndex: row))
          ..value = TextCellValue(value)
          ..cellStyle = row == 0 ? headerStyle : cellStyle;
      }
    }
  }

  static void _buildGuideSheet(Sheet sheet, ImportTemplateType type) {
    final rows = [
      'PANDUAN IMPORT',
      'Gunakan sheet Template untuk mengisi data. Sheet Master hanya rujukan pilihan resmi.',
      'Jangan mengubah nama header karena parser mencari header tersebut.',
      'Pada template siswa, kolom tempat_lahir, tanggal_lahir, alamat_lengkap, kewarganegaraan, provinsi, kota, kecamatan, dan kelurahan diberi dropdown/validasi master.',
      'Dropdown bersifat warning, bukan stop. Jika pilihan belum ada di Master, user tetap boleh mengetik manual agar data baru tidak tertahan.',
      'Kolom cek_* berisi rumus bantu. Jika muncul CEK atau WAJIB, periksa lagi sebelum import.',
      'tanggal_lahir dan tanggal_masuk gunakan format YYYY-MM-DD, contoh 2015-01-12.',
      'Untuk wilayah, gunakan nama resmi dari master database. Backend tetap memvalidasi master saat import.',
      type == ImportTemplateType.siswa
          ? 'Khusus siswa: provinsi, kota, kecamatan, kelurahan, asal_sekolah, jenis_santri, dan kelompok_belajar harus mengikuti master.'
          : 'Khusus user/guru: role, status, dan jenis_kelamin harus mengikuti pilihan master.',
    ];
    sheet.setColumnWidth(0, 110);
    for (var i = 0; i < rows.length; i++) {
      sheet.cell(CellIndex.indexByColumnRow(columnIndex: 0, rowIndex: i))
        ..value = TextCellValue(rows[i])
        ..cellStyle = i == 0 ? _titleStyle() : _infoStyle();
    }
  }

  static Future<_TemplateMasterData> _loadTemplateMasterData() async {
    final data = _TemplateMasterData.fallback();
    try {
      final classes = await ApiService.getClasses();
      data.classes = _mergeNames(classes['data'], _fallbackClasses);
    } catch (_) {}

    try {
      final origins = await ApiService.getSchoolOrigins(limit: 1000);
      data.schoolOrigins = _mergeNames(origins['data'], _fallbackSchoolOrigins);
    } catch (_) {}

    try {
      final types = await ApiService.getReferenceMaster('student_types');
      data.studentTypes = _mergeNames(types['data'], _studentTypeOptions);
    } catch (_) {}

    try {
      final provinces = await ApiService.getProvinces();
      data.provinces = _mergeNames(provinces['data'], _fallbackProvinces);
    } catch (_) {}

    try {
      final cities = await ApiService.getCities(limit: 1000);
      data.cities = _mergeNames(cities['data'], _fallbackCities);
    } catch (_) {}

    try {
      final gresik = await ApiService.getCities(q: 'Gresik', limit: 20);
      final cityRows = _asRecords(gresik['data']);
      int? gresikId;
      for (final row in cityRows) {
        final name = row['name'].toString().toLowerCase();
        final id = int.tryParse(row['id'].toString()) ?? 0;
        if (name.contains('gresik') && id > 0) {
          gresikId = id;
          break;
        }
      }
      if (gresikId != null) {
        final districts = await ApiService.getDistricts(cityId: gresikId);
        data.districts = _mergeNames(districts['data'], _fallbackDistricts);
      }
    } catch (_) {}

    try {
      final villages = await ApiService.getVillages(districtCode: '35.25.01');
      data.villages = _mergeNames(villages['data'], _fallbackVillages);
    } catch (_) {}

    return data;
  }

  static List<String> _mergeNames(dynamic rows, List<String> fallback) {
    final values = <String>[...fallback];
    for (final row in _asRecords(rows)) {
      final name = row['name']?.toString().trim() ?? '';
      if (name.isNotEmpty) values.add(name);
    }
    return _unique(values);
  }

  static List<Map<String, dynamic>> _asRecords(dynamic rows) {
    if (rows is! List) return const [];
    return rows
        .whereType<Map>()
        .map((row) => row.map((key, value) => MapEntry(key.toString(), value)))
        .toList();
  }

  static List<String> _unique(List<String> values) {
    final seen = <String>{};
    final result = <String>[];
    for (final value in values) {
      final clean = value.trim();
      if (clean.isEmpty || seen.contains(clean.toLowerCase())) continue;
      seen.add(clean.toLowerCase());
      result.add(clean);
    }
    return result;
  }

  static String _firstOr(List<String> values, String fallback) {
    return values.isEmpty ? fallback : values.first;
  }

  static String _columnName(int index) {
    var dividend = index + 1;
    var name = '';
    while (dividend > 0) {
      final modulo = (dividend - 1) % 26;
      name = String.fromCharCode(65 + modulo) + name;
      dividend = ((dividend - modulo) / 26).floor();
    }
    return name;
  }

  static CellStyle _titleStyle() {
    return CellStyle(
      bold: true,
      fontSize: 16,
      horizontalAlign: HorizontalAlign.Center,
      verticalAlign: VerticalAlign.Center,
      backgroundColorHex: ExcelColor.fromHexString('#138F81'),
      fontColorHex: ExcelColor.fromHexString('#FFFFFF'),
    );
  }

  static CellStyle _subTitleStyle() {
    return CellStyle(
      bold: true,
      fontSize: 11,
      horizontalAlign: HorizontalAlign.Center,
      verticalAlign: VerticalAlign.Center,
      backgroundColorHex: ExcelColor.fromHexString('#E8F7F3'),
      fontColorHex: ExcelColor.fromHexString('#138F81'),
      textWrapping: TextWrapping.WrapText,
    );
  }

  static CellStyle _infoStyle() {
    return CellStyle(
      backgroundColorHex: ExcelColor.fromHexString('#FFF7E6'),
      fontColorHex: ExcelColor.fromHexString('#8A5A00'),
      textWrapping: TextWrapping.WrapText,
      verticalAlign: VerticalAlign.Top,
    );
  }

  static CellStyle _mandatoryHeaderStyle() {
    return CellStyle(
      bold: true,
      backgroundColorHex: ExcelColor.fromHexString('#D8F3EE'),
      fontColorHex: ExcelColor.fromHexString('#0F6D62'),
      horizontalAlign: HorizontalAlign.Center,
      verticalAlign: VerticalAlign.Center,
      textWrapping: TextWrapping.WrapText,
    );
  }

  static CellStyle _optionalHeaderStyle() {
    return CellStyle(
      bold: true,
      backgroundColorHex: ExcelColor.fromHexString('#EAF1FF'),
      fontColorHex: ExcelColor.fromHexString('#2E5AAC'),
      horizontalAlign: HorizontalAlign.Center,
      verticalAlign: VerticalAlign.Center,
      textWrapping: TextWrapping.WrapText,
    );
  }

  static CellStyle _checkHeaderStyle() {
    return CellStyle(
      bold: true,
      backgroundColorHex: ExcelColor.fromHexString('#FFE7B8'),
      fontColorHex: ExcelColor.fromHexString('#8A5A00'),
      horizontalAlign: HorizontalAlign.Center,
      verticalAlign: VerticalAlign.Center,
      textWrapping: TextWrapping.WrapText,
    );
  }

  static CellStyle _sampleStyle() {
    return CellStyle(
      backgroundColorHex: ExcelColor.fromHexString('#F8FBFF'),
      textWrapping: TextWrapping.WrapText,
      verticalAlign: VerticalAlign.Center,
    );
  }

  static CellStyle _checkCellStyle() {
    return CellStyle(
      backgroundColorHex: ExcelColor.fromHexString('#FFF7E6'),
      fontColorHex: ExcelColor.fromHexString('#8A5A00'),
      horizontalAlign: HorizontalAlign.Center,
      verticalAlign: VerticalAlign.Center,
    );
  }

  static CellStyle _masterHeaderStyle() {
    return CellStyle(
      bold: true,
      backgroundColorHex: ExcelColor.fromHexString('#2D3436'),
      fontColorHex: ExcelColor.fromHexString('#FFFFFF'),
      horizontalAlign: HorizontalAlign.Center,
      verticalAlign: VerticalAlign.Center,
      textWrapping: TextWrapping.WrapText,
    );
  }

  static CellStyle _masterCellStyle() {
    return CellStyle(
      backgroundColorHex: ExcelColor.fromHexString('#F7FAFC'),
      textWrapping: TextWrapping.WrapText,
      verticalAlign: VerticalAlign.Center,
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

class _TemplateCheck {
  final String label;
  final String sourceHeader;
  final int? masterColumn;
  final bool required;
  final String message;

  const _TemplateCheck(
    this.label,
    this.sourceHeader,
    this.masterColumn,
    this.required, [
    this.message = 'CEK',
  ]);
}

class _TemplateMasterData {
  List<String> classes;
  List<String> schoolOrigins;
  List<String> studentTypes;
  List<String> provinces;
  List<String> cities;
  List<String> districts;
  List<String> villages;

  _TemplateMasterData({
    required this.classes,
    required this.schoolOrigins,
    required this.studentTypes,
    required this.provinces,
    required this.cities,
    required this.districts,
    required this.villages,
  });

  factory _TemplateMasterData.fallback() {
    return _TemplateMasterData(
      classes: List<String>.from(ExcelImportService._fallbackClasses),
      schoolOrigins: List<String>.from(
        ExcelImportService._fallbackSchoolOrigins,
      ),
      studentTypes: List<String>.from(ExcelImportService._studentTypeOptions),
      provinces: List<String>.from(ExcelImportService._fallbackProvinces),
      cities: List<String>.from(ExcelImportService._fallbackCities),
      districts: List<String>.from(ExcelImportService._fallbackDistricts),
      villages: List<String>.from(ExcelImportService._fallbackVillages),
    );
  }
}
