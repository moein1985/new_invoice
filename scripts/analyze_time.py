import re
import sys

html = open('/tmp/time_today.html', 'r').read()

# Find SpecialDayEventListItem content
items = re.findall(r'SpecialDayEventListItem_root__title__qEwNU[^>]*>([^<]+)', html)
print('=== Event Items ===')
for item in items:
    print(item)

print()

# Try event-year style URL patterns  
urls = re.findall(r'href[=\\]*["\']*/([^"\'\\]*event[^"\'\\]*)', html, re.I)
print('=== Event URLs ===')
for u in set(urls):
    print(u)

print()

# Find any API-like fetch patterns
apis = re.findall(r'fetch\(["\']([^"\']+)["\']', html)
print('=== Fetch APIs ===')
for a in apis:
    print(a)

print()

# Check for RSC payload data
print('=== Looking for Next.js RSC event data ===')
# Find event list items in RSC payloads
event_titles = re.findall(r'SpecialDayEventListItem_root__title[^"]*"[^}]*children[^"]*"([^"]+)"', html)
for t in event_titles:
    decoded = t.encode('utf-8').decode('unicode_escape', errors='ignore')
    print('Event:', decoded)
