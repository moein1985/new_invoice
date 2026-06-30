const fs = require('fs');
const path = '/app/.next/server/app/api/trpc/[trpc]/route.js';
let code = fs.readFileSync(path, 'utf8');

// The issue: batch loop ends with }}} but should end with }}
// for(...){try{...}catch{...}} <-- correct: for{ try{}catch{} }
// But we have: for(...){try{...}catch{...}}} <-- extra }

// Fix: find the specific broken ending
const broken = '}}})}return console.log("[Custom Handler] Batch success!")';
const fixed = '}})}return console.log("[Custom Handler] Batch success!")';

const brokenAlt = 'code:_batchErr.code||"INTERNAL_SERVER_ERROR"}}})}return';
const fixedAlt = 'code:_batchErr.code||"INTERNAL_SERVER_ERROR"}})}return';

if (code.includes(broken)) {
  code = code.replace(broken, fixed);
  fs.writeFileSync(path, code);
  console.log('Fixed: removed extra }');
} else if (code.includes(brokenAlt)) {
  code = code.replace(brokenAlt, fixedAlt);
  fs.writeFileSync(path, code);
  console.log('Fixed (alt): removed extra }');
} else {
  // More precise: find the triple closing brace after catch
  console.log('Searching for the exact break point...');
  const catchEnd = code.indexOf('}catch(_batchErr){');
  if (catchEnd > -1) {
    // Find the end of catch block
    const afterCatch = code.indexOf('INTERNAL_SERVER_ERROR"', catchEnd);
    if (afterCatch > -1) {
      // Get 20 chars after
      const snippet = code.substring(afterCatch, afterCatch + 80);
      console.log('After INTERNAL_SERVER_ERROR:', JSON.stringify(snippet));
      
      // The pattern should be: ...INTERNAL_SERVER_ERROR"}})}} followed by }return
      // We need: ...INTERNAL_SERVER_ERROR"}})}} followed by return (no extra })
    }
  }
}

// Verify
const verify = fs.readFileSync(path, 'utf8');
const batchStart = verify.indexOf('for(let n=0;n<e.length;n++)');
const batchReturn = verify.indexOf('}return console.log("[Custom Handler] Batch success!")', batchStart);
if (batchReturn > -1) {
  const batchBody = verify.substring(batchStart, batchReturn + 1);
  let open = 0, close = 0;
  for (const ch of batchBody) {
    if (ch === '{') open++;
    if (ch === '}') close++;
  }
  console.log('Verify - Open:', open, 'Close:', close, 'Match:', open === close);
}

// Also try to eval the batch loop for syntax
try {
  const batchBody2 = verify.substring(batchStart, batchReturn + 1);
  // Wrap in async function to validate syntax
  new Function('return async function(){' + batchBody2 + '}');
  console.log('Syntax check: PASS');
} catch(e) {
  console.log('Syntax check: FAIL -', e.message);
}
