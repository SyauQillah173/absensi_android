// ================================================================
// API SERVICE — Komunikasi Flutter ↔ Laravel Backend
// ================================================================
// File: lib/services/api_service.dart
//
// Semua request HTTP ke Laravel API ada di sini.
// Base URL bisa diubah ke IP laptop saat testing di HP.
// ================================================================

import 'dart:convert';

import 'package:http/http.dart' as http;

class ApiService {
  // === UBAH INI SESUAI PERANGKAT ===
  // Emulator Android: 'http://10.0.2.2:8000/api'
  // HP fisik (1 WiFi): ganti ke IP laptop
  // Untuk cari IP laptop: buka CMD → ketik `ipconfig` → lihat IPv4 Address
  // static String baseUrl = 'http://192.168.0.101:8000/api';
  // static String baseUrl = 'http://10.180.254.198:8000/api';
  static String baseUrl = 'https://mom-litigation-sip-receipt.trycloudflare.com/api';
  // ==================================

  static final Map<String, String> _headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  // ---------- DASHBOARD ----------
  static Future<Map<String, dynamic>> getDashboard() async {
    final response = await http
        .get(Uri.parse('$baseUrl/dashboard'), headers: _headers)
        .timeout(const Duration(seconds: 5));
    return _handleResponse(response);
  }

