import 'dart:async';

import 'package:flutter/material.dart';

import '../../services/api_service.dart';
import '../../services/sync_service.dart';

class DataPondokScreen extends StatefulWidget {
  const DataPondokScreen({super.key});

  @override
  State<DataPondokScreen> createState() => _DataPondokScreenState();
}

class _DataPondokScreenState extends State<DataPondokScreen> {
  static const _teal = Color(0xFF138F81);
  static const _yellow = Color(0xFFFFDC80);
  static const _panel = Color(0xFFE1EFF7);
  static const _text = Color(0xFF2D3436);
  static const _muted = Color(0xFF636E72);

  bool _loading = true;
  String? _error;
  List<Map<String, dynamic>> _complexes = [];
  List<Map<String, dynamic>> _santri = [];
  List<Map<String, dynamic>> _siswa = [];
  List<Map<String, dynamic>> _guruAccess = [];
  List<Map<String, dynamic>> _guruOptions = [];
  int? _filterComplexId;
  int? _filterRoomId;
  String _filterStatus = 'Semua';
  final _searchController = TextEditingController();
  Timer? _santriSearchDebounce;

  List<Map<String, dynamic>> get _rooms => _complexes
      .expand(
        (complex) => List<Map<String, dynamic>>.from(complex['rooms'] ?? []),
      )
      .toList();

  @override
  void initState() {
    super.initState();
    unawaited(_loadData());
  }

