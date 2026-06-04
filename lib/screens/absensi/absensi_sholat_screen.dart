import 'dart:async';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../services/api_service.dart';
import '../../services/absensi_sholat_export_service.dart';
import '../../services/local_db_service.dart';
import '../../services/session_service.dart';
import '../../services/sync_service.dart';
import '../beranda/dashboard_screen.dart';

class AbsensiSholatScreen extends StatefulWidget {
  const AbsensiSholatScreen({super.key});

  @override
  State<AbsensiSholatScreen> createState() => _AbsensiSholatScreenState();
}

class _AbsensiSholatScreenState extends State<AbsensiSholatScreen> {
  static const _teal = Color(0xFF138F81);
  static const _yellow = Color(0xFFFFDC80);
  static const _panel = Color(0xFFE1EFF7);
  static const _text = Color(0xFF2D3436);
  static const _muted = Color(0xFF636E72);

  DateTime _selectedDate = DateTime.now();
  bool _loading = true;
  bool _saving = false;
  String? _error;
  String _userName = '';
  int _userId = 0;

  List<Map<String, dynamic>> _complexes = [];
  List<Map<String, dynamic>> _rooms = [];
  List<Map<String, dynamic>> _prayerTypes = [];
  Map<String, dynamic>? _selectedPrayerType;
  Map<String, dynamic>? _selectedComplex;
  Map<String, dynamic>? _selectedRoom;
  List<Map<String, dynamic>> _rows = [];
  final Map<int, String> _statuses = {};
  final Map<int, String> _initialStatuses = {};
  final Map<int, int> _existingAttendanceIds = {};
  bool _scopePendingOffline = false;
  String? _lastSaveMode;
  StreamSubscription<AppDataEvent>? _syncSubscription;

  String get _dateText => DateFormat('yyyy-MM-dd').format(_selectedDate);
  bool get _scopeSaved => _initialStatuses.isNotEmpty;
  bool get _allStatusesFilled =>
      _rows.isNotEmpty && _statuses.length >= _rows.length;
  bool get _hasUnsavedChanges {
    for (final row in _rows) {
      final siswa = Map<String, dynamic>.from(row['siswa'] ?? {});
      final id = _asInt(siswa['id']);
      if ((_statuses[id] ?? '') != (_initialStatuses[id] ?? '')) {
        return true;
      }
    }
    return false;
  }

  @override
  void initState() {
    super.initState();
    _init();
    _syncSubscription = SyncService.dataEvents.listen((event) {
      if (!mounted) return;
      if (event.topic == SyncTopics.absensiSholat ||
          event.topic == SyncTopics.connectivity) {
        _loadContext(silent: true);
      }
    });
  }

  @override
  void dispose() {
    _syncSubscription?.cancel();
    super.dispose();
  }

  Future<void> _init() async {
    _userName = await SessionService.getUserName();
    _userId = await SessionService.getUserId();
    await _loadMaster();
  }

  int _asInt(dynamic value) {
    if (value is int) return value;
    return int.tryParse(value?.toString() ?? '') ?? 0;
  }

  Future<void> _loadMaster() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final result = await ApiService.getBoardingComplexes();
      final typeResult = await ApiService.getPrayerAttendanceTypes(
        activeOnly: true,
      );
      final data = List<Map<String, dynamic>>.from(result['data'] ?? []);
      final types = List<Map<String, dynamic>>.from(typeResult['data'] ?? []);
      _prayerTypes = types;
      _selectedPrayerType ??= types.isNotEmpty ? types.first : null;
      _complexes = data;
      _selectedComplex ??= data.isNotEmpty ? data.first : null;
      _rooms = List<Map<String, dynamic>>.from(
        _selectedComplex?['rooms'] ?? const [],
      );
      _selectedRoom ??= _rooms.isNotEmpty ? _rooms.first : null;
      await _loadContext(silent: true);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  Future<void> _loadContext({bool silent = false}) async {
    if (_selectedRoom == null) {
      setState(() {
        _rows = [];
        _statuses.clear();
        _initialStatuses.clear();
        _existingAttendanceIds.clear();
        _scopePendingOffline = false;
        _loading = false;
      });
      return;
    }

    if (!silent) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }

    try {
      final roomId = _asInt(_selectedRoom!['id']);
      final result = await ApiService.getAbsensiSholatContext(
        tanggal: _dateText,
        boardingRoomId: roomId,
        prayerAttendanceTypeId: _asInt(_selectedPrayerType?['id']),
      );
      final data = Map<String, dynamic>.from(result['data'] ?? {});
      final rows = List<Map<String, dynamic>>.from(data['rows'] ?? []);
      final nextStatuses = <int, String>{};
      final nextInitialStatuses = <int, String>{};
      final nextExistingIds = <int, int>{};
      for (final row in rows) {
        final siswa = Map<String, dynamic>.from(row['siswa'] ?? {});
        final id = _asInt(siswa['id']);
        final absensi = row['absensi'];
        if (id > 0 && absensi is Map && absensi['status_code'] != null) {
          final code = absensi['status_code'].toString();
          nextStatuses[id] = code;
          nextInitialStatuses[id] = code;
          final attendanceId = _asInt(absensi['id']);
          if (attendanceId > 0) nextExistingIds[id] = attendanceId;
        }
      }

      final pending = await LocalDbService.getPendingSholatByScope(
        tanggal: _dateText,
        boardingRoomId: roomId,
        prayerAttendanceTypeId: _asInt(_selectedPrayerType?['id']),
      );
      var hasPending = false;
      for (final item in pending) {
        final id = _asInt(item['siswa_id']);
        final code = item['status_code']?.toString();
        if (id > 0 && code != null && code.isNotEmpty) {
          nextStatuses[id] = code;
          hasPending = true;
        }
      }

      if (!mounted) return;
      setState(() {
        _rows = rows;
        _statuses
          ..clear()
          ..addAll(nextStatuses);
        _initialStatuses
          ..clear()
          ..addAll(nextInitialStatuses);
        _existingAttendanceIds
          ..clear()
          ..addAll(nextExistingIds);
        _scopePendingOffline = hasPending;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate,
      firstDate: DateTime(2020),
      lastDate: DateTime(2100),
      builder: (context, child) => Theme(
        data: Theme.of(context).copyWith(
          colorScheme: Theme.of(context).colorScheme.copyWith(primary: _teal),
        ),
        child: child!,
      ),
    );
    if (picked == null) return;
    setState(() => _selectedDate = picked);
    await _loadContext();
  }

  Future<void> _save() async {
    if (_selectedRoom == null || _rows.isEmpty) return;
    if (!_allStatusesFilled) {
      _showSnack('Lengkapi status M/I/S semua santri dulu.');
      return;
    }
    if (_scopeSaved && !_hasUnsavedChanges && !_scopePendingOffline) {
      _showSnack('Tidak ada perubahan absensi untuk disimpan.');
      return;
    }

    setState(() => _saving = true);

    final roomId = _asInt(_selectedRoom!['id']);
    try {
      final items = _rows
          .map((row) {
            final siswa = Map<String, dynamic>.from(row['siswa'] ?? {});
            final siswaId = _asInt(siswa['id']);
            return {'siswa_id': siswaId, 'status_code': _statuses[siswaId]};
          })
          .where((item) {
            final siswaId = _asInt(item['siswa_id']);
            final status = item['status_code']?.toString();
            return siswaId > 0 && status != null && status.isNotEmpty;
          })
          .toList();

      final result = await SyncService.inputAbsensiSholatBulk(
        boardingRoomId: roomId,
        prayerAttendanceTypeId: _asInt(_selectedPrayerType?['id']),
        tanggal: _dateText,
        items: items,
        diinputOleh: _userName,
        actorUserId: _userId,
      );

      if (!mounted) return;
      _lastSaveMode = result.mode;
      _showSnack(result.message);
      if (result.success) {
        DashboardScreen.needsRefresh = true;
        unawaited(
          SyncService.notifyDataChanged(
            SyncTopics.absensiSholat,
            message: result.mode == 'offline'
                ? 'Absensi sholat tersimpan offline'
                : 'Absensi sholat tersimpan online',
          ),
        );
        await _loadContext(silent: true);
      }
    } catch (e) {
      if (!mounted) return;
      _showSnack('Gagal menyimpan absensi sholat: $e');
    } finally {
      if (mounted) {
        setState(() => _saving = false);
      }
    }
  }

  void _showSnack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), behavior: SnackBarBehavior.floating),
    );
  }

  Future<void> _cancelAbsensi() async {
    if (_selectedRoom == null || !_scopeSaved) {
      _showSnack('Belum ada absensi tersimpan untuk dibatalkan.');
      return;
    }

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Batalkan Absensi Sholat'),
        content: const Text(
          'Absensi tanggal dan kamar ini akan dibatalkan dari perhitungan aktif. Riwayat tetap tersimpan.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Batal'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: _teal,
              foregroundColor: Colors.white,
            ),
            child: const Text('Lanjut'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    setState(() => _saving = true);
    try {
      final result = await ApiService.cancelAbsensiSholat(
        tanggal: _dateText,
        boardingRoomId: _asInt(_selectedRoom!['id']),
        prayerAttendanceTypeId: _asInt(_selectedPrayerType?['id']),
        reason: 'Dibatalkan dari aplikasi',
      );
      if (!mounted) return;
      _lastSaveMode = 'cancelled';
      DashboardScreen.needsRefresh = true;
      unawaited(
        SyncService.notifyDataChanged(
          SyncTopics.absensiSholat,
          message: 'Absensi sholat dibatalkan',
        ),
      );
      _showSnack(result['message']?.toString() ?? 'Absensi sholat dibatalkan');
      await _loadContext(silent: true);
    } catch (e) {
      if (!mounted) return;
      _showSnack('Gagal membatalkan absensi sholat: $e');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  void _resetPilihan() {
    setState(() {
      _statuses
        ..clear()
        ..addAll(_initialStatuses);
    });
  }

  void _selectComplex(Map<String, dynamic> complex) {
    setState(() {
      _selectedComplex = complex;
      _rooms = List<Map<String, dynamic>>.from(complex['rooms'] ?? const []);
      _selectedRoom = _rooms.isNotEmpty ? _rooms.first : null;
    });
    _loadContext();
  }

  void _selectRoom(Map<String, dynamic> room) {
    setState(() => _selectedRoom = room);
    _loadContext();
  }

  void _selectPrayerType(Map<String, dynamic> type) {
    setState(() => _selectedPrayerType = type);
    _loadContext();
  }

  Future<void> _openManageSheet() async {
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) => _RoomManageSheet(complexes: _complexes),
    );
    if (saved == true && mounted) {
      await _loadMaster();
      _showSnack('Data pondok berhasil diperbarui');
    }
  }

  int _countStatus(String code) =>
      _statuses.values.where((value) => value == code).length;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _yellow,
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(),
            _buildFilters(),
            _buildSummary(),
            _buildStateActions(),
            Expanded(child: _buildBody()),
            _buildSaveBar(),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: _panel,
          borderRadius: BorderRadius.circular(25),
        ),
        child: Row(
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                color: _yellow,
              ),
              child: const Icon(Icons.mosque_rounded, color: _teal),
            ),
            const SizedBox(width: 12),
            const Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    "Absensi Jama'ah Sholat",
                    style: TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w800,
                      color: _text,
                    ),
                  ),
                  Text(
                    'Input M/I/S per kamar santri pondok',
                    style: TextStyle(fontSize: 10, color: _muted),
                  ),
                ],
              ),
            ),
            IconButton(
              tooltip: 'Kelola kamar',
              onPressed: _openManageSheet,
              icon: const Icon(Icons.meeting_room_rounded, color: _teal),
            ),
            IconButton(
              tooltip: 'Rekap',
              onPressed: _openRekapSheet,
              icon: const Icon(Icons.analytics_rounded, color: _teal),
            ),
            IconButton(
              onPressed: () => Navigator.pop(context),
              icon: const Icon(Icons.close_rounded, color: _text),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFilters() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                child: _PickerButton(
                  icon: Icons.calendar_today_rounded,
                  label: DateFormat('dd MMM yyyy').format(_selectedDate),
                  onTap: _pickDate,
                ),
              ),
              const SizedBox(width: 8),
              _IconButtonBox(
                icon: Icons.refresh_rounded,
                onTap: () => _loadMaster(),
              ),
            ],
          ),
          const SizedBox(height: 8),
          _DropdownBox(
            label: 'Waktu Jama\'ah Sholat',
            value: _selectedPrayerType,
            items: _prayerTypes,
            itemLabel: (item) => item['name']?.toString() ?? '-',
            onChanged: (item) {
              if (item != null) _selectPrayerType(item);
            },
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: _DropdownBox(
                  label: 'Komplek',
                  value: _selectedComplex,
                  items: _complexes,
                  itemLabel: (item) => item['name']?.toString() ?? '-',
                  onChanged: (item) {
                    if (item != null) _selectComplex(item);
                  },
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _DropdownBox(
                  label: 'Kamar',
                  value: _selectedRoom,
                  items: _rooms,
                  itemLabel: (item) => item['name']?.toString() ?? '-',
                  onChanged: (item) {
                    if (item != null) _selectRoom(item);
                  },
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildSummary() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 6),
      child: Row(
        children: [
          _SummaryChip(label: 'M', value: _countStatus('M'), color: _teal),
          const SizedBox(width: 8),
          _SummaryChip(
            label: 'I',
            value: _countStatus('I'),
            color: const Color(0xFFE65100),
          ),
          const SizedBox(width: 8),
          _SummaryChip(
            label: 'S',
            value: _countStatus('S'),
            color: const Color(0xFFD63031),
          ),
          const SizedBox(width: 8),
          _SummaryChip(
            label: 'Kosong',
            value: (_rows.length - _statuses.length).clamp(0, _rows.length),
            color: _muted,
          ),
        ],
      ),
    );
  }

  Widget _buildStateActions() {
    final statusText = _scopePendingOffline
        ? 'Tersimpan offline'
        : _saving
        ? 'Menyimpan...'
        : _lastSaveMode == 'cancelled'
        ? 'Dibatalkan'
        : _scopeSaved
        ? (_hasUnsavedChanges
              ? 'Ada perubahan belum disimpan'
              : 'Sudah tersimpan')
        : 'Belum diabsen';
    final statusColor = _scopePendingOffline
        ? const Color(0xFFF39C12)
        : _hasUnsavedChanges
        ? const Color(0xFFE65100)
        : _scopeSaved
        ? _teal
        : _muted;

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
      child: Wrap(
        spacing: 8,
        runSpacing: 8,
        crossAxisAlignment: WrapCrossAlignment.center,
        children: [
          _StatusPill(label: statusText, color: statusColor),
          _MiniActionButton(
            label: 'Reset',
            icon: Icons.restart_alt_rounded,
            onTap: _saving || !_hasUnsavedChanges ? null : _resetPilihan,
          ),
          _MiniActionButton(
            label: 'Refresh',
            icon: Icons.refresh_rounded,
            onTap: _saving ? null : () => _loadContext(),
          ),
          _MiniActionButton(
            label: 'Batalkan',
            icon: Icons.cancel_rounded,
            onTap: _saving || !_scopeSaved ? null : _cancelAbsensi,
            color: const Color(0xFFD63031),
          ),
        ],
      ),
    );
  }

  Widget _buildBody() {
    if (_loading) {
      return const Center(child: CircularProgressIndicator(color: _teal));
    }
    if (_error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                Icons.wifi_off_rounded,
                color: Color(0xFFE65100),
                size: 44,
              ),
              const SizedBox(height: 10),
              Text(
                _error!,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 12, color: _muted),
              ),
              const SizedBox(height: 12),
              ElevatedButton.icon(
                onPressed: _loadMaster,
                icon: const Icon(Icons.refresh_rounded),
                label: const Text('Coba Lagi'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: _teal,
                  foregroundColor: Colors.white,
                ),
              ),
            ],
          ),
        ),
      );
    }
    if (_selectedRoom == null) {
      return Center(
        child: Text(
          _complexes.isEmpty
              ? 'Belum ada komplek pondok. Tambahkan dari Buku Induk > Data Pondok.'
              : 'Belum ada kamar pada komplek ini. Tambahkan dari Buku Induk > Data Pondok.',
          style: TextStyle(color: _muted),
        ),
      );
    }
    if (_rows.isEmpty) {
      return const Center(
        child: Text(
          'Belum ada santri pondok aktif di kamar ini.',
          style: TextStyle(color: _muted),
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _loadContext,
      color: _teal,
      child: ListView.builder(
        physics: const AlwaysScrollableScrollPhysics(
          parent: BouncingScrollPhysics(),
        ),
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 90),
        itemCount: _rows.length,
        itemBuilder: (context, index) {
          final row = _rows[index];
          final siswa = Map<String, dynamic>.from(row['siswa'] ?? {});
          final siswaId = _asInt(siswa['id']);
          return _StudentAttendanceTile(
            number: index + 1,
            name: siswa['nama']?.toString() ?? '-',
            kelas: siswa['kelas']?.toString() ?? '-',
            value: _statuses[siswaId],
            saved: _initialStatuses.containsKey(siswaId),
            changed:
                (_statuses[siswaId] ?? '') != (_initialStatuses[siswaId] ?? ''),
            pendingOffline:
                _scopePendingOffline &&
                !_existingAttendanceIds.containsKey(siswaId),
            onChanged: (code) => setState(() {
              _statuses[siswaId] = code;
              _lastSaveMode = null;
            }),
          );
        },
      ),
    );
  }

  Widget _buildSaveBar() {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 14),
      decoration: const BoxDecoration(color: _yellow),
      child: SizedBox(
        width: double.infinity,
        height: 48,
        child: ElevatedButton.icon(
          onPressed:
              _saving ||
                  _rows.isEmpty ||
                  !_allStatusesFilled ||
                  (_scopeSaved && !_hasUnsavedChanges && !_scopePendingOffline)
              ? null
              : _save,
          icon: _saving
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: Colors.white,
                  ),
                )
              : const Icon(Icons.save_rounded),
          label: Text(
            _saving
                ? 'Menyimpan...'
                : _scopeSaved
                ? 'Perbarui Absensi Sholat'
                : 'Simpan Absensi Sholat',
          ),
          style: ElevatedButton.styleFrom(
            backgroundColor: _teal,
            foregroundColor: Colors.white,
            disabledBackgroundColor: _muted.withValues(alpha: 0.35),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _openRekapSheet() async {
    final month = _selectedDate.month;
    final year = _selectedDate.year;
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) => SafeArea(
        child: Container(
          constraints: BoxConstraints(
            maxHeight: MediaQuery.of(sheetContext).size.height * 0.9,
          ),
          padding: const EdgeInsets.fromLTRB(18, 16, 18, 18),
          decoration: const BoxDecoration(
            color: _panel,
            borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
          ),
          child: FutureBuilder<Map<String, dynamic>>(
            future: ApiService.getRekapAbsensiSholat(
              bulan: month,
              tahun: year,
              boardingComplexId: _asInt(_selectedComplex?['id']),
              boardingRoomId: _asInt(_selectedRoom?['id']),
              prayerAttendanceTypeId: _asInt(_selectedPrayerType?['id']),
            ),
            builder: (context, snapshot) {
              if (snapshot.connectionState != ConnectionState.done) {
                return const Center(
                  child: CircularProgressIndicator(color: _teal),
                );
              }
              if (snapshot.hasError) {
                return Center(
                  child: Text(
                    'Gagal memuat rekap: ${snapshot.error}',
                    textAlign: TextAlign.center,
                  ),
                );
              }
              final result = snapshot.data ?? {};
              final summary = Map<String, dynamic>.from(
                result['summary'] ?? {},
              );
              final records = List<Map<String, dynamic>>.from(
                result['records'] ?? const [],
              );
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Expanded(
                        child: Text(
                          'Rekap Absensi Sholat',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w800,
                            color: _text,
                          ),
                        ),
                      ),
                      if (records.isNotEmpty)
                        IconButton(
                          tooltip: 'Download Excel',
                          onPressed: () async {
                            try {
                              await AbsensiSholatExportService.exportRekapExcel(
                                records: records,
                                summary: summary,
                                title:
                                    'Rekap Absensi ${_selectedPrayerType?['name'] ?? 'Jamaah Sholat'}',
                                period:
                                    '${_selectedDate.month}/${_selectedDate.year}',
                              );
                              _showSnack('Rekap sholat Excel berhasil dibuat.');
                            } catch (e) {
                              _showSnack('Gagal membuat Excel: $e');
                            }
                          },
                          icon: const Icon(
                            Icons.file_download_rounded,
                            color: _teal,
                          ),
                        ),
                      IconButton(
                        onPressed: () => Navigator.pop(sheetContext),
                        icon: const Icon(Icons.close_rounded),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      _SummaryChip(
                        label: 'M',
                        value: (summary['M'] as num?)?.toInt() ?? 0,
                        color: _teal,
                      ),
                      const SizedBox(width: 8),
                      _SummaryChip(
                        label: 'I',
                        value: (summary['I'] as num?)?.toInt() ?? 0,
                        color: const Color(0xFFE65100),
                      ),
                      const SizedBox(width: 8),
                      _SummaryChip(
                        label: 'S',
                        value: (summary['S'] as num?)?.toInt() ?? 0,
                        color: const Color(0xFFD63031),
                      ),
                      const SizedBox(width: 8),
                      _SummaryChip(
                        label: 'Kosong',
                        value: (summary['Kosong'] as num?)?.toInt() ?? 0,
                        color: _muted,
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Expanded(
                    child: records.isEmpty
                        ? const Center(
                            child: Text(
                              'Belum ada data rekap.',
                              style: TextStyle(color: _muted),
                            ),
                          )
                        : ListView.builder(
                            itemCount: records.length,
                            itemBuilder: (context, index) {
                              final row = records[index];
                              return Container(
                                margin: const EdgeInsets.only(bottom: 8),
                                padding: const EdgeInsets.all(12),
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  borderRadius: BorderRadius.circular(16),
                                ),
                                child: Row(
                                  children: [
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            row['nama']?.toString() ?? '-',
                                            style: const TextStyle(
                                              fontSize: 12,
                                              fontWeight: FontWeight.w800,
                                              color: _text,
                                            ),
                                          ),
                                          Text(
                                            '${row['tanggal'] ?? '-'} - ${row['komplek'] ?? '-'} / ${row['kamar'] ?? '-'}',
                                            style: const TextStyle(
                                              fontSize: 10,
                                              color: _muted,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                    Text(
                                      row['status']?.toString() ?? '-',
                                      style: const TextStyle(
                                        fontWeight: FontWeight.w900,
                                        color: _teal,
                                      ),
                                    ),
                                  ],
                                ),
                              );
                            },
                          ),
                  ),
                ],
              );
            },
          ),
        ),
      ),
    );
  }
}

