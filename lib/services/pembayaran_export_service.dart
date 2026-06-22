import 'dart:io';
import 'dart:typed_data';

import 'package:excel/excel.dart';
import 'package:flutter/services.dart' show rootBundle;
import 'package:path_provider/path_provider.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';
import 'package:share_plus/share_plus.dart';

class PembayaranExportService {
  static const double _contentWidth = 470;

  static Future<void> exportAllPaymentsExcel(
    Map<String, dynamic> payload, {
    String? kelas,
    String? status,
  }) async {
    final excel = Excel.createExcel();
    final sheetName = excel.getDefaultSheet() ?? 'Sheet1';
    final sheet = excel[sheetName];

    final headerStyle = CellStyle(
      bold: true,
      backgroundColorHex: ExcelColor.fromHexString('#138F81'),
      fontColorHex: ExcelColor.fromHexString('#FFFFFF'),
      horizontalAlign: HorizontalAlign.Center,
      verticalAlign: VerticalAlign.Center,
    );
    final titleStyle = CellStyle(
      bold: true,
      fontSize: 14,
      horizontalAlign: HorizontalAlign.Center,
      verticalAlign: VerticalAlign.Center,
    );

    final summary = Map<String, dynamic>.from(payload['summary'] ?? const {});
    final rows = List<Map<String, dynamic>>.from(payload['data'] ?? const []);
    final studentTotals = List<Map<String, dynamic>>.from(
      payload['student_totals'] ?? const [],
    );

    final infoStyle = CellStyle(
      backgroundColorHex: ExcelColor.fromHexString('#EAF6F4'),
      fontColorHex: ExcelColor.fromHexString('#2D3436'),
      horizontalAlign: HorizontalAlign.Left,
      verticalAlign: VerticalAlign.Center,
    );
    final totalStyle = CellStyle(
      bold: true,
      backgroundColorHex: ExcelColor.fromHexString('#138F81'),
      fontColorHex: ExcelColor.fromHexString('#FFFFFF'),
      horizontalAlign: HorizontalAlign.Center,
      verticalAlign: VerticalAlign.Center,
    );

    sheet.merge(CellIndex.indexByString('A1'), CellIndex.indexByString('I1'));
    sheet.cell(CellIndex.indexByString('A1'))
      ..value = TextCellValue('REKAP PEMBAYARAN SISWA')
      ..cellStyle = titleStyle;

    sheet.merge(CellIndex.indexByString('A2'), CellIndex.indexByString('I2'));
    sheet.cell(CellIndex.indexByString('A2')).value = TextCellValue(
      'Filter Kelas: ${kelas ?? 'Semua'} - Status: ${status ?? 'Semua'}',
    );
    sheet.cell(CellIndex.indexByString('A2')).cellStyle = infoStyle;

    sheet.merge(CellIndex.indexByString('A3'), CellIndex.indexByString('I3'));
    sheet.cell(CellIndex.indexByString('A3')).value = TextCellValue(
      'Total Transaksi: ${summary['total_transaksi'] ?? 0} - Total Dana Masuk: ${_formatRupiah(summary['total_keseluruhan'] as num? ?? 0)}',
    );
    sheet.cell(CellIndex.indexByString('A3')).cellStyle = infoStyle;

    sheet.merge(CellIndex.indexByString('A4'), CellIndex.indexByString('I4'));
    sheet.cell(CellIndex.indexByString('A4'))
      ..value = TextCellValue(
        'Warna Status: Lunas = aman, Belum Lunas = perlu tindak lanjut, Menunggu = proses verifikasi',
      )
      ..cellStyle = infoStyle;

    final headers = [
      'Nama Siswa/Santri',
      'NIS',
      'Kelas',
      'Nama Wali',
      'Jenis Pembayaran',
      'Nominal',
      'Tanggal',
      'Metode',
      'Status',
    ];

    for (var i = 0; i < headers.length; i++) {
      final cell = sheet.cell(
        CellIndex.indexByColumnRow(columnIndex: i, rowIndex: 5),
      );
      cell.value = TextCellValue(headers[i]);
      cell.cellStyle = headerStyle;
    }

    for (var rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      final row = rows[rowIndex];
      final statusPembayaran = row['status_pembayaran']?.toString() ?? '-';
      final rowStyle = _paymentStatusStyle(statusPembayaran);
      final cells = [
        row['nama_siswa']?.toString() ?? '-',
        row['nis']?.toString() ?? '-',
        row['kelas']?.toString() ?? '-',
        row['nama_wali']?.toString() ?? '-',
        row['jenis_pembayaran']?.toString() ?? '-',
        _formatRupiah(num.tryParse(row['nominal']?.toString() ?? '0') ?? 0),
        row['tanggal_pembayaran']?.toString() ?? '-',
        row['metode_pembayaran']?.toString() ?? '-',
        row['status_pembayaran']?.toString() ?? '-',
      ];

      for (var columnIndex = 0; columnIndex < cells.length; columnIndex++) {
        final cell = sheet.cell(
          CellIndex.indexByColumnRow(
            columnIndex: columnIndex,
            rowIndex: rowIndex + 6,
          ),
        );
        cell.value = TextCellValue(cells[columnIndex]);
        cell.cellStyle = CellStyle(
          backgroundColorHex: rowStyle['background'] as ExcelColor,
          fontColorHex: rowStyle['font'] as ExcelColor,
          horizontalAlign: columnIndex == 5
              ? HorizontalAlign.Right
              : HorizontalAlign.Left,
          verticalAlign: VerticalAlign.Center,
          textWrapping: TextWrapping.WrapText,
        );
      }
    }

    final totalRowIndex = rows.length + 7;
    sheet.merge(
      CellIndex.indexByColumnRow(columnIndex: 0, rowIndex: totalRowIndex),
      CellIndex.indexByColumnRow(columnIndex: 4, rowIndex: totalRowIndex),
    );
    sheet.cell(
        CellIndex.indexByColumnRow(columnIndex: 0, rowIndex: totalRowIndex),
      )
      ..value = TextCellValue('TOTAL KESELURUHAN')
      ..cellStyle = headerStyle;
    sheet.cell(
        CellIndex.indexByColumnRow(columnIndex: 5, rowIndex: totalRowIndex),
      )
      ..value = TextCellValue(
        _formatRupiah(summary['total_keseluruhan'] as num? ?? 0),
      )
      ..cellStyle = totalStyle;

    if (studentTotals.isNotEmpty) {
      final sectionTitleRow = totalRowIndex + 2;
      sheet.merge(
        CellIndex.indexByColumnRow(columnIndex: 0, rowIndex: sectionTitleRow),
        CellIndex.indexByColumnRow(columnIndex: 4, rowIndex: sectionTitleRow),
      );
      sheet.cell(
          CellIndex.indexByColumnRow(columnIndex: 0, rowIndex: sectionTitleRow),
        )
        ..value = TextCellValue('RINGKASAN TOTAL PER SISWA')
        ..cellStyle = totalStyle;

      final summaryHeaderRow = sectionTitleRow + 1;
      final summaryHeaders = [
        'Nama Siswa/Santri',
        'NIS',
        'Kelas',
        'Jumlah Transaksi',
        'Total Pembayaran',
      ];
      for (var i = 0; i < summaryHeaders.length; i++) {
        final cell = sheet.cell(
          CellIndex.indexByColumnRow(
            columnIndex: i,
            rowIndex: summaryHeaderRow,
          ),
        );
        cell.value = TextCellValue(summaryHeaders[i]);
        cell.cellStyle = headerStyle;
      }

      for (var i = 0; i < studentTotals.length; i++) {
        final row = studentTotals[i];
        final targetRow = summaryHeaderRow + i + 1;
        final values = [
          row['nama_siswa']?.toString() ?? '-',
          row['nis']?.toString() ?? '-',
          row['kelas']?.toString() ?? '-',
          '${row['total_transaksi'] ?? 0}',
          _formatRupiah(
            num.tryParse(row['total_pembayaran']?.toString() ?? '0') ?? 0,
          ),
        ];
        for (var col = 0; col < values.length; col++) {
          sheet.cell(
              CellIndex.indexByColumnRow(columnIndex: col, rowIndex: targetRow),
            )
            ..value = TextCellValue(values[col])
            ..cellStyle = CellStyle(
              backgroundColorHex: ExcelColor.fromHexString('#F8FBFF'),
              horizontalAlign: col == 4
                  ? HorizontalAlign.Right
                  : HorizontalAlign.Left,
            );
        }
      }
    }

    final widths = <int, double>{
      0: 24,
      1: 14,
      2: 16,
      3: 22,
      4: 24,
      5: 16,
      6: 14,
      7: 18,
      8: 14,
    };
    for (final entry in widths.entries) {
      sheet.setColumnWidth(entry.key, entry.value);
    }

    final bytes = excel.encode();
    if (bytes == null) {
      throw Exception('Gagal membuat file Excel rekap pembayaran');
    }

    final dir = await getTemporaryDirectory();
    final file = File(
      '${dir.path}\\rekap_pembayaran_${DateTime.now().millisecondsSinceEpoch}.xlsx',
    );
    await file.writeAsBytes(bytes, flush: true);

    await Share.shareXFiles([XFile(file.path)], text: 'Rekap pembayaran siswa');
  }

