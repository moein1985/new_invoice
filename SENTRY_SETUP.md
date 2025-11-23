# راهنمای راه‌اندازی Sentry

## مرحله 1: ایجاد حساب کاربری Sentry

1. به آدرس https://sentry.io بروید
2. یک حساب رایگان ایجاد کنید (تا 5000 error/ماه رایگان است)
3. یک پروژه جدید از نوع **Next.js** ایجاد کنید
4. نام پروژه را `invoice-management` بگذارید

## مرحله 2: دریافت DSN

1. پس از ایجاد پروژه، یک **DSN** به شما نمایش داده می‌شود
2. این DSN را کپی کنید (مثل: `https://xxxxx@o12345.ingest.sentry.io/67890`)

## مرحله 3: پیکربندی محیط

فایل `.env` را ویرایش کنید و DSN را اضافه کنید:

```env
NEXT_PUBLIC_SENTRY_DSN="https://xxxxx@o12345.ingest.sentry.io/67890"
```

## مرحله 4: آپدیت Organization Slug

فایل `next.config.ts` را باز کنید و خط زیر را ویرایش کنید:

```typescript
org: "your-org-slug", // نام organization خود در Sentry را اینجا بگذارید
```

## مرحله 5: تست کردن

1. سرور را مجدداً راه‌اندازی کنید:
```bash
npm run dev
```

2. یک خطا ایجاد کنید (مثلاً روی یک صفحه غیرموجود بروید)

3. به داشبورد Sentry بروید و باید خطا را ببینید

## قابلیت‌های Sentry

### 1. Error Tracking
تمام خطاهای JavaScript و React را ثبت می‌کند:
```typescript
// خطاهای خودکار ثبت می‌شوند
document.convertedTo.map() // این خطا در Sentry ثبت می‌شود
```

### 2. Session Replay (فعال شده)
ضبط ویدیو از اقداماتی که کاربر قبل از خطا انجام داده:
- مشاهده click ها
- scroll ها
- تایپ کردن (با mask برای امنیت)
- navigation

### 3. Performance Monitoring
زمان بارگذاری صفحات و API calls را اندازه‌گیری می‌کند

### 4. Breadcrumbs
مسیر کامل کاربر تا رسیدن به خطا را نمایش می‌دهد

## استفاده دستی از Sentry

### ثبت خطای سفارشی:
```typescript
import * as Sentry from '@sentry/nextjs';

try {
  // کدی که ممکن است خطا دهد
} catch (error) {
  Sentry.captureException(error);
}
```

### اضافه کردن context:
```typescript
Sentry.setUser({
  id: user.id,
  email: user.email,
  username: user.fullName,
});

Sentry.setTag('page', 'documents/[id]');
Sentry.setContext('document', {
  id: document.id,
  type: document.documentType,
});
```

## تنظیمات پیشرفته

### غیرفعال کردن در Development:
در فایل `sentry.client.config.ts`:
```typescript
Sentry.init({
  dsn: process.env.NODE_ENV === 'production' ? process.env.NEXT_PUBLIC_SENTRY_DSN : undefined,
  // ...
});
```

### فیلتر کردن خطاها:
```typescript
Sentry.init({
  beforeSend(event, hint) {
    // خطاهای خاصی را نادیده بگیر
    if (event.exception?.values?.[0]?.value?.includes('Network Error')) {
      return null;
    }
    return event;
  },
});
```

## توصیه‌های من:

1. ✅ **در Development فعال کنید**: تا خطاها را سریع‌تر ببینید
2. ✅ **Session Replay را بررسی کنید**: دقیقاً می‌بینید کاربر چه کرده
3. ✅ **Source Maps را آپلود کنید**: stack trace خوانا می‌شود
4. ✅ **Alert تنظیم کنید**: وقتی خطای جدید رخ داد، ایمیل دریافت کنید
5. ⚠️ **در Production نرخ sampling را کاهش دهید**: برای کاهش هزینه

## مشکلات رایج

### خطا: "DSN not configured"
- مطمئن شوید `NEXT_PUBLIC_SENTRY_DSN` در `.env` وجود دارد
- سرور را restart کنید

### Source maps آپلود نمی‌شوند
- `SENTRY_AUTH_TOKEN` را در `.env` قرار دهید
- Token را از Settings > Auth Tokens در Sentry دریافت کنید

### خطاها در Sentry نمایش داده نمی‌شوند
- Console مرورگر را چک کنید
- مطمئن شوید DSN صحیح است
- اینترنت خود را بررسی کنید
