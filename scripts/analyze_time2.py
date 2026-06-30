import re
import sys

# Try the jalali-calendar page which might have monthly event data
html = open('/tmp/time_today.html', 'r', encoding='utf-8').read()

# Find all SpecialDayEventListItem contents with proper encoding
items = re.findall(r'SpecialDayEventListItem_root__title__qEwNU[^>]*>([^<]+)', html)
print('=== Event Items (today) ===')
for item in items:
    print(item)

print()
print('=== Checking for structured data ===')

# Find JSON-like structures with event data  
# Look for anything with "children" that follows event list items
pattern = r'SpecialDayEventListItem_root__kd_3W[^}]+children[^}]+children[^"]*"([^"]{5,})"'
matches = re.findall(pattern, html)
for m in matches:
    try:
        decoded = m.encode('utf-8').decode('unicode_escape')
        print('EventText:', decoded)
    except:
        print('EventRaw:', m[:100])

print()
print('=== Page meta/structured data ===')
# Check for ld+json structured data
ld_json = re.findall(r'application/ld\+json[^>]*>(.*?)</script>', html, re.S)
for ld in ld_json:
    print('LD+JSON:', ld[:300])

print()
print('=== All script src URLs ===')
scripts = re.findall(r'src="([^"]*/_next/[^"]*)"', html)
for s in scripts[:5]:
    print(s)
