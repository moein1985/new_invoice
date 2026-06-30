#!/usr/bin/env python3
"""Extract ALL events from time.ir event-year page (all 12 months)"""
import re, json, sys

html = open('/tmp/timeir_events.html', 'r', encoding='utf-8').read()
chunks = re.findall(r'self\.__next_f\.push\(\[1,"(.*?)"\]\)', html)

all_events = []
all_holidays_by_month = {}  # month -> list of holiday days

for i, chunk in enumerate(chunks):
    try:
        decoded = chunk.encode('utf-8').decode('unicode_escape')
    except:
        decoded = chunk
    
    if 'defaultYearlyCalendar' not in decoded:
        continue
    
    print(f"Found defaultYearlyCalendar in chunk {i} ({len(decoded)} chars)", file=sys.stderr)
    
    # Find the array start
    idx = decoded.find('"defaultYearlyCalendar"')
    if idx < 0:
        continue
    
    arr_start = decoded.find('[', idx)
    
    # Extract the full defaultYearlyCalendar array
    bracket_count = 0
    result = ""
    for j in range(arr_start, min(arr_start + 300000, len(decoded))):
        c = decoded[j]
        if c == '[':
            bracket_count += 1
        elif c == ']':
            bracket_count -= 1
        result += c
        if bracket_count == 0:
            break
    
    try:
        yearly_cal = json.loads(result)
    except json.JSONDecodeError as e:
        print(f"JSON parse failed: {e}", file=sys.stderr)
        # Try to save raw for debugging
        with open('/tmp/raw_yearly.txt', 'w', encoding='utf-8') as f:
            f.write(result[:50000])
        continue
    
    print(f"Parsed {len(yearly_cal)} months", file=sys.stderr)
    
    for month_data in yearly_cal:
        month = month_data.get('month', '?')
        year = month_data.get('year', '?')
        
        # Get day_list for holiday flags
        day_list = month_data.get('day_list', [])
        holiday_days = []
        for d in day_list:
            if d.get('is_holiday') and d.get('enabled', True):
                jday = d.get('index_in_base1')
                if jday:
                    holiday_days.append(jday)
        all_holidays_by_month[month] = holiday_days
        
        # Get event_list for event names
        event_list = month_data.get('event_list', [])
        for evt in event_list:
            entry = {
                "title": evt.get("title", ""),
                "jalali_year": evt.get("jalali_year"),
                "jalali_month": evt.get("jalali_month"),
                "jalali_day": evt.get("jalali_day"),
                "gregorian_date": f"{evt.get('gregorian_year')}-{evt.get('gregorian_month',0):02d}-{evt.get('gregorian_day',0):02d}",
                "is_holiday": evt.get("is_holiday", False),
                "base": evt.get("base", 0),
            }
            all_events.append(entry)
    
    break

# Build the final output
output = {
    "year": 1405,
    "source": "time.ir",
    "holiday_days_by_month": all_holidays_by_month,
    "events": all_events,
    "holidays": [e for e in all_events if e["is_holiday"]],
}

# Save JSON
with open('/tmp/iran_holidays_1405.json', 'w', encoding='utf-8') as f:
    json.dump(output, f, ensure_ascii=False, indent=2)

# Print summary
print(f"\nTotal months: {len(all_holidays_by_month)}")
print(f"Total events: {len(all_events)}")
print(f"Total holidays: {len(output['holidays'])}")

print("\n=== HOLIDAY DAYS BY MONTH ===")
month_names = {1:'Farvardin',2:'Ordibehesht',3:'Khordad',4:'Tir',5:'Mordad',6:'Shahrivar',
               7:'Mehr',8:'Aban',9:'Azar',10:'Dey',11:'Bahman',12:'Esfand'}
for m in sorted(all_holidays_by_month.keys()):
    days = all_holidays_by_month[m]
    name = month_names.get(m, f'Month {m}')
    print(f"  {name:15s}: {days}")

print("\n=== ALL HOLIDAYS ===")
holidays_sorted = sorted(output["holidays"], key=lambda x: (x["jalali_month"], x["jalali_day"]))
for h in holidays_sorted:
    base_name = {0: "shamsi", 1: "greg", 2: "hijri"}.get(h["base"], "?")
    print(f"  {h['jalali_month']:2d}/{h['jalali_day']:2d} ({h['gregorian_date']}) [{base_name:6s}] {h['title']}")
