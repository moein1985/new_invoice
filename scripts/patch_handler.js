const fs = require('fs');
const filePath = '/app/.next/server/app/api/trpc/[trpc]/route.js';
let code = fs.readFileSync(filePath, 'utf8');

// Step 1: Revert z.ZS back to z.sy for holidays
code = code.replace('holidays:z.ZS.input(', 'holidays:z.sy.input(');
console.log('Step 1: Reverted holidays to z.sy');

// Step 2: Patch the Custom Handler to intercept calendar.holidays before auth
// The Custom Handler function O starts with:
// async function O(e){try{let a=new URL(e.url),n=a.pathname.split("/").pop()||"",...
// n is the procedure path like "calendar.holidays"
// We need to add a check: if n === "calendar.holidays", return static data directly

const oldHandler = 'async function O(e){try{let a=new URL(e.url),n=a.pathname.split("/").pop()||"",';

const newHandler = `async function O(e){try{let a=new URL(e.url),n=a.pathname.split("/").pop()||"",`;

// Actually, let's insert our bypass right after n is defined
// Find the exact location: after the console.log line
const insertAfter = 'console.log(\`[Custom Handler] \${e.method} \${n}, batch: \${M}\`);';
const insertAfterIdx = code.indexOf(insertAfter);

if (insertAfterIdx === -1) {
  console.log('ERROR: Could not find Custom Handler log line');
  // Try alternative
  const alt = code.indexOf('[Custom Handler]');
  console.log('Alternative [Custom Handler] found at:', alt);
  console.log('Context:', code.substring(alt - 50, alt + 200));
  process.exit(1);
}

// Insert our bypass code right after the console.log
const bypassCode = `if(n==="calendar.holidays"&&"GET"===e.method){let _inp=a.searchParams.get("input");if(_inp){let _p=JSON.parse(decodeURIComponent(_inp));let _j=_p.json||_p;if(_j.jYear===1405){let _m1=_j.jMonth+1;let _r=__HOLIDAYS_1405.filter(function(h){return h.jm===_m1}).map(function(h){return{date:h.gdate,jYear:1405,jMonth:_j.jMonth,jDay:h.jd,name:h.title,type:"public"}});console.log("[Custom Handler] Holidays bypass for 1405/"+_m1+": "+_r.length+" results");return new Response(JSON.stringify({result:{data:{json:_r}}}),{status:200,headers:{"Content-Type":"application/json"}})}}}`;

code = code.substring(0, insertAfterIdx + insertAfter.length) + bypassCode + code.substring(insertAfterIdx + insertAfter.length);

fs.writeFileSync(filePath, code);
console.log('Step 2: Inserted holidays bypass in Custom Handler');

// Verify
const verify = fs.readFileSync(filePath, 'utf8');
console.log('Verification:');
console.log('  Has bypass:', verify.includes('Holidays bypass'));
console.log('  Has __HOLIDAYS_1405:', verify.includes('__HOLIDAYS_1405'));
console.log('  Has holidays:z.sy:', verify.includes('holidays:z.sy'));

// Show the patched handler area
const bIdx = verify.indexOf('Holidays bypass');
console.log('  Bypass context:', verify.substring(bIdx - 50, bIdx + 100));