  // ---------- SISWA ----------
  static Future<Map<String, dynamic>> getSiswa({
    String? kelas,
    String? search,
    bool withWali = false,
  }) async {
    final params = <String, String>{};
    if (kelas != null) params['kelas'] = kelas;
    if (search != null) params['search'] = search;
    if (withWali) params['with_wali'] = '1';

    final uri = Uri.parse(
      '$baseUrl/siswa',
    ).replace(queryParameters: params.isNotEmpty ? params : null);
    final response = await http
        .get(uri, headers: _headers)
        .timeout(const Duration(seconds: 5));
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> getSiswaDetail(int id) async {
    final response = await http.get(
      Uri.parse('$baseUrl/siswa/$id'),
      headers: _headers,
    );
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> createSiswa(
    Map<String, dynamic> data,
  ) async {
    final response = await http.post(
      Uri.parse('$baseUrl/siswa'),
      headers: _headers,
      body: jsonEncode(data),
    );
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> updateSiswa(
    int id,
    Map<String, dynamic> data,
  ) async {
    final response = await http.put(
      Uri.parse('$baseUrl/siswa/$id'),
      headers: _headers,
      body: jsonEncode(data),
    );
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> deleteSiswa(int id) async {
    final response = await http.delete(
      Uri.parse('$baseUrl/siswa/$id'),
      headers: _headers,
    );
    return _handleResponse(response);
  }

  // ---------- MATA PELAJARAN ----------
  static Future<Map<String, dynamic>> getMataPelajaran({String? search}) async {
    final params = <String, String>{};
    if (search != null) params['search'] = search;

    final uri = Uri.parse(
      '$baseUrl/mata-pelajaran',
    ).replace(queryParameters: params.isNotEmpty ? params : null);
    final response = await http
        .get(uri, headers: _headers)
        .timeout(const Duration(seconds: 8));
    return _handleResponse(response);
  }

  // ---------- JADWAL ----------
  static Future<Map<String, dynamic>> getJadwal({
    String? hari,
    String? sifir,
    String? search,
  }) async {
    final params = <String, String>{};
    if (hari != null) params['hari'] = hari;
    if (sifir != null) params['sifir'] = sifir;
    if (search != null) params['search'] = search;

    final uri = Uri.parse(
      '$baseUrl/jadwal',
    ).replace(queryParameters: params.isNotEmpty ? params : null);
    final response = await http.get(uri, headers: _headers);
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> updateJadwal(
    int id,
    Map<String, dynamic> data,
  ) async {
    final response = await http.put(
      Uri.parse('$baseUrl/jadwal/$id'),
      headers: _headers,
      body: jsonEncode(data),
    );
    return _handleResponse(response);
  }

  // ---------- ABSENSI ----------
  static Future<Map<String, dynamic>> getAbsensi({
    String? tanggal,
    String? kelas,
    String? mapel,
  }) async {
    final params = <String, String>{};
    if (tanggal != null) params['tanggal'] = tanggal;
    if (kelas != null) params['kelas'] = kelas;
    if (mapel != null) params['mapel'] = mapel;

    final uri = Uri.parse(
      '$baseUrl/absensi',
    ).replace(queryParameters: params.isNotEmpty ? params : null);
    final response = await http.get(uri, headers: _headers);
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> createAbsensi(
    Map<String, dynamic> data,
  ) async {
    final response = await http.post(
      Uri.parse('$baseUrl/absensi'),
      headers: _headers,
      body: jsonEncode(data),
    );
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> createAbsensiBulk(
    List<Map<String, dynamic>> absensiList,
  ) async {
    final response = await http.post(
      Uri.parse('$baseUrl/absensi/bulk'),
      headers: _headers,
      body: jsonEncode({'absensi': absensiList}),
    );
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> updateAbsensi(
    int id,
    Map<String, dynamic> data,
  ) async {
    final response = await http.put(
      Uri.parse('$baseUrl/absensi/$id'),
      headers: _headers,
      body: jsonEncode(data),
    );
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> deleteAbsensi(
    int id, {
    String? actorRole,
    String? actorName,
  }) async {
    final params = <String, String>{};
    if (actorRole != null) params['actor_role'] = actorRole;
    if (actorName != null) params['actor_name'] = actorName;
    final uri = Uri.parse(
      '$baseUrl/absensi/$id',
    ).replace(queryParameters: params.isNotEmpty ? params : null);
    final response = await http.delete(uri, headers: _headers);
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> getRekapAbsensi({
    required int bulan,
    required int tahun,
    String? kelas,
    String? tanggalMulai,
    String? tanggalAkhir,
  }) async {
    final params = <String, String>{
      'bulan': bulan.toString(),
      'tahun': tahun.toString(),
    };
    if (kelas != null) params['kelas'] = kelas;
    if (tanggalMulai != null) params['tanggal_mulai'] = tanggalMulai;
    if (tanggalAkhir != null) params['tanggal_akhir'] = tanggalAkhir;

    final uri = Uri.parse(
      '$baseUrl/absensi/rekap',
    ).replace(queryParameters: params);
    final response = await http.get(uri, headers: _headers);
    return _handleResponse(response);
  }

  // ---------- PEMBAYARAN ----------
  static Future<Map<String, dynamic>> getPembayaran({String? tanggal}) async {
    final params = <String, String>{};
    if (tanggal != null) params['tanggal'] = tanggal;

    final uri = Uri.parse(
      '$baseUrl/pembayaran',
    ).replace(queryParameters: params.isNotEmpty ? params : null);
    final response = await http.get(uri, headers: _headers);
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> createPembayaran(
    Map<String, dynamic> data,
  ) async {
    final response = await http
        .post(
          Uri.parse('$baseUrl/pembayaran'),
          headers: _headers,
          body: jsonEncode(data),
        )
        .timeout(const Duration(seconds: 10));
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> updatePembayaran(
    int id,
    Map<String, dynamic> data,
  ) async {
    final response = await http
        .put(
          Uri.parse('$baseUrl/pembayaran/$id'),
          headers: _headers,
          body: jsonEncode(data),
        )
        .timeout(const Duration(seconds: 10));
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> getAllPembayaran() async {
    final uri = Uri.parse(
      '$baseUrl/pembayaran',
    ).replace(queryParameters: {'semua': '1'});
    final response = await http
        .get(uri, headers: _headers)
        .timeout(const Duration(seconds: 10));
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> deletePembayaran(int id) async {
    final response = await http.delete(
      Uri.parse('$baseUrl/pembayaran/$id'),
      headers: _headers,
    );
    return _handleResponse(response);
  }

  // ---------- KELOMPOK BELAJAR ----------
  static Future<Map<String, dynamic>> getKelompokBelajar({
    String? sifir,
  }) async {
    final params = <String, String>{};
    if (sifir != null) params['sifir'] = sifir;

    final uri = Uri.parse(
      '$baseUrl/kelompok-belajar',
    ).replace(queryParameters: params.isNotEmpty ? params : null);
    final response = await http
        .get(uri, headers: _headers)
        .timeout(const Duration(seconds: 5));
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> getKelompokDetail(int id) async {
    final response = await http
        .get(Uri.parse('$baseUrl/kelompok-belajar/$id'), headers: _headers)
        .timeout(const Duration(seconds: 5));
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> addSiswaToKelompok(
    int kelompokId,
    int siswaId,
  ) async {
    final response = await http.post(
      Uri.parse('$baseUrl/kelompok-belajar/$kelompokId/siswa'),
      headers: _headers,
      body: jsonEncode({'siswa_id': siswaId}),
    );
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> removeSiswaFromKelompok(
    int kelompokId,
    int siswaId,
  ) async {
    final response = await http.delete(
      Uri.parse('$baseUrl/kelompok-belajar/$kelompokId/siswa/$siswaId'),
      headers: _headers,
    );
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> createKelompokBelajar(
    Map<String, dynamic> data,
  ) async {
    final response = await http.post(
      Uri.parse('$baseUrl/kelompok-belajar'),
      headers: _headers,
      body: jsonEncode(data),
    );
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> deleteKelompokBelajar(int id) async {
    final response = await http
        .delete(Uri.parse('$baseUrl/kelompok-belajar/$id'), headers: _headers)
        .timeout(const Duration(seconds: 10));
    return _handleResponse(response);
  }

  // ---------- WALI (ORANG TUA) — Read-only Monitoring ----------
  static Future<Map<String, dynamic>> getAnakWali(int waliId) async {
    final uri = Uri.parse(
      '$baseUrl/wali/anak',
    ).replace(queryParameters: {'wali_id': waliId.toString()});
    final response = await http
        .get(uri, headers: _headers)
        .timeout(const Duration(seconds: 5));
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> getAbsensiAnak(
    int siswaId, {
    int? bulan,
    int? tahun,
  }) async {
    final params = <String, String>{'siswa_id': siswaId.toString()};
    if (bulan != null) params['bulan'] = bulan.toString();
    if (tahun != null) params['tahun'] = tahun.toString();

    final uri = Uri.parse(
      '$baseUrl/wali/absensi',
    ).replace(queryParameters: params);
    final response = await http
        .get(uri, headers: _headers)
        .timeout(const Duration(seconds: 10));
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> getPembayaranAnak(int siswaId) async {
    final uri = Uri.parse(
      '$baseUrl/wali/pembayaran',
    ).replace(queryParameters: {'siswa_id': siswaId.toString()});
    final response = await http
        .get(uri, headers: _headers)
        .timeout(const Duration(seconds: 10));
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> getNilaiAnak(
    int siswaId, {
    String? semester,
  }) async {
    final params = <String, String>{'siswa_id': siswaId.toString()};
    if (semester != null) params['semester'] = semester;

    final uri = Uri.parse(
      '$baseUrl/wali/nilai',
    ).replace(queryParameters: params);
    final response = await http
        .get(uri, headers: _headers)
        .timeout(const Duration(seconds: 10));
    return _handleResponse(response);
  }

  // ---------- PROFILE USER ----------
  static Future<Map<String, dynamic>> getProfile(int userId) async {
    final uri = Uri.parse(
      '$baseUrl/profile',
    ).replace(queryParameters: {'user_id': userId.toString()});
    final response = await http
        .get(uri, headers: _headers)
        .timeout(const Duration(seconds: 5));
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> updateProfile(
    Map<String, dynamic> data,
  ) async {
    final response = await http.put(
      Uri.parse('$baseUrl/profile'),
      headers: _headers,
      body: jsonEncode(data),
    );
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> uploadFotoProfil(
    int userId,
    String filePath,
  ) async {
    final request = http.MultipartRequest(
      'POST',
      Uri.parse('$baseUrl/profile/foto'),
    );
    request.fields['user_id'] = userId.toString();
    request.files.add(await http.MultipartFile.fromPath('foto', filePath));
    final streamed = await request.send().timeout(const Duration(seconds: 15));
    final response = await http.Response.fromStream(streamed);
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> uploadFile(
    String filePath,
    String type,
  ) async {
    final request = http.MultipartRequest('POST', Uri.parse('$baseUrl/upload'));
    request.fields['type'] = type;
    request.files.add(await http.MultipartFile.fromPath('file', filePath));
    final streamed = await request.send().timeout(const Duration(seconds: 15));
    final response = await http.Response.fromStream(streamed);
    return _handleResponse(response);
  }

  // ---------- HELPER ----------
  static Map<String, dynamic> _handleResponse(http.Response response) {
    final body = jsonDecode(response.body) as Map<String, dynamic>;

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return body;
    } else if (response.statusCode == 409) {
      // Conflict — absensi sudah ada
      return body;
    } else if (response.statusCode == 422) {
      // Validation error
      throw ApiException(
        'Validasi gagal: ${body['message'] ?? 'Data tidak valid'}',
      );
    } else {
      throw ApiException(body['message'] ?? 'Terjadi kesalahan server');
    }
  }

  // Test koneksi ke server
  // ===== AUTH =====
  static Future<Map<String, dynamic>> login(
    String identifier,
    String password,
  ) async {
    final response = await http.post(
      Uri.parse('$baseUrl/login'),
      headers: _headers,
      body: jsonEncode({'identifier': identifier, 'password': password}),
    );
    return _handleResponse(response);
  }

  static Future<bool> testConnection() async {
    try {
      final response = await http
          .get(Uri.parse('$baseUrl/dashboard'), headers: _headers)
          .timeout(const Duration(seconds: 5));
      return response.statusCode == 200;
    } catch (e) {
      return false;
    }
  }

  // ---------- MATERI PELAJARAN ----------
  static Future<Map<String, dynamic>> getMateri({
    String? kelas,
    String? mapel,
    int? guruId,
  }) async {
    final params = <String, String>{};
    if (kelas != null) params['kelas'] = kelas;
    if (mapel != null) params['mapel'] = mapel;
    if (guruId != null) params['guru_id'] = guruId.toString();
    final uri = Uri.parse(
      '$baseUrl/materi',
    ).replace(queryParameters: params.isNotEmpty ? params : null);
    final response = await http
        .get(uri, headers: _headers)
        .timeout(const Duration(seconds: 10));
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> uploadMateri({
    required int guruId,
    required String kelas,
    required String mapel,
    required String judul,
    String? deskripsi,
    required String filePath,
  }) async {
    final request = http.MultipartRequest('POST', Uri.parse('$baseUrl/materi'));
    request.fields['guru_id'] = guruId.toString();
    request.fields['kelas'] = kelas;
    request.fields['mapel'] = mapel;
    request.fields['judul'] = judul;
    if (deskripsi != null && deskripsi.isNotEmpty) {
      request.fields['deskripsi'] = deskripsi;
    }
    request.files.add(await http.MultipartFile.fromPath('file', filePath));
    request.headers['Accept'] = 'application/json';

    final streamed = await request.send().timeout(const Duration(seconds: 30));
    final response = await http.Response.fromStream(streamed);
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> deleteMateri(
    int id, {
    int? userId,
  }) async {
    final uri = userId != null
        ? Uri.parse('$baseUrl/materi/$id?user_id=$userId')
        : Uri.parse('$baseUrl/materi/$id');
    final response = await http
        .delete(uri, headers: _headers)
        .timeout(const Duration(seconds: 10));
    return _handleResponse(response);
  }

  // ---------- KEGIATAN ----------
  static Future<Map<String, dynamic>> getKegiatan() async {
    final response = await http
        .get(Uri.parse('$baseUrl/kegiatan'), headers: _headers)
        .timeout(const Duration(seconds: 10));
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> uploadKegiatan({
    required int uploadedBy,
    required String judul,
    String? deskripsi,
    required List<String> fotoPaths,
    List<String>? captions,
  }) async {
    final request = http.MultipartRequest(
      'POST',
      Uri.parse('$baseUrl/kegiatan'),
    );
    request.fields['uploaded_by'] = uploadedBy.toString();
    request.fields['judul'] = judul;
    if (deskripsi != null && deskripsi.isNotEmpty) {
      request.fields['deskripsi'] = deskripsi;
    }
    for (int i = 0; i < fotoPaths.length; i++) {
      request.files.add(
        await http.MultipartFile.fromPath('fotos[$i]', fotoPaths[i]),
      );
      if (captions != null && i < captions.length && captions[i].isNotEmpty) {
        request.fields['captions[$i]'] = captions[i];
      }
    }
    request.headers['Accept'] = 'application/json';

    final streamed = await request.send().timeout(const Duration(seconds: 60));
    final response = await http.Response.fromStream(streamed);
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> deleteKegiatan(int id) async {
    final response = await http
        .delete(Uri.parse('$baseUrl/kegiatan/$id'), headers: _headers)
        .timeout(const Duration(seconds: 10));
    return _handleResponse(response);
  }

  // ---------- WALI: MATERI & KEGIATAN ----------
  static Future<Map<String, dynamic>> getMateriAnak(String kelas) async {
    final response = await http
        .get(Uri.parse('$baseUrl/wali/materi?kelas=$kelas'), headers: _headers)
        .timeout(const Duration(seconds: 10));
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> getKegiatanWali() async {
    final response = await http
        .get(Uri.parse('$baseUrl/wali/kegiatan'), headers: _headers)
        .timeout(const Duration(seconds: 10));
    return _handleResponse(response);
  }

  // ---------- MATA PELAJARAN (CRUD) ----------
  static Future<Map<String, dynamic>> createMataPelajaran(
    Map<String, dynamic> data,
  ) async {
    final response = await http.post(
      Uri.parse('$baseUrl/mata-pelajaran'),
      headers: _headers,
      body: jsonEncode(data),
    );
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> updateMataPelajaran(
    int id,
    Map<String, dynamic> data,
  ) async {
    final response = await http.put(
      Uri.parse('$baseUrl/mata-pelajaran/$id'),
      headers: _headers,
      body: jsonEncode(data),
    );
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> deleteMataPelajaran(int id) async {
    final response = await http
        .delete(Uri.parse('$baseUrl/mata-pelajaran/$id'), headers: _headers)
        .timeout(const Duration(seconds: 10));
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> toggleMapelStatus(
    int id,
    String status,
  ) async {
    return updateMataPelajaran(id, {'status': status});
  }

  // ---------- JADWAL (CREATE) ----------
  static Future<Map<String, dynamic>> createJadwal(
    Map<String, dynamic> data,
  ) async {
    final response = await http.post(
      Uri.parse('$baseUrl/jadwal'),
      headers: _headers,
      body: jsonEncode(data),
    );
    return _handleResponse(response);
  }

  // ---------- GURU LIST ----------
  static Future<Map<String, dynamic>> getGuru() async {
    final response = await http
        .get(Uri.parse('$baseUrl/guru'), headers: _headers)
        .timeout(const Duration(seconds: 10));
    return _handleResponse(response);
  }

  // ---------- ALL USERS (Data Guru + Data Admin realtime) ----------
  static Future<Map<String, dynamic>> getAllUsers({String? role}) async {
    final params = <String, String>{};
    if (role != null) params['role'] = role;
    final uri = Uri.parse(
      '$baseUrl/users',
    ).replace(queryParameters: params.isNotEmpty ? params : null);
    final response = await http
        .get(uri, headers: _headers)
        .timeout(const Duration(seconds: 10));
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> createUser(
    Map<String, dynamic> data,
  ) async {
    final response = await http
        .post(
          Uri.parse('$baseUrl/users'),
          headers: _headers,
          body: jsonEncode(data),
        )
        .timeout(const Duration(seconds: 10));
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> updateUser(
    int id,
    Map<String, dynamic> data,
  ) async {
    final response = await http
        .put(
          Uri.parse('$baseUrl/users/$id'),
          headers: _headers,
          body: jsonEncode(data),
        )
        .timeout(const Duration(seconds: 10));
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> deleteUser(int id) async {
    final response = await http
        .delete(Uri.parse('$baseUrl/users/$id'), headers: _headers)
        .timeout(const Duration(seconds: 10));
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> importUsers(
    List<Map<String, dynamic>> rows,
  ) async {
    final response = await http
        .post(
          Uri.parse('$baseUrl/users/import'),
          headers: _headers,
          body: jsonEncode({'rows': rows}),
        )
        .timeout(const Duration(seconds: 25));
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> importGuru(
    List<Map<String, dynamic>> rows,
  ) async {
    final response = await http
        .post(
          Uri.parse('$baseUrl/users/import-guru'),
          headers: _headers,
          body: jsonEncode({'rows': rows}),
        )
        .timeout(const Duration(seconds: 25));
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> getPaymentTypes({
    String? status,
  }) async {
    final params = <String, String>{};
    if (status != null) params['status'] = status;
    final uri = Uri.parse(
      '$baseUrl/payment-types',
    ).replace(queryParameters: params.isNotEmpty ? params : null);
    final response = await http
        .get(uri, headers: _headers)
        .timeout(const Duration(seconds: 10));
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> createPaymentType(
    Map<String, dynamic> data,
  ) async {
    final response = await http
        .post(
          Uri.parse('$baseUrl/payment-types'),
          headers: _headers,
          body: jsonEncode(data),
        )
        .timeout(const Duration(seconds: 10));
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> updatePaymentType(
    int id,
    Map<String, dynamic> data,
  ) async {
    final response = await http
        .put(
          Uri.parse('$baseUrl/payment-types/$id'),
          headers: _headers,
          body: jsonEncode(data),
        )
        .timeout(const Duration(seconds: 10));
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> deletePaymentType(int id) async {
    final response = await http
        .delete(Uri.parse('$baseUrl/payment-types/$id'), headers: _headers)
        .timeout(const Duration(seconds: 10));
    return _handleResponse(response);
  }

  // ---------- NILAI ----------
  static Future<Map<String, dynamic>> getNilai({
    int? siswaId,
    int? mapelId,
    String? jenisUjian,
    String? semester,
    String? kelas,
  }) async {
    final params = <String, String>{};
    if (siswaId != null) params['siswa_id'] = siswaId.toString();
    if (mapelId != null) params['mapel_id'] = mapelId.toString();
    if (jenisUjian != null) params['jenis_ujian'] = jenisUjian;
    if (semester != null) params['semester'] = semester;
    if (kelas != null) params['kelas'] = kelas;

    final uri = Uri.parse(
      '$baseUrl/nilai',
    ).replace(queryParameters: params.isNotEmpty ? params : null);
    final response = await http
        .get(uri, headers: _headers)
        .timeout(const Duration(seconds: 10));
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> createNilai(
    Map<String, dynamic> data,
  ) async {
    final response = await http.post(
      Uri.parse('$baseUrl/nilai'),
      headers: _headers,
      body: jsonEncode(data),
    );
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> createNilaiBulk(
    List<Map<String, dynamic>> dataList,
  ) async {
    final response = await http.post(
      Uri.parse('$baseUrl/nilai/bulk'),
      headers: _headers,
      body: jsonEncode({'data': dataList}),
    );
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> updateNilai(
    int id,
    Map<String, dynamic> data,
  ) async {
    final response = await http.put(
      Uri.parse('$baseUrl/nilai/$id'),
      headers: _headers,
      body: jsonEncode(data),
    );
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> deleteNilai(int id) async {
    final response = await http
        .delete(Uri.parse('$baseUrl/nilai/$id'), headers: _headers)
        .timeout(const Duration(seconds: 10));
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> getRekapNilai({
    String? kelas,
    String? semester,
  }) async {
    final params = <String, String>{};
    if (kelas != null) params['kelas'] = kelas;
    if (semester != null) params['semester'] = semester;

    final uri = Uri.parse(
      '$baseUrl/nilai/rekap',
    ).replace(queryParameters: params.isNotEmpty ? params : null);
    final response = await http
        .get(uri, headers: _headers)
        .timeout(const Duration(seconds: 10));
    return _handleResponse(response);
  }

  // ---------- HAFALAN ----------
  static Future<Map<String, dynamic>> getHafalan({
    int? siswaId,
    String? status,
    String? kelas,
  }) async {
    final params = <String, String>{};
    if (siswaId != null) params['siswa_id'] = siswaId.toString();
    if (status != null) params['status'] = status;
    if (kelas != null) params['kelas'] = kelas;

    final uri = Uri.parse(
      '$baseUrl/hafalan',
    ).replace(queryParameters: params.isNotEmpty ? params : null);
    final response = await http
        .get(uri, headers: _headers)
        .timeout(const Duration(seconds: 10));
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> createHafalan(
    Map<String, dynamic> data,
  ) async {
    final response = await http.post(
      Uri.parse('$baseUrl/hafalan'),
      headers: _headers,
      body: jsonEncode(data),
    );
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> updateHafalan(
    int id,
    Map<String, dynamic> data,
  ) async {
    final response = await http.put(
      Uri.parse('$baseUrl/hafalan/$id'),
      headers: _headers,
      body: jsonEncode(data),
    );
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> deleteHafalan(int id) async {
    final response = await http
        .delete(Uri.parse('$baseUrl/hafalan/$id'), headers: _headers)
        .timeout(const Duration(seconds: 10));
    return _handleResponse(response);
  }
}

class ApiException implements Exception {
  final String message;
  ApiException(this.message);

  @override
  String toString() => message;
}
