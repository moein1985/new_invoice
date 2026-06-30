const fs = require('fs');
const path = '/app/.next/server/app/api/trpc/[trpc]/route.js';
let code = fs.readFileSync(path, 'utf8');

// The batch loop currently throws on error, killing the whole batch.
// We need to wrap each procedure call in try-catch so one failure
// doesn't prevent others from running.
//
// Current batch loop (after our debug + bypass patches):
//   for(let n=0;n<e.length;n++){
//     let M=e[n],b=c[n.toString()],z=b?.json!==void 0?b.json:b,[o,i]=M.split(".");
//     ...
//     a.push({result:{data:{json:r}}})
//   }
//
// We want to add try-catch around the inner contents so each item
// can fail independently.

// Strategy: Wrap from "{let M=e[n]" to "a.push({result:..." in try-catch
// The simplest approach: replace the batch loop's throw + push pattern

// First, remove the debug logging we added (it's noisy)
const debugLog = 'console.log("[BATCH DEBUG] n="+n+", M="+M+", z="+JSON.stringify(z).substring(0,200)+", typeJYear="+typeof(z&&z.jYear)+", jYear="+(z&&z.jYear));';
if (code.includes(debugLog)) {
  code = code.replace(debugLog, '');
  console.log('Removed debug logging');
}

// Now, find the batch for loop and wrap each iteration in try-catch
// Current: for(let n=0;n<e.length;n++){let M=e[n],...a.push({result:{data:{json:r}}})}
// Target: for(let n=0;n<e.length;n++){try{let M=e[n],...a.push({result:{data:{json:r}}})}catch(_err){a.push({error:{json:{message:_err.message||"Unknown error",code:_err.code||"INTERNAL_SERVER_ERROR"}}})}}

// Find the start of loop body
const loopStart = 'for(let n=0;n<e.length;n++){let M=e[n]';
const loopIdx = code.indexOf(loopStart);
if (loopIdx === -1) {
  console.log('ERROR: Cannot find batch loop start');
  process.exit(1);
}
console.log('Found batch loop at:', loopIdx);

// Find "a.push({result:{data:{json:r}}})" which ends the loop body
const pushPattern = 'a.push({result:{data:{json:r}}})';
const pushIdx = code.indexOf(pushPattern, loopIdx);
if (pushIdx === -1) {
  console.log('ERROR: Cannot find push pattern');
  process.exit(1);
}
console.log('Found push at:', pushIdx);

// The end of the loop body is after the push + closing brace
// We need: for(let n=0;n<e.length;n++){try{...a.push(...)}catch(_e){a.push({error:...})}}
const newLoopStart = 'for(let n=0;n<e.length;n++){try{let M=e[n]';
const newPushEnd = 'a.push({result:{data:{json:r}}})}catch(_batchErr){console.log("[Custom Handler] Batch item error for "+e[n]+": "+(_batchErr.message||_batchErr));a.push({error:{json:{message:_batchErr.message||"Unknown error",code:_batchErr.code||"INTERNAL_SERVER_ERROR"}}})}}';

// Replace loop start
code = code.replace(loopStart, newLoopStart);
console.log('Replaced loop start with try{');

// Replace push + closing brace
// After push, there should be } (end of for body)
// We replace "a.push({result:{data:{json:r}}})" with the try-catch wrapped version
code = code.replace(pushPattern, newPushEnd);
console.log('Replaced push with try-catch end');

fs.writeFileSync(path, code);
console.log('File saved');

// Verify
const verify = fs.readFileSync(path, 'utf8');
console.log('\nVerify try{:', verify.includes('n++){try{'));
console.log('Verify catch:', verify.includes('}catch(_batchErr){'));
console.log('Verify bypass:', verify.includes('Batch holidays bypass'));
console.log('Verify __HOLIDAYS_1405:', verify.includes('__HOLIDAYS_1405'));
