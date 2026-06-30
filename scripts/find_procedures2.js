const fs = require('fs');
const code = fs.readFileSync('/app/.next/server/app/api/trpc/[trpc]/route.js', 'utf8');

// Find z.ZS usages to confirm it's publicProcedure
const zsMatches = [];
let searchFrom = 0;
while (true) {
  const idx = code.indexOf('z.ZS.input(', searchFrom);
  if (idx === -1) break;
  // Get the procedure name before z.ZS
  const before = code.substring(Math.max(0, idx - 100), idx);
  const nameMatch = before.match(/(\w+):z\.ZS/);
  if (nameMatch) {
    zsMatches.push(nameMatch[1]);
  } else {
    zsMatches.push('(unknown) context: ' + before.slice(-50));
  }
  searchFrom = idx + 10;
}
console.log('z.ZS procedures:', zsMatches);

// Also find z.sy usages
const syMatches = [];
searchFrom = 0;
while (true) {
  const idx = code.indexOf('z.sy.input(', searchFrom);
  if (idx === -1) break;
  const before = code.substring(Math.max(0, idx - 100), idx);
  const nameMatch = before.match(/(\w+):z\.sy/);
  if (nameMatch) {
    syMatches.push(nameMatch[1]);
  } else {
    syMatches.push('(unknown) context: ' + before.slice(-50));
  }
  searchFrom = idx + 10;
}
console.log('z.sy procedures:', syMatches);

// Find o.sy usages
const osyMatches = [];
searchFrom = 0;
while (true) {
  const idx = code.indexOf('o.sy.input(', searchFrom);
  if (idx === -1) break;
  const before = code.substring(Math.max(0, idx - 100), idx);
  const nameMatch = before.match(/(\w+):o\.sy/);
  if (nameMatch) {
    osyMatches.push(nameMatch[1]);
  } else {
    osyMatches.push('(unknown) context: ' + before.slice(-50));
  }
  searchFrom = idx + 10;
}
console.log('o.sy procedures:', osyMatches);

// Find exact location of "holidays:z.sy" to know what to replace
const hIdx = code.indexOf('holidays:z.sy');
if (hIdx > -1) {
  console.log('\n=== EXACT holidays:z.sy found at char', hIdx, '===');
  console.log('Surrounding text:', code.substring(hIdx - 20, hIdx + 80));
}
