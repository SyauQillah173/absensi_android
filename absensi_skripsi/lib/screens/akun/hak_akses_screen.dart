import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../services/api_service.dart';

class HakAksesScreen extends StatefulWidget {
  const HakAksesScreen({super.key});

  @override
  State<HakAksesScreen> createState() => _HakAksesScreenState();
}

class _HakAksesScreenState extends State<HakAksesScreen> {
  static const _defaultRoles = [
    'admin_utama',
    'admin_bendahara',
    'admin_akademik',
    'admin_pondok',
    'admin_absensi',
    'admin_lainnya',
    'guru',
    'wali',
  ];
  static const _actions = {
    'can_create': 'Tambah',
    'can_update': 'Edit',
    'can_delete': 'Hapus',
    'can_approve': 'Approve',
    'can_cancel': 'Batal',
  };

  bool _isLoading = true;
  bool _isSaving = false;
  String _selectedRole = 'admin_bendahara';
  List<String> _roles = List<String>.from(_defaultRoles);
  List<Map<String, dynamic>> _menus = [];
  Map<String, List<Map<String, dynamic>>> _permissions = {};

  bool get _isSelectedRoleReadOnly =>
      _selectedRole == 'admin_utama' || _selectedRole == 'admin';

  @override
  void initState() {
    super.initState();
    _loadPermissions();
  }

  Future<void> _loadPermissions() async {
    setState(() => _isLoading = true);
    try {
      final response = await ApiService.getSettingsPermissions();
      final data = Map<String, dynamic>.from(response['data'] ?? {});
      final rawMenus = List<dynamic>.from(data['menus'] ?? const []);
      final rawRoles = List<dynamic>.from(data['roles'] ?? const []);
      final rawPermissions = Map<String, dynamic>.from(
        data['permissions'] ?? const {},
      );
      final roles = rawRoles
          .map((item) => item.toString())
          .where((role) => role.isNotEmpty)
          .toList();

      setState(() {
        _roles = roles.isEmpty ? List<String>.from(_defaultRoles) : roles;
        if (!_roles.contains(_selectedRole)) {
          _selectedRole = _roles.firstWhere(
            (role) => role != 'admin_utama' && role != 'admin',
            orElse: () => _roles.first,
          );
        }
        _menus = rawMenus
            .map((item) => Map<String, dynamic>.from(item as Map))
            .toList();
        _permissions = {
          for (final role in _roles)
            role: List<dynamic>.from(
              rawPermissions[role] ?? const [],
            ).map((item) => Map<String, dynamic>.from(item as Map)).toList(),
        };
        _isLoading = false;
      });
    } catch (error) {
      setState(() => _isLoading = false);
      _showMessage('Gagal memuat hak akses: $error', isError: true);
    }
  }

  Future<void> _savePermissions() async {
    setState(() => _isSaving = true);
    try {
      final payload = <Map<String, dynamic>>[];
      for (final role in _roles.where(
        (role) => role != 'admin_utama' && role != 'admin',
      )) {
        for (final item in _permissions[role] ?? const []) {
          payload.add({
            'role': role,
            'menu_key': item['key'],
            'is_enabled': item['is_enabled'] == true,
            'can_view': item['can_view'] == true,
            'can_create': item['can_create'] == true,
            'can_update': item['can_update'] == true,
            'can_delete': item['can_delete'] == true,
            'can_approve': item['can_approve'] == true,
            'can_cancel': item['can_cancel'] == true,
          });
        }
      }

      final response = await ApiService.updateSettingsPermissions(payload);
      final data = Map<String, dynamic>.from(response['data'] ?? {});
      final rawPermissions = Map<String, dynamic>.from(
        data['permissions'] ?? const {},
      );

      setState(() {
        _permissions = {
          for (final role in _roles)
            role: List<dynamic>.from(
              rawPermissions[role] ?? const [],
            ).map((item) => Map<String, dynamic>.from(item as Map)).toList(),
        };
        _isSaving = false;
      });
      _showMessage('Hak akses berhasil disimpan');
    } catch (error) {
      setState(() => _isSaving = false);
      _showMessage('Gagal menyimpan hak akses: $error', isError: true);
    }
  }

