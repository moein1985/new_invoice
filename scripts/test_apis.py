import subprocess
import os

# Test various Iranian holiday/calendar APIs
urls = [
    ('holidayapi.ir', 'https://holidayapi.ir/jalali/1405/01'),
    ('farsicalendar', 'https://farsicalendar.com/api/sh/1405/1'),
    ('pholiday', 'https://pholiday.herokuapp.com/api/1405/1'),
    ('persian-calendar-api', 'https://persiancalendarapi.ir/api/events?year=1405&month=1'),
    ('time.ir today', 'https://www.time.ir/today'),
    ('time.ir jalali', 'https://www.time.ir/jalali-calendar'),
    ('time.ir event-year', 'https://www.time.ir/event-year'),
    ('one-api', 'https://one-api.ir/calendar/?year=1405&month=1'),
    ('bahmanweb', 'https://api.bahmanweb.com/api/v1/calendar/1405/1'),
]

for name, url in urls:
    try:
        result = subprocess.run(
            ['curl', '-sL', '--connect-timeout', '5', '--max-time', '8', 
             '-o', f'/tmp/test_{name.replace(" ","_").replace(".","_")}.txt',
             '-w', '%{http_code}|%{size_download}|%{content_type}',
             url],
            capture_output=True, text=True, timeout=12
        )
        print(f'{name}: {result.stdout}')
    except Exception as e:
        print(f'{name}: ERROR {e}')

# Now check files that got data
print('\n=== Content samples ===')
for f in os.listdir('/tmp'):
    if f.startswith('test_') and f.endswith('.txt'):
        path = f'/tmp/{f}'
        size = os.path.getsize(path)
        if 0 < size < 50000:
            with open(path, 'r', encoding='utf-8', errors='ignore') as fh:
                content = fh.read(500)
                if content.strip():
                    print(f'\n--- {f} ({size} bytes) ---')
                    print(content[:500])
