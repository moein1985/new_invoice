#!/usr/bin/env python3
"""Extract complete event data from time.ir event-year page and save as JSON"""
import re, json, sys

html = open('/tmp/timeir_events.html', 'r', encoding='utf-8').read()

# Find RSC chunks
chunks = re.findall(r'self\.__next_f\.push\(\[1,"(.*?)"\]\)', html)

output = {"holidays": [], "events": []}

for i, chunk in enumerate(chunks):
    try:
        decoded = chunk.encode('utf-8').decode('unicode_escape')
    except:
        decoded = chunk
    
    if 'event_list' not in decoded:
        continue
    
    # Find event_list array
    idx = decoded.find('"event_list"')
    if idx < 0:
        continue
    
    # Extract the JSON array
    arr_start = decoded.find('[', idx)
    if arr_start < 0:
        continue
    
    # Find matching bracket
    bracket_count = 0
    result = ""
    for j in range(arr_start, len(decoded)):
        c = decoded[j]
        if c == '[':
            bracket_count += 1
        elif c == ']':
            bracket_count -= 1
        result += c
        if bracket_count == 0:
            break
    
    try:
        event_list = json.loads(result)
    except json.JSONDecodeError:
        continue
    
    print(f"Chunk {i}: Found {len(event_list)} events", file=sys.stderr)
    
    for evt in event_list:
        entry = {
            "title": evt.get("title", ""),
            "jalali_year": evt.get("jalali_year"),
            "jalali_month": evt.get("jalali_month"),
            "jalali_day": evt.get("jalali_day"),
            "gregorian_date": f"{evt.get('gregorian_year')}-{evt.get('gregorian_month',0):02d}-{evt.get('gregorian_day',0):02d}",
            "is_holiday": evt.get("is_holiday", False),
            "base": evt.get("base", 0),  # 0=jalali, 1=gregorian, 2=hijri
        }
        
        if entry["is_holiday"]:
            output["holidays"].append(entry)
        output["events"].append(entry)
    
    break  # Only process first event_list found

# Save full output
with open('/tmp/timeir_all_events.json', 'w', encoding='utf-8') as f:
    json.dump(output, f, ensure_ascii=False, indent=2)

# Print summary
print(f"Total events: {len(output['events'])}", file=sys.stderr)
print(f"Total holidays: {len(output['holidays'])}", file=sys.stderr)

# Print holidays sorted by date
print("\n=== HOLIDAYS ===")
holidays_sorted = sorted(output["holidays"], key=lambda x: (x["jalali_month"], x["jalali_day"]))
for h in holidays_sorted:
    base_name = {0: "shamsi", 1: "gregorian", 2: "hijri"}.get(h["base"], "?")
    print(f"  {h['jalali_month']:2d}/{h['jalali_day']:2d} ({h['gregorian_date']}) [{base_name:10s}] {h['title']}")

# Print all events sorted
print("\n=== ALL EVENTS ===")
events_sorted = sorted(output["events"], key=lambda x: (x["jalali_month"], x["jalali_day"]))
for e in events_sorted:
    base_name = {0: "shamsi", 1: "gregorian", 2: "hijri"}.get(e["base"], "?")
    hol = " [HOLIDAY]" if e["is_holiday"] else ""
    print(f"  {e['jalali_month']:2d}/{e['jalali_day']:2d} ({e['gregorian_date']}) [{base_name:10s}]{hol} {e['title']}")
