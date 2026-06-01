class SiswaViewMapper {
  static String _val(
    Map<String, dynamic> siswa,
    String key, [
    String fallback = '-',
  ]) {
    final value = siswa[key];
    if (value == null || value.toString().trim().isEmpty) return fallback;
    return value.toString();
  }

  static String _editVal(
    Map<String, dynamic> siswa,
    String key, [
    String fallback = '',
  ]) {
    final value = _val(siswa, key, fallback).trim();
    return value == '-' ? fallback : value;
  }

  static String _tglDisplay(String? tgl) {
    if (tgl == null || tgl.isEmpty) return '-';
    try {
      final dt = DateTime.parse(tgl);
      return '${dt.day.toString().padLeft(2, '0')}-${dt.month.toString().padLeft(2, '0')}-${dt.year}';
    } catch (_) {
      return tgl;
    }
  }

  static String _jkDisplay(Map<String, dynamic> siswa) {
    final raw = siswa['jenis_kelamin']?.toString().trim().toUpperCase() ?? '';
    if (raw == 'L') return 'Laki-laki';
    if (raw == 'P') return 'Perempuan';
    return _editVal(siswa, 'jenis_kelamin');
  }

  static Map<String, String> toDetailFormat(Map<String, dynamic> s) {
    return {
      'nis': _editVal(s, 'nis'),
      'nisn': _editVal(s, 'nisn'),
      'nama': _editVal(s, 'nama'),
      'namaPanggilan': _editVal(s, 'nama_panggilan'),
      'tempatLahir': _editVal(s, 'tempat_lahir'),
      'tglLahir': _tglDisplay(s['tanggal_lahir']?.toString()),
      'jk': _jkDisplay(s),
      'nik': _editVal(s, 'nik'),
      'noKk': _editVal(s, 'no_kk'),
      'noAkta': _editVal(s, 'no_akta'),
      'dokumenAkta': _editVal(s, 'dokumen_akta'),
      'alamat': _editVal(s, 'alamat'),
      'kewarganegaraan': _editVal(s, 'kewarganegaraan', 'Indonesia'),
      'provinsi': _editVal(s, 'provinsi'),
      'provinceId': _editVal(s, 'province_id'),
      'kota': _editVal(s, 'kota'),
      'cityId': _editVal(s, 'city_id'),
      'kecamatan': _editVal(s, 'kecamatan'),
      'districtId': _editVal(s, 'district_id'),
      'kelurahan': _editVal(s, 'kelurahan'),
      'villageId': _editVal(s, 'village_id'),
      'kodePos': _editVal(s, 'kode_pos'),
      'noWhatsapp': _editVal(s, 'no_whatsapp'),
      'emailSiswa': _editVal(s, 'email_siswa'),
      'asalSekolah': _editVal(s, 'asal_sekolah'),
      'schoolOriginId': _editVal(s, 'school_origin_id'),
      'previousAsalSekolah': _editVal(s, 'previous_asal_sekolah'),
      'previousSchoolOriginId': _editVal(s, 'previous_school_origin_id'),
      'tahunLulus': _editVal(s, 'tahun_lulus'),
      'tahunAkademikMasuk': _editVal(s, 'tahun_akademik_masuk'),
      'tanggalDiterimaSekolah': _tglDisplay(
        s['tanggal_diterima_sekolah']?.toString(),
      ),
      'jenisSantri': _editVal(s, 'jenis_santri'),
      'kelas': _editVal(s, 'kelas'),
      'classId': _editVal(s, 'class_id'),
      'status': _val(s, 'status', 'Aktif'),
      'namaAyah': _editVal(s, 'nama_ayah'),
      'nikAyah': _editVal(s, 'nik_ayah'),
      'tempatLahirAyah': _editVal(s, 'tempat_lahir_ayah'),
      'tglLahirAyah': _tglDisplay(s['tanggal_lahir_ayah']?.toString()),
      'noWhatsappAyah': _editVal(s, 'no_whatsapp_ayah'),
      'pekerjaanAyah': _editVal(s, 'pekerjaan_ayah'),
      'penghasilanAyah': _editVal(s, 'penghasilan_ayah'),
      'pendidikanAyah': _editVal(s, 'pendidikan_ayah'),
      'alamatLengkapAyah': _editVal(
        s,
        'alamat_lengkap_ayah',
        _editVal(s, 'alamat_ayah'),
      ),
      'namaIbu': _editVal(s, 'nama_ibu'),
      'nikIbu': _editVal(s, 'nik_ibu'),
      'tempatLahirIbu': _editVal(s, 'tempat_lahir_ibu'),
      'tglLahirIbu': _tglDisplay(s['tanggal_lahir_ibu']?.toString()),
      'noWhatsappIbu': _editVal(s, 'no_whatsapp_ibu'),
      'pekerjaanIbu': _editVal(s, 'pekerjaan_ibu'),
      'penghasilanIbu': _editVal(s, 'penghasilan_ibu'),
      'pendidikanIbu': _editVal(s, 'pendidikan_ibu'),
      'alamatLengkapIbu': _editVal(
        s,
        'alamat_lengkap_ibu',
        _editVal(s, 'alamat_ibu'),
      ),
      'noAyah': _editVal(s, 'no_ayah'),
      'noIbu': _editVal(s, 'no_ibu'),
      'namaWali': _editVal(s, 'nama_wali_keluarga'),
      'pekerjaanWali': _editVal(s, 'pekerjaan_wali_keluarga'),
      'alamatWali': _editVal(s, 'alamat_wali_keluarga'),
      'telpWali': _editVal(s, 'no_telepon_wali'),
      'waliSamaDengan': _editVal(s, 'wali_sama_dengan'),
      'tempatTinggal': _editVal(s, 'tempat_tinggal'),
      'statusMondok': _editVal(s, 'status_mondok', 'tidak_mondok'),
      'boardingRoomId': _editVal(s, 'boarding_room_id'),
      'komplek': _editVal(
        s,
        'komplek',
        _nestedVal(s, ['boarding_room', 'complex', 'name']),
      ),
      'kamar': _editVal(s, 'kamar', _nestedVal(s, ['boarding_room', 'name'])),
      'tanggalDiterimaPondok': _tglDisplay(
        s['tanggal_diterima_pondok']?.toString(),
      ),
      'transportasi': _editVal(s, 'transportasi'),
      'tinggiBadan': _editVal(s, 'tinggi_badan'),
      'beratBadan': _editVal(s, 'berat_badan'),
      'golonganDarah': _editVal(s, 'golongan_darah'),
      'fotoSantri': _editVal(s, 'foto_santri'),
      'catatanSantri': _editVal(s, 'catatan_santri'),
    };
  }

  static String _nestedVal(Map<String, dynamic> data, List<String> path) {
    dynamic current = data;
    for (final key in path) {
      if (current is! Map) return '';
      current = current[key];
    }
    return current?.toString() ?? '';
  }
}
