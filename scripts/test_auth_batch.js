// Test authenticated batch request like browser does
const http = require('http');
const https = require('https');

async function testBatch() {
  // First login to get cookies
  const loginBody = JSON.stringify({
    username: 'admin',
    password: 'admin123'
  });

  // Step 1: Get CSRF token and session
  const csrfRes = await fetch('http://localhost:3000/api/auth/csrf');
  const { csrfToken } = await csrfRes.json();
  const cookies = csrfRes.headers.get('set-cookie') || '';
  console.log('CSRF Token:', csrfToken);
  console.log('Initial cookies:', cookies.substring(0, 100));

  // Step 2: Login with credentials
  const loginRes = await fetch('http://localhost:3000/api/auth/callback/credentials', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': cookies,
    },
    body: `csrfToken=${csrfToken}&username=admin&password=admin123&callbackUrl=http://localhost:3000`,
    redirect: 'manual',
  });
  
  const loginCookies = loginRes.headers.getSetCookie ? loginRes.headers.getSetCookie() : [];
  const allCookies = [cookies, ...loginCookies].join('; ');
  console.log('Login status:', loginRes.status);
  console.log('Login cookies count:', loginCookies.length);

  // Step 3: Get session to verify login
  const sessionRes = await fetch('http://localhost:3000/api/auth/session', {
    headers: { 'Cookie': allCookies },
  });
  const session = await sessionRes.json();
  console.log('Session:', JSON.stringify(session));

  // Step 4: Make batch request like browser
  const input = encodeURIComponent(JSON.stringify({
    "0": {"json": {"startDate": "2026-03-20T20:30:00.000Z", "endDate": "2026-04-30T20:30:00.000Z"}},
    "1": {"json": {"jYear": 1405, "jMonth": 0}}
  }));

  const batchUrl = `http://localhost:3000/api/trpc/calendar.list,calendar.holidays?batch=1&input=${input}`;
  
  // Use session cookies for auth
  const finalCookies = [...loginCookies, cookies].filter(Boolean).join('; ');
  const batchRes = await fetch(batchUrl, {
    headers: { 'Cookie': finalCookies },
  });
  
  const batchData = await batchRes.text();
  console.log('\nBatch response status:', batchRes.status);
  console.log('Batch response (first 1000 chars):', batchData.substring(0, 1000));
  
  // Parse and check holidays specifically
  try {
    const parsed = JSON.parse(batchData);
    if (Array.isArray(parsed) && parsed.length >= 2) {
      console.log('\n=== calendar.list result ===');
      if (parsed[0].result) {
        const listData = parsed[0].result.data.json;
        console.log('Events count:', Array.isArray(listData) ? listData.length : 'not array');
      } else if (parsed[0].error) {
        console.log('ERROR:', JSON.stringify(parsed[0].error));
      }
      
      console.log('\n=== calendar.holidays result ===');
      if (parsed[1].result) {
        const holidays = parsed[1].result.data.json;
        console.log('Holidays count:', Array.isArray(holidays) ? holidays.length : 'not array');
        if (Array.isArray(holidays)) {
          holidays.forEach(h => console.log(`  Day ${h.jDay}: ${h.name}`));
        }
      } else if (parsed[1].error) {
        console.log('ERROR:', JSON.stringify(parsed[1].error));
      }
    } else {
      console.log('Unexpected response format:', JSON.stringify(parsed).substring(0, 500));
    }
  } catch (e) {
    console.log('Parse error:', e.message);
  }
}

testBatch().catch(e => console.error('Fatal:', e.message));
