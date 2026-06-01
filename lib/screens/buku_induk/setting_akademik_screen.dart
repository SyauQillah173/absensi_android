import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../services/api_service.dart';
import '../../widgets/responsive_layout.dart';

class SettingAkademikScreen extends StatefulWidget {
  const SettingAkademikScreen({super.key});

  @override
  State<SettingAkademikScreen> createState() => _SettingAkademikScreenState();
}

class _SettingAkademikScreenState extends State<SettingAkademikScreen> {
  List<Map<String, dynamic>> _years = [];
  Map<String, dynamic>? _active;
  bool _loading = true;
  bool _saving = false;
  final Set<int> _syncingYearIds = <int>{};

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (mounted) setState(() => _loading = true);
    try {
      final result = await ApiService.getAcademicPeriods();
      final data = result['data'];
      if (!mounted) return;
      setState(() {
        _active = result['active'] is Map
            ? Map<String, dynamic>.from(result['active'])
            : null;
        _years = data is List
            ? data
                  .whereType<Map>()
                  .map((item) => Map<String, dynamic>.from(item))
                  .toList()
            : [];
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _loading = false);
      _snack('Gagal memuat tahun ajaran: $e');
    }
  }

  Future<void> _activate(Map<String, dynamic> year, String semester) async {
    final id = int.tryParse(year['id']?.toString() ?? '');
    if (id == null || _saving) return;
    setState(() => _saving = true);
    try {
      await ApiService.activateAcademicPeriod(id, semester: semester);
      await _load();
      _snack('Tahun ajaran aktif diperbarui.');
    } catch (e) {
      _snack('Gagal mengaktifkan tahun ajaran: $e');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _setSemester(Map<String, dynamic> year, String semester) async {
    final id = int.tryParse(year['id']?.toString() ?? '');
    if (id == null || _saving) return;
    setState(() => _saving = true);
    try {
      await ApiService.setAcademicSemester(id, semester);
      await _load();
      _snack('Semester aktif diperbarui.');
    } catch (e) {
      _snack('Gagal mengubah semester: $e');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _syncSiswa(Map<String, dynamic> year) async {
    final id = int.tryParse(year['id']?.toString() ?? '');
    if (id == null || _syncingYearIds.contains(id)) return;
    final semester = year['active_semester']?.toString() == 'genap'
        ? 'genap'
        : 'ganjil';

    setState(() => _syncingYearIds.add(id));
    try {
      final result = await ApiService.syncAcademicPeriodSiswa(
        id,
        semester: semester,
      );
      final data = result['data'] is Map
          ? Map<String, dynamic>.from(result['data'] as Map)
          : const <String, dynamic>{};
      if (!mounted) return;
      _snack(
        'Sinkronisasi Completed. Total: ${data['total_santri'] ?? 0}, '
        'Berhasil: ${data['berhasil'] ?? 0}, Sudah Ada: ${data['sudah_ada'] ?? 0}.',
      );
    } catch (e) {
      _snack('Gagal sinkronisasi santri: $e');
    } finally {
      if (mounted) {
        setState(() => _syncingYearIds.remove(id));
      }
    }
  }

  Future<void> _showForm([Map<String, dynamic>? year]) async {
    final nameCtrl = TextEditingController(
      text: year?['name']?.toString() ?? '',
    );
    final startCtrl = TextEditingController(
      text: year?['year_start']?.toString() ?? DateTime.now().year.toString(),
    );
    final endCtrl = TextEditingController(
      text:
          year?['year_end']?.toString() ?? (DateTime.now().year + 1).toString(),
    );
    String semester = year?['active_semester']?.toString() == 'genap'
        ? 'genap'
        : 'ganjil';
    bool sheetSaving = false;

    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setSheetState) {
            return SafeArea(
              child: Container(
                padding: EdgeInsets.only(
                  left: 18,
                  right: 18,
                  top: 14,
                  bottom: MediaQuery.of(context).viewInsets.bottom + 18,
                ),
                decoration: const BoxDecoration(
                  color: Color(0xFFE1EFF7),
                  borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Center(
                      child: Container(
                        width: 44,
                        height: 4,
                        decoration: BoxDecoration(
                          color: const Color(0xFFB2BEC3),
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                    ),
                    const SizedBox(height: 18),
                    Text(
                      year == null
                          ? 'Tambah Tahun Ajaran'
                          : 'Edit Tahun Ajaran',
                      style: GoogleFonts.poppins(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                        color: const Color(0xFF2D3436),
                      ),
                    ),
                    const SizedBox(height: 14),
                    _field('Nama Tahun Ajaran', nameCtrl, hint: '2025/2026'),
                    Row(
                      children: [
                        Expanded(child: _field('Tahun Mulai', startCtrl)),
                        const SizedBox(width: 10),
                        Expanded(child: _field('Tahun Selesai', endCtrl)),
                      ],
                    ),
                    Text(
                      'Semester Aktif',
                      style: GoogleFonts.poppins(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: const Color(0xFF636E72),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Expanded(
                          child: _semesterChip(
                            'Ganjil',
                            semester == 'ganjil',
                            () {
                              setSheetState(() => semester = 'ganjil');
                            },
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: _semesterChip(
                            'Genap',
                            semester == 'genap',
                            () {
                              setSheetState(() => semester = 'genap');
                            },
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 18),
                    SizedBox(
                      width: double.infinity,
                      height: 50,
                      child: ElevatedButton.icon(
                        onPressed: sheetSaving
                            ? null
                            : () async {
                                final start = int.tryParse(
                                  startCtrl.text.trim(),
                                );
                                final end = int.tryParse(endCtrl.text.trim());
                                if (start == null ||
                                    end == null ||
                                    end <= start) {
                                  _snack('Tahun ajaran tidak valid.');
                                  return;
                                }
                                final payload = {
                                  'name': nameCtrl.text.trim().isEmpty
                                      ? '$start/$end'
                                      : nameCtrl.text.trim(),
                                  'year_start': start,
                                  'year_end': end,
                                  'active_semester': semester,
                                };
                                final id = int.tryParse(
                                  year?['id']?.toString() ?? '',
                                );
                                setSheetState(() => sheetSaving = true);
                                try {
                                  if (id == null) {
                                    await ApiService.createAcademicPeriod(
                                      payload,
                                    );
                                  } else {
                                    await ApiService.updateAcademicPeriod(
                                      id,
                                      payload,
                                    );
                                  }
                                  if (!context.mounted) return;
                                  Navigator.of(context).pop(true);
                                } catch (e) {
                                  _snack('Gagal menyimpan tahun ajaran: $e');
                                  if (context.mounted) {
                                    setSheetState(() => sheetSaving = false);
                                  }
                                }
                              },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF138F81),
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(16),
                          ),
                        ),
                        icon: sheetSaving
                            ? const SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(
                                  color: Colors.white,
                                  strokeWidth: 2,
                                ),
                              )
                            : const Icon(Icons.save_rounded),
                        label: Text(
                          'Simpan Tahun Ajaran',
                          style: GoogleFonts.poppins(
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );

    nameCtrl.dispose();
    startCtrl.dispose();
    endCtrl.dispose();
    if (saved == true) await _load();
  }

  void _snack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    final activeLabel =
        '${_active?['tahun_ajaran'] ?? '-'} ${_active?['semester_label'] ?? ''}';

    return Scaffold(
      backgroundColor: const Color(0xFFFFDC80),
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 12,
                ),
                decoration: BoxDecoration(
                  color: const Color(0xFFE1EFF7),
                  borderRadius: BorderRadius.circular(25),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 50,
                      height: 50,
                      decoration: BoxDecoration(
                        color: const Color(0xFFFFDC80),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: const Icon(
                        Icons.calendar_month_rounded,
                        color: Color(0xFF138F81),
                        size: 28,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Setting Akademik',
                            style: GoogleFonts.poppins(
                              fontSize: 17,
                              fontWeight: FontWeight.w700,
                              color: const Color(0xFF2D3436),
                            ),
                          ),
                          Text(
                            activeLabel,
                            style: GoogleFonts.poppins(
                              fontSize: 12,
                              color: const Color(0xFF636E72),
                            ),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      onPressed: () => Navigator.pop(context),
                      icon: const Icon(Icons.close_rounded),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 14),
            Expanded(
              child: AppResponsive(
                child: Container(
                  margin: EdgeInsets.symmetric(
                    horizontal: AppResponsive.pageMargin(context),
                  ),
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: const Color(0xFFE1EFF7),
                    borderRadius: BorderRadius.circular(30),
                  ),
                  child: _loading
                      ? const Center(
                          child: CircularProgressIndicator(
                            color: Color(0xFF138F81),
                          ),
                        )
                      : RefreshIndicator(
                          onRefresh: _load,
                          color: const Color(0xFF138F81),
                          child: ListView(
                            physics: const AlwaysScrollableScrollPhysics(
                              parent: BouncingScrollPhysics(),
                            ),
                            children: [
                              _summaryCard(activeLabel),
                              const SizedBox(height: 12),
                              ElevatedButton.icon(
                                onPressed: () => _showForm(),
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: const Color(0xFF138F81),
                                  foregroundColor: Colors.white,
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(16),
                                  ),
                                  minimumSize: const Size.fromHeight(48),
                                ),
                                icon: const Icon(Icons.add_rounded),
                                label: Text(
                                  'Tambah Tahun Ajaran',
                                  style: GoogleFonts.poppins(
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ),
                              const SizedBox(height: 14),
                              ..._years.map(_yearCard),
                            ],
                          ),
                        ),
                ),
              ),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  Widget _summaryCard(String activeLabel) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
      ),
      child: Row(
        children: [
          const Icon(Icons.verified_rounded, color: Color(0xFF138F81)),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              'Periode aktif: $activeLabel',
              style: GoogleFonts.poppins(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: const Color(0xFF2D3436),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _yearCard(Map<String, dynamic> year) {
    final isActive = year['is_active'] == true;
    final yearId = int.tryParse(year['id']?.toString() ?? '');
    final isSyncing = yearId != null && _syncingYearIds.contains(yearId);
    final semester = year['active_semester']?.toString() == 'genap'
        ? 'genap'
        : 'ganjil';
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  year['name']?.toString() ?? '-',
                  style: GoogleFonts.poppins(
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    color: const Color(0xFF2D3436),
                  ),
                ),
              ),
              _badge(isActive ? 'Aktif' : 'Nonaktif', isActive),
              IconButton(
                onPressed: () => _showForm(year),
                icon: const Icon(Icons.edit_rounded, color: Color(0xFF2E86DE)),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: _semesterChip('Ganjil', semester == 'ganjil', () {
                  isActive
                      ? _setSemester(year, 'ganjil')
                      : _activate(year, 'ganjil');
                }),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _semesterChip('Genap', semester == 'genap', () {
                  isActive
                      ? _setSemester(year, 'genap')
                      : _activate(year, 'genap');
                }),
              ),
            ],
          ),
          if (!isActive) ...[
            const SizedBox(height: 10),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton(
                onPressed: _saving ? null : () => _activate(year, semester),
                style: OutlinedButton.styleFrom(
                  foregroundColor: const Color(0xFF138F81),
                  side: const BorderSide(color: Color(0xFF138F81)),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
                child: const Text('Aktifkan Tahun Ajaran Ini'),
              ),
            ),
          ],
          const SizedBox(height: 10),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: isSyncing ? null : () => _syncSiswa(year),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFFFDC80),
                foregroundColor: const Color(0xFF138F81),
                elevation: 0,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
              icon: isSyncing
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(
                        color: Color(0xFF138F81),
                        strokeWidth: 2,
                      ),
                    )
                  : const Icon(Icons.sync_rounded),
              label: Text(
                isSyncing ? 'Sinkronisasi...' : 'Sinkronisasi Data Santri',
                style: GoogleFonts.poppins(fontWeight: FontWeight.w700),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _badge(String text, bool active) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: active ? const Color(0xFFE1F5F2) : const Color(0xFFF1F2F6),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Text(
        text,
        style: GoogleFonts.poppins(
          fontSize: 11,
          fontWeight: FontWeight.w700,
          color: active ? const Color(0xFF138F81) : const Color(0xFF636E72),
        ),
      ),
    );
  }

  Widget _field(
    String label,
    TextEditingController controller, {
    String? hint,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: GoogleFonts.poppins(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: const Color(0xFF636E72),
            ),
          ),
          const SizedBox(height: 5),
          TextField(
            controller: controller,
            style: GoogleFonts.poppins(fontSize: 13),
            decoration: InputDecoration(
              hintText: hint,
              filled: true,
              fillColor: Colors.white,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: BorderSide.none,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _semesterChip(String label, bool selected, VoidCallback onTap) {
    return GestureDetector(
      onTap: _saving ? null : onTap,
      child: Container(
        height: 42,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: selected ? const Color(0xFF138F81) : Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: selected ? const Color(0xFF138F81) : const Color(0xFFDFE6E9),
          ),
        ),
        child: Text(
          label,
          style: GoogleFonts.poppins(
            fontSize: 12,
            fontWeight: FontWeight.w700,
            color: selected ? Colors.white : const Color(0xFF636E72),
          ),
        ),
      ),
    );
  }
}
