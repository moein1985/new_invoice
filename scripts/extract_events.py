#!/usr/bin/env python3
"""Extract event/holiday data from time.ir RSC payload"""
import re, json, sys

html = open('/tmp/timeir_main.html', 'r', encoding='utf-8').read()

# Find all RSC chunks
chunks = re.findall(r'self\.__next_f\.push\(\[1,"(.*?)"\]\)', html)
print(f"Total RSC chunks: {len(chunks)}")

# Decode each chunk and look for event data
for i, chunk in enumerate(chunks):
    try:
        decoded = chunk.encode('utf-8').decode('unicode_escape')
    except:
        decoded = chunk
    
    # Look for currentDateTime which should contain today's events
    if 'currentDateTime' in decoded:
        print(f"\n=== Chunk {i}: currentDateTime ===")
        # Extract the JSON-like data around currentDateTime
        start = decoded.find('currentDateTime')
        segment = decoded[start:start+5000]
        print(segment)
    
    # Look for todayEvents or eventList
    if 'eventList' in decoded.lower() or 'todayEvent' in decoded.lower() or 'events' in decoded:
        print(f"\n=== Chunk {i}: Events data ===")
        # Find the events array
        for key in ['eventList', 'todayEvents', 'events', 'EventList']:
            idx = decoded.find(key)
            if idx >= 0:
                segment = decoded[idx:idx+3000]
                print(f"Key '{key}' at pos {idx}:")
                print(segment[:2000])
                print()

    # Look for specific event-related HTML structures
    if 'EventListItem' in decoded and ('title' in decoded.lower()):
        # Find event items
        event_items = re.findall(r'EventListItem.*?(?:title|children)["\s:]*["\s]*([^\\"]{5,100})', decoded)
        if event_items:
            print(f"\n=== Chunk {i}: EventListItem items ===")
            for item in event_items[:20]:
                print(f"  - {item}")

# Also search for the CalendarDaysItem data which shows which days are holidays
print("\n\n=== Calendar data ===")
for i, chunk in enumerate(chunks):
    try:
        decoded = chunk.encode('utf-8').decode('unicode_escape')
    except:
        decoded = chunk
    
    if 'CalendarDays' in decoded and 'holiday' in decoded.lower():
        # Extract day numbers and holiday status
        print(f"\nChunk {i}: Calendar day data found ({len(decoded)} chars)")
        # Find patterns like day numbers with holiday markers
        parts = decoded.split('CalendarDaysItem')
        for j, part in enumerate(parts[:5]):
            if 'holiday' in part.lower():
                print(f"  Part {j}: ...{part[:500]}...")
        break

# method 2: Look for the actual events section with Persian text
print("\n\n=== Persian event text extraction ===")
# Find all Persian text segments near event/holiday markers
persian_pattern = r'[\u0600-\u06FF\u0020]{5,100}'
for i, chunk in enumerate(chunks):
    try:
        decoded = chunk.encode('utf-8').decode('unicode_escape')
    except:
        decoded = chunk
    
    if 'holiday' in decoded.lower() and re.search(persian_pattern, decoded):
        persian_texts = re.findall(persian_pattern, decoded)
        if persian_texts:
            print(f"\nChunk {i} Persian texts near holidays:")
            for t in persian_texts[:30]:
                t = t.strip()
                if len(t) > 3:
                    print(f"  {t}")
