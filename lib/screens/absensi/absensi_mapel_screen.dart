import 'dart:async';

import 'package:flutter/material.dart';

import '../../services/api_service.dart';
import '../../services/cache_service.dart';
import '../../services/local_db_service.dart';
import '../../services/session_service.dart';
import '../../services/sync_service.dart';
import 'absensi_murid_screen.dart';

class AbsensiMapelScreen extends StatefulWidget {
  final String namaKelas;
  final int? classId;
  final int? initialJumlahSiswa;
  final int? initialJumlahMapel;

  const AbsensiMapelScreen({
    super.key,
    required this.namaKelas,
    this.classId,
    this.initialJumlahSiswa,
    this.initialJumlahMapel,
  });

  @override
  State<AbsensiMapelScreen> createState() => _AbsensiMapelScreenState();
}

class _AbsensiMapelScreenState extends State<AbsensiMapelScreen> {
  static const _cacheKeyVersion = 'absensi_mapel_v4';
  final TextEditingController _searchController = TextEditingController();

  StreamSubscription<AppDataEvent>? _syncSubscription;
  String _searchQuery = '';
  bool _isLoading = true;
  bool _isOfflineMode = false;
  bool _isPresenceLoading = false;
  String? _errorMessage;
  List<Map<String, dynamic>> _allMapel = [];
  Map<String, Map<String, dynamic>> _absensiPresenceByMapel = {};
  String _presenceFingerprint = '';
  DateTime? _lastPresenceProbeAt;
  String _userRole = '';
  int? _jumlahSiswa;
  int? _jumlahMapelAktif;

  List<Map<String, dynamic>> get _filteredMapel {
    if (_searchQuery.isEmpty) return _allMapel;
    final query = _searchQuery.toLowerCase();
    return _allMapel.where((mapel) {
      final nama = (mapel['nama'] ?? '').toString().toLowerCase();
      final kode = (mapel['kode'] ?? '').toString().toLowerCase();
      return nama.contains(query) || kode.contains(query);
    }).toList();
  }

  @override
  void initState() {
    super.initState();
    _jumlahSiswa = widget.initialJumlahSiswa;
    _jumlahMapelAktif = widget.initialJumlahMapel;
    _loadMapel();
    _loadClassStats();
    _loadAbsensiPresence();
    _syncSubscription = SyncService.dataEvents.listen((event) {
      if (!mounted) return;
      if (event.topic == SyncTopics.mapel) {
        _loadMapel(silent: true);
      }
      if (event.topic == SyncTopics.absensi ||
          event.topic == SyncTopics.connectivity ||
          event.topic == SyncTopics.heartbeat) {
        _loadAbsensiPresence(silent: true);
      }
    });
  }

