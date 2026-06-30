const fs = require('fs');
const filePath = '/app/.next/server/app/api/trpc/[trpc]/route.js';
const code = fs.readFileSync(filePath, 'utf8');

// Static holiday data for 1405 from time.ir
const HOLIDAYS_1405 = [
  {title:"\u062C\u0634\u0646 \u0646\u0648\u0631\u0648\u0632/\u062C\u0634\u0646 \u0633\u0627\u0644 \u0646\u0648",jm:1,jd:1,gdate:"2026-03-21"},
  {title:"\u0639\u06CC\u062F \u0633\u0639\u06CC\u062F \u0641\u0637\u0631",jm:1,jd:1,gdate:"2026-03-21"},
  {title:"\u0639\u06CC\u062F\u0646\u0648\u0631\u0648\u0632",jm:1,jd:2,gdate:"2026-03-22"},
  {title:"\u062A\u0639\u0637\u06CC\u0644 \u0628\u0647 \u0645\u0646\u0627\u0633\u0628\u062A \u0639\u06CC\u062F \u0633\u0639\u06CC\u062F \u0641\u0637\u0631",jm:1,jd:2,gdate:"2026-03-22"},
  {title:"\u0639\u06CC\u062F\u0646\u0648\u0631\u0648\u0632",jm:1,jd:3,gdate:"2026-03-23"},
  {title:"\u0639\u06CC\u062F\u0646\u0648\u0631\u0648\u0632",jm:1,jd:4,gdate:"2026-03-24"},
  {title:"\u0631\u0648\u0632 \u062C\u0645\u0647\u0648\u0631\u06CC \u0627\u0633\u0644\u0627\u0645\u06CC",jm:1,jd:12,gdate:"2026-04-01"},
  {title:"\u062C\u0634\u0646 \u0633\u06CC\u0632\u062F\u0647 \u0628\u0647 \u062F\u0631",jm:1,jd:13,gdate:"2026-04-02"},
  {title:"\u0634\u0647\u0627\u062F\u062A \u0627\u0645\u0627\u0645 \u062C\u0639\u0641\u0631 \u0635\u0627\u062F\u0642 (\u0639)",jm:1,jd:25,gdate:"2026-04-14"},
  {title:"\u0639\u06CC\u062F \u0633\u0639\u06CC\u062F \u0642\u0631\u0628\u0627\u0646",jm:3,jd:6,gdate:"2026-05-27"},
  {title:"\u0631\u062D\u0644\u062A \u062D\u0636\u0631\u062A \u0627\u0645\u0627\u0645 \u062E\u0645\u06CC\u0646\u06CC",jm:3,jd:14,gdate:"2026-06-04"},
  {title:"\u0639\u06CC\u062F \u0633\u0639\u06CC\u062F \u063A\u062F\u06CC\u0631 \u062E\u0645",jm:3,jd:14,gdate:"2026-06-04"},
  {title:"\u0642\u06CC\u0627\u0645 15 \u062E\u0631\u062F\u0627\u062F",jm:3,jd:15,gdate:"2026-06-05"},
  {title:"\u062A\u0627\u0633\u0648\u0639\u0627\u06CC \u062D\u0633\u06CC\u0646\u06CC",jm:4,jd:3,gdate:"2026-06-24"},
  {title:"\u0639\u0627\u0634\u0648\u0631\u0627\u06CC \u062D\u0633\u06CC\u0646\u06CC",jm:4,jd:4,gdate:"2026-06-25"},
  {title:"\u0627\u0631\u0628\u0639\u06CC\u0646 \u062D\u0633\u06CC\u0646\u06CC",jm:5,jd:13,gdate:"2026-08-04"},
  {title:"\u0631\u062D\u0644\u062A \u0631\u0633\u0648\u0644 \u0627\u06A9\u0631\u0645\u061B\u0634\u0647\u0627\u062F\u062A \u0627\u0645\u0627\u0645 \u062D\u0633\u0646 \u0645\u062C\u062A\u0628\u06CC (\u0639)",jm:5,jd:21,gdate:"2026-08-12"},
  {title:"\u0634\u0647\u0627\u062F\u062A \u0627\u0645\u0627\u0645 \u0631\u0636\u0627 (\u0639)",jm:5,jd:22,gdate:"2026-08-13"},
  {title:"\u0634\u0647\u0627\u062F\u062A \u0627\u0645\u0627\u0645 \u062D\u0633\u0646 \u0639\u0633\u06A9\u0631\u06CC (\u0639)",jm:5,jd:30,gdate:"2026-08-21"},
  {title:"\u0645\u06CC\u0644\u0627\u062F \u0631\u0633\u0648\u0644 \u0627\u06A9\u0631\u0645 \u0648 \u0627\u0645\u0627\u0645 \u062C\u0639\u0641\u0631 \u0635\u0627\u062F\u0642 (\u0639)",jm:6,jd:8,gdate:"2026-08-30"},
  {title:"\u0634\u0647\u0627\u062F\u062A \u062D\u0636\u0631\u062A \u0641\u0627\u0637\u0645\u0647 \u0632\u0647\u0631\u0627 (\u0633)",jm:8,jd:22,gdate:"2026-11-13"},
  {title:"\u0648\u0644\u0627\u062F\u062A \u0627\u0645\u0627\u0645 \u0639\u0644\u06CC (\u0639) \u0648 \u0631\u0648\u0632 \u067E\u062F\u0631",jm:10,jd:2,gdate:"2026-12-23"},
  {title:"\u0645\u0628\u0639\u062B \u0631\u0633\u0648\u0644 \u0627\u06A9\u0631\u0645 (\u0635)",jm:10,jd:16,gdate:"2027-01-06"},
  {title:"\u0648\u0644\u0627\u062F\u062A \u062D\u0636\u0631\u062A \u0642\u0627\u0626\u0645 \u0639\u062C\u0644 \u0627\u0644\u0644\u0647 \u062A\u0639\u0627\u0644\u06CC \u0641\u0631\u062C\u0647 \u0648 \u062C\u0634\u0646 \u0646\u06CC\u0645\u0647 \u0634\u0639\u0628\u0627\u0646",jm:11,jd:4,gdate:"2027-01-24"},
  {title:"\u067E\u06CC\u0631\u0648\u0632\u06CC \u0627\u0646\u0642\u0644\u0627\u0628 \u0627\u0633\u0644\u0627\u0645\u06CC",jm:11,jd:22,gdate:"2027-02-11"},
  {title:"\u0634\u0647\u0627\u062F\u062A \u062D\u0636\u0631\u062A \u0639\u0644\u06CC (\u0639)",jm:12,jd:9,gdate:"2027-02-28"},
  {title:"\u0639\u06CC\u062F \u0633\u0639\u06CC\u062F \u0641\u0637\u0631",jm:12,jd:19,gdate:"2027-03-10"},
  {title:"\u062A\u0639\u0637\u06CC\u0644 \u0628\u0647 \u0645\u0646\u0627\u0633\u0628\u062A \u0639\u06CC\u062F \u0633\u0639\u06CC\u062F \u0641\u0637\u0631",jm:12,jd:20,gdate:"2027-03-11"},
  {title:"\u0631\u0648\u0632 \u0645\u0644\u06CC \u0634\u062F\u0646 \u0635\u0646\u0639\u062A \u0646\u0641\u062A \u0627\u06CC\u0631\u0627\u0646",jm:12,jd:29,gdate:"2027-03-20"}
];

