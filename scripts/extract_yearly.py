#!/usr/bin/env python3
"""Extract yearly events from time.ir event-year page"""
import re, json

html = open('/tmp/timeir_events.html', 'r', encoding='utf-8').read()

# Find RSC chunks  
chunks = re.findall(r'self\.__next_f\.push\(\[1,"(.*?)"\]\)', html)
print(f"Total RSC chunks: {len(chunks)}")

# Look for defaultEventData or similar
for i, chunk in enumerate(chunks):
    try:
        decoded = chunk.encode('utf-8').decode('unicode_escape')
    except:
        decoded = chunk
    
    # Look for event data structures
    if 'event_list' in decoded.lower() or 'defaultEvent' in decoded or 'yearEvent' in decoded.lower():
        print(f"\n=== Chunk {i} ({len(decoded)} chars) ===")
        
        # Try to find event_list
        for key in ['event_list', 'eventList', 'yearEvents', 'defaultEventYear']:
            idx = decoded.find(f'"{key}"')
            if idx < 0:
                idx = decoded.find(key)
            if idx >= 0:
                print(f"Found '{key}' at pos {idx}")
                # Show surrounding context
                start = max(0, idx - 50)
                end = min(len(decoded), idx + 2000)
                print(decoded[start:end])
                print("...")

# Method 2: Look for data patterns - month/day/title structures
print("\n\n=== Looking for month-based event structures ===")
for i, chunk in enumerate(chunks):
    try:
        decoded = chunk.encode('utf-8').decode('unicode_escape')
    except:
        decoded = chunk
    
    # Look for patterns like {"month":1,"day":1,"title":"..."} or similar
    if '"month"' in decoded and '"day"' in decoded:
        print(f"\nChunk {i}: month/day data ({len(decoded)} chars)")
        
        # Find all month/day occurrences
        for m in re.finditer(r'"month"\s*:\s*(\d+)', decoded):
            pos = m.start()
            context = decoded[max(0,pos-100):pos+500]
            # Only show a few
            print(f"  Context: {context[:300]}")
            print()
            break  # Just show first one per chunk

# Method 3: Look for the raw data object with all events
print("\n=== Looking for defaultCriteria/defaultData ===")
for i, chunk in enumerate(chunks):
    try:
        decoded = chunk.encode('utf-8').decode('unicode_escape')
    except:
        decoded = chunk
    
    if 'defaultCriteria' in decoded or 'defaultData' in decoded or 'defaultEventYear' in decoded:
        print(f"\nChunk {i}: {len(decoded)} chars")
        # Find the structure
        for key in ['defaultCriteria', 'defaultData', 'defaultEventYear', 'defaultYearEvent']:
            idx = decoded.find(f'"{key}"')
            if idx >= 0:
                print(f"Found '{key}': {decoded[idx:idx+500]}")
                print()
