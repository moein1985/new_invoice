#!/usr/bin/env python3
import json
d = json.load(open("/tmp/iran_holidays_fixed.json"))
t = d["holidays"][0]["title"]
print("repr:", repr(t))
print("codepoints:", [hex(ord(c)) for c in t[:15]])
# Check if it's proper Persian
import unicodedata
for c in t[:15]:
    print(f"  U+{ord(c):04X} = {unicodedata.name(c, '?')}")