class _StatusPill extends StatelessWidget {
  const _StatusPill({
    required this.label,
    required this.color,
    this.compact = false,
  });

  final String label;
  final Color color;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: compact ? 7 : 10,
        vertical: compact ? 3 : 6,
      ),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(compact ? 8 : 12),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: compact ? 9 : 10,
          fontWeight: FontWeight.w800,
          color: color,
        ),
      ),
    );
  }
}

class _MiniActionButton extends StatelessWidget {
  const _MiniActionButton({
    required this.label,
    required this.icon,
    required this.onTap,
    this.color = _AbsensiSholatScreenState._teal,
  });

  final String label;
  final IconData icon;
  final VoidCallback? onTap;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final enabled = onTap != null;
    final effective = enabled ? color : _AbsensiSholatScreenState._muted;

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
        decoration: BoxDecoration(
          color: effective.withValues(alpha: enabled ? 0.12 : 0.08),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 14, color: effective),
            const SizedBox(width: 5),
            Text(
              label,
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w800,
                color: effective,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StudentAttendanceTile extends StatelessWidget {
  const _StudentAttendanceTile({
    required this.number,
    required this.name,
    required this.kelas,
    required this.value,
    required this.saved,
    required this.changed,
    required this.pendingOffline,
    required this.onChanged,
  });

  final int number;
  final String name;
  final String kelas;
  final String? value;
  final bool saved;
  final bool changed;
  final bool pendingOffline;
  final ValueChanged<String> onChanged;

  String get _statusLabel {
    switch (value) {
      case 'M':
        return 'Masuk';
      case 'I':
        return 'Izin';
      case 'S':
        return 'Sakit';
      default:
        return 'Belum';
    }
  }

  String get _stateLabel {
    if (pendingOffline) return 'Offline';
    if (changed) return 'Diubah';
    if (saved) return 'Tersimpan';
    return 'Belum';
  }

  Color get _statusColor {
    switch (value) {
      case 'M':
        return const Color(0xFF138F81);
      case 'I':
        return const Color(0xFFE65100);
      case 'S':
        return const Color(0xFFD63031);
      default:
        return const Color(0xFF636E72);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
      ),
      child: Row(
        children: [
          Container(
            width: 34,
            height: 34,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: const Color(0xFFEAF6F4),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Text(
              number.toString(),
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w800,
                color: Color(0xFF138F81),
              ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF2D3436),
                  ),
                ),
                Text(
                  kelas,
                  style: const TextStyle(
                    fontSize: 10,
                    color: Color(0xFF636E72),
                  ),
                ),
                const SizedBox(height: 5),
                Wrap(
                  spacing: 5,
                  runSpacing: 4,
                  children: [
                    _StatusPill(
                      label: _statusLabel,
                      color: _statusColor,
                      compact: true,
                    ),
                    _StatusPill(
                      label: _stateLabel,
                      color: pendingOffline
                          ? const Color(0xFFF39C12)
                          : changed
                          ? const Color(0xFFE65100)
                          : saved
                          ? const Color(0xFF138F81)
                          : const Color(0xFF636E72),
                      compact: true,
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          _StatusButton(code: 'M', value: value, onTap: onChanged),
          const SizedBox(width: 5),
          _StatusButton(code: 'I', value: value, onTap: onChanged),
          const SizedBox(width: 5),
          _StatusButton(code: 'S', value: value, onTap: onChanged),
        ],
      ),
    );
  }
}

class _StatusButton extends StatelessWidget {
  const _StatusButton({
    required this.code,
    required this.value,
    required this.onTap,
  });

  final String code;
  final String? value;
  final ValueChanged<String> onTap;

  Color get _color {
    switch (code) {
      case 'M':
        return const Color(0xFF138F81);
      case 'I':
        return const Color(0xFFE65100);
      default:
        return const Color(0xFFD63031);
    }
  }

  @override
  Widget build(BuildContext context) {
    final selected = value == code;
    return InkWell(
      borderRadius: BorderRadius.circular(10),
      onTap: () => onTap(code),
      child: Container(
        width: 34,
        height: 34,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: selected ? _color : _color.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Text(
          code,
          style: TextStyle(
            fontWeight: FontWeight.w900,
            color: selected ? Colors.white : _color,
          ),
        ),
      ),
    );
  }
}

class _SummaryChip extends StatelessWidget {
  const _SummaryChip({
    required this.label,
    required this.value,
    required this.color,
  });

  final String label;
  final int value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        height: 38,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
        ),
        child: Text(
          '$label $value',
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w800,
            color: color,
          ),
        ),
      ),
    );
  }
}

