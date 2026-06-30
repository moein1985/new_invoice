const fs = require('fs');
const code = fs.readFileSync('/app/.next/server/app/api/trpc/[trpc]/route.js', 'utf8');
const idx = code.indexOf('(0,p.k)(e.jYear');
if (idx >= 0) {
  console.log('Found at: ' + idx);
  console.log('CONTEXT (200 chars before and after):');
  console.log(code.substring(Math.max(0, idx - 200), idx + 200));
  console.log('\n--- END ---');
}
