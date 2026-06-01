import 'dart:typed_data';

import 'package:flutter/services.dart' show rootBundle;
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';

import 'api_service.dart';

class CetakSiswaPdf {
  static const double _contentWidth = 455;

  static Future<void> cetakAtauDownload(Map<String, String> siswa) async {
    final pdf = pw.Document();
    final logo = await _loadDocumentLogo();

    pdf.addPage(
      pw.MultiPage(
        pageFormat: PdfPageFormat.a4,
        margin: const pw.EdgeInsets.symmetric(horizontal: 30, vertical: 32),
        header: (context) => _buildHeader(logo),
        footer: (context) => _buildFooter(context),
        build: (context) => [
          _sectionTitle('I. DATA SANTRI'),
          _spacer(10),
          _dataRow('NIS', siswa['nis'] ?? '-'),
          _dataRow('NISN', siswa['nisn'] ?? '-'),
          _dataRow('Nama Lengkap', siswa['nama'] ?? '-'),
          _dataRow('Nama Panggilan', siswa['namaPanggilan'] ?? '-'),
          _dataRow('Jenis Kelamin', siswa['jk'] ?? '-'),
          _dataRow('Tempat Lahir', siswa['tempatLahir'] ?? '-'),
          _dataRow('Tanggal Lahir', siswa['tglLahir'] ?? '-'),
          _dataRow('NIK', siswa['nik'] ?? '-'),
          _dataRow('No. KK', siswa['noKk'] ?? '-'),
          _dataRow('No. Akta', siswa['noAkta'] ?? '-'),
          _dataRow('Alamat', siswa['alamat'] ?? '-'),
          _dataRow('Kewarganegaraan', siswa['kewarganegaraan'] ?? '-'),
          _dataRow('Provinsi', siswa['provinsi'] ?? '-'),
          _dataRow('Kota/Kabupaten', siswa['kota'] ?? '-'),
          _dataRow('Kecamatan', siswa['kecamatan'] ?? '-'),
          _dataRow('Kelurahan/Desa', siswa['kelurahan'] ?? '-'),
          _dataRow('Kode Pos', siswa['kodePos'] ?? '-'),
          _dataRow('No. WhatsApp', siswa['noWhatsapp'] ?? '-'),
          _dataRow('Email', siswa['emailSiswa'] ?? '-'),
          _dataRow('Sekolah Asal', siswa['asalSekolah'] ?? '-'),
          _dataRow('Tahun Lulus', siswa['tahunLulus'] ?? '-'),
          _dataRow('Tahun Akademik Masuk', siswa['tahunAkademikMasuk'] ?? '-'),
          _dataRow('Jenis Santri', siswa['jenisSantri'] ?? '-'),
          _dataRow('Kelas', siswa['kelas'] ?? '-'),
          _spacer(18),
          _sectionTitle('II. DATA ORANG TUA / WALI'),
          _spacer(10),
          _subSectionTitle('Data Ayah'),
          _dataRow('Nama Ayah', siswa['namaAyah'] ?? '-'),
          _dataRow('NIK Ayah', siswa['nikAyah'] ?? '-'),
          _dataRow('Tempat Lahir', siswa['tempatLahirAyah'] ?? '-'),
          _dataRow('Tanggal Lahir', siswa['tglLahirAyah'] ?? '-'),
          _dataRow('Pekerjaan', siswa['pekerjaanAyah'] ?? '-'),
          _dataRow('Penghasilan', siswa['penghasilanAyah'] ?? '-'),
          _dataRow('Pendidikan', siswa['pendidikanAyah'] ?? '-'),
          _dataRow('No. WhatsApp', siswa['noWhatsappAyah'] ?? '-'),
          _spacer(8),
          _subSectionTitle('Data Ibu'),
          _dataRow('Nama Ibu', siswa['namaIbu'] ?? '-'),
          _dataRow('NIK Ibu', siswa['nikIbu'] ?? '-'),
          _dataRow('Tempat Lahir', siswa['tempatLahirIbu'] ?? '-'),
          _dataRow('Tanggal Lahir', siswa['tglLahirIbu'] ?? '-'),
          _dataRow('Pekerjaan', siswa['pekerjaanIbu'] ?? '-'),
          _dataRow('Penghasilan', siswa['penghasilanIbu'] ?? '-'),
          _dataRow('Pendidikan', siswa['pendidikanIbu'] ?? '-'),
          _dataRow('No. WhatsApp', siswa['noWhatsappIbu'] ?? '-'),
          _spacer(8),
          _subSectionTitle('Data Wali'),
          _dataRow('Wali Sama Dengan', _waliLabel(siswa['waliSamaDengan'])),
          if (_isManualWali(siswa['waliSamaDengan'])) ...[
            _dataRow('Nama Wali', siswa['namaWali'] ?? '-'),
            _dataRow('Pekerjaan Wali', siswa['pekerjaanWali'] ?? '-'),
            _dataRow('Alamat Wali', siswa['alamatWali'] ?? '-'),
            _dataRow('No. Telp Wali', siswa['telpWali'] ?? '-'),
          ],
          _spacer(18),
          _sectionTitle('III. DATA PROFIL'),
          _spacer(10),
          _dataRow('Tempat Tinggal', siswa['tempatTinggal'] ?? '-'),
          _dataRow('Transportasi', siswa['transportasi'] ?? '-'),
          _dataRow('Tinggi Badan', '${siswa['tinggiBadan'] ?? '-'} cm'),
          _dataRow('Berat Badan', '${siswa['beratBadan'] ?? '-'} kg'),
          _dataRow('Golongan Darah', siswa['golonganDarah'] ?? '-'),
          _dataRow('Catatan', siswa['catatanSantri'] ?? '-'),
        ],
      ),
    );

    await Printing.layoutPdf(
      onLayout: (format) async => pdf.save(),
      name: 'Data_Santri_${siswa['nama'] ?? 'siswa'}.pdf',
    );
  }

