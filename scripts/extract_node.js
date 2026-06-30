// Extract events from time.ir RSC payload using Node.js (proper JS string handling)
const fs = require('fs');

const html = fs.readFileSync('/tmp/timeir_events.html', 'utf-8');

// Find RSC chunks
const regex = /self\.__next_f\.push\(\[1,"(.*?)"\]\)/g;
let match;
const chunks = [];
while ((match = regex.exec(html)) !== null) {
  chunks.push(match[1]);
}

console.error(`Found ${chunks.length} chunks`);

for (let i = 0; i < chunks.length; i++) {
  const chunk = chunks[i];
  if (!chunk.includes('defaultYearlyCalendar')) continue;
  
  console.error(`Processing chunk ${i} (${chunk.length} chars)`);
  
  // Decode JS string escapes properly
  let decoded;
  try {
    // Use JSON.parse to properly decode the JS string escapes
    decoded = JSON.parse('"' + chunk + '"');
  } catch (e) {
    console.error(`JSON.parse failed for full chunk, trying fallback...`);
    // Manual decode
    decoded = chunk
      .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\')
      .replace(/\\\//g, '/');
  }
  
  // Find defaultYearlyCalendar
  const idx = decoded.indexOf('"defaultYearlyCalendar"');
  if (idx < 0) continue;
  
  // Find the array
  const arrStart = decoded.indexOf('[', idx);
  let bracketCount = 0;
  let arrEnd = arrStart;
  for (let j = arrStart; j < decoded.length; j++) {
    if (decoded[j] === '[') bracketCount++;
    else if (decoded[j] === ']') bracketCount--;
    if (bracketCount === 0) {
      arrEnd = j + 1;
      break;
    }
  }
  
  const arrStr = decoded.substring(arrStart, arrEnd);
  const yearlyCal = JSON.parse(arrStr);
  
  const output = {
    year: 1405,
    source: "time.ir",
    holiday_days_by_month: {},
    holidays: [],
    events: []
  };
  
  for (const monthData of yearlyCal) {
    const month = monthData.month;
    
    // Holiday days
    const holidayDays = [];
    for (const d of (monthData.day_list || [])) {
      if (d.is_holiday && d.enabled !== false) {
        holidayDays.push(d.index_in_base1);
      }
    }
    output.holiday_days_by_month[String(month)] = holidayDays;
    
    // Events
    for (const evt of (monthData.event_list || [])) {
      const entry = {
        title: evt.title || "",
        jm: evt.jalali_month,
        jd: evt.jalali_day,
        gdate: `${evt.gregorian_year}-${String(evt.gregorian_month).padStart(2,'0')}-${String(evt.gregorian_day).padStart(2,'0')}`,
        holiday: evt.is_holiday || false,
        base: evt.base || 0,
      };
      if (entry.holiday) output.holidays.push(entry);
      output.events.push(entry);
    }
  }
  
  fs.writeFileSync('/tmp/iran_holidays_1405_node.json', JSON.stringify(output, null, 2), 'utf-8');
  
  console.log(`Months: ${Object.keys(output.holiday_days_by_month).length}`);
  console.log(`Events: ${output.events.length}`);
  console.log(`Holidays: ${output.holidays.length}`);
  
  for (const [m, days] of Object.entries(output.holiday_days_by_month).sort((a,b) => Number(a[0]) - Number(b[0]))) {
    if (days.length > 0) {
      console.log(`  Month ${m.padStart(2)}: [${days.join(', ')}]`);
    }
  }
  
  console.log('\nHoliday details:');
  for (const h of output.holidays) {
    console.log(`  ${h.jm}/${h.jd} ${h.title}`);
  }
  
  break;
}
