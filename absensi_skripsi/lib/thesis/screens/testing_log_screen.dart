import 'package:flutter/material.dart';

import '../services/thesis_database.dart';

class TestingLogScreen extends StatefulWidget {
  const TestingLogScreen({super.key});

  @override
  State<TestingLogScreen> createState() => _TestingLogScreenState();
}

class _TestingLogScreenState extends State<TestingLogScreen> {
  Future<List<Map<String, dynamic>>>? _logs;

  @override
  void initState() {
    super.initState();
    _reload();
  }

  void _reload() {
    setState(() => _logs = ThesisDatabase.instance.appLogs(limit: 250));
  }

  Future<void> _clear() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Bersihkan Log?'),
        content: const Text(
          'Semua catatan pengujian di perangkat ini akan dihapus.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Batal'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Bersihkan'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    await ThesisDatabase.instance.clearLogs();
    _reload();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  'Pemantauan pengujian black box',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              IconButton.filledTonal(
                tooltip: 'Refresh',
                onPressed: _reload,
                icon: const Icon(Icons.refresh),
              ),
              const SizedBox(width: 8),
              IconButton.outlined(
                tooltip: 'Bersihkan log',
                onPressed: _clear,
                icon: const Icon(Icons.delete_outline),
              ),
            ],
          ),
        ),
        Expanded(
          child: RefreshIndicator(
            onRefresh: () async => _reload(),
            child: FutureBuilder<List<Map<String, dynamic>>>(
              future: _logs,
              builder: (context, snapshot) {
                if (!snapshot.hasData) {
                  return const Center(child: CircularProgressIndicator());
                }
                final rows = snapshot.data!;
                if (rows.isEmpty) {
                  return ListView(
                    children: const [
                      SizedBox(height: 180),
                      Center(child: Text('Belum ada log pengujian.')),
                    ],
                  );
                }
                return ListView.separated(
                  padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
                  itemCount: rows.length,
                  separatorBuilder: (_, index) => const SizedBox(height: 8),
                  itemBuilder: (context, index) {
                    final row = rows[index];
                    final status = row['status']?.toString() ?? 'info';
                    return Card(
                      child: ListTile(
                        leading: CircleAvatar(
                          backgroundColor: _statusColor(
                            status,
                          ).withValues(alpha: 0.14),
                          foregroundColor: _statusColor(status),
                          child: Icon(_statusIcon(status), size: 20),
                        ),
                        title: Text(row['title']?.toString() ?? '-'),
                        subtitle: Text(
                          [
                            row['created_at']?.toString() ?? '',
                            row['category']?.toString() ?? '',
                            row['message']?.toString() ?? '',
                          ].where((item) => item.isNotEmpty).join('\n'),
                        ),
                        isThreeLine: true,
                        trailing: Text(
                          status.toUpperCase(),
                          style: Theme.of(context).textTheme.labelSmall
                              ?.copyWith(
                                color: _statusColor(status),
                                fontWeight: FontWeight.w700,
                              ),
                        ),
                      ),
                    );
                  },
                );
              },
            ),
          ),
        ),
      ],
    );
  }

  IconData _statusIcon(String status) => switch (status) {
    'success' => Icons.check_circle_outline,
    'failed' => Icons.error_outline,
    'pending' => Icons.cloud_upload_outlined,
    _ => Icons.info_outline,
  };

  Color _statusColor(String status) => switch (status) {
    'success' => Colors.green,
    'failed' => Colors.red,
    'pending' => Colors.orange.shade800,
    _ => Theme.of(context).colorScheme.primary,
  };
}