  static String _waliLabel(String? value) {
    final clean = value?.trim().toLowerCase() ?? '';
    if (clean == 'ayah') return 'Ayah';
    if (clean == 'ibu') return 'Ibu';
    if (clean == 'wali' || clean == 'lainnya' || clean == 'lain') {
      return 'Wali';
    }
    return 'Lainnya';
  }

  static bool _isManualWali(String? value) {
    final clean = value?.trim().toLowerCase() ?? '';
    return clean.isEmpty ||
        clean == 'wali' ||
        clean == 'lainnya' ||
        clean == 'lain';
  }

  static Future<pw.ImageProvider?> _loadDocumentLogo() async {
    try {
      final result = await ApiService.getDocumentSettings();
      final data = Map<String, dynamic>.from(result['data'] ?? const {});
      final logoUrl = data['document_logo_url']?.toString();
      if (logoUrl != null && logoUrl.isNotEmpty) {
        return await networkImage(logoUrl);
      }
    } catch (_) {}

    try {
      final data = await rootBundle.load('assets/images/Logo_Qomaruddin.png');
      return pw.MemoryImage(Uint8List.fromList(data.buffer.asUint8List()));
    } catch (_) {
      return null;
    }
  }

  static pw.Widget _buildHeader(pw.ImageProvider? logo) {
    return pw.Align(
      alignment: pw.Alignment.center,
      child: pw.Container(
        width: _contentWidth,
        padding: const pw.EdgeInsets.only(bottom: 12),
        decoration: const pw.BoxDecoration(
          border: pw.Border(
            bottom: pw.BorderSide(width: 1.6, color: PdfColors.teal),
          ),
        ),
        child: pw.Row(
          crossAxisAlignment: pw.CrossAxisAlignment.center,
          children: [
            if (logo != null)
              pw.Container(
                width: 54,
                height: 54,
                margin: const pw.EdgeInsets.only(right: 14),
                child: pw.Image(logo, fit: pw.BoxFit.contain),
              ),
            pw.Expanded(
              child: pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.center,
                children: [
                  pw.Text(
                    'PONDOK PESANTREN QOMARUDDIN',
                    textAlign: pw.TextAlign.center,
                    style: pw.TextStyle(
                      fontSize: 17,
                      fontWeight: pw.FontWeight.bold,
                      color: PdfColors.teal900,
                    ),
                  ),
                  pw.SizedBox(height: 3),
                  pw.Text(
                    'MADRASAH DINIAH',
                    textAlign: pw.TextAlign.center,
                    style: pw.TextStyle(
                      fontSize: 13,
                      fontWeight: pw.FontWeight.bold,
                      color: PdfColors.teal700,
                    ),
                  ),
                  pw.SizedBox(height: 5),
                  pw.Text(
                    'DATA SANTRI / BUKU INDUK',
                    textAlign: pw.TextAlign.center,
                    style: pw.TextStyle(
                      fontSize: 11,
                      fontWeight: pw.FontWeight.bold,
                      letterSpacing: 1.2,
                      color: PdfColors.grey800,
                    ),
                  ),
                ],
              ),
            ),
            pw.SizedBox(width: logo == null ? 0 : 68),
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
            top: pw.BorderSide(width: 0.5, color: PdfColors.grey400),
          ),
        ),
        child: pw.Row(
          mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
          children: [
            pw.Text(
              'Dicetak dari Sistem Informasi Madrasah Diniah',
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

  static pw.Widget _sectionTitle(String title) {
    return _centeredBlock(
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
            fontSize: 11,
            fontWeight: pw.FontWeight.bold,
            color: PdfColors.white,
          ),
        ),
      ),
    );
  }

  static pw.Widget _subSectionTitle(String title) {
    return _centeredBlock(
      pw.Container(
        width: double.infinity,
        padding: const pw.EdgeInsets.symmetric(vertical: 4, horizontal: 10),
        margin: const pw.EdgeInsets.only(bottom: 3),
        decoration: pw.BoxDecoration(
          color: PdfColors.amber50,
          borderRadius: pw.BorderRadius.circular(3),
          border: pw.Border.all(color: PdfColors.amber200),
        ),
        child: pw.Text(
          title,
          textAlign: pw.TextAlign.center,
          style: pw.TextStyle(fontSize: 10, fontWeight: pw.FontWeight.bold),
        ),
      ),
    );
  }

  static pw.Widget _dataRow(String label, String value) {
    return _centeredBlock(
      pw.Container(
        width: double.infinity,
        padding: const pw.EdgeInsets.symmetric(vertical: 4.5, horizontal: 12),
        decoration: const pw.BoxDecoration(
          border: pw.Border(
            bottom: pw.BorderSide(width: 0.3, color: PdfColors.grey300),
          ),
        ),
        child: pw.Row(
          crossAxisAlignment: pw.CrossAxisAlignment.start,
          children: [
            pw.Container(
              width: 150,
              alignment: pw.Alignment.centerLeft,
              child: pw.Text(
                label,
                style: pw.TextStyle(
                  fontSize: 10,
                  fontWeight: pw.FontWeight.bold,
                  color: PdfColors.grey700,
                ),
              ),
            ),
            pw.SizedBox(
              width: 14,
              child: pw.Text(
                ':',
                textAlign: pw.TextAlign.center,
                style: const pw.TextStyle(fontSize: 10),
              ),
            ),
            pw.Expanded(
              child: pw.Text(
                _safeValue(value),
                style: const pw.TextStyle(fontSize: 10),
              ),
            ),
          ],
        ),
      ),
    );
  }

  static pw.Widget _centeredBlock(pw.Widget child) {
    return pw.Align(
      alignment: pw.Alignment.center,
      child: pw.Container(width: _contentWidth, child: child),
    );
  }

  static String _safeValue(String value) {
    final trimmed = value.trim();
    return trimmed.isEmpty ? '-' : trimmed;
  }

  static pw.Widget _spacer(double h) {
    return pw.SizedBox(height: h);
  }
}
