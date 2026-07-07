import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../services/thesis_database.dart';
import '../services/thesis_sync.dart';

class AttendanceScreen extends StatefulWidget {
  final VoidCallback onSaved;
  const AttendanceScreen({super.key, required this.onSaved});

  @override
  State<AttendanceScreen> createState() => _AttendanceScreenState();
}

class _AttendanceScreenState extends State<AttendanceScreen> {
  final _statuses = const ['Hadir', 'Sakit', 'Izin', 'Alpa'];
  List<Map<String, dynamic>> _classes = [];
  List<Map<String, dynamic>> _students = [];
  final Map<int, String> _status = {};
  final Map<int, TextEditingController> _notes = {};
  int? _classId;
  DateTime _date = DateTime.now();
  TimeOfDay _time = TimeOfDay.now();
  bool _loading = true;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _loadClasses();
  }

  Future<void> _loadClasses() async {
    _classes = await ThesisDatabase.instance.classes();
    if (_classes.isNotEmpty) {
      _classId = _classes.first['id_kelas'] as int;
      await _loadStudents();
    }
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _loadStudents() async {
    if (_classId == null) return;
    _students = await ThesisDatabase.instance.students(_classId!);
    _status
      ..clear()
      ..addEntries(
        _students.map((row) => MapEntry(row['id_santri'] as int, 'Hadir')),
      );
    for (final controller in _notes.values) {
      controller.dispose();
    }
    _notes
      ..clear()
      ..addEntries(
        _students.map(
          (row) => MapEntry(row['id_santri'] as int, TextEditingController()),
        ),
      );
    if (mounted) setState(() {});
  }

  Future<void> _save() async {
    if (_classId == null || _students.isEmpty) return;
    setState(() => _saving = true);
    try {
      final details = _students.map((student) {
        final id = student['id_santri'] as int;
        final status = _status[id] ?? 'Hadir';
        return {
          'id_santri': id,
          'status_presensi': status,
          'keterangan': status == 'Hadir' ? null : _notes[id]?.text.trim(),
        };
      }).toList();
      final time =
          '${_time.hour.toString().padLeft(2, '0')}:${_time.minute.toString().padLeft(2, '0')}:00';
      await ThesisDatabase.instance.saveAttendance(
        classId: _classId!,
        date: DateFormat('yyyy-MM-dd').format(_date),
        startTime: time,
        details: details,
      );
      await ThesisSync.requestNow();
      widget.onSaved();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Presensi tersimpan di perangkat. Sinkronisasi berjalan otomatis.',
            ),
          ),
        );
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
                          value: row['id_kelas'] as int,
                          child: Text(row['nama_kelas'].toString()),
                        ),
                      )
                      .toList(),
                  onChanged: (value) async {
                    _classId = value;
                    await _loadStudents();
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
                  if (value != null) setState(() => _date = value);
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
                  if (value != null) setState(() => _time = value);
                },
                icon: const Icon(Icons.schedule),
              ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Align(
            alignment: Alignment.centerLeft,
            child: Text(
              '${DateFormat('dd MMMM yyyy', 'id_ID').format(_date)} - ${_time.format(context)}',
            ),
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
              final id = student['id_santri'] as int;
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
            child: SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: _saving || _students.isEmpty ? null : _save,
                icon: _saving
                    ? const SizedBox.square(
                        dimension: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.save),
                label: Text('Simpan ${_students.length} Presensi'),
              ),
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
