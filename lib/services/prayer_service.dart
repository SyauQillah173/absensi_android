import 'dart:convert';

import 'package:flutter/foundation.dart' as foundation;
import 'package:geocoding/geocoding.dart';
import 'package:geolocator/geolocator.dart';
import 'package:http/http.dart' as http;

/// Service for fetching real-time prayer times from Aladhan API
/// Uses GPS location for accurate times — fallback to Gresik if denied
/// Method: Kemenag RI (method 20)
class PrayerTimeService {
  // Fallback coordinates (Gresik, Jawa Timur)
  static const _fallbackLat = -7.1625;
  static const _fallbackLng = 112.6508;
  static const _method = 20; // Kemenag RI

  // Cache
  static Map<String, String>? _cachedTimes;
  static String? _cachedDate;
  static Map<String, String>? _cachedHijri;
  static String? _cachedCity;
  // ignore: unused_field
  static double? _cachedLat;
  // ignore: unused_field
  static double? _cachedLng;

  static void debugPrint(String? message, {int? wrapWidth}) {
    if (foundation.kDebugMode) {
      foundation.debugPrint(message, wrapWidth: wrapWidth);
    }
  }

  /// Hijri month names in Indonesian
  static const _hijriMonthsId = {
    'Muḥarram': 'Muharram',
    'Muharram': 'Muharram',
    'Ṣafar': 'Safar',
    'Safar': 'Safar',
    "Rabīʿ al-Awwal": "Rabi'ul Awal",
    "Rabi al-Awwal": "Rabi'ul Awal",
    "Rabi' al-Awwal": "Rabi'ul Awal",
    "Rabīʿ al-Thānī": "Rabi'ul Akhir",
    "Rabi al-Thani": "Rabi'ul Akhir",
    "Rabi' al-Thani": "Rabi'ul Akhir",
    'Jumādá al-Ūlá': 'Jumadil Awal',
    'Jumada al-Ula': 'Jumadil Awal',
    "Jumādá al-Ākhirah": 'Jumadil Akhir',
    'Jumada al-Thani': 'Jumadil Akhir',
    'Rajab': 'Rajab',
    "Shaʿbān": "Sya'ban",
    'Shaban': "Sya'ban",
    "Sha'ban": "Sya'ban",
    'Ramaḍān': 'Ramadhan',
    'Ramadan': 'Ramadhan',
    'Shawwāl': 'Syawal',
    'Shawwal': 'Syawal',
    "Dhū al-Qaʿdah": "Dzulqa'dah",
    'Dhul-Qadah': "Dzulqa'dah",
    "Dhū al-Ḥijjah": 'Dzulhijjah',
    'Dhul-Hijjah': 'Dzulhijjah',
  };

