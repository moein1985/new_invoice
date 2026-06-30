const fs = require('fs');
const code = fs.readFileSync('/app/.next/server/app/api/trpc/[trpc]/route.js', 'utf8');

// The error is at line 25, char 10304
// Let's get the lines
const lines = code.split('\n');
console.log('Total lines:', lines.length);

if (lines.length >= 25) {
  const line25 = lines[24]; // 0-indexed
  console.log('Line 25 length:', line25.length);
  console.log('Line 25 at char 10304:', line25.substring(10250, 10400));
}

// Find the full Custom Handler function O
const oIdx = code.indexOf('async function O(e)');
if (oIdx > -1) {
  // Find the end of this function - look for the next function or significant boundary
  let depth = 0;
  let end = oIdx;
  let started = false;
  for (let i = oIdx; i < Math.min(oIdx + 10000, code.length); i++) {
    if (code[i] === '{') { depth++; started = true; }
    if (code[i] === '}') { depth--; }
    if (started && depth === 0) { end = i + 1; break; }
  }
  const customHandler = code.substring(oIdx, end);
  console.log('\n=== Full Custom Handler O ===');
  console.log(customHandler);
}
