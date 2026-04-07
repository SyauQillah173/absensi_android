import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:io';

import '../../services/api_service.dart';

class UploadMateriScreen extends StatefulWidget {
  const UploadMateriScreen({super.key});

  @override
  State<UploadMateriScreen> createState() => _UploadMateriScreenState();
}

class _UploadMateriScreenState extends State<UploadMateriScreen> {
  final _judulController = TextEditingController();
  final _deskripsiController = TextEditingController();
  String? _selectedKelas;
  String? _selectedMapel;
  XFile? _selectedFile;
  bool _isUploading = false;
  int _userId = 0;

  final _kelasList = [
    'Ula 1', 'Ula 2', 'Ula 3', 'Ula 4', 'Ula 5', 'Ula 6',
    'Wustho 1', 'Wustho 2', 'Wustho 3',
    'Ulya 1', 'Ulya 2', 'Ulya 3',
  ];

  final _mapelList = [
    'Al-Quran', 'Hadits', 'Fiqih', 'Aqidah', 'Akhlaq',
    'Tarikh', 'Bahasa Arab', 'Nahwu', 'Shorof', 'Tajwid',
    'Tauhid', 'Tasawuf', 'Mantiq', 'Balaghoh',
  ];

  @override
  void initState() {
    super.initState();
    _loadUser();
  }

  Future<void> _loadUser() async {
    final prefs = await SharedPreferences.getInstance();
    _userId = prefs.getInt('user_id') ?? 0;
  }

  @override
  void dispose() {
    _judulController.dispose();
    _deskripsiController.dispose();
    super.dispose();
  }

  Future<void> _pickFile() async {
    final picker = ImagePicker();
    final file = await picker.pickImage(
      source: ImageSource.gallery,
      maxWidth: 1920,
      maxHeight: 1920,
      imageQuality: 80,
    );
    if (file != null) {
      setState(() => _selectedFile = file);
    }
  }

  Future<void> _takePicture() async {
    final picker = ImagePicker();
    final file = await picker.pickImage(
      source: ImageSource.camera,
      maxWidth: 1920,
      maxHeight: 1920,
      imageQuality: 80,
    );
    if (file != null) {
      setState(() => _selectedFile = file);
    }
  }

