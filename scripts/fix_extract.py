#!/usr/bin/env python3
"""Fix extraction from time.ir - handle unicode_escape properly"""
import re, json

html = open('/tmp/timeir_events.html', 'r', encoding='utf-8').read()
chunks = re.findall(r'self\.__next_f\.push\(\[1,"(.*?)"\]\)', html)

for i, chunk in enumerate(chunks):
    if 'event_list' not in chunk:
        continue
    
    # Method: decode unicode_escape but fix multi-byte sequences
    # The RSC payload uses \uXXXX for non-ASCII characters
    # Use raw_unicode_escape to properly handle this
    try:
        decoded = chunk.encode('raw_unicode_escape').decode('utf-8')
    except:
        try:
            # Alternative: use codecs
            import codecs
            decoded = codecs.decode(chunk, 'unicode_escape')
            # Now decoded has latin-1 chars representing UTF-8 bytes
            decoded = decoded.encode('latin-1').decode('utf-8')
        except:
            decoded = chunk
    
    if 'event_list' not in decoded:
        continue
    
    idx = decoded.find('"event_list"')
    if idx < 0:
        continue
    
    arr_start = decoded.find('[', idx)
    if arr_start < 0:
        continue
    
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
        event_list = json.loads(result)
    except:
        continue
    
    output = {
        "year": 1405,
        "source": "time.ir",
        "holidays": [],
        "events": []
    }
    
    # Compute holiday_days_by_month from the main data
    # First, also extract day_list for is_holiday flags
    dl_idx = decoded.find('"day_list"')
    
    for evt in event_list:
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
    
    with open('/tmp/iran_holidays_fixed.json', 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    
    print(f"Events: {len(output['events'])}, Holidays: {len(output['holidays'])}")
    for h in output['holidays']:
        print(f"  {h['jm']:2d}/{h['jd']:2d} {h['title']}")
    
    break
