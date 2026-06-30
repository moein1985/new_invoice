import subprocess
import re

# bahesab.ir has calendar tools - let's check for event/holiday data
urls = [
    ('bahesab main', 'https://www.bahesab.ir/'),
    ('bahesab time', 'https://www.bahesab.ir/time/'),
    ('bahesab calendar', 'https://www.bahesab.ir/time/calendar/'),
    ('bahesab holidays', 'https://www.bahesab.ir/time/holidays/'),
    ('bahesab occasions', 'https://www.bahesab.ir/time/occasions/'),
    ('bahesab event', 'https://www.bahesab.ir/time/event/'),
    ('bahesab today', 'https://www.bahesab.ir/time/today/'),
    ('bahesab 1405/01', 'https://www.bahesab.ir/time/calendar/1405/01/'),
    ('bahesab 1405/1', 'https://www.bahesab.ir/time/calendar/1405/1/'),
    ('bahesab jalali', 'https://www.bahesab.ir/time/jalali/'),
    # Try API-style
    ('bahesab api', 'https://www.bahesab.ir/api/'),
    ('bahesab api cal', 'https://www.bahesab.ir/api/calendar/'),
    # Try time.ir other pages
    ('time.ir main', 'https://www.time.ir/'),
    ('time.ir fa', 'https://www.time.ir/fa/'),
    ('time.ir event-day', 'https://www.time.ir/event-day/1405/1/22'),
    ('time.ir event-month', 'https://www.time.ir/event-month/1405/1'),
]

for name, url in urls:
    try:
        result = subprocess.run(
            ['curl', '-sL', '--connect-timeout', '3', '--max-time', '8',
             '-o', f'/tmp/bahesab_{name.replace(" ","_").replace("/","_")}.html',
             '-w', '%{http_code}|%{size_download}|%{content_type}',
             url],
            capture_output=True, text=True, timeout=12
        )
        print(f'{name}: {result.stdout.strip()}')
    except Exception as e:
        print(f'{name}: ERROR {e}')

# Check bahesab time page for event/holiday data
import os
for fn in ['bahesab_bahesab_time.html', 'bahesab_bahesab_today.html', 'bahesab_bahesab_calendar.html', 'bahesab_bahesab_holidays.html', 'bahesab_bahesab_1405_01.html', 'bahesab_bahesab_1405_1.html', 'bahesab_time.ir_event-day_1405_1_22.html', 'bahesab_time.ir_event-month_1405_1.html']:
    path = f'/tmp/{fn}'
    if os.path.exists(path) and os.path.getsize(path) > 100:
        with open(path, 'r', encoding='utf-8', errors='ignore') as f:
            html = f.read()
            holidays = re.findall(r'holiday|tatil|تعطیل|مناسبت|رویداد', html, re.I)
            if holidays:
                print(f'\n--- {fn} ({os.path.getsize(path)} bytes) ---')
                print(f'  Holiday markers: {len(holidays)}')
                # Show some context
                for m in re.finditer(r'.{0,30}(تعطیل|مناسبت|رویداد|holiday).{0,100}', html):
                    print(f'  Context: {m.group()[:150]}')
                    break
