// Test the patched holidays function directly
const fs = require('fs');
const code = fs.readFileSync('/app/.next/server/app/api/trpc/[trpc]/route.js', 'utf8');

// Extract the __HOLIDAYS_1405 data
const startMarker = 'var __HOLIDAYS_1405=';
const startIdx = code.indexOf(startMarker);
const endIdx = code.indexOf('];', startIdx) + 2;
const dataCode = code.substring(startIdx, endIdx);

// Evaluate to get the data
eval(dataCode);

// Test __getStatic1405 logic for Farvardin (month 0)
function getStatic1405(y, m) {
  var m1 = m + 1;
  return __HOLIDAYS_1405.filter(function(h) { return h.jm === m1; }).map(function(h) {
    return { date: h.gdate, jYear: 1405, jMonth: m, jDay: h.jd, name: h.title, type: "public" };
  });
}

var farvardinHolidays = getStatic1405(1405, 0);
console.log('Farvardin 1405 holidays (' + farvardinHolidays.length + '):');
for (var h of farvardinHolidays) {
  console.log('  Day ' + h.jDay + ': ' + h.name + ' (' + h.date + ')');
}

// Check specifically for day 25 (the bug fix)
var day25 = farvardinHolidays.filter(h => h.jDay === 25);
console.log('\n--- KEY TEST: Day 25 Farvardin ---');
if (day25.length > 0) {
  console.log('SUCCESS: Day 25 has ' + day25.length + ' holiday(s):');
  day25.forEach(h => console.log('  ' + h.name));
} else {
  console.log('FAILURE: Day 25 has no holidays!');
}

// Test other months too
for (var m = 0; m < 12; m++) {
  var holidays = getStatic1405(1405, m);
  var days = holidays.map(h => h.jDay).filter((v,i,a) => a.indexOf(v) === i);
  if (days.length > 0) {
    console.log('Month ' + (m+1) + ': ' + days.length + ' holiday days [' + days.join(',') + ']');
  }
}
