import 'dart:io';
import 'dart:typed_data';

import 'package:excel/excel.dart';
import 'package:flutter/services.dart' show rootBundle;
import 'package:http/http.dart' as http;
import 'package:path_provider/path_provider.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';
import 'package:share_plus/share_plus.dart';

class NilaiExportService {
  static const double _contentWidth = 470;

  static Future<void> exportRekapExcel(
    List<Map<String, dynamic>> rows, {
    String? kelas,
    String? semester,
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

    sheet.merge(CellIndex.indexByString('A1'), CellIndex.indexByString('H1'));
    sheet.cell(CellIndex.indexByString('A1'))
      ..value = TextCellValue('REKAP NILAI MADRASAH DINIYAH')
      ..cellStyle = titleStyle;

    sheet.merge(CellIndex.indexByString('A2'), CellIndex.indexByString('H2'));
    sheet.cell(CellIndex.indexByString('A2')).value = TextCellValue(
      'Filter Kelas: ${kelas ?? 'Semua'} - Semester/Periode: ${semester ?? 'Semua'}',
    );

    final headers = [
      'Nama Siswa/Santri',
      'NIS',
      'Kelas',
      'Nilai Pelajaran',
      'Nilai Hafalan',
      'Rata-rata',
      'Predikat',
      'Nama Penilai',
    ];

    for (var i = 0; i < headers.length; i++) {
      final cell = sheet.cell(
        CellIndex.indexByColumnRow(columnIndex: i, rowIndex: 3),
      );
      cell.value = TextCellValue(headers[i]);
      cell.cellStyle = headerStyle;
    }

    for (var rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      final row = rows[rowIndex];
      final cells = [
        row['nama_siswa']?.toString() ?? '-',
        row['nis']?.toString() ?? '-',
        row['kelas']?.toString() ?? '-',
        row['nilai_pelajaran']?.toString() ?? '-',
        row['nilai_hafalan']?.toString() ?? '-',
        row['rata_rata']?.toString() ?? '0',
        row['predikat']?.toString() ?? '-',
        row['nama_penilai']?.toString() ?? '-',
      ];

      for (var columnIndex = 0; columnIndex < cells.length; columnIndex++) {
        final cell = sheet.cell(
          CellIndex.indexByColumnRow(
            columnIndex: columnIndex,
            rowIndex: rowIndex + 4,
          ),
        );
        cell.value = TextCellValue(cells[columnIndex]);
        cell.cellStyle = CellStyle(
          horizontalAlign: columnIndex == 5 || columnIndex == 6
              ? HorizontalAlign.Center
              : HorizontalAlign.Left,
          verticalAlign: VerticalAlign.Top,
          textWrapping: TextWrapping.WrapText,
        );
      }
    }

    final widths = <int, double>{
      0: 24,
      1: 14,
      2: 18,
      3: 42,
      4: 34,
      5: 12,
      6: 12,
      7: 20,
    };
    for (final entry in widths.entries) {
      sheet.setColumnWidth(entry.key, entry.value);
    }

    final bytes = excel.encode();
    if (bytes == null) {
      throw Exception('Gagal membuat file Excel');
    }

    final dir = await getTemporaryDirectory();
    final file = File(
      '${dir.path}\\rekap_nilai_${DateTime.now().millisecondsSinceEpoch}.xlsx',
    );
    await file.writeAsBytes(bytes, flush: true);

    await Share.shareXFiles([XFile(file.path)], text: 'Rekap nilai madrasah');
  }

  static Future<void> printStudentReport(
    Map<String, dynamic> payload, {
    required String reportScope,
  }) async {
    final pdf = pw.Document();
    final data = Map<String, dynamic>.from(payload['data'] ?? const {});
    final siswa = Map<String, dynamic>.from(data['siswa'] ?? const {});
    final summary = Map<String, dynamic>.from(data['summary'] ?? const {});
    final settings = Map<String, dynamic>.from(
      data['document_setting'] ?? const {},
    );
    final pelajaran = List<Map<String, dynamic>>.from(
      (data['pelajaran'] as List? ?? const []).map(
        (item) => Map<String, dynamic>.from(item as Map),
      ),
    );
    final hafalan = List<Map<String, dynamic>>.from(
      (data['hafalan'] as List? ?? const []).map(
        (item) => Map<String, dynamic>.from(item as Map),
      ),
    );

    final signatureProvider = await _loadSignature(settings['signature_url']);
    final logoProvider = await _loadDocumentLogo(settings['document_logo_url']);

    pdf.addPage(
      pw.MultiPage(
        pageFormat: PdfPageFormat.a4,
        margin: const pw.EdgeInsets.symmetric(horizontal: 30, vertical: 26),
        header: (context) => _buildHeader(reportScope, logoProvider),
        footer: (context) => _buildFooter(context),
        build: (context) => [
          _buildIdentityCard(siswa, data['semester']?.toString()),
          pw.SizedBox(height: 14),
          _buildSummaryCard(summary),
          if (reportScope != 'hafalan') ...[
            pw.SizedBox(height: 18),
            _sectionTitle('A. NILAI PELAJARAN'),
            pw.SizedBox(height: 8),
            _buildPelajaranTable(pelajaran),
          ],
          if (reportScope != 'pelajaran') ...[
            pw.SizedBox(height: 18),
            _sectionTitle('B. NILAI HAFALAN AL-QURAN'),
            pw.SizedBox(height: 8),
            _buildHafalanTable(hafalan),
          ],
          pw.SizedBox(height: 28),
          _buildSignatureSection(settings, signatureProvider),
        ],
      ),
    );

    final nama = _safeFileSegment(siswa['nama']?.toString() ?? 'siswa');
    await Printing.layoutPdf(
      onLayout: (format) async => pdf.save(),
      name: 'Dokumen_Nilai_${nama}_$reportScope.pdf',
    );
  }

  static pw.Widget _buildHeader(String scope, pw.ImageProvider? logoProvider) {
    final subtitle = switch (scope) {
      'pelajaran' => 'DOKUMEN NILAI PELAJARAN',
      'hafalan' => 'DOKUMEN NILAI HAFALAN AL-QURAN',
      _ => 'DOKUMEN NILAI PELAJARAN & HAFALAN',
    };

    return _centered(
      pw.Container(
        width: double.infinity,
        padding: const pw.EdgeInsets.only(bottom: 10),
        decoration: const pw.BoxDecoration(
          border: pw.Border(
            bottom: pw.BorderSide(color: PdfColors.teal, width: 1.3),
          ),
        ),
        child: pw.Row(
          crossAxisAlignment: pw.CrossAxisAlignment.center,
          children: [
            if (logoProvider != null)
              pw.Container(
                width: 52,
                height: 52,
                margin: const pw.EdgeInsets.only(right: 14),
                child: pw.Image(logoProvider, fit: pw.BoxFit.contain),
              ),
            pw.Expanded(
              child: pw.Column(
                children: [
                  pw.Text(
                    'PONDOK PESANTREN QOMARUDDIN',
                    textAlign: pw.TextAlign.center,
                    style: pw.TextStyle(
                      fontSize: 16,
                      fontWeight: pw.FontWeight.bold,
                      color: PdfColors.teal900,
                    ),
                  ),
                  pw.SizedBox(height: 3),
                  pw.Text(
                    'MADRASAH DINIYAH',
                    textAlign: pw.TextAlign.center,
                    style: pw.TextStyle(
                      fontSize: 12,
                      fontWeight: pw.FontWeight.bold,
                      color: PdfColors.teal700,
                    ),
                  ),
                  pw.SizedBox(height: 6),
                  pw.Text(
                    subtitle,
                    textAlign: pw.TextAlign.center,
                    style: pw.TextStyle(
                      fontSize: 10.8,
                      fontWeight: pw.FontWeight.bold,
                      letterSpacing: 1.1,
                      color: PdfColors.grey800,
                    ),
                  ),
                  pw.SizedBox(height: 3),
                  pw.Text(
                    'Dokumen hasil belajar santri',
                    style: pw.TextStyle(
                      fontSize: 8.6,
                      color: PdfColors.grey700,
                    ),
                  ),
                ],
              ),
            ),
            pw.SizedBox(width: logoProvider == null ? 0 : 66),
          ],
        ),
      ),
    );
  }

  static pw.Widget _buildFooter(pw.Context context) {
    return _centered(
      pw.Container(
        width: double.infinity,
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

  static pw.Widget _buildIdentityCard(
    Map<String, dynamic> siswa,
    String? semester,
  ) {
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
            _identityRow('Semester / Periode', semester ?? 'Semua data aktif'),
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
              'Rata-rata Pelajaran',
              summary['rata_rata_pelajaran']?.toString() ?? '0',
            ),
            _summaryBlock(
              'Predikat',
              summary['predikat_pelajaran']?.toString() ?? '-',
            ),
            _summaryBlock(
              'Capaian Hafalan',
              summary['capaian_hafalan']?.toString() ?? '0/0',
            ),
            _summaryBlock(
              'Rata-rata Hafalan',
              summary['rata_rata_hafalan']?.toString() ?? '0',
            ),
          ],
        ),
      ),
    );
  }

  static pw.Widget _buildPelajaranTable(List<Map<String, dynamic>> rows) {
    if (rows.isEmpty) {
      return _emptyTable('Belum ada data nilai pelajaran');
    }

    return _centered(
      pw.Table(
        border: pw.TableBorder.all(color: PdfColors.grey300, width: 0.4),
        columnWidths: {
          0: const pw.FlexColumnWidth(2.8),
          1: const pw.FlexColumnWidth(1),
          2: const pw.FlexColumnWidth(1),
          3: const pw.FlexColumnWidth(1.8),
        },
        children: [
          _tableHeader(['Mata Pelajaran', 'Rata-rata', 'Predikat', 'Penilai']),
          ...rows.map(
            (row) => pw.TableRow(
              children: [
                _tableCell(row['nama_mapel']?.toString() ?? '-'),
                _tableCell(
                  row['rata_rata']?.toString() ?? '-',
                  align: pw.TextAlign.center,
                ),
                _tableCell(
                  row['predikat']?.toString() ?? '-',
                  align: pw.TextAlign.center,
                ),
                _tableCell(row['penilai_nama']?.toString() ?? '-'),
              ],
            ),
          ),
        ],
      ),
    );
  }

  static pw.Widget _buildHafalanTable(List<Map<String, dynamic>> rows) {
    if (rows.isEmpty) {
      return _emptyTable('Belum ada data hafalan Al-Quran');
    }

    return _centered(
      pw.Table(
        border: pw.TableBorder.all(color: PdfColors.grey300, width: 0.4),
        columnWidths: {
          0: const pw.FlexColumnWidth(2.6),
          1: const pw.FlexColumnWidth(1),
          2: const pw.FlexColumnWidth(0.9),
          3: const pw.FlexColumnWidth(1.8),
        },
        children: [
          _tableHeader(['Hafalan', 'Status', 'Nilai', 'Penilai']),
          ...rows.map(
            (row) => pw.TableRow(
              children: [
                _tableCell(row['item_label']?.toString() ?? '-'),
                _tableCell(
                  row['status']?.toString() ?? '-',
                  align: pw.TextAlign.center,
                ),
                _tableCell(
                  row['nilai']?.toString() ?? '-',
                  align: pw.TextAlign.center,
                ),
                _tableCell(row['penilai_nama']?.toString() ?? '-'),
              ],
            ),
          ),
        ],
      ),
    );
  }

  static pw.Widget _buildSignatureSection(
    Map<String, dynamic> settings,
    pw.ImageProvider? signatureProvider,
  ) {
    final signatureMode = settings['signature_mode']?.toString() ?? 'kosong';
    final kepalaNama =
        settings['kepala_madin_nama']?.toString() ?? 'Kepala Madin';
    final jabatan =
        settings['jabatan']?.toString() ?? 'Kepala Madrasah Diniyah';

    return _centered(
      pw.Row(
        mainAxisAlignment: pw.MainAxisAlignment.end,
        children: [
          pw.SizedBox(
            width: 210,
            child: pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.center,
              children: [
                pw.Text(
                  'Gresik, ${_formatDateNow()}',
                  style: const pw.TextStyle(fontSize: 10),
                ),
                pw.SizedBox(height: 6),
                pw.Text(jabatan, style: const pw.TextStyle(fontSize: 10)),
                pw.SizedBox(height: 18),
                if (signatureMode == 'uploaded' && signatureProvider != null)
                  pw.Container(
                    height: 52,
                    alignment: pw.Alignment.center,
                    child: pw.Image(signatureProvider, fit: pw.BoxFit.contain),
                  )
                else
                  pw.Container(
                    height: 52,
                    alignment: pw.Alignment.bottomCenter,
                    child: pw.Text(
                      '(........................................)',
                      style: pw.TextStyle(
                        fontSize: 10,
                        color: PdfColors.grey600,
                      ),
                    ),
                  ),
                pw.SizedBox(height: 8),
                pw.Text(
                  kepalaNama,
                  style: pw.TextStyle(
                    fontSize: 10,
                    fontWeight: pw.FontWeight.bold,
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
        style: const pw.TextStyle(fontSize: 9.2),
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

  static Future<pw.ImageProvider?> _loadSignature(String? url) async {
    if (url == null || url.isEmpty) return null;
    try {
      final response = await http.get(Uri.parse(url));
      if (response.statusCode >= 200 && response.statusCode < 300) {
        return pw.MemoryImage(response.bodyBytes);
      }
    } catch (_) {}
    return null;
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
