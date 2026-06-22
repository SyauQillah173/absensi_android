import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../../services/reference_data_service.dart';
import '../../services/session_service.dart';
import '../../services/sync_service.dart';
import '../../services/api_service.dart';

class UploadMateriScreen extends StatefulWidget {
  const UploadMateriScreen({super.key});

  @override
  State<UploadMateriScreen> createState() => _UploadMateriScreenState();
}

class _UploadMateriScreenState extends State<UploadMateriScreen> {
  final _judulController = TextEditingController();
  final _deskripsiController = TextEditingController();

  StreamSubscription<AppDataEvent>? _syncSubscription;

  List<Map<String, dynamic>> _kelasList = [];
  List<Map<String, dynamic>> _mapelList = [];
  String? _selectedKelas;
  int? _selectedMapelId;
  XFile? _selectedFile;
  bool _isLoadingReference = true;
  bool _isUploading = false;
  bool _isOfflineMode = false;
  int _userId = 0;
  String _userRole = '';

  @override
  void initState() {
    super.initState();
    _loadInitialData();
    _syncSubscription = SyncService.dataEvents.listen((event) {
      if (!mounted) return;
      if (event.topic == SyncTopics.mapel ||
          event.topic == SyncTopics.kelas ||
          event.topic == SyncTopics.heartbeat) {
        _loadReferenceData(silent: true);
      }
    });
  }

  Future<void> _loadInitialData() async {
    _userId = await SessionService.getUserId();
    _userRole = await SessionService.getUserRole();
    await _loadReferenceData();
  }

  @override
  void dispose() {
    _syncSubscription?.cancel();
    _judulController.dispose();
    _deskripsiController.dispose();
    super.dispose();
  }

