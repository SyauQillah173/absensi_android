import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../services/api_service.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _identifierController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscurePassword = true;
  bool _isLoading = false;
  String? _errorMessage;
  String? _loadingHint; // Hint text during loading

  @override
  void dispose() {
    _identifierController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  void _handleLogin() async {
    final identifier = _identifierController.text.trim();
    final password = _passwordController.text.trim();

    // Validate
    if (identifier.isEmpty || password.isEmpty) {
      setState(() {
        _errorMessage = 'Username/Email/NIS dan Password wajib diisi';
      });
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
      _loadingHint = 'Mencoba koneksi ke server...';
    });

    // === RACE CONDITION: API login vs 3 second timeout ===
    // Jika API belum response dalam 3 detik, langsung fallback ke offline
    try {
      final result = await Future.any([
        // Attempt 1: Online login
        ApiService.login(identifier, password),
        // Attempt 2: 3 second timeout → throw TimeoutException
        Future.delayed(const Duration(seconds: 3), () {
          throw TimeoutException('Server tidak merespon dalam 3 detik');
        }),
      ]);

      if (!mounted) return;

      if (result['success'] == true) {
        // === ONLINE LOGIN BERHASIL ===
        final prefs = await SharedPreferences.getInstance();
        final userData = result['data'];
        await prefs.setString('user_name', userData['name'] ?? '');
        await prefs.setString('user_email', userData['email'] ?? '');
        await prefs.setString('user_role', userData['role'] ?? '');
        await prefs.setInt('user_id', userData['id'] ?? 0);
        await prefs.setBool('is_logged_in', true);

        // === WALI: Simpan data anak ===
        if (userData['role'] == 'wali' && userData['anak'] != null) {
          await prefs.setString('anak_list', jsonEncode(userData['anak']));
          // Set anak pertama sebagai default active child
          final anakList = List<Map<String, dynamic>>.from(
            (userData['anak'] as List).map((a) => Map<String, dynamic>.from(a)),
          );
          if (anakList.isNotEmpty) {
            await prefs.setInt('active_siswa_id', anakList.first['id'] ?? 0);
            await prefs.setString(
              'active_siswa_nama',
              anakList.first['nama'] ?? '',
            );
          }
        }

        // === SIMPAN KE DAFTAR AKUN OFFLINE (MULTI-ACCOUNT) ===
        // Semua akun yang pernah login online tersimpan di sini
        // Admin, Guru, DAN Wali bisa login offline secara bersamaan
        final accountsJson = prefs.getString('offline_accounts') ?? '[]';
        final accounts = List<Map<String, dynamic>>.from(
          (jsonDecode(accountsJson) as List).map(
            (a) => Map<String, dynamic>.from(a),
          ),
        );

        // Hapus akun lama dengan identifier sama (update data terbaru)
        accounts.removeWhere((a) => a['identifier'] == identifier);

        // Tambah akun dengan data terbaru
        final accountData = {
          'identifier': identifier,
          'pw_hash': password.hashCode.toString(),
          'name': userData['name'] ?? '',
          'email': userData['email'] ?? '',
          'role': userData['role'] ?? '',
          'id': userData['id'] ?? 0,
        };
        // Simpan anak data di offline account juga
        if (userData['role'] == 'wali' && userData['anak'] != null) {
          accountData['anak'] = userData['anak'];
        }
        accounts.add(accountData);

        await prefs.setString('offline_accounts', jsonEncode(accounts));

        if (mounted) {
          Navigator.pushReplacementNamed(context, '/dashboard');
        }
      } else {
        setState(() {
          _errorMessage = result['message'] ?? 'Login gagal';
          _isLoading = false;
          _loadingHint = null;
        });
      }
    } catch (e) {
      // Server timeout/gagal → langsung coba offline login (CEPAT)
      if (mounted) {
        setState(
          () => _loadingHint = 'Server tidak tersedia, mencoba offline...',
        );
        await _tryOfflineLogin(identifier, password);
      }
    }
  }

  Future<void> _tryOfflineLogin(String identifier, String password) async {
    final prefs = await SharedPreferences.getInstance();

    // === MULTI-ACCOUNT OFFLINE LOGIN ===
    // Cek di daftar semua akun yang pernah login online
    final accountsJson = prefs.getString('offline_accounts') ?? '[]';
    final accounts = List<Map<String, dynamic>>.from(
      (jsonDecode(accountsJson) as List).map(
        (a) => Map<String, dynamic>.from(a),
      ),
    );

    // Cari akun yang cocok
    Map<String, dynamic>? matchedAccount;
    for (final account in accounts) {
      if (account['identifier'] == identifier &&
          account['pw_hash'] == password.hashCode.toString()) {
        matchedAccount = account;
        break;
      }
    }

    if (matchedAccount != null) {
      // === OFFLINE LOGIN BERHASIL ===
      // Set user data dari cached account
      await prefs.setString('user_name', matchedAccount['name'] ?? '');
      await prefs.setString('user_email', matchedAccount['email'] ?? '');
      await prefs.setString('user_role', matchedAccount['role'] ?? '');
      await prefs.setInt('user_id', matchedAccount['id'] ?? 0);
      await prefs.setBool('is_logged_in', true);

      // === WALI: Restore anak data dari offline cache ===
      if (matchedAccount['role'] == 'wali' && matchedAccount['anak'] != null) {
        await prefs.setString('anak_list', jsonEncode(matchedAccount['anak']));
        final anakList = List<Map<String, dynamic>>.from(
          (matchedAccount['anak'] as List).map(
            (a) => Map<String, dynamic>.from(a),
          ),
        );
        if (anakList.isNotEmpty) {
          await prefs.setInt('active_siswa_id', anakList.first['id'] ?? 0);
          await prefs.setString(
            'active_siswa_nama',
            anakList.first['nama'] ?? '',
          );
        }
      }

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              '📶 Login offline — ${matchedAccount['role']} (${matchedAccount['name']})',
            ),
            backgroundColor: const Color(0xFFE65100),
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
            duration: const Duration(seconds: 3),
          ),
        );
        Navigator.pushReplacementNamed(context, '/dashboard');
      }
    } else {
      // Akun tidak ditemukan di daftar offline
      final hasAccounts = accounts.isNotEmpty;
      final savedNames = accounts
          .map((a) => '${a['role']}: ${a['identifier']}')
          .join('\n');
      setState(() {
        _errorMessage = hasAccounts
            ? 'Akun tidak ditemukan offline.\n\nAkun tersimpan:\n$savedNames'
            : 'Belum pernah login online.\nLogin online minimal 1x dulu.';
        _isLoading = false;
        _loadingHint = null;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFFDC80),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            child: Container(
              width: double.infinity,
              margin: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 30),
              decoration: BoxDecoration(
                color: const Color(0xFFE1EFF7),
                borderRadius: BorderRadius.circular(50),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Logo circle
                  Container(
                    width: 100,
                    height: 100,
                    decoration: const BoxDecoration(
                      shape: BoxShape.circle,
                      color: Colors.white,
                    ),
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: Image.asset(
                        'assets/images/Logo_Qomaruddin.png',
                        fit: BoxFit.contain,
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),

                  // Title text
                  const Text(
                    'Masuk Dan Mari Catat Semua\nKegiatanmu',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF2D3436),
                      height: 1.4,
                    ),
                  ),
                  const SizedBox(height: 28),

                  // Error message
                  if (_errorMessage != null) ...[
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 10,
                      ),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFFF3E0),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: const Color(0xFFFFB74D)),
                      ),
                      child: Text(
                        _errorMessage!,
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFFE65100),
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                  ],

                  // Username/Email/NIS field
                  Container(
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(30),
                    ),
                    child: TextField(
                      controller: _identifierController,
                      decoration: InputDecoration(
                        hintText: 'Username / Email / NIS / NISN',
                        hintStyle: TextStyle(
                          color: Colors.grey[500],
                          fontSize: 13,
                        ),
                        prefixIcon: Padding(
                          padding: const EdgeInsets.all(10),
                          child: Image.asset(
                            'assets/images/Username.png',
                            width: 28,
                            height: 28,
                          ),
                        ),
                        border: InputBorder.none,
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 20,
                          vertical: 16,
                        ),
                      ),
                      onSubmitted: (_) => _handleLogin(),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Password field
                  Container(
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(30),
                    ),
                    child: TextField(
                      controller: _passwordController,
                      obscureText: _obscurePassword,
                      decoration: InputDecoration(
                        hintText: 'Sandi/password',
                        hintStyle: TextStyle(
                          color: Colors.grey[500],
                          fontSize: 14,
                        ),
                        prefixIcon: Padding(
                          padding: const EdgeInsets.all(10),
                          child: Image.asset(
                            'assets/images/sandi.png',
                            width: 28,
                            height: 28,
                          ),
                        ),
                        suffixIcon: IconButton(
                          onPressed: () {
                            setState(() {
                              _obscurePassword = !_obscurePassword;
                            });
                          },
                          icon: Icon(
                            _obscurePassword
                                ? Icons.visibility_off_rounded
                                : Icons.visibility_rounded,
                            color: Colors.grey[600],
                            size: 22,
                          ),
                        ),
                        border: InputBorder.none,
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 20,
                          vertical: 16,
                        ),
                      ),
                      onSubmitted: (_) => _handleLogin(),
                    ),
                  ),
                  const SizedBox(height: 10),

                  // Forgot Password
                  Align(
                    alignment: Alignment.centerRight,
                    child: TextButton(
                      onPressed: () {
                        // TODO: Implement forgot password
                      },
                      child: const Text(
                        'Forgot Password ?',
                        style: TextStyle(
                          color: Color(0xFF138F81),
                          fontSize: 13,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Login button
                  SizedBox(
                    width: double.infinity,
                    height: 52,
                    child: ElevatedButton(
                      onPressed: _isLoading ? null : _handleLogin,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFFFDC80),
                        foregroundColor: const Color(0xFF2D3436),
                        disabledBackgroundColor: const Color(
                          0xFFFFDC80,
                        ).withValues(alpha: 0.5),
                        elevation: 3,
                        shadowColor: Colors.black.withValues(alpha: 0.15),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(30),
                        ),
                      ),
                      child: _isLoading
                          ? Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                const SizedBox(
                                  width: 22,
                                  height: 22,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2.5,
                                    color: Color(0xFF2D3436),
                                  ),
                                ),
                                if (_loadingHint != null) ...[
                                  const SizedBox(height: 4),
                                  Text(
                                    _loadingHint!,
                                    style: const TextStyle(
                                      fontSize: 9,
                                      color: Color(0xFF636E72),
                                    ),
                                  ),
                                ],
                              ],
                            )
                          : const Text(
                              'Login',
                              style: TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w600,
                                letterSpacing: 0.3,
                              ),
                            ),
                    ),
                  ),

                  const SizedBox(height: 20),

                  // Test accounts info
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0xFF138F81).withValues(alpha: 0.08),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: const Column(
                      children: [
                        Text(
                          'Akun Percobaan:',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF138F81),
                          ),
                        ),
                        SizedBox(height: 4),
                        Text(
                          'Admin: admin@absensi.com / password123\n'
                          'Guru: guru@absensi.com / password123\n'
                          'Ortu: ortu1@absensi.com / password123',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 10,
                            color: Color(0xFF636E72),
                            height: 1.5,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
