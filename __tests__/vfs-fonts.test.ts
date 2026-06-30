import { describe, it, expect, jest, beforeEach } from '@jest/globals';

describe('loadVazirmatnFonts', () => {
  beforeEach(() => {
    jest.resetModules();
    (global as any).btoa = (input: string) => Buffer.from(input, 'binary').toString('base64');
    (global as any).fetch = jest.fn(async () => ({
      arrayBuffer: async () => new Uint8Array([65, 66, 67]).buffer,
    }));
  });

  it('loads all configured font files and returns base64 map', async () => {
    const { loadVazirmatnFonts } = await import('../lib/services/vfs-fonts');

    const result = await loadVazirmatnFonts();

    expect(Object.keys(result)).toEqual([
      'Vazirmatn-Regular.ttf',
      'Vazirmatn-Medium.ttf',
      'Vazirmatn-Bold.ttf',
    ]);
    expect(result['Vazirmatn-Regular.ttf']).toBe('QUJD');
    expect((global as any).fetch).toHaveBeenCalledTimes(3);
  });

  it('uses cache on second call and does not fetch again', async () => {
    const { loadVazirmatnFonts } = await import('../lib/services/vfs-fonts');

    await loadVazirmatnFonts();
    await loadVazirmatnFonts();

    expect((global as any).fetch).toHaveBeenCalledTimes(3);
  });
});
