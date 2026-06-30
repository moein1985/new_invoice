const http = require('http');

function httpGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const opts = { hostname: u.hostname, port: u.port, path: u.pathname + u.search, method: 'GET', headers };
    const req = http.request(opts, (res) => {
      let data = '';
      const respHeaders = res.headers;
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, data, headers: respHeaders, rawHeaders: res.rawHeaders }));
    });
    req.on('error', reject);
    req.end();
  });
}

function httpPost(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const opts = { hostname: u.hostname, port: u.port, path: u.pathname + u.search, method: 'POST', headers: { ...headers, 'Content-Length': Buffer.byteLength(body) } };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, data, headers: res.headers }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function extractCookies(headers) {
  const setCookie = headers['set-cookie'] || [];
  return setCookie.map(c => c.split(';')[0]).join('; ');
}

async function main() {
  // Step 1: Get CSRF
  const csrfRes = await httpGet('http://127.0.0.1:3000/api/auth/csrf');
  const { csrfToken } = JSON.parse(csrfRes.data);
  let cookies = extractCookies(csrfRes.headers);
  console.log('CSRF:', csrfToken);
  console.log('Cookies1:', cookies);

  // Step 2: Login
  const loginBody = `csrfToken=${csrfToken}&username=admin&password=admin123&callbackUrl=http%3A%2F%2Flocalhost%3A3000`;
  const loginRes = await httpPost('http://127.0.0.1:3000/api/auth/callback/credentials', loginBody, {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Cookie': cookies,
  });
  const loginCookies = extractCookies(loginRes.headers);
  if (loginCookies) cookies = loginCookies + '; ' + cookies;
  console.log('Login status:', loginRes.status);
  console.log('Cookies2:', cookies.substring(0, 200));

  // Step 3: Check session  
  const sessionRes = await httpGet('http://127.0.0.1:3000/api/auth/session', { 'Cookie': cookies });
  console.log('Session:', sessionRes.data.substring(0, 200));

  // Step 4: Batch request
  const input = encodeURIComponent(JSON.stringify({
    "0": {"json": {"startDate": "2026-03-20T20:30:00.000Z", "endDate": "2026-04-30T20:30:00.000Z"}},
    "1": {"json": {"jYear": 1405, "jMonth": 0}}
  }));
  const batchUrl = `http://127.0.0.1:3000/api/trpc/calendar.list,calendar.holidays?batch=1&input=${input}`;
  const batchRes = await httpGet(batchUrl, { 'Cookie': cookies });
  
  console.log('\nBatch status:', batchRes.status);
  
  try {
    const parsed = JSON.parse(batchRes.data);
    if (Array.isArray(parsed)) {
      console.log('Response array length:', parsed.length);
      
      // Check calendar.list
      if (parsed[0]) {
        if (parsed[0].result) console.log('calendar.list: OK, events:', JSON.stringify(parsed[0].result.data.json).length, 'chars');
        else console.log('calendar.list ERROR:', JSON.stringify(parsed[0].error));
      }
      
      // Check calendar.holidays
      if (parsed[1]) {
        if (parsed[1].result) {
          const h = parsed[1].result.data.json;
          console.log('calendar.holidays: OK, count:', Array.isArray(h) ? h.length : 'not-array');
          if (Array.isArray(h)) h.forEach(x => console.log('  Day', x.jDay + ':', x.name));
        } else {
          console.log('calendar.holidays ERROR:', JSON.stringify(parsed[1].error));
        }
      } else {
        console.log('calendar.holidays: MISSING from response!');
      }
    } else {
      console.log('Not an array:', JSON.stringify(parsed).substring(0, 300));
    }
  } catch (e) {
    console.log('Raw response:', batchRes.data.substring(0, 500));
  }
}

main().catch(e => console.error('Error:', e.message, e.stack));