  @override
  void dispose() {
    _syncSubscription?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadMapel({bool silent = false}) async {
    if (!silent) {
      setState(() {
        _isLoading = _allMapel.isEmpty;
        _errorMessage = null;
      });
    }
    final userRole = await SessionService.getUserRole();
    _userRole = userRole;
    final scopedUserId = null; // Versi skripsi: Guru melihat semua mapel
    final kelasFilter = widget.namaKelas;
    final classIdFilter = widget.classId;
    final cacheKey =
        '${_cacheKeyVersion}_admin_${widget.namaKelas}_${classIdFilter ?? 0}';

    final result = await CacheService.fetchWithCache(
      cacheKey: cacheKey,
      apiFetch: () => ApiService.getMataPelajaran(
        status: 'Aktif',
        userId: scopedUserId,
        kelas: kelasFilter,
        classId: classIdFilter,
        requireJadwal: false, // Versi skripsi: Tidak butuh jadwal
      ),
    );

    if (!mounted) return;
    if (result != null && result['success'] == true) {
      final loadedMapel = List<Map<String, dynamic>>.from(
        result['data'] ?? const [],
      );
      setState(() {
        _allMapel = loadedMapel;
        _jumlahMapelAktif = loadedMapel
            .where((mapel) => _scheduleForMapel(mapel) != null)
            .length;
        _isLoading = false;
        _isOfflineMode = result['_fromCache'] == true;
        _errorMessage = null;
      });
      return;
    }

    setState(() {
      _isLoading = false;
      _errorMessage =
          'Mata pelajaran belum tersedia.\nCek koneksi atau nyalakan backend.';
    });
  }

  Future<void> _loadClassStats() async {
    try {
      final result = await ApiService.getSiswa(
        kelas: widget.namaKelas,
        classId: widget.classId,
        status: 'Aktif',
      );
      if (!mounted || result['success'] != true) return;
      final data = result['data'];
      final count = data is List ? data.length : 0;
      setState(() => _jumlahSiswa = count);
    } catch (_) {
      // Pertahankan angka dari halaman sebelumnya jika refresh count gagal.
    }
  }

  Map<String, dynamic>? _scheduleForMapel(Map<String, dynamic> mapel) {
    final schedules = List<Map<String, dynamic>>.from(
      mapel['jadwal'] ?? const [],
    );
    if (schedules.isEmpty) return null;

    final classId = widget.classId;
    if (classId != null && classId > 0) {
      final matches = schedules.where(
        (item) => _asInt(item['class_id']) == classId,
      );
      if (matches.isNotEmpty) return matches.first;
      return null;
    }

    final className = widget.namaKelas.trim();
    final nameMatches = schedules.where(
      (item) => (item['sifir']?.toString().trim() ?? '') == className,
    );
    if (nameMatches.isNotEmpty) return nameMatches.first;

    return className.isEmpty ? schedules.first : null;
  }

  String? _guruLockReason(Map<String, dynamic>? jadwal) {
    return null; // Versi skripsi: Guru tidak dibatasi jadwal
  }

  String _scheduleInfoText(Map<String, dynamic>? jadwal) {
    if (jadwal == null) {
      return _jumlahSiswa != null ? '${_jumlahSiswa!} Santri' : '';
    }

    final teacher = jadwal['guru']?.toString().trim() ?? '';
    final start = jadwal['jam_mulai']?.toString().trim() ?? '';
    final end = jadwal['jam_selesai']?.toString().trim() ?? '';
    final siswa = _jumlahSiswa != null ? '${_jumlahSiswa!} Santri' : '';
    final schedule = start.isNotEmpty && end.isNotEmpty ? '$start-$end' : start;

    if (_userRole == 'admin' && teacher.isNotEmpty) {
      return [
        if (siswa.isNotEmpty) siswa,
        'Guru: $teacher',
        if (schedule.isNotEmpty) schedule,
      ].join(' - ');
    }

    return [
      if (siswa.isNotEmpty) siswa,
      if (schedule.isNotEmpty) schedule,
    ].join(' - ');
  }

  int? _asInt(dynamic value) {
    if (value is int) return value;
    if (value is num) return value.toInt();
    return int.tryParse(value?.toString() ?? '');
  }

  String _presenceKey({
    required String mapel,
    int? classId,
    int? mapelId,
    int? jadwalId,
  }) {
    if ((classId ?? 0) > 0 && (mapelId ?? 0) > 0 && (jadwalId ?? 0) > 0) {
      return 'scope_${classId}_${mapelId}_$jadwalId';
    }

    return 'mapel_${mapel.trim().toLowerCase()}';
  }

  Map<String, String> _parseOwner(String owner) {
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

  String _formatInputTime(dynamic rawValue) {
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
    return '$hour:$minute:$second';
  }

  String _buildPresenceFingerprint(Map<String, Map<String, dynamic>> data) {
    final keys = data.keys.toList()..sort();
    return keys
        .map((key) {
          final item = data[key] ?? const <String, dynamic>{};
          return [
            key,
            item['status']?.toString() ?? '',
            item['diinput_oleh']?.toString() ?? '',
            item['waktu']?.toString() ?? '',
          ].join('|');
        })
        .join('||');
  }

  String _completedAbsensiCacheKey({
    required String role,
    required int userId,
  }) {
    return CacheService.userScopedKey(
      'completed_absensi_today',
      role: role,
      userId: userId,
    );
  }

  Future<void> _loadAbsensiPresence({bool silent = false}) async {
    if (_isPresenceLoading) return;
    _isPresenceLoading = true;

    try {
      final today = DateTime.now().toIso8601String().split('T')[0];
      final userId = await SessionService.getUserId();
      final userRole = await SessionService.getUserRole();
      final online = await SyncService.isOnline();
      final now = DateTime.now();
      final shouldRemoteProbe =
          online &&
          (_lastPresenceProbeAt == null ||
              now.difference(_lastPresenceProbeAt!) >=
                  const Duration(seconds: 20));

      if (shouldRemoteProbe) {
        try {
          final dashboard = await ApiService.getDashboard(
            userId: userRole == 'guru' ? userId : null,
          );
          if (dashboard['success'] == true) {
            await CacheService.save(
              _completedAbsensiCacheKey(role: userRole, userId: userId),
              {
                'tanggal': today,
                'per_kelas': dashboard['absensi']?['per_kelas'] ?? const [],
                'source': 'live',
              },
            );
          }
        } catch (_) {
          // Keep last known cache when remote probe fails.
        }
        _lastPresenceProbeAt = now;
      }

      final presence = <String, Map<String, dynamic>>{};
      final cachedCompleted = await CacheService.get(
        _completedAbsensiCacheKey(role: userRole, userId: userId),
      );
      if (cachedCompleted is Map<String, dynamic> &&
          cachedCompleted['tanggal'] == today) {
        final perKelas = List<Map<String, dynamic>>.from(
          cachedCompleted['per_kelas'] ?? const [],
        );

        for (final item in perKelas) {
          final kelas = item['kelas']?.toString() ?? '';
          final mapel = item['mapel']?.toString() ?? '';
          if (kelas != widget.namaKelas || mapel.isEmpty) continue;

          final rawStatus =
              item['status']?.toString().trim().toLowerCase() ?? '';
          if (rawStatus != 'completed') continue;

          final owner = item['diinput_oleh']?.toString() ?? '';
          final meta = _parseOwner(owner);
          final key = _presenceKey(
            mapel: mapel,
            classId: _asInt(item['class_id']),
            mapelId: _asInt(item['mapel_id']),
            jadwalId: _asInt(item['jadwal_id']),
          );
          presence[key] = {
            'status': online ? 'completed' : 'locked',
            'diinput_oleh': owner,
            'input_by_role': meta['role'] ?? '',
            'input_by_name': meta['name'] ?? owner,
            'waktu': item['waktu']?.toString() ?? '',
            'source': 'server',
          };
        }
      }

      final pendingList = await LocalDbService.getAllAbsensiToday();
      final pendingByScope = <String, List<Map<String, dynamic>>>{};
      for (final row in pendingList) {
        if (row['kelas']?.toString() != widget.namaKelas) continue;
        final mapel = row['mapel']?.toString() ?? '';
        if (mapel.isEmpty) continue;
        final key = _presenceKey(
          mapel: mapel,
          classId: _asInt(row['class_id']),
          mapelId: _asInt(row['mapel_id']),
          jadwalId: _asInt(row['jadwal_id']),
        );
        pendingByScope.putIfAbsent(key, () => []).add(row);
      }

      for (final entry in pendingByScope.entries) {
        final first = entry.value.first;
        final owner = first['diinput_oleh']?.toString() ?? '';
        final meta = _parseOwner(owner);
        final hasFailed = entry.value.any(
          (row) => row['sync_status']?.toString() == 'failed',
        );
        presence[entry.key] = {
          'status': hasFailed ? 'failed' : 'pending',
          'diinput_oleh': owner,
          'input_by_role': meta['role'] ?? '',
          'input_by_name': meta['name'] ?? owner,
          'waktu': _formatInputTime(first['created_at']),
          'source': 'local',
        };
      }

      final fingerprint = _buildPresenceFingerprint(presence);
      if (!mounted) return;
      if (!silent || fingerprint != _presenceFingerprint) {
        setState(() {
          _presenceFingerprint = fingerprint;
          _absensiPresenceByMapel = presence;
        });
      }
    } finally {
      _isPresenceLoading = false;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFFDC80),
      body: SafeArea(
        child: Column(
          children: [
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
                          const Text(
                            'Pilih Mata Pelajaran',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF2D3436),
                            ),
                          ),
                          Row(
                            children: [
                              Expanded(
                                child: Text(
                                  _headerSubtitle,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w500,
                                    color: Color(0xFF138F81),
                                  ),
                                ),
                              ),
                              if (_isOfflineMode) ...[
                                const SizedBox(width: 8),
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 8,
                                    vertical: 3,
                                  ),
                                  decoration: BoxDecoration(
                                    color: const Color(
                                      0xFFE65100,
                                    ).withValues(alpha: 0.12),
                                    borderRadius: BorderRadius.circular(999),
                                  ),
                                  child: const Text(
                                    'Offline',
                                    style: TextStyle(
                                      fontSize: 10,
                                      fontWeight: FontWeight.w700,
                                      color: Color(0xFFE65100),
                                    ),
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      onPressed: () => Navigator.pop(context),
                      icon: const Icon(Icons.arrow_back_ios_rounded, size: 20),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),
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
                        onChanged: (value) =>
                            setState(() => _searchQuery = value),
                        decoration: const InputDecoration(
                          hintText: 'Cari Mata Pelajaran...',
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
            Expanded(
              child: Container(
                width: double.infinity,
                margin: const EdgeInsets.symmetric(horizontal: 16),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFFE1EFF7),
                  borderRadius: BorderRadius.circular(50),
                ),
                child: Column(
                  children: [
                    const Text(
                      'Mata Pelajaran',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF2D3436),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Container(
                      height: 1.5,
                      color: const Color(0xFF2D3436).withValues(alpha: 0.15),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      _classStatsLabel,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF636E72),
                      ),
                    ),
                    const SizedBox(height: 12),
                    Expanded(child: _buildContent()),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  String get _headerSubtitle {
    final siswa = _jumlahSiswa;
    final mapel = _jumlahMapelAktif;
    final parts = <String>[widget.namaKelas];
    if (siswa != null) parts.add('$siswa Santri');
    if (mapel != null) parts.add('$mapel Mapel');
    return parts.join(' - ');
  }

  String get _classStatsLabel {
    final siswa = _jumlahSiswa ?? 0;
    final mapel = _jumlahMapelAktif ?? _allMapel.length;
    return '$siswa Santri terdeteksi - $mapel Mapel aktif';
  }

  Widget _buildContent() {
    if (_isLoading) {
      return const Center(
        child: CircularProgressIndicator(color: Color(0xFF138F81)),
      );
    }

    if (_errorMessage != null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(
              Icons.menu_book_outlined,
              color: Color(0xFF636E72),
              size: 42,
            ),
            const SizedBox(height: 12),
            Text(
              _errorMessage!,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 13,
                color: Color(0xFF636E72),
                height: 1.4,
              ),
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: _loadMapel,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF138F81),
                foregroundColor: Colors.white,
              ),
              child: const Text('Coba Lagi'),
            ),
          ],
        ),
      );
    }

    if (_filteredMapel.isEmpty) {
      return Center(
        child: Text(
          _userRole == 'guru'
              ? 'Belum ada mata pelajaran yang ditugaskan admin untuk kelas ini'
              : 'Tidak ada mata pelajaran aktif',
          textAlign: TextAlign.center,
          style: const TextStyle(fontSize: 13, color: Color(0xFF636E72)),
        ),
      );
    }

    return ListView.builder(
      physics: const BouncingScrollPhysics(),
      itemCount: _filteredMapel.length,
      itemBuilder: (context, index) {
        return _buildMapelItem(_filteredMapel[index], index);
      },
    );
  }