  /// Get GPS location or fallback to Gresik
  static Future<Map<String, dynamic>> _getLocation() async {
    try {
      // Check if location services are enabled
      bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        return {
          'lat': _fallbackLat,
          'lng': _fallbackLng,
          'city': 'Gresik (GPS off)',
        };
      }

      // Check permission
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
          return {
            'lat': _fallbackLat,
            'lng': _fallbackLng,
            'city': 'Gresik (izin ditolak)',
          };
        }
      }
      if (permission == LocationPermission.deniedForever) {
        return {
          'lat': _fallbackLat,
          'lng': _fallbackLng,
          'city': 'Gresik (izin ditolak)',
        };
      }

      // Get position
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.low, // Low accuracy = faster
          timeLimit: Duration(seconds: 5),
        ),
      );

      _cachedLat = position.latitude;
      _cachedLng = position.longitude;

      // Reverse geocode to get city name
      String city = 'Lokasi GPS';
      try {
        final placemarks = await placemarkFromCoordinates(
          position.latitude,
          position.longitude,
        );
        if (placemarks.isNotEmpty) {
          final p = placemarks.first;
          city =
              p.subAdministrativeArea ??
              p.locality ??
              p.administrativeArea ??
              'Lokasi GPS';
        }
      } catch (_) {
        // Geocoding failed, use generic name
      }

      _cachedCity = city;
      return {
        'lat': position.latitude,
        'lng': position.longitude,
        'city': city,
      };
    } catch (_) {
      return {'lat': _fallbackLat, 'lng': _fallbackLng, 'city': 'Gresik'};
    }
  }

  /// Get prayer times for today. Returns cached if available.
  static Future<Map<String, dynamic>> getPrayerTimes() async {
    final today = DateTime.now();
    final dateKey =
        '${today.day.toString().padLeft(2, '0')}-${today.month.toString().padLeft(2, '0')}-${today.year}';
    final cacheKey =
        '${today.year}-${today.month.toString().padLeft(2, '0')}-${today.day.toString().padLeft(2, '0')}';

    // Return cache if same day
    if (_cachedTimes != null && _cachedDate == cacheKey) {
      return {
        'times': _cachedTimes!,
        'hijri': _cachedHijri,
        'source': 'cache',
        'city': _cachedCity ?? 'Gresik',
      };
    }

    // Get location (GPS or fallback)
    final location = await _getLocation();
    final lat = location['lat'] as double;
    final lng = location['lng'] as double;
    final city = location['city'] as String;

    try {
      final url = Uri.parse(
        'https://api.aladhan.com/v1/timings/$dateKey'
        '?latitude=$lat&longitude=$lng&method=$_method'
        '&tune=0,3,0,4,3,3,0,0,0', // Fajr+3, Dhuhr+4, Asr+3, Maghrib+3 (match Kemenag RI)
      );
      final response = await http.get(url).timeout(const Duration(seconds: 8));

      if (response.statusCode == 200) {
        final json = jsonDecode(response.body);
        final timings = json['data']['timings'] as Map<String, dynamic>;
        final hijriData = json['data']['date']['hijri'] as Map<String, dynamic>;

        final times = <String, String>{
          'Subuh': _trimTime(timings['Fajr']),
          'Dzuhur': _trimTime(timings['Dhuhr']),
          'Ashar': _trimTime(timings['Asr']),
          'Maghrib': _trimTime(timings['Maghrib']),
          'Isya': _trimTime(timings['Isha']),
        };

        // Parse Hijri date with Indonesian month names
        final monthEn = hijriData['month']?['en']?.toString() ?? '';
        final monthId = _hijriMonthsId[monthEn] ?? monthEn;
        final hijri = <String, String>{
          'day': hijriData['day']?.toString() ?? '',
          'month': monthEn,
          'monthId': monthId,
          'monthAr': hijriData['month']?['ar']?.toString() ?? '',
          'year': hijriData['year']?.toString() ?? '',
          'designation': 'H',
          'weekday': hijriData['weekday']?['ar']?.toString() ?? '',
        };

        // Cache
        _cachedTimes = times;
        _cachedDate = cacheKey;
        _cachedHijri = hijri;
        _cachedCity = city;

        debugPrint('🕌 Prayer times from API ($city): $times');
        debugPrint('📅 Hijri: ${hijri['day']} $monthId ${hijri['year']} H');

        return {'times': times, 'hijri': hijri, 'source': 'api', 'city': city};
      }
    } catch (e) {
      debugPrint('🕌 Prayer API error: $e');
    }

    // Fallback
    return {
      'times': _getFallbackTimes(today.month),
      'hijri': null,
      'source': 'fallback',
      'city': '$city (estimasi)',
    };
  }

  /// Remove timezone suffix and ensure clean HH:mm format
  static String _trimTime(dynamic t) {
    final s = t?.toString() ?? '00:00';
    // Extract only digits and colon (HH:mm)
    final match = RegExp(r'(\d{1,2}:\d{2})').firstMatch(s);
    return match?.group(1) ?? '00:00';
  }

  /// Hardcoded fallback prayer times for Gresik/Surabaya area
  static Map<String, String> _getFallbackTimes(int month) {
    const data = {
      1: {
        'Subuh': '04:15',
        'Dzuhur': '11:45',
        'Ashar': '15:10',
        'Maghrib': '17:50',
        'Isya': '19:05',
      },
      2: {
        'Subuh': '04:20',
        'Dzuhur': '11:50',
        'Ashar': '15:15',
        'Maghrib': '17:55',
        'Isya': '19:08',
      },
      3: {
        'Subuh': '04:20',
        'Dzuhur': '11:45',
        'Ashar': '15:05',
        'Maghrib': '17:45',
        'Isya': '18:55',
      },
      4: {
        'Subuh': '04:18',
        'Dzuhur': '11:35',
        'Ashar': '14:50',
        'Maghrib': '17:30',
        'Isya': '18:40',
      },
      5: {
        'Subuh': '04:20',
        'Dzuhur': '11:30',
        'Ashar': '14:45',
        'Maghrib': '17:20',
        'Isya': '18:30',
      },
      6: {
        'Subuh': '04:25',
        'Dzuhur': '11:30',
        'Ashar': '14:45',
        'Maghrib': '17:18',
        'Isya': '18:28',
      },
      7: {
        'Subuh': '04:25',
        'Dzuhur': '11:35',
        'Ashar': '14:50',
        'Maghrib': '17:22',
        'Isya': '18:32',
      },
      8: {
        'Subuh': '04:15',
        'Dzuhur': '11:35',
        'Ashar': '14:55',
        'Maghrib': '17:30',
        'Isya': '18:40',
      },
      9: {
        'Subuh': '04:05',
        'Dzuhur': '11:30',
        'Ashar': '14:55',
        'Maghrib': '17:35',
        'Isya': '18:45',
      },
      10: {
        'Subuh': '03:55',
        'Dzuhur': '11:25',
        'Ashar': '14:50',
        'Maghrib': '17:35',
        'Isya': '18:50',
      },
      11: {
        'Subuh': '03:50',
        'Dzuhur': '11:25',
        'Ashar': '14:55',
        'Maghrib': '17:40',
        'Isya': '18:55',
      },
      12: {
        'Subuh': '04:00',
        'Dzuhur': '11:35',
        'Ashar': '15:05',
        'Maghrib': '17:50',
        'Isya': '19:05',
      },
    };
    return data[month] ?? data[1]!;
  }

  /// Check for Islamic special days based on Hijri date
  static String? getSpecialDay(Map<String, String>? hijri) {
    if (hijri == null) return null;
    final day = int.tryParse(hijri['day'] ?? '') ?? 0;
    final month = hijri['month'] ?? '';

    // Ramadan
    if (month == 'Ramaḍān' || month == 'Ramadan') {
      if (day == 1) return '🌙 Awal Ramadhan';
      if (day >= 21) return '🌙 Lailatul Qadr (mungkin)';
      return '🌙 Ramadhan hari ke-$day';
    }
    // Syawwal
    if (month == 'Shawwāl' || month == 'Shawwal') {
      if (day == 1) return '🎉 Idul Fitri 1';
      if (day == 2) return '🎉 Idul Fitri 2';
      if (day >= 2 && day <= 7) return '🌙 Puasa Syawal (opsional)';
    }
    // Dzulhijjah
    if (month == 'Dhū al-Ḥijjah' || month == 'Dhul-Hijjah') {
      if (day == 9) return '🕋 Wukuf Arafah';
      if (day == 10) return '🐪 Idul Adha';
      if (day >= 11 && day <= 13) return '🐪 Hari Tasyrik';
    }
    // Muharram
    if (month == 'Muḥarram' || month == 'Muharram') {
      if (day == 1) return '📅 Tahun Baru Hijriyah';
      if (day == 10) return '📿 Asyura';
    }
    // Rabiul Awal
    if (month == "Rabīʿ al-Awwal" || month == "Rabi al-Awwal") {
      if (day == 12) return '🕌 Maulid Nabi Muhammad ﷺ';
    }
    // Rajab
    if (month == 'Rajab') {
      if (day == 27) return "✨ Isra Mi'raj";
    }
    // Sya'ban
    if (month == "Shaʿbān" || month == "Shaban") {
      if (day == 15) return "🌕 Nisfu Sya'ban";
    }
    return null;
  }
}
