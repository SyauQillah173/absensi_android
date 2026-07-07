import 'package:flutter/material.dart';

import '../services/thesis_database.dart';
import '../services/thesis_sync.dart';

class MasterDataScreen extends StatefulWidget {
  const MasterDataScreen({super.key});

  @override
  State<MasterDataScreen> createState() => _MasterDataScreenState();
}

class _MasterDataScreenState extends State<MasterDataScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs;
  List<Map<String, dynamic>> _gurus = [];
  List<Map<String, dynamic>> _classes = [];
  List<Map<String, dynamic>> _students = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 3, vsync: this);
    _load();
  }

  Future<void> _load() async {
    _gurus = await ThesisDatabase.instance.gurus();
    _classes = await ThesisDatabase.instance.classes();
    _students = await ThesisDatabase.instance.allStudents();
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _refresh() async {
    setState(() => _loading = true);
    await ThesisSync.refreshBootstrap();
    await _load();
  }

  Future<void> _delete(String entity, int id) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Hapus data?'),
        content: const Text(
          'Data yang sudah memiliki riwayat akan dinonaktifkan.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Batal'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Hapus'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await ThesisDatabase.instance.deleteMaster(entity: entity, id: id);
      await ThesisSync.requestNow();
      await _load();
      _message('Perubahan disimpan lokal dan akan disinkronkan otomatis.');
    } catch (error) {
      _message(error.toString());
    }
  }

  void _message(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        TabBar(
          controller: _tabs,
          tabs: const [
            Tab(text: 'Santri'),
            Tab(text: 'Kelas'),
            Tab(text: 'Guru'),
          ],
        ),
        Expanded(
          child: _loading
              ? const Center(child: CircularProgressIndicator())
              : TabBarView(
                  controller: _tabs,
                  children: [_studentList(), _classList(), _guruList()],
                ),
        ),
      ],
    );
  }

  Widget _studentList() => Scaffold(
    body: RefreshIndicator(
      onRefresh: _refresh,
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 90),
        itemCount: _students.length,
        separatorBuilder: (_, index) => const Divider(height: 1),
        itemBuilder: (context, index) {
          final row = _students[index];
          return ListTile(
            contentPadding: EdgeInsets.zero,
            leading: const CircleAvatar(child: Icon(Icons.person_outline)),
            title: Text(row['nama_santri'].toString()),
            subtitle: Text('${row['nisn']} - ${row['nama_kelas']}'),
            onTap: () => _studentDialog(row),
            trailing: IconButton(
              tooltip: 'Hapus atau nonaktifkan',
              onPressed: () => _delete('santri', row['id_santri'] as int),
              icon: const Icon(Icons.delete_outline),
            ),
          );
        },
      ),
    ),
    floatingActionButton: FloatingActionButton(
      tooltip: 'Tambah santri',
      onPressed: () => _studentDialog(null),
      child: const Icon(Icons.person_add_alt_1),
    ),
  );

  Widget _classList() => Scaffold(
    body: ListView.separated(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 90),
      itemCount: _classes.length,
      separatorBuilder: (_, index) => const Divider(height: 1),
      itemBuilder: (context, index) {
        final row = _classes[index];
        final guru = _gurus
            .where((g) => g['id_guru'] == row['id_guru'])
            .firstOrNull;
        return ListTile(
          contentPadding: EdgeInsets.zero,
          leading: const CircleAvatar(child: Icon(Icons.class_outlined)),
          title: Text(row['nama_kelas'].toString()),
          subtitle: Text(
            'Tingkat ${row['tingkat']} - ${guru?['nama_guru'] ?? 'Belum ada guru'}',
          ),
          onTap: () => _classDialog(row),
          trailing: IconButton(
            tooltip: 'Hapus atau nonaktifkan',
            onPressed: () => _delete('kelas', row['id_kelas'] as int),
            icon: const Icon(Icons.delete_outline),
          ),
        );
      },
    ),
    floatingActionButton: FloatingActionButton(
      tooltip: 'Tambah kelas',
      onPressed: () => _classDialog(null),
      child: const Icon(Icons.add_home_work_outlined),
    ),
  );

  Widget _guruList() => Scaffold(
    body: ListView.separated(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 90),
      itemCount: _gurus.length,
      separatorBuilder: (_, index) => const Divider(height: 1),
      itemBuilder: (context, index) {
        final row = _gurus[index];
        return ListTile(
          contentPadding: EdgeInsets.zero,
          leading: const CircleAvatar(child: Icon(Icons.co_present_outlined)),
          title: Text(row['nama_guru'].toString()),
          subtitle: Text('${row['nip_nidm'] ?? '-'} - ${row['nomor_hp']}'),
          onTap: () => _guruDialog(row),
          trailing: IconButton(
            tooltip: 'Hapus atau nonaktifkan',
            onPressed: () => _delete('guru', row['id_guru'] as int),
            icon: const Icon(Icons.delete_outline),
          ),
        );
      },
    ),
    floatingActionButton: FloatingActionButton(
      tooltip: 'Tambah guru',
      onPressed: () => _guruDialog(null),
      child: const Icon(Icons.person_add_alt),
    ),
  );

  Future<void> _classDialog(Map<String, dynamic>? row) async {
    if (_gurus.isEmpty) {
      _message('Tambahkan guru sebelum membuat kelas.');
      return;
    }
    final name = TextEditingController(text: row?['nama_kelas']?.toString());
    final level = TextEditingController(
      text: row?['tingkat']?.toString() ?? '1',
    );
    int guruId = row?['id_guru'] as int? ?? _gurus.first['id_guru'] as int;
    final saved = await showDialog<bool>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: Text(row == null ? 'Tambah Kelas' : 'Edit Kelas'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: name,
                  decoration: const InputDecoration(labelText: 'Nama kelas'),
                ),
                TextField(
                  controller: level,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'Tingkat'),
                ),
                DropdownButtonFormField<int>(
                  initialValue: guruId,
                  decoration: const InputDecoration(labelText: 'Guru pengampu'),
                  items: _gurus
                      .map(
                        (g) => DropdownMenuItem(
                          value: g['id_guru'] as int,
                          child: Text(g['nama_guru'].toString()),
                        ),
                      )
                      .toList(),
                  onChanged: (value) => setDialogState(() => guruId = value!),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Batal'),
            ),
            FilledButton(
              onPressed: () async {
                try {
                  await ThesisDatabase.instance.saveMaster(
                    entity: 'kelas',
                    data: {
                      if (row != null) 'id_kelas': row['id_kelas'],
                      'nama_kelas': name.text.trim(),
                      'tingkat': int.tryParse(level.text) ?? 1,
                      'id_guru': guruId,
                      'status_aktif': true,
                    },
                  );
                  await ThesisSync.requestNow();
                  if (context.mounted) Navigator.pop(context, true);
                } catch (error) {
                  _message(error.toString());
                }
              },
              child: const Text('Simpan'),
            ),
          ],
        ),
      ),
    );
    name.dispose();
    level.dispose();
    if (saved == true) await _load();
  }

  Future<void> _guruDialog(Map<String, dynamic>? row) async {
    final name = TextEditingController(text: row?['nama_guru']?.toString());
    final username = TextEditingController(text: row?['username']?.toString());
    final password = TextEditingController();
    final nip = TextEditingController(text: row?['nip_nidm']?.toString());
    final phone = TextEditingController(text: row?['nomor_hp']?.toString());
    final address = TextEditingController(text: row?['alamat']?.toString());
    final saved = await _formDialog(
      title: row == null ? 'Tambah Guru' : 'Edit Guru',
      fields: [
        _field(name, 'Nama guru'),
        _field(username, 'Username'),
        _field(
          password,
          row == null ? 'Password' : 'Password baru (opsional)',
          obscure: true,
        ),
        _field(nip, 'NIP/NIDM'),
        _field(phone, 'Nomor HP', phone: true),
        _field(address, 'Alamat'),
      ],
      save: () async {
        await ThesisDatabase.instance.saveMaster(
          entity: 'guru',
          data: {
            if (row != null) 'id_guru': row['id_guru'],
            if (row != null) 'id_user': row['id_user'],
            'nama_guru': name.text.trim(),
            'username': username.text.trim(),
            if (password.text.isNotEmpty) 'password': password.text,
            'nip_nidm': nip.text.trim().isEmpty ? null : nip.text.trim(),
            'nomor_hp': phone.text.trim(),
            'alamat': address.text.trim(),
            'status_aktif': true,
          },
        );
        await ThesisSync.requestNow();
        return {'success': true};
      },
    );
    for (final item in [name, username, password, nip, phone, address]) {
      item.dispose();
    }
    if (saved) await _load();
  }

  Future<void> _studentDialog(Map<String, dynamic>? row) async {
    if (_classes.isEmpty) {
      _message('Tambahkan kelas sebelum membuat santri.');
      return;
    }
    final nisn = TextEditingController(text: row?['nisn']?.toString());
    final name = TextEditingController(text: row?['nama_santri']?.toString());
    final guardian = TextEditingController(text: row?['nama_wali']?.toString());
    final phone = TextEditingController(
      text: row?['nomor_wa_wali']?.toString(),
    );
    final address = TextEditingController(text: row?['alamat']?.toString());
    int classId = row?['id_kelas'] as int? ?? _classes.first['id_kelas'] as int;
    String gender = row?['jenis_kelamin']?.toString() ?? 'L';
    final saved = await showDialog<bool>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: Text(row == null ? 'Tambah Santri' : 'Edit Santri'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                _field(nisn, 'NISN'),
                _field(name, 'Nama santri'),
                DropdownButtonFormField<int>(
                  initialValue: classId,
                  decoration: const InputDecoration(labelText: 'Kelas'),
                  items: _classes
                      .map(
                        (k) => DropdownMenuItem(
                          value: k['id_kelas'] as int,
                          child: Text(k['nama_kelas'].toString()),
                        ),
                      )
                      .toList(),
                  onChanged: (value) => setDialogState(() => classId = value!),
                ),
                DropdownButtonFormField<String>(
                  initialValue: gender,
                  decoration: const InputDecoration(labelText: 'Jenis kelamin'),
                  items: const [
                    DropdownMenuItem(value: 'L', child: Text('Laki-laki')),
                    DropdownMenuItem(value: 'P', child: Text('Perempuan')),
                  ],
                  onChanged: (value) => setDialogState(() => gender = value!),
                ),
                _field(guardian, 'Nama wali'),
                _field(phone, 'Nomor WhatsApp wali', phone: true),
                _field(address, 'Alamat'),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Batal'),
            ),
            FilledButton(
              onPressed: () async {
                try {
                  await ThesisDatabase.instance.saveMaster(
                    entity: 'santri',
                    data: {
                      if (row != null) 'id_santri': row['id_santri'],
                      'id_kelas': classId,
                      'nisn': nisn.text.trim(),
                      'nama_santri': name.text.trim(),
                      'jenis_kelamin': gender,
                      'nama_wali': guardian.text.trim(),
                      'nomor_wa_wali': phone.text.trim(),
                      'alamat': address.text.trim(),
                      'status_aktif': true,
                    },
                  );
                  await ThesisSync.requestNow();
                  if (context.mounted) Navigator.pop(context, true);
                } catch (error) {
                  _message(error.toString());
                }
              },
              child: const Text('Simpan'),
            ),
          ],
        ),
      ),
    );
    for (final item in [nisn, name, guardian, phone, address]) {
      item.dispose();
    }
    if (saved == true) await _load();
  }

  Future<bool> _formDialog({
    required String title,
    required List<Widget> fields,
    required Future<Map<String, dynamic>> Function() save,
  }) async {
    final result = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(title),
        content: SingleChildScrollView(
          child: Column(mainAxisSize: MainAxisSize.min, children: fields),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Batal'),
          ),
          FilledButton(
            onPressed: () async {
              try {
                await save();
                if (context.mounted) Navigator.pop(context, true);
              } catch (error) {
                _message(error.toString());
              }
            },
            child: const Text('Simpan'),
          ),
        ],
      ),
    );
    return result == true;
  }

  Widget _field(
    TextEditingController controller,
    String label, {
    bool obscure = false,
    bool phone = false,
  }) => Padding(
    padding: const EdgeInsets.only(bottom: 8),
    child: TextField(
      controller: controller,
      obscureText: obscure,
      keyboardType: phone ? TextInputType.phone : TextInputType.text,
      decoration: InputDecoration(labelText: label),
    ),
  );

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }
}
