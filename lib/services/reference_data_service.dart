import 'api_service.dart';
import 'cache_service.dart';
import 'session_service.dart';

class ReferenceDataSnapshot {
  final List<Map<String, dynamic>> mataPelajaran;
  final List<Map<String, dynamic>> kelas;
  final bool fromCache;

  const ReferenceDataSnapshot({
    required this.mataPelajaran,
    required this.kelas,
    required this.fromCache,
  });
}

class ReferenceDataService {
  static const String _cacheKeyVersion = 'reference_data_master_v3';

  static Future<ReferenceDataSnapshot?> getCached() async {
    final context = await _loadContext();
    final cached = await CacheService.get(_cacheKeyFor(context));
    if (cached is! Map<String, dynamic>) return null;

    return ReferenceDataSnapshot(
      mataPelajaran: _normalizeList(cached['mata_pelajaran']),
      kelas: _normalizeList(cached['kelas']),
      fromCache: true,
    );
  }

  static Future<ReferenceDataSnapshot> refresh() async {
    final context = await _loadContext();
    final results = await Future.wait([
      ApiService.getMataPelajaran(
        status: 'Aktif',
        userId: context.scopedMapelUserId,
      ),
      ApiService.getClasses(),
    ]);

    final mapel = _normalizeList(results[0]['data']);
    final kelas = _normalizeClasses(results[1]['data']);

    await CacheService.save(_cacheKeyFor(context), {
      'mata_pelajaran': mapel,
      'kelas': kelas,
      'updated_at': DateTime.now().toIso8601String(),
    });

    return ReferenceDataSnapshot(
      mataPelajaran: mapel,
      kelas: kelas,
      fromCache: false,
    );
  }

  static List<Map<String, dynamic>> _normalizeList(dynamic data) {
    return List<Map<String, dynamic>>.from(
      (data as List? ?? const []).map(
        (item) => Map<String, dynamic>.from(item as Map),
      ),
    );
  }

  static List<Map<String, dynamic>> _normalizeClasses(dynamic rawClasses) {
    final classes = _normalizeList(rawClasses);
    if (classes.isNotEmpty) {
      final normalized = classes.map((item) {
        final name = item['name']?.toString() ?? item['nama']?.toString() ?? '';
        return {
          ...item,
          'nama': name,
          'kategori': item['category'] ?? item['kategori'] ?? '',
        };
      }).toList();

      normalized.sort((a, b) {
        final kategoriCompare = (a['kategori']?.toString() ?? '').compareTo(
          b['kategori']?.toString() ?? '',
        );
        if (kategoriCompare != 0) return kategoriCompare;
        return (a['nama']?.toString() ?? '').compareTo(
          b['nama']?.toString() ?? '',
        );
      });

      return normalized;
    }

    return const [];
  }

  static String debugSummary(ReferenceDataSnapshot snapshot) {
    return 'mapel=${snapshot.mataPelajaran.length}, kelas=${snapshot.kelas.length}, cache=${snapshot.fromCache}';
  }

  static List<Map<String, dynamic>> filterMapelForKelas(
    List<Map<String, dynamic>> mapelList,
    String? kelas, [
    int? classId,
    String? userRole,
  ]) {
    final targetKelas = (kelas ?? '').trim();
    final activeMapel = mapelList.where((item) {
      final status = (item['status']?.toString() ?? 'Aktif').toLowerCase();
      return status == 'aktif';
    }).toList();

    if ((userRole ?? '').toLowerCase() == 'admin') {
      return activeMapel;
    }

    if (targetKelas.isEmpty && (classId == null || classId <= 0)) {
      return activeMapel;
    }

    return activeMapel.where((item) {
      final jadwalList = _normalizeList(item['jadwal']);
      if (jadwalList.isEmpty) return false;

      return jadwalList.any((jadwal) {
        final jadwalStatus = (jadwal['status']?.toString() ?? 'Aktif')
            .toLowerCase();
        final jadwalClassId = int.tryParse(
          jadwal['class_id']?.toString() ?? '',
        );
        final sifir = jadwal['sifir']?.toString() ?? '';
        final matchesClass = classId != null && classId > 0
            ? jadwalClassId == classId
            : sifir == targetKelas;
        return jadwalStatus == 'aktif' && matchesClass;
      });
    }).toList();
  }

  static Future<_ReferenceContext> _loadContext() async {
    final userId = await SessionService.getUserId();
    final userRole = await SessionService.getUserRole();
    return _ReferenceContext(userId: userId, userRole: userRole);
  }

  static String _cacheKeyFor(_ReferenceContext context) {
    final scopedRole = context.userRole.isEmpty ? 'guest' : context.userRole;
    final scopedUser = context.userRole == 'guru' && context.userId > 0
        ? context.userId
        : 'all';
    return '${_cacheKeyVersion}_${scopedRole}_$scopedUser';
  }
}

class _ReferenceContext {
  final int userId;
  final String userRole;

  const _ReferenceContext({required this.userId, required this.userRole});

  int? get scopedMapelUserId {
    if (userRole == 'guru' && userId > 0) {
      return userId;
    }
    return null;
  }
}
