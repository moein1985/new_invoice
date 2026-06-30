const fs = require('fs');
const code = fs.readFileSync('/app/.next/server/chunks/2429.js', 'utf8');

// Search for key patterns from the holiday service
const patterns = ['jDaysInMonth', "'IR'", '"IR"', 'jMonth', 'getHolidays(', 'moment-jalaali', 'h.type', 'public'];
for (const pat of patterns) {
  const idx = code.indexOf(pat);
  if (idx >= 0) {
    console.log('Pattern: ' + pat + ' at char ' + idx);
  } else {
    console.log('Pattern: ' + pat + ' NOT FOUND');
  }
}

// Find all occurrences of 'IR' which is specific
let idx = 0;
let irPositions = [];
while (true) {
  idx = code.indexOf('"IR"', idx);
  if (idx < 0) break;
  irPositions.push(idx);
  idx += 4;
}
idx = 0;
while (true) {
  idx = code.indexOf("'IR'", idx);
  if (idx < 0) break;
  irPositions.push(idx);
  idx += 4;
}

console.log('\nIR positions: ' + JSON.stringify(irPositions));

for (const pos of irPositions) {
  console.log('\n--- IR at ' + pos + ' ---');
  console.log(code.substring(Math.max(0, pos - 200), pos + 200));
}
