import subprocess
import json
import re
import urllib.parse

# The working format: POST to /cdn/time/Mpostcalendar/ with string_o={"y":YEAR,"m":MONTH}
# Let's get full data for 1405/1 (Farvardin)

payload = json.dumps({"y": 1405, "m": 1})
encoded_payload = f'string_o={urllib.parse.quote(payload)}'

cmd = [
    'curl', '-sL', '--connect-timeout', '5', '--max-time', '10',
    '-X', 'POST',
    '-H', 'Content-Type: application/x-www-form-urlencoded',
    '-H', 'Referer: https://www.bahesab.ir/time/calendar/',
    '-d', encoded_payload,
    'https://www.bahesab.ir/cdn/time/Mpostcalendar/'
]

result = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
html = result.stdout

# Save full response
with open('/tmp/bahesab_month_response.html', 'w', encoding='utf-8') as f:
    f.write(html)

print(f'Response size: {len(html)} chars')
print()

# Extract monasebat (occasions) section
print('=== MONASEBAT (Occasions) ===')
monasebat_blocks = re.findall(r'id="monasebat\d*"[^>]*>(.*?)</div>', html, re.S | re.I)
for i, block in enumerate(monasebat_blocks):
    clean = re.sub(r'<[^>]+>', '\n', block)
    clean = re.sub(r'\n+', '\n', clean).strip()
    lines = [l.strip() for l in clean.split('\n') if l.strip()]
    print(f'\n--- Monasebat block {i+1} ---')
    for line in lines:
        print(f'  {line}')

print()

# Extract holiday days
print('=== HOLIDAY DAYS ===')
# Find cells with Ho or holiday class
ho_cells = re.findall(r'class="[^"]*Ho[^"]*"[^>]*>(\d+)', html)
print(f'Holiday days: {ho_cells}')

# Find today marking
today_cells = re.findall(r'class="[^"]*To[^"]*"[^>]*>(\d+)', html)
print(f'Today days: {today_cells}')

print()

# Try another month to compare
print('=== Testing month 12 (Esfand) ===')
payload2 = json.dumps({"y": 1404, "m": 12})
encoded2 = f'string_o={urllib.parse.quote(payload2)}'
cmd2 = [
    'curl', '-sL', '--connect-timeout', '5', '--max-time', '10',
    '-X', 'POST',
    '-H', 'Content-Type: application/x-www-form-urlencoded',
    '-H', 'Referer: https://www.bahesab.ir/time/calendar/',
    '-d', encoded2,
    'https://www.bahesab.ir/cdn/time/Mpostcalendar/'
]
result2 = subprocess.run(cmd2, capture_output=True, text=True, timeout=15)
html2 = result2.stdout
print(f'Esfand response size: {len(html2)} chars')

monasebat_blocks2 = re.findall(r'id="monasebat\d*"[^>]*>(.*?)</div>', html2, re.S | re.I)
for i, block in enumerate(monasebat_blocks2):
    clean = re.sub(r'<[^>]+>', '\n', block)
    clean = re.sub(r'\n+', '\n', clean).strip()
    lines = [l.strip() for l in clean.split('\n') if l.strip()]
    print(f'\n--- Esfand Monasebat block {i+1} ---')
    for line in lines[:15]:
        print(f'  {line}')

ho_cells2 = re.findall(r'class="[^"]*Ho[^"]*"[^>]*>(\d+)', html2)
print(f'\nEsfand holiday days: {ho_cells2}')
