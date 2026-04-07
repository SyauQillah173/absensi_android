import 'package:flutter/material.dart';

class EditInformasiScreen extends StatefulWidget {
  final Map<String, String> informasi;

  const EditInformasiScreen({super.key, required this.informasi});

  @override
  State<EditInformasiScreen> createState() => _EditInformasiScreenState();
}

class _EditInformasiScreenState extends State<EditInformasiScreen> {
  late TextEditingController _judulController;
  late TextEditingController _deskripsiController;
  late TextEditingController _isiController;

  @override
  void initState() {
    super.initState();
    _judulController = TextEditingController(
      text: widget.informasi['judul'] ?? '',
    );
    _deskripsiController = TextEditingController(
      text: widget.informasi['deskripsi'] ?? '',
    );
    _isiController = TextEditingController(text: widget.informasi['isi'] ?? '');
  }

  @override
  void dispose() {
    _judulController.dispose();
    _deskripsiController.dispose();
    _isiController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFFDC80),
      appBar: AppBar(
        backgroundColor: const Color(0xFFFFDC80),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.close_rounded, color: Color(0xFF2D3436)),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'Edit Informasi',
          style: TextStyle(
            color: Color(0xFF2D3436),
            fontWeight: FontWeight.w700,
            fontSize: 18,
          ),
        ),
        centerTitle: true,
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 8),
            child: TextButton(
              onPressed: _handleSave,
              child: const Text(
                'Simpan',
                style: TextStyle(
                  color: Color(0xFF138F81),
                  fontWeight: FontWeight.w700,
                  fontSize: 15,
                ),
              ),
            ),
          ),
        ],
      ),
      body: SingleChildScrollView(
        child: Container(
          margin: const EdgeInsets.all(16),
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: const Color(0xFFE1EFF7),
            borderRadius: BorderRadius.circular(30),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Info badge
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 4,
                ),
                decoration: BoxDecoration(
                  color: const Color(0xFF138F81).withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(
                      Icons.edit_note_rounded,
                      size: 16,
                      color: Color(0xFF138F81),
                    ),
                    const SizedBox(width: 4),
                    Text(
                      'Mengedit: ${widget.informasi['judul']}',
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF138F81),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // Judul
              const Text(
                'Judul Informasi',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF2D3436),
                ),
              ),
              const SizedBox(height: 8),
              _buildTextField(_judulController, 'Masukkan judul informasi...'),
              const SizedBox(height: 20),

              // Deskripsi
              const Text(
                'Deskripsi Singkat',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF2D3436),
                ),
              ),
              const SizedBox(height: 8),
              _buildTextField(
                _deskripsiController,
                'Masukkan deskripsi singkat...',
                maxLines: 2,
              ),
              const SizedBox(height: 20),

              // Isi
              const Text(
                'Isi Informasi',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF2D3436),
                ),
              ),
              const SizedBox(height: 8),
              _buildTextField(
                _isiController,
                'Tulis isi informasi lengkap...',
                maxLines: 8,
              ),
              const SizedBox(height: 20),

              // Gambar placeholder
              GestureDetector(
                onTap: () {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: const Text('Fitur upload gambar segera hadir'),
                      behavior: SnackBarBehavior.floating,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                      backgroundColor: const Color(0xFF138F81),
                    ),
                  );
                },
                child: Container(
                  width: double.infinity,
                  height: 120,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(21),
                    border: Border.all(
                      color: const Color(0xFF138F81).withValues(alpha: 0.3),
                      width: 2,
                      strokeAlign: BorderSide.strokeAlignInside,
                    ),
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        Icons.add_photo_alternate_rounded,
                        size: 40,
                        color: Colors.grey[400],
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Ubah Gambar',
                        style: TextStyle(
                          fontSize: 13,
                          color: Colors.grey[500],
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 20),

              // Tanggal
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 14,
                  vertical: 10,
                ),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Row(
                  children: [
                    const Icon(
                      Icons.calendar_today_rounded,
                      size: 18,
                      color: Color(0xFF636E72),
                    ),
                    const SizedBox(width: 10),
                    Text(
                      'Tanggal: ${widget.informasi['tanggal'] ?? '-'}',
                      style: const TextStyle(
                        fontSize: 13,
                        color: Color(0xFF636E72),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTextField(
    TextEditingController controller,
    String hint, {
    int maxLines = 1,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
      ),
      child: TextField(
        controller: controller,
        maxLines: maxLines,
        decoration: InputDecoration(
          hintText: hint,
          hintStyle: TextStyle(color: Colors.grey[400], fontSize: 13),
          border: InputBorder.none,
          contentPadding: const EdgeInsets.all(16),
        ),
      ),
    );
  }

  void _handleSave() {
    if (_judulController.text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('Judul tidak boleh kosong'),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          backgroundColor: Colors.redAccent,
        ),
      );
      return;
    }

    Navigator.pop(context, {
      'judul': _judulController.text,
      'deskripsi': _deskripsiController.text.isEmpty
          ? _judulController.text
          : _deskripsiController.text,
      'tanggal': widget.informasi['tanggal'] ?? '',
    });
  }
}
