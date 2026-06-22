import 'package:flutter/material.dart';

class AppResponsive extends StatelessWidget {
  final Widget child;
  final double maxWidth;
  final EdgeInsetsGeometry? padding;
  final Alignment alignment;

  const AppResponsive({
    super.key,
    required this.child,
    this.maxWidth = 560,
    this.padding,
    this.alignment = Alignment.topCenter,
  });

  static double pageMargin(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    if (width <= 360) return 14;
    if (width >= 520) return 22;
    return 16;
  }

  static double compactScale(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    if (width <= 340) return 0.92;
    if (width <= 380) return 0.96;
    return 1;
  }

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: alignment,
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: maxWidth),
        child: Padding(padding: padding ?? EdgeInsets.zero, child: child),
      ),
    );
  }
}
