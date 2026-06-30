const fs = require('fs');
const code = fs.readFileSync('/app/.next/server/app/api/trpc/[trpc]/route.js', 'utf8');

// Module 22480 starts at char 697001
// Find its definition
const modStart = code.indexOf('22480:(e,a,n)=>{');
if (modStart === -1) {
  console.log('Module 22480 not found with exact pattern');
  // Try alternative
  const alt = code.indexOf('22480:');
  console.log('Found 22480: at', alt);
  console.log(code.substring(alt, alt + 200));
}

console.log('Module 22480 at:', modStart);

// Get the module code
let depth = 0;
let started = false;
let modEnd = modStart;
for (let i = modStart; i < Math.min(modStart + 50000, code.length); i++) {
  if (code[i] === '{') { depth++; started = true; }
  if (code[i] === '}') { depth--; }
  if (started && depth === 0) { modEnd = i + 1; break; }
}

const modCode = code.substring(modStart, modEnd);
console.log('Module 22480 length:', modCode.length);

// Find u (ZS export) and A (sy export)
// Exports: LO:()=>d, ZS:()=>u, dW:()=>r, lK:()=>q, sy:()=>A
// So u = publicProcedure, A = protectedProcedure

// Find where u is defined
const uDefs = [];
let searchPos = 0;
// Look for patterns like: let u = ..., const u = ..., u = ...
const uMatch1 = modCode.match(/[,;]\s*u\s*=\s*([^;,]+)/);
const uMatch2 = modCode.match(/let\s+u\s*=\s*/);
const uMatch3 = modCode.match(/var\s+u\s*=\s*/);

console.log('\nu definitions:');
if (uMatch1) console.log('Pattern 1:', uMatch1[0].substring(0, 200));
if (uMatch2) {
  const idx = modCode.indexOf(uMatch2[0]);
  console.log('Pattern 2:', modCode.substring(idx, idx + 200));
}
if (uMatch3) {
  const idx = modCode.indexOf(uMatch3[0]);
  console.log('Pattern 3:', modCode.substring(idx, idx + 200));
}

// Find where A is defined  
const aMatch1 = modCode.match(/[,;]\s*A\s*=\s*([^;,]+)/);
console.log('\nA (protectedProcedure) definition:');
if (aMatch1) console.log('Pattern:', aMatch1[0].substring(0, 200));

// Just search for "u=" and "A=" in context
const allLines = modCode.split(/[;]/);
for (const line of allLines) {
  const trimmed = line.trim();
  if (trimmed.match(/^u=/)) {
    console.log('\nu = line:', trimmed.substring(0, 300));
  }
  if (trimmed.match(/^A=/)) {
    console.log('\nA = line:', trimmed.substring(0, 300));
  }
  if (trimmed.match(/^let\s+[^=]*u\s*=/)) {
    console.log('\nlet u line:', trimmed.substring(0, 300));
  }
}

// Alternative: find u and A definitions by looking at the module variables
// The module pattern is: n.d(a,{LO:()=>d,ZS:()=>u,...}); var b=..., then somewhere u and A are defined
const exportDecl = modCode.indexOf('n.d(a,{');
if (exportDecl > -1) {
  console.log('\n=== Export declaration ===');
  console.log(modCode.substring(exportDecl, exportDecl + 200));
  
  // After exports, find variable declarations
  const afterExports = modCode.substring(exportDecl + 100, exportDecl + 2000);
  console.log('\n=== After exports (2000 chars) ===');
  console.log(afterExports);
}
