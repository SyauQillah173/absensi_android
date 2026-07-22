import 'package:flutter/material.dart';

import '../../services/api_service.dart';
import '../../services/excel_import_service.dart';
import '../../services/sync_service.dart';

class EditUserScreen extends StatefulWidget {
  final Map<String, dynamic>? user;
  final bool allowRoleEdit;
  final bool showGuruFields;
  final String title;
  final String subtitle;
  final IconData icon;
  final Color accentColor;
  final String? lockedRole;

  const EditUserScreen({
    super.key,
    this.user,
    required this.allowRoleEdit,
    required this.showGuruFields,
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.accentColor,
    this.lockedRole,
  });

  bool get isCreateMode => user == null;

  @override
  State<EditUserScreen> createState() => _EditUserScreenState();
}

class _EditUserScreenState extends State<EditUserScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _nameController;
  late final TextEditingController _emailController;
  late final TextEditingController _nisController;
  late final TextEditingController _nisnController;
  late final TextEditingController _phoneController;
  late final TextEditingController _nikController;
  late final TextEditingController _passwordController;
  late final TextEditingController _kodeGuruController;
  late final TextEditingController _alamatController;

  String _gender = '';
  String _role = 'guru';
  String _adminType = 'utama';
  String _status = 'Aktif';
  bool _isSaving = false;
  List<String> _selectedUnits = [];
  List<String> _selectedGuruCategories = [];
  List<String> _schoolUnitOptions = ExcelImportService.schoolUnitOptions;
  List<String> _guruCategoryOptions = ExcelImportService.guruCategoryOptions;

  bool get _shouldShowGuruFields =>
      widget.showGuruFields || _role == 'guru' || widget.lockedRole == 'guru';

  @override
  void initState() {
    super.initState();
    final user = widget.user ?? <String, dynamic>{};
    _nameController = TextEditingController(
      text: user['name']?.toString() ?? '',
    );
    _emailController = TextEditingController(
      text: user['email']?.toString() ?? '',
    );
    _nisController = TextEditingController(text: user['nis']?.toString() ?? '');
    _nisnController = TextEditingController(
      text: user['nisn']?.toString() ?? '',
    );
    _phoneController = TextEditingController(
      text: user['no_hp']?.toString() ?? '',
    );
    _nikController = TextEditingController(
      text: user['nik_user']?.toString() ?? '',
    );
    _passwordController = TextEditingController();
    _kodeGuruController = TextEditingController(
      text: user['kode_guru']?.toString() ?? user['nis']?.toString() ?? '',
    );
    _alamatController = TextEditingController(
      text: user['alamat']?.toString() ?? '',
    );
    _gender = user['jenis_kelamin']?.toString() ?? '';
    _role =
        widget.lockedRole ??
        user['role']?.toString() ??
        (widget.showGuruFields ? 'guru' : 'admin');
    final adminType = user['admin_type']?.toString() ?? '';
    _adminType = adminType.isNotEmpty ? adminType : 'utama';
    _status = user['status']?.toString() ?? 'Aktif';
    _selectedUnits = List<String>.from(user['unit_kerja'] ?? const []);
    _selectedGuruCategories = List<String>.from(
      user['kategori_guru'] ?? const [],
    );
    _loadTeacherMasters();
  }

  Future<void> _loadTeacherMasters() async {
    try {
      final results = await Future.wait([
        ApiService.getReferenceMaster('teacher_units'),
        ApiService.getReferenceMaster('teacher_categories'),
      ]);
      if (!mounted) return;
      final unitOptions = _masterNames(results[0]);
      final categoryOptions = _masterCodesOrNames(results[1]);
      setState(() {
        _schoolUnitOptions = unitOptions.isEmpty
            ? ExcelImportService.schoolUnitOptions
            : unitOptions;
        _guruCategoryOptions = categoryOptions.isEmpty
            ? ExcelImportService.guruCategoryOptions
            : categoryOptions;
        _selectedUnits = _canonicalSelected(_selectedUnits, _schoolUnitOptions);
        _selectedGuruCategories = _canonicalSelected(
          _selectedGuruCategories,
          _guruCategoryOptions,
        );
      });
    } catch (_) {}
  }

  List<String> _masterNames(Map<String, dynamic> result) {
    final data = result['data'];
    if (data is! List) return const [];
    return data
        .whereType<Map>()
        .map((item) => item['name']?.toString().trim() ?? '')
        .where((name) => name.isNotEmpty)
        .toList();
  }

  List<String> _masterCodesOrNames(Map<String, dynamic> result) {
    final data = result['data'];
    if (data is! List) return const [];
    return data
        .whereType<Map>()
        .map((item) {
          final code = item['code']?.toString().trim() ?? '';
          return code.isNotEmpty ? code : item['name']?.toString().trim() ?? '';
        })
        .where((value) => value.isNotEmpty)
        .toList();
  }

  List<String> _canonicalSelected(List<String> selected, List<String> options) {
    final byLower = {
      for (final option in options) option.toLowerCase(): option,
    };
    return selected
        .map((value) => byLower[value.toLowerCase()] ?? value)
        .where((value) => options.contains(value))
        .toSet()
        .toList();
  }

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _nisController.dispose();
    _nisnController.dispose();
    _phoneController.dispose();
    _nikController.dispose();
    _passwordController.dispose();
    _kodeGuruController.dispose();
    _alamatController.dispose();
    super.dispose();
  }

  Future<void> _handleSave() async {
    if (_isSaving) return;
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isSaving = true);

    try {
      final payload = <String, dynamic>{
        'name': _nameController.text.trim(),
        'email': _emailController.text.trim(),
        'nis': _nisController.text.trim(),
        'nisn': _nisnController.text.trim(),
        'no_hp': _phoneController.text.trim(),
        'nik_user': _nikController.text.trim(),
        'jenis_kelamin': _gender,
        'status': _status,
        'alamat': _alamatController.text.trim(),
      };

      if (widget.allowRoleEdit) {
        payload['role'] = _role;
      } else if (widget.lockedRole != null) {
        payload['role'] = widget.lockedRole;
      }
      final payloadRole = payload['role']?.toString() ?? _role;
      if (payloadRole == 'admin') {
        payload['admin_type'] = _adminType;
      }

      if (_passwordController.text.trim().isNotEmpty) {
        payload['password'] = _passwordController.text.trim();
      }

      if (_shouldShowGuruFields) {
        payload['kode_guru'] = _kodeGuruController.text.trim();
        payload['unit_kerja'] = _selectedUnits;
        payload['kategori_guru'] = _selectedGuruCategories;
      }

      if (widget.isCreateMode) {
        await ApiService.createUser(payload);
      } else {
        await ApiService.updateUser(widget.user!['id'] as int, payload);
      }

      await SyncService.notifyDataChanged(
        SyncTopics.user,
        message: widget.isCreateMode
            ? '${widget.title} berhasil ditambahkan'
            : '${widget.title} berhasil diperbarui',
      );
      await SyncService.notifyDataChanged(
        SyncTopics.profile,
        message: 'Profil pengguna diperbarui',
      );

      if (!mounted) return;
      Navigator.pop(context, true);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            widget.isCreateMode
                ? '${widget.title} berhasil ditambahkan'
                : '${widget.title} berhasil diperbarui',
          ),
          backgroundColor: widget.accentColor,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
        ),
      );
    } catch (e) {
      _showSnackBar('Gagal menyimpan: $e', isError: true);
    } finally {
      if (mounted) {
        setState(() => _isSaving = false);
      }
    }
  }

  void _showSnackBar(String message, {bool isError = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: isError ? const Color(0xFFE65100) : widget.accentColor,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }

  void _toggleMultiValue(List<String> target, String value) {
    setState(() {
      if (target.contains(value)) {
        target.remove(value);
      } else {
        target.add(value);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFFDC80),
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(),
            const SizedBox(height: 12),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                physics: const BouncingScrollPhysics(),
                child: Form(
                  key: _formKey,
                  child: Column(
                    children: [
                      _buildSection(
                        title: 'Data Utama',
                        children: [
                          _buildTextField(
                            controller: _nameController,
                            label: 'Nama Lengkap',
                            icon: Icons.person_rounded,
                            validator: (value) {
                              if (value == null || value.trim().isEmpty) {
                                return 'Nama wajib diisi';
                              }
                              return null;
                            },
                          ),
                          _buildTextField(
                            controller: _emailController,
                            label: 'Email',
                            icon: Icons.mail_rounded,
                            keyboardType: TextInputType.emailAddress,
                            validator: (value) {
                              if (value == null || value.trim().isEmpty) {
                                return 'Email wajib diisi';
                              }
                              if (!value.contains('@')) {
                                return 'Format email tidak valid';
                              }
                              return null;
                            },
                          ),
                          _buildTextField(
                            controller: _phoneController,
                            label: 'No. HP',
                            icon: Icons.phone_rounded,
                            keyboardType: TextInputType.phone,
                            validator: (value) {
                              if (value == null || value.trim().isEmpty) {
                                return 'No. HP wajib diisi';
                              }
                              return null;
                            },
                          ),
                          _buildTextField(
                            controller: _nisController,
                            label: _shouldShowGuruFields
                                ? 'NIS / Username Login (Opsional)'
                                : 'NIS / Username (Opsional)',
                            icon: Icons.badge_rounded,
                          ),
                          _buildTextField(
                            controller: _nisnController,
                            label: 'NISN (Opsional)',
                            icon: Icons.confirmation_number_rounded,
                          ),
                          _buildTextField(
                            controller: _nikController,
                            label: 'NIK User (Opsional)',
                            icon: Icons.credit_card_rounded,
                            keyboardType: TextInputType.number,
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      _buildSection(
                        title: 'Akses Akun',
                        children: [
                          _buildDropdownField(
                            label: 'Jenis Kelamin',
                            icon: Icons.wc_rounded,
                            value: _gender,
                            items: const [
                              DropdownMenuItem(
                                value: '',
                                child: Text('Belum dipilih'),
                              ),
                              DropdownMenuItem(
                                value: 'L',
                                child: Text('Laki-laki'),
                              ),
                              DropdownMenuItem(
                                value: 'P',
                                child: Text('Perempuan'),
                              ),
                            ],
                            onChanged: (value) =>
                                setState(() => _gender = value ?? ''),
                          ),
                          if (widget.allowRoleEdit)
                            _buildDropdownField(
                              label: 'Role / Hak Akses',
                              icon: Icons.admin_panel_settings_rounded,
                              value: _role,
                              items: const [
                                DropdownMenuItem(
                                  value: 'admin',
                                  child: Text('Admin'),
                                ),
                                DropdownMenuItem(
                                  value: 'guru',
                                  child: Text('Guru'),
                                ),
                                DropdownMenuItem(
                                  value: 'kepala_sekolah',
                                  child: Text('Kepala Sekolah'),
                                ),
                              ],
                              onChanged: (value) => setState(() {
                                _role = value ?? _role;
                                if (_role == 'admin' &&
                                    _adminType.trim().isEmpty) {
                                  _adminType = 'utama';
                                }
                              }),
                            )
                          else
                            _buildLockedRoleCard(),
                          if (_role == 'admin' ||
                              widget.lockedRole == 'admin') ...[
                            const SizedBox(height: 10),
                            _buildDropdownField(
                              label: 'Tipe Admin',
                              icon: Icons.verified_user_rounded,
                              value: _adminType,
                              items: const [
                                DropdownMenuItem(
                                  value: 'utama',
                                  child: Text('Admin Utama'),
                                ),
                                DropdownMenuItem(
                                  value: 'bendahara',
                                  child: Text('Admin Bendahara'),
                                ),
                                DropdownMenuItem(
                                  value: 'akademik',
                                  child: Text('Admin Akademik'),
                                ),
                                DropdownMenuItem(
                                  value: 'pondok',
                                  child: Text('Admin Pondok'),
                                ),
                                DropdownMenuItem(
                                  value: 'absensi',
                                  child: Text('Admin Absensi'),
                                ),
                                DropdownMenuItem(
                                  value: 'lainnya',
                                  child: Text('Admin Lainnya'),
                                ),
                              ],
                              onChanged: (value) =>
                                  setState(() => _adminType = value ?? 'utama'),
                            ),
                          ],
                          _buildDropdownField(
                            label: 'Status Akun',
                            icon: Icons.toggle_on_rounded,
                            value: _status,
                            items: const [
                              DropdownMenuItem(
                                value: 'Aktif',
                                child: Text('Aktif'),
                              ),
                              DropdownMenuItem(
                                value: 'Nonaktif',
                                child: Text('Nonaktif'),
                              ),
                            ],
                            onChanged: (value) =>
                                setState(() => _status = value ?? 'Aktif'),
                          ),
                          _buildTextField(
                            controller: _passwordController,
                            label: widget.isCreateMode
                                ? 'Password'
                                : 'Password Baru (Opsional)',
                            icon: Icons.lock_rounded,
                            obscureText: true,
                            helperText: widget.isCreateMode
                                ? 'Minimal 6 karakter.'
                                : 'Kosongkan jika tidak ingin mengubah password.',
                            validator: (value) {
                              if (widget.isCreateMode &&
                                  (value == null || value.trim().length < 6)) {
                                return 'Password minimal 6 karakter';
                              }
                              return null;
                            },
                          ),
                        ],
                      ),
                      if (_shouldShowGuruFields) ...[
                        const SizedBox(height: 12),
                        _buildSection(
                          title: 'Data Guru',
                          children: [
                            _buildTextField(
                              controller: _kodeGuruController,
                              label: 'Kode Guru / Kode Lokal',
                              icon: Icons.qr_code_rounded,
                              validator: (value) {
                                if (value == null || value.trim().isEmpty) {
                                  return 'Kode guru wajib diisi';
                                }
                                return null;
                              },
                            ),
                            _buildTextField(
                              controller: _alamatController,
                              label: 'Alamat',
                              icon: Icons.location_on_rounded,
                              maxLines: 2,
                            ),
                            _buildMultiSelectChips(
                              title: 'Unit Sekolah Mengajar',
                              icon: Icons.apartment_rounded,
                              values: _schoolUnitOptions,
                              selectedValues: _selectedUnits,
                              onToggle: (value) =>
                                  _toggleMultiValue(_selectedUnits, value),
                            ),
                            const SizedBox(height: 10),
                            _buildMultiSelectChips(
                              title: 'Status Sebagai',
                              icon: Icons.workspaces_rounded,
                              values: _guruCategoryOptions,
                              selectedValues: _selectedGuruCategories,
                              onToggle: (value) => _toggleMultiValue(
                                _selectedGuruCategories,
                                value,
                              ),
                            ),
                          ],
                        ),
                      ],
                      const SizedBox(height: 16),
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton.icon(
                          onPressed: _isSaving ? null : _handleSave,
                          icon: _isSaving
                              ? const SizedBox(
                                  width: 18,
                                  height: 18,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color: Colors.white,
                                  ),
                                )
                              : Icon(
                                  widget.isCreateMode
                                      ? Icons.person_add_alt_1_rounded
                                      : Icons.save_rounded,
                                ),
                          label: Text(
                            _isSaving
                                ? 'Menyimpan...'
                                : widget.isCreateMode
                                ? 'Simpan Data Baru'
                                : 'Simpan Perubahan',
                          ),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: widget.accentColor,
                            foregroundColor: Colors.white,
                            disabledBackgroundColor: widget.accentColor
                                .withValues(alpha: 0.45),
                            padding: const EdgeInsets.symmetric(vertical: 16),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(18),
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

  Widget _buildHeader() {
    final status = _status;
    final isActive = status == 'Aktif';

    return Padding(
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
              width: 50,
              height: 50,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: widget.accentColor.withValues(alpha: 0.15),
              ),
              child: Icon(widget.icon, color: widget.accentColor, size: 26),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    widget.title,
                    style: const TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF2D3436),
                    ),
                  ),
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          widget.subtitle,
                          style: const TextStyle(
                            fontSize: 11,
                            color: Color(0xFF636E72),
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 3,
                        ),
                        decoration: BoxDecoration(
                          color:
                              (isActive
                                      ? widget.accentColor
                                      : const Color(0xFFE65100))
                                  .withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          status,
                          style: TextStyle(
                            fontSize: 9,
                            fontWeight: FontWeight.w700,
                            color: isActive
                                ? widget.accentColor
                                : const Color(0xFFE65100),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            IconButton(
              onPressed: () => Navigator.pop(context),
              icon: const Icon(Icons.arrow_back_ios_rounded, size: 20),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSection({
    required String title,
    required List<Widget> children,
  }) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(22),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: widget.accentColor,
            ),
          ),
          const SizedBox(height: 12),
          ...children,
        ],
      ),
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String label,
    required IconData icon,
    TextInputType? keyboardType,
    bool obscureText = false,
    String? helperText,
    String? Function(String?)? validator,
    int maxLines = 1,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: TextFormField(
        controller: controller,
        keyboardType: keyboardType,
        obscureText: obscureText,
        validator: validator,
        maxLines: obscureText ? 1 : maxLines,
        decoration: InputDecoration(
          labelText: label,
          helperText: helperText,
          prefixIcon: Icon(icon, color: widget.accentColor, size: 20),
          filled: true,
          fillColor: const Color(0xFFF8FBFD),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(16),
            borderSide: BorderSide.none,
          ),
          contentPadding: const EdgeInsets.symmetric(
            horizontal: 16,
            vertical: 14,
          ),
        ),
      ),
    );
  }

  Widget _buildDropdownField({
    required String label,
    required IconData icon,
    required String value,
    required List<DropdownMenuItem<String>> items,
    required ValueChanged<String?> onChanged,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: DropdownButtonFormField<String>(
        initialValue: value,
        items: items,
        onChanged: onChanged,
        decoration: InputDecoration(
          labelText: label,
          prefixIcon: Icon(icon, color: widget.accentColor, size: 20),
          filled: true,
          fillColor: const Color(0xFFF8FBFD),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(16),
            borderSide: BorderSide.none,
          ),
          contentPadding: const EdgeInsets.symmetric(
            horizontal: 16,
            vertical: 14,
          ),
        ),
      ),
    );
  }

  Widget _buildLockedRoleCard() {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FBFD),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          Icon(Icons.school_rounded, color: widget.accentColor, size: 20),
          const SizedBox(width: 10),
          const Expanded(
            child: Text(
              'Role dikunci dari form ini',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: Color(0xFF2D3436),
              ),
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: widget.accentColor.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              _role.toUpperCase(),
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w700,
                color: widget.accentColor,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMultiSelectChips({
    required String title,
    required IconData icon,
    required List<String> values,
    required List<String> selectedValues,
    required ValueChanged<String> onToggle,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(icon, size: 18, color: widget.accentColor),
            const SizedBox(width: 8),
            Text(
              title,
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: Color(0xFF2D3436),
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: values.map((value) {
            final isSelected = selectedValues.contains(value);
            return GestureDetector(
              onTap: () => onToggle(value),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 180),
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 9,
                ),
                decoration: BoxDecoration(
                  color: isSelected
                      ? widget.accentColor
                      : const Color(0xFFF8FBFD),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Text(
                  value,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: isSelected ? Colors.white : const Color(0xFF2D3436),
                  ),
                ),
              ),
            );
          }).toList(),
        ),
      ],
    );
  }
}
