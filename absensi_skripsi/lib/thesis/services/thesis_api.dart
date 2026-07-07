import 'dart:convert';

import 'package:http/http.dart' as http;

import 'thesis_session.dart';

class ThesisApi {
  static const baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://absensi-android-skripsi.vercel.app/api',
  );

  static Future<Map<String, dynamic>> login(
    String username,
    String password,
  ) async {
    final response = await http
        .post(
          Uri.parse('$baseUrl/auth/login'),
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({
            'username': username,
            'password': password,
            'device_name': 'android-skripsi',
          }),
        )
        .timeout(const Duration(seconds: 12));
    return _decode(response);
  }

  static Future<Map<String, dynamic>> get(String path) async {
    final response = await http
        .get(Uri.parse('$baseUrl$path'), headers: await _headers())
        .timeout(const Duration(seconds: 15));
    return _decode(response);
  }

  static Future<Map<String, dynamic>> send(
    String method,
    String path,
    Map<String, dynamic> body,
  ) async {
    final request = http.Request(method, Uri.parse('$baseUrl$path'))
      ..headers.addAll(await _headers())
      ..body = jsonEncode(body);
    final streamed = await request.send().timeout(const Duration(seconds: 20));
    final response = await http.Response.fromStream(streamed);
    return _decode(response);
  }

  static Future<Map<String, dynamic>> refreshToken() async {
    final response = await http
        .post(
          Uri.parse('$baseUrl/auth/refresh-token'),
          headers: await _headers(),
        )
        .timeout(const Duration(seconds: 12));
    return _decode(response);
  }

  static Future<Map<String, String>> _headers() async => {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ${await ThesisSession.token()}',
  };

  static Map<String, dynamic> _decode(http.Response response) {
    final data = response.body.isEmpty
        ? <String, dynamic>{}
        : Map<String, dynamic>.from(jsonDecode(response.body) as Map);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ThesisApiException(
        data['message']?.toString() ?? 'Server menolak permintaan.',
        response.statusCode,
      );
    }
    return data;
  }
}

class ThesisApiException implements Exception {
  final String message;
  final int statusCode;
  const ThesisApiException(this.message, this.statusCode);

  @override
  String toString() => message;
}
