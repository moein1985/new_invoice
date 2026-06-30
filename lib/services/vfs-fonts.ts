// Auto-generated VFS fonts for pdfmake - Vazirmatn Persian font
// This file reads fonts at build time and encodes as base64 for pdfmake VFS

let fontsLoaded = false;
let vfsFonts: Record<string, string> = {};

/**
 * Load Vazirmatn font files as base64 for pdfmake VFS.
 * Works in browser by fetching from /fonts/ path.
 */
export async function loadVazirmatnFonts(): Promise<Record<string, string>> {
  if (fontsLoaded) return vfsFonts;

  const fontFiles = [
    { name: 'Vazirmatn-Regular.ttf', path: '/fonts/Vazirmatn-Regular.ttf' },
    { name: 'Vazirmatn-Medium.ttf', path: '/fonts/Vazirmatn-Medium.ttf' },
    { name: 'Vazirmatn-Bold.ttf', path: '/fonts/Vazirmatn-Bold.ttf' },
  ];

  const results: Record<string, string> = {};

  for (const font of fontFiles) {
    const response = await fetch(font.path);
    const buffer = await response.arrayBuffer();
    const base64 = btoa(
      new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );
    results[font.name] = base64;
  }

  vfsFonts = results;
  fontsLoaded = true;
  return results;
}
