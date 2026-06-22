import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:share_plus/share_plus.dart';
import '../../services/api_service.dart';
import '../../services/cetak_siswa_pdf.dart';
import '../../widgets/responsive_layout.dart';

class DetailSiswaScreen extends StatelessWidget {
  final Map<String, String> siswa;

  const DetailSiswaScreen({super.key, required this.siswa});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFFDC80),
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(context),
            const SizedBox(height: 8),
            Expanded(
              child: AppResponsive(
                child: Container(
                  margin: EdgeInsets.symmetric(
                    horizontal: AppResponsive.pageMargin(context),
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0xFFE1EFF7),
                    borderRadius: BorderRadius.circular(30),
                  ),
                  child: ListView(
                    physics: const BouncingScrollPhysics(),
                    padding: const EdgeInsets.all(16),
                    children: [
                      // ===== 1. DATA SANTRI =====
                      _buildSectionTitle('1. DATA SANTRI'),
                      _buildDivider(),
                      _buildDetailPair(
                        'NIS',
                        siswa['nis'] ?? '-',
                        'NISN',
                        siswa['nisn'] ?? '-',
                      ),
                      _buildDetailItem('Nama Lengkap', siswa['nama'] ?? '-'),
                      _buildDetailItem(
                        'Nama Panggilan',
                        siswa['namaPanggilan'] ?? '-',
                      ),
                      _buildDetailItem('Jenis Kelamin', siswa['jk'] ?? '-'),
                      _buildDetailPair(
                        'Tempat Lahir',
                        siswa['tempatLahir'] ?? '-',
                        'Tanggal Lahir',
                        siswa['tglLahir'] ?? '-',
                      ),
                      _buildDetailPair(
                        'NIK',
                        siswa['nik'] ?? '-',
                        'No KK',
                        siswa['noKk'] ?? '-',
                      ),
                      _buildDetailItem('No Akta', siswa['noAkta'] ?? '-'),
                      if (siswa['dokumenAkta']?.isNotEmpty == true)
                        _buildFileIndicator(
                          context,
                          'Dokumen Akta',
                          siswa['dokumenAkta']!,
                        ),
                      _buildDetailItem(
                        'Alamat Lengkap',
                        siswa['alamat'] ?? '-',
                      ),
                      _buildDetailItem(
                        'Kewarganegaraan',
                        siswa['kewarganegaraan'] ?? '-',
                      ),
                      _buildDetailPair(
                        'Provinsi',
                        siswa['provinsi'] ?? '-',
                        'Kota',
                        siswa['kota'] ?? '-',
                      ),
                      _buildDetailPair(
                        'Kecamatan',
                        siswa['kecamatan'] ?? '-',
                        'Kelurahan',
                        siswa['kelurahan'] ?? '-',
                      ),
                      _buildDetailItem('Kode Pos', siswa['kodePos'] ?? '-'),
                      _buildDetailPair(
                        'No WhatsApp',
                        siswa['noWhatsapp'] ?? '-',
                        'Email',
                        siswa['emailSiswa'] ?? '-',
                      ),
                      _buildDetailItem(
                        'Sekolah Asal Sebelumnya',
                        siswa['previousAsalSekolah'] ?? '-',
                      ),
                      _buildDetailItem(
                        'Sekolah Asal / Sekolah Sekarang',
                        siswa['asalSekolah'] ?? '-',
                      ),
                      _buildDetailItem(
                        'Tanggal Diterima Sekolah',
                        siswa['tanggalDiterimaSekolah'] ?? '-',
                      ),
                      _buildDetailPair(
                        'Tahun Lulus',
                        siswa['tahunLulus'] ?? '-',
                        'Thn Akademik Masuk',
                        siswa['tahunAkademikMasuk'] ?? '-',
                      ),
                      _buildDetailPair(
                        'Jenis Santri',
                        siswa['jenisSantri'] ?? '-',
                        'Kelas',
                        siswa['kelas'] ?? '-',
                      ),
                      const SizedBox(height: 16),

                      // ===== 2. DATA ORANG TUA =====
                      _buildSectionTitle('2. DATA ORANG TUA / WALI'),
                      _buildDivider(),
                      _buildOrangtua(
                        'Nama',
                        siswa['namaAyah'] ?? '-',
                        siswa['namaIbu'] ?? '-',
                      ),
                      _buildOrangtua(
                        'NIK',
                        siswa['nikAyah'] ?? '-',
                        siswa['nikIbu'] ?? '-',
                      ),
                      _buildOrangtua(
                        'Tempat Lahir',
                        siswa['tempatLahirAyah'] ?? '-',
                        siswa['tempatLahirIbu'] ?? '-',
                      ),
                      _buildOrangtua(
                        'Tanggal Lahir',
                        siswa['tglLahirAyah'] ?? '-',
                        siswa['tglLahirIbu'] ?? '-',
                      ),
                      _buildOrangtua(
                        'Pekerjaan',
                        siswa['pekerjaanAyah'] ?? '-',
                        siswa['pekerjaanIbu'] ?? '-',
                      ),
                      _buildOrangtua(
                        'Penghasilan',
                        siswa['penghasilanAyah'] ?? '-',
                        siswa['penghasilanIbu'] ?? '-',
                      ),
                      _buildOrangtua(
                        'Pendidikan',
                        siswa['pendidikanAyah'] ?? '-',
                        siswa['pendidikanIbu'] ?? '-',
                      ),
                      _buildOrangtua(
                        'No. WhatsApp',
                        siswa['noWhatsappAyah'] ?? '-',
                        siswa['noWhatsappIbu'] ?? '-',
                      ),
                      _buildOrangtua(
                        'Alamat Lengkap',
                        siswa['alamatLengkapAyah'] ?? '-',
                        siswa['alamatLengkapIbu'] ?? '-',
                      ),
                      const SizedBox(height: 8),
                      _buildSubSection('Data Wali'),
                      if (siswa['waliSamaDengan']?.isNotEmpty == true)
                        _buildDetailItem(
                          'Wali Sama Dengan',
                          _waliLabel(siswa['waliSamaDengan']),
                        )
                      else ...[
                        _buildDetailItem('Nama Wali', siswa['namaWali'] ?? '-'),
                        _buildDetailItem(
                          'Pekerjaan Wali',
                          siswa['pekerjaanWali'] ?? '-',
                        ),
                        _buildDetailItem(
                          'Alamat Wali',
                          siswa['alamatWali'] ?? '-',
                        ),
                        _buildDetailItem(
                          'No. Telp Wali',
                          siswa['telpWali'] ?? '-',
                        ),
                      ],
                      const SizedBox(height: 16),

                      // ===== 3. DATA PROFIL =====
                      _buildSectionTitle('3. DATA PROFIL'),
                      _buildDivider(),
                      _buildDetailPair(
                        'Tempat Tinggal',
                        siswa['tempatTinggal'] ?? '-',
                        'Transportasi',
                        siswa['transportasi'] ?? '-',
                      ),
                      _buildDetailPair(
                        'Status Mondok',
                        _statusMondokLabel(siswa['statusMondok']),
                        'Tgl Diterima Pondok',
                        siswa['tanggalDiterimaPondok'] ?? '-',
                      ),
                      _buildDetailPair(
                        'Komplek',
                        siswa['komplek'] ?? '-',
                        'Kamar',
                        siswa['kamar'] ?? '-',
                      ),
                      _buildDetailPair(
                        'Tinggi Badan',
                        '${siswa['tinggiBadan'] ?? '-'} cm',
                        'Berat Badan',
                        '${siswa['beratBadan'] ?? '-'} kg',
                      ),
                      _buildDetailItem(
                        'Golongan Darah',
                        siswa['golonganDarah'] ?? '-',
                      ),
                      _buildDetailItem(
                        'Catatan',
                        siswa['catatanSantri'] ?? '-',
                      ),
                      if (siswa['fotoSantri']?.isNotEmpty == true)
                        _buildFileIndicator(
                          context,
                          'Foto Santri',
                          siswa['fotoSantri']!,
                        ),
                      const SizedBox(height: 20),

                      // TOMBOL CETAK
                      SizedBox(
                        width: double.infinity,
                        height: 50,
                        child: ElevatedButton.icon(
                          onPressed: () =>
                              CetakSiswaPdf.cetakAtauDownload(siswa),
                          icon: const Icon(Icons.print_rounded, size: 20),
                          label: Text(
                            'Cetak / Download PDF',
                            style: GoogleFonts.poppins(
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF138F81),
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(18),
                            ),
                            elevation: 3,
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  String _waliLabel(String? value) {
    final clean = value?.trim().toLowerCase() ?? '';
    if (clean == 'ayah') return 'Ayah';
    if (clean == 'ibu') return 'Ibu';
    if (clean == 'wali' || clean == 'lainnya' || clean == 'lain') {
      return 'Wali';
    }
    return '-';
  }

  String _statusMondokLabel(String? value) {
    final clean = value?.trim().toLowerCase() ?? '';
    if (clean == 'mondok') return 'Mondok';
    if (clean == 'tidak_mondok' || clean.contains('tidak')) {
      return 'Tidak Mondok';
    }
    return '-';
  }

  Widget _buildHeader(BuildContext context) {
    final isMale = siswa['jk'] == 'Laki-laki';
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: const Color(0xFFE1EFF7),
          borderRadius: BorderRadius.circular(25),
        ),
        child: Row(
          children: [
            Container(
              width: 46,
              height: 46,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: isMale
                      ? [const Color(0xFF2E86DE), const Color(0xFF54A0FF)]
                      : [const Color(0xFFE65100), const Color(0xFFFF8A65)],
                ),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Icon(
                isMale ? Icons.boy_rounded : Icons.girl_rounded,
                color: Colors.white,
                size: 24,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Detail Siswa',
                    style: GoogleFonts.poppins(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: const Color(0xFF2D3436),
                    ),
                  ),
                  Text(
                    siswa['nama'] ?? '',
                    style: GoogleFonts.poppins(
                      fontSize: 11,
                      color: const Color(0xFF636E72),
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
            // Cetak button in header
            IconButton(
              onPressed: () => CetakSiswaPdf.cetakAtauDownload(siswa),
              icon: const Icon(
                Icons.print_rounded,
                size: 22,
                color: Color(0xFF138F81),
              ),
              tooltip: 'Cetak PDF',
            ),
            IconButton(
              onPressed: () => Navigator.pop(context),
              icon: const Icon(
                Icons.close_rounded,
                size: 22,
                color: Color(0xFF636E72),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSectionTitle(String title) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 14),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF138F81), Color(0xFF1BA897)],
        ),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Text(
        title,
        style: GoogleFonts.poppins(
          fontSize: 14,
          fontWeight: FontWeight.w700,
          color: Colors.white,
          letterSpacing: 0.5,
        ),
      ),
    );
  }

  Widget _buildSubSection(String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
        decoration: BoxDecoration(
          color: const Color(0xFFFFDC80).withValues(alpha: 0.5),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: const Color(0xFFFFDC80)),
        ),
        child: Text(
          title,
          style: GoogleFonts.poppins(
            fontSize: 12,
            fontWeight: FontWeight.w700,
            color: const Color(0xFF2D3436),
          ),
        ),
      ),
    );
  }

  Widget _buildDivider() {
    return const Padding(
      padding: EdgeInsets.only(bottom: 10, top: 6),
      child: Divider(height: 1, color: Color(0xFFB2BEC3)),
    );
  }

  Widget _buildDetailItem(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label,
              style: GoogleFonts.poppins(
                fontSize: 10,
                fontWeight: FontWeight.w500,
                color: const Color(0xFF636E72),
              ),
            ),
            const SizedBox(height: 3),
            Text(
              value,
              style: GoogleFonts.poppins(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: const Color(0xFF2D3436),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDetailPair(String l1, String v1, String l2, String v2) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          Expanded(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    l1,
                    style: GoogleFonts.poppins(
                      fontSize: 10,
                      fontWeight: FontWeight.w500,
                      color: const Color(0xFF636E72),
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    v1,
                    style: GoogleFonts.poppins(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: const Color(0xFF2D3436),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    l2,
                    style: GoogleFonts.poppins(
                      fontSize: 10,
                      fontWeight: FontWeight.w500,
                      color: const Color(0xFF636E72),
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    v2,
                    style: GoogleFonts.poppins(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: const Color(0xFF2D3436),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildOrangtua(String label, String ayah, String ibu) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: GoogleFonts.poppins(
              fontSize: 10,
              fontWeight: FontWeight.w500,
              color: const Color(0xFF636E72),
            ),
          ),
          const SizedBox(height: 4),
          Row(
            children: [
              Expanded(
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 10,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: const Color(0xFF2E86DE).withValues(alpha: 0.2),
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Ayah',
                        style: GoogleFonts.poppins(
                          fontSize: 9,
                          fontWeight: FontWeight.w500,
                          color: const Color(0xFF2E86DE),
                        ),
                      ),
                      Text(
                        ayah,
                        style: GoogleFonts.poppins(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: const Color(0xFF2D3436),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 10,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: const Color(0xFFE65100).withValues(alpha: 0.2),
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Ibu',
                        style: GoogleFonts.poppins(
                          fontSize: 9,
                          fontWeight: FontWeight.w500,
                          color: const Color(0xFFE65100),
                        ),
                      ),
                      Text(
                        ibu,
                        style: GoogleFonts.poppins(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: const Color(0xFF2D3436),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  String _storageUrl(String path) {
    final clean = path.trim();
    if (clean.startsWith('http://') || clean.startsWith('https://')) {
      return clean;
    }
    final root = ApiService.baseUrl.replaceFirst(RegExp(r'/api/?$'), '');
    return '$root/storage/$clean';
  }

  bool _isImagePath(String path) {
    final lower = path.toLowerCase();
    return lower.endsWith('.jpg') ||
        lower.endsWith('.jpeg') ||
        lower.endsWith('.png') ||
        lower.endsWith('.webp');
  }

  Future<void> _previewStoredFile(
    BuildContext context,
    String label,
    String path,
  ) async {
    final url = _storageUrl(path);
    if (_isImagePath(path)) {
      await showDialog<void>(
        context: context,
        builder: (_) => Dialog(
          insetPadding: const EdgeInsets.all(18),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(18),
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(18),
            child: Image.network(url, fit: BoxFit.contain),
          ),
        ),
      );
      return;
    }

    await Share.share(url, subject: label);
  }

  Widget _buildFileIndicator(BuildContext context, String label, String path) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: const Color(0xFF138F81).withValues(alpha: 0.3),
          ),
        ),
        child: Row(
          children: [
            const Icon(
              Icons.attach_file_rounded,
              size: 16,
              color: Color(0xFF138F81),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    style: GoogleFonts.poppins(
                      fontSize: 10,
                      fontWeight: FontWeight.w500,
                      color: const Color(0xFF636E72),
                    ),
                  ),
                  Text(
                    path.split('/').last,
                    style: GoogleFonts.poppins(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: const Color(0xFF138F81),
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
            TextButton.icon(
              onPressed: () => _previewStoredFile(context, label, path),
              icon: const Icon(Icons.visibility_rounded, size: 15),
              label: Text('Lihat', style: GoogleFonts.poppins(fontSize: 10)),
              style: TextButton.styleFrom(
                foregroundColor: const Color(0xFF138F81),
                padding: const EdgeInsets.symmetric(horizontal: 6),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