  Future<void> _loadReferenceData({bool silent = false}) async {
    if (!silent) {
      setState(() => _isLoadingReference = true);
    }

    final cached = await ReferenceDataService.getCached();
    if (cached != null && mounted && _kelasList.isEmpty && _mapelList.isEmpty) {
      final resolvedKelas = _resolveSelectedKelas(_selectedKelas, cached.kelas);
      final filteredMapel = _mapelForKelas(
        resolvedKelas,
        source: cached.mataPelajaran,
      );
      setState(() {
        _kelasList = cached.kelas;
        _mapelList = cached.mataPelajaran;
        _selectedKelas = resolvedKelas;
        _selectedMapelId = _resolveSelectedMapel(
          _selectedMapelId,
          filteredMapel,
        );
        _isLoadingReference = false;
        _isOfflineMode = true;
      });
    }

    try {
      final fresh = await ReferenceDataService.refresh();
      if (!mounted) return;
      final resolvedKelas = _resolveSelectedKelas(_selectedKelas, fresh.kelas);
      final filteredMapel = _mapelForKelas(
        resolvedKelas,
        source: fresh.mataPelajaran,
      );
      setState(() {
        _kelasList = fresh.kelas;
        _mapelList = fresh.mataPelajaran;
        _selectedKelas = resolvedKelas;
        _selectedMapelId = _resolveSelectedMapel(
          _selectedMapelId,
          filteredMapel,
        );
        _isLoadingReference = false;
        _isOfflineMode = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _isLoadingReference = false);
    }
  }

  String? _firstClassName(List<Map<String, dynamic>> kelas) {
    if (kelas.isEmpty) return null;
    return kelas.first['nama']?.toString();
  }

  int? _firstMapelId(List<Map<String, dynamic>> mapel) {
    if (mapel.isEmpty) return null;
    return (mapel.first['id'] as num?)?.toInt();
  }

  String? _resolveSelectedKelas(
    String? current,
    List<Map<String, dynamic>> kelasList,
  ) {
    if (current != null &&
        kelasList.any((item) => item['nama']?.toString() == current)) {
      return current;
    }
    return _firstClassName(kelasList);
  }

  int? _resolveSelectedMapel(
    int? current,
    List<Map<String, dynamic>> mapelList,
  ) {
    if (current != null &&
        mapelList.any((item) => (item['id'] as num?)?.toInt() == current)) {
      return current;
    }
    return _firstMapelId(mapelList);
  }

  List<Map<String, dynamic>> _mapelForKelas(
    String? kelas, {
    List<Map<String, dynamic>>? source,
  }) {
    return ReferenceDataService.filterMapelForKelas(
      source ?? _mapelList,
      kelas,
      _selectedClassIdForName(kelas),
      _userRole,
    );
  }

  int? _selectedClassIdForName(String? kelas) {
    if (kelas == null || kelas.trim().isEmpty) return null;
    for (final item in _kelasList) {
      if (item['nama']?.toString() == kelas) {
        return (item['id'] as num?)?.toInt();
      }
    }
    return null;
  }

  List<Map<String, dynamic>> get _availableMapelList =>
      _mapelForKelas(_selectedKelas);

  Map<String, dynamic>? get _selectedMapel {
    for (final item in _availableMapelList) {
      if (item['id'] == _selectedMapelId) return item;
    }
    return null;
  }

  int? get _selectedClassId {
    for (final item in _kelasList) {
      if (item['nama']?.toString() == _selectedKelas) {
        return (item['id'] as num?)?.toInt();
      }
    }
    return null;
  }

  void _showUploadMessage(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: Colors.redAccent,
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  Future<bool> _canUploadNow() async {
    if (_isOfflineMode) {
      _showUploadMessage(
        'Upload materi membutuhkan koneksi server. Data referensi saat ini berasal dari cache.',
      );
      return false;
    }

    final hasConnection = await SyncService.isOnline();
    final serverReady = hasConnection && await ApiService.testConnection();
    if (!mounted) return false;
    if (!serverReady) {
      _showUploadMessage(
        'Server belum terhubung. Sambungkan internet lalu coba upload materi lagi.',
      );
      return false;
    }

    return true;
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
    if (_judulController.text.isEmpty ||
        _selectedKelas == null ||
        _selectedMapel == null ||
        _selectedFile == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Lengkapi semua field dan pilih file'),
          backgroundColor: Colors.redAccent,
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }

    final classId = _selectedClassId;
    final mapelId = _selectedMapelId;
    if (classId == null || classId <= 0) {
      _showUploadMessage(
        'Data kelas belum valid. Muat ulang referensi lalu pilih kelas resmi.',
      );
      return;
    }
    if (mapelId == null || mapelId <= 0) {
      _showUploadMessage(
        'Data mata pelajaran belum valid. Muat ulang referensi lalu pilih mapel resmi.',
      );
      return;
    }
    if (!await _canUploadNow()) {
      return;
    }

    setState(() => _isUploading = true);

    try {
      await ApiService.uploadMateri(
        guruId: _userId,
        kelas: _selectedKelas!,
        classId: classId,
        mapelId: mapelId,
        mapel: _selectedMapel!['nama']?.toString() ?? '',
        judul: _judulController.text.trim(),
        deskripsi: _deskripsiController.text.trim(),
        filePath: _selectedFile!.path,
      );

      await SyncService.notifyDataChanged(
        SyncTopics.materi,
        message: 'Materi baru tersedia untuk kelas $_selectedKelas',
        showNotification: true,
      );

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Materi berhasil diupload'),
          backgroundColor: Color(0xFF138F81),
          behavior: SnackBarBehavior.floating,
        ),
      );
      Navigator.pop(context, true);
    } catch (e) {
      if (!mounted) return;
      setState(() => _isUploading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Gagal upload: $e'),
          backgroundColor: Colors.redAccent,
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
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
                      decoration: const BoxDecoration(
                        shape: BoxShape.circle,
                        color: Color(0xFFFFDC80),
                      ),
                      child: const Icon(
                        Icons.upload_file_rounded,
                        color: Color(0xFF138F81),
                        size: 28,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Upload Materi',
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF2D3436),
                            ),
                          ),
                          Row(
                            children: [
                              const Text(
                                'Unggah materi pelajaran',
                                style: TextStyle(
                                  fontSize: 11,
                                  color: Color(0xFF636E72),
                                ),
                              ),
                              if (_isOfflineMode) ...[
                                const SizedBox(width: 8),
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 8,
                                    vertical: 3,
                                  ),
                                  decoration: BoxDecoration(
                                    color: const Color(
                                      0xFFE65100,
                                    ).withValues(alpha: 0.12),
                                    borderRadius: BorderRadius.circular(999),
                                  ),
                                  child: const Text(
                                    'Offline',
                                    style: TextStyle(
                                      fontSize: 10,
                                      fontWeight: FontWeight.w700,
                                      color: Color(0xFFE65100),
                                    ),
                                  ),
                                ),
                              ],
                            ],
                          ),
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
                  child: _isLoadingReference ? _buildLoading() : _buildForm(),
                ),
              ),
            ),
            const SizedBox(height: 12),
          ],
        ),
      ),
    );
  }

  Widget _buildLoading() {
    return const SizedBox(
      height: 220,
      child: Center(child: CircularProgressIndicator(color: Color(0xFF138F81))),
    );
  }

  Widget _buildForm() {
    if (_kelasList.isEmpty || _mapelList.isEmpty) {
      return Column(
        children: [
          const SizedBox(height: 32),
          const Icon(
            Icons.sync_problem_rounded,
            color: Color(0xFF636E72),
            size: 40,
          ),
          const SizedBox(height: 12),
          const Text(
            'Referensi kelas atau mata pelajaran belum tersedia.',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 13, color: Color(0xFF636E72)),
          ),
          const SizedBox(height: 16),
          ElevatedButton(
            onPressed: _loadReferenceData,
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF138F81),
              foregroundColor: Colors.white,
            ),
            child: const Text('Muat Ulang'),
          ),
        ],
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildLabel('Kelas'),
        _buildKelasDropdown(),
        const SizedBox(height: 14),
        _buildLabel('Mata Pelajaran'),
        _buildMapelDropdown(),
        const SizedBox(height: 14),
        _buildLabel('Judul Materi'),
        _buildTextField(_judulController, 'Contoh: Bab 3 - Sholat Jamaah'),
        const SizedBox(height: 14),
        _buildLabel('Deskripsi (opsional)'),
        _buildTextField(
          _deskripsiController,
          'Penjelasan singkat...',
          maxLines: 3,
        ),
        const SizedBox(height: 14),
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
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2.5,
                      color: Colors.white,
                    ),
                  )
                : const Text(
                    'Upload Materi',
                    style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
                  ),
          ),
        ),
      ],
    );
  }

  Widget _buildLabel(String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Text(
        text,
        style: const TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w700,
          color: Color(0xFF2D3436),
        ),
      ),
    );
  }

  Widget _buildTextField(
    TextEditingController controller,
    String hint, {
    int maxLines = 1,
  }) {
    return TextField(
      controller: controller,
      maxLines: maxLines,
      style: const TextStyle(fontSize: 14),
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: TextStyle(color: Colors.grey[400], fontSize: 13),
        filled: true,
        fillColor: Colors.white,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 14,
          vertical: 12,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide.none,
        ),
      ),
    );
  }

  Widget _buildKelasDropdown() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String>(
          value: _selectedKelas,
          isExpanded: true,
          hint: Text(
            'Pilih kelas...',
            style: TextStyle(color: Colors.grey[400], fontSize: 13),
          ),
          style: const TextStyle(fontSize: 14, color: Color(0xFF2D3436)),
          items: _kelasList
              .map(
                (item) => DropdownMenuItem<String>(
                  value: item['nama']?.toString(),
                  child: Text(item['nama']?.toString() ?? '-'),
                ),
              )
              .toList(),
          onChanged: (value) {
            setState(() {
              _selectedKelas = value;
              _selectedMapelId = _resolveSelectedMapel(
                _selectedMapelId,
                _mapelForKelas(value),
              );
            });
          },
        ),
      ),
    );
  }

  Widget _buildMapelDropdown() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<int>(
          value: _selectedMapelId,
          isExpanded: true,
          hint: Text(
            'Pilih mapel...',
            style: TextStyle(color: Colors.grey[400], fontSize: 13),
          ),
          disabledHint: const Text(
            'Belum ada mapel untuk kelas ini',
            style: TextStyle(fontSize: 13, color: Color(0xFF636E72)),
          ),
          style: const TextStyle(fontSize: 14, color: Color(0xFF2D3436)),
          items: _availableMapelList
              .map(
                (item) => DropdownMenuItem<int>(
                  value: (item['id'] as num?)?.toInt(),
                  child: Text(item['nama']?.toString() ?? '-'),
                ),
              )
              .toList(),
          onChanged: (value) => setState(() => _selectedMapelId = value),
        ),
      ),
    );
  }
}
