import subprocess
import os

# More Iranian calendar/holiday API sources to test
urls = [
    # Popular Iranian services
    ('gahshomar.com', 'https://www.gahshomar.com/'),
    ('owghat.com', 'https://www.owghat.com/'),
    ('jcal.ir', 'https://jcal.ir/'),
    ('taghvim.com', 'https://www.taghvim.com/'),
    ('varzesh3', 'https://www.varzesh3.com/'),  # to test general iran reachability
    ('namad.ir', 'https://www.namad.ir/'),
    
    # Known Persian calendar APIs
    ('persiancalendar.ir', 'https://persiancalendar.ir/'),
    ('shamsi.me', 'https://shamsi.me/'),
    ('taghvim.ir', 'https://taghvim.ir/'),
    ('calendar.ir', 'https://calendar.ir/'),
    
    # Government/official
    ('sanjesh.org', 'https://www.sanjesh.org/'),
    ('ircalendars.com', 'https://ircalendars.com/'),
    
    # Developer APIs
    ('one-api.ir', 'http://one-api.ir/'),
    ('api.keybit.ir', 'https://api.keybit.ir/'),
    ('pholiday.ir', 'http://pholiday.ir/'),
    ('holidayapi.ir', 'https://holidayapi.ir/'),
    
    # More services
    ('bahesab.ir', 'https://www.bahesab.ir/'),
    ('nojumi.ir', 'https://nojumi.ir/'),
    ('taaghche.ir', 'https://taaghche.ir/'),
]

results = []
for name, url in urls:
    try:
        result = subprocess.run(
            ['curl', '-sL', '--connect-timeout', '3', '--max-time', '6',
             '-o', '/dev/null',
             '-w', '%{http_code}|%{size_download}|%{content_type}',
             url],
            capture_output=True, text=True, timeout=10
        )
        status = result.stdout.strip()
        results.append((name, url, status))
        print(f'{name}: {status}')
    except Exception as e:
        results.append((name, url, f'ERROR: {e}'))
        print(f'{name}: ERROR {e}')

# For accessible sites, try common API patterns
print('\n\n=== Testing API endpoints for accessible sites ===')
accessible = [r for r in results if r[2].startswith('200') or r[2].startswith('301') or r[2].startswith('302')]
print(f'Accessible sites: {[r[0] for r in accessible]}')

for name, base_url, _ in accessible:
    domain = base_url.rstrip('/')
    api_urls = [
        f'{domain}/api/events',
        f'{domain}/api/calendar',
        f'{domain}/api/holidays',
        f'{domain}/api/v1/events',
        f'{domain}/api/occasions',
    ]
    for api_url in api_urls:
        try:
            result = subprocess.run(
                ['curl', '-sL', '--connect-timeout', '3', '--max-time', '5',
                 '-o', '/dev/null',
                 '-w', '%{http_code}|%{size_download}|%{content_type}',
                 api_url],
                capture_output=True, text=True, timeout=8
            )
            status = result.stdout.strip()
            code = status.split('|')[0]
            if code not in ('000', '404', '403'):
                print(f'  {api_url}: {status}')
        except:
            pass