  static Future<void> printStudentPaymentReport(
    Map<String, dynamic> payload,
  ) async {
    final pdf = pw.Document();
    final data = Map<String, dynamic>.from(payload['data'] ?? const {});
    final siswa = Map<String, dynamic>.from(data['siswa'] ?? const {});
    final summary = Map<String, dynamic>.from(data['summary'] ?? const {});
    final rows = List<Map<String, dynamic>>.from(data['rows'] ?? const []);
    final documentSetting = Map<String, dynamic>.from(
      data['document_setting'] ?? const {},
    );
    final signatureUrl = documentSetting['signature_url']?.toString();
    final logoImage = await _loadDocumentLogo(
      documentSetting['document_logo_url']?.toString(),
    );
    pw.ImageProvider? signatureImage;

    if (documentSetting['signature_mode'] == 'uploaded' &&
        signatureUrl != null &&
        signatureUrl.isNotEmpty) {
      try {
        signatureImage = await networkImage(signatureUrl);
      } catch (_) {
        signatureImage = null;
      }
    }

    pdf.addPage(
      pw.MultiPage(
        pageFormat: PdfPageFormat.a4,
        margin: const pw.EdgeInsets.symmetric(horizontal: 30, vertical: 26),
        header: (context) => _buildHeader(logoImage),
        footer: (context) => _buildFooter(context),
        build: (context) => [
          _buildIdentityCard(siswa),
          pw.SizedBox(height: 14),
          _buildSummaryCard(summary),
          pw.SizedBox(height: 18),
          _sectionTitle('RINCIAN PEMBAYARAN'),
          pw.SizedBox(height: 8),
          _buildPaymentTable(rows),
          pw.SizedBox(height: 24),
          _buildSignatureSection(documentSetting, signatureImage),
        ],
      ),
    );

    final nama = _safeFileSegment(siswa['nama']?.toString() ?? 'siswa');
    final bytes = await pdf.save();
    final fileName = 'Rekap_Pembayaran_$nama.pdf';
    try {
      await Printing.layoutPdf(
        onLayout: (format) async => bytes,
        name: fileName,
      );
    } catch (_) {
      await _sharePdfBytes(bytes, fileName, 'Rekap pembayaran siswa');
    }
  }

