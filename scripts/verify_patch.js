const code = require('fs').readFileSync('/app/.next/server/app/api/trpc/[trpc]/route.js', 'utf8');
console.log('Has __HOLIDAYS_1405: ' + code.includes('__HOLIDAYS_1405'));
console.log('Has __getStatic1405: ' + code.includes('__getStatic1405'));
console.log('First 200 chars: ' + code.substring(0, 200));
