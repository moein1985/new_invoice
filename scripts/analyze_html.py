#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Analyze bahesab.ir HTML structure for holiday markers and occasions"""
import urllib.request
import urllib.parse
import re
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

def fetch_month(year, month):
    url = "https://www.bahesab.ir/cdn/time/Mpostcalendar/"
    payload = json.dumps({"y": year, "m": month})
    data = urllib.parse.urlencode({"string_o": payload}).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers={
        'User-Agent': 'Mozilla/5.0',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': 'https://www.bahesab.ir/time/',
    })
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode('utf-8')

html = fetch_month(1404, 1)

# Save raw HTML for inspection
with open('/tmp/bahesab_raw.html', 'w', encoding='utf-8') as f:
    f.write(html)

print("=== HTML LENGTH:", len(html))
print()

# Find ALL CSS classes used in td elements
td_classes = re.findall(r'<td[^>]*class=["\']([^"\']*)["\']', html, re.IGNORECASE)
print("=== ALL TD CLASSES ===")
unique_classes = set()
for c in td_classes:
    for part in c.split():
        unique_classes.add(part)
for c in sorted(unique_classes):
    print(f"  {c}")
print()

# Find ALL div classes
div_classes = re.findall(r'<div[^>]*class=["\']([^"\']*)["\']', html, re.IGNORECASE)
print("=== ALL DIV CLASSES ===")
unique_div = set()
for c in div_classes:
    for part in c.split():
        unique_div.add(part)
for c in sorted(unique_div):
    print(f"  {c}")
print()

# Find ALL span classes
span_classes = re.findall(r'<span[^>]*class=["\']([^"\']*)["\']', html, re.IGNORECASE)
print("=== ALL SPAN CLASSES ===")
unique_span = set()
for c in span_classes:
    for part in c.split():
        unique_span.add(part)
for c in sorted(unique_span):
    print(f"  {c}")
print()

# Find monasebat sections with their content
print("=== MONASEBAT SECTIONS ===")
monasebat_pattern = r'id=["\']monasebat\d*["\'][^>]*>(.*?)</div>'
monasebats = re.findall(monasebat_pattern, html, re.DOTALL | re.IGNORECASE)
for i, m in enumerate(monasebats):
    clean = re.sub(r'<[^>]+>', ' ', m).strip()
    clean = re.sub(r'\s+', ' ', clean)
    print(f"--- Monasebat {i+1} ---")
    print(clean[:500])
    print()

# Find all elements with "Ho" or "holiday" in class
print("=== HOLIDAY RELATED ELEMENTS ===")
ho_elements = re.findall(r'<[^>]*class=["\'][^"\']*(?:Ho|holiday|tatil|off)[^"\']*["\'][^>]*>([^<]*)', html, re.IGNORECASE)
for e in ho_elements:
    print(f"  {e}")
print()

# Extract day cells - look at how days are structured
print("=== FIRST 20 TD ELEMENTS (with content) ===")
tds = re.findall(r'<td[^>]*>(.*?)</td>', html, re.DOTALL | re.IGNORECASE)
for i, td in enumerate(tds[:20]):
    clean = re.sub(r'<[^>]+>', '|', td).strip()
    td_tag = re.search(r'<td[^>]*>', html)
    print(f"  TD {i}: {clean[:200]}")
print()

# Look for color:red or style with red
print("=== RED COLORED ELEMENTS ===")
red_elements = re.findall(r'<[^>]*(?:color:\s*red|color:\s*#[fF][0-9a-fA-F]{1,5}|class=["\'][^"\']*red[^"\']*["\'])[^>]*>([^<]*)', html, re.IGNORECASE)
for e in red_elements:
    print(f"  {e.strip()}")
print()

# Look at first 2000 chars
print("=== FIRST 2000 CHARS ===")
print(html[:2000])
print()

# Find the specific structure of occasion entries
print("=== OCCASION ENTRIES (day-occasion pairs) ===")
# Look for patterns like number followed by occasion text
occasion_pattern = r'<b>(\d+)</b>\s*[-–]\s*([^<]+)'
occasions = re.findall(occasion_pattern, html, re.IGNORECASE)
for day, text in occasions:
    print(f"  Day {day}: {text.strip()}")
