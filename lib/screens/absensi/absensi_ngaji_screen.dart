import 'package:flutter/material.dart';

import '../../services/api_service.dart';
import '../../services/session_service.dart';
import '../../services/sync_service.dart';

class AbsensiNgajiScreen extends StatefulWidget {
  const AbsensiNgajiScreen({super.key});

  @override
  State<AbsensiNgajiScreen> createState() => _AbsensiNgajiScreenState();
}

class _AbsensiNgajiScreenState extends State<AbsensiNgajiScreen> {
  static const _yellow = Color(0xFFFFDC80);
  static const _panel = Color(0xFFE1EFF7);
  static const _teal = Color(0xFF138F81);
  static const _ink = Color(0xFF263238);
  static const _muted = Color(0xFF64707A);

  DateTime _selectedDate = DateTime.now();
  bool _loading = true;
  bool _saving = false;
  bool _rekapLoading = false;
  String _tab = 'input';
  String? _error;

  List<Map<String, dynamic>> _schedules = [];
  Map<String, dynamic>? _selectedSchedule;
  List<Map<String, dynamic>> _rows = [];
  final Map<int, String> _statuses = {};
  final Map<int, String> _initialStatuses = {};

  Map<String, dynamic>? _rekap;

  bool get _hasChanges {
    final ids = <int>{..._statuses.keys, ..._initialStatuses.keys};
    return ids.any(
      (id) => (_statuses[id] ?? '') != (_initialStatuses[id] ?? ''),
    );
  }

  @override
  void initState() {
    super.initState();
    _loadInitial();
  }

  Future<void> _loadInitial() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final result = await ApiService.getNgajiSchedules(activeOnly: true);
      final raw = (result['data'] as List? ?? const []);
      final schedules = raw
          .whereType<Map>()
          .map((item) => Map<String, dynamic>.from(item))
          .toList();

      if (!mounted) return;
      setState(() {
        _schedules = schedules;
        _selectedSchedule = schedules.isNotEmpty ? schedules.first : null;
      });

