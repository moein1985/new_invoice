#!/usr/bin/env python3
import json
data = json.load(open('/tmp/iran_holidays_1405.json', 'r', encoding='utf-8'))
for h in data['holidays']:
    print(f"{h['jalali_month']}/{h['jalali_day']} {h['title']}")
