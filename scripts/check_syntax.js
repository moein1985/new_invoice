const fs = require('fs');
const path = '/app/.next/server/app/api/trpc/[trpc]/route.js';
let code = fs.readFileSync(path, 'utf8');

// Find the batch section precisely
// The batch section starts with: M){let e=n.split(","),a=[];for(let n=0;n<e.length;n++)
// And should end with: return console.log("[Custom Handler] Batch success!"),new Response

// Check current state
const hasTry = code.includes('n++){try{');
const hasCatch = code.includes('}catch(_batchErr){');
console.log('Has try:', hasTry);
console.log('Has catch:', hasCatch);

// Find the exact batch code section
const batchMarker = 'n.split(","),a=[];for(let n=0;n<e.length;n++)';
const batchIdx = code.indexOf(batchMarker);
console.log('Batch section at:', batchIdx);

if (batchIdx > -1) {
  // Get the full batch loop - from for start to return statement
  const forStart = code.indexOf('for(let n=0;n<e.length;n++)', batchIdx);
  // Find "}return console.log" which closes the for loop
  const returnIdx = code.indexOf('}return console.log("[Custom Handler] Batch success!")', forStart);
  console.log('For loop at:', forStart, 'Return at:', returnIdx);
  
  if (returnIdx > -1) {
    const batchBody = code.substring(forStart, returnIdx + 1);
    console.log('\n=== Current batch loop ===');
    console.log(batchBody);
    console.log('\n=== Length:', batchBody.length, '===');
    
    // Count braces
    let open = 0, close = 0;
    for (const ch of batchBody) {
      if (ch === '{') open++;
      if (ch === '}') close++;
    }
    console.log('Open braces:', open, 'Close braces:', close);
  }
}
