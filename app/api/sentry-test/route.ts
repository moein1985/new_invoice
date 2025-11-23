// صفحه تست Sentry
// مسیر: /api/sentry-test

import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';

export async function GET(request: NextRequest) {
  // تست 1: خطای ساده
  try {
    throw new Error('🧪 Sentry Test Error - این یک خطای تستی است');
  } catch (error) {
    Sentry.captureException(error);
  }

  // تست 2: خطا با context
  Sentry.setTag('test', 'sentry-integration');
  Sentry.setContext('test_info', {
    type: 'manual_test',
    timestamp: new Date().toISOString(),
  });

  try {
    throw new Error('🧪 Sentry Context Test - با اطلاعات اضافی');
  } catch (error) {
    Sentry.captureException(error);
  }

  // تست 3: پیام سفارشی
  Sentry.captureMessage('✅ Sentry is working! اینتگریشن Sentry موفقیت‌آمیز بود', 'info');

  return NextResponse.json({
    success: true,
    message: 'سه خطای تستی به Sentry ارسال شد. داشبورد Sentry را چک کنید.',
    instructions: [
      '1. به https://sentry.io بروید',
      '2. پروژه invoice-management را باز کنید',
      '3. در بخش Issues باید 3 خطا ببینید',
      '4. برای جزئیات بیشتر روی هر خطا کلیک کنید',
    ],
  });
}
