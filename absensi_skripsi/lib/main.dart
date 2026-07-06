import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:workmanager/workmanager.dart';

import 'screens/auth/login_screen.dart';
import 'screens/auth/splash_screen.dart';
import 'screens/auth/change_password_screen.dart';
import 'screens/beranda/dashboard_screen.dart';
import 'services/api_service.dart';
import 'services/session_service.dart';
import 'services/sync_service.dart';

@pragma('vm:entry-point')
void absensiSyncCallbackDispatcher() {
  Workmanager().executeTask((taskName, inputData) async {
    WidgetsFlutterBinding.ensureInitialized();

    if (taskName != SyncService.workManagerTaskSyncAbsensi) {
      return true;
    }

    await SyncService.initForBackgroundWorker();
    final result = await SyncService.syncPendingAbsensi();
    return !result.serverDown && result.errors == 0;
  });
}

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Workmanager().initialize(absensiSyncCallbackDispatcher);
  await SyncService.init();
  await SyncService.registerBackgroundSync();

  // === AUTO-LOGIN: Cek apakah user masih login ===
  // SharedPreferences PERMANEN — guru tidak perlu login ulang
  // setiap buka app. Cukup login 1x, setelahnya langsung dashboard.
  final isLoggedIn = await _hasUsableLoginSession();
  final mustChangePassword = await SessionService.mustChangePassword();

  runApp(MyApp(isLoggedIn: isLoggedIn, mustChangePassword: mustChangePassword));
}

Future<bool> _hasUsableLoginSession() async {
  if (!await SessionService.isLoggedIn()) return false;

  final token = await SessionService.getAuthToken();
  if (token.isEmpty) {
    await SessionService.clearSession();
    return false;
  }

  if (!await ApiService.testConnection()) {
    return true;
  }

  try {
    final userId = await SessionService.getUserId();
    await ApiService.getProfile(userId);
    return true;
  } on ApiException catch (error) {
    if (error.statusCode == 401 || error.statusCode == 403) {
      await SessionService.clearSession();
      return false;
    }
    return true;
  } catch (_) {
    return true;
  }
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
