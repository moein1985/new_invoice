const fs = require('fs');
const code = fs.readFileSync('/app/.next/server/app/api/trpc/[trpc]/route.js', 'utf8');

console.log('File size: ' + code.length);

// Find all 'holidays' occurrences and show context
let idx = 0;
let count = 0;
while (true) {
  idx = code.indexOf('holidays', idx);
  if (idx < 0) break;
  count++;
  // For each occurrence, show a short context
  const context = code.substring(Math.max(0, idx - 30), idx + 50).replace(/\n/g, ' ');
  console.log(count + '. pos=' + idx + ': ...' + context + '...');
  idx += 8;
}

// Find the jYear pattern (from tRPC input validation)
idx = 0;
while (true) {
  idx = code.indexOf('jYear', idx);
  if (idx < 0) break;
  console.log('\njYear at ' + idx + ':');
  console.log(code.substring(Math.max(0, idx - 100), idx + 300));
  idx += 5;
}

// Find jDaysInMonth
idx = code.indexOf('jDaysInMonth');
console.log('\njDaysInMonth at: ' + idx);
if (idx >= 0) {
  console.log(code.substring(Math.max(0, idx - 200), idx + 200));
}

// Find jMonth 
idx = 0;
let jmonthCount = 0;
while (true) {
  idx = code.indexOf('jMonth', idx);
  if (idx < 0) break;
  jmonthCount++;
  if (jmonthCount <= 5) {
    console.log('\njMonth #' + jmonthCount + ' at ' + idx + ':');
    console.log(code.substring(Math.max(0, idx - 50), idx + 100));
  }
  idx += 6;
}
console.log('Total jMonth occurrences: ' + jmonthCount);
