import 'dart:async';

import 'package:flutter/foundation.dart' as foundation;
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../services/api_service.dart';
import '../../services/cache_service.dart';
import '../../services/local_db_service.dart';
import '../../services/sync_service.dart';
import '../beranda/dashboard_screen.dart';

class AbsensiMuridScreen extends StatefulWidget {
  final String namaKelas;
  final String namaMapel;
  final int? classId;
  final int? mapelId;
  final int? jadwalId;

  const AbsensiMuridScreen({
    super.key,
    required this.namaKelas,
    required this.namaMapel,
    this.classId,
    this.mapelId,
    this.jadwalId,
  });

  @override
  State<AbsensiMuridScreen> createState() => _AbsensiMuridScreenState();
}

class _AbsensiMuridScreenState extends State<AbsensiMuridScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _animController;
  late Animation<double> _fadeIn;
  StreamSubscription<AppDataEvent>? _dataEventsSubscription;
  bool _isSaving = false;
  bool _isScopeRefreshInFlight = false;

  // Student data from API
  List<Map<String, dynamic>> _studentsData = [];
  List<String> _students = [];
  bool _isLoading = true;
  bool _isOfflineMode = false;

  // Logged-in user name for diinput_oleh
  int _userId = 0;
  String _userName = 'Admin';
  String _userRole = 'admin';

  // Edit mode — existing absensi
  bool _isEditMode = false;
  List<int?> _absensiIds = []; // absensi ID per student (null = belum ada)

  // === OFFLINE LOCK & OWNERSHIP ===
  bool _isLockedOffline =
      false; // true = sudah diabsen online, tidak bisa edit/batal offline
  String _absensiOwner = ''; // siapa yang input absensi ini
  bool _hasPendingOfflineAbsensi = false;
  String _scopeStatus = 'new';
  String _absensiInputRole = '';
  String _absensiInputName = '';
  String _absensiInputAtLabel = '';
  bool get _canModifyExistingAbsensi {
    if (!_isEditMode) return true;
    if (_isLockedOffline) return false;
    if (_userRole == 'admin') return true;
    if (_absensiOwner.isNotEmpty && _absensiOwner != _userName) return false;
    return true;
  }

  // Attendance status: 0=Hadir, 1=Sakit, 2=Izin, 3=Alpha
  late List<int> _attendanceStatus;
  late List<String?> _keteranganAlfa; // Reason for alfa per student

  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    _attendanceStatus = [];
    _keteranganAlfa = [];
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 500),
    );
    _fadeIn = Tween<double>(
      begin: 0.0,
      end: 1.0,
    ).animate(CurvedAnimation(parent: _animController, curve: Curves.easeOut));
    _animController.forward();
    _dataEventsSubscription = SyncService.dataEvents.listen(_handleDataEvent);
    _initAsync();
  }

  String _errorMessage = '';
  bool get _hasCompleteScheduleScope =>
      (widget.classId ?? 0) > 0 &&
      (widget.mapelId ?? 0) > 0; // Versi skripsi: jadwalId tidak wajib

  Future<void> _initAsync() async {
    await _loadUserName();
    await _loadStudents();
  }

  Future<void> _loadUserName() async {
    final prefs = await SharedPreferences.getInstance();
    final userId = prefs.getInt('user_id') ?? 0;
    final name = prefs.getString('user_name') ?? 'Admin';
    final role = prefs.getString('user_role') ?? 'admin';
    // Format: "Guru: Nama Guru" or "Admin: Nama Admin"
    final roleLabel = role == 'guru' ? 'Guru' : 'Admin';
    final displayName = name.isNotEmpty ? name : roleLabel;
    if (mounted) {
      setState(() {
        _userId = userId;
        _userName = '$roleLabel: $displayName';
        _userRole = role;
      });
    }
  }

  Future<void> _loadStudents() async {
    if (!_hasCompleteScheduleScope) {
      if (!mounted) return;
      setState(() {
        _isLoading = false;
        _errorMessage =
            'Jadwal absensi belum lengkap.\nBuka melalui jadwal/mapel yang sudah diatur admin agar kelas, mapel, dan jadwal terbaca.';
      });
      return;
    }

    if (!mounted) return;
    if (!mounted) return;
    setState(() {
      _isLoading = true;
      _errorMessage = '';
      _isOfflineMode = false;
      _isEditMode = false;
      _isLockedOffline = false;
      _absensiOwner = '';
      _hasPendingOfflineAbsensi = false;
      _scopeStatus = 'new';
      _absensiInputRole = '';
      _absensiInputName = '';
      _absensiInputAtLabel = '';
    });

    try {
      // === FALLBACK CHAIN: API → cache per-kelas → cache global ===
      // Saat guru offline, data siswa PASTI ada jika pernah online sebelumnya
      // (berkat pre-cache di dashboard)

      // Step 1: Fetch dari API dengan cache otomatis
      final cacheKey = 'siswa_kelas_${widget.namaKelas}';
      Map<String, dynamic>? response = await CacheService.fetchWithCache(
        cacheKey: cacheKey,
        apiFetch: () => ApiService.getSiswa(
          kelas: widget.namaKelas,
          classId: widget.classId,
          status: 'Aktif',
        ),
      );

      // Step 2: FALLBACK ke cache global siswa_list
      if (response == null) {
        final globalCache = await CacheService.get('siswa_list');
        if (globalCache != null) {
          final globalData = Map<String, dynamic>.from(globalCache as Map);
          globalData['_fromCache'] = true;
          // Filter by class name
          final allStudents = List<Map<String, dynamic>>.from(
            globalData['data'] ?? [],
          );
          final classStudents = allStudents
              .where((s) => s['kelas']?.toString() == widget.namaKelas)
              .toList();
          if (classStudents.isNotEmpty) {
            globalData['data'] = classStudents;
            response = globalData;
          }
        }
      }

      if (!mounted) return;

      if (response != null && response['success'] == true) {
        final data = List<Map<String, dynamic>>.from(response['data'] ?? []);
        final fromCache = response['_fromCache'] == true;

        if (data.isEmpty) {
          setState(() {
            _errorMessage =
                'Belum ada data siswa untuk kelas ${widget.namaKelas}';
            _isLoading = false;
          });
        } else {
          setState(() {
            _studentsData = data;
            _students = data
                .map((s) => (s['nama'] as String).toUpperCase())
                .toList();
            _attendanceStatus = List.filled(_students.length, 0);
            _keteranganAlfa = List.filled(_students.length, null);
            _absensiIds = List.filled(_students.length, null);
            _isOfflineMode = fromCache;
            _isLoading = false;
          });

          // Selalu cek existing absensi (online: API, offline: cache)
          await _loadExistingAbsensi();
        }
      } else {
        setState(() {
          _errorMessage =
              'Tidak dapat memuat data siswa.\n\n'
              '💡 Tips agar bisa absen offline:\n'
              '1. Buka app saat online minimal 1x\n'
              '2. Dashboard akan otomatis menyimpan data siswa\n'
              '3. Setelah itu, absen offline akan selalu tersedia';
          _isLoading = false;
        });
      }
    } catch (e) {
      // === SAFETY NET: Unexpected error ===
      if (mounted) {
        setState(() {
          _errorMessage =
              'Terjadi kesalahan saat memuat data.\n'
              'Pastikan Anda pernah membuka app saat online.';
          _isLoading = false;
        });
      }
    }
  }

  Map<String, String> _parseInputOwner(String owner) {
    final normalized = owner.trim();
    if (normalized.isEmpty) {
      return const {'role': '', 'name': ''};
    }

    final separatorIndex = normalized.indexOf(':');
    if (separatorIndex <= 0) {
      return {'role': '', 'name': normalized};
    }

    return {
      'role': normalized.substring(0, separatorIndex).trim(),
      'name': normalized.substring(separatorIndex + 1).trim(),
    };
  }

  String _formatInputAtLabel(dynamic rawValue) {
    final raw = rawValue?.toString().trim() ?? '';
    if (raw.isEmpty) return '';

    final parsed = DateTime.tryParse(raw);
    if (parsed == null) {
      return raw;
    }

    final local = parsed.toLocal();
    final hour = local.hour.toString().padLeft(2, '0');
    final minute = local.minute.toString().padLeft(2, '0');
    final second = local.second.toString().padLeft(2, '0');
    final day = local.day.toString().padLeft(2, '0');
    final month = local.month.toString().padLeft(2, '0');
    return '$day/$month/${local.year} $hour:$minute:$second';
  }

  void _applyInputMetadata({required String owner, String? inputAtLabel}) {
    final meta = _parseInputOwner(owner);
    _absensiInputRole = meta['role'] ?? '';
    _absensiInputName = meta['name'] ?? '';
    _absensiInputAtLabel = inputAtLabel?.trim() ?? '';
  }

  String _scopeStatusLabel() {
    switch (_scopeStatus) {
      case 'pending_sync':
        return 'Pending sync';
      case 'failed_sync':
        return 'Pending retry';
      case 'locked':
        return 'Locked offline';
      case 'editable_online_only':
        return 'Final server';
      case 'synced':
        return 'Completed';
      default:
        return 'Baru';
    }
  }

  /// Load existing absensi for today + this class to enable edit mode
  /// Works online (API fetch) AND offline (cached completed data)
  Future<void> _loadExistingAbsensi() async {
    if (_isScopeRefreshInFlight) return;
    _isScopeRefreshInFlight = true;
    final today = DateTime.now().toIso8601String().split('T')[0];
    final online = await SyncService.isOnline();

    if (!online) {
      if (mounted && !_isOfflineMode) {
        setState(() => _isOfflineMode = true);
      }
      final hasPending = await _loadOfflinePendingAbsensi(today);
      if (!hasPending) {
        await _checkOfflineCompleted();
      }
      _isScopeRefreshInFlight = false;
      return;
    }

    try {
      final result = await ApiService.getAbsensi(
        tanggal: today,
        kelas: widget.namaKelas,
        classId: widget.classId,
        mapel: widget.namaMapel,
        mapelId: widget.mapelId,
        jadwalId: widget.jadwalId,
      );

      if (!mounted) {
        _isScopeRefreshInFlight = false;
        return;
      }
      if (result['success'] == true) {
        if (_isOfflineMode) {
          setState(() => _isOfflineMode = false);
        }
        final absensiList = List<Map<String, dynamic>>.from(
          result['data'] ?? [],
        );

        if (absensiList.isNotEmpty) {
          await CacheService.save(_scopeCacheKey(today), {
            'tanggal': today,
            'kelas': widget.namaKelas,
            'mapel': widget.namaMapel,
            'source': 'live',
            'data': absensiList,
          });
          _applyExistingAbsensi(absensiList, isOnline: true);
          _isScopeRefreshInFlight = false;
          return;
        }

        final hasPending = await _loadOfflinePendingAbsensi(today);
        if (!hasPending && mounted) {
          setState(() {
            _isOfflineMode = false;
            _isEditMode = false;
            _isLockedOffline = false;
            _absensiOwner = '';
            _absensiInputRole = '';
            _absensiInputName = '';
            _absensiInputAtLabel = '';
            _hasPendingOfflineAbsensi = false;
            _scopeStatus = 'new';
            _absensiIds = List.filled(_students.length, null);
          });
        }
        await CacheService.delete(_scopeCacheKey(today));
        _isScopeRefreshInFlight = false;
        return;
      }
    } catch (_) {
      if (mounted && !_isOfflineMode) {
        setState(() => _isOfflineMode = true);
      }
      final hasPending = await _loadOfflinePendingAbsensi(today);
      if (!hasPending) {
        await _checkOfflineCompleted();
      }
      _isScopeRefreshInFlight = false;
      return;
    }

    final hasPending = await _loadOfflinePendingAbsensi(today);
    if (!hasPending) {
      await _checkOfflineCompleted();
    }
    _isScopeRefreshInFlight = false;
  }

  Future<bool> _loadOfflinePendingAbsensi(String today) async {
    try {
      final pendingList = await LocalDbService.getPendingByScope(
        tanggal: today,
        kelas: widget.namaKelas,
        mapel: widget.namaMapel,
        classId: widget.classId,
        mapelId: widget.mapelId,
        jadwalId: widget.jadwalId,
        actorUserId: _userId > 0 ? _userId : null,
      );

      if (pendingList.isEmpty) return false;
      if (!mounted) return true;

      final hasFailed = pendingList.any(
        (row) => row['sync_status']?.toString() == 'failed',
      );
      _applyExistingAbsensi(
        pendingList,
        isOnline: false,
        isPending: true,
        scopeStatus: hasFailed ? 'failed_sync' : 'pending_sync',
      );
      return true;
    } catch (_) {
      return false;
    }
  }

  void debugPrint(String? message, {int? wrapWidth}) {
    if (foundation.kDebugMode) {
      foundation.debugPrint(message, wrapWidth: wrapWidth);
    }
  }

  /// Cek di cache apakah kelas+mapel ini sudah diabsen online
  /// Jika ya → masuk LOCKED mode (tidak bisa edit/batal di offline)
  Future<void> _checkOfflineCompleted() async {
    debugPrint('═══════════════════════════════════════════');
    debugPrint('🔒 CHECK OFFLINE COMPLETED');
    debugPrint('   kelas="${widget.namaKelas}" mapel="${widget.namaMapel}"');
    debugPrint('   _isOfflineMode=$_isOfflineMode');
    try {
      final today = DateTime.now().toIso8601String().split('T')[0];
      final scopeCache = await CacheService.get(_scopeCacheKey(today));
      if (scopeCache is Map<String, dynamic> &&
          scopeCache['tanggal'] == today &&
          scopeCache['kelas'] == widget.namaKelas &&
          scopeCache['mapel'] == widget.namaMapel &&
          scopeCache['source'] == 'live') {
        final scopeData = List<Map<String, dynamic>>.from(
          scopeCache['data'] ?? const [],
        );
        if (scopeData.isNotEmpty) {
          _applyExistingAbsensi(
            scopeData,
            isOnline: false,
            scopeStatus: 'locked',
          );
          if (mounted) {
            setState(() {
              _isLockedOffline = true;
              _hasPendingOfflineAbsensi = false;
            });
          }
          return;
        }
      }

      final cached = await CacheService.get(_completedAbsensiCacheKey());
      debugPrint('   cached = ${cached != null ? "EXISTS" : "NULL"}');
      if (cached == null) {
        debugPrint('   ❌ No cache found — NOT locking');
        return;
      }

      debugPrint(
        '   cached tanggal = "${cached['tanggal']}" vs today = "$today"',
      );
      debugPrint('   cached source = "${cached['source']}"');
      if (cached['tanggal'] != today) {
        debugPrint('   ❌ Date mismatch — NOT locking');
        return;
      }
      if ((cached['source']?.toString() ?? '') != 'live') {
        debugPrint('   ❌ Cache is not from live server data — NOT locking');
        return;
      }

      final perKelas = List<dynamic>.from(cached['per_kelas'] ?? []);
      debugPrint('   per_kelas count = ${perKelas.length}');
      for (int i = 0; i < perKelas.length; i++) {
        final k = perKelas[i];
        debugPrint(
          '     [$i] kelas="${k['kelas']}" mapel="${k['mapel']}" '
          'diinput_oleh="${k['diinput_oleh']}"',
        );
      }

      for (final kelas in perKelas) {
        final kelasName = kelas['kelas']?.toString() ?? '';
        final mapelName = kelas['mapel']?.toString() ?? '-';
        if (kelasName == widget.namaKelas && mapelName == widget.namaMapel) {
          // === KELAS INI SUDAH DIABSEN ONLINE ===
          final owner = kelas['diinput_oleh']?.toString() ?? 'Admin';
          final inputAtLabel = kelas['waktu']?.toString() ?? '';
          debugPrint('   ✅ MATCH FOUND — LOCKING! owner="$owner"');
          if (mounted) {
            setState(() {
              _isEditMode = true;
              _isLockedOffline = true;
              _absensiOwner = owner;
              _applyInputMetadata(owner: owner, inputAtLabel: inputAtLabel);
              _hasPendingOfflineAbsensi = false;
              _scopeStatus = 'locked';
            });
            // SnackBar dihapus — cukup banner gembok di atas saja
          }
          debugPrint('═══════════════════════════════════════════');
          return;
        }
      }
      debugPrint('   ❌ No match — this class not in completed cache');
      debugPrint('═══════════════════════════════════════════');
    } catch (e) {
      debugPrint('   ❌ ERROR: $e');
      debugPrint('═══════════════════════════════════════════');
    }
  }

  /// Apply existing absensi data to student list
  void _applyExistingAbsensi(
    List<Map<String, dynamic>> absensiList, {
    required bool isOnline,
    bool isPending = false,
    String? scopeStatus,
  }) {
    final statusMap = {'Hadir': 0, 'Sakit': 1, 'Izin': 2, 'Alfa': 3};
    bool hasMatch = false;
    String owner = '';
    String inputAtLabel = '';

    if (!isOnline) {
      _absensiIds = List.filled(_students.length, null);
    }

    for (int i = 0; i < _studentsData.length; i++) {
      final studentId = _studentsData[i]['id'];
      final match = absensiList.firstWhere(
        (a) => a['siswa_id'] == studentId,
        orElse: () => <String, dynamic>{},
      );
      if (match.isNotEmpty) {
        _attendanceStatus[i] = statusMap[match['status']?.toString()] ?? 0;
        if (isOnline) {
          _absensiIds[i] = match['id'] as int?;
        }
        if (owner.isEmpty) {
          owner = match['diinput_oleh']?.toString() ?? '';
          inputAtLabel = _formatInputAtLabel(
            match['created_at'] ?? match['synced_at'] ?? match['waktu'],
          );
        }
        hasMatch = true;
      }
    }

    if (hasMatch && mounted) {
      setState(() {
        _isEditMode = true;
        _isLockedOffline = false;
        _absensiOwner = owner;
        _applyInputMetadata(owner: owner, inputAtLabel: inputAtLabel);
        _hasPendingOfflineAbsensi = isPending;
        _scopeStatus =
            scopeStatus ??
            (isPending ? 'pending_sync' : 'editable_online_only');
      });
    }
  }

  @override
  void dispose() {
    _animController.dispose();
    _dataEventsSubscription?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  String _completedAbsensiCacheKey() {
    return CacheService.userScopedKey(
      'completed_absensi_today',
      role: _userRole,
      userId: _userId,
    );
  }

  String _scopeCacheKey(String tanggal) {
    final kelas = widget.namaKelas.replaceAll(' ', '_').toLowerCase();
    final mapel = widget.namaMapel.replaceAll(' ', '_').toLowerCase();
    return CacheService.userScopedKey(
      'absensi_scope_final_${tanggal}_${kelas}_$mapel',
      role: _userRole,
      userId: _userId,
    );
  }

  void _handleDataEvent(AppDataEvent event) {
    if (!mounted || _isSaving) return;
    if (event.topic == SyncTopics.absensi ||
        event.topic == SyncTopics.connectivity) {
      unawaited(_loadExistingAbsensi());
      return;
    }
    if (event.topic == SyncTopics.heartbeat &&
        (_hasPendingOfflineAbsensi || _isLockedOffline || _isOfflineMode)) {
      unawaited(_loadExistingAbsensi());
    }
  }

  Widget _buildEditModeInfo() {
    final message = _isLockedOffline
        ? 'Sudah tersimpan di server. Sambungkan internet untuk edit.'
        : !_canModifyExistingAbsensi
        ? 'Diabsen oleh $_absensiOwner dan hanya bisa dipantau.'
        : _userRole == 'admin'
        ? 'Mode pantau & edit admin aktif untuk absensi ini.'
        : _hasPendingOfflineAbsensi
        ? 'Pending tersimpan. Anda bisa perbarui atau batalkan.'
        : 'Mode Edit - absensi sudah diinput hari ini.';

    final messageColor = _isLockedOffline
        ? const Color(0xFFC62828)
        : !_canModifyExistingAbsensi
        ? const Color(0xFFE65100)
        : const Color(0xFF1565C0);
    final inputLabel = _absensiInputName.isNotEmpty
        ? _absensiInputRole.isNotEmpty
              ? '$_absensiInputRole: $_absensiInputName'
              : _absensiInputName
        : _absensiOwner;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          message,
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w600,
            color: messageColor,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          'Input oleh: ${inputLabel.isNotEmpty ? inputLabel : '-'}',
          style: const TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.w600,
            color: Color(0xFF2D3436),
          ),
        ),
        Text(
          _absensiInputAtLabel.isNotEmpty
              ? 'Status: ${_scopeStatusLabel()} • Waktu input: $_absensiInputAtLabel'
              : 'Status: ${_scopeStatusLabel()}',
          style: const TextStyle(fontSize: 10, color: Color(0xFF636E72)),
        ),
      ],
    );
  }

  List<int> get _filteredIndices {
    if (_searchQuery.isEmpty) {
      return List.generate(_students.length, (i) => i);
    }
    return List.generate(_students.length, (i) => i)
        .where(
          (i) =>
              _students[i].toLowerCase().contains(_searchQuery.toLowerCase()),
        )
        .toList();
  }

  Color _statusColor(int status) {
    switch (status) {
      case 0:
        return const Color(0xFF138F81); // hijau
      case 1:
        return const Color(0xFFFFB74D); // oranye
      case 2:
        return const Color(0xFF42A5F5); // biru
      case 3:
        return const Color(0xFFE65100); // merah
      default:
        return const Color(0xFF138F81);
    }
  }

  Future<bool> _isServerReachable() async {
    final online = await SyncService.isOnline();
    if (!online) return false;
    return ApiService.testConnection();
  }

  Future<void> _handleSave() async {
    if (_isSaving || _studentsData.isEmpty) return;
    if (!_hasCompleteScheduleScope) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Absensi tidak bisa disimpan karena jadwal belum lengkap. Pilih jadwal dari menu admin/mapel.',
          ),
          backgroundColor: Color(0xFFE65100),
        ),
      );
      return;
    }
    final isEditingFinalServerData = _isEditMode && !_hasPendingOfflineAbsensi;
    if (isEditingFinalServerData) {
      final serverReachable = await _isServerReachable();
      if (!mounted) return;
      if (!serverReachable) {
        if (mounted) {
          setState(() {
            _isLockedOffline = true;
            _scopeStatus = 'locked';
          });
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text(
                'Data final server sedang locked karena perangkat offline. Ubah data ini hanya saat online.',
              ),
              backgroundColor: Color(0xFFE65100),
            ),
          );
        }
        return;
      }
    }
    // === PERMISSION CHECK ===
    if (!_canModifyExistingAbsensi && _isEditMode) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              _isLockedOffline
                  ? '🔒 Data server ini perlu koneksi untuk diedit'
                  : '🔒 Absensi ini diinput oleh $_absensiOwner',
            ),
            backgroundColor: const Color(0xFFE65100),
          ),
        );
      }
      return;
    }
    if (!mounted) return;
    setState(() => _isSaving = true);

    final wasEditMode = _isEditMode;
    final wasPendingOffline = _hasPendingOfflineAbsensi;

    final statusMap = {0: 'Hadir', 1: 'Sakit', 2: 'Izin', 3: 'Alfa'};
    final today = DateTime.now().toIso8601String().split('T')[0];
    int online = 0, offline = 0, conflict = 0, updated = 0;

    // Count attendance
    int hadir = 0, sakit = 0, izin = 0, alpha = 0;
    for (final s in _attendanceStatus) {
      switch (s) {
        case 0:
          hadir++;
          break;
        case 1:
          sakit++;
          break;
        case 2:
          izin++;
          break;
        case 3:
          alpha++;
          break;
      }
    }

    var bulkHandled = false;
    if (!wasEditMode && !wasPendingOffline) {
      try {
        final serverOk = await ApiService.testConnection();
        if (serverOk) {
          final bulkPayload = List<Map<String, dynamic>>.generate(
            _studentsData.length,
            (i) {
              final newStatus = statusMap[_attendanceStatus[i]] ?? 'Hadir';
              return {
                'siswa_id': _studentsData[i]['id'] as int,
                'tanggal': today,
                'status': newStatus,
                'keterangan': newStatus == 'Alfa'
                    ? (_keteranganAlfa[i] ?? '')
                    : '',
                'kelas': widget.namaKelas,
                'class_id': widget.classId,
                'mapel': widget.namaMapel,
                'mapel_id': widget.mapelId,
                'jadwal_id': widget.jadwalId,
                'diinput_oleh': _userName,
                'actor_user_id': _userId > 0 ? _userId : null,
                'diinput_via': 'online',
              };
            },
          );
          final response = await ApiService.createAbsensiBulk(bulkPayload);
          final createdRows = response['created'] is List
              ? response['created'] as List
              : const [];
          final updatedRows = response['updated'] is List
              ? response['updated'] as List
              : const [];
          final failedRows = response['failed'] is List
              ? response['failed'] as List
              : const [];
          online = createdRows.length;
          updated = updatedRows.length;
          conflict = failedRows.length;
          bulkHandled = true;
        }
      } catch (_) {
        bulkHandled = false;
      }
    }

    if (!bulkHandled) {
      for (int i = 0; i < _studentsData.length; i++) {
        final newStatus = statusMap[_attendanceStatus[i]] ?? 'Hadir';
        final keterangan = newStatus == 'Alfa'
            ? (_keteranganAlfa[i] ?? '')
            : '';

        if (_isEditMode && wasPendingOffline) {
          if (i == 0) {
            await LocalDbService.deletePendingByScope(
              tanggal: today,
              kelas: widget.namaKelas,
              mapel: widget.namaMapel,
              classId: widget.classId,
              mapelId: widget.mapelId,
              jadwalId: widget.jadwalId,
              actorUserId: _userId > 0 ? _userId : null,
            );
          }
          final pendingId = await LocalDbService.insertAbsensiPending({
            'siswa_id': _studentsData[i]['id'] as int,
            'tanggal': today,
            'status': newStatus,
            'keterangan': keterangan,
            'kelas': widget.namaKelas,
            'class_id': widget.classId,
            'mapel': widget.namaMapel,
            'mapel_id': widget.mapelId,
            'jadwal_id': widget.jadwalId,
            'diinput_oleh': _userName,
            'actor_user_id': _userId > 0 ? _userId : null,
          });
          pendingId < 0 ? conflict++ : updated++;
        } else if (_isEditMode && _absensiIds[i] != null) {
          // UPDATE existing absensi
          try {
            await ApiService.updateAbsensi(_absensiIds[i]!, {
              'status': newStatus,
              'keterangan': keterangan,
              'diinput_oleh': _userName,
              'actor_role': _userRole,
              'actor_name': _userName,
              'actor_user_id': _userId > 0 ? _userId : null,
            });
            updated++;
          } catch (_) {
            conflict++;
          }
        } else {
          // CREATE new absensi via SyncService (supports offline)
          final result = await SyncService.inputAbsensi(
            siswaId: _studentsData[i]['id'] as int,
            tanggal: today,
            status: newStatus,
            kelas: widget.namaKelas,
            classId: widget.classId,
            mapel: widget.namaMapel,
            mapelId: widget.mapelId,
            jadwalId: widget.jadwalId,
            keterangan: keterangan,
            diinputOleh: _userName,
            actorUserId: _userId > 0 ? _userId : null,
          );
          if (result.mode == 'online') {
            online++;
          } else if (result.mode == 'offline') {
            offline++;
          } else {
            conflict++;
          }
        }
      }
    }

    if (!mounted) return;
    final savedCount = online + offline + updated;
    setState(() {
      _isSaving = false;
      if (savedCount > 0) {
        // === SETELAH SIMPAN → MASUK EDIT MODE ===
        // Guru tetap di halaman absensi, bisa ubah status lalu "Perbarui"
        // Guru bisa "Batal Absen" untuk reset dari awal
        // Guru kembali ke dashboard hanya jika tekan tombol back sendiri
        _isEditMode = true;
        _absensiOwner = _userName;
        _applyInputMetadata(
          owner: _userName,
          inputAtLabel: _formatInputAtLabel(DateTime.now().toIso8601String()),
        );
        _scopeStatus = offline > 0
            ? 'pending_sync'
            : online > 0
            ? 'synced'
            : _scopeStatus;
      }
    });

    // Signal dashboard to refresh when user returns
    DashboardScreen.needsRefresh = true;

    // Determine mode badge (instant — no async)
    String modeBadge = '';
    if (wasEditMode) {
      modeBadge = '✏️ $updated data diperbarui';
    } else if (online > 0 && offline == 0) {
      modeBadge = '✅ Online';
    } else if (offline > 0 && online == 0) {
      modeBadge = '⏳ Pending Offline';
    } else if (offline > 0 && online > 0) {
      modeBadge = '⚡ $online online, $offline pending';
    }
    if (conflict > 0) modeBadge += '\n⚠️ $conflict gagal/sudah ada';

    // === OPTIMASI: Show dialog LANGSUNG, notifikasi & load IDs di background ===
    // Sebelumnya: await notifikasi + await loadExistingAbsensi → dialog lambat

    // Fire notifications in background (jangan await)
    if (wasEditMode) {
      SyncService.showOnlineSaveNotification(widget.namaKelas, updated);
    } else if (online > 0 && offline == 0) {
      SyncService.showOnlineSaveNotification(widget.namaKelas, online);
    } else if (offline > 0) {
      SyncService.showOfflineSaveNotification(widget.namaKelas, offline);
    }

    // Load absensi IDs in background AFTER dialog (jangan await sebelum dialog)
    if (!wasEditMode && online > 0) {
      _loadExistingAbsensi(); // Background — no await
    }

    _loadExistingAbsensi();
    if (wasPendingOffline) {
      SyncService.syncPendingAbsensi();
    }
    unawaited(
      SyncService.notifyDataChanged(
        SyncTopics.absensi,
        message: '${widget.namaKelas} • ${widget.namaMapel} diperbarui',
      ),
    );

    if (!mounted) return;
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(
          children: [
            Icon(
              conflict > 0 ? Icons.warning_rounded : Icons.check_circle_rounded,
              color: conflict > 0
                  ? const Color(0xFFE65100)
                  : const Color(0xFF138F81),
              size: 28,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                wasEditMode
                    ? 'Absensi Diperbarui!'
                    : conflict > 0
                    ? 'Absensi Tersimpan (Ada Konflik)'
                    : 'Absensi Disimpan!',
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF2D3436),
                ),
              ),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '${widget.namaKelas} – ${widget.namaMapel}',
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: Color(0xFF138F81),
              ),
            ),
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: wasEditMode
                    ? const Color(0xFFE3F2FD)
                    : offline > 0
                    ? const Color(0xFFFFF3E0)
                    : const Color(0xFFE8F5E9),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                modeBadge,
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: wasEditMode
                      ? const Color(0xFF1565C0)
                      : offline > 0
                      ? const Color(0xFFE65100)
                      : const Color(0xFF2E7D32),
                ),
              ),
            ),
            const SizedBox(height: 12),
            _buildSummaryRow('Hadir', hadir, const Color(0xFF138F81)),
            _buildSummaryRow('Sakit', sakit, const Color(0xFFFFB74D)),
            _buildSummaryRow('Izin', izin, const Color(0xFF42A5F5)),
            _buildSummaryRow('Alpha', alpha, const Color(0xFFE65100)),
            const Divider(height: 20),
            _buildSummaryRow(
              'Total',
              _students.length,
              const Color(0xFF2D3436),
            ),
            const SizedBox(height: 8),
            Text(
              'Gunakan tombol "Batal" untuk reset,\natau ubah status lalu tekan "Perbarui".',
              style: const TextStyle(
                fontSize: 10,
                color: Color(0xFF636E72),
                fontStyle: FontStyle.italic,
              ),
            ),
          ],
        ),
        actions: [
          // === TOMBOL OK — TUTUP DIALOG, TETAP DI HALAMAN ABSEN ===
          // Guru TIDAK diarahkan kemana-mana, tetap di absensi screen
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: () {
                Navigator.of(ctx).pop(); // Tutup dialog saja
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF138F81),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
              ),
              child: const Text(
                'OK',
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// Batal absensi — delete all existing absensi for today
  Future<void> _handleBatalAbsensi() async {
    // === PERMISSION CHECK ===
    if (!_canModifyExistingAbsensi) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              _isLockedOffline
                  ? '🔒 Data server ini perlu koneksi untuk dibatalkan'
                  : '🔒 Absensi diinput oleh $_absensiOwner — tidak bisa batal',
            ),
            backgroundColor: const Color(0xFFE65100),
          ),
        );
      }
      return;
    }

    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Row(
          children: [
            Icon(Icons.warning_rounded, color: Color(0xFFE65100), size: 28),
            SizedBox(width: 10),
            Text(
              'Batalkan Absensi?',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: Color(0xFF2D3436),
              ),
            ),
          ],
        ),
        content: Text(
          'Semua data absensi ${widget.namaKelas} hari ini akan dihapus.\n\nAnda bisa menginput ulang setelah dibatalkan.',
          style: const TextStyle(fontSize: 13, color: Color(0xFF636E72)),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text(
              'Tidak',
              style: TextStyle(color: Color(0xFF636E72)),
            ),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFE65100),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
            child: const Text('Ya, Batalkan'),
          ),
        ],
      ),
    );

    if (confirm != true || !mounted) return;

    final isEditingFinalServerData = _isEditMode && !_hasPendingOfflineAbsensi;
    if (isEditingFinalServerData) {
      final serverReachable = await _isServerReachable();
      if (!serverReachable) {
        if (mounted) {
          setState(() {
            _isLockedOffline = true;
            _scopeStatus = 'locked';
          });
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text(
                'Data final server tidak bisa dibatalkan saat offline. Sambungkan internet terlebih dahulu.',
              ),
              backgroundColor: Color(0xFFE65100),
            ),
          );
        }
        return;
      }
    }

    setState(() => _isSaving = true);

    int deleted = 0, failed = 0;
    if (_hasPendingOfflineAbsensi) {
      try {
        deleted += await LocalDbService.deletePendingByScope(
          tanggal: DateTime.now().toIso8601String().split('T')[0],
          kelas: widget.namaKelas,
          mapel: widget.namaMapel,
          classId: widget.classId,
          mapelId: widget.mapelId,
          jadwalId: widget.jadwalId,
          actorUserId: _userId > 0 ? _userId : null,
        );
      } catch (_) {
        failed++;
      }
    }

    for (int i = 0; i < _absensiIds.length; i++) {
      if (_absensiIds[i] != null) {
        try {
          await ApiService.deleteAbsensi(
            _absensiIds[i]!,
            actorRole: _userRole,
            actorName: _userName,
            actorUserId: _userId > 0 ? _userId : null,
          );
          deleted++;
        } catch (_) {
          failed++;
        }
      }
    }

    setState(() {
      _isSaving = false;
      _isEditMode = false;
      _isLockedOffline = false;
      _absensiOwner = '';
      _absensiInputRole = '';
      _absensiInputName = '';
      _absensiInputAtLabel = '';
      _hasPendingOfflineAbsensi = false;
      _scopeStatus = 'new';
      _attendanceStatus = List.filled(_students.length, 0);
      _keteranganAlfa = List.filled(_students.length, null);
      _absensiIds = List.filled(_students.length, null);
    });
    await CacheService.delete(
      _scopeCacheKey(DateTime.now().toIso8601String().split('T')[0]),
    );

    DashboardScreen.needsRefresh = true;
    unawaited(
      SyncService.notifyDataChanged(
        SyncTopics.absensi,
        message: '${widget.namaKelas} • ${widget.namaMapel} dibatalkan',
      ),
    );

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            failed > 0
                ? '$deleted dihapus, $failed gagal'
                : '✅ $deleted absensi dibatalkan — silakan input ulang',
          ),
          backgroundColor: failed > 0
              ? const Color(0xFFE65100)
              : const Color(0xFF138F81),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
        ),
      );
    }
  }

  Widget _buildSummaryRow(String label, int count, Color color) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: color,
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Text(
              '$count',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: color,
              ),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final filteredIdx = _filteredIndices;

    return Scaffold(
      backgroundColor: const Color(0xFFFFDC80),
      body: SafeArea(
        child: FadeTransition(
          opacity: _fadeIn,
          child: Column(
            children: [
              // ===== PROFILE BAR =====
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 12,
                  ),
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
                        child: const Icon(
                          Icons.fact_check_rounded,
                          color: Color(0xFF138F81),
                          size: 28,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                const Text(
                                  'Absensi',
                                  style: TextStyle(
                                    fontSize: 18,
                                    fontWeight: FontWeight.w700,
                                    color: Color(0xFF2D3436),
                                  ),
                                ),
                                if (_isOfflineMode) ...[
                                  const SizedBox(width: 6),
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 6,
                                      vertical: 2,
                                    ),
                                    decoration: BoxDecoration(
                                      color: const Color(
                                        0xFFE65100,
                                      ).withValues(alpha: 0.12),
                                      borderRadius: BorderRadius.circular(6),
                                    ),
                                    child: const Text(
                                      'Offline',
                                      style: TextStyle(
                                        fontSize: 8,
                                        fontWeight: FontWeight.w700,
                                        color: Color(0xFFE65100),
                                      ),
                                    ),
                                  ),
                                ],
                              ],
                            ),
                            Text(
                              '${widget.namaKelas} – ${widget.namaMapel}',
                              style: const TextStyle(
                                fontSize: 11,
                                color: Color(0xFF636E72),
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ],
                        ),
                      ),
                      IconButton(
                        onPressed: () => Navigator.pop(context),
                        icon: const Icon(
                          Icons.arrow_back_ios_rounded,
                          size: 20,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12),

              // ===== EDIT MODE BANNER =====
              if (_isEditMode)
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 8,
                    ),
                    decoration: BoxDecoration(
                      color: _isLockedOffline
                          ? const Color(
                              0xFFFFCDD2,
                            ) // Merah muda = locked offline
                          : !_canModifyExistingAbsensi
                          ? const Color(0xFFFFE0B2) // Oranye = bukan punya
                          : const Color(0xFFE3F2FD), // Biru = bisa edit
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: _isLockedOffline
                            ? const Color(0xFFE57373)
                            : !_canModifyExistingAbsensi
                            ? const Color(0xFFFFB74D)
                            : const Color(0xFF42A5F5),
                      ),
                    ),
                    child: Row(
                      children: [
                        Icon(
                          _isLockedOffline
                              ? Icons.lock_rounded
                              : !_canModifyExistingAbsensi
                              ? Icons.block_rounded
                              : Icons.edit_rounded,
                          size: 16,
                          color: _isLockedOffline
                              ? const Color(0xFFC62828)
                              : !_canModifyExistingAbsensi
                              ? const Color(0xFFE65100)
                              : const Color(0xFF1565C0),
                        ),
                        const SizedBox(width: 8),
                        Expanded(child: _buildEditModeInfo()),
                        // Batal button — hanya tampil jika punya akses
                        if (_canModifyExistingAbsensi)
                          GestureDetector(
                            onTap: _handleBatalAbsensi,
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 4,
                              ),
                              decoration: BoxDecoration(
                                color: const Color(0xFFE65100),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: const Text(
                                'Batal',
                                style: TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w700,
                                  color: Colors.white,
                                ),
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
              if (_isEditMode) const SizedBox(height: 8),

              // ===== SEARCH BAR =====
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(21),
                  ),
                  child: Row(
                    children: [
                      const Icon(
                        Icons.search_rounded,
                        size: 22,
                        color: Color(0xFF636E72),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: TextField(
                          controller: _searchController,
                          onChanged: (val) =>
                              setState(() => _searchQuery = val),
                          decoration: const InputDecoration(
                            hintText: 'Cari Nama Siswa/Santri...',
                            border: InputBorder.none,
                            hintStyle: TextStyle(
                              fontSize: 13,
                              color: Color(0xFF636E72),
                            ),
                          ),
                          style: const TextStyle(fontSize: 13),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12),

              // ===== TABLE HEADER =====
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 10,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0xFF138F81),
                    borderRadius: const BorderRadius.only(
                      topLeft: Radius.circular(14),
                      topRight: Radius.circular(14),
                    ),
                  ),
                  child: const Row(
                    children: [
                      SizedBox(
                        width: 30,
                        child: Text(
                          'No',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: Colors.white,
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ),
                      SizedBox(width: 4),
                      Expanded(
                        child: Text(
                          'Nama Siswa/Santri',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: Colors.white,
                          ),
                        ),
                      ),
                      SizedBox(
                        width: 130,
                        child: Text(
                          'Absensi',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: Colors.white,
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              // ===== TABLE BODY =====
              Expanded(
                child: Container(
                  margin: const EdgeInsets.symmetric(horizontal: 16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: const BorderRadius.only(
                      bottomLeft: Radius.circular(14),
                      bottomRight: Radius.circular(14),
                    ),
                  ),
                  child: _isLoading
                      ? const Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              CircularProgressIndicator(
                                color: Color(0xFF138F81),
                              ),
                              SizedBox(height: 12),
                              Text(
                                'Memuat data siswa...',
                                style: TextStyle(
                                  fontSize: 13,
                                  color: Color(0xFF636E72),
                                ),
                              ),
                            ],
                          ),
                        )
                      : _errorMessage.isNotEmpty
                      ? Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Icon(
                                Icons.cloud_off_rounded,
                                size: 48,
                                color: Color(0xFFE65100),
                              ),
                              const SizedBox(height: 12),
                              Text(
                                _errorMessage,
                                textAlign: TextAlign.center,
                                style: const TextStyle(
                                  fontSize: 13,
                                  color: Color(0xFF636E72),
                                ),
                              ),
                              const SizedBox(height: 16),
                              ElevatedButton.icon(
                                onPressed: _loadStudents,
                                icon: const Icon(
                                  Icons.refresh_rounded,
                                  size: 18,
                                ),
                                label: const Text('Coba Lagi'),
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: const Color(0xFF138F81),
                                  foregroundColor: Colors.white,
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        )
                      : ListView.builder(
                          physics: const BouncingScrollPhysics(),
                          itemCount: filteredIdx.length,
                          itemBuilder: (context, listIndex) {
                            final studentIdx = filteredIdx[listIndex];
                            return _buildStudentRow(studentIdx, listIndex);
                          },
                        ),
                ),
              ),
              const SizedBox(height: 12),

              // ===== SIMPAN BUTTON =====
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                child: SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: (_isSaving || !_canModifyExistingAbsensi)
                        ? null
                        : _handleSave,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF138F81),
                      disabledBackgroundColor: const Color(
                        0xFF138F81,
                      ).withValues(alpha: 0.5),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(20),
                      ),
                      elevation: 4,
                    ),
                    child: _isSaving
                        ? const Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(
                                  color: Colors.white,
                                  strokeWidth: 2,
                                ),
                              ),
                              SizedBox(width: 10),
                              Text(
                                'Menyimpan...',
                                style: TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ],
                          )
                        : Text(
                            !_canModifyExistingAbsensi && _isEditMode
                                ? (_isLockedOffline
                                      ? '🔒 Perlu Koneksi'
                                      : '🔒 Tidak bisa edit')
                                : _isEditMode
                                ? 'Perbarui Absensi'
                                : 'Simpan Absensi',
                            style: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStudentRow(int studentIdx, int listIndex) {
    final isEven = listIndex % 2 == 0;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
      decoration: BoxDecoration(
        color: isEven ? Colors.white : const Color(0xFFF5F5F5),
        border: Border(
          bottom: BorderSide(
            color: const Color(0xFF000000).withValues(alpha: 0.06),
            width: 0.5,
          ),
        ),
      ),
      child: Row(
        children: [
          // No
          SizedBox(
            width: 30,
            child: Text(
              '${studentIdx + 1}',
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: Color(0xFF2D3436),
              ),
              textAlign: TextAlign.center,
            ),
          ),
          const SizedBox(width: 4),

          // Nama
          Expanded(
            child: Text(
              _students[studentIdx],
              style: const TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w600,
                color: Color(0xFF2D3436),
              ),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          const SizedBox(width: 4),

          // Status buttons
          SizedBox(
            width: 130,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                _buildStatusBtn(studentIdx, 0, 'H'),
                _buildStatusBtn(studentIdx, 1, 'S'),
                _buildStatusBtn(studentIdx, 2, 'I'),
                _buildStatusBtn(studentIdx, 3, 'A'),
              ],
            ),
          ),
        ],
      ),
    );
  }

  void _showAlfaKeteranganDialog(int studentIdx) {
    final options = [
      'Tanpa keterangan (default Alfa)',
      'Izin keluar, tidak kunjung masuk',
      'Izin ke kamar mandi, menghilang dan tidak kembali',
    ];
    String? selected;
    final customController = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) {
          final selectedValue = selected == 'custom'
              ? 99
              : (selected == null ? 0 : options.indexOf(selected!));

          return AlertDialog(
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
            ),
            title: Text(
              'Keterangan Alfa - ${_students.length > studentIdx ? _students[studentIdx] : ''}',
              style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
            ),
            content: SingleChildScrollView(
              child: RadioGroup<int>(
                groupValue: selectedValue,
                onChanged: (val) {
                  if (val == null) return;

                  if (val == 99) {
                    setDialogState(() => selected = 'custom');
                    return;
                  }

                  final opt = options[val];
                  setDialogState(() {
                    selected = opt;
                    customController.clear();
                  });
                },
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    ...options.asMap().entries.map((entry) {
                      final idx = entry.key;
                      final opt = entry.value;
                      return RadioListTile<int>(
                        title: Text(opt, style: const TextStyle(fontSize: 12)),
                        value: idx,
                        dense: true,
                        contentPadding: EdgeInsets.zero,
                        activeColor: const Color(0xFF138F81),
                      );
                    }),
                    const RadioListTile<int>(
                      title: Text(
                        'Tulis sendiri...',
                        style: TextStyle(fontSize: 12),
                      ),
                      value: 99,
                      dense: true,
                      contentPadding: EdgeInsets.zero,
                      activeColor: Color(0xFF138F81),
                    ),
                    if (selected == 'custom')
                      Padding(
                        padding: const EdgeInsets.only(left: 16, top: 4),
                        child: TextField(
                          controller: customController,
                          decoration: const InputDecoration(
                            hintText: 'Ketik alasan...',
                            hintStyle: TextStyle(fontSize: 12),
                            isDense: true,
                            border: OutlineInputBorder(),
                          ),
                          style: const TextStyle(fontSize: 12),
                          maxLines: 2,
                        ),
                      ),
                  ],
                ),
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text(
                  'Batal',
                  style: TextStyle(color: Color(0xFF636E72)),
                ),
              ),
              ElevatedButton(
                onPressed: () {
                  String? keterangan;
                  if (selected == 'custom') {
                    keterangan = customController.text.trim().isEmpty
                        ? null
                        : customController.text.trim();
                  } else if (selected != null && selected != options[0]) {
                    keterangan = selected;
                  }
                  setState(() {
                    _attendanceStatus[studentIdx] = 3;
                    _keteranganAlfa[studentIdx] = keterangan;
                  });
                  Navigator.pop(ctx);
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFE65100),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
                child: const Text(
                  'Simpan Alfa',
                  style: TextStyle(fontSize: 12),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _buildStatusBtn(int studentIdx, int statusVal, String label) {
    final isActive = _attendanceStatus[studentIdx] == statusVal;
    final color = _statusColor(statusVal);

    return GestureDetector(
      onTap: (!_canModifyExistingAbsensi)
          ? null // Disabled — tidak bisa ubah status
          : () {
              if (statusVal == 3) {
                // Alfa — show keterangan popup
                _showAlfaKeteranganDialog(studentIdx);
              } else {
                setState(() {
                  _attendanceStatus[studentIdx] = statusVal;
                  _keteranganAlfa[studentIdx] = null; // Clear alfa reason
                });
              }
            },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        width: 28,
        height: 22,
        decoration: BoxDecoration(
          color: isActive ? color : color.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(6),
          border: Border.all(
            color: isActive ? color : color.withValues(alpha: 0.3),
            width: 1,
          ),
        ),
        child: Center(
          child: Text(
            label,
            style: TextStyle(
              fontSize: 9,
              fontWeight: FontWeight.w700,
              color: isActive ? Colors.white : color,
            ),
          ),
        ),
      ),
    );
  }
}
