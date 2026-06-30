#!/usr/bin/env python3
"""Extract full calendar data from time.ir RSC payload"""
import re, json

html = open('/tmp/timeir_main.html', 'r', encoding='utf-8').read()

# Find all RSC chunks
chunks = re.findall(r'self\.__next_f\.push\(\[1,"(.*?)"\]\)', html)

for i, chunk in enumerate(chunks):
    try:
        decoded = chunk.encode('utf-8').decode('unicode_escape')
    except:
        decoded = chunk
    
    if 'defaultCalendar' not in decoded:
        continue
    
    # Find the defaultCalendar JSON
    idx = decoded.find('"defaultCalendar"')
    if idx < 0:
        idx = decoded.find('defaultCalendar')
    
    print(f"Found defaultCalendar in chunk {i}")
    
    # Find the day_list array
    dl_idx = decoded.find('"day_list"')
    if dl_idx < 0:
        print("No day_list found")
        continue
    
    # Extract from day_list to a reasonable end
    segment = decoded[dl_idx:]
    
    # Find matching bracket
    bracket_count = 0
    start_bracket = segment.find('[')
    result = ""
    for j in range(start_bracket, len(segment)):
        c = segment[j]
        if c == '[':
            bracket_count += 1
        elif c == ']':
            bracket_count -= 1
        result += c
        if bracket_count == 0:
            break
    
    try:
        day_list = json.loads(result)
        print(f"Total days: {len(day_list)}")
        print("\nHolidays in Farvardin 1405:")
        for day in day_list:
            jday = day.get('index_in_base1')
            is_holiday = day.get('is_holiday', False)
            is_weekend = day.get('is_weekend', False)
            gday = day.get('index_in_base2')
            hday = day.get('index_in_base3')
            if is_holiday or is_weekend:
                status = []
                if is_holiday:
                    status.append('HOLIDAY')
                if is_weekend:
                    status.append('WEEKEND')
                print(f"  Farvardin {jday:2d} (Greg day={gday:2d}, Hijri day={hday:2d}) -> {', '.join(status)}")
    except json.JSONDecodeError as e:
        print(f"JSON parse error: {e}")
        print(f"First 500 chars: {result[:500]}")
    
    # Now find event_list for this month
    print("\n\nLooking for event_list...")
    el_idx = decoded.find('"event_list"')
    if el_idx >= 0:
        segment2 = decoded[el_idx:]
        bracket_count = 0
        start_bracket = segment2.find('[')
        result2 = ""
        for j in range(start_bracket, len(segment2)):
            c = segment2[j]
            if c == '[':
                bracket_count += 1
            elif c == ']':
                bracket_count -= 1
            result2 += c
            if bracket_count == 0:
                break
        
        try:
            event_list = json.loads(result2)
            print(f"Total events: {len(event_list)}")
            for evt in event_list:
                day = evt.get('day', '?')
                title = evt.get('title', evt.get('event_title', '?'))
                is_hol = evt.get('is_holiday', False)
                base = evt.get('base', '?')
                hol_tag = ' [HOLIDAY]' if is_hol else ''
                print(f"  Day {day}: {title}{hol_tag} (base={base})")
        except json.JSONDecodeError as e:
            print(f"JSON parse error: {e}")
            print(f"First 1000 chars: {result2[:1000]}")
    else:
        print("No event_list found")
    
    break
