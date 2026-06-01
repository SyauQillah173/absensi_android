import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../../services/sync_service.dart';
import '../../widgets/adaptive_bottom_sheet.dart';

class EditMapelScreen extends StatefulWidget {
  final Map<String, dynamic> mapelData;
  const EditMapelScreen({super.key, required this.mapelData});

  @override
  State<EditMapelScreen> createState() => _EditMapelScreenState();
}

class _EditMapelScreenState extends State<EditMapelScreen> {
  static List<Map<String, dynamic>>? _cachedGuruOptions;

  static const List<String> _hariOptions = <String>[
    'Ahad',
    'Senin',
    'Selasa',
    'Rabu',
    'Kamis',
    'Jumat',
    'Sabtu',
  ];

  late TextEditingController _namaController;
  late TextEditingController _kodeController;
  List<Map<String, dynamic>> _assignedGuru = [];
  List<Map<String, dynamic>> _allGuru = [];
  List<Map<String, dynamic>> _kelasOptions = [];
  List<Map<String, dynamic>> _jadwalList = [];
  bool _isLoading = false;
  bool _isHydratingDetail = false;
  bool _isGuruLoading = true;
  bool _guruLoadFailed = false;
  bool _hasLocalGuruDraft = false;
  final Set<String> _busyGuruDeleteKeys = <String>{};
  final Set<String> _busyJadwalKeys = <String>{};

  @override
  void initState() {
    super.initState();
    _namaController = TextEditingController(
      text: widget.mapelData['nama']?.toString() ?? '',
    );
    _kodeController = TextEditingController(
      text: widget.mapelData['kode']?.toString() ?? '',
    );
    _assignedGuru = _normalizeList(widget.mapelData['guru']);
    _jadwalList = _normalizeList(widget.mapelData['jadwal']);
    _loadReferenceData();
    _loadMapelDetail();
  }

  @override
  void dispose() {
    _namaController.dispose();
    _kodeController.dispose();
    super.dispose();
  }

  List<Map<String, dynamic>> _normalizeList(dynamic value) {
    return List<Map<String, dynamic>>.from(
      (value as List? ?? const []).map(
        (item) => Map<String, dynamic>.from(item as Map),
      ),
    );
  }

  List<Map<String, dynamic>> _flattenKelas(dynamic rawGroups) {
    final groups = _normalizeList(rawGroups);
    final flattened = <Map<String, dynamic>>[];

    for (final group in groups) {
      final kategori = group['kategori']?.toString() ?? '';
      final kelasList = _normalizeList(group['kelas']);
      for (final kelas in kelasList) {
        flattened.add({...kelas, 'kategori': kategori});
      }
    }

    flattened.sort((a, b) {
      final kategoriCompare = (a['kategori']?.toString() ?? '').compareTo(
        b['kategori']?.toString() ?? '',
      );
      if (kategoriCompare != 0) return kategoriCompare;
      return (a['nama']?.toString() ?? '').compareTo(
        b['nama']?.toString() ?? '',
      );
    });

    return flattened;
  }

  Future<void> _loadReferenceData() async {
    if (_cachedGuruOptions != null && mounted) {
      setState(() {
        _allGuru = List<Map<String, dynamic>>.from(_cachedGuruOptions!);
        _isGuruLoading = false;
        _guruLoadFailed = false;
      });
    } else if (mounted) {
      setState(() {
        _isGuruLoading = true;
        _guruLoadFailed = false;
      });
    }

    try {
      final result = await ApiService.getKelompokBelajar();
      if (mounted) {
        setState(() => _kelasOptions = _flattenKelas(result['data']));
      }
    } catch (_) {}

    try {
      final result = await ApiService.getGuru();
      if (mounted) {
        final guru = _dedupeGuruList(
          _normalizeList(result['data']),
        ).where((item) => (item['id'] as num?)?.toInt() != null).toList();
        _cachedGuruOptions = List<Map<String, dynamic>>.from(guru);
        setState(() {
          _allGuru = guru;
          _isGuruLoading = false;
          _guruLoadFailed = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _isGuruLoading = false;
          _guruLoadFailed = true;
        });
      }
    }
  }

