'use client';

import { useState } from 'react';
import * as Sentry from '@sentry/nextjs';

export default function SentryDemoPage() {
  const [showError, setShowError] = useState(false);

  const triggerError = () => {
    // این خطا را Sentry می‌گیرد
    throw new Error('🔴 خطای تستی React Component');
  };

  const triggerManualError = () => {
    try {
      // شبیه‌سازی یک عملیات ناموفق
      const data = null;
      // @ts-expect-error - تست خطا
      data.map((item) => item); // این خطا می‌دهد
    } catch (error) {
      // ارسال دستی به Sentry با context
      Sentry.setContext('operation', {
        type: 'manual_trigger',
        action: 'map_operation',
        timestamp: new Date().toISOString(),
      });
      
      Sentry.setTag('demo_type', 'manual_error');
      Sentry.captureException(error);
      
      alert('خطا به Sentry ارسال شد! داشبورد را چک کنید.');
    }
  };

  const sendCustomMessage = () => {
    Sentry.addBreadcrumb({
      category: 'user-action',
      message: 'کاربر دکمه سفارشی را زد',
      level: 'info',
    });

    Sentry.captureMessage('📨 پیام سفارشی از صفحه Demo', {
      level: 'info',
      tags: {
        page: 'sentry-demo',
        action: 'custom_message',
      },
      contexts: {
        demo_info: {
          user_action: 'clicked_button',
          page_url: window.location.href,
        },
      },
    });

    alert('پیام به Sentry ارسال شد!');
  };

  return (
    <div className="container mx-auto p-8 max-w-4xl">
      <div className="bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-3xl font-bold mb-6 text-center">
          🧪 صفحه تست و دمو Sentry
        </h1>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-3 text-blue-800">
            📊 راهنمای استفاده
          </h2>
          <ul className="space-y-2 text-gray-700">
            <li>• هر دکمه یک نوع خطا/پیام متفاوت به Sentry ارسال می‌کند</li>
            <li>• بعد از کلیک، به داشبورد Sentry بروید و issue جدید را ببینید</li>
            <li>• در هر issue می‌توانید Stack Trace، Breadcrumbs و Context را بررسی کنید</li>
          </ul>
        </div>

        <div className="space-y-4">
          {/* دکمه 1: خطای React Component */}
          <div className="border border-gray-200 rounded-lg p-6">
            <h3 className="font-semibold mb-2 text-lg">
              1️⃣ خطای React Component (Uncaught)
            </h3>
            <p className="text-gray-600 mb-4">
              این دکمه یک خطای uncaught در React ایجاد می‌کند. ErrorBoundary آن را می‌گیرد و به Sentry ارسال می‌کند.
            </p>
            <button
              onClick={() => setShowError(true)}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-6 rounded-lg transition"
            >
              ایجاد خطای React
            </button>
            {showError && triggerError()}
          </div>

          {/* دکمه 2: خطای دستی */}
          <div className="border border-gray-200 rounded-lg p-6">
            <h3 className="font-semibold mb-2 text-lg">
              2️⃣ خطای دستی (Try-Catch)
            </h3>
            <p className="text-gray-600 mb-4">
              این دکمه خطا را catch می‌کند و با اطلاعات اضافی (context & tags) به Sentry می‌فرستد.
            </p>
            <button
              onClick={triggerManualError}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white font-semibold py-3 px-6 rounded-lg transition"
            >
              ارسال خطای دستی
            </button>
          </div>

          {/* دکمه 3: پیام سفارشی */}
          <div className="border border-gray-200 rounded-lg p-6">
            <h3 className="font-semibold mb-2 text-lg">
              3️⃣ پیام سفارشی (Non-Error)
            </h3>
            <p className="text-gray-600 mb-4">
              این دکمه یک پیام info به Sentry می‌فرستد (بدون خطا). برای tracking رویدادهای مهم مفید است.
            </p>
            <button
              onClick={sendCustomMessage}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition"
            >
              ارسال پیام سفارشی
            </button>
          </div>
        </div>

        <div className="mt-8 bg-purple-50 border border-purple-200 rounded-lg p-6">
          <h3 className="font-semibold mb-3 text-purple-800">
            🎯 چیزهایی که در Sentry خواهید دید:
          </h3>
          <div className="space-y-2 text-gray-700">
            <p><strong>Stack Trace:</strong> مسیر دقیق خطا در کد</p>
            <p><strong>Breadcrumbs:</strong> اقدامات کاربر قبل از خطا</p>
            <p><strong>Context:</strong> اطلاعات اضافه شده توسط ما</p>
            <p><strong>Tags:</strong> برچسب‌های سفارشی برای فیلتر کردن</p>
            <p><strong>User Info:</strong> IP، Browser، و اطلاعات کاربر</p>
            <p><strong>Environment:</strong> development / production</p>
          </div>
        </div>

        <div className="mt-6 text-center">
          <a
            href="https://sentry.io"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-8 rounded-lg transition"
          >
            🚀 باز کردن داشبورد Sentry
          </a>
        </div>
      </div>
    </div>
  );
}
