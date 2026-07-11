import 'dart:async';

import 'package:flutter/material.dart';

import '../services/thesis_database.dart';
import 'attendance_screen.dart';

class HistoryScreen extends StatefulWidget {
  final VoidCallback onChanged;
  const HistoryScreen({super.key, required this.onChanged});

  @override
  State<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends State<HistoryScreen> {
  Future<List<Map<String, dynamic>>>? _history;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _reload();
    _timer = Timer.periodic(const Duration(seconds: 6), (_) => _reload());
  }

  void _reload() =>
      setState(() => _history = ThesisDatabase.instance.history());

  Future<void> _edit(Map<String, dynamic> row) async {
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (context) => Scaffold(
          appBar: AppBar(title: const Text('Edit Presensi')),
          body: AttendanceScreen(
            editLocalId: row['local_id'].toString(),
            onSaved: () {
              widget.onChanged();
              _reload();
            },
          ),
        ),
      ),
    );
    _reload();
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: () async => _reload(),
      child: FutureBuilder<List<Map<String, dynamic>>>(
        future: _history,
        builder: (context, snapshot) {
          if (!snapshot.hasData) {
            return const Center(child: CircularProgressIndicator());
          }
          final rows = snapshot.data!;
          if (rows.isEmpty) {
            return ListView(
              children: const [
                SizedBox(height: 180),
                Center(child: Text('Belum ada riwayat presensi.')),
              ],
            );
          }
          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: rows.length,
            separatorBuilder: (_, index) => const SizedBox(height: 8),
            itemBuilder: (context, index) {
              final row = rows[index];
              final status = row['sync_status'].toString();
              return Card(
                child: ListTile(
                  title: Text(row['nama_kelas'].toString()),
                  subtitle: Text(
                    '${row['tanggal']} ${row['waktu_mulai']}\n'
                    'Hadir ${row['hadir']}  Sakit ${row['sakit']}  Izin ${row['izin']}  Alpa ${row['alpa']}',
                  ),
                  isThreeLine: true,
                  trailing: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Tooltip(
                        message: status,
                        child: Icon(
                          status == 'completed'
                              ? Icons.cloud_done
                              : status == 'failed'
                              ? Icons.error_outline
                              : Icons.cloud_upload_outlined,
                          color: status == 'completed'
                              ? Colors.green
                              : status == 'failed'
                              ? Colors.red
                              : Colors.orange.shade800,
                        ),
                      ),
                      IconButton(
                        tooltip: 'Edit presensi',
                        onPressed: () => _edit(row),
                        icon: const Icon(Icons.edit),
                      ),
                    ],
                  ),
                  onTap: () => _edit(row),
                ),
              );
            },
          );
        },
      ),
    );
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }
}
