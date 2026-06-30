const fs = require('fs');
const path = '/app/.next/server/app/api/trpc/[trpc]/route.js';

let code = fs.readFileSync(path, 'utf8');

// We need to patch the batch processing loop.
// Current code inside the batch for-loop:
//   if(!O||!O[i])throw new p.gt({code:"NOT_FOUND",...});let r=await O[i](z);a.push({result:{data:{json:r}}})
// 
// We want to intercept calendar.holidays before it goes through auth:
//   if(!O||!O[i])throw ...;
//   let r;
//   if(M==="calendar.holidays" && z && z.jYear===1405){
//     ... bypass ...
//   } else {
//     r = await O[i](z);
//   }
//   a.push(...)

const oldBatch = 'if(!O||!O[i])throw new p.gt({code:"NOT_FOUND",message:`No procedure found on path "${M}"`});let r=await O[i](z);a.push({result:{data:{json:r}}})';

const newBatch = 'if(!O||!O[i])throw new p.gt({code:"NOT_FOUND",message:`No procedure found on path "${M}"`});let r;if(M==="calendar.holidays"&&z&&z.jYear===1405){let _m1=z.jMonth+1;r=__HOLIDAYS_1405.filter(function(h){return h.jm===_m1}).map(function(h){return{date:h.gdate,jYear:1405,jMonth:z.jMonth,jDay:h.jd,name:h.title,type:"public"}});console.log("[Custom Handler] Batch holidays bypass for 1405/"+_m1+": "+r.length+" results")}else{r=await O[i](z)}a.push({result:{data:{json:r}}})';

const count = code.split(oldBatch).length - 1;
console.log('Found batch target:', count, 'time(s)');

if (count === 1) {
  code = code.replace(oldBatch, newBatch);
  fs.writeFileSync(path, code);
  console.log('SUCCESS: Patched batch loop with holidays bypass');
  
  // Verify
  const verify = fs.readFileSync(path, 'utf8');
  console.log('Verify batch bypass present:', verify.includes('Batch holidays bypass'));
  console.log('Verify non-batch bypass present:', verify.includes('Holidays bypass for'));
  console.log('Verify __HOLIDAYS_1405 present:', verify.includes('__HOLIDAYS_1405'));
} else if (count === 0) {
  console.log('ERROR: Could not find batch target string');
  // Try to find approximately
  const idx = code.indexOf('let r=await O[i](z);a.push');
  console.log('Approximate "let r=await O[i](z);a.push" found at:', idx);
  if (idx > -1) {
    console.log('Context around it:', code.substring(Math.max(0, idx - 200), idx + 100));
  }
} else {
  console.log('ERROR: Found multiple matches, too ambiguous');
}
