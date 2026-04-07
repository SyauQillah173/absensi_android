// ignore_for_file: avoid_print
import 'dart:io';

void main() {
  final screensDir = Directory('lib/screens');
  int totalRemoved = 0;
  int filesModified = 0;

  for (final entity in screensDir.listSync()) {
    if (entity is File && entity.path.endsWith('.dart')) {
      final content = entity.readAsStringSync();
      if (!content.contains('boxShadow')) continue;

      final result = removeBoxShadow(content);
      if (result.removed > 0) {
        entity.writeAsStringSync(result.content);
        totalRemoved += result.removed;
        filesModified++;
        print(
          '  ${entity.uri.pathSegments.last}: removed ${result.removed} boxShadow',
        );
      }
    }
  }

  print('\nDone! Removed $totalRemoved boxShadow from $filesModified files.');
}

class Result {
  final String content;
  final int removed;
  Result(this.content, this.removed);
}

Result removeBoxShadow(String content) {
  final lines = content.split('\n');
  final result = <String>[];
  int i = 0;
  int removed = 0;

  while (i < lines.length) {
    final line = lines[i];
    final stripped = line.trim();

    // Pattern 1: boxShadow: [ ... ],
    if (stripped.contains('boxShadow:') && stripped.contains('[')) {
      int bracketCount =
          '['.allMatches(stripped).length - ']'.allMatches(stripped).length;
      removed++;

      if (bracketCount <= 0) {
        // Single line
        i++;
        continue;
      }

      // Multi-line
      i++;
      while (i < lines.length && bracketCount > 0) {
        final l = lines[i].trim();
        bracketCount += '['.allMatches(l).length - ']'.allMatches(l).length;
        i++;
      }
      continue;
    }

    // Pattern 2: boxShadow: someVar (ternary, no bracket on same line)
    if (stripped.contains('boxShadow:') && !stripped.contains('[')) {
      removed++;
      i++;
      // Skip until we find the closing of the ternary
      while (i < lines.length) {
        final nextStripped = lines[i].trim();
        if (nextStripped.endsWith('],') ||
            nextStripped == '],' ||
            nextStripped == 'null,') {
          i++;
          break;
        }
        // Check if we hit a different property (not indented further)
        if (!nextStripped.startsWith('?') &&
            !nextStripped.startsWith(':') &&
            !nextStripped.startsWith('[') &&
            !nextStripped.startsWith(']') &&
            !nextStripped.startsWith('BoxShadow') &&
            !nextStripped.startsWith('offset') &&
            !nextStripped.startsWith('blurRadius') &&
            !nextStripped.startsWith('spreadRadius') &&
            !nextStripped.startsWith('color') &&
            !nextStripped.startsWith(')') &&
            nextStripped.isNotEmpty) {
          break;
        }
        i++;
      }
      continue;
    }

    result.add(line);
    i++;
  }

  return Result(result.join('\n'), removed);
}