class _PickerButton extends StatelessWidget {
  const _PickerButton({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(16),
      onTap: onTap,
      child: Container(
        height: 46,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Row(
          children: [
            Icon(icon, size: 18, color: const Color(0xFF138F81)),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                label,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF2D3436),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _IconButtonBox extends StatelessWidget {
  const _IconButtonBox({required this.icon, required this.onTap});

  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(16),
      onTap: onTap,
      child: Container(
        width: 46,
        height: 46,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Icon(icon, color: const Color(0xFF138F81)),
      ),
    );
  }
}

class _DropdownBox extends StatelessWidget {
  const _DropdownBox({
    required this.label,
    required this.value,
    required this.items,
    required this.itemLabel,
    required this.onChanged,
  });

  final String label;
  final Map<String, dynamic>? value;
  final List<Map<String, dynamic>> items;
  final String Function(Map<String, dynamic>) itemLabel;
  final ValueChanged<Map<String, dynamic>?> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 52,
      padding: const EdgeInsets.symmetric(horizontal: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<int>(
          isExpanded: true,
          value: value == null ? null : _asInt(value!['id']),
          hint: Text(label, style: const TextStyle(fontSize: 12)),
          items: items
              .map(
                (item) => DropdownMenuItem<int>(
                  value: _asInt(item['id']),
                  child: Text(
                    itemLabel(item),
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 12),
                  ),
                ),
              )
              .toList(),
          onChanged: (id) {
            final matches = items.where((item) => _asInt(item['id']) == id);
            onChanged(matches.isEmpty ? null : matches.first);
          },
        ),
      ),
    );
  }

