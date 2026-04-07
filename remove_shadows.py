import os
import re

SCREENS_DIR = r'c:\Users\User\absensi_android\lib\screens'

def remove_boxshadow(content):
    """Remove all boxShadow properties from Dart file content."""
    lines = content.split('\n')
    result = []
    i = 0
    removed = 0
    
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()
        
        # Pattern 1: boxShadow: [ ... ],
        if 'boxShadow:' in stripped and '[' in stripped:
            # Find the matching ],
            bracket_count = stripped.count('[') - stripped.count(']')
            removed += 1
            
            if bracket_count <= 0:
                # Single line boxShadow: [...],
                i += 1
                continue
            
            # Multi-line: skip until we find the matching ]
            i += 1
            while i < len(lines) and bracket_count > 0:
                l = lines[i].strip()
                bracket_count += l.count('[') - l.count(']')
                i += 1
            continue
        
        # Pattern 2: boxShadow: isActive (ternary in onboarding_wrapper)
        if 'boxShadow:' in stripped and '[' not in stripped:
            # Check if next line has ? or [
            removed += 1
            i += 1
            # Skip until we find a line that starts a new property or ends the ternary
            indent_level = len(line) - len(line.lstrip())
            while i < len(lines):
                next_stripped = lines[i].strip()
                next_indent = len(lines[i]) - len(lines[i].lstrip())
                # If we hit a line at same or lower indent that's not part of shadow
                if next_indent <= indent_level and next_stripped and not next_stripped.startswith('?') and not next_stripped.startswith(':') and not next_stripped.startswith('[') and not next_stripped.startswith(']'):
                    break
                if next_stripped.endswith('],') or next_stripped == '],':
                    i += 1
                    break
                if next_stripped == 'null,' or next_stripped.endswith('null,'):
                    i += 1
                    break
                i += 1
            continue
        
        result.append(line)
        i += 1
    
    return '\n'.join(result), removed

total_removed = 0
files_modified = 0

for filename in os.listdir(SCREENS_DIR):
    if not filename.endswith('.dart'):
        continue
    
    filepath = os.path.join(SCREENS_DIR, filename)
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if 'boxShadow' not in content:
        continue
    
    new_content, removed = remove_boxshadow(content)
    
    if removed > 0:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        total_removed += removed
        files_modified += 1
        print(f'  {filename}: removed {removed} boxShadow')

# Also handle main.dart area if needed
main_path = r'c:\Users\User\absensi_android\lib\main.dart'
with open(main_path, 'r', encoding='utf-8') as f:
    content = f.read()
if 'boxShadow' in content:
    new_content, removed = remove_boxshadow(content)
    if removed > 0:
        with open(main_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        total_removed += removed
        files_modified += 1
        print(f'  main.dart: removed {removed} boxShadow')

print(f'\nDone! Removed {total_removed} boxShadow from {files_modified} files.')
