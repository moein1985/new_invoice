#!/bin/bash
# Test authenticated batch request

# Step 1: Get CSRF
CSRF=$(curl -s -c /tmp/test_cookies.txt http://localhost:3000/api/auth/csrf | python3 -c 'import sys,json; print(json.load(sys.stdin)["csrfToken"])')
echo "CSRF: $CSRF"

# Step 2: Login
LOGIN_STATUS=$(curl -s -L -b /tmp/test_cookies.txt -c /tmp/test_cookies.txt -X POST \
  http://localhost:3000/api/auth/callback/credentials \
  -d "csrfToken=${CSRF}&username=admin&password=admin123" \
  -o /dev/null -w '%{http_code}')
echo "Login status: $LOGIN_STATUS"

# Step 3: Check session
echo "Session:"
curl -s -b /tmp/test_cookies.txt http://localhost:3000/api/auth/session
echo ""

# Step 4: Batch request
INPUT='{"0":{"json":{"startDate":"2026-03-20T20:30:00.000Z","endDate":"2026-04-30T20:30:00.000Z"}},"1":{"json":{"jYear":1405,"jMonth":0}}}'
ENCODED=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$INPUT'))")

echo ""
echo "Batch request:"
curl -s -b /tmp/test_cookies.txt \
  "http://localhost:3000/api/trpc/calendar.list,calendar.holidays?batch=1&input=${ENCODED}" | \
  python3 -c "
import sys, json
data = json.load(sys.stdin)
if isinstance(data, list):
    print(f'Response array length: {len(data)}')
    for i, item in enumerate(data):
        name = ['calendar.list', 'calendar.holidays'][i] if i < 2 else f'item[{i}]'
        if 'result' in item:
            d = item['result']['data']['json']
            if isinstance(d, list):
                print(f'{name}: OK, count={len(d)}')
                if name == 'calendar.holidays':
                    for h in d:
                        print(f'  Day {h.get(\"jDay\",\"?\")}: {h.get(\"name\",\"?\")[:50]}')
            else:
                print(f'{name}: OK, type={type(d).__name__}')
        elif 'error' in item:
            print(f'{name}: ERROR - {item[\"error\"]}')
else:
    print(f'Unexpected: {json.dumps(data)[:300]}')
"
