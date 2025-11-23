/**
 * Sanitization utilities for preventing XSS attacks
 */

/**
 * پاک‌سازی رشته‌ها از تگ‌های HTML و کاراکترهای خطرناک
 */
export function sanitizeString(input: string): string {
  if (!input) return '';
  
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * پاک‌سازی HTML - حذف تمام تگ‌های HTML
 */
export function stripHtml(input: string): string {
  if (!input) return '';
  
  return input.replace(/<[^>]*>/g, '');
}

/**
 * پاک‌سازی آبجکت - اعمال sanitization روی تمام فیلدهای string
 */
export function sanitizeObject<T extends Record<string, any>>(obj: T): T {
  const sanitized: any = {};
  
  for (const key in obj) {
    const value = obj[key];
    
    if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map((item: any) => 
        typeof item === 'object' ? sanitizeObject(item) : item
      );
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized as T;
}

/**
 * Escape کاراکترهای خاص برای استفاده در regex
 */
export function escapeRegex(input: string): string {
  if (!input) return '';
  
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * نرمال‌سازی فاصله‌های خالی (حذف فاصله‌های اضافی)
 */
export function normalizeWhitespace(input: string): string {
  if (!input) return '';
  
  return input.trim().replace(/\s+/g, ' ');
}

/**
 * اعتبارسنجی و پاک‌سازی URL
 */
export function sanitizeUrl(url: string): string {
  if (!url) return '';
  
  // فقط http و https مجاز است
  const allowedProtocols = ['http:', 'https:'];
  
  try {
    const parsed = new URL(url);
    
    if (!allowedProtocols.includes(parsed.protocol)) {
      return '';
    }
    
    return parsed.toString();
  } catch {
    return '';
  }
}

/**
 * پاک‌سازی شماره تلفن (حذف کاراکترهای غیرمجاز)
 */
export function sanitizePhone(phone: string): string {
  if (!phone) return '';
  
  // فقط اعداد، +، - و () مجاز
  return phone.replace(/[^0-9+\-() ]/g, '');
}

/**
 * پاک‌سازی ایمیل
 */
export function sanitizeEmail(email: string): string {
  if (!email) return '';
  
  return email.trim().toLowerCase();
}
