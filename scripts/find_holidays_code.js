const fs = require('fs');
const code = fs.readFileSync('/app/.next/server/chunks/2429.js', 'utf8');
const idx = code.indexOf('date-holidays');
console.log('FOUND at char ' + idx);
if (idx >= 0) {
  console.log('CONTEXT:');
  console.log(code.substring(Math.max(0,idx-300), idx+700));
}
