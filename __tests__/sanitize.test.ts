import { describe, it, expect } from '@jest/globals';
import {
  sanitizeString,
  stripHtml,
  sanitizeObject,
  escapeRegex,
  normalizeWhitespace,
  sanitizeUrl,
  sanitizePhone,
  sanitizeEmail,
} from '../lib/sanitize';
import { cn } from '../lib/utils';

describe('sanitize helpers', () => {
  it('escapes dangerous HTML characters', () => {
    const payload = '<script>alert("x")</script>';
    expect(sanitizeString(payload)).toBe('&lt;script&gt;alert(&quot;x&quot;)&lt;&#x2F;script&gt;');
  });

  it('strips html tags from input', () => {
    expect(stripHtml('<b>Hello</b> <i>World</i>')).toBe('Hello World');
  });

  it('sanitizes nested object fields recursively', () => {
    const input = {
      name: 'Moein <img src=x onerror=alert(1)>',
      items: [
        { title: 'A <b>tag</b>' },
        { nested: { note: 'x/y' } },
      ],
      count: 2,
      enabled: true,
    };

    const result = sanitizeObject(input);

    expect(result.name).toContain('&lt;img');
    expect(result.items[0].title).toContain('&lt;b&gt;tag&lt;&#x2F;b&gt;');
    expect(result.items[1].nested.note).toBe('x&#x2F;y');
    expect(result.count).toBe(2);
    expect(result.enabled).toBe(true);
  });

  it('escapes regex metacharacters', () => {
    expect(escapeRegex('a+b?.*')).toBe('a\\+b\\?\\.\\*');
  });

  it('normalizes repeated whitespace', () => {
    expect(normalizeWhitespace('   سلام   دنیا  ')).toBe('سلام دنیا');
  });

  it('allows only safe URL protocols', () => {
    expect(sanitizeUrl('https://example.com/path?q=1')).toBe('https://example.com/path?q=1');
    expect(sanitizeUrl('javascript:alert(1)')).toBe('');
  });

  it('keeps allowed phone characters and removes others', () => {
    expect(sanitizePhone('+98 (912) 123-4567#ext')).toBe('+98 (912) 123-4567');
  });

  it('normalizes email', () => {
    expect(sanitizeEmail('  USER@Example.Com  ')).toBe('user@example.com');
  });
});

describe('cn utility', () => {
  it('merges tailwind classes and keeps last conflict', () => {
    expect(cn('p-2 text-sm', 'p-4', undefined, false && 'block')).toBe('text-sm p-4');
  });
});
