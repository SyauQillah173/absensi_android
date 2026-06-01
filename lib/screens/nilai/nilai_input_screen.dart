import 'dart:async';

import 'package:flutter/material.dart';

import '../../services/api_service.dart';
import '../../services/cache_service.dart';
import '../../services/nilai_export_service.dart';
import '../../services/reference_data_service.dart';
import '../../services/session_service.dart';
import '../../services/sync_service.dart';
import '../../widgets/responsive_layout.dart';

class NilaiInputScreen extends StatefulWidget {
  const NilaiInputScreen({super.key});

  @override
  State<NilaiInputScreen> createState() => _NilaiInputScreenState();
}

class _NilaiInputScreenState extends State<NilaiInputScreen>
    with SingleTickerProviderStateMixin {
  static const String _periodeAktif = 'Ganjil 2025/2026';
  static const String _tahunAjaranAktif = '2025/2026';

  late TabController _tabController;
  StreamSubscription<AppDataEvent>? _syncSub;

  bool _isLoading = true;
  bool _isUsingCache = false;
  String _statusMessage = '';

  List<Map<String, dynamic>> _kelasFlatList = [];
  List<Map<String, dynamic>> _mapelList = [];
  String? _selectedKelas;

  int _userId = 0;
  String _userRole = '';
  String _userName = '';

  List<Map<String, dynamic>> _siswaList = [];
  List<Map<String, dynamic>> _nilaiList = [];
  List<Map<String, dynamic>> _hafalanList = [];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _loadInitialData();
    _syncSub = SyncService.dataEvents.listen((event) {
      if (!mounted) return;
      if (event.topic == SyncTopics.kelas ||
          event.topic == SyncTopics.mapel ||
          event.topic == SyncTopics.session) {
        _loadInitialData();
      }
      if (_selectedKelas != null &&
          (event.topic == SyncTopics.nilai ||
              event.topic == SyncTopics.hafalan ||
              event.topic == SyncTopics.heartbeat)) {
        _loadClassData(_selectedKelas!, silent: true);
      }
    });
  }

  @override
  void dispose() {
    _syncSub?.cancel();
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadInitialData() async {
    setState(() {
      _isLoading = true;
      _statusMessage = '';
    });

    _userId = await SessionService.getUserId();
    _userRole = await SessionService.getUserRole();
    _userName = await SessionService.getUserName();

    final cached = await ReferenceDataService.getCached();
    if (cached != null && mounted) {
      setState(() {
        _kelasFlatList = cached.kelas;
        _mapelList = cached.mataPelajaran;
        _isUsingCache = true;
        _isLoading = false;
      });
    }

    try {
      final snapshot = await ReferenceDataService.refresh();
      if (!mounted) return;
      setState(() {
        _kelasFlatList = snapshot.kelas;
        _mapelList = snapshot.mataPelajaran;
        _isUsingCache = snapshot.fromCache;
        _isLoading = false;
        if (_kelasFlatList.isEmpty) {
          _statusMessage =
              'Data kelas resmi belum tersedia. Pastikan master kelas sudah tersinkron dari menu kelas/sifir.';
        }
      });
      if (_selectedKelas != null) {
        await _loadClassData(_selectedKelas!, silent: true);
      }
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _isLoading = false;
        if (cached == null) {
          _statusMessage =
              'Tidak ada koneksi internet. Data kelas dan mata pelajaran belum bisa dimuat saat offline.';
        }
      });
    }
  }

  Future<void> _loadClassData(String kelas, {bool silent = false}) async {
    if (!silent) {
      setState(() {
        _isLoading = true;
        _statusMessage = '';
      });
    }

    final classId = _classIdForName(kelas);
    final cacheKey = 'nilai_module_v2_${_userId}_${classId ?? kelas}';
    final cached = await CacheService.get(cacheKey);
    if (cached is Map<String, dynamic> && mounted) {
      setState(() {
        _siswaList = List<Map<String, dynamic>>.from(
          cached['siswa'] ?? const [],
        );
        final cachedMapel = List<Map<String, dynamic>>.from(
          cached['mapel'] ?? const [],
        );
        if (cachedMapel.isNotEmpty) {
          _mapelList = _mergeMapelById(_mapelList, cachedMapel);
        }
        _nilaiList = List<Map<String, dynamic>>.from(
          cached['nilai'] ?? const [],
        );
        _hafalanList = List<Map<String, dynamic>>.from(
          cached['hafalan'] ?? const [],
        );
        _isUsingCache = true;
        _isLoading = false;
      });
    }

    try {
      final results = await Future.wait([
        ApiService.getSiswa(kelas: kelas, classId: classId, status: 'Aktif'),
        ApiService.getMataPelajaran(
          status: 'Aktif',
          userId: _userRole == 'guru' ? _userId : null,
          kelas: kelas,
          classId: classId,
        ),
        ApiService.getNilai(userId: _userId, kelas: kelas, classId: classId),
        ApiService.getHafalan(userId: _userId, kelas: kelas, classId: classId),
      ]);

      final siswa = List<Map<String, dynamic>>.from(
        results[0]['data'] ?? const [],
      );
      final mapel = List<Map<String, dynamic>>.from(
        results[1]['data'] ?? const [],
      );
      final nilai = List<Map<String, dynamic>>.from(
        results[2]['data'] ?? const [],
      );
      final hafalan = List<Map<String, dynamic>>.from(
        results[3]['data'] ?? const [],
      );

      await CacheService.save(cacheKey, {
        'siswa': siswa,
        'mapel': mapel,
        'nilai': nilai,
        'hafalan': hafalan,
      });

      if (!mounted) return;
      setState(() {
        _siswaList = siswa;
        if (mapel.isNotEmpty) {
          _mapelList = _mergeMapelById(_mapelList, mapel);
        }
        _nilaiList = nilai;
        _hafalanList = hafalan;
        _isUsingCache = false;
        _isLoading = false;
        _statusMessage = mapel.isEmpty
            ? 'Belum ada mata pelajaran untuk kelas ini. Silakan atur jadwal/mapel terlebih dahulu di menu admin.'
            : '';
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _isLoading = false;
        if (cached == null) {
          _statusMessage =
              'Tidak ada koneksi internet. Data nilai dan hafalan belum bisa dimuat saat offline.';
        }
      });
    }
  }

  int? _classIdForName(String kelas) {
    for (final item in _kelasFlatList) {
      if (_className(item) == kelas) {
        final rawId = item['id'];
        return rawId is num
            ? rawId.toInt()
            : int.tryParse(rawId?.toString() ?? '');
      }
    }
    return null;
  }

  String _className(Map<String, dynamic> item) {
    return item['name']?.toString() ?? item['nama']?.toString() ?? '';
  }

  List<Map<String, dynamic>> _mergeMapelById(
    List<Map<String, dynamic>> current,
    List<Map<String, dynamic>> incoming,
  ) {
    final merged = <String, Map<String, dynamic>>{};
    for (final item in current) {
      merged[item['id']?.toString() ?? item['nama']?.toString() ?? ''] = item;
    }
    for (final item in incoming) {
      merged[item['id']?.toString() ?? item['nama']?.toString() ?? ''] = item;
    }
    merged.remove('');
    return merged.values.toList();
  }

  String _calculateGrade(double nilai) {
    if (nilai >= 85) return 'A';
    if (nilai >= 75) return 'B';
    if (nilai >= 65) return 'BC';
    if (nilai >= 55) return 'C';
    if (nilai >= 45) return 'D';
    return 'E';
  }

  Color _getGradeColor(String grade) {
    switch (grade) {
      case 'A':
        return const Color(0xFF138F81);
      case 'B':
        return const Color(0xFF2E86DE);
      case 'BC':
        return const Color(0xFF6C5CE7);
      case 'C':
        return const Color(0xFFFFB74D);
      case 'D':
        return const Color(0xFFE65100);
      case 'E':
        return const Color(0xFFD63031);
      default:
        return const Color(0xFF636E72);
    }
  }

  void _showMessage(String message, {Color color = const Color(0xFF138F81)}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: color,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }

  List<Map<String, dynamic>> _nilaiBySiswa(int siswaId) {
    final data = _nilaiList
        .where((item) => item['siswa_id'] == siswaId)
        .toList();
    data.sort((a, b) {
      final aTime = a['updated_at']?.toString() ?? '';
      final bTime = b['updated_at']?.toString() ?? '';
      return bTime.compareTo(aTime);
    });
    return data;
  }

  List<Map<String, dynamic>> _mapelOptionsForKelas(
    String? kelas, {
    int? includeMapelId,
  }) {
    final filtered = List<Map<String, dynamic>>.from(
      ReferenceDataService.filterMapelForKelas(
        _mapelList,
        kelas,
        _classIdForName(kelas ?? ''),
        _userRole,
      ),
    );

    if (includeMapelId != null &&
        filtered.every(
          (item) => (item['id'] as num?)?.toInt() != includeMapelId,
        )) {
      Map<String, dynamic>? currentMapel;
      for (final item in _mapelList) {
        if ((item['id'] as num?)?.toInt() == includeMapelId) {
          currentMapel = item;
          break;
        }
      }
      if (currentMapel != null) {
        filtered.add(currentMapel);
      }
    }

    return filtered;
  }

  List<Map<String, dynamic>> _hafalanBySiswa(int siswaId) {
    final data = _hafalanList
        .where((item) => item['siswa_id'] == siswaId)
        .toList();
    data.sort((a, b) {
      final aTime = a['updated_at']?.toString() ?? '';
      final bTime = b['updated_at']?.toString() ?? '';
      return bTime.compareTo(aTime);
    });
    return data;
  }

  List<Map<String, dynamic>> _buildRekapRows() {
    final rows = <Map<String, dynamic>>[];

    for (final siswa in _siswaList) {
      final siswaId = (siswa['id'] as num?)?.toInt();
      if (siswaId == null) continue;

      final nilaiSiswa = _nilaiBySiswa(siswaId);
      final hafalanSiswa = _hafalanBySiswa(siswaId);
      if (nilaiSiswa.isEmpty && hafalanSiswa.isEmpty) continue;

      final nilaiPerMapel = <String, List<double>>{};
      final mapelLabel = <String, String>{};
      for (final item in nilaiSiswa) {
        final rawMapel = item['mata_pelajaran'];
        final mapel = rawMapel is Map
            ? Map<String, dynamic>.from(rawMapel)
            : null;
        final key =
            mapel?['id']?.toString() ??
            mapel?['nama']?.toString() ??
            item['mapel_id']?.toString() ??
            'mapel_${nilaiPerMapel.length}';
        final label = mapel?['nama']?.toString() ?? 'Mata Pelajaran';
        final nilai = double.tryParse(item['nilai']?.toString() ?? '');
        if (nilai == null) continue;
        nilaiPerMapel.putIfAbsent(key, () => []);
        nilaiPerMapel[key]!.add(nilai);
        mapelLabel[key] = label;
      }

      final nilaiPelajaranText = nilaiPerMapel.entries
          .map((entry) {
            final average =
                entry.value.reduce((a, b) => a + b) / entry.value.length;
            final rounded = double.parse(average.toStringAsFixed(1));
            return '${mapelLabel[entry.key] ?? 'Mapel'}: $rounded (${_calculateGrade(rounded)})';
          })
          .join(' | ');

      final hafalanText = hafalanSiswa
          .map((item) {
            final label =
                item['surah'] != null &&
                    item['surah'].toString().trim().isNotEmpty
                ? 'Surah ${item['surah']}'
                : item['juz'] != null
                ? 'Juz ${item['juz']}'
                : 'Hafalan';
            final nilai = item['nilai_hafalan'] ?? item['nilai'] ?? '-';
            final status = item['status']?.toString() ?? '-';
            return '$label: $nilai [$status]';
          })
          .join(' | ');

      final nilaiAverages = nilaiPerMapel.values
          .where((values) => values.isNotEmpty)
          .map((values) => values.reduce((a, b) => a + b) / values.length)
          .toList();
      final hafalanValues = hafalanSiswa
          .map(
            (item) => double.tryParse(
              (item['nilai_hafalan'] ?? item['nilai'] ?? '').toString(),
            ),
          )
          .whereType<double>()
          .toList();
      final allAverages = <double>[
        if (nilaiAverages.isNotEmpty)
          nilaiAverages.reduce((a, b) => a + b) / nilaiAverages.length,
        if (hafalanValues.isNotEmpty)
          hafalanValues.reduce((a, b) => a + b) / hafalanValues.length,
      ];
      final rataRata = allAverages.isEmpty
          ? 0.0
          : double.parse(
              (allAverages.reduce((a, b) => a + b) / allAverages.length)
                  .toStringAsFixed(1),
            );

      final latestNilai = nilaiSiswa.isNotEmpty ? nilaiSiswa.first : null;
      final latestHafalan = hafalanSiswa.isNotEmpty ? hafalanSiswa.first : null;
      final penilai =
          latestNilai?['penilai_nama']?.toString() ??
          latestNilai?['diinput_oleh']?.toString() ??
          latestHafalan?['penilai_nama']?.toString() ??
          latestHafalan?['penguji']?.toString() ??
          '-';

      rows.add({
        'nama_siswa': siswa['nama']?.toString() ?? '-',
        'nis': siswa['nis']?.toString() ?? '-',
        'kelas': siswa['kelas']?.toString() ?? _selectedKelas ?? '-',
        'nilai_pelajaran': nilaiPelajaranText.isEmpty
            ? '-'
            : nilaiPelajaranText,
        'nilai_hafalan': hafalanText.isEmpty ? '-' : hafalanText,
        'rata_rata': rataRata == 0 ? '0' : rataRata.toStringAsFixed(1),
        'predikat': rataRata == 0 ? '-' : _calculateGrade(rataRata),
        'nama_penilai': penilai,
      });
    }

    return rows;
  }

  Future<void> _exportRekapExcel() async {
    if (_selectedKelas == null) {
      _showMessage(
        'Pilih kelas terlebih dahulu',
        color: const Color(0xFFD63031),
      );
      return;
    }

    try {
      final rows = _buildRekapRows();
      if (rows.isEmpty) {
        _showMessage(
          'Belum ada data nilai untuk direkap',
          color: const Color(0xFFD63031),
        );
        return;
      }

      await NilaiExportService.exportRekapExcel(
        rows,
        kelas: _selectedKelas,
        semester: _periodeAktif,
      );
    } catch (_) {
      _showMessage(
        'Gagal membuat file rekap Excel',
        color: const Color(0xFFD63031),
      );
    }
  }

  Future<void> _showExportOptions(int siswaId) async {
    await showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) {
        Widget option(String label, String scope) {
          return ListTile(
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
            ),
            tileColor: const Color(0xFFE1EFF7),
            title: Text(label),
            trailing: const Icon(Icons.arrow_forward_ios_rounded, size: 16),
            onTap: () async {
              Navigator.pop(context);
              try {
                final payload = await ApiService.getPenilaianDokumen(
                  userId: _userId,
                  siswaId: siswaId,
                  reportScope: scope,
                );
                await NilaiExportService.printStudentReport(
                  payload,
                  reportScope: scope,
                );
              } catch (_) {
                _showMessage(
                  'Gagal membuat dokumen nilai',
                  color: const Color(0xFFD63031),
                );
              }
            },
          );
        }

        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text(
                  'Download / Cetak Dokumen Nilai',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 14),
                option('Nilai Pelajaran', 'pelajaran'),
                const SizedBox(height: 8),
                option('Nilai Hafalan', 'hafalan'),
                const SizedBox(height: 8),
                option('Gabungan Nilai + Hafalan', 'gabungan'),
              ],
            ),
          ),
        );
      },
    );
  }

  Future<void> _confirmDeleteNilai(Map<String, dynamic> nilai) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) {
        return AlertDialog(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
          ),
          title: const Text('Hapus Nilai'),
          content: Text(
            'Hapus nilai ${nilai['mata_pelajaran']?['nama'] ?? '-'} (${nilai['jenis_ujian'] ?? '-'})?',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Batal'),
            ),
            ElevatedButton(
              onPressed: () => Navigator.pop(context, true),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFD63031),
                foregroundColor: Colors.white,
              ),
              child: const Text('Hapus'),
            ),
          ],
        );
      },
    );

    if (confirmed != true) return;

    try {
      await ApiService.deleteNilai((nilai['id'] as num).toInt(), _userId);
      await SyncService.notifyDataChanged(SyncTopics.nilai);
      if (_selectedKelas != null) {
        await _loadClassData(_selectedKelas!, silent: true);
      }
      _showMessage('Nilai berhasil dihapus');
    } catch (_) {
      _showMessage('Gagal menghapus nilai', color: const Color(0xFFD63031));
    }
  }

  Future<void> _confirmDeleteHafalan(Map<String, dynamic> hafalan) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) {
        return AlertDialog(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
          ),
          title: const Text('Hapus Hafalan'),
          content: Text(
            'Hapus data ${hafalan['surah'] != null && '${hafalan['surah']}'.isNotEmpty ? 'Surah ${hafalan['surah']}' : 'Juz ${hafalan['juz'] ?? '-'}'}?',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Batal'),
            ),
            ElevatedButton(
              onPressed: () => Navigator.pop(context, true),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFD63031),
                foregroundColor: Colors.white,
              ),
              child: const Text('Hapus'),
            ),
          ],
        );
      },
    );

    if (confirmed != true) return;

    try {
      await ApiService.deleteHafalan((hafalan['id'] as num).toInt(), _userId);
      await SyncService.notifyDataChanged(SyncTopics.hafalan);
      if (_selectedKelas != null) {
        await _loadClassData(_selectedKelas!, silent: true);
      }
      _showMessage('Data hafalan berhasil dihapus');
    } catch (_) {
      _showMessage(
        'Gagal menghapus data hafalan',
        color: const Color(0xFFD63031),
      );
    }
  }

  Future<void> _showNilaiRecordsSheet(Map<String, dynamic> siswa) async {
    final nilaiSiswa = _nilaiBySiswa((siswa['id'] as num).toInt());

    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) {
        return SafeArea(
          child: Container(
            constraints: BoxConstraints(
              maxHeight: MediaQuery.of(context).size.height * 0.85,
            ),
            padding: const EdgeInsets.fromLTRB(18, 18, 18, 24),
            decoration: const BoxDecoration(
              color: Color(0xFFE1EFF7),
              borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Container(
                    width: 42,
                    height: 4,
                    decoration: BoxDecoration(
                      color: Colors.grey[400],
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  siswa['nama']?.toString() ?? '-',
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF2D3436),
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Data nilai yang bisa Anda kelola: ${nilaiSiswa.length}',
                  style: const TextStyle(
                    fontSize: 11,
                    color: Color(0xFF636E72),
                  ),
                ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    Expanded(
                      child: ElevatedButton.icon(
                        onPressed: () {
                          Navigator.pop(context);
                          _showInputNilaiDialog(siswa);
                        },
                        icon: const Icon(Icons.add_rounded, size: 18),
                        label: const Text('Tambah Nilai'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF138F81),
                          foregroundColor: Colors.white,
                          elevation: 0,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(14),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () {
                          Navigator.pop(context);
                          _showExportOptions((siswa['id'] as num).toInt());
                        },
                        icon: const Icon(
                          Icons.picture_as_pdf_rounded,
                          size: 18,
                        ),
                        label: const Text('Dokumen'),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: const Color(0xFF138F81),
                          side: const BorderSide(color: Color(0xFF138F81)),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(14),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                if (nilaiSiswa.isEmpty)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 28),
                    child: Center(
                      child: Text(
                        'Belum ada nilai untuk siswa ini',
                        style: TextStyle(color: Color(0xFF636E72)),
                      ),
                    ),
                  )
                else
                  Expanded(
                    child: ListView.builder(
                      shrinkWrap: true,
                      physics: const BouncingScrollPhysics(),
                      itemCount: nilaiSiswa.length,
                      itemBuilder: (context, index) {
                        final item = nilaiSiswa[index];
                        final grade = item['grade']?.toString() ?? '-';
                        return Container(
                          margin: const EdgeInsets.only(bottom: 10),
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Expanded(
                                    child: Text(
                                      item['mata_pelajaran']?['nama']
                                              ?.toString() ??
                                          '-',
                                      style: const TextStyle(
                                        fontSize: 13,
                                        fontWeight: FontWeight.w700,
                                        color: Color(0xFF2D3436),
                                      ),
                                    ),
                                  ),
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 10,
                                      vertical: 6,
                                    ),
                                    decoration: BoxDecoration(
                                      color: _getGradeColor(
                                        grade,
                                      ).withValues(alpha: 0.12),
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                    child: Text(
                                      '${item['nilai']} / $grade',
                                      style: TextStyle(
                                        fontSize: 11,
                                        fontWeight: FontWeight.w700,
                                        color: _getGradeColor(grade),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 6),
                              Text(
                                '${item['jenis_ujian'] ?? '-'} - ${item['status_data'] ?? 'dibuat'}',
                                style: const TextStyle(
                                  fontSize: 11,
                                  color: Color(0xFF636E72),
                                ),
                              ),
                              const SizedBox(height: 8),
                              Text(
                                'Penilai: ${item['penilai_nama'] ?? '-'} (${item['penilai_role'] ?? '-'})',
                                style: const TextStyle(
                                  fontSize: 11,
                                  color: Color(0xFF636E72),
                                ),
                              ),
                              Text(
                                'Update terakhir: ${item['updated_at'] ?? '-'}',
                                style: const TextStyle(
                                  fontSize: 11,
                                  color: Color(0xFF636E72),
                                ),
                              ),
                              if ((item['keterangan']?.toString() ?? '')
                                  .trim()
                                  .isNotEmpty) ...[
                                const SizedBox(height: 8),
                                Text(
                                  item['keterangan'].toString(),
                                  style: const TextStyle(
                                    fontSize: 11,
                                    color: Color(0xFF2D3436),
                                  ),
                                ),
                              ],
                              const SizedBox(height: 10),
                              Row(
                                children: [
                                  Expanded(
                                    child: OutlinedButton(
                                      onPressed: () {
                                        Navigator.pop(context);
                                        _showInputNilaiDialog(
                                          siswa,
                                          existingNilai: item,
                                        );
                                      },
                                      style: OutlinedButton.styleFrom(
                                        foregroundColor: const Color(
                                          0xFF138F81,
                                        ),
                                        side: const BorderSide(
                                          color: Color(0xFF138F81),
                                        ),
                                        shape: RoundedRectangleBorder(
                                          borderRadius: BorderRadius.circular(
                                            12,
                                          ),
                                        ),
                                      ),
                                      child: const Text('Edit'),
                                    ),
                                  ),
                                  const SizedBox(width: 10),
                                  Expanded(
                                    child: ElevatedButton(
                                      onPressed: () {
                                        Navigator.pop(context);
                                        _confirmDeleteNilai(item);
                                      },
                                      style: ElevatedButton.styleFrom(
                                        backgroundColor: const Color(
                                          0xFFD63031,
                                        ),
                                        foregroundColor: Colors.white,
                                        elevation: 0,
                                        shape: RoundedRectangleBorder(
                                          borderRadius: BorderRadius.circular(
                                            12,
                                          ),
                                        ),
                                      ),
                                      child: const Text('Hapus'),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        );
                      },
                    ),
                  ),
              ],
            ),
          ),
        );
      },
    );
  }

  Future<void> _showHafalanRecordsSheet(Map<String, dynamic> siswa) async {
    final hafalanSiswa = _hafalanBySiswa((siswa['id'] as num).toInt());

    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) {
        return SafeArea(
          child: Container(
            constraints: BoxConstraints(
              maxHeight: MediaQuery.of(context).size.height * 0.85,
            ),
            padding: const EdgeInsets.fromLTRB(18, 18, 18, 24),
            decoration: const BoxDecoration(
              color: Color(0xFFE1EFF7),
              borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Container(
                    width: 42,
                    height: 4,
                    decoration: BoxDecoration(
                      color: Colors.grey[400],
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  siswa['nama']?.toString() ?? '-',
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF2D3436),
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Data hafalan yang bisa Anda kelola: ${hafalanSiswa.length}',
                  style: const TextStyle(
                    fontSize: 11,
                    color: Color(0xFF636E72),
                  ),
                ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    Expanded(
                      child: ElevatedButton.icon(
                        onPressed: () {
                          Navigator.pop(context);
                          _showInputHafalanDialog(siswa);
                        },
                        icon: const Icon(Icons.add_rounded, size: 18),
                        label: const Text('Tambah Hafalan'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF6C5CE7),
                          foregroundColor: Colors.white,
                          elevation: 0,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(14),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () {
                          Navigator.pop(context);
                          _showExportOptions((siswa['id'] as num).toInt());
                        },
                        icon: const Icon(
                          Icons.picture_as_pdf_rounded,
                          size: 18,
                        ),
                        label: const Text('Dokumen'),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: const Color(0xFF6C5CE7),
                          side: const BorderSide(color: Color(0xFF6C5CE7)),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(14),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                if (hafalanSiswa.isEmpty)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 28),
                    child: Center(
                      child: Text(
                        'Belum ada data hafalan untuk siswa ini',
                        style: TextStyle(color: Color(0xFF636E72)),
                      ),
                    ),
                  )
                else
                  Expanded(
                    child: ListView.builder(
                      shrinkWrap: true,
                      physics: const BouncingScrollPhysics(),
                      itemCount: hafalanSiswa.length,
                      itemBuilder: (context, index) {
                        final item = hafalanSiswa[index];
                        final label =
                            (item['surah']?.toString() ?? '').isNotEmpty
                            ? 'Surah ${item['surah']}'
                            : 'Juz ${item['juz'] ?? '-'}';
                        final status = item['status']?.toString() ?? '-';
                        return Container(
                          margin: const EdgeInsets.only(bottom: 10),
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Expanded(
                                    child: Text(
                                      label,
                                      style: const TextStyle(
                                        fontSize: 13,
                                        fontWeight: FontWeight.w700,
                                        color: Color(0xFF2D3436),
                                      ),
                                    ),
                                  ),
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 10,
                                      vertical: 6,
                                    ),
                                    decoration: BoxDecoration(
                                      color: const Color(
                                        0xFF6C5CE7,
                                      ).withValues(alpha: 0.12),
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                    child: Text(
                                      '$status / ${item['nilai_hafalan'] ?? '-'}',
                                      style: const TextStyle(
                                        fontSize: 11,
                                        fontWeight: FontWeight.w700,
                                        color: Color(0xFF6C5CE7),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 6),
                              Text(
                                'Periode: ${item['periode'] ?? _periodeAktif}',
                                style: const TextStyle(
                                  fontSize: 11,
                                  color: Color(0xFF636E72),
                                ),
                              ),
                              const SizedBox(height: 8),
                              Text(
                                'Penilai: ${item['penilai_nama'] ?? '-'} (${item['penilai_role'] ?? '-'})',
                                style: const TextStyle(
                                  fontSize: 11,
                                  color: Color(0xFF636E72),
                                ),
                              ),
                              Text(
                                'Update terakhir: ${item['updated_at'] ?? '-'}',
                                style: const TextStyle(
                                  fontSize: 11,
                                  color: Color(0xFF636E72),
                                ),
                              ),
                              if ((item['keterangan']?.toString() ?? '')
                                  .trim()
                                  .isNotEmpty) ...[
                                const SizedBox(height: 8),
                                Text(
                                  item['keterangan'].toString(),
                                  style: const TextStyle(
                                    fontSize: 11,
                                    color: Color(0xFF2D3436),
                                  ),
                                ),
                              ],
                              const SizedBox(height: 10),
                              Row(
                                children: [
                                  Expanded(
                                    child: OutlinedButton(
                                      onPressed: () {
                                        Navigator.pop(context);
                                        _showInputHafalanDialog(
                                          siswa,
                                          existingHafalan: item,
                                        );
                                      },
                                      style: OutlinedButton.styleFrom(
                                        foregroundColor: const Color(
                                          0xFF6C5CE7,
                                        ),
                                        side: const BorderSide(
                                          color: Color(0xFF6C5CE7),
                                        ),
                                        shape: RoundedRectangleBorder(
                                          borderRadius: BorderRadius.circular(
                                            12,
                                          ),
                                        ),
                                      ),
                                      child: const Text('Edit'),
                                    ),
                                  ),
                                  const SizedBox(width: 10),
                                  Expanded(
                                    child: ElevatedButton(
                                      onPressed: () {
                                        Navigator.pop(context);
                                        _confirmDeleteHafalan(item);
                                      },
                                      style: ElevatedButton.styleFrom(
                                        backgroundColor: const Color(
                                          0xFFD63031,
                                        ),
                                        foregroundColor: Colors.white,
                                        elevation: 0,
                                        shape: RoundedRectangleBorder(
                                          borderRadius: BorderRadius.circular(
                                            12,
                                          ),
                                        ),
                                      ),
                                      child: const Text('Hapus'),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        );
                      },
                    ),
                  ),
              ],
            ),
          ),
        );
      },
    );
  }

  void _showInputNilaiDialog(
    Map<String, dynamic> siswa, {
    Map<String, dynamic>? existingNilai,
  }) {
    int? selectedMapelId =
        (existingNilai?['mapel_id'] as num?)?.toInt() ??
        (existingNilai?['mata_pelajaran']?['id'] as num?)?.toInt();
    String selectedJenis =
        existingNilai?['jenis_ujian']?.toString() ?? 'Harian';
    final nilaiController = TextEditingController(
      text: existingNilai?['nilai']?.toString() ?? '',
    );
    final keteranganController = TextEditingController(
      text: existingNilai?['keterangan']?.toString() ?? '',
    );
    String autoGrade =
        existingNilai?['grade']?.toString() ??
        (double.tryParse(existingNilai?['nilai']?.toString() ?? '') != null
            ? _calculateGrade(double.parse(existingNilai!['nilai'].toString()))
            : '-');

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => StatefulBuilder(
        builder: (context, setModalState) {
          final activeMapel = _mapelOptionsForKelas(
            _selectedKelas,
            includeMapelId: selectedMapelId,
          );

          return Container(
            padding: EdgeInsets.fromLTRB(
              24,
              20,
              24,
              MediaQuery.of(context).viewInsets.bottom + 24,
            ),
            decoration: const BoxDecoration(
              color: Color(0xFFE1EFF7),
              borderRadius: BorderRadius.vertical(top: Radius.circular(30)),
            ),
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
                    '${existingNilai == null ? 'Input' : 'Edit'} Nilai - ${siswa['nama'] ?? ''}',
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF2D3436),
                    ),
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'Mata Pelajaran',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF636E72),
                    ),
                  ),
                  const SizedBox(height: 6),
                  if (activeMapel.isEmpty)
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: const Text(
                        'Belum ada mata pelajaran untuk kelas ini. Silakan atur jadwal/mapel terlebih dahulu di menu admin.',
                        style: TextStyle(
                          fontSize: 12,
                          color: Color(0xFFE65100),
                        ),
                      ),
                    )
                  else
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: DropdownButtonHideUnderline(
                        child: DropdownButton<int>(
                          isExpanded: true,
                          value: selectedMapelId,
                          hint: const Text('Pilih mata pelajaran'),
                          items: activeMapel.map((m) {
                            return DropdownMenuItem<int>(
                              value: (m['id'] as num?)?.toInt(),
                              child: Text(
                                m['nama']?.toString() ?? '',
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(fontSize: 14),
                              ),
                            );
                          }).toList(),
                          onChanged: (value) {
                            setModalState(() => selectedMapelId = value);
                          },
                        ),
                      ),
                    ),
                  const SizedBox(height: 14),
                  const Text(
                    'Jenis Ujian',
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
                    children: ['Harian', 'UTS', 'UAS', 'Tugas', 'Hafalan'].map((
                      jenis,
                    ) {
                      final selected = selectedJenis == jenis;
                      return GestureDetector(
                        onTap: () => setModalState(() => selectedJenis = jenis),
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 180),
                          padding: const EdgeInsets.symmetric(
                            horizontal: 14,
                            vertical: 10,
                          ),
                          decoration: BoxDecoration(
                            color: selected
                                ? const Color(0xFF138F81)
                                : Colors.white,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Text(
                            jenis,
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: selected
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
                              'Nilai (0-100)',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: Color(0xFF636E72),
                              ),
                            ),
                            const SizedBox(height: 6),
                            TextField(
                              controller: nilaiController,
                              keyboardType: TextInputType.number,
                              onChanged: (value) {
                                final angka = double.tryParse(value);
                                setModalState(() {
                                  autoGrade = angka == null
                                      ? '-'
                                      : _calculateGrade(angka);
                                });
                              },
                              decoration: InputDecoration(
                                filled: true,
                                fillColor: Colors.white,
                                border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(14),
                                  borderSide: BorderSide.none,
                                ),
                                hintText: '85',
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 16),
                      Column(
                        children: [
                          const Text(
                            'Grade',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: Color(0xFF636E72),
                            ),
                          ),
                          const SizedBox(height: 6),
                          Container(
                            width: 62,
                            height: 50,
                            decoration: BoxDecoration(
                              color: _getGradeColor(
                                autoGrade,
                              ).withValues(alpha: 0.12),
                              borderRadius: BorderRadius.circular(14),
                              border: Border.all(
                                color: _getGradeColor(autoGrade),
                              ),
                            ),
                            child: Center(
                              child: Text(
                                autoGrade,
                                style: TextStyle(
                                  fontSize: 22,
                                  fontWeight: FontWeight.w800,
                                  color: _getGradeColor(autoGrade),
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  const Text(
                    'Keterangan (opsional)',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF636E72),
                    ),
                  ),
                  const SizedBox(height: 6),
                  TextField(
                    controller: keteranganController,
                    maxLines: 2,
                    decoration: InputDecoration(
                      filled: true,
                      fillColor: Colors.white,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(14),
                        borderSide: BorderSide.none,
                      ),
                      hintText: 'Catatan tambahan...',
                    ),
                  ),
                  const SizedBox(height: 20),
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: ElevatedButton(
                      onPressed: () async {
                        final nilai = double.tryParse(nilaiController.text);
                        if (selectedMapelId == null || nilai == null) {
                          _showMessage(
                            'Lengkapi mata pelajaran dan nilai terlebih dahulu',
                            color: const Color(0xFFD63031),
                          );
                          return;
                        }

                        final payload = {
                          'user_id': _userId,
                          'siswa_id': siswa['id'],
                          'mapel_id': selectedMapelId,
                          'jenis_ujian': selectedJenis,
                          'nilai': nilai,
                          'semester': _periodeAktif,
                          'keterangan': keteranganController.text.trim(),
                          'tahun_ajaran': _tahunAjaranAktif,
                        };

                        try {
                          if (existingNilai == null) {
                            await ApiService.createNilai(payload);
                          } else {
                            await ApiService.updateNilai(
                              (existingNilai['id'] as num).toInt(),
                              payload,
                            );
                          }

                          await SyncService.notifyDataChanged(SyncTopics.nilai);
                          if (!context.mounted) return;
                          Navigator.pop(context);
                          _showMessage(
                            existingNilai == null
                                ? 'Nilai ${siswa['nama']} berhasil disimpan'
                                : 'Nilai ${siswa['nama']} berhasil diperbarui',
                          );
                          if (_selectedKelas != null) {
                            await _loadClassData(_selectedKelas!, silent: true);
                          }
                        } catch (_) {
                          _showMessage(
                            'Gagal menyimpan nilai. Pastikan internet tersedia.',
                            color: const Color(0xFFD63031),
                          );
                        }
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
                        existingNilai == null ? 'Simpan Nilai' : 'Update Nilai',
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                        ),
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
  }

  void _showInputHafalanDialog(
    Map<String, dynamic> siswa, {
    Map<String, dynamic>? existingHafalan,
  }) {
    int? selectedJuz = (existingHafalan?['juz'] as num?)?.toInt();
    String selectedStatus = existingHafalan?['status']?.toString() ?? 'Proses';
    final surahController = TextEditingController(
      text: existingHafalan?['surah']?.toString() ?? '',
    );
    final nilaiController = TextEditingController(
      text:
          existingHafalan?['nilai_hafalan']?.toString() ??
          existingHafalan?['nilai']?.toString() ??
          '',
    );
    final keteranganController = TextEditingController(
      text: existingHafalan?['keterangan']?.toString() ?? '',
    );

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => StatefulBuilder(
        builder: (context, setModalState) {
          return Container(
            padding: EdgeInsets.fromLTRB(
              24,
              20,
              24,
              MediaQuery.of(context).viewInsets.bottom + 24,
            ),
            decoration: const BoxDecoration(
              color: Color(0xFFE1EFF7),
              borderRadius: BorderRadius.vertical(top: Radius.circular(30)),
            ),
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
                    '${existingHafalan == null ? 'Input' : 'Edit'} Hafalan - ${siswa['nama'] ?? ''}',
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF2D3436),
                    ),
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'Juz (1-30)',
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
                      child: DropdownButton<int>(
                        isExpanded: true,
                        value: selectedJuz,
                        hint: const Text('Pilih Juz'),
                        items: List.generate(30, (index) => index + 1).map((
                          juz,
                        ) {
                          return DropdownMenuItem<int>(
                            value: juz,
                            child: Text('Juz $juz'),
                          );
                        }).toList(),
                        onChanged: (value) {
                          setModalState(() => selectedJuz = value);
                        },
                      ),
                    ),
                  ),
                  const SizedBox(height: 14),
                  const Text(
                    'Nama Surah (opsional)',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF636E72),
                    ),
                  ),
                  const SizedBox(height: 6),
                  TextField(
                    controller: surahController,
                    decoration: InputDecoration(
                      filled: true,
                      fillColor: Colors.white,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(14),
                        borderSide: BorderSide.none,
                      ),
                      hintText: 'Al-Baqarah',
                    ),
                  ),
                  const SizedBox(height: 14),
                  const Text(
                    'Status',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF636E72),
                    ),
                  ),
                  const SizedBox(height: 6),
                  Wrap(
                    spacing: 8,
                    children: ['Belum', 'Proses', 'Selesai'].map((status) {
                      final selected = selectedStatus == status;
                      final color = status == 'Selesai'
                          ? const Color(0xFF138F81)
                          : status == 'Proses'
                          ? const Color(0xFFFFB74D)
                          : const Color(0xFF636E72);
                      return GestureDetector(
                        onTap: () =>
                            setModalState(() => selectedStatus = status),
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 180),
                          padding: const EdgeInsets.symmetric(
                            horizontal: 14,
                            vertical: 10,
                          ),
                          decoration: BoxDecoration(
                            color: selected ? color : Colors.white,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Text(
                            status,
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: selected ? Colors.white : color,
                            ),
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 14),
                  const Text(
                    'Nilai Hafalan (0-100)',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF636E72),
                    ),
                  ),
                  const SizedBox(height: 6),
                  TextField(
                    controller: nilaiController,
                    keyboardType: TextInputType.number,
                    decoration: InputDecoration(
                      filled: true,
                      fillColor: Colors.white,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(14),
                        borderSide: BorderSide.none,
                      ),
                      hintText: '90',
                    ),
                  ),
                  const SizedBox(height: 14),
                  const Text(
                    'Keterangan',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF636E72),
                    ),
                  ),
                  const SizedBox(height: 6),
                  TextField(
                    controller: keteranganController,
                    maxLines: 2,
                    decoration: InputDecoration(
                      filled: true,
                      fillColor: Colors.white,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(14),
                        borderSide: BorderSide.none,
                      ),
                      hintText: 'Lancar, tajwid baik...',
                    ),
                  ),
                  const SizedBox(height: 20),
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: ElevatedButton(
                      onPressed: () async {
                        if (selectedJuz == null) {
                          _showMessage(
                            'Pilih juz terlebih dahulu',
                            color: const Color(0xFFD63031),
                          );
                          return;
                        }

                        final payload = {
                          'user_id': _userId,
                          'siswa_id': siswa['id'],
                          'juz': selectedJuz,
                          'surah': surahController.text.trim(),
                          'status': selectedStatus,
                          'tanggal_setor': DateTime.now()
                              .toIso8601String()
                              .split('T')
                              .first,
                          'nilai_hafalan': int.tryParse(nilaiController.text),
                          'keterangan': keteranganController.text.trim(),
                          'periode': _periodeAktif,
                        };

                        try {
                          if (existingHafalan == null) {
                            await ApiService.createHafalan(payload);
                          } else {
                            await ApiService.updateHafalan(
                              (existingHafalan['id'] as num).toInt(),
                              payload,
                            );
                          }

                          await SyncService.notifyDataChanged(
                            SyncTopics.hafalan,
                          );
                          if (!context.mounted) return;
                          Navigator.pop(context);
                          _showMessage(
                            existingHafalan == null
                                ? 'Hafalan ${siswa['nama']} berhasil disimpan'
                                : 'Hafalan ${siswa['nama']} berhasil diperbarui',
                          );
                          if (_selectedKelas != null) {
                            await _loadClassData(_selectedKelas!, silent: true);
                          }
                        } catch (_) {
                          _showMessage(
                            'Gagal menyimpan hafalan. Pastikan internet tersedia.',
                            color: const Color(0xFFD63031),
                          );
                        }
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF6C5CE7),
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                        ),
                        elevation: 0,
                      ),
                      child: Text(
                        existingHafalan == null
                            ? 'Simpan Hafalan'
                            : 'Update Hafalan',
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                        ),
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
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFFDC80),
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: EdgeInsets.symmetric(
                horizontal: AppResponsive.pageMargin(context),
                vertical: 12,
              ),
              child: AppResponsive(
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
                          Icons.assignment_rounded,
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
                              'Nilai & Hafalan',
                              style: TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.w700,
                                color: Color(0xFF2D3436),
                              ),
                            ),
                            Text(
                              _userRole == 'admin'
                                  ? 'Admin full access - $_userName'
                                  : 'Guru hanya dapat kelola nilai sendiri - $_userName',
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
            ),
            Padding(
              padding: EdgeInsets.symmetric(
                horizontal: AppResponsive.pageMargin(context),
              ),
              child: AppResponsive(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(25),
                  ),
                  child: DropdownButtonHideUnderline(
                    child: DropdownButton<String>(
                      isExpanded: true,
                      value: _selectedKelas,
                      hint: const Text(
                        'Pilih kelas...',
                        style: TextStyle(
                          fontSize: 14,
                          color: Color(0xFF636E72),
                        ),
                      ),
                      items: _kelasFlatList.map((kelas) {
                        final nama = _className(kelas);
                        return DropdownMenuItem<String>(
                          value: nama,
                          child: Text(
                            nama,
                            style: const TextStyle(fontSize: 14),
                          ),
                        );
                      }).toList(),
                      onChanged: (value) {
                        setState(() => _selectedKelas = value);
                        if (value != null) {
                          _loadClassData(value);
                        }
                      },
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 10),
            if (_selectedKelas != null && _userRole == 'admin')
              _buildActionRow(),
            if (_selectedKelas != null && _userRole == 'admin')
              const SizedBox(height: 10),
            if (_statusMessage.isNotEmpty || _isUsingCache)
              _buildStatusBanner(),
            if (_statusMessage.isNotEmpty || _isUsingCache)
              const SizedBox(height: 10),
            Container(
              margin: EdgeInsets.symmetric(
                horizontal: AppResponsive.pageMargin(context),
              ),
              decoration: BoxDecoration(
                color: const Color(0xFFE1EFF7),
                borderRadius: BorderRadius.circular(16),
              ),
              child: TabBar(
                controller: _tabController,
                indicator: BoxDecoration(
                  color: const Color(0xFF138F81),
                  borderRadius: BorderRadius.circular(16),
                ),
                labelColor: Colors.white,
                unselectedLabelColor: const Color(0xFF636E72),
                labelStyle: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                ),
                tabs: const [
                  Tab(text: 'Nilai Pelajaran'),
                  Tab(text: 'Hafalan Al-Quran'),
                ],
              ),
            ),
            const SizedBox(height: 12),
            Expanded(
              child: AppResponsive(
                child: Container(
                  width: double.infinity,
                  margin: EdgeInsets.symmetric(
                    horizontal: AppResponsive.pageMargin(context),
                  ),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 16,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0xFFE1EFF7),
                    borderRadius: BorderRadius.circular(30),
                  ),
                  child: _isLoading
                      ? const Center(
                          child: CircularProgressIndicator(
                            color: Color(0xFF138F81),
                          ),
                        )
                      : _selectedKelas == null
                      ? const Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(
                                Icons.school_rounded,
                                size: 48,
                                color: Color(0xFF636E72),
                              ),
                              SizedBox(height: 12),
                              Text(
                                'Pilih kelas terlebih dahulu',
                                style: TextStyle(
                                  fontSize: 14,
                                  color: Color(0xFF636E72),
                                ),
                              ),
                            ],
                          ),
                        )
                      : TabBarView(
                          controller: _tabController,
                          children: [_buildNilaiTab(), _buildHafalanTab()],
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

  Widget _buildActionRow() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: SizedBox(
        width: double.infinity,
        child: ElevatedButton.icon(
          onPressed: _exportRekapExcel,
          icon: const Icon(Icons.file_download_rounded, size: 18),
          label: const Text('Rekap Excel'),
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFF138F81),
            foregroundColor: Colors.white,
            elevation: 0,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(14),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildStatusBanner() {
    final usingCache = _isUsingCache;
    final message = _statusMessage.isNotEmpty
        ? _statusMessage
        : 'Menampilkan data terakhir yang sudah tersinkron.';
    final color = usingCache
        ? const Color(0xFFE65100)
        : const Color(0xFF138F81);

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: usingCache ? const Color(0xFFFFF3E0) : const Color(0xFFE8F7F5),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: color.withValues(alpha: 0.25)),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(
              usingCache ? Icons.cloud_off_rounded : Icons.info_rounded,
              size: 18,
              color: color,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                usingCache ? 'Offline - $message' : message,
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: color,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildNilaiTab() {
    if (_siswaList.isEmpty) {
      return const Center(
        child: Text(
          'Belum ada siswa di kelas ini',
          style: TextStyle(color: Color(0xFF636E72)),
        ),
      );
    }

    return ListView.builder(
      physics: const BouncingScrollPhysics(),
      itemCount: _siswaList.length,
      itemBuilder: (context, index) {
        final siswa = _siswaList[index];
        final nilaiSiswa = _nilaiBySiswa((siswa['id'] as num).toInt());
        final latest = nilaiSiswa.isNotEmpty ? nilaiSiswa.first : null;

        return Padding(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: GestureDetector(
            onTap: () => _showNilaiRecordsSheet(siswa),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(21),
              ),
              child: Row(
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: const Color(0xFF138F81).withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Center(
                      child: Text(
                        '${index + 1}',
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF138F81),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          siswa['nama']?.toString() ?? '',
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF2D3436),
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        Text(
                          'NIS: ${siswa['nis'] ?? '-'} - ${nilaiSiswa.length} nilai',
                          style: const TextStyle(
                            fontSize: 10,
                            color: Color(0xFF636E72),
                          ),
                        ),
                        if (latest != null)
                          Text(
                            'Terakhir: ${latest['mata_pelajaran']?['nama'] ?? '-'} oleh ${latest['penilai_nama'] ?? '-'}',
                            style: const TextStyle(
                              fontSize: 10,
                              color: Color(0xFF636E72),
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                      ],
                    ),
                  ),
                  Column(
                    children: [
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          IconButton(
                            onPressed: () => _showNilaiRecordsSheet(siswa),
                            icon: const Icon(
                              Icons.edit_note_rounded,
                              size: 20,
                              color: Color(0xFF138F81),
                            ),
                            style: IconButton.styleFrom(
                              backgroundColor: const Color(0xFFE8F7F5),
                              minimumSize: const Size(36, 36),
                            ),
                          ),
                          const SizedBox(width: 6),
                          IconButton(
                            onPressed: () => _showExportOptions(
                              (siswa['id'] as num).toInt(),
                            ),
                            icon: const Icon(
                              Icons.picture_as_pdf_rounded,
                              size: 18,
                              color: Color(0xFF138F81),
                            ),
                            style: IconButton.styleFrom(
                              backgroundColor: const Color(0xFFE8F7F5),
                              minimumSize: const Size(36, 36),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      GestureDetector(
                        onTap: () => _showInputNilaiDialog(siswa),
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 6,
                          ),
                          decoration: BoxDecoration(
                            color: const Color(0xFF138F81),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: const Text(
                            '+ Nilai',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: Colors.white,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildHafalanTab() {
    if (_siswaList.isEmpty) {
      return const Center(
        child: Text(
          'Belum ada siswa di kelas ini',
          style: TextStyle(color: Color(0xFF636E72)),
        ),
      );
    }

    return ListView.builder(
      physics: const BouncingScrollPhysics(),
      itemCount: _siswaList.length,
      itemBuilder: (context, index) {
        final siswa = _siswaList[index];
        final hafalanSiswa = _hafalanBySiswa((siswa['id'] as num).toInt());
        final selesaiCount = hafalanSiswa.where((item) {
          return item['status']?.toString() == 'Selesai';
        }).length;
        final latest = hafalanSiswa.isNotEmpty ? hafalanSiswa.first : null;

        return Padding(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: GestureDetector(
            onTap: () => _showHafalanRecordsSheet(siswa),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(21),
              ),
              child: Row(
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: const Color(0xFF6C5CE7).withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(
                      Icons.menu_book_rounded,
                      size: 18,
                      color: Color(0xFF6C5CE7),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          siswa['nama']?.toString() ?? '',
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF2D3436),
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        Text(
                          '$selesaiCount/${hafalanSiswa.length} hafalan selesai',
                          style: const TextStyle(
                            fontSize: 10,
                            color: Color(0xFF636E72),
                          ),
                        ),
                        if (latest != null)
                          Text(
                            'Terakhir: ${latest['surah'] != null && '${latest['surah']}'.isNotEmpty ? 'Surah ${latest['surah']}' : 'Juz ${latest['juz'] ?? '-'}'} oleh ${latest['penilai_nama'] ?? '-'}',
                            style: const TextStyle(
                              fontSize: 10,
                              color: Color(0xFF636E72),
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                      ],
                    ),
                  ),
                  Column(
                    children: [
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          IconButton(
                            onPressed: () => _showHafalanRecordsSheet(siswa),
                            icon: const Icon(
                              Icons.edit_note_rounded,
                              size: 20,
                              color: Color(0xFF6C5CE7),
                            ),
                            style: IconButton.styleFrom(
                              backgroundColor: const Color(0xFFF0EBFF),
                              minimumSize: const Size(36, 36),
                            ),
                          ),
                          const SizedBox(width: 6),
                          IconButton(
                            onPressed: () => _showExportOptions(
                              (siswa['id'] as num).toInt(),
                            ),
                            icon: const Icon(
                              Icons.picture_as_pdf_rounded,
                              size: 18,
                              color: Color(0xFF6C5CE7),
                            ),
                            style: IconButton.styleFrom(
                              backgroundColor: const Color(0xFFF0EBFF),
                              minimumSize: const Size(36, 36),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      GestureDetector(
                        onTap: () => _showInputHafalanDialog(siswa),
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 6,
                          ),
                          decoration: BoxDecoration(
                            color: const Color(0xFF6C5CE7),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: const Text(
                            '+ Hafalan',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: Colors.white,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}
