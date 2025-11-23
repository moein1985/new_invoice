# 🚀 راهنمای استفاده از کامپوننت‌های جدید

این سند راهنمای استفاده از کامپوننت‌ها و ویژگی‌های جدید اضافه شده در نسخه 2.0.0 است.

---

## 📦 کامپوننت‌های جدید

### 1. **Toast Notification System**

برای نمایش پیام‌های موفقیت، خطا، هشدار و اطلاعات.

#### نصب در Layout:
```tsx
// app/layout.tsx
import { ToastProvider } from '@/components/ui/toast-provider';

export default function RootLayout({ children }) {
  return (
    <ToastProvider>
      {children}
    </ToastProvider>
  );
}
```

#### استفاده در کامپوننت:
```tsx
'use client';
import { useToast } from '@/components/ui/toast-provider';

export default function MyComponent() {
  const { showToast } = useToast();

  const handleSuccess = () => {
    showToast('عملیات با موفقیت انجام شد', 'success');
  };

  const handleError = () => {
    showToast('خطایی رخ داد', 'error');
  };

  const handleWarning = () => {
    showToast('توجه: این عملیات قابل بازگشت نیست', 'warning');
  };

  const handleInfo = () => {
    showToast('اطلاعات: داده‌ها در حال بارگذاری', 'info');
  };

  return (
    <div>
      <button onClick={handleSuccess}>نمایش پیام موفقیت</button>
      <button onClick={handleError}>نمایش پیام خطا</button>
    </div>
  );
}
```

---

### 2. **Loading Button**

دکمه با وضعیت بارگذاری برای جلوگیری از double submission.

#### استفاده:
```tsx
'use client';
import { LoadingButton } from '@/components/ui/loading-button';
import { useState } from 'react';

export default function MyForm() {
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      await someAsyncOperation();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <LoadingButton
        isLoading={isLoading}
        type="submit"
        variant="default"  // یا: destructive, outline, ghost
        size="default"     // یا: sm, lg
      >
        ذخیره تغییرات
      </LoadingButton>
    </form>
  );
}
```

---

### 3. **Pagination Component**

صفحه‌بندی حرفه‌ای با نمایش شماره صفحات.

#### استفاده:
```tsx
'use client';
import { Pagination } from '@/components/ui/pagination';
import { useState } from 'react';

export default function MyList() {
  const [currentPage, setCurrentPage] = useState(1);
  const totalItems = 100;
  const itemsPerPage = 10;
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  return (
    <div>
      {/* نمایش آیتم‌ها */}
      
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        totalItems={totalItems}
        itemsPerPage={itemsPerPage}
      />
    </div>
  );
}
```

---

### 4. **Error Boundary**

برای مدیریت خطاهای React و جلوگیری از کرش برنامه.

#### نصب در Layout:
```tsx
// app/layout.tsx
import { ErrorBoundary } from '@/components/error-boundary';

export default function RootLayout({ children }) {
  return (
    <ErrorBoundary>
      {children}
    </ErrorBoundary>
  );
}
```

Error Boundary به صورت خودکار خطاها را می‌گیرد و UI مناسبی نمایش می‌دهد.

---

## 🛠️ Utilities

### 1. **Validation Schemas**

اسکیماهای Zod برای اعتبارسنجی یکپارچه در Frontend و Backend.

#### استفاده در Frontend:
```tsx
import { createCustomerSchema } from '@/lib/validations';

const result = createCustomerSchema.safeParse({
  code: 'C001',
  name: 'شرکت نمونه',
  phone: '09123456789',
});

if (!result.success) {
  console.error(result.error.errors);
}
```

#### استفاده در Backend (tRPC):
```tsx
import { createCustomerSchema } from '@/lib/validations';

export const customerRouter = router({
  create: protectedProcedure
    .input(createCustomerSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.customer.create({ data: input });
    }),
});
```

---

### 2. **Sanitization Utilities**

برای پاکسازی ورودی‌ها و محافظت در برابر XSS.