  @override
  void dispose() {
    _santriSearchDebounce?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final results = await Future.wait([
        ApiService.getBoardingComplexes(includeInactive: true),
        ApiService.getBoardingStudents(includeInactive: true),
        ApiService.getSiswa(withWali: true, forBoarding: true),
        ApiService.getBoardingGuruAccess(),
      ]);
      if (!mounted) return;
      setState(() {
        _complexes = List<Map<String, dynamic>>.from(results[0]['data'] ?? []);
        _santri = List<Map<String, dynamic>>.from(results[1]['data'] ?? []);
        _siswa = List<Map<String, dynamic>>.from(results[2]['data'] ?? []);
        _guruAccess = List<Map<String, dynamic>>.from(results[3]['data'] ?? []);
        _guruOptions = List<Map<String, dynamic>>.from(
          results[3]['guru'] ?? [],
        );
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = 'Gagal memuat Data Pondok: $e';
        _loading = false;
      });
    }
  }

  void _showSnack(String message, {bool isError = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: isError ? const Color(0xFFE65100) : _teal,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }

  int _id(dynamic value) =>
      value is num ? value.toInt() : int.tryParse('$value') ?? 0;

  Set<int> get _activeAssignedSiswaIds => _santri
      .where((row) => row['status']?.toString() == 'Aktif')
      .map(
        (row) => _id(
          row['siswa_id'] ?? (row['siswa'] is Map ? row['siswa']['id'] : null),
        ),
      )
      .where((id) => id > 0)
      .toSet();

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 4,
      child: Scaffold(
        backgroundColor: _yellow,
        body: SafeArea(
          child: Column(
            children: [
              _header(),
              const SizedBox(height: 10),
              Container(
                margin: const EdgeInsets.symmetric(horizontal: 16),
                padding: const EdgeInsets.all(4),
                decoration: BoxDecoration(
                  color: _panel,
                  borderRadius: BorderRadius.circular(18),
                ),
                child: const TabBar(
                  indicator: BoxDecoration(
                    color: _teal,
                    borderRadius: BorderRadius.all(Radius.circular(15)),
                  ),
                  indicatorSize: TabBarIndicatorSize.tab,
                  labelColor: Colors.white,
                  unselectedLabelColor: _muted,
                  labelStyle: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                  ),
                  tabs: [
                    Tab(text: 'Komplek'),
                    Tab(text: 'Kamar'),
                    Tab(text: 'Santri'),
                    Tab(text: 'Akses'),
                  ],
                ),
              ),
              const SizedBox(height: 10),
              Expanded(
                child: _loading
                    ? const Center(
                        child: CircularProgressIndicator(color: _teal),
                      )
                    : _error != null
                    ? _errorView()
                    : TabBarView(
                        children: [
                          _complexTab(),
                          _roomTab(),
                          _santriTab(),
                          _guruAccessTab(),
                        ],
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _header() {
    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
      decoration: BoxDecoration(
        color: _panel,
        borderRadius: BorderRadius.circular(28),
      ),
      child: Row(
        children: [
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              color: _yellow,
              borderRadius: BorderRadius.circular(18),
            ),
            child: const Icon(Icons.apartment_rounded, color: _teal, size: 30),
          ),
          const SizedBox(width: 14),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Data Pondok',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                    color: _text,
                  ),
                ),
                SizedBox(height: 3),
                Text(
                  'Komplek, kamar, dan santri pondok',
                  style: TextStyle(fontSize: 12, color: _muted),
                ),
              ],
            ),
          ),
          IconButton(
            onPressed: () => Navigator.pop(context),
            icon: const Icon(Icons.arrow_back_ios_new_rounded, color: _text),
          ),
        ],
      ),
    );
  }

  Widget _errorView() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              _error!,
              textAlign: TextAlign.center,
              style: const TextStyle(color: _muted),
            ),
            const SizedBox(height: 12),
            ElevatedButton.icon(
              onPressed: _loadData,
              icon: const Icon(Icons.refresh_rounded),
              label: const Text('Muat Ulang'),
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

  Widget _complexTab() {
    return RefreshIndicator(
      onRefresh: _loadData,
      color: _teal,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 90),
        physics: const AlwaysScrollableScrollPhysics(
          parent: BouncingScrollPhysics(),
        ),
        children: [
          _primaryButton(
            'Tambah Komplek',
            Icons.add_rounded,
            () => _showComplexSheet(),
          ),
          const SizedBox(height: 12),
          if (_complexes.isEmpty)
            _emptyCard('Belum ada komplek pondok.')
          else
            ..._complexes.map(
              (complex) => _masterCard(
                title: complex['name']?.toString() ?? '-',
                subtitle:
                    '${complex['jumlah_santri'] ?? 0} santri • ${List.from(complex['rooms'] ?? []).length} kamar',
                active: complex['is_active'] != false,
                color: _teal,
                onEdit: () => _showComplexSheet(complex: complex),
                onDelete: () => _confirmDelete(
                  'Nonaktifkan/Hapus komplek ini?',
                  () => ApiService.deleteBoardingComplex(_id(complex['id'])),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _roomTab() {
    return RefreshIndicator(
      onRefresh: _loadData,
      color: _teal,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 90),
        physics: const AlwaysScrollableScrollPhysics(
          parent: BouncingScrollPhysics(),
        ),
        children: [
          _primaryButton(
            'Tambah Kamar',
            Icons.add_home_rounded,
            () => _showRoomSheet(),
          ),
          const SizedBox(height: 12),
          if (_rooms.isEmpty)
            _emptyCard('Belum ada kamar pondok.')
          else
            ..._rooms.map((room) {
              final complex = _complexes.firstWhere(
                (item) => _id(item['id']) == _id(room['boarding_complex_id']),
                orElse: () => const <String, dynamic>{},
              );
              return _masterCard(
                title: room['name']?.toString() ?? '-',
                subtitle:
                    '${complex['name'] ?? '-'} • ${room['jumlah_santri'] ?? 0} santri • kapasitas ${room['capacity'] ?? '-'}',
                active: room['is_active'] != false,
                color: const Color(0xFF2E86DE),
                onEdit: () => _showRoomSheet(room: room),
                onDelete: () => _confirmDelete(
                  'Nonaktifkan/Hapus kamar ini?',
                  () => ApiService.deleteBoardingRoom(_id(room['id'])),
                ),
              );
            }),
        ],
      ),
    );
  }

  Widget _santriTab() {
    final query = _searchController.text.trim().toLowerCase();
    final rows = _santri.where((row) {
      final siswa = Map<String, dynamic>.from(row['siswa'] ?? {});
      final matchSearch =
          query.isEmpty ||
          '${siswa['nama'] ?? ''} ${siswa['nis'] ?? ''} ${siswa['nisn'] ?? ''} ${siswa['kelas'] ?? ''}'
              .toLowerCase()
              .contains(query);
      final matchComplex =
          _filterComplexId == null ||
          _id(row['boarding_complex_id']) == _filterComplexId;
      final matchRoom =
          _filterRoomId == null ||
          _id(row['boarding_room_id']) == _filterRoomId;
      final matchStatus =
          _filterStatus == 'Semua' ||
          row['status']?.toString() == _filterStatus;
      return matchSearch && matchComplex && matchRoom && matchStatus;
    }).toList();

    return RefreshIndicator(
      onRefresh: _loadData,
      color: _teal,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 90),
        physics: const AlwaysScrollableScrollPhysics(
          parent: BouncingScrollPhysics(),
        ),
        children: [
          _primaryButton(
            'Atur Santri Pondok',
            Icons.person_add_alt_1_rounded,
            () => _showSantriSheet(),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: _searchController,
            onChanged: (_) {
              _santriSearchDebounce?.cancel();
              _santriSearchDebounce = Timer(
                const Duration(milliseconds: 250),
                () {
                  if (mounted) setState(() {});
                },
              );
            },
            decoration: _inputDecoration('Cari nama / NIS / NISN / kelas'),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: _complexDropdown(
                  _filterComplexId,
                  (value) => setState(() {
                    _filterComplexId = value;
                    _filterRoomId = null;
                  }),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _roomDropdown(
                  _filterRoomId,
                  (value) => setState(() => _filterRoomId = value),
                  complexId: _filterComplexId,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: ['Semua', 'Aktif', 'Nonaktif'].map((status) {
              final selected = _filterStatus == status;
              return Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 3),
                  child: OutlinedButton(
                    onPressed: () => setState(() => _filterStatus = status),
                    style: OutlinedButton.styleFrom(
                      backgroundColor: selected ? _teal : Colors.white,
                      foregroundColor: selected ? Colors.white : _muted,
                      side: BorderSide(color: selected ? _teal : _panel),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(13),
                      ),
                    ),
                    child: Text(
                      status,
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: 12),
          if (rows.isEmpty)
            _emptyCard('Belum ada santri pondok pada filter ini.')
          else
            ...rows.map((row) {
              final siswa = Map<String, dynamic>.from(row['siswa'] ?? {});
              final active = row['status']?.toString() == 'Aktif';
              return Container(
                margin: const EdgeInsets.only(bottom: 10),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(18),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        color: active
                            ? _teal.withValues(alpha: 0.12)
                            : const Color(0xFFE65100).withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: Icon(
                        Icons.person_rounded,
                        color: active ? _teal : const Color(0xFFE65100),
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
                              fontSize: 13,
                              fontWeight: FontWeight.w800,
                              color: _text,
                            ),
                          ),
                          const SizedBox(height: 3),
                          Text(
                            '${siswa['nis'] ?? '-'} • ${siswa['kelas'] ?? '-'} • ${row['komplek'] ?? '-'} / ${row['kamar'] ?? '-'}',
                            style: const TextStyle(fontSize: 10, color: _muted),
                          ),
                          const SizedBox(height: 6),
                          Wrap(
                            spacing: 6,
                            runSpacing: 4,
                            children: [
                              _chip(
                                active ? 'Aktif' : 'Nonaktif',
                                active ? _teal : const Color(0xFFE65100),
                              ),
                              _chip(
                                row['participates_prayer'] == true
                                    ? 'Ikut sholat'
                                    : 'Tidak ikut sholat',
                                row['participates_prayer'] == true
                                    ? const Color(0xFF2E86DE)
                                    : _muted,
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      onPressed: () => _showSantriSheet(row: row),
                      icon: const Icon(
                        Icons.edit_rounded,
                        color: Color(0xFF2E86DE),
                      ),
                    ),
                    IconButton(
                      onPressed: () =>
                          _toggleSantriStatus(row, active: !active),
                      icon: Icon(
                        active
                            ? Icons.pause_circle_outline_rounded
                            : Icons.check_circle_outline_rounded,
                        color: active ? const Color(0xFFE65100) : _teal,
                      ),
                    ),
                    IconButton(
                      onPressed: () => _confirmDelete(
                        'Nonaktifkan santri pondok ini?',
                        () => ApiService.deleteBoardingSantri(_id(row['id'])),
                      ),
                      icon: const Icon(
                        Icons.block_rounded,
                        color: Color(0xFFE65100),
                      ),
                    ),
                  ],
                ),
              );
            }),
        ],
      ),
    );
  }

  Widget _guruAccessTab() {
    return RefreshIndicator(
      onRefresh: _loadData,
      color: _teal,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 90),
        physics: const AlwaysScrollableScrollPhysics(
          parent: BouncingScrollPhysics(),
        ),
        children: [
          _primaryButton(
            'Atur Akses Guru Sholat',
            Icons.admin_panel_settings_rounded,
            () => _showGuruAccessSheet(),
          ),
          const SizedBox(height: 12),
          if (_guruAccess.isEmpty)
            _emptyCard('Belum ada akses guru khusus absensi sholat.')
          else
            ..._guruAccess.map((row) {
              final guru = Map<String, dynamic>.from(row['user'] ?? {});
              final complex = Map<String, dynamic>.from(row['complex'] ?? {});
              final room = Map<String, dynamic>.from(row['room'] ?? {});
              final active = row['is_active'] != false;
              final scope = room['name'] != null
                  ? '${complex['name'] ?? '-'} / ${room['name']}'
                  : complex['name'] != null
                  ? 'Semua kamar ${complex['name']}'
                  : 'Semua komplek dan kamar';
              return _masterCard(
                title: guru['name']?.toString() ?? '-',
                subtitle:
                    '$scope - input: ${row['can_input'] == true ? 'ya' : 'tidak'} - rekap: ${row['can_view_rekap'] == true ? 'ya' : 'tidak'}',
                active: active,
                color: const Color(0xFF6C5CE7),
                onEdit: () => _showGuruAccessSheet(row: row),
                onDelete: () => _confirmDelete(
                  'Hapus akses guru ini?',
                  () => ApiService.deleteBoardingGuruAccess(_id(row['id'])),
                ),
              );
            }),
        ],
      ),
    );
  }

  Widget _primaryButton(String label, IconData icon, VoidCallback onTap) {
    return SizedBox(
      width: double.infinity,
      child: ElevatedButton.icon(
        onPressed: onTap,
        icon: Icon(icon),
        label: Text(label, style: const TextStyle(fontWeight: FontWeight.w800)),
        style: ElevatedButton.styleFrom(
          backgroundColor: _teal,
          foregroundColor: Colors.white,
          elevation: 0,
          padding: const EdgeInsets.symmetric(vertical: 13),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
        ),
      ),
    );
  }

  Widget _masterCard({
    required String title,
    required String subtitle,
    required bool active,
    required Color color,
    required VoidCallback onEdit,
    required VoidCallback onDelete,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(Icons.meeting_room_rounded, color: color),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                    color: _text,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  subtitle,
                  style: const TextStyle(fontSize: 10, color: _muted),
                ),
                const SizedBox(height: 5),
                _chip(
                  active ? 'Aktif' : 'Nonaktif',
                  active ? _teal : const Color(0xFFE65100),
                ),
              ],
            ),
          ),
          IconButton(
            onPressed: onEdit,
            icon: const Icon(Icons.edit_rounded, color: Color(0xFF2E86DE)),
          ),
          IconButton(
            onPressed: onDelete,
            icon: const Icon(
              Icons.delete_outline_rounded,
              color: Color(0xFFE65100),
            ),
          ),
        ],
      ),
    );
  }

  Widget _emptyCard(String text) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
      ),
      child: Text(
        text,
        textAlign: TextAlign.center,
        style: const TextStyle(color: _muted, fontWeight: FontWeight.w700),
      ),
    );
  }

  Widget _chip(String text, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(9),
      ),
      child: Text(
        text,
        style: TextStyle(
          fontSize: 9,
          fontWeight: FontWeight.w800,
          color: color,
        ),
      ),
    );
  }

  InputDecoration _inputDecoration(String hint) {
    return InputDecoration(
      hintText: hint,
      filled: true,
      fillColor: Colors.white,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: BorderSide.none,
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
    );
  }

  Widget _complexDropdown(int? value, ValueChanged<int?> onChanged) {
    return DropdownButtonFormField<int>(
      initialValue: _complexes.any((item) => _id(item['id']) == value)
          ? value
          : null,
      decoration: _inputDecoration('Komplek'),
      items: [
        const DropdownMenuItem<int>(value: 0, child: Text('Semua')),
        ..._complexes.map(
          (complex) => DropdownMenuItem<int>(
            value: _id(complex['id']),
            child: Text(complex['name']?.toString() ?? '-'),
          ),
        ),
      ],
      onChanged: (id) => onChanged(id == 0 ? null : id),
    );
  }

  Widget _roomDropdown(
    int? value,
    ValueChanged<int?> onChanged, {
    int? complexId,
  }) {
    final rooms = _rooms
        .where(
          (room) =>
              complexId == null ||
              _id(room['boarding_complex_id']) == complexId,
        )
        .toList();
    return DropdownButtonFormField<int>(
      initialValue: rooms.any((item) => _id(item['id']) == value)
          ? value
          : null,
      decoration: _inputDecoration('Kamar'),
      items: [
        const DropdownMenuItem<int>(value: 0, child: Text('Semua')),
        ...rooms.map(
          (room) => DropdownMenuItem<int>(
            value: _id(room['id']),
            child: Text(room['name']?.toString() ?? '-'),
          ),
        ),
      ],
      onChanged: (id) => onChanged(id == 0 ? null : id),
    );
  }

  Future<void> _showComplexSheet({Map<String, dynamic>? complex}) async {
    final name = TextEditingController(
      text: complex?['name']?.toString() ?? '',
    );
    final description = TextEditingController(
      text: complex?['description']?.toString() ?? '',
    );
    bool active = complex?['is_active'] != false;
    final saved = await _showSheet(
      title: complex == null ? 'Tambah Komplek' : 'Edit Komplek',
      childBuilder: (sheetContext) => StatefulBuilder(
        builder: (ctx, setModalState) => Column(
          children: [
            TextField(
              controller: name,
              decoration: _inputDecoration('Nama komplek'),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: description,
              decoration: _inputDecoration('Keterangan'),
              maxLines: 2,
            ),
            SwitchListTile(
              value: active,
              onChanged: (value) => setModalState(() => active = value),
              title: const Text(
                'Aktif',
                style: TextStyle(fontWeight: FontWeight.w700),
              ),
              activeThumbColor: _teal,
            ),
            _saveSheetButton(sheetContext, () async {
              final payload = {
                'name': name.text.trim(),
                'description': description.text.trim(),
                'is_active': active,
              };
              if (payload['name'].toString().isEmpty) {
                _showSnack('Nama komplek wajib diisi.', isError: true);
                return;
              }
              if (complex == null) {
                await ApiService.createBoardingComplex(payload);
              } else {
                await ApiService.updateBoardingComplex(
                  _id(complex['id']),
                  payload,
                );
              }
            }),
          ],
        ),
      ),
    );
    if (saved == true && mounted) {
      await _loadData();
      _showSnack('Data Pondok berhasil disimpan.');
    }
    name.dispose();
    description.dispose();
  }

  Future<void> _showRoomSheet({Map<String, dynamic>? room}) async {
    final name = TextEditingController(text: room?['name']?.toString() ?? '');
    final capacity = TextEditingController(
      text: room?['capacity']?.toString() ?? '',
    );
    final description = TextEditingController(
      text: room?['description']?.toString() ?? '',
    );
    int? complexId = _id(room?['boarding_complex_id']);
    if (complexId == 0) {
      complexId = _complexes.isNotEmpty ? _id(_complexes.first['id']) : null;
    }
    bool active = room?['is_active'] != false;
    final saved = await _showSheet(
      title: room == null ? 'Tambah Kamar' : 'Edit Kamar',
      childBuilder: (sheetContext) => StatefulBuilder(
        builder: (ctx, setModalState) => Column(
          children: [
            _complexDropdown(
              complexId,
              (value) => setModalState(() => complexId = value),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: name,
              decoration: _inputDecoration('Nama / nomor kamar'),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: capacity,
              decoration: _inputDecoration('Kapasitas'),
              keyboardType: TextInputType.number,
            ),
            const SizedBox(height: 10),
            TextField(
              controller: description,
              decoration: _inputDecoration('Keterangan'),
              maxLines: 2,
            ),
            SwitchListTile(
              value: active,
              onChanged: (value) => setModalState(() => active = value),
              title: const Text(
                'Aktif',
                style: TextStyle(fontWeight: FontWeight.w700),
              ),
              activeThumbColor: _teal,
            ),
            _saveSheetButton(sheetContext, () async {
              if (complexId == null ||
                  complexId == 0 ||
                  name.text.trim().isEmpty) {
                _showSnack(
                  'Komplek dan nama kamar wajib diisi.',
                  isError: true,
                );
                return;
              }
              final payload = {
                'boarding_complex_id': complexId,
                'name': name.text.trim(),
                'capacity': int.tryParse(capacity.text.trim()),
                'description': description.text.trim(),
                'is_active': active,
              };
              if (room == null) {
                await ApiService.createBoardingRoom(payload);
              } else {
                await ApiService.updateBoardingRoom(_id(room['id']), payload);
              }
            }),
          ],
        ),
      ),
    );
    if (saved == true && mounted) {
      await _loadData();
      _showSnack('Data Pondok berhasil disimpan.');
    }
    name.dispose();
    capacity.dispose();
    description.dispose();
  }

  Future<void> _showSantriSheet({Map<String, dynamic>? row}) async {
    final siswa = Map<String, dynamic>.from(row?['siswa'] ?? {});
    int? siswaId = _id(siswa['id']);
    if (siswaId == 0) siswaId = null;
    int? roomId = _id(row?['boarding_room_id']);
    if (roomId == 0) {
      roomId = _rooms.isNotEmpty ? _id(_rooms.first['id']) : null;
    }
    int? complexId = _id(row?['boarding_complex_id']);
    if (complexId == 0 && roomId != null) {
      final matches = _rooms
          .where((item) => _id(item['id']) == roomId)
          .toList();
      final room = matches.isEmpty ? null : matches.first;
      complexId = _id(room?['boarding_complex_id']);
    }
    if (complexId == 0) {
      complexId = _complexes.isNotEmpty ? _id(_complexes.first['id']) : null;
    }
    bool active = row?['status']?.toString() != 'Nonaktif';
    bool resident = row?['is_resident'] != false;
    bool prayer = row?['participates_prayer'] != false;
    final selectedIds = <int>{?siswaId};
    final search = TextEditingController();
    String searchQuery = '';

    final saved = await _showSheet(
      title: row == null ? 'Atur Santri Pondok' : 'Edit Santri Pondok',
      childBuilder: (sheetContext) => StatefulBuilder(
        builder: (ctx, setModalState) => Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _complexDropdown(
              complexId,
              row == null
                  ? (value) => setModalState(() {
                      complexId = value;
                      final rooms = _rooms
                          .where(
                            (room) =>
                                _id(room['boarding_complex_id']) == complexId,
                          )
                          .toList();
                      roomId = rooms.isNotEmpty ? _id(rooms.first['id']) : null;
                    })
                  : (_) {},
            ),
            const SizedBox(height: 10),
            _roomDropdown(
              roomId,
              (value) => setModalState(() => roomId = value),
              complexId: complexId,
            ),
            if (row == null) ...[
              const SizedBox(height: 10),
              TextField(
                controller: search,
                decoration: _inputDecoration('Cari nama / NIS / NISN / kelas'),
                onChanged: (value) => setModalState(
                  () => searchQuery = value.trim().toLowerCase(),
                ),
              ),
              const SizedBox(height: 8),
              Builder(
                builder: (_) {
                  final assignedIds = _activeAssignedSiswaIds;
                  final available = _siswa.where((item) {
                    final id = _id(item['id']);
                    return id > 0 && !assignedIds.contains(id);
                  }).toList();
                  final filtered = available
                      .where((item) => _studentMatches(item, searchQuery))
                      .toList();
                  return Column(
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              '${selectedIds.where((id) => !assignedIds.contains(id)).length} santri dipilih',
                              style: const TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w800,
                                color: _text,
                              ),
                            ),
                          ),
                          TextButton(
                            onPressed: filtered.isEmpty
                                ? null
                                : () => setModalState(
                                    () => selectedIds.addAll(
                                      filtered
                                          .map((item) => _id(item['id']))
                                          .where((id) => id > 0),
                                    ),
                                  ),
                            child: const Text('Pilih Semua'),
                          ),
                          TextButton(
                            onPressed: filtered.isEmpty
                                ? null
                                : () => setModalState(
                                    () => selectedIds.removeAll(
                                      filtered.map((item) => _id(item['id'])),
                                    ),
                                  ),
                            child: const Text('Batal'),
                          ),
                        ],
                      ),
                      Align(
                        alignment: Alignment.centerRight,
                        child: TextButton.icon(
                          onPressed: selectedIds.isEmpty
                              ? null
                              : () => setModalState(selectedIds.clear),
                          icon: const Icon(Icons.clear_all_rounded, size: 16),
                          label: const Text('Bersihkan Pilihan'),
                        ),
                      ),
                      ConstrainedBox(
                        constraints: const BoxConstraints(maxHeight: 280),
                        child: filtered.isEmpty
                            ? _emptyCard(
                                available.isEmpty
                                    ? 'Semua santri sudah terdaftar di data pondok. Gunakan fitur Edit untuk memindahkan santri ke kamar lain.'
                                    : 'Santri tidak ditemukan.',
                              )
                            : ListView.builder(
                                shrinkWrap: true,
                                itemCount: filtered.length,
                                itemBuilder: (_, index) {
                                  final item = filtered[index];
                                  final id = _id(item['id']);
                                  final checked = selectedIds.contains(id);
                                  return CheckboxListTile(
                                    value: checked,
                                    dense: true,
                                    controlAffinity:
                                        ListTileControlAffinity.leading,
                                    activeColor: _teal,
                                    title: Text(
                                      item['nama']?.toString() ?? '-',
                                      style: const TextStyle(
                                        fontSize: 12,
                                        fontWeight: FontWeight.w800,
                                      ),
                                    ),
                                    subtitle: Text(
                                      _studentSubtitle(item),
                                      style: const TextStyle(fontSize: 10),
                                    ),
                                    onChanged: (value) => setModalState(() {
                                      if (value == true) {
                                        selectedIds.add(id);
                                      } else {
                                        selectedIds.remove(id);
                                      }
                                    }),
                                  );
                                },
                              ),
                      ),
                    ],
                  );
                },
              ),
            ] else ...[
              const SizedBox(height: 10),
              _emptyCard(
                '${siswa['nama'] ?? '-'}\n${siswa['nis'] ?? '-'} - ${siswa['kelas'] ?? '-'}',
              ),
            ],
            SwitchListTile(
              value: active,
              onChanged: (value) => setModalState(() => active = value),
              title: const Text(
                'Status Pondok Aktif',
                style: TextStyle(fontWeight: FontWeight.w700),
              ),
              activeThumbColor: _teal,
            ),
            SwitchListTile(
              value: resident,
              onChanged: (value) => setModalState(() => resident = value),
              title: const Text(
                'Penghuni pondok utama',
                style: TextStyle(fontWeight: FontWeight.w700),
              ),
              activeThumbColor: _teal,
            ),
            SwitchListTile(
              value: prayer,
              onChanged: (value) => setModalState(() => prayer = value),
              title: const Text(
                'Ikut kegiatan sholat',
                style: TextStyle(fontWeight: FontWeight.w700),
              ),
              activeThumbColor: _teal,
            ),
            _saveSheetButton(sheetContext, () async {
              if (roomId == null || roomId == 0 || selectedIds.isEmpty) {
                _showSnack('Siswa dan kamar wajib dipilih.', isError: true);
                return;
              }
              if (row == null) {
                final siswaIds = selectedIds
                    .where((id) => !_activeAssignedSiswaIds.contains(id))
                    .toList();
                if (siswaIds.isEmpty) {
                  _showSnack(
                    'Semua santri yang dipilih sudah terdaftar aktif. Gunakan Edit untuk pindah kamar.',
                    isError: true,
                  );
                  return;
                }
                final result = await ApiService.assignBoardingStudents(
                  boardingRoomId: roomId!,
                  siswaIds: siswaIds,
                  status: active ? 'Aktif' : 'Nonaktif',
                  isResident: resident,
                  participatesPrayer: prayer,
                );
                if (result['success'] != true) {
                  throw ApiException(
                    result['message']?.toString() ??
                        'Sebagian santri sudah terdaftar aktif. Gunakan Edit untuk pindah kamar.',
                  );
                }
              } else {
                await ApiService.saveBoardingSantri({
                  'boarding_room_id': roomId,
                  'status': active ? 'Aktif' : 'Nonaktif',
                  'is_resident': resident,
                  'participates_prayer': prayer,
                }, id: _id(row['id']));
              }
            }),
          ],
        ),
      ),
    );
    search.dispose();
    if (saved == true && mounted) {
      await _loadData();
      _showSnack(
        row == null
            ? '${selectedIds.length} santri berhasil disimpan.'
            : 'Santri pondok berhasil diperbarui.',
      );
    }
  }

  Future<void> _showGuruAccessSheet({Map<String, dynamic>? row}) async {
    int? guruId = _id(row?['user_id']);
    if (guruId == 0) {
      guruId = _guruOptions.isNotEmpty ? _id(_guruOptions.first['id']) : null;
    }
    int? complexId = _id(row?['boarding_complex_id']);
    if (complexId == 0) complexId = null;
    int? roomId = _id(row?['boarding_room_id']);
    if (roomId == 0) roomId = null;
    bool canInput = row?['can_input'] != false;
    bool canRekap = row?['can_view_rekap'] != false;
    bool canEdit = row?['can_edit'] == true;
    bool active = row?['is_active'] != false;

    final saved = await _showSheet(
      title: row == null ? 'Atur Akses Guru Sholat' : 'Edit Akses Guru Sholat',
      childBuilder: (sheetContext) => StatefulBuilder(
        builder: (ctx, setModalState) => Column(
          children: [
            DropdownButtonFormField<int>(
              initialValue:
                  _guruOptions.any((item) => _id(item['id']) == guruId)
                  ? guruId
                  : null,
              decoration: _inputDecoration('Guru'),
              items: _guruOptions
                  .map(
                    (guru) => DropdownMenuItem<int>(
                      value: _id(guru['id']),
                      child: Text(
                        guru['name']?.toString() ?? '-',
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  )
                  .toList(),
              onChanged: (value) => setModalState(() => guruId = value),
            ),
            const SizedBox(height: 10),
            _complexDropdown(
              complexId,
              (value) => setModalState(() {
                complexId = value;
                roomId = null;
              }),
            ),
            const SizedBox(height: 10),
            _roomDropdown(
              roomId,
              (value) => setModalState(() => roomId = value),
              complexId: complexId,
            ),
            SwitchListTile(
              value: canInput,
              onChanged: (value) => setModalState(() => canInput = value),
              title: const Text(
                'Boleh input absensi',
                style: TextStyle(fontWeight: FontWeight.w700),
              ),
              activeThumbColor: _teal,
            ),
            SwitchListTile(
              value: canRekap,
              onChanged: (value) => setModalState(() => canRekap = value),
              title: const Text(
                'Boleh lihat rekap',
                style: TextStyle(fontWeight: FontWeight.w700),
              ),
              activeThumbColor: _teal,
            ),
            SwitchListTile(
              value: canEdit,
              onChanged: (value) => setModalState(() => canEdit = value),
              title: const Text(
                'Boleh edit data guru lain',
                style: TextStyle(fontWeight: FontWeight.w700),
              ),
              activeThumbColor: _teal,
            ),
            SwitchListTile(
              value: active,
              onChanged: (value) => setModalState(() => active = value),
              title: const Text(
                'Akses aktif',
                style: TextStyle(fontWeight: FontWeight.w700),
              ),
              activeThumbColor: _teal,
            ),
            _saveSheetButton(sheetContext, () async {
              if (guruId == null || guruId == 0) {
                _showSnack('Guru wajib dipilih.', isError: true);
                return;
              }
              await ApiService.saveBoardingGuruAccess({
                'user_id': guruId,
                'boarding_complex_id': complexId,
                'boarding_room_id': roomId,
                'can_input': canInput,
                'can_view_rekap': canRekap,
                'can_edit': canEdit,
                'is_active': active,
              });
            }),
          ],
        ),
      ),
    );
    if (saved == true && mounted) {
      await _loadData();
      _showSnack('Akses guru absensi sholat berhasil disimpan.');
    }
  }

  Widget _saveSheetButton(
    BuildContext sheetContext,
    Future<void> Function() onSave,
  ) {
    return _SheetSaveButton(
      color: _teal,
      onSave: onSave,
      onSuccess: () {
        if (sheetContext.mounted) Navigator.of(sheetContext).pop(true);
      },
      onError: (message) =>
          _showSnack('Gagal menyimpan: $message', isError: true),
    );
  }

  Future<bool?> _showSheet({
    required String title,
    required Widget Function(BuildContext sheetContext) childBuilder,
  }) {
    return showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => SafeArea(
        child: Container(
          constraints: BoxConstraints(
            maxHeight: MediaQuery.of(ctx).size.height * 0.92,
          ),
          padding: EdgeInsets.fromLTRB(
            20,
            18,
            20,
            MediaQuery.of(ctx).viewInsets.bottom + 20,
          ),
          decoration: const BoxDecoration(
            color: _panel,
            borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
          ),
          child: SingleChildScrollView(
            keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                    color: _text,
                  ),
                ),
                const SizedBox(height: 14),
                childBuilder(ctx),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _confirmDelete(
    String message,
    Future<Map<String, dynamic>> Function() action,
  ) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Konfirmasi'),
        content: Text(message),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Batal'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Lanjut'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      final result = await action();
      await _loadData();
      if (!mounted) return;
      unawaited(
        SyncService.notifyDataChanged(
          SyncTopics.absensiSholat,
          message: 'Data pondok diperbarui',
        ),
      );
      unawaited(
        SyncService.notifyDataChanged(
          SyncTopics.siswa,
          message: 'Data santri pondok diperbarui',
        ),
      );
      _showSnack(result['message']?.toString() ?? 'Data berhasil diperbarui.');
    } catch (e) {
      _showSnack('Gagal memperbarui data: $e', isError: true);
    }
  }

  bool _studentMatches(Map<String, dynamic> item, String query) {
    if (query.trim().isEmpty) return true;
    final text =
        '${item['nama'] ?? ''} ${item['nis'] ?? ''} ${item['nisn'] ?? ''} ${item['kelas'] ?? ''} ${item['kelompok_belajar_label'] ?? ''}'
            .toLowerCase();
    return text.contains(query.toLowerCase());
  }

  String _studentSubtitle(Map<String, dynamic> item) {
    final parts = [
      if ((item['nis']?.toString() ?? '').isNotEmpty) 'NIS: ${item['nis']}',
      if ((item['nisn']?.toString() ?? '').isNotEmpty) 'NISN: ${item['nisn']}',
      if ((item['kelas']?.toString() ?? '').isNotEmpty)
        item['kelas'].toString(),
      if ((item['kelompok_belajar_label']?.toString() ?? '').isNotEmpty)
        item['kelompok_belajar_label'].toString(),
    ];
    return parts.isEmpty ? '-' : parts.join(' - ');
  }

  Future<void> _toggleSantriStatus(
    Map<String, dynamic> row, {
    required bool active,
  }) async {
    final label = active ? 'aktifkan' : 'nonaktifkan';
    await _confirmDelete(
      'Yakin $label santri pondok ini?',
      () => ApiService.saveBoardingSantri({
        'status': active ? 'Aktif' : 'Nonaktif',
        'participates_prayer': active,
      }, id: _id(row['id'])),
    );
  }
}

class _SheetSaveButton extends StatefulWidget {
  const _SheetSaveButton({
    required this.color,
    required this.onSave,
    required this.onSuccess,
    required this.onError,
  });

  final Color color;
  final Future<void> Function() onSave;
  final VoidCallback onSuccess;
  final ValueChanged<Object> onError;

  @override
  State<_SheetSaveButton> createState() => _SheetSaveButtonState();
}

class _SheetSaveButtonState extends State<_SheetSaveButton> {
  bool _saving = false;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      child: ElevatedButton.icon(
        onPressed: _saving
            ? null
            : () async {
                setState(() => _saving = true);
                try {
                  await widget.onSave();
                  if (!mounted) return;
                  widget.onSuccess();
                } catch (e) {
                  if (mounted) setState(() => _saving = false);
                  widget.onError(e);
                }
              },
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
          _saving ? 'Menyimpan...' : 'Simpan',
          style: const TextStyle(fontWeight: FontWeight.w800),
        ),
        style: ElevatedButton.styleFrom(
          backgroundColor: widget.color,
          foregroundColor: Colors.white,
          disabledBackgroundColor: widget.color.withValues(alpha: 0.45),
          padding: const EdgeInsets.symmetric(vertical: 13),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
        ),
      ),
    );
  }
}
