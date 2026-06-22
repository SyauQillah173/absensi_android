import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:google_fonts/google_fonts.dart';

import 'screens/auth/login_screen.dart';
import 'screens/auth/splash_screen.dart';
import 'screens/auth/change_password_screen.dart';
import 'screens/beranda/dashboard_screen.dart';
import 'services/session_service.dart';
import 'services/sync_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await SyncService.init();

  // === AUTO-LOGIN: Cek apakah user masih login ===
  // SharedPreferences PERMANEN — guru tidak perlu login ulang
  // setiap buka app. Cukup login 1x, setelahnya langsung dashboard.
  final isLoggedIn = await SessionService.isLoggedIn();
  final mustChangePassword = await SessionService.mustChangePassword();

  runApp(MyApp(isLoggedIn: isLoggedIn, mustChangePassword: mustChangePassword));
}

class MyApp extends StatelessWidget {
  final bool isLoggedIn;
  final bool mustChangePassword;

  const MyApp({
    super.key,
    required this.isLoggedIn,
    required this.mustChangePassword,
  });

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Absensi Madrasah Diniah',
      debugShowCheckedModeBanner: false,
      // === LOCALIZATIONS: DatePicker & Material widgets butuh ini ===
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: const [
        Locale('id', 'ID'), // Indonesia
        Locale('en', 'US'), // English
      ],
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFFFFDC80),
          primary: const Color(0xFF138F81),
          secondary: const Color(0xFFFFDC80),
          surface: const Color(0xFFE1EFF7),
        ),
        textTheme: GoogleFonts.poppinsTextTheme(),
        useMaterial3: true,
      ),
      // Jika sudah login sebelumnya → langsung ke dashboard
      // Jika belum → tampilkan splash → login
      initialRoute: isLoggedIn
          ? (mustChangePassword ? '/force-change-password' : '/dashboard')
          : '/',
      onGenerateRoute: (settings) {
        switch (settings.name) {
          case '/':
            return _fadeSlideRoute(const SplashScreen());
          case '/login':
            return _fadeSlideRoute(const LoginScreen());
          case '/change-password':
            return _fadeSlideRoute(const ChangePasswordScreen());
          case '/force-change-password':
            return _fadeSlideRoute(const ChangePasswordScreen(forced: true));
          case '/dashboard':
            return _fadeSlideRoute(const DashboardScreen());
          default:
            return _fadeSlideRoute(const LoginScreen());
        }
      },
    );
  }

  static Route<dynamic> _fadeSlideRoute(Widget page) {
    return PageRouteBuilder(
      pageBuilder: (context, animation, _) => page,
      transitionsBuilder: (context, animation, _, child) {
        return FadeTransition(
          opacity: animation,
          child: SlideTransition(
            position:
                Tween<Offset>(
                  begin: const Offset(0.0, 0.05),
                  end: Offset.zero,
                ).animate(
                  CurvedAnimation(
                    parent: animation,
                    curve: Curves.easeOutCubic,
                  ),
                ),
            child: child,
          ),
        );
      },
      transitionDuration: const Duration(milliseconds: 500),
    );
  }
}