#### استفاده:
```tsx
import {
  sanitizeString,
  stripHtml,
  sanitizePhone,
  sanitizeEmail,
  sanitizeUrl,
} from '@/lib/sanitize';

// پاکسازی رشته عادی
const cleanName = sanitizeString(userInput);

// حذف تگ‌های HTML
const plainText = stripHtml('<script>alert("xss")</script>Hello');
// نتیجه: "Hello"

// فرمت شماره تلفن
const phone = sanitizePhone('(021) 1234-5678');
// نتیجه: "02112345678"

// اعتبارسنجی و پاکسازی ایمیل
const email = sanitizeEmail('User@Example.COM ');
// نتیجه: "user@example.com"

// بررسی امنیت URL
const url = sanitizeUrl('javascript:alert("xss")');
// نتیجه: null (غیرایمن)
```

---

## 📊 Dashboard Stats

برای دریافت آمار داشبورد از router جدید stats استفاده کنید.

#### استفاده:
```tsx
'use client';
import { trpc } from '@/lib/trpc';

export default function Dashboard() {
  const { data: stats, isLoading } = trpc.stats.getDashboardStats.useQuery();

  if (isLoading) return <div>در حال بارگذاری...</div>;

  return (
    <div>
      <h1>آمار کلی</h1>
      <div>تعداد کاربران: {stats.summary.totalUsers}</div>
      <div>تعداد مشتریان: {stats.summary.totalCustomers}</div>
      <div>تعداد اسناد: {stats.summary.totalDocuments}</div>
      <div>درآمد ماه جاری: {stats.summary.currentMonthRevenue.toLocaleString('fa-IR')} ریال</div>
    </div>
  );
}
```

---

## 📄 PDF Export V2

خروجی PDF بهبود یافته با پشتیبانی بهتر از فارسی.

#### استفاده:
```tsx
import { generateDocumentPDFV2 } from '@/lib/services/pdf-export-v2';

const handleExportPDF = () => {
  generateDocumentPDFV2(document);
};
```

**مزایای نسخه 2:**
- فونت بهتر برای فارسی
- لایه گرادیانت در هدر
- جداول زیباتر
- مدیریت بهتر صفحات

---

## 🎨 Mobile Responsive

صفحات customers و documents اکنون در موبایل به صورت کارت نمایش داده می‌شوند.

### الگوی طراحی:

```tsx
{/* Desktop: Table */}
<div className="hidden md:block">
  <table>...</table>
</div>

{/* Mobile: Cards */}
<div className="md:hidden">
  {items.map(item => (
    <div key={item.id} className="bg-white rounded-lg shadow p-4 mb-3">
      <div className="font-bold">{item.name}</div>
      <div className="text-sm text-gray-600">{item.code}</div>
    </div>
  ))}
</div>
```

---

## 🧪 Testing

### اجرای تست‌ها:
```bash
# Unit Tests
npm test

# E2E Tests
npm run test:e2e

# Build Production
npm run build
```

---

## 📝 نکات مهم

1. **همیشه Toast استفاده کنید به جای alert()**
   ```tsx
   // ❌ قدیمی
   alert('عملیات موفق');
   
   // ✅ جدید
   showToast('عملیات موفق', 'success');
   ```

2. **در فرم‌ها از LoadingButton استفاده کنید**
   ```tsx
   // ✅ جلوگیری از double submission
   <LoadingButton isLoading={isLoading}>ذخیره</LoadingButton>
   ```

3. **ورودی‌ها را Sanitize کنید**
   ```tsx
   // ✅ ایمن‌سازی ورودی
   const cleanInput = sanitizeString(userInput);
   ```

4. **از Validation Schemas استفاده کنید**
   ```tsx
   // ✅ اعتبارسنجی یکسان در Frontend و Backend
   const result = createCustomerSchema.safeParse(data);
   ```

5. **برای لیست‌های بلند Pagination اضافه کنید**
   ```tsx
   // ✅ تجربه کاربری بهتر
   <Pagination currentPage={page} totalPages={total} onPageChange={setPage} />
   ```

---

## 🔗 منابع

- [Zod Documentation](https://zod.dev/)
- [tRPC Documentation](https://trpc.io/)
- [Radix UI](https://www.radix-ui.com/)
- [Tailwind CSS](https://tailwindcss.com/)
- [jsPDF](https://github.com/parallax/jsPDF)

---

**آخرین به‌روزرسانی:** دی‌ماه 1403  
**نسخه:** 2.0.0