  void _toggleMenu(Map<String, dynamic> item, bool value) {
    if (_isSelectedRoleReadOnly) return;
    setState(() {
      item['is_enabled'] = value;
      item['can_view'] = value;
      if (!value) {
        for (final key in _actions.keys) {
          item[key] = false;
        }
      }
    });
  }

  void _toggleAction(Map<String, dynamic> item, String key, bool value) {
    if (_isSelectedRoleReadOnly) return;
    setState(() {
      item[key] = value;
      if (value) {
        item['is_enabled'] = true;
        item['can_view'] = true;
      }
    });
  }

  void _showMessage(String message, {bool isError = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: isError
            ? const Color(0xFFE74C3C)
            : const Color(0xFF138F81),
      ),
    );
  }

  List<Map<String, dynamic>> get _rolePermissions {
    final items = _permissions[_selectedRole] ?? const [];
    if (items.isNotEmpty) return items;

    return _menus
        .map(
          (menu) => {
            ...menu,
            'can_view': _isSelectedRoleReadOnly,
            'can_create': _isSelectedRoleReadOnly,
            'can_update': _isSelectedRoleReadOnly,
            'can_delete': _isSelectedRoleReadOnly,
            'can_approve': _isSelectedRoleReadOnly,
            'can_cancel': _isSelectedRoleReadOnly,
            'is_enabled': _isSelectedRoleReadOnly,
            'locked': _isSelectedRoleReadOnly,
          },
        )
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    final isAdminReadonly = _isSelectedRoleReadOnly;

    return Scaffold(
      backgroundColor: const Color(0xFFFFDC80),
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(),
            const SizedBox(height: 10),
            Expanded(
              child: Container(
                margin: const EdgeInsets.symmetric(horizontal: 16),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFFE1EFF7),
                  borderRadius: BorderRadius.circular(30),
                ),
                child: _isLoading
                    ? const Center(
                        child: CircularProgressIndicator(
                          color: Color(0xFF138F81),
                        ),
                      )
                    : Column(
                        children: [
                          _buildRoleSelector(),
                          if (isAdminReadonly) _buildAdminNotice(),
                          const SizedBox(height: 12),
                          Expanded(
                            child: ListView.separated(
                              physics: const BouncingScrollPhysics(),
                              itemBuilder: (context, index) {
                                return _buildPermissionCard(
                                  _rolePermissions[index],
                                  isAdminReadonly,
                                );
                              },
                              separatorBuilder: (context, index) =>
                                  const SizedBox(height: 10),
                              itemCount: _rolePermissions.length,
                            ),
                          ),
                        ],
                      ),
              ),
            ),
            if (!_isSelectedRoleReadOnly) _buildSaveButton(),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: const Color(0xFFE1EFF7),
          borderRadius: BorderRadius.circular(28),
        ),
        child: Row(
          children: [
            Container(
              width: 52,
              height: 52,
              decoration: BoxDecoration(
                color: const Color(0xFFFFDC80),
                borderRadius: BorderRadius.circular(18),
              ),
              child: const Icon(
                Icons.admin_panel_settings_rounded,
                color: Color(0xFF138F81),
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Text(
                'Hak Akses Menu',
                style: GoogleFonts.poppins(
                  fontSize: 22,
                  fontWeight: FontWeight.w700,
                  color: const Color(0xFF2D3436),
                ),
              ),
            ),
            IconButton(
              onPressed: () => Navigator.pop(context),
              icon: const Icon(Icons.close_rounded, size: 30),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildRoleSelector() {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: _roles.map((role) {
          final selected = role == _selectedRole;
          final label = _roleLabel(role);
          return Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4),
            child: InkWell(
              onTap: () => setState(() => _selectedRole = role),
              borderRadius: BorderRadius.circular(16),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 180),
                padding: const EdgeInsets.symmetric(
                  horizontal: 14,
                  vertical: 12,
                ),
                decoration: BoxDecoration(
                  color: selected ? const Color(0xFF138F81) : Colors.white,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Text(
                  label,
                  textAlign: TextAlign.center,
                  style: GoogleFonts.poppins(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: selected ? Colors.white : const Color(0xFF636E72),
                  ),
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  String _roleLabel(String role) {
    switch (role) {
      case 'admin':
      case 'admin_utama':
        return 'Admin Utama';
      case 'admin_bendahara':
        return 'Bendahara';
      case 'admin_akademik':
        return 'Akademik';
      case 'admin_pondok':
        return 'Pondok';
      case 'admin_absensi':
        return 'Absensi';
      case 'admin_lainnya':
        return 'Admin Lain';
      case 'guru':
        return 'Guru';
      case 'wali':
        return 'Wali';
      default:
        return role;
    }
  }

  Widget _buildAdminNotice() {
    return Container(
      margin: const EdgeInsets.only(top: 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFBDE3DD)),
      ),
      child: Row(
        children: [
          const Icon(Icons.lock_rounded, color: Color(0xFF138F81), size: 20),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              'Admin Utama selalu full access. Admin lain seperti Bendahara, Pondok, dan Absensi diatur dari hak akses ini.',
              style: GoogleFonts.poppins(
                fontSize: 11,
                color: const Color(0xFF636E72),
                height: 1.35,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPermissionCard(Map<String, dynamic> item, bool readOnly) {
    final enabled = item['is_enabled'] == true && item['can_view'] == true;

    return Container(
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
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: const Color(0xFFE1EFF7),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(
                  readOnly
                      ? Icons.verified_user_rounded
                      : Icons.widgets_rounded,
                  color: const Color(0xFF138F81),
                  size: 22,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item['label']?.toString() ??
                          item['key']?.toString() ??
                          '-',
                      style: GoogleFonts.poppins(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: const Color(0xFF2D3436),
                      ),
                    ),
                    Text(
                      item['key']?.toString() ?? '-',
                      style: GoogleFonts.poppins(
                        fontSize: 10,
                        color: const Color(0xFF636E72),
                      ),
                    ),
                  ],
                ),
              ),
              Switch.adaptive(
                value: enabled,
                activeThumbColor: const Color(0xFF138F81),
                activeTrackColor: const Color(0xFFBDE3DD),
                onChanged: readOnly
                    ? null
                    : (value) => _toggleMenu(item, value),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: _actions.entries.map((entry) {
              final active = item[entry.key] == true;
              return FilterChip(
                selected: active,
                showCheckmark: false,
                label: Text(entry.value),
                onSelected: readOnly
                    ? null
                    : (value) => _toggleAction(item, entry.key, value),
                selectedColor: const Color(0xFF138F81),
                backgroundColor: const Color(0xFFF7FBFD),
                side: BorderSide(
                  color: active
                      ? const Color(0xFF138F81)
                      : const Color(0xFFDFE6E9),
                ),
                labelStyle: GoogleFonts.poppins(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: active ? Colors.white : const Color(0xFF636E72),
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }

  Widget _buildSaveButton() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 14),
      child: SizedBox(
        width: double.infinity,
        height: 58,
        child: ElevatedButton.icon(
          onPressed: _isSaving ? null : _savePermissions,
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFF138F81),
            disabledBackgroundColor: const Color(0xFF8BBDB6),
            foregroundColor: Colors.white,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(20),
            ),
            elevation: 4,
          ),
          icon: _isSaving
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: Colors.white,
                  ),
                )
              : const Icon(Icons.save_rounded),
          label: Text(
            _isSaving ? 'Menyimpan...' : 'Simpan Hak Akses',
            style: GoogleFonts.poppins(
              fontSize: 15,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
      ),
    );
  }
}
