import 'dart:async';

import 'package:flutter/material.dart';

import '../../services/api_service.dart';
import '../../services/session_service.dart';
import '../../widgets/responsive_layout.dart';
import 'change_password_screen.dart';

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

    try {
      final result = await ApiService.login(identifier, password);

      if (!mounted) return;

      if (result['success'] == true) {
        // === ONLINE LOGIN BERHASIL ===
        final userData = Map<String, dynamic>.from(result['data'] as Map);
        final token = result['token']?.toString() ?? '';
        if (token.isNotEmpty) {
          userData['token'] = token;
        }
        await SessionService.saveLoginSession(userData);
        await SessionService.upsertOfflineAccount(
          identifier: identifier,
          password: password,
          userData: userData,
        );

        if (mounted) {
          if (_mustChangePassword(userData)) {
            Navigator.pushReplacement(
              context,
              MaterialPageRoute(
                builder: (_) => ChangePasswordScreen(
                  forced: true,
                  initialIdentifier: identifier,
                  initialCurrentPassword: password,
                ),
              ),
            );
          } else {
            Navigator.pushReplacementNamed(context, '/dashboard');
          }
        }
      } else {
        setState(() {
          _errorMessage = result['message'] ?? 'Login gagal';
          _isLoading = false;
          _loadingHint = null;
        });
      }
    } on ApiException catch (e) {
      if (e.statusCode == 401 || e.statusCode == 403 || e.statusCode == 422) {
        if (!mounted) return;
        setState(() {
          _errorMessage = e.message;
          _isLoading = false;
          _loadingHint = null;
        });
        return;
      }
      await _fallbackToOffline(identifier, password);
    } on TimeoutException {
      await _fallbackToOffline(identifier, password);
    } catch (_) {
      await _fallbackToOffline(identifier, password);
    }
  }

  Future<void> _fallbackToOffline(String identifier, String password) async {
    if (!mounted) return;
    setState(() => _loadingHint = 'Server tidak tersedia, mencoba offline...');
    await _tryOfflineLogin(identifier, password);
  }

  Future<void> _tryOfflineLogin(String identifier, String password) async {
    final accounts = await SessionService.getOfflineAccounts();
    final matchedAccount = await SessionService.findOfflineAccount(
      identifier: identifier,
      password: password,
    );

    if (matchedAccount != null) {
      if (_mustChangePassword(matchedAccount)) {
        setState(() {
          _errorMessage =
              'Akun guru/wali wajib ganti password pertama kali. Sambungkan internet lalu login online untuk mengganti password.';
          _isLoading = false;
          _loadingHint = null;
        });
        return;
      }

      // === OFFLINE LOGIN BERHASIL ===
      // Set user data dari cached account
      await SessionService.saveLoginSession(
        matchedAccount,
        preserveExistingToken: true,
      );

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

  bool _mustChangePassword(Map<String, dynamic> userData) {
    final role = userData['role']?.toString().toLowerCase() ?? '';
    final value = userData['must_change_password'];
    final mustChange =
        value == true ||
        value == 1 ||
        value?.toString().trim().toLowerCase() == 'true';

    return (role == 'guru' || role == 'wali') && mustChange;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFFDC80),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            physics: const BouncingScrollPhysics(),
            child: AppResponsive(
              maxWidth: 520,
              child: Container(
                width: double.infinity,
                margin: EdgeInsets.symmetric(
                  horizontal: AppResponsive.pageMargin(context),
                  vertical: 16,
                ),
                padding: const EdgeInsets.symmetric(
                  horizontal: 24,
                  vertical: 30,
                ),
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
                        onPressed: () async {
                          final result =
                              await Navigator.push<Map<String, dynamic>>(
                                context,
                                MaterialPageRoute(
                                  builder: (_) => const ChangePasswordScreen(),
                                ),
                              );
                          if (result != null && mounted) {
                            _identifierController.text =
                                result['identifier']?.toString() ?? '';
                            _passwordController.text =
                                result['password']?.toString() ?? '';
                          }
                        },
                        child: const Text(
                          'Ganti password',
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
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
