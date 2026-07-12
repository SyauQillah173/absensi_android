import 'dart:async';

import 'package:flutter/material.dart';

import '../services/thesis_database.dart';
import '../services/thesis_logger.dart';
import '../services/thesis_session.dart';
import '../services/thesis_sync.dart';
import 'attendance_screen.dart';
import 'history_screen.dart';
import 'login_screen.dart';
import 'master_data_screen.dart';
import 'testing_log_screen.dart';

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
  int _failed = 0;
  int _syncingCount = 0;
  int _attendanceVersion = 0;
  String? _syncError;
  Timer? _timer;
  bool _online = false;
  bool _checkingConnection = true;
  bool _syncing = false;
  String? _lastStatusLog;

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
    final status = await ThesisDatabase.instance.syncStatus();
    _pending = (status['pending'] as num? ?? 0).toInt();
    _failed = (status['failed'] as num? ?? 0).toInt();
    _syncingCount = (status['syncing'] as num? ?? 0).toInt();
    _syncError = status['last_error']?.toString();
    _online = await ThesisDatabase.instance.hasInternet().timeout(
      const Duration(seconds: 4),
      onTimeout: () => false,
    );
    _checkingConnection = false;
    if (mounted) setState(() {});
    final statusLog =
        'online=$_online;pending=$_pending;failed=$_failed;syncing=$_syncingCount;error=${_syncError ?? '-'}';
    if (_lastStatusLog != statusLog) {
      _lastStatusLog = statusLog;
      ThesisLogger.unawaitedInfo(
        'Beranda memantau status sinkronisasi',
        message:
            'Mode koneksi ${_online ? 'online' : 'offline'}. Pending $_pending, gagal $_failed, proses $_syncingCount.',
        category: 'beranda',
      );
    }
  }

  Future<void> _tick() async {
    await _load();
    if (_pending > 0) {
      unawaited(_sync());
    }
  }

  Future<void> _sync({bool notify = false}) async {
    if (_syncing) return;
    _syncing = true;
    ThesisLogger.unawaitedInfo(
      notify
          ? 'Sinkronisasi manual dijalankan'
          : 'Sinkronisasi otomatis dijalankan',
      message: 'Aplikasi mencoba mengirim data pending ke server.',
      category: 'sync',
    );
    try {
      final result = await ThesisSync.syncPending();
      ThesisLogger.unawaitedInfo(
        'Hasil sinkronisasi diterima aplikasi',
        message:
            'Synced ${result['synced'] ?? 0}, failed ${result['failed'] ?? 0}, pending ${result['pending'] ?? 0}.',
        category: 'sync',
      );
      if (!mounted || !notify) return;
      final synced = (result['synced'] as num? ?? 0).toInt();
      final failed = (result['failed'] as num? ?? 0).toInt();
      if (synced > 0) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('$synced data berhasil masuk server.')),
        );
      } else if (failed > 0) {
        final status = await ThesisDatabase.instance.syncStatus();
        if (!mounted) return;
        final error =
            status['last_error']?.toString() ?? 'Server belum menerima data.';
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Sinkronisasi gagal: $error')));
      }
    } finally {
      _syncing = false;
      await _load();
    }
  }

  void _masterChanged() {
    setState(() => _attendanceVersion += 1);
    unawaited(_load());
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
      _Home(
        name: _name,
        role: _role,
        pending: _pending,
        failed: _failed,
        syncing: _syncing || _syncingCount > 0,
        syncError: _syncError,
        online: _online,
        checkingConnection: _checkingConnection,
        onSync: () => _sync(notify: true),
      ),
      AttendanceScreen(
        key: ValueKey('attendance-$_attendanceVersion'),
        onSaved: _load,
      ),
      HistoryScreen(onChanged: _load),
      if (admin) MasterDataScreen(onChanged: _masterChanged),
      if (admin) const TestingLogScreen(),
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
      if (admin)
        const NavigationDestination(
          icon: Icon(Icons.receipt_long_outlined),
          selectedIcon: Icon(Icons.receipt_long),
          label: 'Log',
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
              ThesisLogger.unawaitedInfo(
                'Pengguna keluar',
                message: 'Sesi aplikasi diakhiri dari menu akun.',
                category: 'akun',
              );
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
        onDestinationSelected: (value) {
          setState(() {
            _index = value;
            if (value == 1) _attendanceVersion += 1;
          });
        },
        destinations: destinations,
      ),
    );
  }
}

class _Home extends StatelessWidget {
  final String name;
  final String role;
  final int pending;
  final int failed;
  final bool syncing;
  final String? syncError;
  final bool online;
  final bool checkingConnection;
  final VoidCallback onSync;

  const _Home({
    required this.name,
    required this.role,
    required this.pending,
    required this.failed,
    required this.syncing,
    required this.syncError,
    required this.online,
    required this.checkingConnection,
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
        _ConnectionStatusCard(online: online, checking: checkingConnection),
        const SizedBox(height: 12),
        Card(
          child: ListTile(
            leading: Icon(
              pending == 0
                  ? Icons.cloud_done_outlined
                  : failed > 0 && !syncing
                  ? Icons.error_outline
                  : Icons.cloud_upload_outlined,
              color: pending == 0
                  ? Colors.green
                  : failed > 0 && !syncing
                  ? Colors.red
                  : Colors.orange.shade800,
            ),
            title: Text(
              pending == 0
                  ? 'Semua data tersinkron'
                  : syncing
                  ? 'Sedang mengirim $pending data'
                  : failed > 0
                  ? '$failed data gagal sinkronisasi'
                  : '$pending data menunggu sinkronisasi',
            ),
            subtitle: Text(
              pending == 0
                  ? 'Data lokal dan server sudah sama.'
                  : syncing
                  ? 'Data sedang dikirim ke server. Mohon tunggu sebentar.'
                  : failed > 0 && syncError != null
                  ? syncError!
                  : online
                  ? 'Internet aktif. Data akan dikirim otomatis ke server.'
                  : 'Akan dikirim otomatis ketika internet tersedia.',
            ),
            trailing: IconButton(
              tooltip: 'Sinkronkan',
              onPressed: onSync,
              icon: syncing
                  ? const SizedBox.square(
                      dimension: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.sync),
            ),
          ),
        ),
      ],
    );
  }
}

class _ConnectionStatusCard extends StatelessWidget {
  final bool online;
  final bool checking;

  const _ConnectionStatusCard({required this.online, required this.checking});

  @override
  Widget build(BuildContext context) {
    final color = checking
        ? Colors.blueGrey
        : online
        ? Colors.green
        : Colors.orange.shade800;
    final icon = checking
        ? Icons.wifi_find_outlined
        : online
        ? Icons.wifi
        : Icons.wifi_off;

    return Card(
      child: ListTile(
        leading: Icon(icon, color: color),
        title: Text(
          checking
              ? 'Memeriksa koneksi aplikasi'
              : online
              ? 'Aplikasi Online'
              : 'Aplikasi Offline',
        ),
        subtitle: Text(
          checking
              ? 'Aplikasi sedang mengecek koneksi internet dan server.'
              : online
              ? 'Internet terdeteksi. Data dapat langsung dikirim ke server.'
              : 'Internet belum terdeteksi. Data tetap disimpan lokal.',
        ),
        trailing: Container(
          width: 12,
          height: 12,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
      ),
    );
  }
}