  Widget _buildMapelItem(Map<String, dynamic> mapel, int index) {
    final nama = mapel['nama']?.toString() ?? '-';
    final jadwal = _scheduleForMapel(mapel);
    final presenceKey = _presenceKey(
      mapel: nama,
      classId: _asInt(jadwal?['class_id']) ?? widget.classId,
      mapelId: _asInt(mapel['id']),
      jadwalId: _asInt(jadwal?['id']),
    );
    final fallbackPresenceKey = _presenceKey(mapel: nama);
    final presence =
        _absensiPresenceByMapel[presenceKey] ??
        _absensiPresenceByMapel[fallbackPresenceKey];
    final status = presence?['status']?.toString() ?? '';
    final owner = presence?['diinput_oleh']?.toString() ?? '';
    final inputAt = presence?['waktu']?.toString() ?? '';
    final hasPresence = status.isNotEmpty;
    final lockReason = hasPresence ? null : _guruLockReason(jadwal);
    final isScheduleLocked = lockReason != null;
    final isUpcoming = isScheduleLocked && lockReason.contains('mulai pukul');
    final isLocked = status == 'locked' || (isScheduleLocked && !isUpcoming);
    final isPending = status == 'pending';
    final isFailed = status == 'failed';
    final statusText = isLocked
        ? 'Locked'
        : isUpcoming
        ? 'Upcoming'
        : isPending
        ? 'Pending'
        : isFailed
        ? 'Retry'
        : hasPresence
        ? 'Completed'
        : '';
    final statusColor = isLocked
        ? const Color(0xFF546E7A)
        : isUpcoming
        ? const Color(0xFF2E86DE)
        : isPending
        ? const Color(0xFFFFB74D)
        : isFailed
        ? const Color(0xFFE65100)
        : const Color(0xFF138F81);
    final cardBg = isLocked
        ? const Color(0xFFF7F9FA)
        : isUpcoming
        ? const Color(0xFFEAF3FF)
        : isPending
        ? const Color(0xFFFFFBF2)
        : isFailed
        ? const Color(0xFFFFF3F0)
        : hasPresence
        ? const Color(0xFFF5FBF9)
        : Colors.white;
    final hasValidSchedule = jadwal != null;
    final scheduleWarning = _userRole == 'admin' && !hasValidSchedule;
    final scheduleInfoText = _scheduleInfoText(jadwal);

    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0.0, end: 1.0),
      duration: Duration(milliseconds: 300 + (index * 60)),
      curve: Curves.easeOutCubic,
      builder: (context, value, child) {
        return Opacity(
          opacity: value,
          child: Transform.translate(
            offset: Offset(0, 15 * (1 - value)),
            child: child,
          ),
        );
      },
      child: GestureDetector(
        onTap: () {
          if (isScheduleLocked) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(lockReason),
                backgroundColor: const Color(0xFF546E7A),
                behavior: SnackBarBehavior.floating,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
            );
            return;
          }

