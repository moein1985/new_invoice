const fs = require('fs');
const code = fs.readFileSync('/app/.next/server/app/api/trpc/[trpc]/route.js', 'utf8');
console.log('Has holidays:z.ZS:', code.includes('holidays:z.ZS'));
console.log('Has holidays:z.sy:', code.includes('holidays:z.sy'));
const idx = code.indexOf('holidays:z.');
if (idx > -1) {
  console.log('Context:', code.substring(idx, idx + 80));
}

// Also check if there's a middleware/wrapper doing auth
// Look at the Custom Handler code
const chIdx = code.indexOf('Custom Handler');
if (chIdx > -1) {
  console.log('\nCustom Handler context:', code.substring(chIdx - 200, chIdx + 500).substring(0, 700));
}

// Check what z.ZS actually is
const zsIdx = code.indexOf('ZS:()=>');
if (zsIdx > -1) {
  console.log('\nZS definition:', code.substring(zsIdx, zsIdx + 100));
}
const syIdx = code.indexOf('sy:()=>');  
if (syIdx > -1) {
  console.log('sy definition:', code.substring(syIdx, syIdx + 100));
}
