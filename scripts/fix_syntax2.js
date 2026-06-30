const fs = require('fs');
const path = '/app/.next/server/app/api/trpc/[trpc]/route.js';
let code = fs.readFileSync(path, 'utf8');

// Let me find and show the exact problematic area
const idx = code.indexOf('INTERNAL_SERVER_ERROR');
const area = code.substring(idx, idx + 200);
console.log('Area around INTERNAL_SERVER_ERROR:', JSON.stringify(area));

// The correct structure for the for loop should be:
// for(let n=0;n<e.length;n++){
//   try{
//     ...body...
//     a.push({result:{data:{json:r}}})
//   }catch(_batchErr){
//     ...handler...
//     a.push({error:{json:{message:...,code:...}}})
//   }
// }
//
// In minified: for(let n=0;n<e.length;n++){try{...a.push({result:{data:{json:r}}})}catch(_batchErr){...a.push({error:{json:{message:...,code:...}}})}}
//
// The closing should be: ...code:...}}})} }  <- 
// a.push( { error: { json: { message:..., code:... } } } )  -> }}})
// }  <- end of catch block
// }  <- end of for body

// So fixing: replace everything between INTERNAL_SERVER_ERROR" and the return statement

const returnMarker = 'return console.log("[Custom Handler] Batch success!")';
const returnIdx = code.indexOf(returnMarker);
const intErrIdx = code.indexOf('"INTERNAL_SERVER_ERROR"');

// From after "INTERNAL_SERVER_ERROR" to before "return" should be: "}}})}}
// That's: close json, close error, close push paren, close catch, close for, close if(M)
// Wait, no! The if(M) block wraps the entire batch section.
// Structure:
// if(M) {
//   let e=n.split(","),a=[];
//   for(let n=0;n<e.length;n++) {
//     try {
//       ...a.push({result:{data:{json:r}}})
//     } catch(_batchErr) {
//       ...a.push({error:{json:{message:...,code:_batchErr.code||"INTERNAL_SERVER_ERROR"}}})
//     }
//   }
//   return ...
// }

// So after INTERNAL_SERVER_ERROR":
// "} } } ) } }  return..."
//  ^   ^ ^ ^ ^ ^
//  |   | | | | |-- end of if(M) block? No, that's too many
//  |   | | | |-- end of for loop body
//  |   | | |-- end of catch block
//  |   | |-- closing ) of push
//  |   |-- closing } of json in error
//  |-- closing } of error obj

// Actually:
// a.push({error:{json:{message:..., code:...}}})
// count: 3 opening { -> 3 closing } + 1 closing )
// So: "INTERNAL_SERVER_ERROR"}}}) <-- closes push({error:{json:{...}}})
// Then } <- closes catch block
// Then } <- closes for body
// Then return <- inside if(M) block

const between = code.substring(intErrIdx + '"INTERNAL_SERVER_ERROR"'.length, returnIdx);
console.log('\nBetween INTERNAL_SERVER_ERROR and return:', JSON.stringify(between));

// The correct value should be: "}}})}}
// Let's fix it
const correctBetween = '}}})}}\n';
console.log('Expected:', JSON.stringify(correctBetween));

code = code.substring(0, intErrIdx + '"INTERNAL_SERVER_ERROR"'.length) + correctBetween + code.substring(returnIdx);
fs.writeFileSync(path, code);
console.log('\nFixed!');

// Verify
const v = fs.readFileSync(path, 'utf8');
const batchStart = v.indexOf('for(let n=0;n<e.length;n++)');
const batchReturn = v.indexOf('return console.log("[Custom Handler] Batch success!")', batchStart);
const batchBody = v.substring(batchStart, batchReturn);
let open = 0, close = 0;
for (const ch of batchBody) { if (ch === '{') open++; if (ch === '}') close++; }
console.log('Braces - Open:', open, 'Close:', close, 'Match:', open === close);