  int _asInt(dynamic value) {
    if (value is int) return value;
    return int.tryParse(value?.toString() ?? '') ?? 0;
  }
}

class _RoomManageSheet extends StatefulWidget {
  const _RoomManageSheet({required this.complexes});

  final List<Map<String, dynamic>> complexes;

  @override
  State<_RoomManageSheet> createState() => _RoomManageSheetState();
}

class _RoomManageSheetState extends State<_RoomManageSheet> {
  final _complexController = TextEditingController();
  final _roomController = TextEditingController();
  Map<String, dynamic>? _selectedComplex;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _selectedComplex = widget.complexes.isNotEmpty
        ? widget.complexes.first
        : null;
  }

  @override
  void dispose() {
    _complexController.dispose();
    _roomController.dispose();
    super.dispose();
  }

  int _asInt(dynamic value) {
    if (value is int) return value;
    return int.tryParse(value?.toString() ?? '') ?? 0;
  }

  Future<void> _saveComplex() async {
    final name = _complexController.text.trim();
    if (name.isEmpty) return;
    setState(() => _saving = true);
    try {
      await ApiService.createBoardingComplex({'name': name});
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) setState(() => _saving = false);
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Gagal menambah komplek: $e')));
      }
    }
  }

  Future<void> _saveRoom() async {
    final name = _roomController.text.trim();
    final complexId = _asInt(_selectedComplex?['id']);
    if (name.isEmpty || complexId <= 0) return;
    setState(() => _saving = true);
    try {
      await ApiService.createBoardingRoom({
        'boarding_complex_id': complexId,
        'name': name,
      });
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) setState(() => _saving = false);
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Gagal menambah kamar: $e')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(
        20,
        18,
        20,
        MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Kelola Komplek & Kamar',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 14),
          TextField(
            controller: _complexController,
            decoration: InputDecoration(
              labelText: 'Komplek baru',
              suffixIcon: IconButton(
                onPressed: _saving ? null : _saveComplex,
                icon: const Icon(Icons.add_rounded),
              ),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
              ),
            ),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<int>(
            initialValue: _selectedComplex == null
                ? null
                : _asInt(_selectedComplex!['id']),
            decoration: InputDecoration(
              labelText: 'Komplek untuk kamar',
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
              ),
            ),
            items: widget.complexes
                .map(
                  (item) => DropdownMenuItem<int>(
                    value: _asInt(item['id']),
                    child: Text(item['name']?.toString() ?? '-'),
                  ),
                )
                .toList(),
            onChanged: (id) {
              setState(() {
                final matches = widget.complexes.where(
                  (item) => _asInt(item['id']) == id,
                );
                _selectedComplex = matches.isEmpty ? null : matches.first;
              });
            },
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _roomController,
            decoration: InputDecoration(
              labelText: 'Kamar baru',
              suffixIcon: IconButton(
                onPressed: _saving ? null : _saveRoom,
                icon: const Icon(Icons.add_rounded),
              ),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
