import 'package:flutter/material.dart';

class AdaptiveBottomSheet extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;
  final double maxHeightFactor;
  final bool scrollable;
  final Color backgroundColor;

  const AdaptiveBottomSheet({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.fromLTRB(20, 18, 20, 24),
    this.maxHeightFactor = 0.82,
    this.scrollable = true,
    this.backgroundColor = const Color(0xFFE1EFF7),
  });

  @override
  Widget build(BuildContext context) {
    final mediaQuery = MediaQuery.of(context);
    final bottomInset = mediaQuery.viewInsets.bottom;
    final safeBottom = mediaQuery.viewPadding.bottom;

    Widget content = Padding(
      padding: padding.add(EdgeInsets.only(bottom: safeBottom)),
      child: child,
    );

    if (scrollable) {
      content = SingleChildScrollView(
        physics: const BouncingScrollPhysics(),
        keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
        child: content,
      );
    }

    return AnimatedPadding(
      duration: const Duration(milliseconds: 180),
      curve: Curves.easeOutCubic,
      padding: EdgeInsets.only(bottom: bottomInset),
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxHeight: mediaQuery.size.height * maxHeightFactor,
        ),
        child: Container(
          decoration: BoxDecoration(
            color: backgroundColor,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(30)),
          ),
          child: SafeArea(top: false, child: content),
        ),
      ),
    );
  }
}
