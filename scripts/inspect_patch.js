const fs = require('fs');
const code = fs.readFileSync('/app/.next/server/app/api/trpc/[trpc]/route.js', 'utf8');

// Find __getStatic1405 function
const fnIdx = code.indexOf('function __getStatic1405');
if (fnIdx === -1) {
  console.log('ERROR: __getStatic1405 function NOT FOUND');
  process.exit(1);
}
console.log('=== __getStatic1405 function (first 800 chars) ===');
console.log(code.substring(fnIdx, fnIdx + 800));

// Find the query handler replacement
const ternIdx = code.indexOf('e.jYear===1405');
if (ternIdx === -1) {
  console.log('\nERROR: ternary replacement NOT FOUND');
} else {
  console.log('\n=== Query handler (200 chars around ternary) ===');
  console.log(code.substring(ternIdx - 100, ternIdx + 200));
}

// Find __HOLIDAYS_1405 data sample
const dataIdx = code.indexOf('__HOLIDAYS_1405');
if (dataIdx === -1) {
  console.log('\nERROR: __HOLIDAYS_1405 data NOT FOUND');
} else {
  console.log('\n=== __HOLIDAYS_1405 data sample (first 500 chars) ===');
  console.log(code.substring(dataIdx, dataIdx + 500));
}

// Try to evaluate and check output format
try {
  const dataStart = code.indexOf('var __HOLIDAYS_1405=');
  const dataEnd = code.indexOf('];', dataStart) + 2;
  const dataCode = code.substring(dataStart, dataEnd);
  eval(dataCode);
  
  console.log('\n=== Data check ===');
  console.log('Total entries:', __HOLIDAYS_1405.length);
  console.log('First entry:', JSON.stringify(__HOLIDAYS_1405[0]));
  console.log('Last entry:', JSON.stringify(__HOLIDAYS_1405[__HOLIDAYS_1405.length - 1]));
  
  // Simulate what __getStatic1405 returns for Farvardin (jMonth=0)
  const fnStart = code.indexOf('function __getStatic1405');
  const fnEnd = code.indexOf('\n', fnStart + 200);
  const fnCode = code.substring(fnStart, fnEnd);
  eval(fnCode);
  
  const result = __getStatic1405(1405, 0);
  console.log('\n=== Result for jMonth=0 (Farvardin) ===');
  console.log('Count:', result.length);
  result.forEach(r => console.log(JSON.stringify(r)));
} catch(e) {
  console.log('Eval error:', e.message);
}
