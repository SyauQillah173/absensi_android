import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../services/api_service.dart';
import '../../services/cache_service.dart';
import '../../services/local_db_service.dart';
import '../../services/prayer_service.dart';
import '../../services/session_service.dart';
import '../../services/sync_service.dart';
import '../../widgets/app_feedback.dart';
import '../../widgets/responsive_layout.dart';
import '../absensi/absensi_murid_screen.dart';
import '../absensi/absensi_sifir_screen.dart';
import '../akun/akun_screen.dart';
import '../buku_induk/buku_induk_screen.dart';
import '../guru/data_diri_guru_screen.dart';
import '../mapel/mata_pelajaran_screen.dart';
import '../ortu/riwayat_absensi_ortu_screen.dart';
import '../ortu/biodata_siswa_ortu_screen.dart';
import 'placeholder_screen.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  /// Static flag — set from anywhere to trigger dashboard refresh
  static bool needsRefresh = false;

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  late Timer _timer;
  StreamSubscription<AppDataEvent>? _dataEventsSubscription;
  DateTime _now = DateTime.now();
  int _lastDay = DateTime.now().day; // Track day for midnight reset
  int _selectedBottomNav = 0;

  // Dashboard data: merged API (completed) + local pending
  List<Map<String, dynamic>> _absensiCards = [];
  bool _isDashboardLoading = false;
  bool _isDashboardRequestInFlight = false;
  String _dashboardFingerprint = '';
  DateTime? _lastRemoteProbeAt;
  DateTime? _nextSmartRefreshAt;

  // Prayer times from Aladhan API
  Map<String, String> _prayerTimes = {};
  Map<String, String>? _hijriDate;
  String _prayerCity = 'Gresik';
  String? _specialDay;

  // User session data
  int _userId = 0;
  String _userName = '';
  String _userRole = 'admin'; // default admin
  String _adminType = 'utama';
  Map<String, dynamic> _permissionsByKey = {};

  // PageView controller for swipe navigation
  late final PageController _pageController;

  // ===== ICON-BASED MENU ITEMS (Phase 26: replaced Image.asset) =====
  static const Map<String, IconData> _menuIcons = {
    'Absensi': Icons.fact_check_rounded,
    'Mata Pelajaran': Icons.menu_book_rounded,
    'Buku Induk': Icons.library_books_rounded,
    'Data Diri Guru': Icons.badge_rounded,
    'Biodata Siswa': Icons.badge_rounded,
  };

  static const Map<String, List<Color>> _menuColors = {
    'Absensi': [Color(0xFF138F81), Color(0xFF0DBF73)],
    'Mata Pelajaran': [Color(0xFF2E86DE), Color(0xFF54A0FF)],
    'Buku Induk': [Color(0xFF2D3436), Color(0xFF636E72)],
    'Data Diri Guru': [Color(0xFF2D3436), Color(0xFF636E72)],
    'Biodata Siswa': [Color(0xFF138F81), Color(0xFF54A0FF)],
  };

  // All menu items — filtered by role
  static const List<String> _allMenuTitles = [
    'Buku Induk',
    'Absensi',
    'Mata Pelajaran',
  ];

  // Menu khusus orang tua
  static const List<String> _waliMenuTitles = ['Absensi', 'Biodata Siswa'];

  static const List<String> _guruMenuTitles = [
    'Buku Induk',
    'Absensi',
    'Mata Pelajaran',
  ];

  List<String> get _menuTitles {
    final base = _userRole == 'wali'
        ? _waliMenuTitles
        : _userRole == 'guru'
        ? _guruMenuTitles
        : _allMenuTitles;
    return base.where(_canViewMenuTitle).toList();
  }

  // Bottom nav items — dynamic berdasarkan role
  // Wali: 3 tab (tanpa Ruang Sifir)
  // Admin/Guru: 4 tab (dengan Ruang Sifir)
  List<Map<String, dynamic>> get _bottomNavItems {
    if (_userRole == 'wali') {
      return [
        {
          'title': 'Beranda',
          'icon': Icons.home_rounded,
          'color': const Color(0xFF138F81),
        },
        {
          'title': 'Akun',
          'icon': Icons.person_rounded,
          'color': const Color(0xFFF39C12),
        },
      ];
    }
    final items = [
      {
        'title': 'Beranda',
        'icon': Icons.home_rounded,
        'color': const Color(0xFF138F81),
      },
      {
        'title': 'Akun',
        'icon': Icons.person_rounded,
        'color': const Color(0xFFF39C12),
      },
    ];
    return items;
  }

  static const Map<String, String> _menuPermissionKeys = {
    'Absensi': 'absensi',
    'Mata Pelajaran': 'mata_pelajaran',
    'Buku Induk': 'buku_induk',
    'Data Diri Guru': 'data_diri_guru',
    'Biodata Siswa': 'biodata_siswa',
  };

  bool _canViewMenuTitle(String title) {
    final key = _menuPermissionKeys[title];
    return key == null || _canViewKey(key);
  }

  bool _canViewKey(String key) {
    if (_userRole == 'admin' && (_adminType.isEmpty || _adminType == 'utama')) {
      return true;
    }
    if (_permissionsByKey.isEmpty) return true;
    final permission = _permissionsByKey[key];
    if (permission is! Map) return false;
    return permission['is_enabled'] == true && permission['can_view'] == true;
  }

  List<Widget> get _bottomPages {
    final pages = <Widget>[_buildBerandaContent(), const AkunScreen()];
    return pages;
  }

  @override
  void initState() {
    super.initState();
    _pageController = PageController();

    // === FIX BUG 1: AWAIT user session SEBELUM load dashboard ===
    // Sebelumnya: _loadUserSession() dan _loadDashboardData() jalan paralel
    // → _userName masih kosong saat filter card → card tidak muncul
    // Sekarang: tunggu user session selesai dulu, baru load dashboard
    _initAsync();

    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (_selectedBottomNav == 0) {
        setState(() {
          _now = DateTime.now();
        });

        // === MIDNIGHT RESET: Cek apakah sudah ganti hari ===
        // Saat jam 00:00, card absensi kemarin otomatis hilang
        if (_now.day != _lastDay) {
          _lastDay = _now.day;
          _requestDashboardRefresh(
            silent: true,
            reason: 'day_changed',
          ); // Cards reset — API hanya return hari ini
        }

        // Check if absensi was saved and dashboard needs refresh
        if (DashboardScreen.needsRefresh) {
          DashboardScreen.needsRefresh = false;
          _requestDashboardRefresh(silent: true, reason: 'dirty_flag');
        }

        if (_shouldTriggerScheduledRefresh(_now)) {
          _nextSmartRefreshAt = null;
          _requestDashboardRefresh(silent: true, reason: 'schedule_boundary');
        }
      }
    });
    _loadPrayerTimes();
    _dataEventsSubscription = SyncService.dataEvents.listen(_handleDataEvent);

    // Register sync callback so dashboard auto-refreshes after offline sync
    SyncService.onSyncComplete = () {
      if (mounted) {
        _requestDashboardRefresh(silent: true, reason: 'sync_complete');
      }
    };
  }

  /// === FIX: Load user session FIRST, then dashboard data ===
  Future<void> _initAsync() async {
    await _loadUserSession();
    await _loadDashboardData();
  }

  Future<void> _loadUserSession() async {
    if (!mounted) return;
    // === FIX BUG 2: Format _userName SAMA dengan absensi_murid_screen ===
    // Absensi screen menyimpan diinput_oleh = "Guru: Ust. Ahmad Fauzi"
    // Dashboard harus pakai format yang SAMA untuk filter card per user
    // Sebelumnya: _userName = "Ust. Ahmad Fauzi" → tidak cocok → card hilang
    final userId = await SessionService.getUserId();
    final name = await SessionService.getUserName();
    final role = await SessionService.getUserRole();
    final adminType = await SessionService.getAdminType();
    final roleLabel = role == 'wali'
        ? 'Orang Tua'
        : role == 'guru'
        ? 'Guru'
        : 'Admin';
    final displayName = name.isNotEmpty ? name : roleLabel;
    setState(() {
      _userId = userId;
      _userName = '$roleLabel: $displayName';
      _userRole = role;
      _adminType = adminType.isEmpty ? 'utama' : adminType;
    });
  }

  bool _shouldTriggerScheduledRefresh(DateTime now) {
    final nextRefresh = _nextSmartRefreshAt;
    return nextRefresh != null && !now.isBefore(nextRefresh);
  }

  Duration _remoteProbeInterval() {
    final hasTimeSensitiveCards = _absensiCards.any((card) {
      final status = card['status']?.toString() ?? '';
      return status == 'upcoming' || status == 'aktif' || status == 'pending';
    });

    if (_userRole == 'guru' || hasTimeSensitiveCards) {
      return const Duration(seconds: 30);
    }
    return const Duration(minutes: 1);
  }

  void _handleDataEvent(AppDataEvent event) {
    if (!mounted) return;

    const refreshTopics = {
      SyncTopics.absensi,
      SyncTopics.connectivity,
      SyncTopics.mapel,
      SyncTopics.kelas,
      SyncTopics.session,
    };

    if (_selectedBottomNav != 0) {
      if (event.topic != SyncTopics.heartbeat) {
        DashboardScreen.needsRefresh = true;
      }
      return;
    }

    if (event.topic == SyncTopics.heartbeat) {
      final now = DateTime.now();
      final lastProbe = _lastRemoteProbeAt;
      if (lastProbe == null ||
          now.difference(lastProbe) >= _remoteProbeInterval()) {
        _requestDashboardRefresh(silent: true, reason: 'heartbeat_probe');
      }
      return;
    }

    if (refreshTopics.contains(event.topic)) {
      _requestDashboardRefresh(silent: true, reason: 'event_${event.topic}');
    }
  }

  void _requestDashboardRefresh({
    bool silent = true,
    String reason = 'manual',
  }) {
    if (!mounted) return;

    if (_selectedBottomNav != 0) {
      DashboardScreen.needsRefresh = true;
      return;
    }

    unawaited(_loadDashboardData(silent: silent, reason: reason));
  }

  String _completedAbsensiCacheKey() {
    return CacheService.userScopedKey(
      'completed_absensi_today',
      role: _userRole,
      userId: _userId,
    );
  }

  String _buildDashboardFingerprint(List<Map<String, dynamic>> cards) {
    final normalized =
        cards
            .map(
              (card) => {
                'kelas': card['kelas']?.toString() ?? '',
                'mapel': card['mapel']?.toString() ?? '',
                'class_id': card['class_id'] ?? 0,
                'mapel_id': card['mapel_id'] ?? 0,
                'jadwal_id': card['jadwal_id'] ?? 0,
                'status': card['status']?.toString() ?? '',
                'diinput_oleh': card['diinput_oleh']?.toString() ?? '',
                'waktu': card['waktu']?.toString() ?? '',
                'jam_mulai': card['jam_mulai']?.toString() ?? '',
                'jam_selesai': card['jam_selesai']?.toString() ?? '',
                'total': card['total'] ?? 0,
                'hadir': card['hadir'] ?? 0,
                'izin': card['izin'] ?? 0,
                'sakit': card['sakit'] ?? 0,
                'alfa': card['alfa'] ?? 0,
              },
            )
            .toList()
          ..sort((a, b) {
            final left = '${a['kelas']}|${a['mapel']}|${a['jam_mulai']}';
            final right = '${b['kelas']}|${b['mapel']}|${b['jam_mulai']}';
            return left.compareTo(right);
          });

    return jsonEncode({'cards': normalized});
  }

  DateTime? _parseScheduleTime(dynamic rawTime) {
    final value = rawTime?.toString().trim() ?? '';
    if (value.isEmpty || value == '-') return null;

    final date = DateFormat('yyyy-MM-dd').format(DateTime.now());
    final normalized = value.length <= 5 ? '$value:00' : value;
    return DateTime.tryParse('$date $normalized');
  }

  void _scheduleNextSmartRefresh(List<Map<String, dynamic>> cards) {
    final now = DateTime.now();
    final candidates = <DateTime>[];

    for (final card in cards) {
      final startAt = _parseScheduleTime(card['jam_mulai']);
      final endAt = _parseScheduleTime(card['jam_selesai']);

      if (startAt != null && now.isBefore(startAt)) {
        candidates.add(startAt);
      }

      if (endAt != null) {
        final endBoundary = endAt.add(const Duration(seconds: 1));
        if (now.isBefore(endBoundary)) {
          candidates.add(endBoundary);
        }
      }
    }

    candidates.sort();
    _nextSmartRefreshAt = candidates.isNotEmpty ? candidates.first : null;
  }

  Future<void> _loadDashboardData({
    bool silent = false,
    String reason = 'manual',
  }) async {
    if (_isDashboardRequestInFlight) {
      DashboardScreen.needsRefresh = true;
      return;
    }

    _isDashboardRequestInFlight = true;
    if (!silent && mounted) {
      setState(() => _isDashboardLoading = true);
    }

    try {
      // Dashboard guru wajib membaca status live dari database.
      // Jangan fallback ke cache lama untuk status completed karena bisa
      // menampilkan data palsu setelah database dibersihkan.
      Map<String, dynamic>? result;
      try {
        result = await ApiService.getDashboard(
          userId: _userId > 0 ? _userId : null,
        );
      } catch (_) {
        result = null;
      }

      List<dynamic> apiPerKelas = [];
      var usingCachedFinalData = false;
      if (result != null && result['success'] == true) {
        _applyPermissionsFromResponse(result);
        apiPerKelas = result['absensi']?['per_kelas'] ?? [];
        await CacheService.save(_completedAbsensiCacheKey(), {
          'tanggal': DateTime.now().toIso8601String().split('T')[0],
          'per_kelas': apiPerKelas,
          'source': 'live',
        });
      } else {
        final cachedCompleted = await CacheService.get(
          _completedAbsensiCacheKey(),
        );
        if (cachedCompleted is Map<String, dynamic>) {
          final today = DateTime.now().toIso8601String().split('T')[0];
          if (cachedCompleted['tanggal'] == today) {
            final cachedPerKelas = List<dynamic>.from(
              cachedCompleted['per_kelas'] ?? const [],
            );
            apiPerKelas = cachedPerKelas.where((item) {
              final status = item is Map
                  ? item['status']?.toString().toLowerCase()
                  : '';
              return status == 'completed' || status == 'locked';
            }).toList();
            usingCachedFinalData = apiPerKelas.isNotEmpty;
          }
        }
      }

      // 2. Load local pending absensi
      final pendingList = await LocalDbService.getAllAbsensiToday();

      // Group pending by kelas+mapel
      final pendingByKey = <String, List<Map<String, dynamic>>>{};
      for (final p in pendingList) {
        final syncStatus = p['sync_status']?.toString() ?? 'pending';
        if (syncStatus == 'pending' ||
            syncStatus == 'failed' ||
            syncStatus == 'syncing') {
          final kelas = p['kelas']?.toString().trim() ?? '';
          final mapel = p['mapel']?.toString().trim() ?? '';
          if (kelas.isEmpty || mapel.isEmpty) continue;
          final key = '$kelas|$mapel';
          pendingByKey.putIfAbsent(key, () => []).add(p);
        }
      }

      // Track completed kelas+mapel dari API (mencegah duplikat)
      final completedKeys = <String>{};

      // 3. Merge into absensi cards
      final cards = <Map<String, dynamic>>[];

      final isAdmin = _userRole == 'admin';
      final rawName = _userName.contains(': ')
          ? _userName.split(': ').sublist(1).join(': ')
          : _userName;

      // Add cards dari API.
      // Backend sudah bertanggung jawab memfilter sesuai role.
      for (final kelas in apiPerKelas) {
        final kelasName = kelas['kelas']?.toString() ?? '';
        final mapelName = kelas['mapel']?.toString() ?? '-';
        if (kelasName.trim().isEmpty || mapelName.trim().isEmpty) continue;
        final cardKey = '$kelasName|$mapelName';

        completedKeys.add(cardKey);
        cards.add({
          'kelas': kelasName,
          'mapel': mapelName,
          'class_id': kelas['class_id'],
          'mapel_id': kelas['mapel_id'],
          'jadwal_id': kelas['jadwal_id'],
          'siswa_id': kelas['siswa_id'],
          'siswa_nama': kelas['siswa_nama'],
          'status': usingCachedFinalData && _userRole != 'wali'
              ? 'locked'
              : kelas['status']?.toString() ?? 'completed',
          'total': kelas['total'] ?? 0,
          'hadir': kelas['hadir'] ?? 0,
          'diinput_oleh': kelas['diinput_oleh']?.toString() ?? 'Admin',
          'waktu': usingCachedFinalData
              ? 'Final server tersimpan di cache offline'
              : kelas['waktu'] ?? '-',
          'jam_mulai': kelas['jam_mulai'],
          'jam_selesai': kelas['jam_selesai'],
          'notification_key': kelas['notification_key'],
        });
      }

      for (final entry in pendingByKey.entries) {
        final parts = entry.key.split('|');
        final existingIndex = cards.indexWhere(
          (card) => card['kelas'] == parts.first && card['mapel'] == parts.last,
        );
        if (existingIndex >= 0 &&
            cards[existingIndex]['status'] != 'completed') {
          final inputBy = entry.value.first['diinput_oleh']?.toString() ?? '';
          cards[existingIndex] = {
            ...cards[existingIndex],
            'status':
                entry.value.any((p) => p['sync_status']?.toString() == 'failed')
                ? 'failed'
                : 'pending',
            'total': entry.value.length,
            'hadir': entry.value.where((p) => p['status'] == 'Hadir').length,
            'diinput_oleh': inputBy,
            'waktu':
                entry.value.any((p) => p['sync_status']?.toString() == 'failed')
                ? 'Sync gagal, menunggu retry'
                : 'Menunggu sync',
          };
        }
      }

      // Add pending (from local DB) — HANYA yang belum completed DAN milik user
      for (final entry in pendingByKey.entries) {
        if (!completedKeys.contains(entry.key)) {
          final inputBy = entry.value.first['diinput_oleh']?.toString() ?? '';
          final isMyCard =
              isAdmin ||
              inputBy == _userName ||
              inputBy.contains(rawName) ||
              (rawName.isNotEmpty && inputBy.contains(rawName));

          if (isMyCard) {
            cards.add({
              'kelas':
                  entry.value.first['kelas']?.toString() ??
                  entry.key.split('|').first,
              'mapel': entry.value.first['mapel']?.toString() ?? '-',
              'class_id': entry.value.first['class_id'],
              'mapel_id': entry.value.first['mapel_id'],
              'jadwal_id': entry.value.first['jadwal_id'],
              'status':
                  entry.value.any(
                    (p) => p['sync_status']?.toString() == 'failed',
                  )
                  ? 'failed'
                  : 'pending',
              'total': entry.value.length,
              'hadir': entry.value.where((p) => p['status'] == 'Hadir').length,
              'diinput_oleh': inputBy,
              'waktu':
                  entry.value.any(
                    (p) => p['sync_status']?.toString() == 'failed',
                  )
                  ? 'Sync gagal, menunggu retry'
                  : 'Menunggu sync',
            });
          }
        }
      }

      final fingerprint = _buildDashboardFingerprint(cards);
      final hasChanged = fingerprint != _dashboardFingerprint;
      _dashboardFingerprint = fingerprint;
      _scheduleNextSmartRefresh(cards);
      _lastRemoteProbeAt = DateTime.now();

      if (mounted) {
        if (!silent || hasChanged) {
          setState(() {
            _absensiCards = cards;
            _isDashboardLoading = false;
          });
        } else if (_isDashboardLoading) {
          setState(() => _isDashboardLoading = false);
        }
      }

      if (_userRole == 'guru') {
        await _notifyUpcomingSchedules(cards);
      }

      // === PRE-CACHE DATA SISWA UNTUK OFFLINE ===
      // Jalankan di background agar tidak mengganggu UI
      _preCacheStudentData();
    } finally {
      _isDashboardRequestInFlight = false;
      if (DashboardScreen.needsRefresh && _selectedBottomNav == 0) {
        DashboardScreen.needsRefresh = false;
        _requestDashboardRefresh(silent: true, reason: 'queued_refresh');
      }
    }
  }

  void _applyPermissionsFromResponse(Map<String, dynamic> result) {
    final permissions = result['permissions'];
    if (permissions is! Map) return;
    final byKey = permissions['by_key'];
    if (byKey is! Map) return;

    final normalized = Map<String, dynamic>.from(byKey);
    if (!mounted) {
      _permissionsByKey = normalized;
      return;
    }

    setState(() {
      _permissionsByKey = normalized;
      final navLength = _bottomNavItems.length;
      if (_selectedBottomNav >= navLength) {
        _selectedBottomNav = 0;
        if (_pageController.hasClients) {
          _pageController.jumpToPage(0);
        }
      }
    });
  }

  /// Pre-cache semua data siswa per kelas untuk offline absensi
  /// Ini jalan di background saat dashboard load online
  Future<void> _preCacheStudentData() async {
    try {
      // Fetch semua siswa dan cache secara global
      final allSiswa = await ApiService.getSiswa();
      if (allSiswa['success'] == true) {
        await CacheService.save('siswa_list', allSiswa);

        // Cache per kelas juga
        final allData = List<Map<String, dynamic>>.from(allSiswa['data'] ?? []);
        final kelasList = allData
            .map((s) => s['kelas']?.toString() ?? '')
            .toSet();
        for (final kelas in kelasList) {
          if (kelas.isEmpty) continue;
          final kelasData = allData
              .where((s) => s['kelas']?.toString() == kelas)
              .toList();
          await CacheService.save('siswa_kelas_$kelas', {
            'success': true,
            'data': kelasData,
          });
        }
      }
    } catch (_) {
      // Gagal pre-cache? Tidak apa-apa — data lama masih ada di cache
    }
  }

  Future<void> _notifyUpcomingSchedules(
    List<Map<String, dynamic>> cards,
  ) async {
    final prefs = await SharedPreferences.getInstance();
    for (final card in cards) {
      if (card['status'] != 'upcoming') continue;
      final notificationKey =
          card['notification_key']?.toString() ??
          '${DateTime.now().toIso8601String().split('T').first}_${card['kelas']}_${card['mapel']}_${card['jam_mulai']}';
      final storageKey = 'guru_upcoming_$notificationKey';
      if (prefs.getBool(storageKey) == true) continue;

      final body =
          '${card['mapel']} • ${card['kelas']} mulai ${card['jam_mulai'] ?? '-'}.\nAbsensi sudah dibuka dari jadwal admin.';
      await SyncService.showSystemNotification('Pengingat Absensi Guru', body);
      await prefs.setBool(storageKey, true);
    }
  }

  Future<void> _loadPrayerTimes() async {
    try {
      final result = await PrayerTimeService.getPrayerTimes();
      if (mounted) {
        final times = Map<String, String>.from(result['times'] ?? {});
        final hijri = result['hijri'] != null
            ? Map<String, String>.from(result['hijri'])
            : null;
        setState(() {
          _prayerTimes = times;
          _hijriDate = hijri;
          _prayerCity = result['city'] ?? 'Gresik';
          _specialDay = PrayerTimeService.getSpecialDay(hijri);
        });
      }
    } catch (_) {
      // Use fallback silently
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Menu icons are now Material Icons — no precache needed
  }

  @override
  void dispose() {
    _timer.cancel();
    _dataEventsSubscription?.cancel();
    _pageController.dispose();
    // Remove sync callback
    SyncService.onSyncComplete = null;
    super.dispose();
  }

  void _onPageChanged(int index) {
    setState(() {
      _selectedBottomNav = index;
    });
    if (index == 0) {
      final now = DateTime.now();
      if (DashboardScreen.needsRefresh ||
          _shouldTriggerScheduledRefresh(now) ||
          _lastRemoteProbeAt == null ||
          now.difference(_lastRemoteProbeAt!) >= _remoteProbeInterval()) {
        DashboardScreen.needsRefresh = false;
        _requestDashboardRefresh(silent: true, reason: 'page_focus');
      }
    }
  }

  void _onNavTapped(int index) {
    if (_selectedBottomNav != index) {
      _pageController.animateToPage(
        index,
        duration: const Duration(milliseconds: 350),
        curve: Curves.easeOutCubic,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFFDC80),
      body: SafeArea(
        child: Column(
          children: [
            // ===== SWIPEABLE CONTENT =====
            Expanded(
              child: PageView(
                controller: _pageController,
                onPageChanged: _onPageChanged,
                physics: const ClampingScrollPhysics(),
                children: _bottomPages,
              ),
            ),

            // ===== BOTTOM NAVIGATION BAR =====
            _buildBottomNavBar(),
          ],
        ),
      ),
    );
  }

  // ===== BERANDA (Home) content =====
  Widget _buildBerandaContent() {
    return AppRefreshIndicator(
      onRefresh: () => _loadDashboardData(reason: 'manual_refresh'),
      child: SingleChildScrollView(
        padding: EdgeInsets.symmetric(
          horizontal: AppResponsive.pageMargin(context),
          vertical: 12,
        ),
        physics: const AlwaysScrollableScrollPhysics(
          parent: BouncingScrollPhysics(),
        ),
        child: AppResponsive(
          padding: EdgeInsets.zero,
          child: Column(
            children: [
              _buildProfileBar(),
              const SizedBox(height: 14),
              _buildInfoCard(),
              const SizedBox(height: 14),
              _buildAbsensiStatusSection(),
              const SizedBox(height: 20),
              _buildMenuSection(),
            ],
          ),
        ),
      ),
    );
  }

  // ---------- PROFILE BAR ----------
  Widget _buildProfileBar() {
    final selectedItem = _bottomNavItems[_selectedBottomNav];
    final selectedIcon = selectedItem['icon'] as IconData;
    final selectedColor = selectedItem['color'] as Color;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: const Color(0xFFE1EFF7),
        borderRadius: BorderRadius.circular(25),
      ),
      child: Row(
        children: [
          Container(
            width: 50,
            height: 50,
            decoration: const BoxDecoration(
              shape: BoxShape.circle,
              color: Color(0xFFFFDC80),
            ),
            child: Icon(selectedIcon, color: selectedColor, size: 28),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  // === Strip prefix untuk display (\"Guru: Nama\" → \"Nama\") ===
                  _userName.contains(': ')
                      ? _userName.split(': ').sublist(1).join(': ')
                      : (_userName.isNotEmpty ? _userName : 'User'),
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF2D3436),
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Wrap(
                  spacing: 6,
                  runSpacing: 3,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 6,
                        vertical: 2,
                      ),
                      decoration: BoxDecoration(
                        color: _userRole == 'admin'
                            ? const Color(0xFFE65100).withValues(alpha: 0.12)
                            : _userRole == 'wali'
                            ? const Color(0xFF6C5CE7).withValues(alpha: 0.12)
                            : const Color(0xFF138F81).withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        _userRole == 'admin'
                            ? 'Admin'
                            : _userRole == 'wali'
                            ? 'Orang Tua'
                            : 'Guru',
                        style: TextStyle(
                          fontSize: 9,
                          fontWeight: FontWeight.w700,
                          color: _userRole == 'admin'
                              ? const Color(0xFFE65100)
                              : _userRole == 'wali'
                              ? const Color(0xFF6C5CE7)
                              : const Color(0xFF138F81),
                        ),
                      ),
                    ),
                    const Text(
                      'Madrasah Diniyah Qomaruddin',
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w400,
                        color: Color(0xFF636E72),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ---------- INFO CARD ----------
  Widget _buildInfoCard() {
    String formattedTime = DateFormat('HH:mm:ss').format(_now);
    const days = [
      'Senin',
      'Selasa',
      'Rabu',
      'Kamis',
      "Jum'at",
      'Sabtu',
      'Ahad',
    ];
    const months = [
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
    String formattedDate =
        "${days[_now.weekday - 1]}, ${_now.day} ${months[_now.month - 1]} ${_now.year}";

    // Jadwal sholat from API (GPS-based) — PrayerTimeService has builtin fallback
    final jadwalSholat = _prayerTimes.isNotEmpty
        ? _prayerTimes
        : <String, String>{
            'Subuh': '--:--',
            'Dzuhur': '--:--',
            'Ashar': '--:--',
            'Maghrib': '--:--',
            'Isya': '--:--',
          };

    // Info puasa (Hijri-based jika ada, fallback Senin/Kamis)
    String? infoPuasa;
    if (_hijriDate != null) {
      final hijriDay = int.tryParse(_hijriDate!['day'] ?? '') ?? 0;
      if (hijriDay == 13 || hijriDay == 14 || hijriDay == 15) {
        infoPuasa = '🌙 Puasa Ayyamul Bidh (tanggal $hijriDay Hijriyah)';
      }
    }
    if (infoPuasa == null) {
      if (_now.weekday == 1) infoPuasa = '🌙 Hari ini Puasa Sunnah Senin';
      if (_now.weekday == 4) infoPuasa = '🌙 Hari ini Puasa Sunnah Kamis';
    }

    // Hijri date string — pakai Bahasa Indonesia (Syawal bukan شوال)
    String? hijriStr;
    if (_hijriDate != null) {
      final monthName = _hijriDate!['monthId'] ?? _hijriDate!['monthAr'] ?? '';
      hijriStr =
          '${_hijriDate!['day']} $monthName ${_hijriDate!['year']} ${_hijriDate!['designation']}';
    }

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: const Color(0xFFE1EFF7),
        borderRadius: BorderRadius.circular(25),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            formattedTime,
            style: const TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.w700,
              color: Color(0xFF2D3436),
              letterSpacing: 1.5,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            formattedDate,
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w500,
              color: Color(0xFF2D3436),
            ),
          ),
          // Hijri date
          if (hijriStr != null) ...[
            const SizedBox(height: 2),
            Text(
              hijriStr,
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w500,
                color: Color(0xFF6C5CE7),
              ),
            ),
          ],
          const SizedBox(height: 12),
          Container(
            height: 1.5,
            color: const Color(0xFF2D3436).withValues(alpha: 0.15),
          ),

          // ===== JADWAL SHOLAT =====
          const SizedBox(height: 12),
          Row(
            children: [
              Container(
                width: 24,
                height: 24,
                decoration: BoxDecoration(
                  color: const Color(0xFF138F81).withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(7),
                ),
                child: const Icon(
                  Icons.mosque_rounded,
                  size: 14,
                  color: Color(0xFF138F81),
                ),
              ),
              const SizedBox(width: 8),
              Text(
                'Jadwal Sholat • $_prayerCity',
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF138F81),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          _buildSholatRow(jadwalSholat),
          const SizedBox(height: 10),

          // ===== SPECIAL DAY =====
          if (_specialDay != null) ...[
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: const Color(0xFF138F81).withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      _specialDay!,
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF138F81),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 6),
          ],

          // ===== INFO PUASA =====
          if (infoPuasa != null) ...[
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: const Color(0xFF6C5CE7).withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                children: [
                  const Icon(
                    Icons.nightlight_round,
                    size: 16,
                    color: Color(0xFF6C5CE7),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      infoPuasa,
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF6C5CE7),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 10),
          ],

          // Old absensi status moved to separate section outside info card
        ],
      ),
    );
  }

  // ---------- ABSENSI STATUS CARDS (Pending/Completed) ----------
  Widget _buildAbsensiStatusSection() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFE1EFF7),
        borderRadius: BorderRadius.circular(25),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Row(
            children: [
              Container(
                width: 24,
                height: 24,
                decoration: BoxDecoration(
                  color: const Color(0xFF2E86DE).withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(7),
                ),
                child: const Icon(
                  Icons.fact_check_rounded,
                  size: 14,
                  color: Color(0xFF2E86DE),
                ),
              ),
              const SizedBox(width: 8),
              Text(
                _userRole == 'guru'
                    ? 'Jadwal absensi guru hari ini'
                    : 'Absensi kelas hari ini',
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF2D3436),
                ),
              ),
              const Spacer(),
              GestureDetector(
                onTap: _loadDashboardData,
                child: Container(
                  padding: const EdgeInsets.all(4),
                  decoration: BoxDecoration(
                    color: const Color(0xFF636E72).withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: const Icon(
                    Icons.refresh_rounded,
                    size: 14,
                    color: Color(0xFF636E72),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Cards
          if (_isDashboardLoading)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 8),
              child: Center(
                child: SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: Color(0xFF138F81),
                  ),
                ),
              ),
            )
          else if (_absensiCards.isEmpty)
            Padding(
              padding: EdgeInsets.symmetric(vertical: 8),
              child: Center(
                child: Text(
                  _userRole == 'guru'
                      ? 'Belum ada jadwal absensi yang aktif saat ini.\nJadwal akan muncul sesuai hari dan jam yang diatur admin.'
                      : _userRole == 'wali'
                      ? 'Belum ada riwayat absensi final hari ini.\nData akan muncul otomatis setelah guru/admin menyimpan absensi.'
                      : 'Belum ada absensi hari ini.\nAbsen di menu Absensi untuk memulai.',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 11, color: Color(0xFF636E72)),
                ),
              ),
            )
          else
            ..._absensiCards.map((card) => _buildAbsensiCard(card)),
        ],
      ),
    );
  }

  Widget _buildAbsensiCard(Map<String, dynamic> card) {
    final kelas = card['kelas']?.toString() ?? '';
    final kelasCount = (card['kelas_count'] as num?)?.toInt() ?? 0;
    final isMultiClass = card['is_multi_class'] == true || kelasCount > 1;
    final mapel = card['mapel']?.toString() ?? '-';
    final classId = (card['class_id'] as num?)?.toInt();
    final mapelId = (card['mapel_id'] as num?)?.toInt();
    final jadwalId = (card['jadwal_id'] as num?)?.toInt();
    final status = card['status']?.toString() ?? 'completed';
    final isLocked = status == 'locked';
    final isPending = status == 'pending';
    final isFailed = status == 'failed';
    final isUpcoming = status == 'upcoming';
    final isAktif = status == 'aktif';
    final statusColor = isLocked
        ? const Color(0xFF546E7A)
        : isFailed
        ? const Color(0xFFE65100)
        : isPending
        ? const Color(0xFFFFB74D)
        : isUpcoming
        ? const Color(0xFF2E86DE)
        : isAktif
        ? const Color(0xFF6C5CE7)
        : const Color(0xFF138F81);
    final statusText = isLocked
        ? 'Locked'
        : isFailed
        ? 'Failed Sync'
        : isPending
        ? 'Pending'
        : isUpcoming
        ? 'Upcoming'
        : isAktif
        ? 'Aktif'
        : 'Completed';
    final bgColor = isLocked
        ? const Color(0xFFECEFF1)
        : isFailed
        ? const Color(0xFFFFEBEE)
        : isPending
        ? const Color(0xFFFFF3E0)
        : isUpcoming
        ? const Color(0xFFEAF3FF)
        : isAktif
        ? const Color(0xFFF0EBFF)
        : const Color(0xFFE8F5E9);

    return GestureDetector(
      onTap: () async {
        if (_userRole == 'wali') {
          final siswaId = (card['siswa_id'] as num?)?.toInt();
          final siswaName = card['siswa_nama']?.toString().trim() ?? '';
          if (siswaId != null && siswaId > 0) {
            final prefs = await SharedPreferences.getInstance();
            await prefs.setInt('active_siswa_id', siswaId);
            if (siswaName.isNotEmpty) {
              await prefs.setString('active_siswa_nama', siswaName);
            }
          }
        }

        if (!mounted) {
          return;
        }

        if (_userRole == 'guru' && (isLocked || isUpcoming)) {
          final message = card['status_message']?.toString().trim();
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                message?.isNotEmpty == true
                    ? message!
                    : isUpcoming
                    ? 'Absensi belum dibuka. Silakan tunggu jam mulai sesuai jadwal.'
                    : 'Absensi masih terkunci untuk jadwal ini.',
              ),
              backgroundColor: const Color(0xFF546E7A),
              behavior: SnackBarBehavior.floating,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
              ),
            ),
          );
          return;
        }

        final targetScreen = _userRole == 'wali'
            ? const RiwayatAbsensiOrtuScreen()
            : isMultiClass
            ? const AbsensiSifirScreen()
            : AbsensiMuridScreen(
                namaKelas: kelas,
                namaMapel: mapel,
                classId: classId,
                mapelId: mapelId,
                jadwalId: jadwalId,
              );
        Navigator.push(
          context,
          PageRouteBuilder(
            pageBuilder: (context, animation, _) => targetScreen,
            transitionsBuilder: (context, animation, _, child) {
              return SlideTransition(
                position:
                    Tween<Offset>(
                      begin: const Offset(1, 0),
                      end: Offset.zero,
                    ).animate(
                      CurvedAnimation(
                        parent: animation,
                        curve: Curves.easeOutCubic,
                      ),
                    ),
                child: child,
              );
            },
            transitionDuration: const Duration(milliseconds: 350),
          ),
        ).then((_) {
          // Refresh when coming back
          if (mounted) {
            _requestDashboardRefresh(silent: true, reason: 'route_return');
          }
        });
      },
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: bgColor,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: statusColor.withValues(alpha: 0.3)),
        ),
        child: Row(
          children: [
            // Dot indicator
            Container(
              width: 10,
              height: 10,
              decoration: BoxDecoration(
                color: statusColor,
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(width: 12),
            // Class name
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '$kelas — $mapel',
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF2D3436),
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 2),
                  Text(
                    isUpcoming || isAktif
                        ? isMultiClass
                              ? 'Jadwal: ${card['jam_mulai'] ?? '-'} - ${card['jam_selesai'] ?? '-'} • $kelasCount kelas'
                              : 'Jadwal: ${card['jam_mulai'] ?? '-'} - ${card['jam_selesai'] ?? '-'}'
                        : isMultiClass
                        ? 'Input: ${card['diinput_oleh'] ?? '-'} • $kelasCount kelas'
                        : 'Input: ${card['diinput_oleh'] ?? '-'}',
                    style: const TextStyle(
                      fontSize: 9,
                      color: Color(0xFF636E72),
                    ),
                  ),
                ],
              ),
            ),
            // Status badge
            ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 92),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: statusColor.withValues(alpha: 0.4)),
                ),
                child: Text(
                  statusText,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    color: statusColor,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // Jadwal sholat row
  Widget _buildSholatRow(Map<String, String> jadwal) {
    final entries = jadwal.entries.toList();
    // Determine which prayer is next
    String? nextPrayer;
    final nowMinutes = _now.hour * 60 + _now.minute;
    for (final e in entries) {
      final parts = e.value.split(':');
      final hour = int.tryParse(parts[0]) ?? 0;
      final minute = parts.length > 1 ? (int.tryParse(parts[1]) ?? 0) : 0;
      final prayerMinutes = hour * 60 + minute;
      if (prayerMinutes > nowMinutes) {
        nextPrayer = e.key;
        break;
      }
    }

    return Wrap(
      spacing: 6,
      runSpacing: 6,
      children: entries.map((e) {
        final isNext = e.key == nextPrayer;
        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
          decoration: BoxDecoration(
            color: isNext
                ? const Color(0xFF138F81)
                : Colors.white.withValues(alpha: 0.7),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                e.key,
                style: TextStyle(
                  fontSize: 9,
                  fontWeight: FontWeight.w600,
                  color: isNext ? Colors.white : const Color(0xFF636E72),
                ),
              ),
              const SizedBox(height: 2),
              Text(
                e.value,
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  color: isNext ? Colors.white : const Color(0xFF2D3436),
                ),
              ),
            ],
          ),
        );
      }).toList(),
    );
  }

  // Old _getJadwalSholat and _getInfoPuasa removed — replaced by PrayerTimeService (GPS-based)

  // ---------- MENU SECTION ----------
  Widget _buildMenuSection() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 22),
      decoration: BoxDecoration(
        color: const Color(0xFFE1EFF7),
        borderRadius: const BorderRadius.only(
          topLeft: Radius.circular(35),
          topRight: Radius.circular(35),
          bottomLeft: Radius.circular(50),
          bottomRight: Radius.circular(50),
        ),
      ),
      child: Column(
        children: [
          const Text(
            'Menu',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: Color(0xFF138F81),
            ),
          ),
          const SizedBox(height: 6),
          const Text(
            'Gunakan Menu Ini Untuk Melihat\nInformasi Dan Mengelola Data Anda',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w400,
              color: Color(0xFF636E72),
              height: 1.4,
            ),
          ),
          const SizedBox(height: 20),
          // Dynamic menu grid — adapts to role-filtered items
          _buildMenuGrid(),
        ],
      ),
    );
  }

  /// Builds the menu grid dynamically from role-filtered menu titles
  Widget _buildMenuGrid() {
    final items = _menuTitles;
    return LayoutBuilder(
      builder: (context, constraints) {
        final gap = constraints.maxWidth <= 330 ? 12.0 : 16.0;
        final itemWidth = ((constraints.maxWidth - gap) / 2).clamp(
          116.0,
          150.0,
        );
        return Wrap(
          alignment: WrapAlignment.center,
          spacing: gap,
          runSpacing: gap,
          children: items
              .map((item) => _buildMenuItem(item, width: itemWidth))
              .toList(),
        );
      },
    );
  }

  Widget _buildMenuItem(String title, {double width = 130}) {
    final icon = _menuIcons[title] ?? Icons.apps_rounded;
    final colors =
        _menuColors[title] ??
        [const Color(0xFF636E72), const Color(0xFF95A5A6)];

    return GestureDetector(
      onTap: () {
        if (!_canViewMenuTitle(title)) {
          ScaffoldMessenger.of(
            context,
          ).showSnackBar(const SnackBar(content: Text('Akses ditolak')));
          return;
        }

        Widget targetScreen;

        // === WALI: Menu khusus monitoring ===
        if (_userRole == 'wali') {
          switch (title) {
            case 'Absensi':
              targetScreen = const RiwayatAbsensiOrtuScreen();
              break;
            case 'Biodata Siswa':
              targetScreen = const BiodataSiswaOrtuScreen();
              break;
            default:
              targetScreen = PlaceholderScreen(title: title);
          }
        } else {
          // === ADMIN / GURU ===
          switch (title) {
            case 'Absensi':
              targetScreen = const AbsensiSifirScreen();
              break;
            case 'Mata Pelajaran':
              targetScreen = MataPelajaranScreen(readOnly: _userRole == 'guru');
              break;
            case 'Buku Induk':
              targetScreen = BukuIndukScreen(userRole: _userRole);
              break;
            case 'Data Diri Guru':
              targetScreen = const DataDiriGuruScreen();
              break;
            default:
              targetScreen = PlaceholderScreen(title: title);
          }
        }
        Navigator.push(
          context,
          PageRouteBuilder(
            pageBuilder: (context, animation, _) => targetScreen,
            transitionsBuilder: (context, animation, _, child) {
              return FadeTransition(
                opacity: animation,
                child: SlideTransition(
                  position:
                      Tween<Offset>(
                        begin: const Offset(0.0, 0.05),
                        end: Offset.zero,
                      ).animate(
                        CurvedAnimation(
                          parent: animation,
                          curve: Curves.easeOutCubic,
                        ),
                      ),
                  child: child,
                ),
              );
            },
            transitionDuration: const Duration(milliseconds: 350),
          ),
        );
      },
      child: Container(
        width: width,
        padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 10),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(21),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: colors,
                ),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Icon(icon, color: Colors.white, size: 28),
            ),
            const SizedBox(height: 8),
            Text(
              title,
              textAlign: TextAlign.center,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: Color(0xFF2D3436),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ---------- BOTTOM NAVIGATION BAR ----------
  Widget _buildBottomNavBar() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
      decoration: BoxDecoration(
        color: const Color(0xFFE1EFF7),
        borderRadius: BorderRadius.circular(21),
      ),
      child: Row(
        children: List.generate(_bottomNavItems.length, (index) {
          return Expanded(child: _buildBottomNavItem(index));
        }),
      ),
    );
  }

  Widget _buildBottomNavItem(int index) {
    final item = _bottomNavItems[index];
    final isSelected = _selectedBottomNav == index;
    final icon = item['icon'] as IconData;
    final iconColor = item['color'] as Color;
    return GestureDetector(
      onTap: () => _onNavTapped(index),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 250),
        constraints: const BoxConstraints(minHeight: 58),
        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFFFFDC80) : Colors.transparent,
          borderRadius: BorderRadius.circular(8),
        ),
        child: FittedBox(
          fit: BoxFit.scaleDown,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                icon,
                size: 26,
                color: isSelected ? iconColor : const Color(0xFF636E72),
              ),
              const SizedBox(height: 4),
              Text(
                item['title']!,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
                  color: isSelected
                      ? const Color(0xFF2D3436)
                      : const Color(0xFF636E72),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
