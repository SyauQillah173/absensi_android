import 'package:flutter/material.dart';

import '../../services/api_service.dart';
import '../../services/sync_service.dart';

class EditMapelScreen extends StatefulWidget {
  final Map<String, dynamic> mapelData;

  const EditMapelScreen({super.key, required this.mapelData});

  @override
  State<EditMapelScreen> createState() => _EditMapelScreenState();
}

class _EditMapelScreenState extends State<EditMapelScreen> {
  late final TextEditingController _namaController;
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _namaController = TextEditingController(
      text: widget.mapelData['nama']?.toString() ?? '',
    );
  }

  @override
  void dispose() {
    _namaController.dispose();
    super.dispose();
  }

  int? get _mapelId => (widget.mapelData['id'] as num?)?.toInt();

  Future<void> _handleSimpan() async {
    final nama = _namaController.text.trim().toUpperCase();
    if (nama.isEmpty) {
      _showSnackBar('Nama mata pelajaran wajib diisi', isError: true);
      return;
    }

    final id = _mapelId;
    if (id == null) {
      _showSnackBar('ID mata pelajaran tidak valid', isError: true);
      return;
    }

    setState(() => _isLoading = true);

    try {
      final result = await ApiService.updateMataPelajaran(id, {'nama': nama});
      await SyncService.notifyDataChanged(
        SyncTopics.mapel,
        message: 'Nama mata pelajaran berhasil diperbarui',
      );
      await SyncService.notifyDataChanged(
        SyncTopics.absensi,
        message: 'Data absensi perlu diperbarui',
      );

      if (!mounted) return;

      _showSnackBar('Mata pelajaran berhasil diperbarui');
      final updated = result['data'];
      Navigator.pop(
        context,
        updated is Map<String, dynamic>
            ? updated
            : <String, dynamic>{...widget.mapelData, 'nama': nama},
      );
    } catch (e) {
      _showSnackBar('Gagal menyimpan mata pelajaran: $e', isError: true);
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  void _showSnackBar(String message, {bool isError = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: isError
            ? const Color(0xFFD63031)
            : const Color(0xFF138F81),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final currentName =
        widget.mapelData['nama']?.toString() ?? 'Mata Pelajaran';

    return Scaffold(
      backgroundColor: const Color(0xFFFFDC80),
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 12,
                ),
                decoration: BoxDecoration(
                  color: const Color(0xFFE9F8FF),
                  borderRadius: BorderRadius.circular(28),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 64,
                      height: 64,
                      decoration: const BoxDecoration(
                        color: Color(0xFFFFDC80),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.edit_rounded,
                        color: Color(0xFF138F81),
                        size: 36,
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Edit Mata Pelajaran',
                            style: TextStyle(
                              fontSize: 24,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF2D3436),
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            currentName,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 16,
                              color: Color(0xFF636E72),
                            ),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      onPressed: _isLoading
                          ? null
                          : () => Navigator.pop(context),
                      icon: const Icon(
                        Icons.close_rounded,
                        size: 34,
                        color: Color(0xFF2D3436),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            Expanded(
              child: Container(
                width: double.infinity,
                margin: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                padding: const EdgeInsets.all(22),
                decoration: BoxDecoration(
                  color: const Color(0xFFE9F8FF),
                  borderRadius: BorderRadius.circular(30),
                ),
                child: SingleChildScrollView(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Nama Mata Pelajaran',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF636E72),
                        ),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _namaController,
                        textCapitalization: TextCapitalization.characters,
                        enabled: !_isLoading,
                        decoration: InputDecoration(
                          hintText: 'Masukkan nama mata pelajaran',
                          filled: true,
                          fillColor: Colors.white,
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(18),
                            borderSide: BorderSide.none,
                          ),
                          contentPadding: const EdgeInsets.symmetric(
                            horizontal: 18,
                            vertical: 18,
                          ),
                        ),
                        style: const TextStyle(
                          fontSize: 22,
                          color: Color(0xFF2D3436),
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      const SizedBox(height: 34),
                      SizedBox(
                        width: double.infinity,
                        height: 58,
                        child: ElevatedButton(
                          onPressed: _isLoading ? null : _handleSimpan,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF138F81),
                            foregroundColor: Colors.white,
                            disabledBackgroundColor: const Color(0xFF8AC7BF),
                            elevation: 0,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(22),
                            ),
                          ),
                          child: _isLoading
                              ? const SizedBox(
                                  width: 24,
                                  height: 24,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2.5,
                                    color: Colors.white,
                                  ),
                                )
                              : const Text(
                                  'Simpan Perubahan',
                                  style: TextStyle(
                                    fontSize: 20,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
