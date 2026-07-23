import 'dart:async';
import 'dart:io';

import 'package:excel/excel.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import '../services/thesis_database.dart';
import '../services/thesis_session.dart';
import '../services/thesis_sync.dart';
import '../../screens/buku_induk/data_admin_screen.dart';

class MasterDataScreen extends StatefulWidget {
  final VoidCallback? onChanged;
  const MasterDataScreen({super.key, this.onChanged});

  @override
  State<MasterDataScreen> createState() => _MasterDataScreenState();
}

class _MasterDataScreenState extends State<MasterDataScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs;
  List<Map<String, dynamic>> _gurus = [];
  List<Map<String, dynamic>> _classes = [];
  List<Map<String, dynamic>> _mapels = [];
  List<Map<String, dynamic>> _students = [];
  bool _loading = true;
  String _role = '';

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 5, vsync: this);
    _load();
  }

  Future<void> _load() async {
    _gurus = await ThesisDatabase.instance.gurus();
    _classes = await ThesisDatabase.instance.classes();
    _mapels = await ThesisDatabase.instance.mapels();
    _students = await ThesisDatabase.instance.allStudents();
    _role = await ThesisSession.role();
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _refresh() async {
    setState(() => _loading = true);
    await ThesisSync.refreshBootstrap();
    await _load();
  }

  void _notifyChanged() {
    widget.onChanged?.call();
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
      _syncMasterInBackground();
      await _load();
      _notifyChanged();
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

  void _syncMasterInBackground() {
    unawaited(
      ThesisSync.syncPending()
          .then((_) => ThesisSync.refreshBootstrap())
          .then((_) async {
            if (mounted) await _load();
          })
          .catchError((_) {}),
    );
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
            Tab(text: 'Mapel'),
            Tab(text: 'Guru'),
            Tab(text: 'Admin'),
          ],
        ),
        Expanded(
          child: _loading
              ? const Center(child: CircularProgressIndicator())
              : TabBarView(
                  controller: _tabs,
                  children: [
                    _studentList(),
                    _classList(),
                    _mapelList(),
                    _guruList(),
                    DataAdminScreen(readOnly: _role != 'admin'),
                  ],
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
    floatingActionButton: Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        FloatingActionButton.small(
          heroTag: 'template-santri',
          tooltip: 'Template Excel',
          onPressed: _shareStudentTemplate,
          child: const Icon(Icons.description_outlined),
        ),
        const SizedBox(height: 8),
        FloatingActionButton.small(
          heroTag: 'export-santri',
          tooltip: 'Export data santri',
          onPressed: _shareStudentExport,
          child: const Icon(Icons.download_outlined),
        ),
        const SizedBox(height: 8),
        FloatingActionButton.extended(
          heroTag: 'import-santri',
          tooltip: 'Import santri dari Excel',
          onPressed: _importStudentsFromExcel,
          icon: const Icon(Icons.upload_file),
          label: const Text('Import Excel'),
        ),
        const SizedBox(height: 8),
        FloatingActionButton(
          heroTag: 'add-santri',
          tooltip: 'Tambah santri',
          onPressed: () => _studentDialog(null),
          child: const Icon(Icons.person_add_alt_1),
        ),
      ],
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

  Widget _mapelList() => Scaffold(
    body: ListView.separated(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 90),
      itemCount: _mapels.length,
      separatorBuilder: (_, index) => const Divider(height: 1),
      itemBuilder: (context, index) {
        final row = _mapels[index];
        return ListTile(
          contentPadding: EdgeInsets.zero,
          leading: const CircleAvatar(child: Icon(Icons.menu_book_outlined)),
          title: Text(row['nama'].toString()),
          subtitle: Text('${row['kode'] ?? '-'} - ${row['status']}'),
          onTap: () => _mapelDialog(row),
          trailing: IconButton(
            tooltip: 'Hapus atau nonaktifkan',
            onPressed: () => _delete('mapel', row['id'] as int),
            icon: const Icon(Icons.delete_outline),
          ),
        );
      },
    ),
    floatingActionButton: FloatingActionButton(
      tooltip: 'Tambah mata pelajaran',
      onPressed: () => _mapelDialog(null),
      child: const Icon(Icons.playlist_add_outlined),
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
                  _syncMasterInBackground();
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
    if (saved == true) {
      await _load();
      _notifyChanged();
    }
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
        _syncMasterInBackground();
        return {'success': true};
      },
    );
    for (final item in [name, username, password, nip, phone, address]) {
      item.dispose();
    }
    if (saved) {
      await _load();
      _notifyChanged();
    }
  }

  Future<void> _mapelDialog(Map<String, dynamic>? row) async {
    final name = TextEditingController(text: row?['nama']?.toString());
    final code = TextEditingController(text: row?['kode']?.toString());
    final saved = await _formDialog(
      title: row == null ? 'Tambah Mata Pelajaran' : 'Edit Mata Pelajaran',
      fields: [_field(name, 'Nama mata pelajaran'), _field(code, 'Kode')],
      save: () async {
        await ThesisDatabase.instance.saveMaster(
          entity: 'mapel',
          data: {
            if (row != null) 'id': row['id'],
            'nama': name.text.trim(),
            'kode': code.text.trim().isEmpty ? null : code.text.trim(),
            'status': 'Aktif',
          },
        );
        _syncMasterInBackground();
        return {'success': true};
      },
    );
    name.dispose();
    code.dispose();
    if (saved) {
      await _load();
      _notifyChanged();
    }
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
                  _syncMasterInBackground();
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
    if (saved == true) {
      await _load();
      _notifyChanged();
    }
  }

  Future<void> _shareStudentTemplate() async {
    final excel = Excel.createExcel();
    excel.delete('Sheet1');
    final sheet = excel['Santri'];
    final master = excel['Master Kelas'];
    final guide = excel['Panduan'];
    excel.setDefaultSheet('Santri');

    final titleStyle = CellStyle(
      bold: true,
      fontColorHex: ExcelColor.white,
      backgroundColorHex: ExcelColor.fromHexString('FF0F766E'),
      horizontalAlign: HorizontalAlign.Center,
    );
    final headerStyle = CellStyle(
      bold: true,
      fontColorHex: ExcelColor.white,
      backgroundColorHex: ExcelColor.fromHexString('FF14B8A6'),
      horizontalAlign: HorizontalAlign.Left,
    );
    final inputStyle = CellStyle(
      backgroundColorHex: ExcelColor.fromHexString('FFEFFDFB'),
      horizontalAlign: HorizontalAlign.Left,
    );
    final textInputStyle = CellStyle(
      backgroundColorHex: ExcelColor.fromHexString('FFEFFDFB'),
      horizontalAlign: HorizontalAlign.Left,
      numberFormat: NumFormat.standard_49,
    );
    final dateInputStyle = CellStyle(
      backgroundColorHex: ExcelColor.fromHexString('FFEFFDFB'),
      horizontalAlign: HorizontalAlign.Left,
      numberFormat: NumFormat.custom(formatCode: 'yyyy-mm-dd'),
    );
    final checkStyle = CellStyle(
      bold: true,
      backgroundColorHex: ExcelColor.fromHexString('FFFFF7ED'),
      horizontalAlign: HorizontalAlign.Center,
    );
    final masterHeaderStyle = CellStyle(
      bold: true,
      fontColorHex: ExcelColor.white,
      backgroundColorHex: ExcelColor.fromHexString('FF334155'),
    );

    excel.merge(
      'Santri',
      CellIndex.indexByColumnRow(columnIndex: 0, rowIndex: 0),
      CellIndex.indexByColumnRow(columnIndex: 10, rowIndex: 0),
      customValue: TextCellValue('TEMPLATE IMPORT DATA SANTRI'),
    );
    sheet
            .cell(CellIndex.indexByColumnRow(columnIndex: 0, rowIndex: 0))
            .cellStyle =
        titleStyle;
    sheet.appendRow([
      TextCellValue(
        'Isi data mulai baris 5. Nama kelas wajib sama persis dengan sheet Master Kelas. Kolom NISN dan nomor WA sudah diformat teks agar angka tidak berubah.',
      ),
    ]);
    excel.merge(
      'Santri',
      CellIndex.indexByColumnRow(columnIndex: 0, rowIndex: 1),
      CellIndex.indexByColumnRow(columnIndex: 10, rowIndex: 1),
    );
    sheet
        .cell(CellIndex.indexByColumnRow(columnIndex: 0, rowIndex: 1))
        .cellStyle = CellStyle(
      backgroundColorHex: ExcelColor.fromHexString('FFE0F2FE'),
      horizontalAlign: HorizontalAlign.Left,
      textWrapping: TextWrapping.WrapText,
    );
    sheet.appendRow([]);
    final headers = [
      'nisn',
      'nama_santri',
      'nama_kelas',
      'jenis_kelamin',
      'nama_wali',
      'nomor_wa_wali',
      'alamat',
      'tgl_lahir',
      'cek_nisn',
      'cek_kelas',
      'catatan',
    ];
    sheet.appendRow(headers.map(TextCellValue.new).toList());
    for (var column = 0; column < headers.length; column += 1) {
      sheet
              .cell(
                CellIndex.indexByColumnRow(columnIndex: column, rowIndex: 3),
              )
              .cellStyle =
          headerStyle;
    }

    final exampleClass = _classes.isEmpty
        ? 'Kelas Pengujian A'
        : _classes.first['nama_kelas'].toString();
    sheet.appendRow([
      TextCellValue('1234567890'),
      TextCellValue('Ahmad Fulan'),
      TextCellValue(exampleClass),
      TextCellValue('L'),
      TextCellValue('Bapak Ahmad'),
      TextCellValue('081234567890'),
      TextCellValue('Gresik'),
      TextCellValue('2012-01-31'),
      FormulaCellValue(
        '=IF(A5="","",IF(COUNTIF(\$A:\$A,A5)>1,"DUPLIKAT","OK"))',
      ),
      FormulaCellValue(
        '=IF(C5="","",IF(COUNTIF(\'Master Kelas\'!\$B:\$B,C5)>0,"OK","KELAS TIDAK ADA"))',
      ),
      TextCellValue('Contoh, boleh dihapus'),
    ]);
    for (var row = 4; row < 104; row += 1) {
      sheet
          .cell(CellIndex.indexByColumnRow(columnIndex: 8, rowIndex: row))
          .value = FormulaCellValue(
        '=IF(A${row + 1}="","",IF(COUNTIF(\$A:\$A,A${row + 1})>1,"DUPLIKAT","OK"))',
      );
      sheet
          .cell(CellIndex.indexByColumnRow(columnIndex: 9, rowIndex: row))
          .value = FormulaCellValue(
        '=IF(C${row + 1}="","",IF(COUNTIF(\'Master Kelas\'!\$B:\$B,C${row + 1})>0,"OK","KELAS TIDAK ADA"))',
      );
    }
    for (var column = 0; column < 8; column += 1) {
      for (var row = 4; row < 104; row += 1) {
        final style = switch (column) {
          0 || 5 => textInputStyle,
          7 => dateInputStyle,
          _ => inputStyle,
        };
        sheet
                .cell(
                  CellIndex.indexByColumnRow(
                    columnIndex: column,
                    rowIndex: row,
                  ),
                )
                .cellStyle =
            style;
      }
    }
    for (var column = 8; column < headers.length; column += 1) {
      for (var row = 4; row < 104; row += 1) {
        sheet
                .cell(
                  CellIndex.indexByColumnRow(
                    columnIndex: column,
                    rowIndex: row,
                  ),
                )
                .cellStyle =
            checkStyle;
      }
    }
    final widths = [
      18.0,
      28.0,
      28.0,
      15.0,
      24.0,
      20.0,
      24.0,
      16.0,
      14.0,
      20.0,
      28.0,
    ];
    for (var column = 0; column < widths.length; column += 1) {
      sheet.setColumnWidth(column, widths[column]);
    }

    master.appendRow([
      TextCellValue('id_kelas'),
      TextCellValue('nama_kelas'),
      TextCellValue('guru'),
      TextCellValue('tingkat'),
      TextCellValue('status'),
    ]);
    for (var column = 0; column < 5; column += 1) {
      master
              .cell(
                CellIndex.indexByColumnRow(columnIndex: column, rowIndex: 0),
              )
              .cellStyle =
          masterHeaderStyle;
      master.setColumnWidth(column, [12.0, 30.0, 28.0, 12.0, 14.0][column]);
    }
    for (final row in _classes) {
      master.appendRow([
        IntCellValue((row['id_kelas'] as num).toInt()),
        TextCellValue(row['nama_kelas']?.toString() ?? ''),
        TextCellValue(row['nama_guru']?.toString() ?? ''),
        IntCellValue((row['tingkat'] as num?)?.toInt() ?? 1),
        TextCellValue((row['status_aktif'] == false) ? 'Nonaktif' : 'Aktif'),
      ]);
    }

    guide.setColumnWidth(0, 28);
    guide.setColumnWidth(1, 82);
    guide.appendRow([TextCellValue('Bagian'), TextCellValue('Keterangan')]);
    guide.appendRow([
      TextCellValue('NISN'),
      TextCellValue(
        'Wajib unik. Jika NISN sudah ada di aplikasi, data santri tersebut akan diperbarui. Jika NISN dobel dalam file, baris kedua dilewati.',
      ),
    ]);
    guide.appendRow([
      TextCellValue('Nama kelas'),
      TextCellValue(
        'Salin dari sheet Master Kelas agar tidak typo. Kolom cek_kelas akan menampilkan OK jika kelas valid.',
      ),
    ]);
    guide.appendRow([
      TextCellValue('Jenis kelamin'),
      TextCellValue('Isi L untuk laki-laki atau P untuk perempuan.'),
    ]);
    guide.appendRow([
      TextCellValue('Nomor WhatsApp'),
      TextCellValue(
        'Kolom nomor WA diformat sebagai teks agar angka 0 di depan tidak hilang. Contoh: 081234567890.',
      ),
    ]);
    guide.appendRow([
      TextCellValue('Tanggal lahir'),
      TextCellValue('Gunakan format yyyy-mm-dd, contoh 2012-01-31.'),
    ]);
    for (var column = 0; column < 2; column += 1) {
      guide
              .cell(
                CellIndex.indexByColumnRow(columnIndex: column, rowIndex: 0),
              )
              .cellStyle =
          masterHeaderStyle;
    }

    final bytes = excel.encode();
    if (bytes == null) {
      _message('Template Excel gagal dibuat.');
      return;
    }
    final directory = await getTemporaryDirectory();
    final file = File('${directory.path}/template_import_santri.xlsx');
    await file.writeAsBytes(bytes, flush: true);
    await Share.shareXFiles([XFile(file.path)], text: 'Template import santri');
  }

  Future<void> _shareStudentExport() async {
    if (_students.isEmpty) {
      _message('Belum ada data santri untuk diexport.');
      return;
    }

    final excel = Excel.createExcel();
    final sheet = excel['Santri'];
    excel.setDefaultSheet('Santri');
    sheet.appendRow([
      TextCellValue('nisn'),
      TextCellValue('nama_santri'),
      TextCellValue('nama_kelas'),
      TextCellValue('jenis_kelamin'),
      TextCellValue('nama_wali'),
      TextCellValue('nomor_wa_wali'),
      TextCellValue('alamat'),
      TextCellValue('tgl_lahir'),
    ]);
    for (final student in _students) {
      sheet.appendRow([
        TextCellValue(student['nisn']?.toString() ?? ''),
        TextCellValue(student['nama_santri']?.toString() ?? ''),
        TextCellValue(student['nama_kelas']?.toString() ?? ''),
        TextCellValue(student['jenis_kelamin']?.toString() ?? ''),
        TextCellValue(student['nama_wali']?.toString() ?? ''),
        TextCellValue(student['nomor_wa_wali']?.toString() ?? ''),
        TextCellValue(student['alamat']?.toString() ?? ''),
        TextCellValue(student['tgl_lahir']?.toString() ?? ''),
      ]);
    }

    final bytes = excel.encode();
    if (bytes == null) {
      _message('Export Excel gagal dibuat.');
      return;
    }
    final directory = await getTemporaryDirectory();
    final file = File('${directory.path}/export_data_santri.xlsx');
    await file.writeAsBytes(bytes, flush: true);
    await Share.shareXFiles([XFile(file.path)], text: 'Export data santri');
  }

  Future<void> _importStudentsFromExcel() async {
    if (_classes.isEmpty) {
      _message('Tambahkan kelas sebelum import santri.');
      return;
    }
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: const ['xlsx'],
      withData: true,
    );
    if (result == null || result.files.isEmpty) return;

    setState(() => _loading = true);
    try {
      final picked = result.files.single;
      final bytes = picked.bytes ?? await File(picked.path!).readAsBytes();
      final workbook = Excel.decodeBytes(bytes);
      final sheets = workbook.tables.entries
          .where(
            (entry) =>
                entry.value.maxRows > 0 &&
                ![
                  'masterkelas',
                  'panduan',
                ].contains(_normalizeHeader(entry.key)),
          )
          .map((entry) => entry.value)
          .toList();
      if (sheets.isEmpty) {
        _message('File Excel kosong.');
        return;
      }
      final sheet = workbook.tables['Santri'] ?? sheets.first;
      var headerIndex = -1;
      for (var rowIndex = 0; rowIndex < sheet.rows.length; rowIndex += 1) {
        final normalized = sheet.rows[rowIndex]
            .map((cell) => _normalizeHeader(_cellText(cell)))
            .toSet();
        if (normalized.contains('nisn') &&
            (normalized.contains('namasantri') ||
                normalized.contains('nama'))) {
          headerIndex = rowIndex;
          break;
        }
      }
      if (headerIndex < 0) {
        _message('Header Excel tidak ditemukan. Gunakan template resmi.');
        return;
      }
      final headerRow = sheet.rows[headerIndex];
      final headers = <String, int>{};
      for (var index = 0; index < headerRow.length; index += 1) {
        final key = _normalizeHeader(_cellText(headerRow[index]));
        if (key.isNotEmpty) headers[key] = index;
      }

      final classesByName = {
        for (final row in _classes)
          row['nama_kelas'].toString().trim().toLowerCase(): row,
      };
      final classesById = {
        for (final row in _classes) (row['id_kelas'] as num).toInt(): row,
      };
      final studentsByNisn = {
        for (final row in _students) row['nisn'].toString().trim(): row,
      };

      var imported = 0;
      final skipped = <String>[];
      final seenNisn = <String>{};
      for (
        var rowIndex = headerIndex + 1;
        rowIndex < sheet.rows.length;
        rowIndex += 1
      ) {
        final row = sheet.rows[rowIndex];
        if (row.every((cell) => _cellText(cell).isEmpty)) continue;

        final nisn = _excelValue(row, headers, ['nisn']);
        final name = _excelValue(row, headers, ['namasantri', 'nama']);
        final className = _excelValue(row, headers, ['namakelas', 'kelas']);
        final classIdText = _excelValue(row, headers, ['idkelas']);
        final guardian = _excelValue(row, headers, ['namawali', 'wali']);
        final phone = _excelValue(row, headers, [
          'nomorwawali',
          'nowa',
          'whatsapp',
          'nohpwali',
        ]);
        if ([
          nisn,
          name,
          className,
          classIdText,
          guardian,
          phone,
        ].every((value) => value.isEmpty)) {
          continue;
        }
        if ([nisn, name, guardian, phone].any((value) => value.isEmpty)) {
          skipped.add(
            'Baris ${rowIndex + 1}: NISN, nama, wali, atau nomor WA kosong.',
          );
          continue;
        }
        if (!seenNisn.add(nisn)) {
          skipped.add(
            'Baris ${rowIndex + 1}: NISN $nisn duplikat di file Excel.',
          );
          continue;
        }

        final parsedClassId = int.tryParse(classIdText);
        final classRow = parsedClassId == null
            ? classesByName[className.trim().toLowerCase()]
            : classesById[parsedClassId];
        if (classRow == null) {
          skipped.add('Baris ${rowIndex + 1}: kelas tidak ditemukan.');
          continue;
        }

        final existing = studentsByNisn[nisn];
        await ThesisDatabase.instance.saveMaster(
          entity: 'santri',
          data: {
            if (existing != null) 'id_santri': existing['id_santri'],
            'id_kelas': (classRow['id_kelas'] as num).toInt(),
            'nisn': nisn,
            'nama_santri': name,
            'jenis_kelamin': _normalizeGender(
              _excelValue(row, headers, ['jeniskelamin', 'jk', 'gender']),
            ),
            'tgl_lahir': _nullableExcelValue(row, headers, [
              'tgllahir',
              'tanggallahir',
            ]),
            'nama_wali': guardian,
            'nomor_wa_wali': phone,
            'alamat': _nullableExcelValue(row, headers, ['alamat']),
            'status_aktif': true,
          },
        );
        imported += 1;
      }

      await _load();
      _notifyChanged();
      _syncMasterInBackground();
      final note = skipped.isEmpty ? '' : ' ${skipped.take(3).join(' ')}';
      _message(
        '$imported santri berhasil diproses.${skipped.isEmpty ? '' : ' ${skipped.length} baris dilewati.'}$note',
      );
    } catch (error) {
      _message('Import Excel gagal: $error');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  String _excelValue(
    List<Data?> row,
    Map<String, int> headers,
    List<String> keys,
  ) {
    for (final key in keys) {
      final index = headers[key];
      if (index != null && index < row.length) {
        final value = _cellText(row[index]);
        if (value.isNotEmpty) return value;
      }
    }
    return '';
  }

  String? _nullableExcelValue(
    List<Data?> row,
    Map<String, int> headers,
    List<String> keys,
  ) {
    final value = _excelValue(row, headers, keys);
    return value.isEmpty ? null : value;
  }

  String _cellText(Data? cell) {
    final value = cell?.value;
    if (value == null) return '';
    return switch (value) {
      TextCellValue() => value.value.toString().trim(),
      IntCellValue() => value.value.toString(),
      DoubleCellValue() =>
        value.value % 1 == 0
            ? value.value.toInt().toString()
            : value.value.toString(),
      DateCellValue() =>
        value.asDateTimeLocal().toIso8601String().split('T').first,
      DateTimeCellValue() =>
        value.asDateTimeLocal().toIso8601String().split('T').first,
      BoolCellValue() => value.value ? '1' : '0',
      TimeCellValue() => value.toString(),
      FormulaCellValue() => value.formula.trim(),
    };
  }

  String _normalizeHeader(String value) =>
      value.toLowerCase().replaceAll(RegExp(r'[^a-z0-9]'), '');

  String _normalizeGender(String value) {
    final normalized = value.trim().toLowerCase();
    if (normalized == 'p' ||
        normalized == 'perempuan' ||
        normalized == 'wanita') {
      return 'P';
    }
    return 'L';
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
