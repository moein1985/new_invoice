const fs = require('fs');
const code = fs.readFileSync('/app/.next/server/app/api/trpc/[trpc]/route.js', 'utf8');

// Check ternary patch
const hasTernary = code.includes('e.jYear===1405?__getStatic1405');
console.log('Ternary patch present:', hasTernary);

// Check the holidays procedure query code
const idx = code.indexOf('holidays:z.sy');
if (idx > -1) {
  console.log('\nHolidays procedure context:');
  console.log(code.substring(idx, idx + 500));
}

// Check what the batch error handling looks like
const batchStart = code.indexOf('if(M){');
if (batchStart > -1) {
  // Find the batch section
  console.log('\n=== Batch section (500 chars) ===');
  console.log(code.substring(batchStart, batchStart + 800));
}

// Check for findMany related code near calendar.list
const findMany = code.indexOf("findMany");
console.log('\nfindMany at char:', findMany);
if (findMany > -1) {
  console.log('Context:', code.substring(Math.max(0,findMany-100), findMany+100));
}

// Check how the error response is structured for batch
const batchErr = code.indexOf('batch")?[{error');
if (batchErr > -1) {
  console.log('\nBatch error response:', code.substring(batchErr-50, batchErr+150));
}
