const fs = require('fs');
const code = fs.readFileSync('/app/.next/server/app/api/trpc/[trpc]/route.js', 'utf8');

// Find the holidays procedure definition
const holidaysIdx = code.indexOf('holidays:');
if (holidaysIdx === -1) {
  // Try finding it near our patched ternary
  const ternIdx = code.indexOf('e.jYear===1405');
  console.log('No "holidays:" found. Ternary at:', ternIdx);
  if (ternIdx > -1) {
    console.log('Context around ternary (500 chars before):');
    console.log(code.substring(ternIdx - 500, ternIdx + 200));
  }
} else {
  console.log('=== holidays procedure definition (300 chars) ===');
  console.log(code.substring(holidaysIdx, holidaysIdx + 300));
  
  // Look backwards to find the procedure type
  console.log('\n=== 200 chars BEFORE holidays: ===');
  console.log(code.substring(holidaysIdx - 200, holidaysIdx));
}

// Find what publicProcedure looks like - search for a procedure that's definitely public
// The login/auth routes should use publicProcedure
const publicPatterns = ['publicProcedure', 'public_procedure', 'publicProc'];
for (const p of publicPatterns) {
  const idx = code.indexOf(p);
  if (idx > -1) {
    console.log(`\nFound "${p}" at char ${idx}`);
    console.log(code.substring(idx - 100, idx + 100));
  }
}

// Look for procedure definitions pattern - find what z.sy is and what alternatives exist
// The pattern is likely: procedure_var.input(...).query(...)
const ternIdx = code.indexOf('e.jYear===1405');
if (ternIdx > -1) {
  // Go back to find the procedure variable
  const segment = code.substring(ternIdx - 600, ternIdx);
  // Find the pattern like "X.input(" 
  const matches = segment.match(/(\w+\.\w+)\.input\(/g);
  if (matches) {
    console.log('\n=== Procedure patterns found near holidays ===');
    matches.forEach(m => console.log(m));
  }
}

// Search for the router definition to find both protected and public procedure variables
// Look for createTRPCRouter or similar patterns
const routerIdx = code.indexOf('createTRPCRouter');
if (routerIdx > -1) {
  console.log('\n=== createTRPCRouter context ===');
  console.log(code.substring(routerIdx - 100, routerIdx + 300));
}

// Find the calendar router definition  
const calIdx = code.indexOf('calendar:');
if (calIdx > -1) {
  console.log('\n=== calendar router definition ===');
  console.log(code.substring(calIdx - 50, calIdx + 200));
}

// More specific: find the variable that's used with .input right before holidays
const seg2 = code.substring(ternIdx - 300, ternIdx);
const procMatch = seg2.match(/holidays:(\w+(?:\.\w+)?)\.input/);
if (procMatch) {
  const procVar = procMatch[1];
  console.log('\n=== holidays uses procedure variable:', procVar, '===');
  
  // Now find all OTHER procedure variables used in the same router
  const routerSeg = code.substring(ternIdx - 5000, ternIdx + 1000);
  const allProcs = [...new Set(routerSeg.match(/(\w+(?:\.\w+)?)\.input\(/g))];
  console.log('All procedure patterns in calendar router:');
  allProcs.forEach(p => console.log(' ', p));
}
