import 'dart:io';

import 'package:excel/excel.dart';
import 'package:intl/intl.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

class AbsensiNgajiExportService {
  static Future<void> exportRekapExcel({
    required List<Map<String, dynamic>> records,
    required Map<String, dynamic> summary,
    required String title,
    required String period,
  }) async {
    final excel = Excel.createExcel();
    final sheetName = excel.getDefaultSheet() ?? 'Sheet1';
    final sheet = excel[sheetName];

    final titleStyle = CellStyle(
      bold: true,
      fontSize: 14,
      horizontalAlign: HorizontalAlign.Center,
      verticalAlign: VerticalAlign.Center,
    );
    final headerStyle = CellStyle(
      bold: true,
      backgroundColorHex: ExcelColor.fromHexString('#138F81'),
      fontColorHex: ExcelColor.fromHexString('#FFFFFF'),
      horizontalAlign: HorizontalAlign.Center,
      verticalAlign: VerticalAlign.Center,
    );
    final bodyStyle = CellStyle(
      backgroundColorHex: ExcelColor.fromHexString('#F8FBFF'),
      fontColorHex: ExcelColor.fromHexString('#2D3436'),
      verticalAlign: VerticalAlign.Center,
    );
    final summaryStyle = CellStyle(
      bold: true,
      backgroundColorHex: ExcelColor.fromHexString('#EAF6F4'),
      fontColorHex: ExcelColor.fromHexString('#138F81'),
      horizontalAlign: HorizontalAlign.Center,
    );

    sheet.merge(CellIndex.indexByString('A1'), CellIndex.indexByString('L1'));
    sheet.cell(CellIndex.indexByString('A1'))
      ..value = TextCellValue(title.toUpperCase())
      ..cellStyle = titleStyle;
    sheet.merge(CellIndex.indexByString('A2'), CellIndex.indexByString('L2'));
    sheet.cell(CellIndex.indexByString('A2')).value = TextCellValue(
      'Periode: $period - Dicetak: ${DateFormat('dd/MM/yyyy HH:mm').format(DateTime.now())}',
    );

    final headers = [
      'No',
      'Tanggal',
      'Sesi',
      'Kitab',
      'Nama Santri',
      'NIS',
      'Kelas',
      'Komplek',
      'Kamar',
      'Status',
      'Petugas',
      'Waktu Input',
    ];

    for (var i = 0; i < headers.length; i++) {
      sheet.cell(CellIndex.indexByColumnRow(columnIndex: i, rowIndex: 3))
        ..value = TextCellValue(headers[i])
        ..cellStyle = headerStyle;
    }

    for (var rowIndex = 0; rowIndex < records.length; rowIndex++) {
      final row = records[rowIndex];
      final values = [
        '${rowIndex + 1}',
        row['tanggal']?.toString() ?? '-',
        row['sesi']?.toString() ?? '-',
        row['kitab']?.toString() ?? '-',
        row['nama']?.toString() ?? '-',
        row['nis']?.toString() ?? '-',
        row['kelas']?.toString() ?? '-',
        row['komplek']?.toString() ?? '-',
        row['kamar']?.toString() ?? '-',
        row['status_label']?.toString() ?? row['status']?.toString() ?? '-',
        row['petugas']?.toString() ?? row['diinput_oleh']?.toString() ?? '-',
        row['waktu_input']?.toString() ?? '-',
      ];
      for (var col = 0; col < values.length; col++) {
        sheet.cell(
            CellIndex.indexByColumnRow(
              columnIndex: col,
              rowIndex: rowIndex + 4,
            ),
          )
          ..value = TextCellValue(values[col])
          ..cellStyle = bodyStyle;
      }
    }

    final summaryRow = records.length + 6;
    final dataEnd = records.length + 4;
    final summaryHeaders = [
      'Ringkasan',
      'Hadir',
      'Izin',
      'Sakit',
      'Alfa',
      'Kosong',
      'Dibatalkan',
      'Persentase Hadir',
    ];
    for (var i = 0; i < summaryHeaders.length; i++) {
      sheet.cell(
          CellIndex.indexByColumnRow(columnIndex: i, rowIndex: summaryRow),
        )
        ..value = TextCellValue(summaryHeaders[i])
        ..cellStyle = summaryStyle;
    }
    final values = [
      TextCellValue('Total'),
      FormulaCellValue(
        'COUNTIF(J5:J$dataEnd,"Hadir")+COUNTIF(J5:J$dataEnd,"H")',
      ),
      FormulaCellValue(
        'COUNTIF(J5:J$dataEnd,"Izin")+COUNTIF(J5:J$dataEnd,"I")',
      ),
      FormulaCellValue(
        'COUNTIF(J5:J$dataEnd,"Sakit")+COUNTIF(J5:J$dataEnd,"S")',
      ),
      FormulaCellValue(
        'COUNTIF(J5:J$dataEnd,"Alfa")+COUNTIF(J5:J$dataEnd,"A")',
      ),
      FormulaCellValue('COUNTIF(J5:J$dataEnd,"Kosong")'),
      FormulaCellValue('COUNTIF(J5:J$dataEnd,"Dibatalkan")'),
      TextCellValue('${summary['persentase_hadir'] ?? 0}%'),
    ];
    for (var i = 0; i < values.length; i++) {
      sheet.cell(
          CellIndex.indexByColumnRow(columnIndex: i, rowIndex: summaryRow + 1),
        )
        ..value = values[i]
        ..cellStyle = summaryStyle;
    }

    final bytes = excel.encode();
    if (bytes == null) {
      throw Exception('Gagal membuat file Excel rekap ngaji');
    }
    final dir = await getApplicationDocumentsDirectory();
    final safeTitle = title
        .toLowerCase()
        .replaceAll(RegExp(r'[^a-z0-9]+'), '_')
        .replaceAll(RegExp(r'_+'), '_');
    final file = File(
      '${dir.path}/$safeTitle${DateTime.now().millisecondsSinceEpoch}.xlsx',
    );
    await file.writeAsBytes(bytes, flush: true);
    await Share.shareXFiles([XFile(file.path)], text: title);
  }
}
