import 'package:flutter/material.dart';

import 'login_screen.dart';
import 'welcome_screen.dart';

class OnboardingWrapper extends StatefulWidget {
  const OnboardingWrapper({super.key});

  @override
  State<OnboardingWrapper> createState() => _OnboardingWrapperState();
}

class _OnboardingWrapperState extends State<OnboardingWrapper> {
  final PageController _pageController = PageController();
  int _currentPage = 0;

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      resizeToAvoidBottomInset: false,
      backgroundColor: const Color(0xFFFFDC80),
      body: Stack(
        children: [
          // PageView for swiping
          PageView(
            controller: _pageController,
            onPageChanged: (index) {
              setState(() {
                _currentPage = index;
              });
            },
            children: const [WelcomeScreen(), LoginScreen()],
          ),

          // Dot indicators at bottom
          Positioned(
            bottom: 24,
            left: 0,
            right: 0,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [_buildDot(0), const SizedBox(width: 10), _buildDot(1)],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDot(int index) {
    final bool isActive = _currentPage == index;
    return GestureDetector(
      onTap: () {
        _pageController.animateToPage(
          index,
          duration: const Duration(milliseconds: 350),
          curve: Curves.easeInOut,
        );
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 300),
        width: isActive ? 14 : 12,
        height: isActive ? 14 : 12,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: isActive
              ? const Color(0xFF138F81) // Active color
              : const Color(0xFF9CE6DF), // Inactive color
        ),
      ),
    );
  }
}
