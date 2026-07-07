import 'dart:async';

import 'package:flutter/material.dart';

import '../services/thesis_database.dart';
import '../services/thesis_session.dart';
import '../services/thesis_sync.dart';
import 'attendance_screen.dart';
import 'history_screen.dart';
import 'login_screen.dart';
import 'master_data_screen.dart';

class ThesisShell extends StatefulWidget {
  const ThesisShell({super.key});

  @override
  State<ThesisShell> createState() => _ThesisShellState();
}

class _ThesisShellState extends State<ThesisShell> with WidgetsBindingObserver {
  int _index = 0;
  String _name = '';
  String _role = '';
  int _pending = 0;
  Timer? _timer;
  bool _syncing = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _load();
    _timer = Timer.periodic(const Duration(seconds: 6), (_) => _tick());
  }

  Future<void> _load() async {
    _name = await ThesisSession.name();
    _role = await ThesisSession.role();
    _pending = await ThesisDatabase.instance.pendingCount();
    if (mounted) setState(() {});
  }

  Future<void> _tick() async {
    await _load();
    if (_pending > 0) {
      unawaited(_sync());
    }
  }

  Future<void> _sync() async {
    if (_syncing) return;
    _syncing = true;
    try {
      await ThesisSync.syncPending();
    } finally {
      _syncing = false;
      await _load();
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      unawaited(_sync());
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final admin = _role == 'admin';
    final pages = <Widget>[
      _Home(name: _name, role: _role, pending: _pending, onSync: _sync),
      AttendanceScreen(onSaved: _load),
      HistoryScreen(onChanged: _load),
      if (admin) const MasterDataScreen(),
    ];
    final destinations = <NavigationDestination>[
      const NavigationDestination(
        icon: Icon(Icons.dashboard_outlined),
        selectedIcon: Icon(Icons.dashboard),
        label: 'Beranda',
      ),
      const NavigationDestination(
        icon: Icon(Icons.fact_check_outlined),
        selectedIcon: Icon(Icons.fact_check),
        label: 'Presensi',
      ),
      const NavigationDestination(
        icon: Icon(Icons.history),
        selectedIcon: Icon(Icons.history_toggle_off),
        label: 'Riwayat',
      ),
      if (admin)
        const NavigationDestination(
          icon: Icon(Icons.school_outlined),
          selectedIcon: Icon(Icons.school),
          label: 'Buku Induk',
        ),
    ];

    return Scaffold(
      appBar: AppBar(
        title: Text(destinations[_index].label),
        actions: [
          IconButton(
            tooltip: 'Sinkronkan sekarang',
            onPressed: _sync,
            icon: Badge(
              isLabelVisible: _pending > 0,
              label: Text('$_pending'),
              child: const Icon(Icons.sync),
            ),
          ),
          PopupMenuButton<String>(
            tooltip: 'Akun',
            onSelected: (value) async {
              if (value != 'logout') return;
              await ThesisSession.logout();
              if (context.mounted) {
                Navigator.of(context).pushAndRemoveUntil(
                  MaterialPageRoute(builder: (_) => const LoginScreen()),
                  (_) => false,
                );
              }
            },
            itemBuilder: (_) => const [
              PopupMenuItem(value: 'logout', child: Text('Keluar')),
            ],
          ),
        ],
      ),
      body: IndexedStack(index: _index, children: pages),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (value) => setState(() => _index = value),
        destinations: destinations,
      ),
    );
  }
}

class _Home extends StatelessWidget {
  final String name;
  final String role;
  final int pending;
  final VoidCallback onSync;

  const _Home({
    required this.name,
    required this.role,
    required this.pending,
    required this.onSync,
  });

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text(
          "Assalamu'alaikum, $name",
          style: Theme.of(
            context,
          ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 4),
        Text(role == 'admin' ? 'Admin/Operator' : 'Guru/Ustadz'),
        const SizedBox(height: 20),
        Card(
          child: ListTile(
            leading: Icon(
              pending == 0
                  ? Icons.cloud_done_outlined
                  : Icons.cloud_upload_outlined,
              color: pending == 0 ? Colors.green : Colors.orange.shade800,
            ),
            title: Text(
              pending == 0
                  ? 'Semua data tersinkron'
                  : '$pending data menunggu sinkronisasi',
            ),
            subtitle: Text(
              pending == 0
                  ? 'Data lokal dan server sudah sama.'
                  : 'Akan dikirim otomatis ketika internet tersedia.',
            ),
            trailing: IconButton(
              tooltip: 'Sinkronkan',
              onPressed: onSync,
              icon: const Icon(Icons.sync),
            ),
          ),
        ),
      ],
    );
  }
}
