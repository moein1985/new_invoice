const fs = require('fs');

// Search across all server chunks for holiday-related code
const dir = '/app/.next/server/';
const serverJS = fs.readFileSync('/app/server.js', 'utf8');

// Check server.js for holidays
let idx = serverJS.indexOf('holidays');
console.log('server.js holidays at: ' + idx);

// Check all chunk files
const chunks = fs.readdirSync(dir + 'chunks/');
for (const chunk of chunks) {
  if (!chunk.endsWith('.js')) continue;
  const code = fs.readFileSync(dir + 'chunks/' + chunk, 'utf8');
  
  // Search for the tRPC procedure name
  const hidx = code.indexOf('holidays');
  if (hidx >= 0) {
    console.log('\n=== ' + chunk + ': holidays at ' + hidx + ' ===');
    // Show context
    console.log(code.substring(Math.max(0, hidx - 100), hidx + 100));
  }
}

// Also check app routes
const walk = (d) => {
  try {
    const items = fs.readdirSync(d);
    for (const item of items) {
      const p = d + '/' + item;
      const stat = fs.statSync(p);
      if (stat.isDirectory()) walk(p);
      else if (item.endsWith('.js')) {
        const code = fs.readFileSync(p, 'utf8');
        if (code.includes('holidays') && code.includes('jYear')) {
          console.log('\n=== FOUND: ' + p + ' ===');
          const i = code.indexOf('holidays');
          console.log(code.substring(Math.max(0, i - 100), i + 200));
        }
      }
    }
  } catch(e) {}
};
walk('/app/.next/server/app');
