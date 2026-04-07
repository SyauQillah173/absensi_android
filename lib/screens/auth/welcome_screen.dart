import 'package:flutter/material.dart';

class WelcomeScreen extends StatelessWidget {
  const WelcomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.of(context).size;

    return Scaffold(
      backgroundColor: const Color(0xFFFFDC80),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: Container(
                width: double.infinity,
                margin: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 12,
                ),
                decoration: BoxDecoration(
                  color: const Color(0xFFE1EFF7),
                  borderRadius: const BorderRadius.only(
                    topLeft: Radius.circular(180),
                    topRight: Radius.circular(180),
                    bottomLeft: Radius.circular(68),
                    bottomRight: Radius.circular(68),
                  ),
                ),
                child: SingleChildScrollView(
                  child: Column(
                    children: [
                      const SizedBox(height: 30),
                      // Logo
                      Image.asset(
                        'assets/images/Logo_Qomaruddin.png',
                        width: size.width * 0.18,
                        height: size.width * 0.18,
                      ),
                      const SizedBox(height: 16),
                      // Welcome text
                      const Padding(
                        padding: EdgeInsets.symmetric(horizontal: 24),
                        child: Text(
                          '"Selamat Datang di Sistem Informasi\nMadrasah Diniah Pondok\nPesantren Qomaruddin"',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF2D3436),
                            height: 1.4,
                          ),
                        ),
                      ),
                      const SizedBox(height: 20),
                      // Main image
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 30),
                        child: Image.asset(
                          'assets/images/Menu Awal.png',
                          width: size.width * 0.65,
                          fit: BoxFit.contain,
                        ),
                      ),
                      const SizedBox(height: 20),
                      // Hadith quote
                      const Padding(
                        padding: EdgeInsets.symmetric(horizontal: 24),
                        child: Text(
                          '"Menuntut ilmu itu kewajiban setiap Muslim."\n(HR. Ibnu Majah)',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF2D3436),
                            height: 1.5,
                          ),
                        ),
                      ),
                      const SizedBox(height: 20),
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
}