function getStaticHolidays1405(jYear, jMonth) {
  var month1Based = jMonth + 1;
  return HOLIDAYS_1405.filter(function(h) { return h.jm === month1Based; }).map(function(h) {
    return { date: h.gdate, jYear: 1405, jMonth: jMonth, jDay: h.jd, name: h.title, type: "public" };
  });
}

// Find the exact pattern to replace
const searchStr = '.query(({input:e})=>(0,p.k)(e.jYear,e.jMonth))';
const idx = code.indexOf(searchStr);

if (idx < 0) {
  console.log('ERROR: Pattern not found!');
  // Try to find nearby patterns
  const alt1 = code.indexOf('(0,p.k)(e.jYear');
  console.log('Alt search "(0,p.k)(e.jYear" at: ' + alt1);
  if (alt1 >= 0) {
    console.log('Context: ' + code.substring(alt1 - 20, alt1 + 60));
  }
  process.exit(1);
}

console.log('Found pattern at position: ' + idx);

// Build the replacement: inject static data check for year 1405
const staticFn = `var __HOLIDAYS_1405=${JSON.stringify(HOLIDAYS_1405)};function __getStatic1405(y,m){var m1=m+1;return __HOLIDAYS_1405.filter(function(h){return h.jm===m1}).map(function(h){return{date:h.gdate,jYear:1405,jMonth:m,jDay:h.jd,name:h.title,type:"public"}})}`;

const replaceStr = '.query(({input:e})=>e.jYear===1405?__getStatic1405(e.jYear,e.jMonth):(0,p.k)(e.jYear,e.jMonth))';

// Insert the static function definitions near the top of the module
// Find a good insertion point - after the module header
const moduleStart = code.indexOf('holidays:z.sy.input');
const insertPoint = code.lastIndexOf('}),', moduleStart);

const newCode = code.substring(0, idx) + replaceStr + code.substring(idx + searchStr.length);

// Now inject the static function at the top level - find the first line
const finalCode = staticFn + ';' + newCode;

// Write backup and new file
fs.writeFileSync(filePath + '.bak', code);
fs.writeFileSync(filePath, finalCode);

console.log('SUCCESS: Patched route.js');
console.log('Original size: ' + code.length);
console.log('Patched size: ' + finalCode.length);
console.log('Static data injected with ' + HOLIDAYS_1405.length + ' holidays');