          Navigator.push(
            context,
            PageRouteBuilder(
              pageBuilder: (context, animation, _) => AbsensiMuridScreen(
                namaKelas: widget.namaKelas,
                namaMapel: nama,
                classId: _asInt(jadwal?['class_id']) ?? widget.classId,
                mapelId: (mapel['id'] as num?)?.toInt(),
                jadwalId: _asInt(jadwal?['id']),
              ),
              transitionsBuilder: (context, animation, _, child) {
                return FadeTransition(
                  opacity: animation,
                  child: SlideTransition(
                    position:
                        Tween<Offset>(
                          begin: const Offset(1.0, 0.0),
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
          ).then((_) => _loadAbsensiPresence(silent: true));
        },
        child: Container(
          margin: const EdgeInsets.only(bottom: 8),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
          decoration: BoxDecoration(
            color: cardBg,
            borderRadius: BorderRadius.circular(21),
            border: Border.all(
              color: hasPresence || isScheduleLocked
                  ? statusColor.withValues(alpha: 0.24)
                  : const Color(0x14000000),
            ),
          ),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      nama,
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF2D3436),
                      ),
                    ),
                    if (hasPresence) ...[
                      const SizedBox(height: 4),
                      Text(
                        owner.isNotEmpty
                            ? inputAt.isNotEmpty
                                  ? 'Input: $owner • $inputAt'
                                  : 'Input: $owner'
                            : 'Sudah ada data absensi untuk mapel ini',
                        style: const TextStyle(
                          fontSize: 10,
                          color: Color(0xFF636E72),
                        ),
                      ),
                    ] else if (scheduleWarning) ...[
                      const SizedBox(height: 4),
                      Text(
                        scheduleInfoText.isNotEmpty
                            ? '$scheduleInfoText - Aktif - jadwal kelas belum diatur'
                            : 'Aktif - jadwal kelas belum diatur',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFFE65100),
                        ),
                      ),
                    ] else if (isScheduleLocked) ...[
                      const SizedBox(height: 4),
                      Text(
                        lockReason,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 10,
                          color: Color(0xFF636E72),
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ] else if (scheduleInfoText.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(
                        scheduleInfoText,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 10,
                          color: Color(0xFF636E72),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              if (hasPresence || isScheduleLocked) ...[
                Container(
                  margin: const EdgeInsets.only(right: 10),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 5,
                  ),
                  decoration: BoxDecoration(
                    color: statusColor.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(
                      color: statusColor.withValues(alpha: 0.24),
                    ),
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
              Icon(
                scheduleWarning
                    ? Icons.info_outline_rounded
                    : isScheduleLocked
                    ? Icons.lock_rounded
                    : Icons.chevron_right_rounded,
                size: 20,
                color: scheduleWarning
                    ? const Color(0xFFE65100)
                    : isScheduleLocked
                    ? const Color(0xFF546E7A)
                    : const Color(0xFF636E72),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
