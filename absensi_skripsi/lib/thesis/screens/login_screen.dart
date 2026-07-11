import 'package:flutter/material.dart';

import '../services/thesis_api.dart';
import '../services/thesis_logger.dart';
import '../services/thesis_session.dart';
import '../services/thesis_sync.dart';
import 'thesis_shell.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _username = TextEditingController();
  final _password = TextEditingController();
  bool _loading = false;
  bool _obscure = true;
  String? _error;

  Future<void> _login() async {
    if (_username.text.trim().isEmpty || _password.text.length < 8) {
      setState(() => _error = 'Isi username dan password minimal 8 karakter.');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    ThesisLogger.unawaitedInfo(
      'Login online dicoba',
      message: 'Username ${_username.text.trim()} mencoba masuk ke server.',
      category: 'login',
    );
    try {
      final result = await ThesisApi.login(
        _username.text.trim(),
        _password.text,
      );
      await ThesisSession.saveOnline(
        username: _username.text.trim(),
        password: _password.text,
        token: result['token'].toString(),
        expiresIn: int.tryParse(result['expires_in'].toString()) ?? 86400,
        user: Map<String, dynamic>.from(result['data'] as Map),
      );
      await ThesisSync.refreshBootstrap();
      ThesisLogger.unawaitedInfo(
        'Login online berhasil',
        message:
            'Data sesi dan token tersimpan untuk penggunaan online/offline.',
        category: 'login',
      );
      if (mounted) {
        Navigator.of(context).pushAndRemoveUntil(
          MaterialPageRoute(builder: (_) => const ThesisShell()),
          (_) => false,
        );
      }
    } catch (error) {
      ThesisLogger.unawaitedInfo(
        'Login online gagal',
        message: error.toString(),
        category: 'login',
      );
      final offline = await ThesisSession.loginOffline(
        _username.text.trim(),
        _password.text,
      );
      if (offline && mounted) {
        ThesisLogger.unawaitedInfo(
          'Login offline berhasil',
          message: 'Akun ditemukan pada cache perangkat.',
          category: 'offline-first',
        );
        Navigator.of(context).pushAndRemoveUntil(
          MaterialPageRoute(builder: (_) => const ThesisShell()),
          (_) => false,
        );
      } else if (mounted) {
        ThesisLogger.unawaitedInfo(
          'Login offline gagal',
          message: 'Akun belum tersedia pada cache perangkat.',
          category: 'offline-first',
        );
        setState(
          () => _error = error is ThesisApiException
              ? error.message
              : 'Server tidak terjangkau dan akun belum tersedia untuk login offline.',
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Image.asset('assets/images/Logo_Qomaruddin.png', height: 92),
                  const SizedBox(height: 20),
                  Text(
                    'Presensi Madrasah Diniyah',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Pondok Pesantren Qomaruddin',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                  const SizedBox(height: 32),
                  TextField(
                    controller: _username,
                    textInputAction: TextInputAction.next,
                    decoration: const InputDecoration(
                      labelText: 'Username',
                      prefixIcon: Icon(Icons.person_outline),
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 14),
                  TextField(
                    controller: _password,
                    obscureText: _obscure,
                    onSubmitted: (_) => _login(),
                    decoration: InputDecoration(
                      labelText: 'Password',
                      prefixIcon: const Icon(Icons.lock_outline),
                      border: const OutlineInputBorder(),
                      suffixIcon: IconButton(
                        tooltip: _obscure
                            ? 'Tampilkan password'
                            : 'Sembunyikan password',
                        onPressed: () => setState(() => _obscure = !_obscure),
                        icon: Icon(
                          _obscure
                              ? Icons.visibility_outlined
                              : Icons.visibility_off_outlined,
                        ),
                      ),
                    ),
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: 12),
                    Text(
                      _error!,
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.error,
                      ),
                    ),
                  ],
                  const SizedBox(height: 20),
                  FilledButton.icon(
                    onPressed: _loading ? null : _login,
                    icon: _loading
                        ? const SizedBox.square(
                            dimension: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.login),
                    label: const Text('Masuk'),
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
