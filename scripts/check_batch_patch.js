const fs = require('fs');
const code = fs.readFileSync('/app/.next/server/app/api/trpc/[trpc]/route.js', 'utf8');
console.log('Has Batch holidays bypass:', code.includes('Batch holidays bypass'));
console.log('Has __HOLIDAYS_1405:', code.includes('__HOLIDAYS_1405'));
console.log('Has Holidays bypass for:', code.includes('Holidays bypass for'));

// Find the batch loop code
const idx = code.indexOf('Batch holidays bypass');
if (idx > -1) {
  console.log('\n=== Context around batch bypass ===');
  console.log(code.substring(Math.max(0, idx - 300), idx + 200));
} else {
  console.log('\nBatch bypass NOT found! Looking for batch loop...');
  const batchIdx = code.indexOf('let r=await O[i](z);a.push');
  if (batchIdx > -1) {
    console.log('Found old batch code at:', batchIdx);
    console.log(code.substring(Math.max(0, batchIdx - 200), batchIdx + 200));
  }
  // Also check for the patched version
  const patchedIdx = code.indexOf('calendar.holidays');
  console.log('\ncalendar.holidays occurrences:');
  let searchFrom = 0;
  let count = 0;
  while (true) {
    const i = code.indexOf('calendar.holidays', searchFrom);
    if (i === -1) break;
    count++;
    console.log(`  #${count} at char ${i}: ...${code.substring(Math.max(0,i-50), i+80)}...`);
    searchFrom = i + 1;
  }
}