      if (_selectedSchedule != null) {
        await _loadContext();
      }
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  Future<void> _loadContext() async {
    final scheduleId = _selectedSchedule?['id'];
    if (scheduleId == null) return;

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final result = await ApiService.getAbsensiNgajiContext(
        tanggal: _dateValue(_selectedDate),
        ngajiScheduleId: int.parse(scheduleId.toString()),
      );

      final rawRows = (result['rows'] as List? ?? const []);
      final rows = rawRows
          .whereType<Map>()
          .map((item) => Map<String, dynamic>.from(item))
          .toList();
      final statuses = <int, String>{};
      for (final row in rows) {
        final siswa = Map<String, dynamic>.from(row['siswa'] as Map? ?? {});
        final id = int.tryParse(siswa['id']?.toString() ?? '');
        if (id == null) continue;
        final absensi = Map<String, dynamic>.from(row['absensi'] as Map? ?? {});
        final code = absensi['status_code']?.toString() ?? '';
        if (code.isNotEmpty) {
          statuses[id] = code;
        }
      }

      if (!mounted) return;
      setState(() {
        _rows = rows;
        _statuses
          ..clear()
          ..addAll(statuses);
        _initialStatuses
          ..clear()
          ..addAll(statuses);
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  Future<void> _save() async {
    if (_selectedSchedule == null || _saving) return;
    final items = _rows
        .map((row) {
          final siswa = Map<String, dynamic>.from(row['siswa'] as Map? ?? {});
          final siswaId = int.tryParse(siswa['id']?.toString() ?? '');
          if (siswaId == null) return null;
          final status = _statuses[siswaId];
          if (status == null || status.isEmpty) return null;
          return {
            'siswa_id': siswaId,
            'santri_pondok_id': row['santri_pondok_id'],
            'status_code': status,
          };
        })
        .whereType<Map<String, dynamic>>()
        .toList();

    if (items.isEmpty) {
      _showSnack('Pilih minimal satu status ngaji dulu.');
      return;
    }

    setState(() => _saving = true);
    try {
      final userId = await SessionService.getUserId();
      final name = await SessionService.getUserName();
      final result = await ApiService.createAbsensiNgajiBulk(
        tanggal: _dateValue(_selectedDate),
        ngajiScheduleId: int.parse(_selectedSchedule!['id'].toString()),
        items: items,
        actorUserId: userId > 0 ? userId : null,
        diinputOleh: name.isNotEmpty ? name : 'Admin/Guru',
        diinputVia: 'android',
      );

      if (!mounted) return;
      _showSnack(result['message']?.toString() ?? 'Absensi ngaji tersimpan.');
      await SyncService.notifyDataChanged(
        SyncTopics.absensiNgaji,
        message: 'Absensi ngaji berhasil diperbarui',
      );
      await _loadContext();
    } catch (e) {
      if (!mounted) return;
      _showSnack('Gagal simpan absensi ngaji: $e');
    } finally {
      if (mounted) {
        setState(() => _saving = false);
      }
    }
  }

  Future<void> _loadRekap() async {
    setState(() {
      _rekapLoading = true;
      _error = null;
    });

    try {
      final result = await ApiService.getRekapAbsensiNgaji(
        bulan: _selectedDate.month,
        tahun: _selectedDate.year,
        ngajiScheduleId: _selectedSchedule?['id'] == null
            ? null
            : int.tryParse(_selectedSchedule!['id'].toString()),
      );

      if (!mounted) return;
      setState(() => _rekap = result);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) {
        setState(() => _rekapLoading = false);
      }
    }
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate,
      firstDate: DateTime(2020),
      lastDate: DateTime(2035),
    );
    if (picked == null || !mounted) return;
    setState(() => _selectedDate = picked);
    if (_tab == 'input') {
      await _loadContext();
    } else {
      await _loadRekap();
    }
  }

  void _setStatus(int siswaId, String status) {
    setState(() {
      if (_statuses[siswaId] == status) {
        _statuses.remove(siswaId);
      } else {
        _statuses[siswaId] = status;
      }
    });
  }

  void _reset() {
    setState(() {
      _statuses
        ..clear()
        ..addAll(_initialStatuses);
    });
  }

  void _showSnack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message), backgroundColor: _ink));
  }

  String _dateValue(DateTime date) {
    final month = date.month.toString().padLeft(2, '0');
    final day = date.day.toString().padLeft(2, '0');
    return '${date.year}-$month-$day';
  }

  String _dateLabel(DateTime date) {
    final month = date.month.toString().padLeft(2, '0');
    final day = date.day.toString().padLeft(2, '0');
    return '$day/$month/${date.year}';
  }

  Map<String, int> _summary() {
    return {
      'H': _statuses.values.where((item) => item == 'H').length,
      'I': _statuses.values.where((item) => item == 'I').length,
      'S': _statuses.values.where((item) => item == 'S').length,
      'A': _statuses.values.where((item) => item == 'A').length,
      'Kosong': _rows.length - _statuses.length,
    };
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _yellow,
      body: SafeArea(
        child: RefreshIndicator(
          color: _teal,
          onRefresh: _tab == 'input' ? _loadContext : _loadRekap,
          child: CustomScrollView(
            slivers: [
              SliverPadding(
                padding: const EdgeInsets.all(16),
                sliver: SliverList(
                  delegate: SliverChildListDelegate([
                    _buildHeader(),
                    const SizedBox(height: 12),
                    _buildTabs(),
                    const SizedBox(height: 12),
                    if (_error != null) _buildError(),
                    _buildFilters(),
                    const SizedBox(height: 12),
                    if (_tab == 'input')
                      _buildInputContent()
                    else
                      _buildRekapContent(),
                    const SizedBox(height: 100),
                  ]),
                ),
              ),
            ],
          ),
        ),
      ),
      bottomNavigationBar: _tab == 'input' ? _buildBottomAction() : null,
    );
  }

  Widget _buildHeader() {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: _panel,
        borderRadius: BorderRadius.circular(24),
      ),
      child: Row(
        children: [
          Container(
            width: 56,
            height: 56,
            decoration: const BoxDecoration(
              color: Color(0xFFFFD96A),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.menu_book_rounded, color: _teal, size: 30),
          ),
          const SizedBox(width: 14),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Absensi Ngaji Kitab',
                  style: TextStyle(
                    fontSize: 23,
                    fontWeight: FontWeight.w800,
                    color: _ink,
                  ),
                ),
                SizedBox(height: 3),
                Text(
                  'Input H/I/S/A berdasarkan master jadwal ngaji.',
                  style: TextStyle(fontSize: 12.5, color: _muted),
                ),
              ],
            ),
          ),
          IconButton(
            onPressed: () => Navigator.pop(context),
            icon: const Icon(Icons.close_rounded, color: _ink, size: 30),
          ),
        ],
      ),
    );
  }

  Widget _buildTabs() {
    return Container(
      padding: const EdgeInsets.all(6),
      decoration: BoxDecoration(
        color: _panel,
        borderRadius: BorderRadius.circular(22),
      ),
      child: Row(
        children: [
          _tabButton('input', 'Input Ngaji'),
          _tabButton('rekap', 'Rekap Ngaji'),
        ],
      ),
    );
  }

  Widget _tabButton(String value, String label) {
    final active = _tab == value;
    return Expanded(
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: () async {
          setState(() => _tab = value);
          if (value == 'rekap') {
            await _loadRekap();
          }
        },
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          padding: const EdgeInsets.symmetric(vertical: 14),
          decoration: BoxDecoration(
            color: active ? _teal : Colors.transparent,
            borderRadius: BorderRadius.circular(18),
          ),
          child: Text(
            label,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontWeight: FontWeight.w700,
              color: active ? Colors.white : _muted,
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildFilters() {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: _panel,
        borderRadius: BorderRadius.circular(24),
      ),
      child: Column(
        children: [
          InkWell(
            onTap: _pickDate,
            borderRadius: BorderRadius.circular(16),
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Row(
                children: [
                  const Icon(Icons.calendar_today_rounded, color: _teal),
                  const SizedBox(width: 10),
                  Text(
                    _dateLabel(_selectedDate),
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<Map<String, dynamic>>(
                isExpanded: true,
                value: _selectedSchedule,
                hint: const Text('Pilih jadwal ngaji'),
                items: _schedules.map((schedule) {
                  final session = Map<String, dynamic>.from(
                    schedule['session'] as Map? ?? {},
                  );
                  final book = Map<String, dynamic>.from(
                    schedule['book'] as Map? ?? {},
                  );
                  final label =
                      '${session['name'] ?? 'Ngaji'} - ${book['name'] ?? 'Kitab'}';
                  return DropdownMenuItem(
                    value: schedule,
                    child: Text(label, overflow: TextOverflow.ellipsis),
                  );
                }).toList(),
                onChanged: (value) async {
                  if (value == null) return;
                  setState(() => _selectedSchedule = value);
                  if (_tab == 'input') {
                    await _loadContext();
                  } else {
                    await _loadRekap();
                  }
                },
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInputContent() {
    if (_loading) {
      return const Padding(
        padding: EdgeInsets.only(top: 60),
        child: Center(child: CircularProgressIndicator(color: _teal)),
      );
    }

    if (_selectedSchedule == null) {
      return _empty(
        'Belum ada jadwal ngaji aktif. Tambahkan dari web admin atau API master.',
      );
    }

    final summary = _summary();
    return Column(
      children: [
        Row(
          children: [
            _summaryCard('Hadir', summary['H'] ?? 0, 'H', _teal),
            const SizedBox(width: 8),
            _summaryCard(
              'Izin',
              summary['I'] ?? 0,
              'I',
              const Color(0xFFE65100),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            _summaryCard(
              'Sakit',
              summary['S'] ?? 0,
              'S',
              const Color(0xFFD32F2F),
            ),
            const SizedBox(width: 8),
            _summaryCard(
              'Alfa',
              summary['A'] ?? 0,
              'A',
              const Color(0xFF607D8B),
            ),
          ],
        ),
        const SizedBox(height: 12),
        if (_rows.isEmpty)
          _empty('Belum ada santri pada jadwal ngaji ini.')
        else
          ..._rows.asMap().entries.map(
            (entry) => _studentRow(entry.key, entry.value),
          ),
      ],
    );
  }

  Widget _buildRekapContent() {
    if (_rekapLoading) {
      return const Padding(
        padding: EdgeInsets.only(top: 60),
        child: Center(child: CircularProgressIndicator(color: _teal)),
      );
    }

    final summary = Map<String, dynamic>.from(_rekap?['summary'] as Map? ?? {});
    final rows = (_rekap?['rows'] as List? ?? const [])
        .whereType<Map>()
        .map((item) => Map<String, dynamic>.from(item))
        .toList();

    if (_rekap == null) {
      return _empty(
        'Tekan refresh atau buka tab rekap untuk melihat laporan ngaji.',
      );
    }

    return Column(
      children: [
        Row(
          children: [
            _summaryCard(
              'Hadir',
              int.tryParse('${summary['H'] ?? 0}') ?? 0,
              'H',
              _teal,
            ),
            const SizedBox(width: 8),
            _summaryCard(
              'Izin',
              int.tryParse('${summary['I'] ?? 0}') ?? 0,
              'I',
              const Color(0xFFE65100),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            _summaryCard(
              'Sakit',
              int.tryParse('${summary['S'] ?? 0}') ?? 0,
              'S',
              const Color(0xFFD32F2F),
            ),
            const SizedBox(width: 8),
            _summaryCard(
              'Alfa',
              int.tryParse('${summary['A'] ?? 0}') ?? 0,
              'A',
              const Color(0xFF607D8B),
            ),
          ],
        ),
        const SizedBox(height: 12),
        if (rows.isEmpty)
          _empty('Rekap ngaji belum tersedia.')
        else
          ...rows.map(_rekapRow),
      ],
    );
  }

  Widget _summaryCard(String title, int value, String code, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(18),
        ),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      color: _muted,
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    '$value',
                    style: const TextStyle(
                      color: _ink,
                      fontSize: 26,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text(
                code,
                style: TextStyle(color: color, fontWeight: FontWeight.w800),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _studentRow(int index, Map<String, dynamic> row) {
    final siswa = Map<String, dynamic>.from(row['siswa'] as Map? ?? {});
    final siswaId = int.tryParse(siswa['id']?.toString() ?? '') ?? 0;
    final selected = _statuses[siswaId] ?? '';

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
      ),
      child: Row(
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: _panel,
              borderRadius: BorderRadius.circular(14),
            ),
            child: Center(
              child: Text(
                '${index + 1}',
                style: const TextStyle(
                  color: _teal,
                  fontWeight: FontWeight.w800,
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
                  siswa['nama']?.toString() ?? '-',
                  style: const TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 15,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  siswa['kelas']?.toString() ?? '-',
                  style: const TextStyle(color: _muted, fontSize: 12),
                ),
              ],
            ),
          ),
          _statusButton(siswaId, selected, 'H', _teal),
          _statusButton(siswaId, selected, 'I', const Color(0xFFE65100)),
          _statusButton(siswaId, selected, 'S', const Color(0xFFD32F2F)),
          _statusButton(siswaId, selected, 'A', const Color(0xFF607D8B)),
        ],
      ),
    );
  }

  Widget _statusButton(int siswaId, String selected, String code, Color color) {
    final active = selected == code;
    return Padding(
      padding: const EdgeInsets.only(left: 5),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () => _setStatus(siswaId, code),
        child: Container(
          width: 38,
          height: 38,
          decoration: BoxDecoration(
            color: active ? color : color.withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Center(
            child: Text(
              code,
              style: TextStyle(
                color: active ? Colors.white : color,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _rekapRow(Map<String, dynamic> row) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  row['siswa']?.toString() ?? '-',
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 3),
                Text(
                  '${row['kelas'] ?? '-'} - ${row['sesi'] ?? '-'} - ${row['kitab'] ?? '-'}',
                  style: const TextStyle(color: _muted, fontSize: 12),
                ),
              ],
            ),
          ),
          _miniCount('H', row['H']),
          _miniCount('I', row['I']),
          _miniCount('S', row['S']),
          _miniCount('A', row['A']),
        ],
      ),
    );
  }

  Widget _miniCount(String label, dynamic value) {
    return Container(
      margin: const EdgeInsets.only(left: 6),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
      decoration: BoxDecoration(
        color: _panel,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Text(
        '$label ${value ?? 0}',
        style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800),
      ),
    );
  }

  Widget _buildBottomAction() {
    return SafeArea(
      child: Container(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 14),
        color: _yellow,
        child: Row(
          children: [
            Expanded(
              child: TextButton(
                onPressed: _saving || !_hasChanges ? null : _reset,
                child: const Text('Reset Pilihan'),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              flex: 2,
              child: ElevatedButton.icon(
                onPressed: _saving || !_hasChanges ? null : _save,
                style: ElevatedButton.styleFrom(
                  backgroundColor: _teal,
                  foregroundColor: Colors.white,
                  disabledBackgroundColor: _teal.withValues(alpha: 0.45),
                  padding: const EdgeInsets.symmetric(vertical: 15),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                ),
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
                label: Text(_saving ? 'Menyimpan...' : 'Simpan Absensi'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildError() {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFFFEBEE),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Text(
        _error!,
        style: const TextStyle(
          color: Color(0xFFD32F2F),
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }

  Widget _empty(String message) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        color: _panel,
        borderRadius: BorderRadius.circular(18),
      ),
      child: Text(
        message,
        textAlign: TextAlign.center,
        style: const TextStyle(color: _muted, fontWeight: FontWeight.w700),
      ),
    );
  }
}
