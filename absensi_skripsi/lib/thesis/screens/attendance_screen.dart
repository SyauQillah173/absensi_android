import 'dart:async';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../services/thesis_database.dart';
import '../services/thesis_sync.dart';

class AttendanceScreen extends StatefulWidget {
  final VoidCallback onSaved;
  final String? editLocalId;
  const AttendanceScreen({super.key, required this.onSaved, this.editLocalId});

  @override
  State<AttendanceScreen> createState() => _AttendanceScreenState();
}

class _AttendanceScreenState extends State<AttendanceScreen> {
  final _statuses = const ['Hadir', 'Sakit', 'Izin', 'Alpa'];
  final _noteTemplates = const [
    'Sakit di rumah',
    'Pergi pulang kampung',
    'Tidak ada kabar (pergi tanpa izin)',
    'Keluarga ada acara',
    'Lainnya',
  ];
  List<Map<String, dynamic>> _classes = [];
  List<Map<String, dynamic>> _students = [];
  final Map<int, String> _status = {};
  final Map<int, TextEditingController> _notes = {};
  int? _classId;
  DateTime _date = DateTime.now();
  TimeOfDay _time = TimeOfDay.now();
  bool _loading = true;
  bool _saving = false;
  String? _activeLocalId;
  String _syncStatus = 'new';
  bool get _editing => _activeLocalId != null;

  @override
  void initState() {
    super.initState();
    _loadClasses();
  }

  Future<void> _loadClasses() async {
    _classes = await ThesisDatabase.instance.classes();
    if (widget.editLocalId != null) {
      final attendance = await ThesisDatabase.instance.attendance(
        widget.editLocalId!,
      );
      if (attendance != null) {
        _activeLocalId =
            attendance['local_id']?.toString() ?? widget.editLocalId;
        _syncStatus = attendance['sync_status']?.toString() ?? 'pending';
        _classId = (attendance['id_kelas'] as num).toInt();
        _date = DateTime.parse(attendance['tanggal'].toString());
        _time = _parseTime(attendance['waktu_mulai'].toString());
        final detail = (attendance['detail'] as List? ?? const [])
            .map((row) => Map<String, dynamic>.from(row as Map))
            .toList();
        await _loadStudents(existingDetails: detail);
      }
    } else if (_classes.isNotEmpty) {
      _classId = (_classes.first['id_kelas'] as num).toInt();
      await _loadStudents();
      await _loadExistingForCurrentScope();
    }
    if (mounted) setState(() => _loading = false);
  }

  String get _dateText => DateFormat('yyyy-MM-dd').format(_date);

  String get _timeText =>
      '${_time.hour.toString().padLeft(2, '0')}:${_time.minute.toString().padLeft(2, '0')}:00';

  Future<void> _loadExistingForCurrentScope() async {
    if (_classId == null) return;
    final existing = await ThesisDatabase.instance.attendanceByScope(
      classId: _classId!,
      date: _dateText,
      startTime: _timeText,
    );
    if (existing == null) {
      _activeLocalId = null;
      _syncStatus = 'new';
      await _loadStudents();
      return;
    }

    _activeLocalId = existing['local_id']?.toString();
    _syncStatus = existing['sync_status']?.toString() ?? 'pending';
    _date = DateTime.parse(existing['tanggal'].toString());
    _time = _parseTime(existing['waktu_mulai'].toString());
    final detail = (existing['detail'] as List? ?? const [])
        .map((row) => Map<String, dynamic>.from(row as Map))
        .toList();
    await _loadStudents(existingDetails: detail);
  }