  Future<void> _upload() async {
    if (_judulController.text.isEmpty || _selectedKelas == null ||
        _selectedMapel == null || _selectedFile == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('Lengkapi semua field dan pilih file'),
        backgroundColor: Colors.redAccent,
        behavior: SnackBarBehavior.floating,
      ));
      return;
    }

    setState(() => _isUploading = true);

    try {
      await ApiService.uploadMateri(
        guruId: _userId,
        kelas: _selectedKelas!,
        mapel: _selectedMapel!,
        judul: _judulController.text.trim(),
        deskripsi: _deskripsiController.text.trim(),
        filePath: _selectedFile!.path,
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Materi berhasil diupload! ✅'),
          backgroundColor: Color(0xFF138F81),
          behavior: SnackBarBehavior.floating,
        ));
        Navigator.pop(context, true);
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isUploading = false);
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Gagal upload: $e'),
          backgroundColor: Colors.redAccent,
          behavior: SnackBarBehavior.floating,
        ));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFFDC80),
      body: SafeArea(
        child: Column(
          children: [
            // Header
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                decoration: BoxDecoration(
                  color: const Color(0xFFE1EFF7),
                  borderRadius: BorderRadius.circular(25),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 50, height: 50,
                      decoration: const BoxDecoration(
                        shape: BoxShape.circle, color: Color(0xFFFFDC80),
                      ),
                      child: const Icon(Icons.upload_file_rounded,
                        color: Color(0xFF138F81), size: 28,
                      ),
                    ),
                    const SizedBox(width: 12),
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Upload Materi', style: TextStyle(
                            fontSize: 18, fontWeight: FontWeight.w700,
                            color: Color(0xFF2D3436),
                          )),
                          Text('Unggah materi pelajaran', style: TextStyle(
                            fontSize: 11, color: Color(0xFF636E72),
                          )),
                        ],
                      ),
                    ),
                    IconButton(
                      onPressed: () => Navigator.pop(context),
                      icon: const Icon(Icons.close_rounded, size: 22),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),
            // Form
            Expanded(
              child: SingleChildScrollView(
                physics: const BouncingScrollPhysics(),
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: const Color(0xFFE1EFF7),
                    borderRadius: BorderRadius.circular(25),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Kelas dropdown
                      _buildLabel('Kelas'),
                      _buildDropdown(_kelasList, _selectedKelas, 'Pilih kelas...',
                        (val) => setState(() => _selectedKelas = val)),
                      const SizedBox(height: 14),
                      // Mapel dropdown
                      _buildLabel('Mata Pelajaran'),
                      _buildDropdown(_mapelList, _selectedMapel, 'Pilih mapel...',
                        (val) => setState(() => _selectedMapel = val)),
                      const SizedBox(height: 14),
                      // Judul
                      _buildLabel('Judul Materi'),
                      _buildTextField(_judulController, 'Contoh: Bab 3 — Sholat Jamaah'),
                      const SizedBox(height: 14),
                      // Deskripsi
                      _buildLabel('Deskripsi (opsional)'),
                      _buildTextField(_deskripsiController, 'Penjelasan singkat...', maxLines: 3),
                      const SizedBox(height: 14),
                      // File picker
                      _buildLabel('File / Foto Materi'),
                      const SizedBox(height: 6),
                      if (_selectedFile != null) ...[
                        ClipRRect(
                          borderRadius: BorderRadius.circular(16),
                          child: Image.file(
                            File(_selectedFile!.path),
                            height: 200,
                            width: double.infinity,
                            fit: BoxFit.cover,
                          ),
                        ),
                        const SizedBox(height: 8),
                      ],
                      Row(
                        children: [
                          Expanded(
                            child: OutlinedButton.icon(
                              onPressed: _pickFile,
                              icon: const Icon(Icons.photo_library_rounded, size: 18),
                              label: const Text('Galeri'),
                              style: OutlinedButton.styleFrom(
                                foregroundColor: const Color(0xFF138F81),
                                side: const BorderSide(color: Color(0xFF138F81)),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(14),
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: OutlinedButton.icon(
                              onPressed: _takePicture,
                              icon: const Icon(Icons.camera_alt_rounded, size: 18),
                              label: const Text('Kamera'),
                              style: OutlinedButton.styleFrom(
                                foregroundColor: const Color(0xFF138F81),
                                side: const BorderSide(color: Color(0xFF138F81)),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(14),
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 24),
                      // Submit
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton(
                          onPressed: _isUploading ? null : _upload,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF138F81),
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(16),
                            ),
                          ),
                          child: _isUploading
                              ? const SizedBox(width: 20, height: 20,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2.5, color: Colors.white),
                                )
                              : const Text('Upload Materi',
                                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(height: 12),
          ],
        ),
      ),
    );
  }

  Widget _buildLabel(String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Text(text, style: const TextStyle(
        fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF2D3436),
      )),
    );
  }

  Widget _buildTextField(TextEditingController controller, String hint, {int maxLines = 1}) {
    return TextField(
      controller: controller,
      maxLines: maxLines,
      style: const TextStyle(fontSize: 14),
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: TextStyle(color: Colors.grey[400], fontSize: 13),
        filled: true,
        fillColor: Colors.white,
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide.none,
        ),
      ),
    );
  }

  Widget _buildDropdown(List<String> items, String? value, String hint,
      ValueChanged<String?> onChanged) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String>(
          value: value,
          isExpanded: true,
          hint: Text(hint, style: TextStyle(color: Colors.grey[400], fontSize: 13)),
          style: const TextStyle(fontSize: 14, color: Color(0xFF2D3436)),
          items: items.map((e) => DropdownMenuItem(value: e, child: Text(e))).toList(),
          onChanged: onChanged,
        ),
      ),
    );
  }
}