  static Future<void> _sharePdfBytes(
    Uint8List bytes,
    String fileName,
    String text,
  ) async {
    final dir = await getTemporaryDirectory();
    final file = File('${dir.path}${Platform.pathSeparator}$fileName');
    await file.writeAsBytes(bytes, flush: true);
    await Share.shareXFiles([XFile(file.path)], text: text);
  }

  static Future<pw.ImageProvider?> _loadDocumentLogo(String? url) async {
    if (url != null && url.isNotEmpty) {
      try {
        return await networkImage(url);
      } catch (_) {}
    }

    try {
      final data = await rootBundle.load('assets/images/Logo_Qomaruddin.png');
      return pw.MemoryImage(Uint8List.fromList(data.buffer.asUint8List()));
    } catch (_) {
      return null;
    }
  }

  static pw.Widget _buildHeader(pw.ImageProvider? logoImage) {
    return pw.Align(
      alignment: pw.Alignment.center,
      child: pw.Container(
        width: _contentWidth,
        padding: const pw.EdgeInsets.only(bottom: 10),
        decoration: const pw.BoxDecoration(
          border: pw.Border(
            bottom: pw.BorderSide(color: PdfColors.teal, width: 1.3),
          ),
        ),
        child: pw.Row(
          crossAxisAlignment: pw.CrossAxisAlignment.center,
          children: [
            if (logoImage != null)
              pw.Container(
                width: 52,
                height: 52,
                margin: const pw.EdgeInsets.only(right: 14),
                child: pw.Image(logoImage, fit: pw.BoxFit.contain),
              ),
            pw.Expanded(
              child: pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.center,
                children: [
                  pw.Text(
                    'PONDOK PESANTREN QOMARUDDIN',
                    style: pw.TextStyle(
                      fontSize: 16,
                      fontWeight: pw.FontWeight.bold,
                      color: PdfColors.teal900,
                    ),
                  ),
                  pw.SizedBox(height: 3),
                  pw.Text(
                    'MADRASAH DINIYAH',
                    style: pw.TextStyle(
                      fontSize: 12,
                      fontWeight: pw.FontWeight.bold,
                      color: PdfColors.teal700,
                    ),
                  ),
                  pw.SizedBox(height: 6),
                  pw.Text(
                    'DOKUMEN REKAP PEMBAYARAN SISWA',
                    style: pw.TextStyle(
                      fontSize: 10.8,
                      fontWeight: pw.FontWeight.bold,
                      letterSpacing: 1.1,
                      color: PdfColors.grey800,
                    ),
                  ),
                ],
              ),
            ),
            pw.SizedBox(width: logoImage == null ? 0 : 66),
          ],
        ),
      ),
    );
  }

  static pw.Widget _buildFooter(pw.Context context) {
    return pw.Align(
      alignment: pw.Alignment.center,
      child: pw.Container(
        width: _contentWidth,
        padding: const pw.EdgeInsets.only(top: 8),
        decoration: const pw.BoxDecoration(
          border: pw.Border(
            top: pw.BorderSide(color: PdfColors.grey400, width: 0.5),
          ),
        ),
        child: pw.Row(
          mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
          children: [
            pw.Text(
              'Dicetak dari Sistem Informasi Madrasah Diniyah',
              style: const pw.TextStyle(fontSize: 8, color: PdfColors.grey600),
            ),
            pw.Text(
              'Halaman ${context.pageNumber}/${context.pagesCount}',
              style: const pw.TextStyle(fontSize: 8, color: PdfColors.grey600),
            ),
          ],
        ),
      ),
    );
  }

  static pw.Widget _buildIdentityCard(Map<String, dynamic> siswa) {
    return _centered(
      pw.Container(
        width: double.infinity,
        padding: const pw.EdgeInsets.all(12),
        decoration: pw.BoxDecoration(
          color: PdfColors.grey50,
          border: pw.Border.all(color: PdfColors.grey300),
          borderRadius: pw.BorderRadius.circular(6),
        ),
        child: pw.Column(
          children: [
            _identityRow('Nama Siswa/Santri', siswa['nama']?.toString() ?? '-'),
            _identityRow('NIS', siswa['nis']?.toString() ?? '-'),
            _identityRow('Kelas', siswa['kelas']?.toString() ?? '-'),
            _identityRow('Nama Wali', siswa['wali_nama']?.toString() ?? '-'),
          ],
        ),
      ),
    );
  }

  static pw.Widget _buildSummaryCard(Map<String, dynamic> summary) {
    return _centered(
      pw.Container(
        width: double.infinity,
        padding: const pw.EdgeInsets.all(12),
        decoration: pw.BoxDecoration(
          color: PdfColors.teal50,
          borderRadius: pw.BorderRadius.circular(6),
          border: pw.Border.all(color: PdfColors.teal100),
        ),
        child: pw.Row(
          children: [
            _summaryBlock(
              'Total Transaksi',
              '${summary['total_transaksi'] ?? 0}',
            ),
            _summaryBlock(
              'Lunas',
              _formatRupiah(summary['total_lunas'] as num? ?? 0),
            ),
            _summaryBlock(
              'Menunggu',
              _formatRupiah(summary['total_menunggu'] as num? ?? 0),
            ),
            _summaryBlock(
              'Total Keseluruhan',
              _formatRupiah(summary['total_semua'] as num? ?? 0),
            ),
          ],
        ),
      ),
    );
  }

  static pw.Widget _buildPaymentTable(List<Map<String, dynamic>> rows) {
    if (rows.isEmpty) {
      return _emptyTable('Belum ada transaksi pembayaran untuk siswa ini');
    }

    return _centered(
      pw.Table(
        border: pw.TableBorder.all(color: PdfColors.grey300, width: 0.4),
        columnWidths: {
          0: const pw.FlexColumnWidth(2.2),
          1: const pw.FlexColumnWidth(1.1),
          2: const pw.FlexColumnWidth(1.1),
          3: const pw.FlexColumnWidth(1.2),
          4: const pw.FlexColumnWidth(1.1),
          5: const pw.FlexColumnWidth(1.1),
        },
        children: [
          _tableHeader([
            'Jenis Pembayaran',
            'Nominal',
            'Tanggal',
            'Metode',
            'Status',
            'Periode',
          ]),
          ...rows.map((row) {
            return pw.TableRow(
              children: [
                _tableCell(row['jenis_pembayaran']?.toString() ?? '-'),
                _tableCell(
                  _formatRupiah(
                    num.tryParse(row['nominal']?.toString() ?? '0') ?? 0,
                  ),
                  align: pw.TextAlign.right,
                ),
                _tableCell(
                  row['tanggal_pembayaran']?.toString() ?? '-',
                  align: pw.TextAlign.center,
                ),
                _tableCell(row['metode_pembayaran']?.toString() ?? '-'),
                _tableCell(
                  row['status_pembayaran']?.toString() ?? '-',
                  align: pw.TextAlign.center,
                ),
                _tableCell(
                  row['periode']?.toString() ?? '-',
                  align: pw.TextAlign.center,
                ),
              ],
            );
          }),
        ],
      ),
    );
  }

  static pw.Widget _buildSignatureSection(
    Map<String, dynamic> setting,
    pw.ImageProvider? signatureImage,
  ) {
    final adminName =
        setting['admin_name']?.toString().trim().isNotEmpty == true
        ? setting['admin_name'].toString()
        : 'Petugas Administrasi';
    final adminTitle =
        setting['admin_title']?.toString().trim().isNotEmpty == true
        ? setting['admin_title'].toString()
        : 'Petugas Administrasi';

    return _centered(
      pw.Row(
        mainAxisAlignment: pw.MainAxisAlignment.end,
        children: [
          pw.SizedBox(
            width: 220,
            child: pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.center,
              children: [
                pw.Text(
                  'Gresik, ${_formatDateNow()}',
                  style: const pw.TextStyle(fontSize: 10),
                ),
                pw.SizedBox(height: 6),
                pw.Text(
                  adminTitle,
                  textAlign: pw.TextAlign.center,
                  style: pw.TextStyle(fontSize: 10),
                ),
                pw.SizedBox(height: 10),
                if (signatureImage != null)
                  pw.Container(
                    width: 130,
                    height: 48,
                    alignment: pw.Alignment.center,
                    child: pw.Image(signatureImage, fit: pw.BoxFit.contain),
                  )
                else
                  pw.SizedBox(height: 48),
                pw.Text(
                  adminName,
                  textAlign: pw.TextAlign.center,
                  style: pw.TextStyle(
                    fontSize: 10,
                    fontWeight: pw.FontWeight.bold,
                    color: PdfColors.grey800,
                  ),
                ),
                pw.SizedBox(height: 4),
                pw.Text(
                  signatureImage == null
                      ? '(........................................)'
                      : '____________________________',
                  style: const pw.TextStyle(
                    fontSize: 10,
                    color: PdfColors.grey600,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  static pw.TableRow _tableHeader(List<String> labels) {
    return pw.TableRow(
      decoration: const pw.BoxDecoration(color: PdfColors.teal50),
      children: labels
          .map(
            (label) => pw.Padding(
              padding: const pw.EdgeInsets.all(6),
              child: pw.Text(
                label,
                textAlign: pw.TextAlign.center,
                style: pw.TextStyle(
                  fontSize: 9.2,
                  fontWeight: pw.FontWeight.bold,
                  color: PdfColors.teal900,
                ),
              ),
            ),
          )
          .toList(),
    );
  }

  static pw.Widget _tableCell(
    String value, {
    pw.TextAlign align = pw.TextAlign.left,
  }) {
    return pw.Padding(
      padding: const pw.EdgeInsets.all(6),
      child: pw.Text(
        value.isEmpty ? '-' : value,
        textAlign: align,
        style: const pw.TextStyle(fontSize: 9),
      ),
    );
  }

  static pw.Widget _summaryBlock(String label, String value) {
    return pw.Expanded(
      child: pw.Column(
        children: [
          pw.Text(
            label,
            textAlign: pw.TextAlign.center,
            style: const pw.TextStyle(fontSize: 8.6, color: PdfColors.grey700),
          ),
          pw.SizedBox(height: 4),
          pw.Text(
            value,
            textAlign: pw.TextAlign.center,
            style: pw.TextStyle(
              fontSize: 10.8,
              fontWeight: pw.FontWeight.bold,
              color: PdfColors.teal900,
            ),
          ),
        ],
      ),
    );
  }

  static pw.Widget _identityRow(String label, String value) {
    return pw.Padding(
      padding: const pw.EdgeInsets.symmetric(vertical: 2),
      child: pw.Row(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          pw.SizedBox(
            width: 110,
            child: pw.Text(
              label,
              style: pw.TextStyle(
                fontSize: 9.5,
                fontWeight: pw.FontWeight.bold,
                color: PdfColors.grey700,
              ),
            ),
          ),
          pw.SizedBox(
            width: 14,
            child: pw.Text(':', textAlign: pw.TextAlign.center),
          ),
          pw.Expanded(
            child: pw.Text(
              value.isEmpty ? '-' : value,
              style: const pw.TextStyle(fontSize: 9.5),
            ),
          ),
        ],
      ),
    );
  }

  static pw.Widget _sectionTitle(String title) {
    return _centered(
      pw.Container(
        width: double.infinity,
        padding: const pw.EdgeInsets.symmetric(vertical: 6, horizontal: 12),
        decoration: pw.BoxDecoration(
          color: PdfColors.teal,
          borderRadius: pw.BorderRadius.circular(4),
        ),
        child: pw.Text(
          title,
          textAlign: pw.TextAlign.center,
          style: pw.TextStyle(
            fontSize: 10,
            fontWeight: pw.FontWeight.bold,
            color: PdfColors.white,
          ),
        ),
      ),
    );
  }

  static pw.Widget _emptyTable(String message) {
    return _centered(
      pw.Container(
        width: double.infinity,
        padding: const pw.EdgeInsets.symmetric(vertical: 20),
        decoration: pw.BoxDecoration(
          border: pw.Border.all(color: PdfColors.grey300),
          borderRadius: pw.BorderRadius.circular(6),
        ),
        child: pw.Text(
          message,
          textAlign: pw.TextAlign.center,
          style: const pw.TextStyle(fontSize: 10, color: PdfColors.grey700),
        ),
      ),
    );
  }

  static pw.Widget _centered(pw.Widget child) {
    return pw.Align(
      alignment: pw.Alignment.center,
      child: pw.Container(width: _contentWidth, child: child),
    );
  }

  static String _formatRupiah(num amount) {
    final number = amount.toInt();
    final raw = number.toString();
    final buffer = StringBuffer();
    for (var i = 0; i < raw.length; i++) {
      final position = raw.length - i;
      buffer.write(raw[i]);
      if (position > 1 && position % 3 == 1) {
        buffer.write('.');
      }
    }
    return 'Rp $buffer';
  }

  static Map<String, ExcelColor> _paymentStatusStyle(String status) {
    final normalized = status.trim().toLowerCase();
    if (normalized == 'belum lunas') {
      return {
        'background': ExcelColor.fromHexString('#FDECEC'),
        'font': ExcelColor.fromHexString('#C0392B'),
      };
    }
    if (normalized == 'menunggu' || normalized == 'kurang bayar') {
      return {
        'background': ExcelColor.fromHexString('#FFF7E6'),
        'font': ExcelColor.fromHexString('#B9770E'),
      };
    }

    return {
      'background': ExcelColor.fromHexString('#FFFFFF'),
      'font': ExcelColor.fromHexString('#2D3436'),
    };
  }

  static String _formatDateNow() {
    final now = DateTime.now();
    final months = [
      '',
      'Januari',
      'Februari',
      'Maret',
      'April',
      'Mei',
      'Juni',
      'Juli',
      'Agustus',
      'September',
      'Oktober',
      'November',
      'Desember',
    ];
    return '${now.day} ${months[now.month]} ${now.year}';
  }

  static String _safeFileSegment(String value) {
    return value.replaceAll(RegExp(r'[^A-Za-z0-9]+'), '_');
  }
}
