import 'package:absensi_android/services/local_db_service.dart';
import 'package:absensi_android/services/session_service.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('offline attendance key supports an optional schedule', () {
    final key = LocalDbService.buildAttendanceKey({
      'tanggal': '2026-07-06',
      'class_id': 3,
      'mapel_id': 7,
      'jadwal_id': null,
      'siswa_id': 11,
    });

    expect(key, '2026-07-06_3_7_0_11');
  });

  test(
    'offline account keeps its API token for later synchronization',
    () async {
      SharedPreferences.setMockInitialValues({});

      final user = <String, dynamic>{
        'id': 5,
        'name': 'Guru Uji',
        'email': 'guru@example.test',
        'role': 'guru',
        'token': 'token-skripsi',
        'must_change_password': false,
      };

      await SessionService.saveLoginSession(user);
      await SessionService.upsertOfflineAccount(
        identifier: 'guru@example.test',
        password: 'rahasia',
        userData: user,
      );

      final account = await SessionService.findOfflineAccount(
        identifier: 'guru@example.test',
        password: 'rahasia',
      );
      expect(account?['token'], 'token-skripsi');

      await SessionService.saveLoginSession(
        account!,
      );
      expect(await SessionService.getAuthToken(), 'token-skripsi');
    },
  );
}