  Future<void> _loadStudents({
    List<Map<String, dynamic>> existingDetails = const [],
  }) async {
    if (_classId == null) return;
    _students = await ThesisDatabase.instance.students(_classId!);
    final existing = {
      for (final row in existingDetails) (row['id_santri'] as num).toInt(): row,
    };
    _status
      ..clear()
      ..addEntries(
        _students.map((row) {
          final id = (row['id_santri'] as num).toInt();
          return MapEntry(
            id,
            existing[id]?['status_presensi']?.toString() ?? 'Hadir',
          );
        }),
      );
    for (final controller in _notes.values) {
      controller.dispose();
    }
    _notes
      ..clear()
      ..addEntries(
        _students.map((row) {
          final id = (row['id_santri'] as num).toInt();
          return MapEntry(
            id,
            TextEditingController(
              text: existing[id]?['keterangan']?.toString() ?? '',
            ),
          );
        }),
      );
    if (mounted) setState(() {});
  }

  TimeOfDay _parseTime(String value) {
    final parts = value.split(':');
    return TimeOfDay(
      hour: parts.isNotEmpty ? int.tryParse(parts[0]) ?? 0 : 0,
      minute: parts.length > 1 ? int.tryParse(parts[1]) ?? 0 : 0,
    );
  }

  Future<void> _save() async {
    if (_classId == null || _students.isEmpty) return;
    setState(() => _saving = true);
    try {
      final details = _students.map((student) {
        final id = (student['id_santri'] as num).toInt();
        final status = _status[id] ?? 'Hadir';
        return {
          'id_santri': id,
          'status_presensi': status,
          'keterangan': status == 'Hadir' ? null : _notes[id]?.text.trim(),
        };
      }).toList();
      final time = _timeText;
      final date = _dateText;
      if (_editing) {
        await ThesisDatabase.instance.updateAttendance(
          localId: _activeLocalId!,
          classId: _classId!,
          date: date,
          startTime: time,
          details: details,
        );
        _syncStatus = 'pending';
      } else {
        _activeLocalId = await ThesisDatabase.instance.saveAttendance(
          classId: _classId!,
          date: date,
          startTime: time,
          details: details,
        );
        _syncStatus = 'pending';
      }
      if (mounted) setState(() {});
      widget.onSaved();
      unawaited(
        ThesisSync.syncPending().then((_) async {
          await _loadExistingForCurrentScope();
          widget.onSaved();
        }),
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              _editing
                  ? 'Perubahan presensi tersimpan. Jika internet aktif, database server ikut diperbarui.'
                  : 'Presensi tersimpan. Jika internet aktif, sinkronisasi dikirim sekarang.',
            ),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _cancelAttendance() async {
    final localId = _activeLocalId;
    if (localId == null || _saving) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Batalkan Presensi?'),
        content: const Text(
          'Data presensi pada kelas, tanggal, dan waktu ini akan dibatalkan.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Tidak'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Batalkan'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    setState(() => _saving = true);
    try {
      await ThesisDatabase.instance.deleteAttendance(localId);
      _activeLocalId = null;
      _syncStatus = 'new';
      await _loadStudents();
      widget.onSaved();
      unawaited(ThesisSync.syncPending().then((_) => widget.onSaved()));
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Presensi dibatalkan.')));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_classes.isEmpty) {
      return const Center(child: Text('Belum ada kelas yang ditugaskan.'));
    }

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
          child: Row(
            children: [
              Expanded(
                child: DropdownButtonFormField<int>(
                  initialValue: _classId,
                  decoration: const InputDecoration(
                    labelText: 'Kelas',
                    border: OutlineInputBorder(),
                  ),
                  items: _classes
                      .map(
                        (row) => DropdownMenuItem<int>(
                          value: (row['id_kelas'] as num).toInt(),
                          child: Text(row['nama_kelas'].toString()),
                        ),
                      )
                      .toList(),
                  onChanged: (value) async {
                    _classId = value;
                    await _loadExistingForCurrentScope();
                  },
                ),
              ),
              const SizedBox(width: 8),
              IconButton.filledTonal(
                tooltip: 'Pilih tanggal',
                onPressed: () async {
                  final value = await showDatePicker(
                    context: context,
                    initialDate: _date,
                    firstDate: DateTime.now().subtract(const Duration(days: 7)),
                    lastDate: DateTime.now(),
                  );
                  if (value != null) {
                    setState(() => _date = value);
                    await _loadExistingForCurrentScope();
                  }
                },
                icon: const Icon(Icons.calendar_today),
              ),
              const SizedBox(width: 6),
              IconButton.filledTonal(
                tooltip: 'Pilih waktu',
                onPressed: () async {
                  final value = await showTimePicker(
                    context: context,
                    initialTime: _time,
                  );
                  if (value != null) {
                    setState(() => _time = value);
                    await _loadExistingForCurrentScope();
                  }
                },
                icon: const Icon(Icons.schedule),
              ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  '${DateFormat('dd MMMM yyyy', 'id_ID').format(_date)} - ${_time.format(context)}',
                ),
              ),
              if (_editing)
                Chip(
                  visualDensity: VisualDensity.compact,
                  label: Text(
                    _syncStatus == 'completed'
                        ? 'Berhasil'
                        : _syncStatus == 'failed'
                        ? 'Gagal'
                        : 'Pending',
                  ),
                ),
            ],
          ),
        ),
        const Divider(height: 20),
        Expanded(
          child: ListView.separated(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 90),
            itemCount: _students.length,
            separatorBuilder: (_, index) => const Divider(height: 1),
            itemBuilder: (context, index) {
              final student = _students[index];
              final id = (student['id_santri'] as num).toInt();
              final status = _status[id] ?? 'Hadir';
              return Padding(
                padding: const EdgeInsets.symmetric(vertical: 10),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      student['nama_santri'].toString(),
                      style: const TextStyle(fontWeight: FontWeight.w600),
                    ),
                    Text('NISN ${student['nisn']}'),
                    const SizedBox(height: 8),
                    SegmentedButton<String>(
                      segments: _statuses
                          .map(
                            (item) =>
                                ButtonSegment(value: item, label: Text(item)),
                          )
                          .toList(),
                      selected: {status},
                      showSelectedIcon: false,
                      onSelectionChanged: (value) =>
                          setState(() => _status[id] = value.first),
                    ),
                    if (status != 'Hadir') ...[
                      const SizedBox(height: 8),
                      DropdownButtonFormField<String>(
                        decoration: const InputDecoration(
                          labelText: 'Template keterangan',
                          border: OutlineInputBorder(),
                          isDense: true,
                        ),
                        items: _noteTemplates
                            .map(
                              (item) => DropdownMenuItem(
                                value: item,
                                child: Text(item),
                              ),
                            )
                            .toList(),
                        onChanged: (value) {
                          if (value != null && value != 'Lainnya') {
                            _notes[id]?.text = value;
                          }
                        },
                      ),
                      const SizedBox(height: 8),
                      TextField(
                        controller: _notes[id],
                        decoration: const InputDecoration(
                          labelText: 'Keterangan',
                          border: OutlineInputBorder(),
                          isDense: true,
                        ),
                      ),
                    ],
                  ],
                ),
              );
            },
          ),
        ),
        SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                if (_editing) ...[
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: _saving ? null : _cancelAttendance,
                      icon: const Icon(Icons.cancel_outlined),
                      label: const Text('Batalkan'),
                    ),
                  ),
                  const SizedBox(width: 8),
                ],
                Expanded(
                  flex: 2,
                  child: FilledButton.icon(
                    onPressed: _saving || _students.isEmpty ? null : _save,
                    icon: _saving
                        ? const SizedBox.square(
                            dimension: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : Icon(_editing ? Icons.edit : Icons.save),
                    label: Text(
                      _editing
                          ? 'Perbarui ${_students.length} Presensi'
                          : 'Simpan ${_students.length} Presensi',
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  @override
  void dispose() {
    for (final controller in _notes.values) {
      controller.dispose();
    }
    super.dispose();
  }
}
