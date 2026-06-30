import re

html = open('/tmp/bahesab_bahesab_calendar.html', 'r', encoding='utf-8', errors='ignore').read()

# Find JPost URL and AJAX endpoints
print('=== Finding AJAX URLs ===')
# Find url2 or any POST/GET URL
urls = re.findall(r'(?:url2?|JPost|fetch|XMLHttpRequest|ajax)\s*[=(]\s*["\']([^"\']+)["\']', html, re.I)
for u in urls:
    print(f'  URL: {u}')

print()

# Find any URL patterns with bahesab
bahesab_urls = re.findall(r'["\']((https?://)?(?:www\.)?bahesab\.ir[^"\']*)["\']', html, re.I)
for u in bahesab_urls[:20]:
    print(f'  Bahesab URL: {u[0]}')

print()

# Find all variable assignments that look like URLs
url_vars = re.findall(r'(url\w*)\s*=\s*["\']([^"\']+)["\']', html, re.I)
for name, val in url_vars:
    print(f'  {name} = {val}')

print()

# Find JPost function definition
jpost_match = re.search(r'function\s+JPost[^{]*\{[^}]{0,500}\}', html)
if jpost_match:
    print(f'JPost function: {jpost_match.group()[:500]}')

# Find where url2 is defined
url2_match = re.findall(r'url2\s*=\s*[^;]+;', html)
for u in url2_match:
    print(f'url2 def: {u[:200]}')

print()

# Look for the data format sent in AJAX
post_data = re.findall(r'(?:data|body|params)\s*[:=]\s*["\']?([^"\';\n]+)', html)
for p in post_data[:10]:
    if len(p) > 5:
        print(f'  POST data: {p[:200]}')

print()

# Find monasebat elements or content
print('=== Monasebat content ===')
monasebat = re.findall(r'id="monasebat[^"]*"[^>]*>(.*?)</div>', html, re.S)
for m in monasebat:
    clean = re.sub(r'<[^>]+>', ' ', m).strip()
    if clean:
        print(f'  Monasebat: {clean[:300]}')

# Try to find forbid variable (year range)
forbid = re.findall(r'forbid\s*=\s*(\d+)', html)
print(f'\nForbid values: {forbid}')

# Find today_index_arr
today_arr = re.findall(r'today_index_arr\s*=\s*(\[.*?\])', html, re.S)
for t in today_arr:
    print(f'\ntoday_index_arr: {t[:500]}')
