#!/usr/bin/env python3
"""Extract ALL events from all 12 months of time.ir yearly calendar"""
import re, json

html = open('/tmp/timeir_events.html', 'r', encoding='utf-8').read()
chunks = re.findall(r'self\.__next_f\.push\(\[1,"(.*?)"\]\)', html)

for i, chunk in enumerate(chunks):
    if 'defaultYearlyCalendar' not in chunk:
        continue
    
    # Proper decoding
    decoded = chunk.encode('raw_unicode_escape').decode('utf-8')
    
    # Find defaultYearlyCalendar array
    idx = decoded.find('"defaultYearlyCalendar"')
    arr_start = decoded.find('[', idx)
    
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
    
    yearly_cal = json.loads(result)
    
    output = {
        "year": 1405,
        "source": "time.ir",
        "holiday_days_by_month": {},
        "holidays": [],
        "events": []
    }
    
    for month_data in yearly_cal:
        month = month_data.get('month')
        
        # Holiday days from day_list
        holiday_days = []
        for d in month_data.get('day_list', []):
            if d.get('is_holiday') and d.get('enabled', True):
                jday = d.get('index_in_base1')
                if jday:
                    holiday_days.append(jday)
        output["holiday_days_by_month"][str(month)] = holiday_days
        
        # Events from event_list
        for evt in month_data.get('event_list', []):
            entry = {
                "title": evt.get("title", ""),
                "jm": evt.get("jalali_month"),
                "jd": evt.get("jalali_day"),
                "gdate": f"{evt.get('gregorian_year')}-{evt.get('gregorian_month',0):02d}-{evt.get('gregorian_day',0):02d}",
                "holiday": evt.get("is_holiday", False),
                "base": evt.get("base", 0),
            }
            if entry["holiday"]:
                output["holidays"].append(entry)
            output["events"].append(entry)
    
    with open('/tmp/iran_holidays_1405_full.json', 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    
    print(f"Months: {len(output['holiday_days_by_month'])}")
    print(f"Events: {len(output['events'])}")
    print(f"Holidays: {len(output['holidays'])}")
    
    # Print holiday days per month
    for m in sorted(output['holiday_days_by_month'].keys(), key=int):
        days = output['holiday_days_by_month'][m]
        if days:
            print(f"  Month {m:>2}: {days}")
    
    break
