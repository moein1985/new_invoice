const fs = require('fs');
const code = fs.readFileSync('/app/.next/server/app/api/trpc/[trpc]/route.js', 'utf8');

// The holidays procedure is at char 664334: holidays:z.sy.input(...)
// z.sy = protectedProcedure in this scope
// We need to find publicProcedure in the same z module

// Let's look at what z.ZS and z.sy are by finding how z is defined
// The holidays is in a module. Let's find the module boundary
const holidaysAt = 664334;

// Search backwards for module definition pattern like: moduleid:(e,a,n)=>{
let moduleStart = holidaysAt;
for (let i = holidaysAt; i > Math.max(0, holidaysAt - 50000); i--) {
  // Module boundaries look like: },12345:(e,a,n)=>{ or start of chunk
  if (code.substring(i, i+20).match(/^\},\d+:\(/) || code.substring(i, i+10).match(/^\d+:\(/)) {
    moduleStart = i;
    break;
  }
}
console.log('Module starts around char:', moduleStart);
console.log('Module start text:', code.substring(moduleStart, moduleStart + 200));

// In this module scope, find how z is imported/defined
const moduleCode = code.substring(moduleStart, holidaysAt);

// Look for z= or let z= or var z= patterns
const zDefs = moduleCode.match(/[;,\s]z=\w+\(\d+\)/g);
if (zDefs) {
  console.log('\nz definitions:', zDefs.slice(-5));
}

// Find what z.ZS and z.sy resolve to
// Look for export patterns: ZS and sy 
const zsIdx = moduleCode.indexOf('.ZS');
const syIdx = moduleCode.indexOf('.sy');
console.log('\n.ZS first occurrence in module at offset:', zsIdx);
console.log('.sy first occurrence in module at offset:', syIdx);

// Actually the simplest approach: in the calendar router, is z.ZS available?
// Check if z.ZS appears near the holidays procedure
const nearContext = code.substring(holidaysAt - 2000, holidaysAt + 500);
const hasZS = nearContext.includes('z.ZS');
const hasSy = nearContext.includes('z.sy');
console.log('\nNear holidays (2000 chars before, 500 after):');
console.log('  Has z.ZS:', hasZS);
console.log('  Has z.sy:', hasSy);

if (hasZS) {
  // Find z.ZS usage near holidays
  let pos = nearContext.indexOf('z.ZS');
  console.log('  z.ZS context:', nearContext.substring(Math.max(0,pos-50), pos+50));
}

// The real question: can we just replace z.sy with z.ZS for holidays?
// Or do we need a different approach?
// Alternative: Instead of changing protectedProcedure to publicProcedure,
// we can bypass the auth check by replacing the query handler
// 
// Actually, the simplest fix: modify the ternary we already patched
// to skip authentication entirely. But that's harder because auth is in middleware.
//
// Simplest approach: change "holidays:z.sy" to "holidays:z.ZS" if z.ZS exists in same scope.

// Let's check more broadly what's in scope
const moduleEnd = code.indexOf('},', holidaysAt + 200);
const fullModule = code.substring(moduleStart, moduleEnd + 200);

// Check if z.ZS is used anywhere in this same module
const zsInModule = fullModule.includes('z.ZS');
console.log('\nz.ZS exists in same module:', zsInModule);

// If not, let's find what publicProcedure equivalent exists
// Search for the trpc initialization in this module
const trpcPatterns = fullModule.match(/(?:publicProcedure|protectedProcedure|procedure|baseProcedure)/gi);
console.log('TRPC patterns:', trpcPatterns);

// Let's try a different approach: look at the z module exports
// Find where z is required: z = n(XXXXX)
const zRequire = moduleCode.match(/z=n\((\d+)\)/);
if (zRequire) {
  const modId = zRequire[1];
  console.log('\nz is imported from module:', modId);
  
  // Find that module's exports
  const modPattern = modId + ':(';
  const modIdx = code.indexOf(modPattern);
  if (modIdx > -1) {
    console.log('Module', modId, 'starts at:', modIdx);
    const modCode = code.substring(modIdx, modIdx + 2000);
    // Look for sy and ZS exports
    const exports = modCode.match(/\b(sy|ZS)\b/g);
    console.log('Exports found:', [...new Set(exports || [])]);
    
    // Look for publicProcedure/protectedProcedure definitions
    if (modCode.includes('sy')) {
      const syCtx = modCode.indexOf('sy');
      console.log('sy context:', modCode.substring(Math.max(0,syCtx-30), syCtx+50));
    }
    if (modCode.includes('ZS')) {
      const zsCtx = modCode.indexOf('ZS');
      console.log('ZS context:', modCode.substring(Math.max(0,zsCtx-30), zsCtx+50));
    }
  }
}
