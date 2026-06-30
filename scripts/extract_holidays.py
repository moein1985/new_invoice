#!/usr/bin/env python3
import re, json, sys

html = open('/tmp/timeir_main.html', 'r', encoding='utf-8').read()

# Method 1: Look for __NEXT_DATA__
m = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', html)
if m:
    print("=== Found __NEXT_DATA__ ===")
    try:
        data = json.loads(m.group(1))
        print(json.dumps(data, indent=2, ensure_ascii=False)[:8000])
    except:
        print("JSON parse error")
        print(m.group(1)[:3000])
else:
    print("No __NEXT_DATA__ found")

# Method 2: Look for self.__next_f.push calls with event data
print("\n=== Checking RSC payload ===")
chunks = re.findall(r'self\.__next_f\.push\(\[1,"(.*?)"\]\)', html)
print(f"Found {len(chunks)} RSC chunks")
for i, chunk in enumerate(chunks):
    try:
        decoded = chunk.encode('utf-8').decode('unicode_escape')
    except:
        decoded = chunk
    # Look for anything related to events/holidays
    if any(kw in decoded.lower() for kw in ['event', 'holiday', 'تعطیل', 'مناسبت', 'occasion']):
        print(f"\nChunk {i} ({len(decoded)} chars):")
        print(decoded[:1000])

# Method 3: Look for any JSON arrays/objects with holiday data
print("\n=== Looking for event arrays ===")
# Find arrays with Persian text
arrays = re.findall(r'\[(?:[^\[\]]*(?:"[^"]*[\u0600-\u06FF][^"]*")[^\[\]]*)+\]', html)
for arr in arrays[:5]:
    if len(arr) > 50:
        print(f"Array ({len(arr)} chars): {arr[:500]}")

# Method 4: Check for eventList or DayEvents patterns
print("\n=== Event patterns ===")
for pattern in [r'eventList["\s]*:[^;]{10,500}', r'DayEvents?["\s]*:[^;]{10,500}', r'occasions?["\s]*:[^;]{10,500}']:
    matches = re.findall(pattern, html, re.I)
    for m in matches[:3]:
        print(f"Match: {m[:300]}")

# Method 5: Find all divs/spans with specific holiday-related classes
print("\n=== Holiday CSS classes ===")
holiday_classes = re.findall(r'class="[^"]*(?:holiday|event|occasion|tatil)[^"]*"', html, re.I)
for c in set(holiday_classes):
    print(f"Class: {c}")
