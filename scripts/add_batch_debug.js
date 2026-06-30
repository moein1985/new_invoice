const fs = require('fs');
const path = '/app/.next/server/app/api/trpc/[trpc]/route.js';
let code = fs.readFileSync(path, 'utf8');

// Add debug logging before the batch bypass condition
const target = 'let r;if(M==="calendar.holidays"&&z&&z.jYear===1405)';
const replacement = 'let r;console.log("[BATCH DEBUG] n="+n+", M="+M+", z="+JSON.stringify(z).substring(0,200)+", typeJYear="+typeof(z&&z.jYear)+", jYear="+(z&&z.jYear));if(M==="calendar.holidays"&&z&&z.jYear===1405)';

const count = code.split(target).length - 1;
console.log('Found debug target:', count, 'time(s)');

if (count === 1) {
  code = code.replace(target, replacement);
  fs.writeFileSync(path, code);
  console.log('SUCCESS: Added debug logging');
} else {
  console.log('ERROR: Could not find target');
  // Search for nearby code
  const idx = code.indexOf('if(M==="calendar.holidays"');
  if (idx > -1) {
    console.log('Found condition at:', idx);
    console.log('Context:', code.substring(Math.max(0, idx-100), idx+200));
  }
}
