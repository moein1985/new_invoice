import re
import os
import json

html = open('/tmp/bahesab_bahesab_calendar.html', 'r', encoding='utf-8', errors='ignore').read()

print(f'Total size: {len(html)} chars')
print()

# Find holiday-marked days
# Look for class patterns with holiday
holiday_days = re.findall(r'class="[^"]*holiday[^"]*"[^>]*>([^<]*)<', html, re.I)
print(f'=== Holiday day cells ({len(holiday_days)}) ===')
for h in holiday_days[:20]:
    if h.strip():
        print(f'  {h.strip()}')

print()

# Find event/occasion texts near holiday markers
print('=== Occasions/Events ===')
# Look for title attributes or tooltips
titles = re.findall(r'title="([^"]{5,})"', html)
for t in titles[:30]:
    print(f'  Title: {t}')

print()

# Look for data attributes
data_attrs = re.findall(r'data-[a-z]+="([^"]{5,})"', html, re.I)
print(f'=== Data attributes ({len(data_attrs)}) ===')
for d in data_attrs[:20]:
    print(f'  {d}')

print()

# Look for tooltip or popup content with events
tooltips = re.findall(r'(?:tooltip|popup|tip|event)[^>]*>([^<]{5,})<', html, re.I)
print(f'=== Tooltips ({len(tooltips)}) ===')
for t in tooltips[:20]:
    print(f'  {t.strip()}')

print()

# Find any JSON data in script tags
print('=== Script data ===')
scripts = re.findall(r'<script[^>]*>(.*?)</script>', html, re.S)
for s in scripts:
    if 'holiday' in s.lower() or 'event' in s.lower() or 'occasion' in s.lower():
        print(f'  Script with event data: {s[:500]}')
        print()

# Look for table structure with day data
print('\n=== Table cells with holiday class ===')
cells = re.findall(r'<td[^>]*class="[^"]*holiday[^"]*"[^>]*>(.*?)</td>', html, re.S)
for c in cells[:10]:
    clean = re.sub(r'<[^>]+>', ' ', c).strip()
    if clean:
        print(f'  Cell: {clean[:200]}')

# Look for any div with holiday info
print('\n=== Divs near holiday ===')
for m in re.finditer(r'holiday[^>]{0,100}>([^<]{2,})<', html):
    text = m.group(1).strip()
    if text:
        print(f'  {text}')