  void _showSnackBar(
    String message, {
    bool isError = false,
    Duration duration = const Duration(seconds: 2),
  }) {
    if (!mounted) return;
    final messenger = ScaffoldMessenger.of(context);
    messenger.hideCurrentSnackBar();
    messenger.showSnackBar(
      SnackBar(
        content: Text(message),
        duration: duration,
        backgroundColor: isError
            ? const Color(0xFFD63031)
            : const Color(0xFF138F81),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }

  Future<void> _notifyMapelOperationalChanged(String message) async {
    await SyncService.notifyDataChanged(SyncTopics.mapel, message: message);
    await SyncService.notifyDataChanged(SyncTopics.absensi, message: message);
  }

  Future<bool> _persistGuruAssignment(Map<String, dynamic> guru) async {
    final guruId = (guru['id'] as num?)?.toInt();
    if (guruId == null) {
      _showSnackBar(
        'Data guru tidak valid. Muat ulang lalu coba lagi.',
        isError: true,
      );
      return false;
    }

    final nextGuru = _dedupeGuruList([
      ..._assignedGuru,
      Map<String, dynamic>.from(guru),
    ]);

    try {
      final result =
          await ApiService.updateMataPelajaran(widget.mapelData['id'], {
            'guru_ids': nextGuru
                .map((item) => (item['id'] as num?)?.toInt())
                .whereType<int>()
                .toList(),
          });

      final data = result['data'];
      if (!mounted) return false;

      setState(() {
        _hasLocalGuruDraft = false;
        if (data is Map) {
          _applyMapelData(
            Map<String, dynamic>.from(data),
            syncControllers: true,
          );
        } else {
          _assignedGuru = nextGuru;
        }
      });

      await _notifyMapelOperationalChanged(
        'Guru pengajar berhasil ditambahkan',
      );
      _showSnackBar('Guru pengajar berhasil ditambahkan');
      return true;
    } catch (e) {
      _showSnackBar('Gagal menambah guru pengajar: $e', isError: true);
      return false;
    }
  }

  void _applyMapelData(
    Map<String, dynamic> mapel, {
    bool syncControllers = false,
    bool preserveLocalGuruDraft = false,
  }) {
    if (syncControllers) {
      _namaController.text = mapel['nama']?.toString() ?? _namaController.text;
      _kodeController.text = mapel['kode']?.toString() ?? _kodeController.text;
    }

    if (!preserveLocalGuruDraft) {
      _assignedGuru = _dedupeGuruList(_normalizeList(mapel['guru']));
    }
    _jadwalList = _dedupeJadwalList(
      _normalizeList(
        mapel['jadwal'],
      ).where((item) => item['status']?.toString() != 'Nonaktif').toList(),
    );
  }

  List<Map<String, dynamic>> _dedupeGuruList(List<Map<String, dynamic>> data) {
    final unique = <String, Map<String, dynamic>>{};
    for (final item in data) {
      final id = (item['id'] as num?)?.toInt();
      final key = id != null
          ? 'id:$id'
          : 'name:${item['name']?.toString().trim().toLowerCase() ?? ''}';
      unique[key] = Map<String, dynamic>.from(item);
    }
    final values = unique.values.toList()
      ..sort((a, b) {
        final left = a['name']?.toString() ?? '';
        final right = b['name']?.toString() ?? '';
        return left.compareTo(right);
      });
    return values;
  }

  List<Map<String, dynamic>> _dedupeJadwalList(
    List<Map<String, dynamic>> data,
  ) {
    final unique = <String, Map<String, dynamic>>{};
    for (final item in data) {
      final id = (item['id'] as num?)?.toInt();
      final key = id != null
          ? 'id:$id'
          : [
              item['guru']?.toString().trim().toLowerCase() ?? '',
              item['hari']?.toString().trim().toLowerCase() ?? '',
              item['jam_mulai']?.toString().trim() ?? '',
              item['jam_selesai']?.toString().trim() ?? '',
              item['sifir']?.toString().trim().toLowerCase() ?? '',
            ].join('|');
      unique[key] = Map<String, dynamic>.from(item);
    }
    final values = unique.values.toList()
      ..sort((a, b) {
        final leftKey = _scheduleGroupKey(a);
        final rightKey = _scheduleGroupKey(b);
        return leftKey.compareTo(rightKey);
      });
    return values;
  }

  Future<void> _loadMapelDetail() async {
    if (_isHydratingDetail) return;
    _isHydratingDetail = true;
    try {
      final result = await ApiService.getMataPelajaranDetail(
        widget.mapelData['id'] as int,
      );
      final data = result['data'];
      if (!mounted || data is! Map) return;
      setState(() {
        _applyMapelData(
          Map<String, dynamic>.from(data),
          syncControllers: true,
          preserveLocalGuruDraft: _hasLocalGuruDraft,
        );
      });
    } catch (_) {
      // biarkan memakai snapshot awal jika detail gagal dimuat
    } finally {
      _isHydratingDetail = false;
    }
  }

  String _guruBusyKey(Map<String, dynamic> guru) {
    final guruId = (guru['id'] as num?)?.toInt();
    final guruName = guru['name']?.toString().trim() ?? '';
    return guruId != null ? 'id:$guruId' : 'name:$guruName';
  }

  Future<void> _removeAssignedGuru(Map<String, dynamic> guru) async {
    final guruId = (guru['id'] as num?)?.toInt();
    final guruName = guru['name']?.toString().trim() ?? '';
    final busyKey = _guruBusyKey(guru);
    if (_busyGuruDeleteKeys.contains(busyKey)) return;

    final nextGuru = _assignedGuru.where((item) {
      final itemId = (item['id'] as num?)?.toInt();
      final itemName = item['name']?.toString().trim() ?? '';
      if (guruId != null && itemId != null) {
        return itemId != guruId;
      }
      return itemName != guruName;
    }).toList();

    if (nextGuru.length == _assignedGuru.length) return;

    setState(() {
      _busyGuruDeleteKeys.add(busyKey);
    });

    try {
      final result =
          await ApiService.updateMataPelajaran(widget.mapelData['id'], {
            'guru_ids': nextGuru
                .map((item) => (item['id'] as num?)?.toInt())
                .whereType<int>()
                .toList(),
          });

      final data = result['data'];
      if (!mounted) return;

      setState(() {
        _hasLocalGuruDraft = false;
        if (data is Map) {
          _applyMapelData(
            Map<String, dynamic>.from(data),
            syncControllers: true,
          );
          _jadwalList = _jadwalList
              .where((item) => !_jadwalBelongsToGuru(item, guruId, guruName))
              .toList();
        } else {
          _assignedGuru = _dedupeGuruList(nextGuru);
          _jadwalList = _jadwalList
              .where((item) => !_jadwalBelongsToGuru(item, guruId, guruName))
              .toList();
        }
        _busyJadwalKeys.clear();
      });

      await _notifyMapelOperationalChanged('Guru pengajar berhasil dihapus');
      _showSnackBar(
        'Guru pengajar berhasil dihapus',
        duration: const Duration(milliseconds: 1400),
      );
    } catch (e) {
      _showSnackBar('Gagal menghapus guru pengajar: $e', isError: true);
    } finally {
      if (mounted) {
        setState(() => _busyGuruDeleteKeys.remove(busyKey));
      }
    }
  }

  String _jadwalBusyKeyFromIds(Iterable<int> ids) {
    final normalized = ids.toList()..sort();
    if (normalized.isEmpty) {
      return 'new';
    }
    return normalized.join('-');
  }

  bool _jadwalBelongsToGuru(
    Map<String, dynamic> jadwal,
    int? guruId,
    String guruName,
  ) {
    final teacherId = (jadwal['teacher_id'] as num?)?.toInt();
    if (guruId != null && teacherId != null && teacherId == guruId) {
      return true;
    }

    final jadwalGuru = jadwal['guru']?.toString().trim().toLowerCase() ?? '';
    return guruName.isNotEmpty && jadwalGuru == guruName.toLowerCase();
  }

  String _jadwalBusyKeyFromGroup(Map<String, dynamic> group) {
    final items = List<Map<String, dynamic>>.from(
      group['items'] as List? ?? [],
    );
    final ids = items
        .map((item) => (item['id'] as num?)?.toInt())
        .whereType<int>();
    return _jadwalBusyKeyFromIds(ids);
  }

  Future<void> _syncGuruAssignmentsIfNeeded(
    List<Map<String, dynamic>> teacherOptions,
    String guruName,
  ) async {
    Map<String, dynamic>? chosenTeacher;
    for (final teacher in teacherOptions) {
      if (teacher['name']?.toString() == guruName) {
        chosenTeacher = teacher;
        break;
      }
    }

    final teacherId = (chosenTeacher?['id'] as num?)?.toInt();
    if (teacherId == null) {
      return;
    }

    final alreadyAssigned = _assignedGuru.any((guru) {
      return (guru['id'] as num?)?.toInt() == teacherId;
    });
    if (alreadyAssigned && !_hasLocalGuruDraft) {
      return;
    }

    final nextGuru = alreadyAssigned
        ? _assignedGuru
        : [..._assignedGuru, Map<String, dynamic>.from(chosenTeacher!)];

    final result =
        await ApiService.updateMataPelajaran(widget.mapelData['id'], {
          'guru_ids': nextGuru
              .map((guru) => (guru['id'] as num?)?.toInt())
              .whereType<int>()
              .toList(),
        });

    final data = result['data'];
    if (!mounted || data is! Map) return;

    setState(() {
      _hasLocalGuruDraft = false;
      _applyMapelData(Map<String, dynamic>.from(data), syncControllers: true);
    });
  }

  List<String> get _kelasNames {
    final names =
        _kelasOptions
            .map((kelas) => kelas['nama']?.toString().trim() ?? '')
            .where((name) => name.isNotEmpty)
            .toSet()
            .toList()
          ..sort();
    return names;
  }

  String _normalizeScheduleValue(dynamic value) {
    return (value?.toString() ?? '').trim().toLowerCase();
  }

  String _scheduleGroupKey(Map<String, dynamic> jadwal) {
    return [
      _normalizeScheduleValue(jadwal['guru']),
      _normalizeScheduleValue(_canonicalHari(jadwal['hari'])),
      _normalizeScheduleValue(jadwal['jam_mulai']),
      _normalizeScheduleValue(jadwal['jam_selesai']),
    ].join('|');
  }

  List<Map<String, dynamic>> _schedulesInGroup(Map<String, dynamic> jadwal) {
    final targetKey = _scheduleGroupKey(jadwal);
    return _jadwalList
        .where((item) => _scheduleGroupKey(item) == targetKey)
        .map((item) => Map<String, dynamic>.from(item))
        .toList();
  }

  List<Map<String, dynamic>> _groupedJadwalList() {
    final grouped = <String, List<Map<String, dynamic>>>{};
    for (final jadwal in _jadwalList) {
      final key = _scheduleGroupKey(jadwal);
      grouped.putIfAbsent(key, () => []).add(Map<String, dynamic>.from(jadwal));
    }

    final allClasses = _kelasNames.toSet();
    final groups = grouped.values.map((items) {
      items.sort((a, b) {
        final classA = a['sifir']?.toString() ?? '';
        final classB = b['sifir']?.toString() ?? '';
        return classA.compareTo(classB);
      });
      final kelasList =
          items
              .map((item) => item['sifir']?.toString().trim() ?? '')
              .where((name) => name.isNotEmpty)
              .toSet()
              .toList()
            ..sort();

      return {
        'primary': items.first,
        'items': items,
        'kelas_list': kelasList,
        'is_all_kelas':
            allClasses.isNotEmpty &&
            kelasList.length == allClasses.length &&
            allClasses.every(kelasList.contains),
      };
    }).toList();

    groups.sort((a, b) {
      final left = Map<String, dynamic>.from(a['primary'] as Map);
      final right = Map<String, dynamic>.from(b['primary'] as Map);
      final dayCompare = _compareHari(
        left['hari']?.toString(),
        right['hari']?.toString(),
      );
      if (dayCompare != 0) return dayCompare;
      return (left['jam_mulai']?.toString() ?? '').compareTo(
        right['jam_mulai']?.toString() ?? '',
      );
    });

    return groups;
  }

  String _formatKelasSummary(
    List<String> kelasList, {
    required bool isAllKelas,
  }) {
    if (kelasList.isEmpty) {
      return '-';
    }
    if (isAllKelas) {
      return 'Semua Kelas';
    }
    if (kelasList.length <= 2) {
      return kelasList.join(', ');
    }
    return '${kelasList.take(2).join(', ')} +${kelasList.length - 2} kelas';
  }

  String _kelasSelectionLabel(
    Set<String> selectedKelas, {
    required bool isAllKelas,
  }) {
    final kelasList = selectedKelas.toList()..sort();
    if (kelasList.isEmpty) {
      return 'Pilih kelas';
    }
    if (isAllKelas) {
      return 'Semua Kelas';
    }
    if (kelasList.length == 1) {
      return kelasList.first;
    }
    return '${kelasList.length} kelas dipilih';
  }

  Map<String, List<Map<String, dynamic>>> _kelasByKategori({
    String searchQuery = '',
  }) {
    final grouped = <String, List<Map<String, dynamic>>>{};
    final normalizedQuery = searchQuery.trim().toLowerCase();

    for (final kelas in _kelasOptions) {
      final nama = kelas['nama']?.toString() ?? '';
      if (normalizedQuery.isNotEmpty &&
          !nama.toLowerCase().contains(normalizedQuery)) {
        continue;
      }
      final kategori = kelas['kategori']?.toString().trim();
      final key = (kategori == null || kategori.isEmpty) ? 'Lainnya' : kategori;
      grouped.putIfAbsent(key, () => []).add(kelas);
    }

    final sortedKeys = grouped.keys.toList()..sort();
    return {
      for (final key in sortedKeys)
        key: (grouped[key]!
          ..sort((a, b) {
            final left = a['nama']?.toString() ?? '';
            final right = b['nama']?.toString() ?? '';
            return left.compareTo(right);
          })),
    };
  }

  Future<_KelasSelectionResult?> _showKelasSelectorSheet({
    required Set<String> initialSelection,
    required bool initialAllClasses,
  }) async {
    final searchController = TextEditingController();
    final workingSelection = <String>{...initialSelection};
    var applyToAll = initialAllClasses;
    var searchQuery = '';

    final result = await showModalBottomSheet<_KelasSelectionResult>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) => StatefulBuilder(
        builder: (sheetContext, setSheetState) {
          final grouped = _kelasByKategori(searchQuery: searchQuery);
          final visibleCount = grouped.values.fold<int>(
            0,
            (total, items) => total + items.length,
          );

          return Container(
            height: MediaQuery.of(sheetContext).size.height * 0.78,
            padding: EdgeInsets.fromLTRB(
              20,
              18,
              20,
              MediaQuery.of(sheetContext).viewInsets.bottom + 20,
            ),
            decoration: const BoxDecoration(
              color: Color(0xFFE1EFF7),
              borderRadius: BorderRadius.vertical(top: Radius.circular(30)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Container(
                    width: 42,
                    height: 4,
                    decoration: BoxDecoration(
                      color: Colors.grey[400],
                      borderRadius: BorderRadius.circular(999),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                const Text(
                  'Pilih Kelas',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF2D3436),
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  applyToAll
                      ? 'Assignment akan diterapkan ke semua kelas aktif.'
                      : _kelasSelectionLabel(
                          workingSelection,
                          isAllKelas: false,
                        ),
                  style: const TextStyle(
                    fontSize: 12,
                    color: Color(0xFF636E72),
                  ),
                ),
                const SizedBox(height: 14),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(18),
                  ),
                  child: Row(
                    children: [
                      const Icon(
                        Icons.search_rounded,
                        size: 20,
                        color: Color(0xFF636E72),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: TextField(
                          controller: searchController,
                          onChanged: (value) {
                            setSheetState(() => searchQuery = value);
                          },
                          decoration: const InputDecoration(
                            border: InputBorder.none,
                            hintText: 'Cari kelas...',
                            hintStyle: TextStyle(
                              fontSize: 13,
                              color: Color(0xFF636E72),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 14),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(18),
                  ),
                  child: InkWell(
                    onTap: () {
                      setSheetState(() {
                        applyToAll = !applyToAll;
                        if (applyToAll) {
                          workingSelection
                            ..clear()
                            ..addAll(_kelasNames);
                        } else if (workingSelection.isEmpty &&
                            _kelasNames.isNotEmpty) {
                          workingSelection.add(_kelasNames.first);
                        }
                      });
                    },
                    borderRadius: BorderRadius.circular(14),
                    child: Row(
                      children: [
                        Icon(
                          applyToAll
                              ? Icons.check_circle_rounded
                              : Icons.radio_button_unchecked_rounded,
                          color: applyToAll
                              ? const Color(0xFF138F81)
                              : const Color(0xFF636E72),
                        ),
                        const SizedBox(width: 10),
                        const Expanded(
                          child: Text(
                            'Semua Kelas',
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF2D3436),
                            ),
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 5,
                          ),
                          decoration: BoxDecoration(
                            color: const Color(
                              0xFFFFDC80,
                            ).withValues(alpha: 0.6),
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text(
                            '${_kelasNames.length} kelas',
                            style: const TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF2D3436),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Expanded(
                  child: Container(
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.72),
                      borderRadius: BorderRadius.circular(22),
                    ),
                    child: visibleCount == 0
                        ? const Center(
                            child: Text(
                              'Tidak ada kelas yang cocok dengan pencarian',
                              style: TextStyle(
                                fontSize: 12,
                                color: Color(0xFF636E72),
                              ),
                            ),
                          )
                        : ListView(
                            padding: const EdgeInsets.fromLTRB(14, 14, 14, 8),
                            children: grouped.entries.map((entry) {
                              return Padding(
                                padding: const EdgeInsets.only(bottom: 14),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      entry.key,
                                      style: const TextStyle(
                                        fontSize: 12,
                                        fontWeight: FontWeight.w700,
                                        color: Color(0xFF636E72),
                                      ),
                                    ),
                                    const SizedBox(height: 8),
                                    ...entry.value.map((kelas) {
                                      final kelasName =
                                          kelas['nama']?.toString() ?? '';
                                      final isSelected =
                                          applyToAll ||
                                          workingSelection.contains(kelasName);
                                      return Padding(
                                        padding: const EdgeInsets.only(
                                          bottom: 8,
                                        ),
                                        child: Material(
                                          color: Colors.white,
                                          borderRadius: BorderRadius.circular(
                                            14,
                                          ),
                                          child: InkWell(
                                            onTap: () {
                                              setSheetState(() {
                                                if (applyToAll) {
                                                  applyToAll = false;
                                                  workingSelection
                                                    ..clear()
                                                    ..addAll(_kelasNames);
                                                }

                                                if (workingSelection.contains(
                                                  kelasName,
                                                )) {
                                                  if (workingSelection.length >
                                                      1) {
                                                    workingSelection.remove(
                                                      kelasName,
                                                    );
                                                  }
                                                } else {
                                                  workingSelection.add(
                                                    kelasName,
                                                  );
                                                }
                                              });
                                            },
                                            borderRadius: BorderRadius.circular(
                                              14,
                                            ),
                                            child: Padding(
                                              padding:
                                                  const EdgeInsets.symmetric(
                                                    horizontal: 14,
                                                    vertical: 12,
                                                  ),
                                              child: Row(
                                                children: [
                                                  Icon(
                                                    isSelected
                                                        ? Icons
                                                              .check_circle_rounded
                                                        : Icons
                                                              .radio_button_unchecked_rounded,
                                                    size: 20,
                                                    color: isSelected
                                                        ? const Color(
                                                            0xFF138F81,
                                                          )
                                                        : const Color(
                                                            0xFFB2BEC3,
                                                          ),
                                                  ),
                                                  const SizedBox(width: 10),
                                                  Expanded(
                                                    child: Text(
                                                      kelasName,
                                                      style: const TextStyle(
                                                        fontSize: 13,
                                                        fontWeight:
                                                            FontWeight.w600,
                                                        color: Color(
                                                          0xFF2D3436,
                                                        ),
                                                      ),
                                                    ),
                                                  ),
                                                ],
                                              ),
                                            ),
                                          ),
                                        ),
                                      );
                                    }),
                                  ],
                                ),
                              );
                            }).toList(),
                          ),
                  ),
                ),
                const SizedBox(height: 14),
                SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: ElevatedButton(
                    onPressed: () {
                      final selected =
                          applyToAll ? _kelasNames : workingSelection.toList()
                            ..sort();
                      Navigator.pop(
                        sheetContext,
                        _KelasSelectionResult(
                          selectedKelas: selected,
                          applyToAllKelas: applyToAll,
                        ),
                      );
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF138F81),
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                      elevation: 0,
                    ),
                    child: const Text(
                      'Terapkan Pilihan Kelas',
                      style: TextStyle(fontWeight: FontWeight.w700),
                    ),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );

    searchController.dispose();
    return result;
  }

  Future<void> _handleSimpan() async {
    if (_namaController.text.trim().isEmpty) {
      _showSnackBar('Nama mapel wajib diisi!', isError: true);
      return;
    }
    setState(() => _isLoading = true);
    try {
      final result =
          await ApiService.updateMataPelajaran(widget.mapelData['id'], {
            'nama': _namaController.text.trim().toUpperCase(),
            'kode': _kodeController.text.trim().isNotEmpty
                ? _kodeController.text.trim().toUpperCase()
                : null,
            'guru_ids': _assignedGuru
                .map((guru) => (guru['id'] as num?)?.toInt())
                .whereType<int>()
                .toList(),
          });
      final updated = result['data'];
      await _notifyMapelOperationalChanged(
        'Data mata pelajaran telah diperbarui',
      );
      if (!mounted) return;
      if (updated is Map) {
        _hasLocalGuruDraft = false;
        Navigator.pop(context, Map<String, dynamic>.from(updated));
        return;
      }
      _hasLocalGuruDraft = false;
      Navigator.pop(context, true);
      return;
    } catch (e) {
      _showSnackBar('Gagal: $e', isError: true);
    }
    if (mounted) {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _showAddGuruDialog() async {
    if (_isGuruLoading) {
      _showSnackBar('Data guru aktif sedang dimuat...');
      return;
    }

    if (_guruLoadFailed && _allGuru.isEmpty) {
      _showSnackBar('Memuat ulang data guru aktif...');
      await _loadReferenceData();
      if (!mounted || _isGuruLoading) return;
    }

    if (_allGuru.isEmpty) {
      _showSnackBar(
        'Data guru aktif belum tersedia. Periksa koneksi lalu coba lagi.',
        isError: true,
      );
      return;
    }

    final availableGuru = _allGuru.where((g) {
      final guruId = (g['id'] as num?)?.toInt();
      if (guruId == null) return false;
      return !_assignedGuru.any((a) => (a['id'] as num?)?.toInt() == guruId);
    }).toList();

    if (availableGuru.isEmpty) {
      _showSnackBar('Semua guru sudah ditambahkan', isError: true);
      return;
    }

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        int? savingGuruId;
        return StatefulBuilder(
          builder: (ctx, setSheetState) => AdaptiveBottomSheet(
            maxHeightFactor: 0.86,
            padding: const EdgeInsets.fromLTRB(24, 20, 24, 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: Colors.grey[400],
                      borderRadius: BorderRadius.circular(999),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                const Text(
                  'Tambah Guru Pengajar',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF2D3436),
                  ),
                ),
                const SizedBox(height: 16),
                ...availableGuru.map((guru) {
                  final guruId = (guru['id'] as num?)?.toInt();
                  final isSaving =
                      savingGuruId != null && savingGuruId == guruId;
                  return ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: CircleAvatar(
                      backgroundColor: const Color(
                        0xFF138F81,
                      ).withValues(alpha: 0.12),
                      child: const Icon(
                        Icons.person_rounded,
                        size: 20,
                        color: Color(0xFF138F81),
                      ),
                    ),
                    title: Text(
                      guru['name'] ?? '',
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    subtitle: Text(
                      'NIS: ${guru['nis'] ?? '-'}',
                      style: const TextStyle(
                        fontSize: 11,
                        color: Color(0xFF636E72),
                      ),
                    ),
                    trailing: isSaving
                        ? const SizedBox(
                            width: 22,
                            height: 22,
                            child: CircularProgressIndicator(
                              strokeWidth: 2.4,
                              color: Color(0xFF138F81),
                            ),
                          )
                        : IconButton(
                            onPressed: savingGuruId != null
                                ? null
                                : () async {
                                    setSheetState(() => savingGuruId = guruId);
                                    final saved = await _persistGuruAssignment(
                                      guru,
                                    );
                                    if (!ctx.mounted) return;
                                    if (saved) {
                                      Navigator.pop(ctx);
                                      return;
                                    }
                                    setSheetState(() => savingGuruId = null);
                                  },
                            icon: const Icon(
                              Icons.add_circle_rounded,
                              color: Color(0xFF138F81),
                            ),
                          ),
                  );
                }),
              ],
            ),
          ),
        );
      },
    );
  }

  List<Map<String, dynamic>> _teacherOptionsForSchedule(
    Map<String, dynamic>? jadwal,
  ) {
    final options = List<Map<String, dynamic>>.from(_assignedGuru);

    options.sort((a, b) {
      return (a['name']?.toString() ?? '').compareTo(
        b['name']?.toString() ?? '',
      );
    });

    return options;
  }

  String? _resolveSelectedGuruName(
    Map<String, dynamic>? jadwal,
    List<Map<String, dynamic>> teacherOptions,
  ) {
    final scheduleTeacher = jadwal?['guru']?.toString().trim() ?? '';
    final optionNames = teacherOptions
        .map((item) => item['name']?.toString().trim() ?? '')
        .toSet();

    if (scheduleTeacher.isNotEmpty && optionNames.contains(scheduleTeacher)) {
      return scheduleTeacher;
    }
    if (_assignedGuru.length == 1) {
      return _assignedGuru.first['name']?.toString();
    }
    if (teacherOptions.isNotEmpty) {
      return teacherOptions.first['name']?.toString();
    }
    return null;
  }

  int? _teacherIdForName(
    List<Map<String, dynamic>> teacherOptions,
    String guruName,
  ) {
    final normalized = guruName.trim().toLowerCase();
    for (final teacher in teacherOptions) {
      final name = teacher['name']?.toString().trim().toLowerCase() ?? '';
      if (name == normalized) {
        return (teacher['id'] as num?)?.toInt();
      }
    }
    return null;
  }

  Future<void> _showEditJadwalDialog(Map<String, dynamic>? jadwal) async {
    if (_assignedGuru.isEmpty &&
        (jadwal?['guru']?.toString().trim().isEmpty ?? true)) {
      _showSnackBar(
        'Tambahkan guru pengajar terlebih dahulu sebelum membuat jadwal',
        isError: true,
      );
      return;
    }

    if (_kelasOptions.isEmpty &&
        (jadwal?['sifir']?.toString().trim().isEmpty ?? true)) {
      _showSnackBar(
        'Data kelas belum tersedia. Coba tunggu sebentar lalu buka lagi.',
        isError: true,
      );
      return;
    }

    String selectedHari = _canonicalHari(jadwal?['hari']) ?? 'Senin';
    final jamMulaiController = TextEditingController(
      text: jadwal?['jam_mulai']?.toString() ?? '08:00',
    );
    final jamSelesaiController = TextEditingController(
      text: jadwal?['jam_selesai']?.toString() ?? '09:30',
    );
    final teacherOptions = _teacherOptionsForSchedule(jadwal);
    String? selectedGuruName = _resolveSelectedGuruName(jadwal, teacherOptions);
    final groupedSchedules = jadwal != null
        ? _schedulesInGroup(jadwal)
        : const [];
    final initialKelas = groupedSchedules.isNotEmpty
        ? groupedSchedules
              .map((item) => item['sifir']?.toString().trim() ?? '')
              .where((name) => name.isNotEmpty)
              .toSet()
              .toList()
        : [
            jadwal?['sifir']?.toString().trim() ?? '',
          ].where((name) => name.isNotEmpty).toList();
    final selectedKelasNames = <String>{...initialKelas};
    if (selectedKelasNames.isEmpty && _kelasNames.isNotEmpty) {
      selectedKelasNames.add(_kelasNames.first);
    }
    bool applyToAllKelas =
        _kelasNames.isNotEmpty &&
        selectedKelasNames.length == _kelasNames.length &&
        _kelasNames.every(selectedKelasNames.contains);

    try {
      final draft = await showModalBottomSheet<_JadwalDraft>(
        context: context,
        isScrollControlled: true,
        backgroundColor: Colors.transparent,
        builder: (ctx) => StatefulBuilder(
          builder: (ctx, setModalState) {
            return AdaptiveBottomSheet(
              scrollable: false,
              maxHeightFactor: 0.9,
              padding: const EdgeInsets.fromLTRB(24, 20, 24, 24),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Center(
                      child: Container(
                        width: 40,
                        height: 4,
                        decoration: BoxDecoration(
                          color: Colors.grey[400],
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      jadwal != null ? 'Edit Jadwal' : 'Tambah Jadwal',
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF2D3436),
                      ),
                    ),
                    const SizedBox(height: 16),
                    const Text(
                      'Guru Pengajar',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF636E72),
                      ),
                    ),
                    const SizedBox(height: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: DropdownButtonHideUnderline(
                        child: DropdownButton<String>(
                          isExpanded: true,
                          value: selectedGuruName,
                          hint: const Text('Pilih guru pengajar'),
                          items: teacherOptions.map((guru) {
                            final name = guru['name']?.toString() ?? '';
                            return DropdownMenuItem<String>(
                              value: name,
                              child: Text(
                                name,
                                style: const TextStyle(fontSize: 14),
                              ),
                            );
                          }).toList(),
                          onChanged: (value) {
                            setModalState(() => selectedGuruName = value);
                          },
                        ),
                      ),
                    ),
                    const SizedBox(height: 14),
                    const Text(
                      'Kelas',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF636E72),
                      ),
                    ),
                    const SizedBox(height: 6),
                    Material(
                      color: Colors.transparent,
                      child: InkWell(
                        onTap: () async {
                          final result = await _showKelasSelectorSheet(
                            initialSelection: selectedKelasNames,
                            initialAllClasses: applyToAllKelas,
                          );
                          if (result == null) return;
                          setModalState(() {
                            applyToAllKelas = result.applyToAllKelas;
                            selectedKelasNames
                              ..clear()
                              ..addAll(result.selectedKelas);
                          });
                        },
                        borderRadius: BorderRadius.circular(18),
                        child: Ink(
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(18),
                            border: Border.all(
                              color: const Color(
                                0xFF138F81,
                              ).withValues(alpha: 0.14),
                            ),
                          ),
                          child: Row(
                            children: [
                              Container(
                                width: 40,
                                height: 40,
                                decoration: BoxDecoration(
                                  color: const Color(
                                    0xFF138F81,
                                  ).withValues(alpha: 0.12),
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: const Icon(
                                  Icons.meeting_room_rounded,
                                  color: Color(0xFF138F81),
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      _kelasSelectionLabel(
                                        selectedKelasNames,
                                        isAllKelas: applyToAllKelas,
                                      ),
                                      style: const TextStyle(
                                        fontSize: 14,
                                        fontWeight: FontWeight.w700,
                                        color: Color(0xFF2D3436),
                                      ),
                                    ),
                                    const SizedBox(height: 3),
                                    Text(
                                      applyToAllKelas
                                          ? 'Menjangkau seluruh kelas aktif'
                                          : _formatKelasSummary(
                                              selectedKelasNames.toList()
                                                ..sort(),
                                              isAllKelas: false,
                                            ),
                                      style: const TextStyle(
                                        fontSize: 11,
                                        color: Color(0xFF636E72),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              const Icon(
                                Icons.keyboard_arrow_down_rounded,
                                color: Color(0xFF636E72),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        if (applyToAllKelas)
                          _KelasPreviewChip(
                            label: 'Semua Kelas',
                            color: const Color(0xFF138F81),
                          )
                        else
                          ...(() {
                            final labels = selectedKelasNames.toList()..sort();
                            final visible = labels.take(3).toList();
                            final extra = labels.length - visible.length;
                            return [
                              ...visible.map(
                                (kelas) => _KelasPreviewChip(
                                  label: kelas,
                                  color: const Color(0xFFFFB84D),
                                ),
                              ),
                              if (extra > 0)
                                _KelasPreviewChip(
                                  label: '+$extra kelas lagi',
                                  color: const Color(0xFFB2BEC3),
                                ),
                            ];
                          })(),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      applyToAllKelas
                          ? 'Assignment ini akan berlaku ke semua kelas aktif.'
                          : '${selectedKelasNames.length} kelas dipilih untuk assignment ini.',
                      style: const TextStyle(
                        fontSize: 11,
                        color: Color(0xFF636E72),
                      ),
                    ),
                    const SizedBox(height: 14),
                    const Text(
                      'Hari',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF636E72),
                      ),
                    ),
                    const SizedBox(height: 6),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: _hariOptions.map((hari) {
                        final isSelected = selectedHari == hari;
                        return GestureDetector(
                          onTap: () => setModalState(() => selectedHari = hari),
                          child: AnimatedContainer(
                            duration: const Duration(milliseconds: 200),
                            padding: const EdgeInsets.symmetric(
                              horizontal: 14,
                              vertical: 10,
                            ),
                            decoration: BoxDecoration(
                              color: isSelected
                                  ? const Color(0xFF138F81)
                                  : Colors.white,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Text(
                              hari,
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                                color: isSelected
                                    ? Colors.white
                                    : const Color(0xFF2D3436),
                              ),
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                    const SizedBox(height: 14),
                    Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'Jam Mulai',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                  color: Color(0xFF636E72),
                                ),
                              ),
                              const SizedBox(height: 6),
                              GestureDetector(
                                onTap: () async {
                                  final parts = jamMulaiController.text.split(
                                    ':',
                                  );
                                  final time = await showTimePicker(
                                    context: ctx,
                                    initialTime: TimeOfDay(
                                      hour: int.tryParse(parts[0]) ?? 8,
                                      minute: int.tryParse(parts[1]) ?? 0,
                                    ),
                                  );
                                  if (time != null) {
                                    setModalState(() {
                                      jamMulaiController.text =
                                          '${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}';
                                    });
                                  }
                                },
                                child: AbsorbPointer(
                                  child: TextField(
                                    controller: jamMulaiController,
                                    decoration: InputDecoration(
                                      filled: true,
                                      fillColor: Colors.white,
                                      border: OutlineInputBorder(
                                        borderRadius: BorderRadius.circular(14),
                                        borderSide: BorderSide.none,
                                      ),
                                      suffixIcon: const Icon(
                                        Icons.access_time_rounded,
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'Jam Selesai',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                  color: Color(0xFF636E72),
                                ),
                              ),
                              const SizedBox(height: 6),
                              GestureDetector(
                                onTap: () async {
                                  final parts = jamSelesaiController.text.split(
                                    ':',
                                  );
                                  final time = await showTimePicker(
                                    context: ctx,
                                    initialTime: TimeOfDay(
                                      hour: int.tryParse(parts[0]) ?? 9,
                                      minute: int.tryParse(parts[1]) ?? 30,
                                    ),
                                  );
                                  if (time != null) {
                                    setModalState(() {
                                      jamSelesaiController.text =
                                          '${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}';
                                    });
                                  }
                                },
                                child: AbsorbPointer(
                                  child: TextField(
                                    controller: jamSelesaiController,
                                    decoration: InputDecoration(
                                      filled: true,
                                      fillColor: Colors.white,
                                      border: OutlineInputBorder(
                                        borderRadius: BorderRadius.circular(14),
                                        borderSide: BorderSide.none,
                                      ),
                                      suffixIcon: const Icon(
                                        Icons.access_time_rounded,
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 20),
                    SizedBox(
                      width: double.infinity,
                      height: 48,
                      child: ElevatedButton(
                        onPressed: () {
                          if ((selectedGuruName ?? '').trim().isEmpty) {
                            _showSnackBar(
                              'Pilih guru pengajar untuk jadwal ini',
                              isError: true,
                            );
                            return;
                          }
                          if (!applyToAllKelas && selectedKelasNames.isEmpty) {
                            _showSnackBar(
                              'Pilih minimal satu kelas untuk jadwal ini',
                              isError: true,
                            );
                            return;
                          }

                          final kelas =
                              (applyToAllKelas
                                    ? _kelasNames
                                    : selectedKelasNames.toList())
                                ..sort();
                          final currentIds = groupedSchedules
                              .map((item) => (item['id'] as num?)?.toInt())
                              .whereType<int>()
                              .toList();

                          Navigator.pop(
                            ctx,
                            _JadwalDraft(
                              guruName: selectedGuruName!.trim(),
                              teacherId: _teacherIdForName(
                                teacherOptions,
                                selectedGuruName!.trim(),
                              ),
                              hari: selectedHari,
                              jamMulai: jamMulaiController.text.trim(),
                              jamSelesai: jamSelesaiController.text.trim(),
                              kelas: kelas,
                              currentIds: currentIds,
                              teacherOptions: teacherOptions,
                              isEditing: jadwal != null,
                            ),
                          );
                        },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF138F81),
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(16),
                          ),
                          elevation: 0,
                        ),
                        child: Text(
                          jadwal != null ? 'Update Jadwal' : 'Tambah Jadwal',
                          style: const TextStyle(fontWeight: FontWeight.w700),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        ),
      );

      if (draft == null || !mounted) {
        return;
      }

      final busyKey = _jadwalBusyKeyFromIds(draft.currentIds);
      setState(() => _busyJadwalKeys.add(busyKey));

      try {
        await _syncGuruAssignmentsIfNeeded(
          draft.teacherOptions,
          draft.guruName,
        );

        final result = await ApiService.syncJadwalGroup({
          'mapel_id': widget.mapelData['id'],
          if (draft.teacherId != null) 'teacher_id': draft.teacherId,
          'guru': draft.guruName,
          'hari': draft.hari,
          'jam_mulai': draft.jamMulai,
          'jam_selesai': draft.jamSelesai,
          'kelas': draft.kelas,
          'status': 'Aktif',
          'current_ids': draft.currentIds,
        });

        final updated = result['data'];
        if (updated is Map && mounted) {
          setState(() {
            _applyMapelData(
              Map<String, dynamic>.from(updated),
              syncControllers: true,
              preserveLocalGuruDraft: _hasLocalGuruDraft,
            );
          });
        }

        await _notifyMapelOperationalChanged(
          'Jadwal mata pelajaran telah diperbarui',
        );
        _showSnackBar(
          'Jadwal berhasil ${draft.isEditing ? 'diupdate' : 'ditambahkan'}!',
        );
      } catch (e) {
        _showSnackBar('Gagal: $e', isError: true);
      } finally {
        if (mounted) {
          setState(() => _busyJadwalKeys.remove(busyKey));
        }
      }
    } finally {
      jamMulaiController.dispose();
      jamSelesaiController.dispose();
    }
  }

  Future<void> _deleteJadwalGroup(Map<String, dynamic> group) async {
    final items = List<Map<String, dynamic>>.from(
      group['items'] as List? ?? [],
    );
    final jadwalIds = items
        .map((item) => (item['id'] as num?)?.toInt())
        .whereType<int>()
        .toList();
    if (jadwalIds.isEmpty) return;

    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('Hapus Jadwal?'),
        content: const Text(
          'Jadwal yang dipilih akan dihapus dari mata pelajaran ini.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Batal'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFD63031),
            ),
            child: const Text('Hapus', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirm != true || !mounted) return;

    final busyKey = _jadwalBusyKeyFromIds(jadwalIds);
    setState(() => _busyJadwalKeys.add(busyKey));

    try {
      final result = await ApiService.deleteJadwalGroup({
        'mapel_id': widget.mapelData['id'],
        'jadwal_ids': jadwalIds,
      });
      final updated = result['data'];
      if (updated is Map && mounted) {
        setState(() {
          _applyMapelData(
            Map<String, dynamic>.from(updated),
            syncControllers: true,
            preserveLocalGuruDraft: _hasLocalGuruDraft,
          );
        });
      }
      await _notifyMapelOperationalChanged(
        'Jadwal mata pelajaran telah diperbarui',
      );
      _showSnackBar('Jadwal berhasil dihapus!');
    } catch (e) {
      _showSnackBar('Gagal menghapus jadwal: $e', isError: true);
    } finally {
      if (mounted) {
        setState(() => _busyJadwalKeys.remove(busyKey));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final jadwalGroups = _groupedJadwalList();
    return Scaffold(
      backgroundColor: const Color(0xFFFFDC80),
      body: SafeArea(
        child: Column(
          children: [
            // ===== HEADER =====
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
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
                        Icons.edit_rounded,
                        color: Color(0xFF138F81),
                        size: 26,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Edit Mata Pelajaran',
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF2D3436),
                            ),
                          ),
                          Text(
                            '${widget.mapelData['nama'] ?? ''}',
                            style: const TextStyle(
                              fontSize: 11,
                              color: Color(0xFF636E72),
                            ),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      onPressed: () => Navigator.pop(context),
                      icon: const Icon(Icons.close_rounded, size: 22),
                    ),
                  ],
                ),
              ),
            ),

            // ===== CONTENT =====
            Expanded(
              child: Container(
                width: double.infinity,
                margin: const EdgeInsets.symmetric(horizontal: 16),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFFE1EFF7),
                  borderRadius: BorderRadius.circular(30),
                ),
                child: SingleChildScrollView(
                  physics: const BouncingScrollPhysics(),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Nama
                      const Text(
                        'Nama Mata Pelajaran',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF636E72),
                        ),
                      ),
                      const SizedBox(height: 6),
                      TextField(
                        controller: _namaController,
                        decoration: InputDecoration(
                          filled: true,
                          fillColor: Colors.white,
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(14),
                            borderSide: BorderSide.none,
                          ),
                        ),
                      ),
                      const SizedBox(height: 14),

                      // Kode
                      const Text(
                        'Kode Mapel',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF636E72),
                        ),
                      ),
                      const SizedBox(height: 6),
                      TextField(
                        controller: _kodeController,
                        decoration: InputDecoration(
                          filled: true,
                          fillColor: Colors.white,
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(14),
                            borderSide: BorderSide.none,
                          ),
                          hintText: 'AKH',
                        ),
                      ),
                      const SizedBox(height: 20),

                      // Guru section
                      Row(
                        children: [
                          const Text(
                            'Guru Pengajar',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF636E72),
                            ),
                          ),
                          const Spacer(),
                          GestureDetector(
                            onTap: _showAddGuruDialog,
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 10,
                                vertical: 4,
                              ),
                              decoration: BoxDecoration(
                                color: const Color(0xFF138F81),
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: const Text(
                                '+ Tambah',
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
                      const SizedBox(height: 8),
                      if (_assignedGuru.isEmpty)
                        Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.5),
                            borderRadius: BorderRadius.circular(14),
                          ),
                          child: const Center(
                            child: Text(
                              'Belum ada guru pengajar yang ditambahkan',
                              style: TextStyle(
                                fontSize: 12,
                                color: Color(0xFF636E72),
                              ),
                            ),
                          ),
                        )
                      else
                        ..._assignedGuru.map((guru) {
                          final isDeleting = _busyGuruDeleteKeys.contains(
                            _guruBusyKey(guru),
                          );
                          return Container(
                            margin: const EdgeInsets.symmetric(vertical: 3),
                            padding: const EdgeInsets.symmetric(
                              horizontal: 12,
                              vertical: 10,
                            ),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(14),
                            ),
                            child: Row(
                              children: [
                                CircleAvatar(
                                  radius: 16,
                                  backgroundColor: const Color(
                                    0xFF138F81,
                                  ).withValues(alpha: 0.12),
                                  child: const Icon(
                                    Icons.person_rounded,
                                    size: 16,
                                    color: Color(0xFF138F81),
                                  ),
                                ),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Text(
                                    guru['name'] ?? '',
                                    style: const TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w600,
                                      color: Color(0xFF2D3436),
                                    ),
                                  ),
                                ),
                                IconButton(
                                  onPressed: isDeleting
                                      ? null
                                      : () => _removeAssignedGuru(guru),
                                  icon: AnimatedSwitcher(
                                    duration: const Duration(milliseconds: 180),
                                    child: isDeleting
                                        ? const SizedBox(
                                            key: ValueKey('loading'),
                                            width: 18,
                                            height: 18,
                                            child: CircularProgressIndicator(
                                              strokeWidth: 2,
                                              color: Color(0xFFD63031),
                                            ),
                                          )
                                        : const Icon(
                                            key: ValueKey('delete'),
                                            Icons.delete_outline_rounded,
                                            size: 20,
                                            color: Color(0xFFD63031),
                                          ),
                                  ),
                                ),
                              ],
                            ),
                          );
                        }),

                      const SizedBox(height: 20),

                      // Jadwal section (MERGED from jadwal_pelajaran)
                      Row(
                        children: [
                          const Text(
                            'Jadwal Pelajaran',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF636E72),
                            ),
                          ),
                          const Spacer(),
                          GestureDetector(
                            onTap: () => _showEditJadwalDialog(null),
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 10,
                                vertical: 4,
                              ),
                              decoration: BoxDecoration(
                                color: const Color(0xFFFFDC80),
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: const Text(
                                '+ Tambah',
                                style: TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w700,
                                  color: Color(0xFF2D3436),
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      if (jadwalGroups.isEmpty)
                        Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.5),
                            borderRadius: BorderRadius.circular(14),
                          ),
                          child: const Center(
                            child: Text(
                              'Belum ada jadwal',
                              style: TextStyle(
                                fontSize: 12,
                                color: Color(0xFF636E72),
                              ),
                            ),
                          ),
                        )
                      else
                        ...jadwalGroups.map((group) {
                          final jadwal = Map<String, dynamic>.from(
                            group['primary'] as Map,
                          );
                          final kelasList = List<String>.from(
                            group['kelas_list'] as List? ?? const [],
                          );
                          final busyKey = _jadwalBusyKeyFromGroup(group);
                          final isBusy = _busyJadwalKeys.contains(busyKey);
                          final kelas = _formatKelasSummary(
                            kelasList,
                            isAllKelas: group['is_all_kelas'] == true,
                          );
                          final guru = jadwal['guru']?.toString() ?? '-';
                          return Container(
                            margin: const EdgeInsets.symmetric(vertical: 3),
                            padding: const EdgeInsets.symmetric(
                              horizontal: 12,
                              vertical: 10,
                            ),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(14),
                            ),
                            child: Row(
                              children: [
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 8,
                                    vertical: 4,
                                  ),
                                  decoration: BoxDecoration(
                                    color: _getHariColor(
                                      jadwal['hari'],
                                    ).withValues(alpha: 0.15),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: Text(
                                    jadwal['hari'] ?? '',
                                    style: TextStyle(
                                      fontSize: 10,
                                      fontWeight: FontWeight.w700,
                                      color: _getHariColor(jadwal['hari']),
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        '${jadwal['jam_mulai']} - ${jadwal['jam_selesai']}',
                                        style: const TextStyle(
                                          fontSize: 12,
                                          fontWeight: FontWeight.w600,
                                          color: Color(0xFF2D3436),
                                        ),
                                      ),
                                      Text(
                                        '$kelas - $guru',
                                        style: const TextStyle(
                                          fontSize: 10,
                                          color: Color(0xFF636E72),
                                        ),
                                      ),
                                      if (kelasList.length > 1)
                                        Text(
                                          '${kelasList.length} kelas terhubung',
                                          style: const TextStyle(
                                            fontSize: 10,
                                            color: Color(0xFF138F81),
                                            fontWeight: FontWeight.w600,
                                          ),
                                        ),
                                    ],
                                  ),
                                ),
                                if (isBusy)
                                  const SizedBox(
                                    width: 24,
                                    height: 24,
                                    child: Padding(
                                      padding: EdgeInsets.all(4),
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                        color: Color(0xFF138F81),
                                      ),
                                    ),
                                  )
                                else ...[
                                  GestureDetector(
                                    onTap: () => _showEditJadwalDialog(jadwal),
                                    child: const Padding(
                                      padding: EdgeInsets.all(4),
                                      child: Icon(
                                        Icons.edit_rounded,
                                        size: 16,
                                        color: Color(0xFF2E86DE),
                                      ),
                                    ),
                                  ),
                                  GestureDetector(
                                    onTap: () => _deleteJadwalGroup(group),
                                    child: const Padding(
                                      padding: EdgeInsets.all(4),
                                      child: Icon(
                                        Icons.delete_outline_rounded,
                                        size: 16,
                                        color: Color(0xFFD63031),
                                      ),
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          );
                        }),

                      const SizedBox(height: 30),

                      // Save button
                      SizedBox(
                        width: double.infinity,
                        height: 50,
                        child: ElevatedButton(
                          onPressed: _isLoading ? null : _handleSimpan,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF138F81),
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(20),
                            ),
                            elevation: 0,
                          ),
                          child: _isLoading
                              ? const SizedBox(
                                  width: 20,
                                  height: 20,
                                  child: CircularProgressIndicator(
                                    color: Colors.white,
                                    strokeWidth: 2,
                                  ),
                                )
                              : const Text(
                                  'Simpan Perubahan',
                                  style: TextStyle(
                                    fontSize: 15,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                        ),
                      ),
                      const SizedBox(height: 20),
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  Color _getHariColor(String? hari) {
    switch (_canonicalHari(hari)) {
      case 'Ahad':
        return const Color(0xFF00A8A8);
      case 'Senin':
        return const Color(0xFF2E86DE);
      case 'Selasa':
        return const Color(0xFF138F81);
      case 'Rabu':
        return const Color(0xFF6C5CE7);
      case 'Kamis':
        return const Color(0xFFE65100);
      case 'Jumat':
        return const Color(0xFFD63031);
      case 'Sabtu':
        return const Color(0xFFFFB74D);
      default:
        return const Color(0xFF636E72);
    }
  }

  String? _canonicalHari(dynamic hari) {
    final normalized = (hari?.toString() ?? '').trim().toLowerCase();
    if (normalized.isEmpty) return null;
    for (final option in _hariOptions) {
      if (option.toLowerCase() == normalized) {
        return option;
      }
    }
    if (normalized == 'minggu') {
      return 'Ahad';
    }
    return hari?.toString().trim();
  }

  int _hariRank(String? hari) {
    final normalized = _canonicalHari(hari)?.toLowerCase() ?? '';
    final index = _hariOptions.indexWhere(
      (item) => item.toLowerCase() == normalized,
    );
    return index >= 0 ? index : _hariOptions.length;
  }

  int _compareHari(String? left, String? right) {
    final rankCompare = _hariRank(left).compareTo(_hariRank(right));
    if (rankCompare != 0) return rankCompare;
    return (left ?? '').compareTo(right ?? '');
  }
}

class _KelasSelectionResult {
  final List<String> selectedKelas;
  final bool applyToAllKelas;

  const _KelasSelectionResult({
    required this.selectedKelas,
    required this.applyToAllKelas,
  });
}

class _JadwalDraft {
  final String guruName;
  final int? teacherId;
  final String hari;
  final String jamMulai;
  final String jamSelesai;
  final List<String> kelas;
  final List<int> currentIds;
  final List<Map<String, dynamic>> teacherOptions;
  final bool isEditing;

  const _JadwalDraft({
    required this.guruName,
    required this.teacherId,
    required this.hari,
    required this.jamMulai,
    required this.jamSelesai,
    required this.kelas,
    required this.currentIds,
    required this.teacherOptions,
    required this.isEditing,
  });
}

class _KelasPreviewChip extends StatelessWidget {
  final String label;
  final Color color;

  const _KelasPreviewChip({required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w700,
          color: color == const Color(0xFFB2BEC3)
              ? const Color(0xFF636E72)
              : const Color(0xFF2D3436),
        ),
      ),
    );
  }
}
