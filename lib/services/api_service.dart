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
import 'package:shared_preferences/shared_preferences.dart';

class ApiService {
  // === UBAH INI SESUAI PERANGKAT ===
  // Emulator Android: 'http://10.0.2.2:8000/api'
  // HP fisik (1 WiFi): ganti ke IP laptop
  // Untuk cari IP laptop: buka CMD → ketik `ipconfig` → lihat IPv4 Address
  // static String baseUrl = 'http://192.168.0.101:8000/api';
  // static String baseUrl = 'http://10.180.254.198:8000/api';
  static String baseUrl =
      'https://angels-watts-pat-portrait.trycloudflare.com/api';
  // ==================================

  static const _authTokenKey = 'auth_token';
  static const _fastRequestTimeout = Duration(seconds: 12);
  static const _standardRequestTimeout = Duration(seconds: 18);
  static const _loginRequestTimeout = Duration(seconds: 25);
  static const _dashboardRequestTimeout = Duration(seconds: 25);

  static final Map<String, String> _defaultHeaders = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
  static const int _importBatchSize = 100;

  static Future<Map<String, String>> _headers({bool json = true}) async {
    final headers = <String, String>{
      if (json) 'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString(_authTokenKey) ?? '';
    if (token.isNotEmpty) {
      headers['Authorization'] = 'Bearer $token';
    }

    return headers;
  }

  static Future<void> _applyMultipartHeaders(
    http.MultipartRequest request,
  ) async {
    request.headers.addAll(await _headers(json: false));
  }

  // ---------- DASHBOARD ----------
  static Future<Map<String, dynamic>> getDashboard({int? userId}) async {
    final params = <String, String>{};
    if (userId != null && userId > 0) params['user_id'] = userId.toString();

    final uri = Uri.parse(
      '$baseUrl/dashboard',
    ).replace(queryParameters: params.isNotEmpty ? params : null);
    final response = await http
        .get(uri, headers: await _headers())
        .timeout(_dashboardRequestTimeout);
    return _handleResponse(response);
  }

  // ---------- SETTINGS / PERMISSIONS ----------
  static Future<Map<String, dynamic>> getSettingsMenus() async {
    final response = await http
        .get(Uri.parse('$baseUrl/settings/menus'), headers: await _headers())
        .timeout(_standardRequestTimeout);
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> getSettingsPermissions() async {
    final response = await http
        .get(
          Uri.parse('$baseUrl/settings/permissions'),
          headers: await _headers(),
        )
        .timeout(_standardRequestTimeout);
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> updateSettingsPermissions(
    List<Map<String, dynamic>> permissions,
  ) async {
    final response = await http
        .put(
          Uri.parse('$baseUrl/settings/permissions'),
          headers: await _headers(),
          body: jsonEncode({'permissions': permissions}),
        )
        .timeout(_standardRequestTimeout);
    return _handleResponse(response);
  }

  // ---------- AKADEMIK / TAHUN AJARAN ----------
  static Future<Map<String, dynamic>> getAcademicPeriods() async {
    final response = await http
        .get(Uri.parse('$baseUrl/academic-periods'), headers: await _headers())
        .timeout(_standardRequestTimeout);
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> getActiveAcademicPeriod() async {
    final response = await http
        .get(
          Uri.parse('$baseUrl/academic-periods/active'),
          headers: await _headers(),
        )
        .timeout(_standardRequestTimeout);
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> createAcademicPeriod(
    Map<String, dynamic> data,
  ) async {
    final response = await http
        .post(
          Uri.parse('$baseUrl/academic-periods'),
          headers: await _headers(),
          body: jsonEncode(data),
        )
        .timeout(_standardRequestTimeout);
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> updateAcademicPeriod(
    int id,
    Map<String, dynamic> data,
  ) async {
    final response = await http
        .put(
          Uri.parse('$baseUrl/academic-periods/$id'),
          headers: await _headers(),
          body: jsonEncode(data),
        )
        .timeout(_standardRequestTimeout);
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> activateAcademicPeriod(
    int id, {
    String? semester,
  }) async {
    final response = await http
        .post(
          Uri.parse('$baseUrl/academic-periods/$id/activate'),
          headers: await _headers(),
          body: jsonEncode({
            if (semester != null && semester.trim().isNotEmpty)
              'semester': semester.trim(),
          }),
        )
        .timeout(_standardRequestTimeout);
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> setAcademicSemester(
    int id,
    String semester,
  ) async {
    final response = await http
        .post(
          Uri.parse('$baseUrl/academic-periods/$id/semester'),
          headers: await _headers(),
          body: jsonEncode({'semester': semester}),
        )
        .timeout(_standardRequestTimeout);
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> syncAcademicPeriodSiswa(
    int id, {
    int? semesterId,
    String? semester,
  }) async {
    final response = await http
        .post(
          Uri.parse('$baseUrl/academic-periods/$id/sync-siswa'),
          headers: await _headers(),
          body: jsonEncode({
            if (semesterId != null && semesterId > 0) 'semester_id': semesterId,
            if (semester != null && semester.trim().isNotEmpty)
              'semester': semester.trim(),
          }),
        )
        .timeout(const Duration(seconds: 40));
    return _handleResponse(response);
  }

  // ---------- SISWA ----------
  static Future<Map<String, dynamic>> getSiswa({
    String? kelas,
    int? classId,
    String? search,
    String? status,
    bool withWali = false,
    int? academicYearId,
    int? semesterId,
    bool forPayment = false,
    bool forBoarding = false,
  }) async {
    final params = <String, String>{};
    if (classId != null && classId > 0) params['class_id'] = classId.toString();
    if (kelas != null) params['kelas'] = kelas;
    if (search != null) params['search'] = search;
    if (status != null && status.trim().isNotEmpty) params['status'] = status;
    if (withWali) params['with_wali'] = '1';
    if (academicYearId != null && academicYearId > 0) {
      params['academic_year_id'] = academicYearId.toString();
    }
    if (semesterId != null && semesterId > 0) {
      params['semester_id'] = semesterId.toString();
    }
    if (forPayment) params['for_payment'] = '1';
    if (forBoarding) params['for_boarding'] = '1';

    final uri = Uri.parse(
      '$baseUrl/siswa',
    ).replace(queryParameters: params.isNotEmpty ? params : null);
    final response = await http
        .get(uri, headers: await _headers())
        .timeout(_standardRequestTimeout);
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> getSiswaDetail(int id) async {
    final response = await http.get(
      Uri.parse('$baseUrl/siswa/$id'),
      headers: await _headers(),
    );
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> createSiswa(
    Map<String, dynamic> data,
  ) async {
    final response = await http.post(
      Uri.parse('$baseUrl/siswa'),
      headers: await _headers(),
      body: jsonEncode(data),
    );
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> importSiswa(
    List<Map<String, dynamic>> rows,
  ) async {
    return _importRowsInBatches('siswa/import', rows);
  }

  static Future<Map<String, dynamic>> updateSiswa(
    int id,
    Map<String, dynamic> data,
  ) async {
    final response = await http.put(
      Uri.parse('$baseUrl/siswa/$id'),
      headers: await _headers(),
      body: jsonEncode(data),
    );
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> deleteSiswa(int id) async {
    final response = await http.delete(
      Uri.parse('$baseUrl/siswa/$id'),
      headers: await _headers(),
    );
    return _handleResponse(response);
  }

  // ---------- MASTER WILAYAH ----------
  static Future<Map<String, dynamic>> getProvinces({String? q}) async {
    final params = <String, String>{};
    if (q != null && q.trim().isNotEmpty) params['q'] = q.trim();

    final uri = Uri.parse(
      '$baseUrl/regions/provinces',
    ).replace(queryParameters: params.isNotEmpty ? params : null);
    final response = await http
        .get(uri, headers: await _headers())
        .timeout(const Duration(seconds: 10));
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> getCities({
    int? provinceId,
    String? provinceCode,
    String? q,
    int? limit,
  }) async {
    final params = <String, String>{};
    if (provinceId != null && provinceId > 0) {
      params['province_id'] = provinceId.toString();
    }
    if (provinceCode != null && provinceCode.trim().isNotEmpty) {
      params['province_code'] = provinceCode.trim();
    }
    if (q != null && q.trim().isNotEmpty) params['q'] = q.trim();
    if (limit != null && limit > 0) params['limit'] = limit.toString();

    final uri = Uri.parse(
      '$baseUrl/regions/cities',
    ).replace(queryParameters: params.isNotEmpty ? params : null);
    final response = await http
        .get(uri, headers: await _headers())
        .timeout(const Duration(seconds: 10));
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> getDistricts({
    int? cityId,
    String? cityCode,
    String? q,
  }) async {
    final params = <String, String>{};
    if (cityId != null && cityId > 0) params['city_id'] = cityId.toString();
    if (cityCode != null && cityCode.trim().isNotEmpty) {
      params['city_code'] = cityCode.trim();
    }
    if (q != null && q.trim().isNotEmpty) params['q'] = q.trim();

    final uri = Uri.parse(
      '$baseUrl/regions/districts',
    ).replace(queryParameters: params.isNotEmpty ? params : null);
    final response = await http
        .get(uri, headers: await _headers())
        .timeout(const Duration(seconds: 10));
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> getVillages({
    int? districtId,
    String? districtCode,
    String? q,
  }) async {
    final params = <String, String>{};
    if (districtId != null && districtId > 0) {
      params['district_id'] = districtId.toString();
    }
    if (districtCode != null && districtCode.trim().isNotEmpty) {
      params['district_code'] = districtCode.trim();
    }
    if (q != null && q.trim().isNotEmpty) params['q'] = q.trim();

    final uri = Uri.parse(
      '$baseUrl/regions/villages',
    ).replace(queryParameters: params.isNotEmpty ? params : null);
    final response = await http
        .get(uri, headers: await _headers())
        .timeout(const Duration(seconds: 10));
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> getClasses({bool active = true}) async {
    final uri = Uri.parse(
      '$baseUrl/classes',
    ).replace(queryParameters: {'active': active ? '1' : '0'});
    final response = await http
        .get(uri, headers: await _headers())
        .timeout(const Duration(seconds: 10));
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> getSchoolOrigins({
    bool active = true,
    String? search,
    int? provinceId,
    int? cityId,
    int? districtId,
    int? limit,
  }) async {
    final params = <String, String>{'active': active ? '1' : '0'};
    if (search != null && search.trim().isNotEmpty) {
      params['search'] = search.trim();
    }
    if (provinceId != null && provinceId > 0) {
      params['province_id'] = provinceId.toString();
    }
    if (cityId != null && cityId > 0) {
      params['city_id'] = cityId.toString();
    }
    if (districtId != null && districtId > 0) {
      params['district_id'] = districtId.toString();
    }
    if (limit != null && limit > 0) {
      params['limit'] = limit.toString();
    }
    final uri = Uri.parse(
      '$baseUrl/school-origins',
    ).replace(queryParameters: params);
    final response = await http
        .get(uri, headers: await _headers())
        .timeout(const Duration(seconds: 10));
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> getReferenceMaster(
    String table, {
    String? search,
  }) async {
    final params = <String, String>{};
    if (search != null && search.trim().isNotEmpty) {
      params['search'] = search.trim();
    }

    final uri = Uri.parse(
      '$baseUrl/references/$table',
    ).replace(queryParameters: params.isNotEmpty ? params : null);
    final response = await http
        .get(uri, headers: await _headers())
        .timeout(const Duration(seconds: 10));
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> createSchoolOrigin(
    Map<String, dynamic> data,
  ) async {
    final response = await http
        .post(
          Uri.parse('$baseUrl/school-origins'),
          headers: await _headers(),
          body: jsonEncode(data),
        )
        .timeout(const Duration(seconds: 10));
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> updateSchoolOrigin(
    int id,
    Map<String, dynamic> data,
  ) async {
    final response = await http
        .put(
          Uri.parse('$baseUrl/school-origins/$id'),
          headers: await _headers(),
          body: jsonEncode(data),
        )
        .timeout(const Duration(seconds: 10));
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> deleteSchoolOrigin(int id) async {
    final response = await http
        .delete(
          Uri.parse('$baseUrl/school-origins/$id'),
          headers: await _headers(),
        )
        .timeout(const Duration(seconds: 10));
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> bulkUpdateSiswaStatus({
    required List<int> ids,
    required String status,
    String? tahunLulus,
  }) async {
    final response = await http
        .post(
          Uri.parse('$baseUrl/siswa/bulk-status'),
          headers: await _headers(),
          body: jsonEncode({
            'ids': ids,
            'status': status,
            if (tahunLulus != null && tahunLulus.trim().isNotEmpty)
              'tahun_lulus': tahunLulus.trim(),
          }),
        )
        .timeout(const Duration(seconds: 12));
    return _handleResponse(response);
  }

  // ---------- MATA PELAJARAN ----------
  static Future<Map<String, dynamic>> getMataPelajaran({
    String? search,
    String? status,
    int? userId,
    String? kelas,
    int? classId,
    String? hari,
    bool requireJadwal = false,
  }) async {
    final params = <String, String>{};
    if (search != null) params['search'] = search;
    if (status != null) params['status'] = status;
    if (userId != null && userId > 0) params['user_id'] = userId.toString();
    if (classId != null && classId > 0) params['class_id'] = classId.toString();
    if (kelas != null && kelas.trim().isNotEmpty) params['kelas'] = kelas;
    if (hari != null && hari.trim().isNotEmpty) params['hari'] = hari;
    if (requireJadwal) params['require_jadwal'] = '1';

    final uri = Uri.parse(
      '$baseUrl/mata-pelajaran',
    ).replace(queryParameters: params.isNotEmpty ? params : null);
    final response = await http
        .get(uri, headers: await _headers())
        .timeout(const Duration(seconds: 8));
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> getMataPelajaranDetail(int id) async {
    final response = await http
        .get(
          Uri.parse('$baseUrl/mata-pelajaran/$id'),
          headers: await _headers(),
        )
        .timeout(const Duration(seconds: 8));
    return _handleResponse(response);
  }

  // ---------- JADWAL ----------
  static Future<Map<String, dynamic>> getJadwal({
    String? hari,
    int? dayId,
    String? sifir,
    int? classId,
    String? search,
  }) async {
    final params = <String, String>{};
    if (dayId != null && dayId > 0) params['day_id'] = dayId.toString();
    if (hari != null) params['hari'] = hari;
    if (classId != null && classId > 0) params['class_id'] = classId.toString();
    if (sifir != null) params['sifir'] = sifir;
    if (search != null) params['search'] = search;

    final uri = Uri.parse(
      '$baseUrl/jadwal',
    ).replace(queryParameters: params.isNotEmpty ? params : null);
    final response = await http.get(uri, headers: await _headers());
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> updateJadwal(
    int id,
    Map<String, dynamic> data,
  ) async {
    final response = await http.put(
      Uri.parse('$baseUrl/jadwal/$id'),
      headers: await _headers(),
      body: jsonEncode(data),
    );
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> deleteJadwal(int id) async {
    final response = await http.delete(
      Uri.parse('$baseUrl/jadwal/$id'),
      headers: await _headers(),
    );
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> syncJadwalGroup(
    Map<String, dynamic> data,
  ) async {
    final response = await http.post(
      Uri.parse('$baseUrl/jadwal/sync-group'),
      headers: await _headers(),
      body: jsonEncode(data),
    );
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> deleteJadwalGroup(
    Map<String, dynamic> data,
  ) async {
    final response = await http.post(
      Uri.parse('$baseUrl/jadwal/delete-group'),
      headers: await _headers(),
      body: jsonEncode(data),
    );
    return _handleResponse(response);
  }

  // ---------- ABSENSI ----------
  static Future<Map<String, dynamic>> getAbsensi({
    String? tanggal,
    String? kelas,
    int? classId,
    String? mapel,
    int? mapelId,
    int? jadwalId,
  }) async {
    final params = <String, String>{};
    if (tanggal != null) params['tanggal'] = tanggal;
    if (classId != null && classId > 0) params['class_id'] = classId.toString();
    if (kelas != null) params['kelas'] = kelas;
    if (mapelId != null && mapelId > 0) params['mapel_id'] = mapelId.toString();
    if (mapel != null) params['mapel'] = mapel;
    if (jadwalId != null && jadwalId > 0) {
      params['jadwal_id'] = jadwalId.toString();
    }

    final uri = Uri.parse(
      '$baseUrl/absensi',
    ).replace(queryParameters: params.isNotEmpty ? params : null);
    final response = await http.get(uri, headers: await _headers());
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> createAbsensi(
    Map<String, dynamic> data,
  ) async {
    final response = await http.post(
      Uri.parse('$baseUrl/absensi'),
      headers: await _headers(),
      body: jsonEncode(data),
    );
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> createAbsensiBulk(
    List<Map<String, dynamic>> absensiList,
  ) async {
    final response = await http.post(
      Uri.parse('$baseUrl/absensi/bulk'),
      headers: await _headers(),
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
      headers: await _headers(),
      body: jsonEncode(data),
    );
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> deleteAbsensi(
    int id, {
    String? actorRole,
    String? actorName,
    int? actorUserId,
  }) async {
    final params = <String, String>{};
    if (actorRole != null) params['actor_role'] = actorRole;
    if (actorName != null) params['actor_name'] = actorName;
    if (actorUserId != null && actorUserId > 0) {
      params['actor_user_id'] = actorUserId.toString();
    }
    final uri = Uri.parse(
      '$baseUrl/absensi/$id',
    ).replace(queryParameters: params.isNotEmpty ? params : null);
    final response = await http.delete(uri, headers: await _headers());
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> getRekapAbsensi({
    required int bulan,
    required int tahun,
    String? kelas,
    int? classId,
    String? tanggalMulai,
    String? tanggalAkhir,
  }) async {
    final params = <String, String>{
      'bulan': bulan.toString(),
      'tahun': tahun.toString(),
    };
    if (classId != null && classId > 0) params['class_id'] = classId.toString();
    if (kelas != null) params['kelas'] = kelas;
    if (tanggalMulai != null) params['tanggal_mulai'] = tanggalMulai;
    if (tanggalAkhir != null) params['tanggal_akhir'] = tanggalAkhir;

    final uri = Uri.parse(
      '$baseUrl/absensi/rekap',
    ).replace(queryParameters: params);
    final response = await http.get(uri, headers: await _headers());
    return _handleResponse(response);
  }

  // ---------- BOARDING / ABSENSI SHOLAT ----------
  static Future<Map<String, dynamic>> getBoardingComplexes({
    bool includeInactive = false,
  }) async {
    final uri = Uri.parse('$baseUrl/boarding/complexes').replace(
      queryParameters: includeInactive ? {'include_inactive': '1'} : null,
    );
    final response = await http
        .get(uri, headers: await _headers())
        .timeout(_standardRequestTimeout);
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> createBoardingComplex(
    Map<String, dynamic> data,
  ) async {
    final response = await http
        .post(
          Uri.parse('$baseUrl/boarding/complexes'),
          headers: await _headers(),
          body: jsonEncode(data),
        )
        .timeout(_standardRequestTimeout);
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> updateBoardingComplex(
    int id,
    Map<String, dynamic> data,
  ) async {
    final response = await http
        .put(
          Uri.parse('$baseUrl/boarding/complexes/$id'),
          headers: await _headers(),
          body: jsonEncode(data),
        )
        .timeout(_standardRequestTimeout);
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> deleteBoardingComplex(int id) async {
    final response = await http
        .delete(
          Uri.parse('$baseUrl/boarding/complexes/$id'),
          headers: await _headers(),
        )
        .timeout(_standardRequestTimeout);
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> createBoardingRoom(
    Map<String, dynamic> data,
  ) async {
    final response = await http
        .post(
          Uri.parse('$baseUrl/boarding/rooms'),
          headers: await _headers(),
          body: jsonEncode(data),
        )
        .timeout(_standardRequestTimeout);
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> updateBoardingRoom(
    int id,
    Map<String, dynamic> data,
  ) async {
    final response = await http
        .put(
          Uri.parse('$baseUrl/boarding/rooms/$id'),
          headers: await _headers(),
          body: jsonEncode(data),
        )
        .timeout(_standardRequestTimeout);
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> deleteBoardingRoom(int id) async {
    final response = await http
        .delete(
          Uri.parse('$baseUrl/boarding/rooms/$id'),
          headers: await _headers(),
        )
        .timeout(_standardRequestTimeout);
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> assignBoardingStudents({
    required int boardingRoomId,
    required List<int> siswaIds,
    String status = 'Aktif',
    bool isResident = true,
    bool participatesPrayer = true,
  }) async {
    final response = await http
        .post(
          Uri.parse('$baseUrl/boarding/assign-students'),
          headers: await _headers(),
          body: jsonEncode({
            'boarding_room_id': boardingRoomId,
            'siswa_ids': siswaIds,
            'status': status,
            'is_resident': isResident,
            'participates_prayer': participatesPrayer,
          }),
        )
        .timeout(_standardRequestTimeout);
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> getBoardingStudents({
    int? boardingComplexId,
    int? boardingRoomId,
    String? search,
    bool includeInactive = false,
  }) async {
    final params = <String, String>{};
    if (boardingComplexId != null && boardingComplexId > 0) {
      params['boarding_complex_id'] = boardingComplexId.toString();
    }
    if (boardingRoomId != null && boardingRoomId > 0) {
      params['boarding_room_id'] = boardingRoomId.toString();
    }
    if (search != null && search.trim().isNotEmpty) {
      params['search'] = search.trim();
    }
    if (includeInactive) params['include_inactive'] = '1';

    final uri = Uri.parse(
      '$baseUrl/boarding/students',
    ).replace(queryParameters: params.isNotEmpty ? params : null);
    final response = await http
        .get(uri, headers: await _headers())
        .timeout(_standardRequestTimeout);
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> saveBoardingSantri(
    Map<String, dynamic> data, {
    int? id,
  }) async {
    final uri = id == null
        ? Uri.parse('$baseUrl/boarding/santri')
        : Uri.parse('$baseUrl/boarding/santri/$id');
    final response =
        await (id == null
                ? http.post(
                    uri,
                    headers: await _headers(),
                    body: jsonEncode(data),
                  )
                : http.put(
                    uri,
                    headers: await _headers(),
                    body: jsonEncode(data),
                  ))
            .timeout(_standardRequestTimeout);
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> deleteBoardingSantri(int id) async {
    final response = await http
        .delete(
          Uri.parse('$baseUrl/boarding/santri/$id'),
          headers: await _headers(),
        )
        .timeout(_standardRequestTimeout);
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> getBoardingGuruAccess() async {
    final response = await http
        .get(
          Uri.parse('$baseUrl/boarding/guru-access'),
          headers: await _headers(),
        )
        .timeout(_standardRequestTimeout);
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> saveBoardingGuruAccess(
    Map<String, dynamic> data,
  ) async {
    final response = await http
        .post(
          Uri.parse('$baseUrl/boarding/guru-access'),
          headers: await _headers(),
          body: jsonEncode(data),
        )
        .timeout(_standardRequestTimeout);
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> deleteBoardingGuruAccess(int id) async {
    final response = await http
        .delete(
          Uri.parse('$baseUrl/boarding/guru-access/$id'),
          headers: await _headers(),
        )
        .timeout(_standardRequestTimeout);
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> getAbsensiSholatContext({
    required String tanggal,
    int? boardingRoomId,
  }) async {
    final params = <String, String>{'tanggal': tanggal};
    if (boardingRoomId != null && boardingRoomId > 0) {
      params['boarding_room_id'] = boardingRoomId.toString();
    }

    final uri = Uri.parse(
      '$baseUrl/absensi-sholat/context',
    ).replace(queryParameters: params);
    final response = await http
        .get(uri, headers: await _headers())
        .timeout(_standardRequestTimeout);
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> createAbsensiSholatBulk({
    required String tanggal,
    required int boardingRoomId,
    required List<Map<String, dynamic>> items,
    String? diinputOleh,
    int? actorUserId,
    String? diinputVia,
    String? deviceId,
  }) async {
    final body = <String, dynamic>{
      'tanggal': tanggal,
      'boarding_room_id': boardingRoomId,
      'items': items,
    };
    if (diinputOleh != null) body['diinput_oleh'] = diinputOleh;
    if (actorUserId != null && actorUserId > 0) {
      body['actor_user_id'] = actorUserId;
    }
    if (diinputVia != null) body['diinput_via'] = diinputVia;
    if (deviceId != null) body['device_id'] = deviceId;

    final response = await http
        .post(
          Uri.parse('$baseUrl/absensi-sholat/bulk'),
          headers: await _headers(),
          body: jsonEncode(body),
        )
        .timeout(_standardRequestTimeout);
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> cancelAbsensiSholat({
    required String tanggal,
    required int boardingRoomId,
    String? reason,
  }) async {
    final body = <String, dynamic>{
      'tanggal': tanggal,
      'boarding_room_id': boardingRoomId,
    };
    if (reason != null && reason.trim().isNotEmpty) {
      body['reason'] = reason.trim();
    }

    final response = await http
        .post(
          Uri.parse('$baseUrl/absensi-sholat/cancel'),
          headers: await _headers(),
          body: jsonEncode(body),
        )
        .timeout(_standardRequestTimeout);
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> getRekapAbsensiSholat({
    int? bulan,
    int? tahun,
    String? tanggalMulai,
    String? tanggalAkhir,
    int? boardingComplexId,
    int? boardingRoomId,
    int? siswaId,
    String? status,
  }) async {
    final params = <String, String>{};
    if (bulan != null) params['bulan'] = bulan.toString();
    if (tahun != null) params['tahun'] = tahun.toString();
    if (tanggalMulai != null && tanggalMulai.trim().isNotEmpty) {
      params['tanggal_mulai'] = tanggalMulai.trim();
    }
    if (tanggalAkhir != null && tanggalAkhir.trim().isNotEmpty) {
      params['tanggal_akhir'] = tanggalAkhir.trim();
    }
    if (boardingComplexId != null && boardingComplexId > 0) {
      params['boarding_complex_id'] = boardingComplexId.toString();
    }
    if (boardingRoomId != null && boardingRoomId > 0) {
      params['boarding_room_id'] = boardingRoomId.toString();
    }
    if (siswaId != null && siswaId > 0) params['siswa_id'] = siswaId.toString();
    if (status != null && status.trim().isNotEmpty) {
      params['status'] = status.trim();
    }

    final uri = Uri.parse(
      '$baseUrl/absensi-sholat/rekap',
    ).replace(queryParameters: params);
    final response = await http
        .get(uri, headers: await _headers())
        .timeout(_standardRequestTimeout);
    return _handleResponse(response);
  }

  // ---------- PEMBAYARAN ----------
  static Future<Map<String, dynamic>> getPembayaran({
    String? tanggal,
    String? kelas,
    int? classId,
    String? status,
    int? paymentStatusId,
    int? academicYearId,
    int? semesterId,
    String? tahunAjaran,
    String? semester,
  }) async {
    final params = <String, String>{};
    if (tanggal != null) params['tanggal'] = tanggal;
    if (classId != null && classId > 0) params['class_id'] = classId.toString();
    if (kelas != null && kelas.trim().isNotEmpty) {
      params['kelas'] = kelas.trim();
    }
    if (paymentStatusId != null && paymentStatusId > 0) {
      params['payment_status_id'] = paymentStatusId.toString();
    }
    if (status != null && status.trim().isNotEmpty) {
      params['status'] = status.trim();
    }
    if (academicYearId != null && academicYearId > 0) {
      params['academic_year_id'] = academicYearId.toString();
    }
    if (semesterId != null && semesterId > 0) {
      params['semester_id'] = semesterId.toString();
    }
    if (tahunAjaran != null && tahunAjaran.trim().isNotEmpty) {
      params['tahun_ajaran'] = tahunAjaran.trim();
    }
    if (semester != null && semester.trim().isNotEmpty) {
      params['semester'] = semester.trim();
    }

    final uri = Uri.parse(
      '$baseUrl/pembayaran',
    ).replace(queryParameters: params.isNotEmpty ? params : null);
    final response = await http
        .get(uri, headers: await _headers())
        .timeout(const Duration(seconds: 10));
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> createPembayaran(
    Map<String, dynamic> data,
  ) async {
    final response = await http
        .post(
          Uri.parse('$baseUrl/pembayaran'),
          headers: await _headers(),
          body: jsonEncode(data),
        )
        .timeout(const Duration(seconds: 25));
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> updatePembayaran(
    int id,
    Map<String, dynamic> data,
  ) async {
    final response = await http
        .put(
          Uri.parse('$baseUrl/pembayaran/$id'),
          headers: await _headers(),
          body: jsonEncode(data),
        )
        .timeout(const Duration(seconds: 10));
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> getAllPembayaran({
    int limit = 300,
    int? academicYearId,
    int? semesterId,
    String? tahunAjaran,
    String? semester,
  }) async {
    final params = <String, String>{'semua': '1', 'limit': limit.toString()};
    if (academicYearId != null && academicYearId > 0) {
      params['academic_year_id'] = academicYearId.toString();
    }
    if (semesterId != null && semesterId > 0) {
      params['semester_id'] = semesterId.toString();
    }
    if (tahunAjaran != null && tahunAjaran.trim().isNotEmpty) {
      params['tahun_ajaran'] = tahunAjaran.trim();
    }
    if (semester != null && semester.trim().isNotEmpty) {
      params['semester'] = semester.trim();
    }
    final uri = Uri.parse(
      '$baseUrl/pembayaran',
    ).replace(queryParameters: params);
    final response = await http
        .get(uri, headers: await _headers())
        .timeout(const Duration(seconds: 10));
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> getPembayaranStudentRekap({
    required int userId,
    required int siswaId,
    int? academicYearId,
    int? semesterId,
    String? tahunAjaran,
    String? semester,
  }) async {
    final params = <String, String>{
      'user_id': userId.toString(),
      'siswa_id': siswaId.toString(),
    };
    if (academicYearId != null && academicYearId > 0) {
      params['academic_year_id'] = academicYearId.toString();
    }
    if (semesterId != null && semesterId > 0) {
      params['semester_id'] = semesterId.toString();
    }
    if (tahunAjaran != null && tahunAjaran.trim().isNotEmpty) {
      params['tahun_ajaran'] = tahunAjaran.trim();
    }
    if (semester != null && semester.trim().isNotEmpty) {
      params['semester'] = semester.trim();
    }
    final uri = Uri.parse(
      '$baseUrl/pembayaran/rekap-siswa',
    ).replace(queryParameters: params);
    final response = await http
        .get(uri, headers: await _headers())
        .timeout(const Duration(seconds: 15));
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> getPembayaranRekapExport({
    required int userId,
    String? kelas,
    int? classId,
    String? status,
    int? paymentStatusId,
    String? tanggalMulai,
    String? tanggalAkhir,
    int? academicYearId,
    int? semesterId,
    String? tahunAjaran,
    String? semester,
  }) async {
    final params = <String, String>{'user_id': userId.toString()};
    if (classId != null && classId > 0) {
      params['class_id'] = classId.toString();
    }
    if (kelas != null && kelas.trim().isNotEmpty) {
      params['kelas'] = kelas.trim();
    }
    if (paymentStatusId != null && paymentStatusId > 0) {
      params['payment_status_id'] = paymentStatusId.toString();
    }
    if (status != null && status.trim().isNotEmpty) {
      params['status'] = status.trim();
    }
    if (tanggalMulai != null && tanggalMulai.trim().isNotEmpty) {
      params['tanggal_mulai'] = tanggalMulai.trim();
    }
    if (tanggalAkhir != null && tanggalAkhir.trim().isNotEmpty) {
      params['tanggal_akhir'] = tanggalAkhir.trim();
    }
    if (academicYearId != null && academicYearId > 0) {
      params['academic_year_id'] = academicYearId.toString();
    }
    if (semesterId != null && semesterId > 0) {
      params['semester_id'] = semesterId.toString();
    }
    if (tahunAjaran != null && tahunAjaran.trim().isNotEmpty) {
      params['tahun_ajaran'] = tahunAjaran.trim();
    }
    if (semester != null && semester.trim().isNotEmpty) {
      params['semester'] = semester.trim();
    }

    final uri = Uri.parse(
      '$baseUrl/pembayaran/rekap-export',
    ).replace(queryParameters: params);
    final response = await http
        .get(uri, headers: await _headers())
        .timeout(const Duration(seconds: 15));
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> deletePembayaran(int id) async {
    final response = await http.delete(
      Uri.parse('$baseUrl/pembayaran/$id'),
      headers: await _headers(),
    );
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> deletePaymentTransaction(int id) async {
    final response = await http.delete(
      Uri.parse('$baseUrl/pembayaran/transaksi/$id'),
      headers: await _headers(),
    );
    return _handleResponse(response);
  }

  // ---------- KELOMPOK BELAJAR ----------
  static Future<Map<String, dynamic>> getKelompokBelajar({
    String? sifir,
    int? userId,
    String? hari,
  }) async {
    final params = <String, String>{};
    if (sifir != null) params['sifir'] = sifir;
    if (userId != null && userId > 0) params['user_id'] = userId.toString();
    if (hari != null && hari.trim().isNotEmpty) params['hari'] = hari;

    final uri = Uri.parse(
      '$baseUrl/kelompok-belajar',
    ).replace(queryParameters: params.isNotEmpty ? params : null);
    final response = await http
        .get(uri, headers: await _headers())
        .timeout(const Duration(seconds: 5));
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> getKelompokDetail(int id) async {
    final response = await http
        .get(
          Uri.parse('$baseUrl/kelompok-belajar/$id'),
          headers: await _headers(),
        )
        .timeout(const Duration(seconds: 5));
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> addSiswaToKelompok(
    int kelompokId,
    int siswaId,
  ) async {
    final response = await http.post(
      Uri.parse('$baseUrl/kelompok-belajar/$kelompokId/siswa'),
      headers: await _headers(),
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
      headers: await _headers(),
    );
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> createKelompokBelajar(
    Map<String, dynamic> data,
  ) async {
    final response = await http.post(
      Uri.parse('$baseUrl/kelompok-belajar'),
      headers: await _headers(),
      body: jsonEncode(data),
    );
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> deleteKelompokBelajar(int id) async {
    final response = await http
        .delete(
          Uri.parse('$baseUrl/kelompok-belajar/$id'),
          headers: await _headers(),
        )
        .timeout(const Duration(seconds: 10));
    return _handleResponse(response);
  }

  // ---------- WALI (ORANG TUA) — Read-only Monitoring ----------
  static Future<Map<String, dynamic>> getAnakWali(int waliId) async {
    final uri = Uri.parse(
      '$baseUrl/wali/anak',
    ).replace(queryParameters: {'wali_id': waliId.toString()});
    final response = await http
        .get(uri, headers: await _headers())
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
        .get(uri, headers: await _headers())
        .timeout(const Duration(seconds: 10));
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> getAbsensiSholatAnak(
    int siswaId, {
    int? bulan,
    int? tahun,
  }) async {
    final params = <String, String>{'siswa_id': siswaId.toString()};
    if (bulan != null) params['bulan'] = bulan.toString();
    if (tahun != null) params['tahun'] = tahun.toString();

    final uri = Uri.parse(
      '$baseUrl/wali/absensi-sholat',
    ).replace(queryParameters: params);
    final response = await http
        .get(uri, headers: await _headers())
        .timeout(const Duration(seconds: 10));
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> getPembayaranAnak(int siswaId) async {
    final uri = Uri.parse(
      '$baseUrl/wali/pembayaran',
    ).replace(queryParameters: {'siswa_id': siswaId.toString()});
    final response = await http
        .get(uri, headers: await _headers())
        .timeout(const Duration(seconds: 10));
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> getPembayaranAnakFiltered(
    int siswaId, {
    int? academicYearId,
    int? semesterId,
    String? tahunAjaran,
    String? semester,
    String? status,
    int? paymentTypeId,
  }) async {
    final params = <String, String>{'siswa_id': siswaId.toString()};
    if (academicYearId != null && academicYearId > 0) {
      params['academic_year_id'] = academicYearId.toString();
    }
    if (semesterId != null && semesterId > 0) {
      params['semester_id'] = semesterId.toString();
    }
    if (tahunAjaran != null && tahunAjaran.trim().isNotEmpty) {
      params['tahun_ajaran'] = tahunAjaran.trim();
    }
    if (semester != null && semester.trim().isNotEmpty) {
      params['semester'] = semester.trim();
    }
    if (status != null && status.trim().isNotEmpty && status != 'Semua') {
      params['status'] = status.trim();
    }
    if (paymentTypeId != null && paymentTypeId > 0) {
      params['payment_type_id'] = paymentTypeId.toString();
    }
    final uri = Uri.parse(
      '$baseUrl/wali/pembayaran',
    ).replace(queryParameters: params);
    final response = await http
        .get(uri, headers: await _headers())
        .timeout(const Duration(seconds: 12));
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> getBiodataAnak(int siswaId) async {
    final uri = Uri.parse(
      '$baseUrl/wali/biodata',
    ).replace(queryParameters: {'siswa_id': siswaId.toString()});
    final response = await http
        .get(uri, headers: await _headers())
        .timeout(const Duration(seconds: 10));
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> getNilaiAnak(
    int siswaId, {
    String? semester,
    String? tahunAjaran,
    required int waliId,
  }) async {
    final params = <String, String>{
      'siswa_id': siswaId.toString(),
      'wali_id': waliId.toString(),
    };
    if (semester != null) params['semester'] = semester;
    if (tahunAjaran != null) params['tahun_ajaran'] = tahunAjaran;

    final uri = Uri.parse(
      '$baseUrl/wali/nilai',
    ).replace(queryParameters: params);
    final response = await http
        .get(uri, headers: await _headers())
        .timeout(const Duration(seconds: 10));
    return _handleResponse(response);
  }

  // ---------- PROFILE USER ----------
  static Future<Map<String, dynamic>> getProfile(int userId) async {
    final uri = Uri.parse(
      '$baseUrl/profile',
    ).replace(queryParameters: {'user_id': userId.toString()});
    final response = await http
        .get(uri, headers: await _headers())
        .timeout(const Duration(seconds: 5));
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> updateProfile(
    Map<String, dynamic> data,
  ) async {
    final response = await http.put(
      Uri.parse('$baseUrl/profile'),
      headers: await _headers(),
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
    await _applyMultipartHeaders(request);
    final streamed = await request.send().timeout(const Duration(seconds: 15));
    final response = await http.Response.fromStream(streamed);
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> deleteFotoProfil(int userId) async {
    final uri = Uri.parse(
      '$baseUrl/profile/foto',
    ).replace(queryParameters: {'user_id': userId.toString()});
    final response = await http
        .delete(uri, headers: await _headers())
        .timeout(const Duration(seconds: 10));
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> uploadFile(
    String filePath,
    String type,
  ) async {
    final request = http.MultipartRequest('POST', Uri.parse('$baseUrl/upload'));
    request.fields['type'] = type;
    request.files.add(await http.MultipartFile.fromPath('file', filePath));
    await _applyMultipartHeaders(request);
    final streamed = await request.send().timeout(const Duration(seconds: 15));
    final response = await http.Response.fromStream(streamed);
    return _handleResponse(response);
  }

  // ---------- HELPER ----------
  static Future<Map<String, dynamic>> _importRowsInBatches(
    String path,
    List<Map<String, dynamic>> rows,
  ) async {
    if (rows.isEmpty) {
      return {
        'success': true,
        'message': 'Tidak ada data untuk diimport',
        'total_baris': 0,
        'berhasil': 0,
        'gagal': 0,
        'errors': <Map<String, dynamic>>[],
        'data': <Map<String, dynamic>>[],
      };
    }

    var successCount = 0;
    var failedCount = 0;
    final errors = <Map<String, dynamic>>[];
    final importedData = <Map<String, dynamic>>[];

    for (var start = 0; start < rows.length; start += _importBatchSize) {
      final end = (start + _importBatchSize) > rows.length
          ? rows.length
          : start + _importBatchSize;
      final chunk = rows.sublist(start, end);
      final result = await _postImportChunk(path, chunk);

      successCount += _asInt(result['berhasil']);
      failedCount += _asInt(result['gagal']);

      final chunkErrors = List<Map<String, dynamic>>.from(
        (result['errors'] ?? const []).map(
          (item) => Map<String, dynamic>.from(item as Map),
        ),
      );
      for (final error in chunkErrors) {
        final row = _asInt(error['row']);
        final line = _asInt(error['baris']);
        if (row > 0) error['row'] = row + start;
        if (line > 0) error['baris'] = line + start;
        errors.add(error);
      }

      importedData.addAll(
        List<Map<String, dynamic>>.from(
          (result['data'] ?? const []).map(
            (item) => Map<String, dynamic>.from(item as Map),
          ),
        ),
      );
    }

    return {
      'success': true,
      'message': failedCount > 0
          ? 'Import selesai dengan beberapa baris gagal'
          : 'Import data berhasil',
      'total_baris': rows.length,
      'berhasil': successCount,
      'gagal': failedCount,
      'errors': errors,
      'data': importedData,
    };
  }

  static Future<Map<String, dynamic>> _postImportChunk(
    String path,
    List<Map<String, dynamic>> rows,
  ) async {
    final response = await http
        .post(
          Uri.parse('$baseUrl/$path'),
          headers: await _headers(),
          body: jsonEncode({'rows': rows}),
        )
        .timeout(const Duration(seconds: 60));
    return _handleResponse(response);
  }

  static int _asInt(dynamic value) {
    if (value is int) return value;
    return int.tryParse(value?.toString() ?? '') ?? 0;
  }

  static Map<String, dynamic> _handleResponse(http.Response response) {
    final body = _decodeResponseBody(response);

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return body;
    } else if (response.statusCode == 409) {
      // Conflict — absensi sudah ada
      return body;
    } else if (response.statusCode == 422) {
      // Validation error
      final details = _validationErrorDetails(body['errors']);
      final message = body['message'] ?? 'Data tidak valid';
      throw ApiException(
        details.isEmpty
            ? 'Validasi gagal: $message'
            : 'Validasi gagal: $message. $details',
      );
    } else {
      throw ApiException(body['message'] ?? 'Terjadi kesalahan server');
    }
  }

  static String _validationErrorDetails(dynamic errors) {
    if (errors is! Map) return '';
    final messages = <String>[];
    for (final value in errors.values) {
      if (value is List) {
        messages.addAll(value.map((item) => item.toString()));
      } else if (value != null) {
        messages.add(value.toString());
      }
      if (messages.length >= 3) break;
    }
    return messages.take(3).join(' ');
  }

  static Map<String, dynamic> _decodeResponseBody(http.Response response) {
    try {
      final decoded = jsonDecode(response.body);
      if (decoded is Map<String, dynamic>) {
        return decoded;
      }
      if (decoded is Map) {
        return Map<String, dynamic>.from(decoded);
      }
    } on FormatException {
      // Server/proxy kadang mengirim HTML atau teks mentah saat error.
    }

    final trimmed = response.body.trim();
    final preview = trimmed.length > 160
        ? '${trimmed.substring(0, 160)}...'
        : trimmed;

    return {
      'success': false,
      'message': preview.isNotEmpty
          ? 'Server mengirim response tidak valid: $preview'
          : 'Server mengirim response kosong',
      'status_code': response.statusCode,
    };
  }

  // Test koneksi ke server
  // ===== AUTH =====
  static Future<Map<String, dynamic>> login(
    String identifier,
    String password,
  ) async {
    final response = await http
        .post(
          Uri.parse('$baseUrl/login'),
          headers: _defaultHeaders,
          body: jsonEncode({'identifier': identifier, 'password': password}),
        )
        .timeout(_loginRequestTimeout);
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> changePassword({
    required String identifier,
    required String currentPassword,
    required String newPassword,
    required String confirmPassword,
  }) async {
    final response = await http
        .post(
          Uri.parse('$baseUrl/change-password'),
          headers: _defaultHeaders,
          body: jsonEncode({
            'identifier': identifier,
            'current_password': currentPassword,
            'new_password': newPassword,
            'new_password_confirmation': confirmPassword,
          }),
        )
        .timeout(const Duration(seconds: 10));
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> logout() async {
    final response = await http
        .post(Uri.parse('$baseUrl/logout'), headers: await _headers())
        .timeout(const Duration(seconds: 8));
    return _handleResponse(response);
  }

  static Future<bool> testConnection() async {
    try {
      final response = await http
          .get(Uri.parse('$baseUrl/health'), headers: _defaultHeaders)
          .timeout(_fastRequestTimeout);
      return response.statusCode == 200;
    } catch (e) {
      return false;
    }
  }

  // ---------- MATERI PELAJARAN ----------
  static Future<Map<String, dynamic>> getMateri({
    String? kelas,
    int? classId,
    String? mapel,
    int? mapelId,
    int? guruId,
  }) async {
    final params = <String, String>{};
    if (classId != null && classId > 0) params['class_id'] = classId.toString();
    if (kelas != null) params['kelas'] = kelas;
    if (mapelId != null && mapelId > 0) params['mapel_id'] = mapelId.toString();
    if (mapel != null) params['mapel'] = mapel;
    if (guruId != null) params['guru_id'] = guruId.toString();
    final uri = Uri.parse(
      '$baseUrl/materi',
    ).replace(queryParameters: params.isNotEmpty ? params : null);
    final response = await http
        .get(uri, headers: await _headers())
        .timeout(const Duration(seconds: 10));
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> uploadMateri({
    required int guruId,
    required String kelas,
    int? classId,
    int? mapelId,
    required String mapel,
    required String judul,
    String? deskripsi,
    required String filePath,
  }) async {
    final request = http.MultipartRequest('POST', Uri.parse('$baseUrl/materi'));
    request.fields['guru_id'] = guruId.toString();
    request.fields['kelas'] = kelas;
    if (classId != null && classId > 0) {
      request.fields['class_id'] = classId.toString();
    }
    if (mapelId != null) {
      request.fields['mapel_id'] = mapelId.toString();
    }
    request.fields['mapel'] = mapel;
    request.fields['judul'] = judul;
    if (deskripsi != null && deskripsi.isNotEmpty) {
      request.fields['deskripsi'] = deskripsi;
    }
    request.files.add(await http.MultipartFile.fromPath('file', filePath));
    await _applyMultipartHeaders(request);

    final streamed = await request.send().timeout(const Duration(seconds: 30));
    final response = await http.Response.fromStream(streamed);
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> deleteMateri(
    int id, {
    int? userId,
  }) async {
    final response = await http
        .delete(Uri.parse('$baseUrl/materi/$id'), headers: await _headers())
        .timeout(const Duration(seconds: 10));
    return _handleResponse(response);
  }

  // ---------- KEGIATAN ----------
  static Future<Map<String, dynamic>> getKegiatan({
    String? kelas,
    int? classId,
  }) async {
    final params = <String, String>{};
    if (classId != null && classId > 0) params['class_id'] = classId.toString();
    if (kelas != null) params['kelas'] = kelas;
    final uri = Uri.parse(
      '$baseUrl/kegiatan',
    ).replace(queryParameters: params.isNotEmpty ? params : null);
    final response = await http
        .get(uri, headers: await _headers())
        .timeout(const Duration(seconds: 10));
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> uploadKegiatan({
    required int uploadedBy,
    required String kelas,
    int? classId,
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
    request.fields['kelas'] = kelas;
    if (classId != null && classId > 0) {
      request.fields['class_id'] = classId.toString();
    }
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
    await _applyMultipartHeaders(request);

    final streamed = await request.send().timeout(const Duration(seconds: 60));
    final response = await http.Response.fromStream(streamed);
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> deleteKegiatan(int id) async {
    final response = await http
        .delete(Uri.parse('$baseUrl/kegiatan/$id'), headers: await _headers())
        .timeout(const Duration(seconds: 10));
    return _handleResponse(response);
  }

  // ---------- WALI: MATERI & KEGIATAN ----------
  static Future<Map<String, dynamic>> getMateriAnak(
    String kelas, {
    int? classId,
  }) async {
    final params = <String, String>{};
    if (classId != null && classId > 0) {
      params['class_id'] = classId.toString();
    }
    if (kelas.trim().isNotEmpty) params['kelas'] = kelas;
    final uri = Uri.parse(
      '$baseUrl/wali/materi',
    ).replace(queryParameters: params.isNotEmpty ? params : null);
    final response = await http
        .get(uri, headers: await _headers())
        .timeout(const Duration(seconds: 10));
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> getKegiatanWali([
    String? kelas,
    int? classId,
  ]) async {
    final params = <String, String>{};
    if (classId != null && classId > 0) params['class_id'] = classId.toString();
    if (kelas != null) params['kelas'] = kelas;
    final uri = Uri.parse(
      '$baseUrl/wali/kegiatan',
    ).replace(queryParameters: params.isNotEmpty ? params : null);
    final response = await http
        .get(uri, headers: await _headers())
        .timeout(const Duration(seconds: 10));
    return _handleResponse(response);
  }

  // ---------- MATA PELAJARAN (CRUD) ----------
  static Future<Map<String, dynamic>> createMataPelajaran(
    Map<String, dynamic> data,
  ) async {
    final response = await http.post(
      Uri.parse('$baseUrl/mata-pelajaran'),
      headers: await _headers(),
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
      headers: await _headers(),
      body: jsonEncode(data),
    );
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> deleteMataPelajaran(int id) async {
    final response = await http
        .delete(
          Uri.parse('$baseUrl/mata-pelajaran/$id'),
          headers: await _headers(),
        )
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
      headers: await _headers(),
      body: jsonEncode(data),
    );
    return _handleResponse(response);
  }

  // ---------- GURU LIST ----------
  static Future<Map<String, dynamic>> getGuru() async {
    final response = await http
        .get(Uri.parse('$baseUrl/guru'), headers: await _headers())
        .timeout(const Duration(seconds: 10));
    return _handleResponse(response);
  }

  // ---------- ALL USERS (Data Guru + Data Admin realtime) ----------
  static Future<Map<String, dynamic>> getAllUsers({
    String? role,
    int? viewerUserId,
    bool includePasswords = false,
  }) async {
    final params = <String, String>{};
    if (role != null) params['role'] = role;
    if (viewerUserId != null && viewerUserId > 0) {
      params['viewer_user_id'] = viewerUserId.toString();
    }
    if (includePasswords) {
      params['include_passwords'] = '1';
    }
    final uri = Uri.parse(
      '$baseUrl/users',
    ).replace(queryParameters: params.isNotEmpty ? params : null);
    final response = await http
        .get(uri, headers: await _headers())
        .timeout(const Duration(seconds: 10));
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> createUser(
    Map<String, dynamic> data,
  ) async {
    final response = await http
        .post(
          Uri.parse('$baseUrl/users'),
          headers: await _headers(),
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
          headers: await _headers(),
          body: jsonEncode(data),
        )
        .timeout(const Duration(seconds: 10));
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> deleteUser(int id) async {
    final response = await http
        .delete(Uri.parse('$baseUrl/users/$id'), headers: await _headers())
        .timeout(const Duration(seconds: 10));
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> resetUserPassword(int id) async {
    final response = await http
        .post(
          Uri.parse('$baseUrl/users/$id/reset-password'),
          headers: await _headers(),
        )
        .timeout(const Duration(seconds: 10));
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> importUsers(
    List<Map<String, dynamic>> rows,
  ) async {
    return _importRowsInBatches('users/import', rows);
  }

  static Future<Map<String, dynamic>> importGuru(
    List<Map<String, dynamic>> rows,
  ) async {
    return _importRowsInBatches('users/import-guru', rows);
  }

  static Future<Map<String, dynamic>> getPaymentTypes({String? status}) async {
    final params = <String, String>{};
    if (status != null) params['status'] = status;
    final uri = Uri.parse(
      '$baseUrl/payment-types',
    ).replace(queryParameters: params.isNotEmpty ? params : null);
    final response = await http
        .get(uri, headers: await _headers())
        .timeout(const Duration(seconds: 10));
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> createPaymentType(
    Map<String, dynamic> data,
  ) async {
    final response = await http
        .post(
          Uri.parse('$baseUrl/payment-types'),
          headers: await _headers(),
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
          headers: await _headers(),
          body: jsonEncode(data),
        )
        .timeout(const Duration(seconds: 10));
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> deletePaymentType(int id) async {
    final response = await http
        .delete(
          Uri.parse('$baseUrl/payment-types/$id'),
          headers: await _headers(),
        )
        .timeout(const Duration(seconds: 10));
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> getPaymentMethods({bool? active}) async {
    final params = <String, String>{};
    if (active != null) params['active'] = active ? '1' : '0';
    final uri = Uri.parse(
      '$baseUrl/payment-methods',
    ).replace(queryParameters: params.isNotEmpty ? params : null);
    final response = await http
        .get(uri, headers: await _headers())
        .timeout(const Duration(seconds: 10));
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> createPaymentMethod(
    Map<String, dynamic> data,
  ) async {
    final response = await http
        .post(
          Uri.parse('$baseUrl/payment-methods'),
          headers: await _headers(),
          body: jsonEncode(data),
        )
        .timeout(const Duration(seconds: 10));
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> updatePaymentMethod(
    int id,
    Map<String, dynamic> data,
  ) async {
    final response = await http
        .put(
          Uri.parse('$baseUrl/payment-methods/$id'),
          headers: await _headers(),
          body: jsonEncode(data),
        )
        .timeout(const Duration(seconds: 10));
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> deletePaymentMethod(int id) async {
    final response = await http
        .delete(
          Uri.parse('$baseUrl/payment-methods/$id'),
          headers: await _headers(),
        )
        .timeout(const Duration(seconds: 10));
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> getPaymentPeriodTypes({
    bool? active,
  }) async {
    final params = <String, String>{};
    if (active != null) params['active'] = active ? '1' : '0';
    final uri = Uri.parse(
      '$baseUrl/payment-period-types',
    ).replace(queryParameters: params.isNotEmpty ? params : null);
    final response = await http
        .get(uri, headers: await _headers())
        .timeout(const Duration(seconds: 10));
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> createPaymentPeriodType(
    Map<String, dynamic> data,
  ) async {
    final response = await http
        .post(
          Uri.parse('$baseUrl/payment-period-types'),
          headers: await _headers(),
          body: jsonEncode(data),
        )
        .timeout(const Duration(seconds: 10));
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> updatePaymentPeriodType(
    int id,
    Map<String, dynamic> data,
  ) async {
    final response = await http
        .put(
          Uri.parse('$baseUrl/payment-period-types/$id'),
          headers: await _headers(),
          body: jsonEncode(data),
        )
        .timeout(const Duration(seconds: 10));
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> deletePaymentPeriodType(int id) async {
    final response = await http
        .delete(
          Uri.parse('$baseUrl/payment-period-types/$id'),
          headers: await _headers(),
        )
        .timeout(const Duration(seconds: 10));
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> getPaymentBills({
    int? siswaId,
    int? classId,
    String? status,
    int? limit,
    int? academicYearId,
    int? semesterId,
    String? tahunAjaran,
    String? semester,
  }) async {
    final params = <String, String>{};
    if (siswaId != null && siswaId > 0) params['siswa_id'] = siswaId.toString();
    if (classId != null && classId > 0) params['class_id'] = classId.toString();
    if (status != null && status.trim().isNotEmpty) {
      params['status'] = status.trim();
    }
    if (limit != null && limit > 0) params['limit'] = limit.toString();
    if (academicYearId != null && academicYearId > 0) {
      params['academic_year_id'] = academicYearId.toString();
    }
    if (semesterId != null && semesterId > 0) {
      params['semester_id'] = semesterId.toString();
    }
    if (tahunAjaran != null && tahunAjaran.trim().isNotEmpty) {
      params['tahun_ajaran'] = tahunAjaran.trim();
    }
    if (semester != null && semester.trim().isNotEmpty) {
      params['semester'] = semester.trim();
    }
    final uri = Uri.parse(
      '$baseUrl/payment-bills',
    ).replace(queryParameters: params.isNotEmpty ? params : null);
    final response = await http
        .get(uri, headers: await _headers())
        .timeout(const Duration(seconds: 10));
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> getPaymentBillStudentSummary({
    required int siswaId,
    int? academicYearId,
    int? semesterId,
    String? tahunAjaran,
    String? semester,
    String? status,
    int? paymentTypeId,
  }) async {
    final params = <String, String>{'siswa_id': siswaId.toString()};
    if (academicYearId != null && academicYearId > 0) {
      params['academic_year_id'] = academicYearId.toString();
    }
    if (semesterId != null && semesterId > 0) {
      params['semester_id'] = semesterId.toString();
    }
    if (tahunAjaran != null && tahunAjaran.trim().isNotEmpty) {
      params['tahun_ajaran'] = tahunAjaran.trim();
    }
    if (semester != null && semester.trim().isNotEmpty) {
      params['semester'] = semester.trim();
    }
    if (status != null && status.trim().isNotEmpty && status != 'Semua') {
      params['status'] = status.trim();
    }
    if (paymentTypeId != null && paymentTypeId > 0) {
      params['payment_type_id'] = paymentTypeId.toString();
    }

    final uri = Uri.parse(
      '$baseUrl/payment-bills/student-summary',
    ).replace(queryParameters: params);
    final response = await http
        .get(uri, headers: await _headers())
        .timeout(const Duration(seconds: 15));
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> getPaymentBillMonthlyOptions({
    required int siswaId,
    required int paymentTypeId,
    required int academicYearId,
    int? semesterId,
  }) async {
    final params = <String, String>{
      'siswa_id': siswaId.toString(),
      'payment_type_id': paymentTypeId.toString(),
      'academic_year_id': academicYearId.toString(),
    };
    if (semesterId != null && semesterId > 0) {
      params['semester_id'] = semesterId.toString();
    }

    final uri = Uri.parse(
      '$baseUrl/payment-bills/monthly-options',
    ).replace(queryParameters: params);
    final response = await http
        .get(uri, headers: await _headers())
        .timeout(const Duration(seconds: 15));
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> generatePaymentBills({
    int? ruleId,
    String? through,
  }) async {
    final body = <String, dynamic>{};
    if (ruleId != null) {
      body['rule_id'] = ruleId;
    }
    if (through != null) {
      body['through'] = through;
    }

    final response = await http
        .post(
          Uri.parse('$baseUrl/payment-bills/generate'),
          headers: await _headers(),
          body: jsonEncode(body),
        )
        .timeout(const Duration(seconds: 20));
    return _handleResponse(response);
  }

  // ---------- NILAI ----------
  static Future<Map<String, dynamic>> getNilai({
    required int userId,
    int? siswaId,
    int? mapelId,
    String? jenisUjian,
    String? semester,
    String? kelas,
    int? classId,
    String? tahunAjaran,
  }) async {
    final params = <String, String>{'user_id': userId.toString()};
    if (siswaId != null) params['siswa_id'] = siswaId.toString();
    if (mapelId != null) params['mapel_id'] = mapelId.toString();
    if (jenisUjian != null) params['jenis_ujian'] = jenisUjian;
    if (semester != null) params['semester'] = semester;
    if (classId != null && classId > 0) params['class_id'] = classId.toString();
    if (kelas != null) params['kelas'] = kelas;
    if (tahunAjaran != null) params['tahun_ajaran'] = tahunAjaran;

    final uri = Uri.parse(
      '$baseUrl/nilai',
    ).replace(queryParameters: params.isNotEmpty ? params : null);
    final response = await http
        .get(uri, headers: await _headers())
        .timeout(const Duration(seconds: 10));
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> createNilai(
    Map<String, dynamic> data,
  ) async {
    final response = await http.post(
      Uri.parse('$baseUrl/nilai'),
      headers: await _headers(),
      body: jsonEncode(data),
    );
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> createNilaiBulk({
    required int userId,
    required List<Map<String, dynamic>> dataList,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/nilai/bulk'),
      headers: await _headers(),
      body: jsonEncode({'user_id': userId, 'data': dataList}),
    );
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> updateNilai(
    int id,
    Map<String, dynamic> data,
  ) async {
    final response = await http.put(
      Uri.parse('$baseUrl/nilai/$id'),
      headers: await _headers(),
      body: jsonEncode(data),
    );
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> deleteNilai(int id, int userId) async {
    final uri = Uri.parse(
      '$baseUrl/nilai/$id',
    ).replace(queryParameters: {'user_id': userId.toString()});
    final response = await http
        .delete(uri, headers: await _headers())
        .timeout(const Duration(seconds: 10));
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> getRekapNilai({
    required int userId,
    String? kelas,
    String? semester,
  }) async {
    final params = <String, String>{'user_id': userId.toString()};
    if (kelas != null) params['kelas'] = kelas;
    if (semester != null) params['semester'] = semester;

    final uri = Uri.parse(
      '$baseUrl/nilai/rekap',
    ).replace(queryParameters: params.isNotEmpty ? params : null);
    final response = await http
        .get(uri, headers: await _headers())
        .timeout(const Duration(seconds: 10));
    return _handleResponse(response);
  }

  // ---------- HAFALAN ----------
  static Future<Map<String, dynamic>> getHafalan({
    required int userId,
    int? siswaId,
    String? status,
    String? kelas,
    int? classId,
    String? periode,
  }) async {
    final params = <String, String>{'user_id': userId.toString()};
    if (siswaId != null) params['siswa_id'] = siswaId.toString();
    if (status != null) params['status'] = status;
    if (classId != null && classId > 0) params['class_id'] = classId.toString();
    if (kelas != null) params['kelas'] = kelas;
    if (periode != null) params['periode'] = periode;

    final uri = Uri.parse(
      '$baseUrl/hafalan',
    ).replace(queryParameters: params.isNotEmpty ? params : null);
    final response = await http
        .get(uri, headers: await _headers())
        .timeout(const Duration(seconds: 10));
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> createHafalan(
    Map<String, dynamic> data,
  ) async {
    final response = await http.post(
      Uri.parse('$baseUrl/hafalan'),
      headers: await _headers(),
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
      headers: await _headers(),
      body: jsonEncode(data),
    );
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> deleteHafalan(int id, int userId) async {
    final uri = Uri.parse(
      '$baseUrl/hafalan/$id',
    ).replace(queryParameters: {'user_id': userId.toString()});
    final response = await http
        .delete(uri, headers: await _headers())
        .timeout(const Duration(seconds: 10));
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> getPenilaianDokumen({
    required int userId,
    required int siswaId,
    String? semester,
    String? tahunAjaran,
    String reportScope = 'gabungan',
  }) async {
    final params = <String, String>{
      'user_id': userId.toString(),
      'siswa_id': siswaId.toString(),
      'report_scope': reportScope,
    };
    if (semester != null) params['semester'] = semester;
    if (tahunAjaran != null) params['tahun_ajaran'] = tahunAjaran;

    final uri = Uri.parse(
      '$baseUrl/penilaian/dokumen',
    ).replace(queryParameters: params);
    final response = await http
        .get(uri, headers: await _headers())
        .timeout(const Duration(seconds: 15));
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> getPenilaianRekapExport({
    required int userId,
    String? kelas,
    String? semester,
    String? tahunAjaran,
    String scoreType = 'gabungan',
  }) async {
    final params = <String, String>{
      'user_id': userId.toString(),
      'score_type': scoreType,
    };
    if (kelas != null) params['kelas'] = kelas;
    if (semester != null) params['semester'] = semester;
    if (tahunAjaran != null) params['tahun_ajaran'] = tahunAjaran;

    final uri = Uri.parse(
      '$baseUrl/penilaian/rekap-export',
    ).replace(queryParameters: params);
    final response = await http
        .get(uri, headers: await _headers())
        .timeout(const Duration(seconds: 15));
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> getDocumentSettings() async {
    final response = await http
        .get(Uri.parse('$baseUrl/document-settings'), headers: await _headers())
        .timeout(const Duration(seconds: 10));
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> getPaymentSecuritySettings(
    int userId,
  ) async {
    final uri = Uri.parse(
      '$baseUrl/payment-security-settings',
    ).replace(queryParameters: {'user_id': userId.toString()});
    final response = await http
        .get(uri, headers: await _headers())
        .timeout(const Duration(seconds: 10));
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> updatePaymentSecuritySettings(
    int userId,
    Map<String, dynamic> data,
  ) async {
    final response = await http
        .put(
          Uri.parse('$baseUrl/payment-security-settings'),
          headers: await _headers(),
          body: jsonEncode({'user_id': userId, ...data}),
        )
        .timeout(const Duration(seconds: 10));
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> updateDocumentSettings(
    int userId,
    Map<String, dynamic> data, {
    String documentType = 'nilai',
  }) async {
    final response = await http.put(
      Uri.parse('$baseUrl/document-settings'),
      headers: await _headers(),
      body: jsonEncode({
        'user_id': userId,
        'document_type': documentType,
        ...data,
      }),
    );
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> uploadDocumentSignature(
    int userId,
    String filePath, {
    String documentType = 'nilai',
  }) async {
    final request = http.MultipartRequest(
      'POST',
      Uri.parse('$baseUrl/document-settings/signature'),
    );
    request.fields['user_id'] = userId.toString();
    request.fields['document_type'] = documentType;
    request.files.add(await http.MultipartFile.fromPath('signature', filePath));
    await _applyMultipartHeaders(request);
    final streamed = await request.send().timeout(const Duration(seconds: 20));
    final response = await http.Response.fromStream(streamed);
    return _handleResponse(response);
  }

  static Future<Map<String, dynamic>> uploadDocumentLogo(
    int userId,
    String filePath,
  ) async {
    final request = http.MultipartRequest(
      'POST',
      Uri.parse('$baseUrl/document-settings/logo'),
    );
    request.fields['user_id'] = userId.toString();
    request.files.add(await http.MultipartFile.fromPath('logo', filePath));
    await _applyMultipartHeaders(request);
    final streamed = await request.send().timeout(const Duration(seconds: 20));
    final response = await http.Response.fromStream(streamed);
    return _handleResponse(response);
  }
}

class ApiException implements Exception {
  final String message;
  ApiException(this.message);

  @override
  String toString() => message;
}
