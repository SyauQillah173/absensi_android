import 'package:flutter/material.dart';
import '../../services/api_service.dart';

class EditMapelScreen extends StatefulWidget {
  final Map<String, dynamic> mapelData;
  const EditMapelScreen({super.key, required this.mapelData});

  @override
  State<EditMapelScreen> createState() => _EditMapelScreenState();
}

class _EditMapelScreenState extends State<EditMapelScreen> {
  late TextEditingController _namaController;
  late TextEditingController _kodeController;
  List<Map<String, dynamic>> _assignedGuru = [];
  List<Map<String, dynamic>> _allGuru = [];
  List<Map<String, dynamic>> _jadwalList = [];
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _namaController = TextEditingController(text: widget.mapelData['nama'] ?? '');
    _kodeController = TextEditingController(text: widget.mapelData['kode'] ?? '');
    _assignedGuru = List<Map<String, dynamic>>.from(widget.mapelData['guru'] ?? []);
    _jadwalList = List<Map<String, dynamic>>.from(widget.mapelData['jadwal'] ?? []);
    _loadGuru();
  }

  @override
  void dispose() {
    _namaController.dispose();
    _kodeController.dispose();
    super.dispose();
  }

  Future<void> _loadGuru() async {
    try {
      final result = await ApiService.getGuru();
      if (mounted) {
        setState(() {
          _allGuru = List<Map<String, dynamic>>.from(result['data'] ?? []);
        });
      }
    } catch (_) {}
  }

  void _showSnackBar(String message, {bool isError = false}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: isError ? const Color(0xFFD63031) : const Color(0xFF138F81),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }

  Future<void> _handleSimpan() async {
    if (_namaController.text.isEmpty) {
      _showSnackBar('Nama mapel wajib diisi!', isError: true);
      return;
    }
    setState(() => _isLoading = true);
    try {
      await ApiService.updateMataPelajaran(widget.mapelData['id'], {
        'nama': _namaController.text.toUpperCase(),
        'kode': _kodeController.text.isNotEmpty ? _kodeController.text.toUpperCase() : null,
        'guru_ids': _assignedGuru.map((g) => g['id']).toList(),
      });
      if (mounted) {
        _showSnackBar('${_namaController.text.toUpperCase()} berhasil diupdate!');
        Navigator.pop(context, true);
      }
    } catch (e) {
      _showSnackBar('Gagal: $e', isError: true);
    }
    setState(() => _isLoading = false);
  }

  void _showAddGuruDialog() {
    final availableGuru = _allGuru.where(
      (g) => !_assignedGuru.any((a) => a['id'] == g['id']),
    ).toList();

    if (availableGuru.isEmpty) {
      _showSnackBar('Semua guru sudah ditambahkan', isError: true);
      return;
    }

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        padding: const EdgeInsets.all(24),
        decoration: const BoxDecoration(
          color: Color(0xFFE1EFF7),
          borderRadius: BorderRadius.vertical(top: Radius.circular(30)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Tambah Guru Pengajar', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Color(0xFF2D3436))),
            const SizedBox(height: 16),
            ...availableGuru.map((guru) => ListTile(
              contentPadding: EdgeInsets.zero,
              leading: CircleAvatar(
                backgroundColor: const Color(0xFF138F81).withValues(alpha: 0.12),
                child: const Icon(Icons.person_rounded, size: 20, color: Color(0xFF138F81)),
              ),
              title: Text(guru['name'] ?? '', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
              subtitle: Text('NIS: ${guru['nis'] ?? '-'}', style: const TextStyle(fontSize: 11, color: Color(0xFF636E72))),
              trailing: IconButton(
                onPressed: () {
                  setState(() => _assignedGuru.add(guru));
                  Navigator.pop(ctx);
                },
                icon: const Icon(Icons.add_circle_rounded, color: Color(0xFF138F81)),
              ),
            )),
          ],
        ),
      ),
    );
  }

  void _showEditJadwalDialog(Map<String, dynamic>? jadwal) {
    String selectedHari = jadwal?['hari'] ?? 'Senin';
    final jamMulaiController = TextEditingController(text: jadwal?['jam_mulai'] ?? '08:00');
    final jamSelesaiController = TextEditingController(text: jadwal?['jam_selesai'] ?? '09:30');

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) {
          return Container(
            padding: EdgeInsets.fromLTRB(24, 20, 24, MediaQuery.of(ctx).viewInsets.bottom + 24),
            decoration: const BoxDecoration(
              color: Color(0xFFE1EFF7),
              borderRadius: BorderRadius.vertical(top: Radius.circular(30)),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(child: Container(width: 40, height: 4, decoration: BoxDecoration(color: Colors.grey[400], borderRadius: BorderRadius.circular(2)))),
                const SizedBox(height: 16),
                Text(jadwal != null ? 'Edit Jadwal' : 'Tambah Jadwal', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Color(0xFF2D3436))),
                const SizedBox(height: 16),

                const Text('Hari', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF636E72))),
                const SizedBox(height: 6),
                Wrap(
                  spacing: 8, runSpacing: 8,
                  children: ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'].map((h) {
                    final isSelected = selectedHari == h;
                    return GestureDetector(
                      onTap: () => setModalState(() => selectedHari = h),
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                        decoration: BoxDecoration(
                          color: isSelected ? const Color(0xFF138F81) : Colors.white,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Text(h, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: isSelected ? Colors.white : const Color(0xFF2D3436))),
                      ),
                    );
                  }).toList(),
                ),
                const SizedBox(height: 14),

                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Jam Mulai', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF636E72))),
                          const SizedBox(height: 6),
                          GestureDetector(
                            onTap: () async {
                              final parts = jamMulaiController.text.split(':');
                              final time = await showTimePicker(
                                context: ctx,
                                initialTime: TimeOfDay(hour: int.tryParse(parts[0]) ?? 8, minute: int.tryParse(parts[1]) ?? 0),
                              );
                              if (time != null) {
                                setModalState(() {
                                  jamMulaiController.text = '${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}';
                                });
                              }
                            },
                            child: AbsorbPointer(
                              child: TextField(
                                controller: jamMulaiController,
                                decoration: InputDecoration(filled: true, fillColor: Colors.white, border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none), suffixIcon: const Icon(Icons.access_time_rounded)),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Jam Selesai', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF636E72))),
                          const SizedBox(height: 6),
                          GestureDetector(
                            onTap: () async {
                              final parts = jamSelesaiController.text.split(':');
                              final time = await showTimePicker(
                                context: ctx,
                                initialTime: TimeOfDay(hour: int.tryParse(parts[0]) ?? 9, minute: int.tryParse(parts[1]) ?? 30),
                              );
                              if (time != null) {
                                setModalState(() {
                                  jamSelesaiController.text = '${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}';
                                });
                              }
                            },
                            child: AbsorbPointer(
                              child: TextField(
                                controller: jamSelesaiController,
                                decoration: InputDecoration(filled: true, fillColor: Colors.white, border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none), suffixIcon: const Icon(Icons.access_time_rounded)),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),

                SizedBox(
                  width: double.infinity, height: 48,
                  child: ElevatedButton(
                    onPressed: () async {
                      try {
                        if (jadwal != null && jadwal['id'] != null) {
                          await ApiService.updateJadwal(jadwal['id'], {
                            'hari': selectedHari,
                            'jam_mulai': jamMulaiController.text,
                            'jam_selesai': jamSelesaiController.text,
                          });
                        } else {
                          await ApiService.createJadwal({
                            'mapel_id': widget.mapelData['id'],
                            'guru': _assignedGuru.isNotEmpty ? _assignedGuru[0]['name'] : '',
                            'hari': selectedHari,
                            'jam_mulai': jamMulaiController.text,
                            'jam_selesai': jamSelesaiController.text,
                            'sifir': 'Sifir Awal A PA',
                            'status': 'Aktif',
                          });
                        }
                        if (ctx.mounted) Navigator.pop(ctx);
                        _showSnackBar('Jadwal berhasil ${jadwal != null ? 'diupdate' : 'ditambahkan'}!');
                        _refreshJadwal();
                      } catch (e) {
                        _showSnackBar('Gagal: $e', isError: true);
                      }
                    },
                    style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF138F81), foregroundColor: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)), elevation: 0),
                    child: Text(jadwal != null ? 'Update Jadwal' : 'Tambah Jadwal', style: const TextStyle(fontWeight: FontWeight.w700)),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Future<void> _refreshJadwal() async {
    try {
      final result = await ApiService.getMataPelajaran();
      final mapelList = List<Map<String, dynamic>>.from(result['data'] ?? []);
      final updated = mapelList.firstWhere((m) => m['id'] == widget.mapelData['id'], orElse: () => widget.mapelData);
      if (mounted) {
        setState(() {
          _jadwalList = List<Map<String, dynamic>>.from(updated['jadwal'] ?? []);
        });
      }
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFFDC80),
      body: SafeArea(
        child: Column(
          children: [
            // ===== HEADER =====
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                decoration: BoxDecoration(color: const Color(0xFFE1EFF7), borderRadius: BorderRadius.circular(25)),
                child: Row(
                  children: [
                    Container(
                      width: 50, height: 50,
                      decoration: const BoxDecoration(shape: BoxShape.circle, color: Color(0xFFFFDC80)),
                      child: const Icon(Icons.edit_rounded, color: Color(0xFF138F81), size: 26),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Edit Mata Pelajaran', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: Color(0xFF2D3436))),
                          Text('${widget.mapelData['nama'] ?? ''}', style: const TextStyle(fontSize: 11, color: Color(0xFF636E72))),
                        ],
                      ),
                    ),
                    IconButton(onPressed: () => Navigator.pop(context), icon: const Icon(Icons.close_rounded, size: 22)),
                  ],
                ),
              ),
            ),

            // ===== CONTENT =====
            Expanded(
              child: Container(
                width: double.infinity,
                margin: const EdgeInsets.symmetric(horizontal: 16),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(color: const Color(0xFFE1EFF7), borderRadius: BorderRadius.circular(30)),
                child: SingleChildScrollView(
                  physics: const BouncingScrollPhysics(),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Nama
                      const Text('Nama Mata Pelajaran', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF636E72))),
                      const SizedBox(height: 6),
                      TextField(
                        controller: _namaController,
                        decoration: InputDecoration(filled: true, fillColor: Colors.white, border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none)),
                      ),
                      const SizedBox(height: 14),

                      // Kode
                      const Text('Kode Mapel', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF636E72))),
                      const SizedBox(height: 6),
                      TextField(
                        controller: _kodeController,
                        decoration: InputDecoration(filled: true, fillColor: Colors.white, border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none), hintText: 'TAF'),
                      ),
                      const SizedBox(height: 20),

                      // Guru section
                      Row(
                        children: [
                          const Text('Guru Pengajar', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF636E72))),
                          const Spacer(),
                          GestureDetector(
                            onTap: _showAddGuruDialog,
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                              decoration: BoxDecoration(color: const Color(0xFF138F81), borderRadius: BorderRadius.circular(10)),
                              child: const Text('+ Tambah', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: Colors.white)),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      if (_assignedGuru.isEmpty)
                        Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.5), borderRadius: BorderRadius.circular(14)),
                          child: const Center(child: Text('Belum ada guru yang ditambahkan', style: TextStyle(fontSize: 12, color: Color(0xFF636E72)))),
                        )
                      else
                        ..._assignedGuru.map((guru) => Container(
                          margin: const EdgeInsets.symmetric(vertical: 3),
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14)),
                          child: Row(
                            children: [
                              CircleAvatar(
                                radius: 16,
                                backgroundColor: const Color(0xFF138F81).withValues(alpha: 0.12),
                                child: const Icon(Icons.person_rounded, size: 16, color: Color(0xFF138F81)),
                              ),
                              const SizedBox(width: 10),
                              Expanded(child: Text(guru['name'] ?? '', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF2D3436)))),
                              IconButton(
                                onPressed: () => setState(() => _assignedGuru.remove(guru)),
                                icon: const Icon(Icons.remove_circle_rounded, size: 20, color: Color(0xFFD63031)),
                              ),
                            ],
                          ),
                        )),

                      const SizedBox(height: 20),

                      // Jadwal section (MERGED from jadwal_pelajaran)
                      Row(
                        children: [
                          const Text('Jadwal Pelajaran', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF636E72))),
                          const Spacer(),
                          GestureDetector(
                            onTap: () => _showEditJadwalDialog(null),
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                              decoration: BoxDecoration(color: const Color(0xFFFFDC80), borderRadius: BorderRadius.circular(10)),
                              child: const Text('+ Tambah', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: Color(0xFF2D3436))),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      if (_jadwalList.isEmpty)
                        Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.5), borderRadius: BorderRadius.circular(14)),
                          child: const Center(child: Text('Belum ada jadwal', style: TextStyle(fontSize: 12, color: Color(0xFF636E72)))),
                        )
                      else
                        ..._jadwalList.map((jadwal) {
                          return Container(
                            margin: const EdgeInsets.symmetric(vertical: 3),
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                            decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14)),
                            child: Row(
                              children: [
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                  decoration: BoxDecoration(
                                    color: _getHariColor(jadwal['hari']).withValues(alpha: 0.15),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: Text(
                                    jadwal['hari'] ?? '',
                                    style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: _getHariColor(jadwal['hari'])),
                                  ),
                                ),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text('${jadwal['jam_mulai']} — ${jadwal['jam_selesai']}', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF2D3436))),
                                      Text(jadwal['sifir'] ?? '', style: const TextStyle(fontSize: 10, color: Color(0xFF636E72))),
                                    ],
                                  ),
                                ),
                                GestureDetector(
                                  onTap: () => _showEditJadwalDialog(jadwal),
                                  child: const Padding(
                                    padding: EdgeInsets.all(4),
                                    child: Icon(Icons.edit_rounded, size: 16, color: Color(0xFF2E86DE)),
                                  ),
                                ),
                              ],
                            ),
                          );
                        }),

                      const SizedBox(height: 30),

                      // Save button
                      SizedBox(
                        width: double.infinity, height: 50,
                        child: ElevatedButton(
                          onPressed: _isLoading ? null : _handleSimpan,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF138F81),
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                            elevation: 0,
                          ),
                          child: _isLoading
                              ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                              : const Text('Simpan Perubahan', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                        ),
                      ),
                      const SizedBox(height: 20),
                    ],
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

  Color _getHariColor(String? hari) {
    switch (hari) {
      case 'Senin': return const Color(0xFF2E86DE);
      case 'Selasa': return const Color(0xFF138F81);
      case 'Rabu': return const Color(0xFF6C5CE7);
      case 'Kamis': return const Color(0xFFE65100);
      case 'Jumat': return const Color(0xFFD63031);
      case 'Sabtu': return const Color(0xFFFFB74D);
      default: return const Color(0xFF636E72);
    }
  }
}
