import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:google_fonts/google_fonts.dart';

import 'thesis/screens/login_screen.dart';
import 'thesis/screens/thesis_shell.dart';
import 'thesis/services/thesis_database.dart';
import 'thesis/services/thesis_session.dart';
import 'thesis/services/thesis_sync.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await ThesisDatabase.instance.initialize();
  await ThesisSync.initialize();
  runApp(const ThesisApp());
}

class ThesisApp extends StatelessWidget {
  const ThesisApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Presensi Madrasah Diniyah',
      debugShowCheckedModeBanner: false,
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: const [Locale('id', 'ID')],
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF157C6E),
          primary: const Color(0xFF157C6E),
          secondary: const Color(0xFFE8A838),
          surface: const Color(0xFFF7F9F8),
        ),
        textTheme: GoogleFonts.poppinsTextTheme(),
        cardTheme: const CardThemeData(
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.all(Radius.circular(8)),
            side: BorderSide(color: Color(0xFFDDE5E2)),
          ),
        ),
        useMaterial3: true,
      ),
      home: FutureBuilder<bool>(
        future: ThesisSession.hasValidSession(),
        builder: (context, snapshot) {
          if (!snapshot.hasData) {
            return const Scaffold(
              body: Center(child: CircularProgressIndicator()),
            );
          }
          return snapshot.data! ? const ThesisShell() : const LoginScreen();
        },
      ),
    );
  }
}
