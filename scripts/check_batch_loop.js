const fs = require('fs');
const code = fs.readFileSync('/app/.next/server/app/api/trpc/[trpc]/route.js', 'utf8');

// Find the full batch section
const batchStartIdx = code.indexOf('if(M){let e=n.split(","),a=[];for(let n=0;n<e.length;n++)');
if (batchStartIdx === -1) {
  console.log('Batch section exact match not found, searching...');
  // Broader search
  const idx1 = code.indexOf('M){let e=n.split(",")');
  console.log('Split comma at:', idx1);
  if (idx1 > -1) {
    console.log('Batch section:', code.substring(idx1, idx1 + 1000));
  }
} else {
  console.log('Batch section found at:', batchStartIdx);
  console.log('Batch code:', code.substring(batchStartIdx, batchStartIdx + 1000));
}

// Also check how 'n' variable is used in batch context
// 'n' is the procedure path from URL (e.g., "calendar.list,calendar.holidays")
// In batch mode, 'e' should be n.split(",") giving ["calendar.list", "calendar.holidays"]
// But our debug shows 'n' as a number (0, 1) which is the loop index variable!
// The batch loop reuses 'n' as loop variable: for(let n=0;n<e.length;n++)
// This shadows the outer 'n' (procedure path string)!

console.log('\n=== Checking variable shadowing ===');
const forLoop = code.indexOf('for(let n=0;n<e.length;n++)');
if (forLoop > -1) {
  console.log('for(let n=0...) found at:', forLoop);
  console.log('Context:', code.substring(forLoop, forLoop + 600));
}

// Check how many items c (input) has
// c is parsed from URL input parameter
// For batch, it should be {"0": {...}, "1": {...}}
// The loop iterates procedure names, but accesses c[n.toString()]
// Since loop var n shadows outer n, c[n.toString()] = c["0"], c["1"] etc
