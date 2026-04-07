import 'dart:async';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../services/api_service.dart';
import '../../services/cache_service.dart';
import '../../services/local_db_service.dart';
import '../../services/prayer_service.dart';
import '../../services/sync_service.dart';
import '../absensi/absensi_murid_screen.dart';
import '../absensi/absensi_sifir_screen.dart';
import '../akun/akun_screen.dart';
import '../buku_induk/buku_induk_screen.dart';
import '../jelajah/jelajah_screen.dart';
import '../keuangan/pembayaran_screen.dart';
import '../nilai/nilai_input_screen.dart';
import '../mapel/mata_pelajaran_screen.dart';
import '../materi/materi_kegiatan_screen.dart';
import '../ortu/riwayat_absensi_ortu_screen.dart';
import '../ortu/pembayaran_ortu_screen.dart';
import '../ortu/nilai_ortu_screen.dart';
import '../ortu/kegiatan_belajar_ortu_screen.dart';
import '../sifir/ruang_sifir_screen.dart';
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
  DateTime _now = DateTime.now();
  int _lastDay = DateTime.now().day; // Track day for midnight reset
  int _selectedBottomNav = 0;

  // Dashboard data: merged API (completed) + local pending
  List<Map<String, dynamic>> _absensiCards = [];
  bool _isDashboardLoading = false;

  // Prayer times from Aladhan API
  Map<String, String> _prayerTimes = {};
  Map<String, String>? _hijriDate;
  String _prayerCity = 'Gresik';
  String? _specialDay;

  // User session data
  String _userName = '';
  String _userRole = 'admin'; // default admin

  // PageView controller for swipe navigation
  late final PageController _pageController;

  // ===== ICON-BASED MENU ITEMS (Phase 26: replaced Image.asset) =====
  static const Map<String, IconData> _menuIcons = {
    'Absensi': Icons.fact_check_rounded,
    'Mata Pelajaran': Icons.menu_book_rounded,
    'Nilai Ujian/Hafalan': Icons.school_rounded,
    'Keuangan': Icons.account_balance_wallet_rounded,
    'Buku Induk': Icons.library_books_rounded,
    'Materi & Kegiatan': Icons.photo_library_rounded,
    'Pembayaran': Icons.payment_rounded,
    'Nilai': Icons.emoji_events_rounded,
    'Kegiatan Belajar': Icons.auto_stories_rounded,
  };

  static const Map<String, List<Color>> _menuColors = {
    'Absensi': [Color(0xFF138F81), Color(0xFF0DBF73)],
    'Mata Pelajaran': [Color(0xFF2E86DE), Color(0xFF54A0FF)],
    'Nilai Ujian/Hafalan': [Color(0xFF6C5CE7), Color(0xFFA29BFE)],
    'Keuangan': [Color(0xFFE65100), Color(0xFFFF9800)],
    'Buku Induk': [Color(0xFF2D3436), Color(0xFF636E72)],
    'Materi & Kegiatan': [Color(0xFFD63031), Color(0xFFFF7675)],
    'Pembayaran': [Color(0xFFE65100), Color(0xFFFF9800)],
    'Nilai': [Color(0xFF6C5CE7), Color(0xFFA29BFE)],
    'Kegiatan Belajar': [Color(0xFFD63031), Color(0xFFFF7675)],
  };

  // All menu items — filtered by role
  static const List<String> _allMenuTitles = [
    'Absensi', 'Mata Pelajaran', 'Nilai Ujian/Hafalan',
    'Keuangan', 'Buku Induk', 'Materi & Kegiatan',
  ];

  // Menu khusus orang tua
  static const List<String> _waliMenuTitles = [
    'Absensi', 'Pembayaran', 'Nilai', 'Kegiatan Belajar',
  ];

  // Menus hidden for guru
  static const List<String> _guruHiddenMenus = ['Keuangan'];

  List<String> get _menuTitles {
    if (_userRole == 'wali') return _waliMenuTitles.toList();
    if (_userRole == 'guru') {
      return _allMenuTitles.where((t) => !_guruHiddenMenus.contains(t)).toList();
    }
    return _allMenuTitles.toList();
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
          'title': 'Jelajah',
          'icon': Icons.explore_rounded,
          'color': const Color(0xFFD63031),
        },
        {
          'title': 'Akun',
          'icon': Icons.person_rounded,
          'color': const Color(0xFFF39C12),
        },
      ];
    }
    return [
      {
        'title': 'Beranda',
        'icon': Icons.home_rounded,
        'color': const Color(0xFF138F81),
      },
      {
        'title': 'Jelajah',
        'icon': Icons.explore_rounded,
        'color': const Color(0xFFD63031),
      },
      {
        'title': 'Ruang Sifir',
        'icon': Icons.class_rounded,
        'color': const Color(0xFFE65100),
      },
      {
        'title': 'Akun',
        'icon': Icons.person_rounded,
        'color': const Color(0xFFF39C12),
      },
    ];
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
          _loadDashboardData(); // Cards reset — API hanya return hari ini
        }

        // Check if absensi was saved and dashboard needs refresh
        if (DashboardScreen.needsRefresh) {
          DashboardScreen.needsRefresh = false;
          _loadDashboardData();
        }
      }
    });
    _loadPrayerTimes();

    // Register sync callback so dashboard auto-refreshes after offline sync
    SyncService.onSyncComplete = () {
      if (mounted) _loadDashboardData();
    };
  }

  /// === FIX: Load user session FIRST, then dashboard data ===
  Future<void> _initAsync() async {
    await _loadUserSession();
    _loadDashboardData();
  }

  Future<void> _loadUserSession() async {
    final prefs = await SharedPreferences.getInstance();
    if (!mounted) return;
    // === FIX BUG 2: Format _userName SAMA dengan absensi_murid_screen ===
    // Absensi screen menyimpan diinput_oleh = "Guru: Ust. Ahmad Fauzi"
    // Dashboard harus pakai format yang SAMA untuk filter card per user
    // Sebelumnya: _userName = "Ust. Ahmad Fauzi" → tidak cocok → card hilang
    final name = prefs.getString('user_name') ?? '';
    final role = prefs.getString('user_role') ?? 'admin';
    final roleLabel = role == 'wali'
        ? 'Orang Tua'
        : role == 'guru'
        ? 'Guru'
        : 'Admin';
    final displayName = name.isNotEmpty ? name : roleLabel;
    setState(() {
      _userName = '$roleLabel: $displayName';
      _userRole = role;
    });
  }

  Future<void> _loadDashboardData() async {
    setState(() => _isDashboardLoading = true);

    // 1. Load API data (completed absensi) — per-user cache key
    final cacheKey = 'dashboard_data_${_userName.replaceAll(' ', '_')}';
    final result = await CacheService.fetchWithCache(
      cacheKey: cacheKey,
      apiFetch: () => ApiService.getDashboard(),
    );

    List<dynamic> apiPerKelas = [];
    if (result != null && result['success'] == true) {
      apiPerKelas = result['absensi']?['per_kelas'] ?? [];
    }

    // === DEBUG: Lihat data mentah dari API ===
    debugPrint('═══════════════════════════════════════════');
    debugPrint('📊 DASHBOARD DEBUG');
    debugPrint('_userName = "$_userName"');
    debugPrint('_userRole = "$_userRole"');
    debugPrint('cacheKey  = "$cacheKey"');
    debugPrint('result success = ${result?['success']}');
    debugPrint('result fromCache = ${result?['_fromCache']}');
    debugPrint('apiPerKelas count = ${apiPerKelas.length}');
    for (int i = 0; i < apiPerKelas.length; i++) {
      final k = apiPerKelas[i];
      debugPrint(
        '  [$i] kelas="${k['kelas']}" mapel="${k['mapel']}" '
        'diinput_oleh="${k['diinput_oleh']}" total=${k['total']}',
      );
    }
    debugPrint('═══════════════════════════════════════════');

    // === SELALU cache absensi hari ini (untuk offline lock) ===
    await CacheService.save('completed_absensi_today', {
      'tanggal': DateTime.now().toIso8601String().split('T')[0],
      'per_kelas': apiPerKelas,
    });

    // 2. Load local pending absensi
    final pendingList = await LocalDbService.getAllAbsensiToday();

    // Group pending by kelas+mapel
    final pendingByKey = <String, List<Map<String, dynamic>>>{};
    for (final p in pendingList) {
      if (p['sync_status'] == 'pending') {
        final key = '${p['kelas'] ?? 'Unknown'}|${p['mapel'] ?? '-'}';
        pendingByKey.putIfAbsent(key, () => []).add(p);
      }
    }

    debugPrint('📦 Pending absensi: ${pendingByKey.length} groups');

    // Track completed kelas+mapel dari API (mencegah duplikat)
    final completedKeys = <String>{};

    // 3. Merge into absensi cards
    final cards = <Map<String, dynamic>>[];

    // === PER-USER CARD FILTER ===
    final isAdmin = _userRole == 'admin';

    // === FIX: Extract raw name untuk flexible matching ===
    // _userName bisa berformat "Guru: Ust. Ahmad Fauzi" atau "Ust. Ahmad Fauzi"
    // diinput_oleh bisa berformat "Guru: Ust. Ahmad Fauzi" atau "Ust. Ahmad Fauzi"
    // Gunakan matching yang fleksibel agar tidak bergantung pada format exact
    final rawName = _userName.contains(': ')
        ? _userName.split(': ').sublist(1).join(': ')
        : _userName;

    // Add completed (from API/cache) — filter per user
    for (final kelas in apiPerKelas) {
      final kelasName = kelas['kelas']?.toString() ?? '';
      final mapelName = kelas['mapel']?.toString() ?? '-';
      final inputBy = kelas['diinput_oleh']?.toString() ?? 'Admin';
      final cardKey = '$kelasName|$mapelName';

      completedKeys.add(cardKey);

      // === FLEXIBLE FILTER ===
      // Admin: lihat semua
      // Guru: cocokkan dengan beberapa format:
      //   1. Exact match: inputBy == _userName
      //   2. inputBy contains rawName (e.g., "Guru: Fauzi" contains "Fauzi")
      //   3. rawName contains in inputBy
      final isMyCard =
          isAdmin ||
          inputBy == _userName ||
          inputBy.contains(rawName) ||
          (rawName.isNotEmpty && inputBy.contains(rawName));

      debugPrint(
        '  🔍 Card "$kelasName|$mapelName": inputBy="$inputBy" '
        'rawName="$rawName" isMyCard=$isMyCard',
      );

      if (isMyCard) {
        cards.add({
          'kelas': kelasName,
          'mapel': mapelName,
          'status': 'completed',
          'total': kelas['total'] ?? 0,
          'hadir': kelas['hadir'] ?? 0,
          'diinput_oleh': inputBy,
          'waktu': kelas['waktu'] ?? '-',
        });
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

        debugPrint(
          '  📦 Pending "${entry.key}": inputBy="$inputBy" '
          'isMyCard=$isMyCard',
        );

        if (isMyCard) {
          cards.add({
            'kelas':
                entry.value.first['kelas']?.toString() ??
                entry.key.split('|').first,
            'mapel': entry.value.first['mapel']?.toString() ?? '-',
            'status': 'pending',
            'total': entry.value.length,
            'hadir': entry.value.where((p) => p['status'] == 'Hadir').length,
            'diinput_oleh': inputBy,
            'waktu': 'Menunggu sync',
          });
        }
      }
    }

    debugPrint('✅ Total cards to show: ${cards.length}');
    debugPrint('═══════════════════════════════════════════');

    if (mounted) {
      setState(() {
        _absensiCards = cards;
        _isDashboardLoading = false;
      });
    }

    // === PRE-CACHE DATA SISWA UNTUK OFFLINE ===
    // Jalankan di background agar tidak mengganggu UI
    _preCacheStudentData();
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
    _pageController.dispose();
    // Remove sync callback
    SyncService.onSyncComplete = null;
    super.dispose();
  }

  void _onPageChanged(int index) {
    setState(() {
      _selectedBottomNav = index;
    });
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
                children: _userRole == 'wali'
                    ? [
                        _buildBerandaContent(),
                        const JelajahScreen(),
                        const AkunScreen(),
                      ]
                    : [
                        _buildBerandaContent(),
                        const JelajahScreen(),
                        const RuangSifirScreen(),
                        const AkunScreen(),
                      ],
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
    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      physics: const BouncingScrollPhysics(),
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
            child: Icon(
              selectedIcon,
              color: selectedColor,
              size: 28,
            ),
          ),
          const SizedBox(width: 12),
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
                Row(
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
                    const SizedBox(width: 6),
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
              const Text(
                'Absensi kelas hari ini',
                style: TextStyle(
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
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 8),
              child: Center(
                child: Text(
                  'Belum ada absensi hari ini.\nAbsen di menu Absensi untuk memulai.',
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
    final mapel = card['mapel']?.toString() ?? '-';
    final isPending = card['status'] == 'pending';
    final statusColor = isPending
        ? const Color(0xFFFFB74D) // orange
        : const Color(0xFF138F81); // green
    final statusText = isPending ? 'Pending' : 'Completed';
    final bgColor = isPending
        ? const Color(0xFFFFF3E0) // light orange
        : const Color(0xFFE8F5E9); // light green

    return GestureDetector(
      onTap: () {
        // Navigate to absensi screen for this class
        Navigator.push(
          context,
          PageRouteBuilder(
            pageBuilder: (context, animation, _) =>
                AbsensiMuridScreen(namaKelas: kelas, namaMapel: mapel),
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
          if (mounted) _loadDashboardData();
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
                    'Input: ${card['diinput_oleh'] ?? '-'}',
                    style: const TextStyle(
                      fontSize: 9,
                      color: Color(0xFF636E72),
                    ),
                  ),
                ],
              ),
            ),
            // Status badge
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: statusColor.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: statusColor.withValues(alpha: 0.4)),
              ),
              child: Text(
                statusText,
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                  color: statusColor,
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
          ..._buildMenuGrid(),
        ],
      ),
    );
  }

  /// Builds the menu grid dynamically from role-filtered menu titles
  List<Widget> _buildMenuGrid() {
    final items = _menuTitles;
    final List<Widget> rows = [];
    for (int i = 0; i < items.length; i += 2) {
      final row = <Widget>[_buildMenuItem(items[i])];
      if (i + 1 < items.length) {
        row.add(const SizedBox(width: 20));
        row.add(_buildMenuItem(items[i + 1]));
      }
      rows.add(Row(mainAxisAlignment: MainAxisAlignment.center, children: row));
      if (i + 2 < items.length) {
        rows.add(const SizedBox(height: 16));
      }
    }
    return rows;
  }

  Widget _buildMenuItem(String title) {
    final icon = _menuIcons[title] ?? Icons.apps_rounded;
    final colors = _menuColors[title] ?? [const Color(0xFF636E72), const Color(0xFF95A5A6)];

    return GestureDetector(
      onTap: () {
        Widget targetScreen;

        // === WALI: Menu khusus monitoring ===
        if (_userRole == 'wali') {
          switch (title) {
            case 'Absensi':
              targetScreen = const RiwayatAbsensiOrtuScreen();
              break;
            case 'Pembayaran':
              targetScreen = const PembayaranOrtuScreen();
              break;
            case 'Nilai':
              targetScreen = const NilaiOrtuScreen();
              break;
            case 'Kegiatan Belajar':
              targetScreen = const KegiatanBelajarOrtuScreen();
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
              targetScreen = const MataPelajaranScreen();
              break;
            case 'Nilai Ujian/Hafalan':
              targetScreen = const NilaiInputScreen();
              break;
            case 'Keuangan':
              targetScreen = const PembayaranScreen();
              break;
            case 'Buku Induk':
              targetScreen = BukuIndukScreen(userRole: _userRole);
              break;
            case 'Materi & Kegiatan':
              targetScreen = const MateriKegiatanScreen();
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
        width: 130,
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
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: List.generate(_bottomNavItems.length, (index) {
          final item = _bottomNavItems[index];
          final isSelected = _selectedBottomNav == index;
          final icon = item['icon'] as IconData;
          final iconColor = item['color'] as Color;
          return GestureDetector(
            onTap: () => _onNavTapped(index),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 250),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: isSelected
                    ? const Color(0xFFFFDC80)
                    : Colors.transparent,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    icon,
                    size: 26,
                    color: isSelected
                        ? iconColor
                        : const Color(0xFF636E72),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    item['title']!,
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: isSelected
                          ? FontWeight.w600
                          : FontWeight.w400,
                      color: isSelected
                          ? const Color(0xFF2D3436)
                          : const Color(0xFF636E72),
                    ),
                  ),
                ],
              ),
            ),
          );
        }),
      ),
    );
  }
}
