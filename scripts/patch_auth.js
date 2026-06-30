const fs = require('fs');
const filePath = '/app/.next/server/app/api/trpc/[trpc]/route.js';
let code = fs.readFileSync(filePath, 'utf8');

const oldStr = 'holidays:z.sy.input(';
const newStr = 'holidays:z.ZS.input(';

const idx = code.indexOf(oldStr);
if (idx === -1) {
  // Maybe already patched?
  if (code.includes('holidays:z.ZS.input(')) {
    console.log('ALREADY PATCHED - holidays already uses z.ZS (publicProcedure)');
  } else {
    console.log('ERROR: Pattern not found!');
  }
  process.exit(0);
}

code = code.substring(0, idx) + newStr + code.substring(idx + oldStr.length);
fs.writeFileSync(filePath, code);

console.log('SUCCESS: Changed holidays from protectedProcedure (z.sy) to publicProcedure (z.ZS)');
console.log('Position:', idx);

// Verify
const verify = fs.readFileSync(filePath, 'utf8');
const vIdx = verify.indexOf('holidays:z.ZS.input(');
console.log('Verification - holidays:z.ZS found at:', vIdx);
console.log('Context:', verify.substring(vIdx - 30, vIdx + 80));
