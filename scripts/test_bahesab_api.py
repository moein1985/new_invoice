import subprocess
import json

# Test bahesab.ir calendar API
# url1 = /cdn/time/Mpostcalendar/ (monthly)
# url2 = /cdn/time/Dpostcalendar/ (daily)
# POST format: string_o=<url-encoded-json>

# Try monthly endpoint with different payloads
payloads = [
    # Try simple year/month
    {"year": 1405, "month": 1},
    {"y": 1405, "m": 1},
    {"Y": 1405, "Mo": 1},
    # Try string format
    "1405-1",
    "1405/1",
    # Try next/prev style
    {"action": "next", "year": 1405, "month": 1},
]

for payload in payloads:
    encoded = json.dumps(payload) if isinstance(payload, dict) else json.dumps(payload)
    
    # Monthly endpoint
    cmd = [
        'curl', '-sL', '--connect-timeout', '5', '--max-time', '8',
        '-X', 'POST',
        '-H', 'Content-Type: application/x-www-form-urlencoded',
        '-H', 'Referer: https://www.bahesab.ir/time/calendar/',
        '-d', f'string_o={encoded}',
        '-o', '/dev/null',
        '-w', '%{http_code}|%{size_download}',
        'https://www.bahesab.ir/cdn/time/Mpostcalendar/'
    ]
    
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=12)
    print(f'Monthly {payload}: {result.stdout.strip()}')

print()

# Also try a click simulation - when you click next month, what data gets sent?
# From the JS code: the text content of year and month-name elements is read
# Let's try sending the month navigation data
test_payloads = [
    'string_o=%5B%221405%22%2C%221%22%5D',  # ["1405","1"] 
    'string_o=%5B1405%2C1%5D',  # [1405,1]
    'string_o=%7B%22y%22%3A1405%2C%22m%22%3A1%7D',  # {"y":1405,"m":1}
    'string_o=1405-1',
    'string_o=%221405-1%22',  # "1405-1"
]

for tp in test_payloads:
    for endpoint in ['Mpostcalendar', 'Dpostcalendar']:
        cmd = [
            'curl', '-sL', '--connect-timeout', '5', '--max-time', '8',
            '-X', 'POST',
            '-H', 'Content-Type: application/x-www-form-urlencoded',
            '-H', 'Referer: https://www.bahesab.ir/time/calendar/',
            '-d', tp,
            f'https://www.bahesab.ir/cdn/time/{endpoint}/'
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=12)
        output = result.stdout.strip()
        if output and len(output) > 10:
            print(f'{endpoint} with {tp}: {len(output)} chars')
            print(f'  Preview: {output[:300]}')
            print()
            # Save the first successful one
            with open(f'/tmp/bahesab_api_{endpoint}_{len(output)}.html', 'w') as f:
                f.write(output)
        else:
            print(f'{endpoint} with {tp}: empty or {output}')
