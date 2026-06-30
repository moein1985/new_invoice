import subprocess
import json

# Test various potential API endpoints on time.ir
urls = [
    'https://www.time.ir/api/events',
    'https://www.time.ir/api/calendar',  
    'https://api.time.ir/v1/events',
    'https://www.time.ir/fa/event/list/1405/1',
    'https://www.time.ir/event-year/1405',
    'https://www.time.ir/jalali-calendar/1405/1',
]

for url in urls:
    try:
        result = subprocess.run(
            ['curl', '-sL', '--max-time', '5', '-o', '/dev/null', '-w', '%{http_code}|%{content_type}', url],
            capture_output=True, text=True, timeout=10
        )
        print(f'{url} -> {result.stdout}')
    except:
        print(f'{url} -> TIMEOUT')

# Also try fetching the jalali-calendar page
result = subprocess.run(
    ['curl', '-sL', '--max-time', '10', '-o', '/tmp/jcal.html', 'https://www.time.ir/jalali-calendar'],
    capture_output=True, text=True, timeout=15
)
import os
if os.path.exists('/tmp/jcal.html'):
    size = os.path.getsize('/tmp/jcal.html')
    print(f'\njalali-calendar page size: {size} bytes')
    
    html = open('/tmp/jcal.html', 'r', encoding='utf-8').read()
    
    # Look for day cells with event data
    import re
    # Find isHoliday or holiday markers
    holidays = re.findall(r'holiday|isHoliday|is_holiday', html, re.I)
    print(f'Holiday markers found: {len(holidays)}')
    
    # Find any JSON data structures
    json_blocks = re.findall(r'\{[^{}]{20,200}(?:day|date|event)[^{}]{20,200}\}', html, re.I)
    for j in json_blocks[:5]:
        print(f'JSON block: {j[:200]}')
