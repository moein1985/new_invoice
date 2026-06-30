# سامانه خرید - طرح پیشنهادی

## خلاصه
افزودن سامانه خرید به برنامه مدیریت فاکتور. مدیر/مدیر میانی درخواست خرید ایجاد می‌کند، کاربر استعلام‌ها را جمع‌آوری کرده و نتیجه را برای تایید ارسال می‌کند.

---

## نقش‌ها و دسترسی‌ها

| عملیات | ADMIN | MANAGER | USER |
|--------|-------|---------|------|
| ایجاد درخواست خرید | ✅ | ✅ | ❌ |
| مشاهده درخواست‌ها | ✅ | ✅ | فقط تخصیص‌یافته |
| ایجاد استعلام | ✅ | ✅ | ✅ |
| آپلود پیش‌فاکتور/عکس | ✅ | ✅ | ✅ |
| ارسال برای تایید | ❌ | ❌ | ✅ |
| تایید استعلام (انتخاب) | ✅ | ✅ | ❌ |
| رد درخواست | ✅ | ✅ | ❌ |

---

## مدل داده (Prisma)

### جداول جدید

```
PurchaseRequest (درخواست خرید)
├── id, requestNumber (auto: PR-1405-000001)
├── title, description
├── voiceNote (آدرس فایل صوتی - اختیاری)
├── priority (LOW, MEDIUM, HIGH, URGENT)
├── status (DRAFT, PENDING_INQUIRY, INQUIRED, APPROVED, REJECTED, PURCHASED)
├── projectId → Project (پروژه/محل استفاده)
├── createdById → User (مدیر/مدیر میانی)
├── assignedToId → User (کاربر مسئول استعلام)
├── approvedInquiryId → PurchaseInquiry (استعلام تایید‌شده)
├── deadline (مهلت استعلام)
├── timestamps

PurchaseItem (قلم خرید)
├── id, purchaseRequestId → PurchaseRequest
├── productName, description
├── quantity, unit
├── estimatedPrice (قیمت تخمینی)
├── timestamps

PurchaseInquiry (استعلام خرید)
├── id, purchaseRequestId → PurchaseRequest
├── supplierName (نام تأمین‌کننده)
├── supplierPhone, supplierAddress
├── totalPrice, notes
├── paymentMethod (روش پرداخت: نقدی، چکی، اعتباری و...)
├── paymentDays (مهلت پرداخت به روز - اختیاری)
├── createdById → User
├── timestamps

InquiryItem (قلم استعلام)
├── id, inquiryId → PurchaseInquiry
├── purchaseItemId → PurchaseItem
├── unitPrice, totalPrice
├── availability (AVAILABLE, UNAVAILABLE, PARTIAL)
├── deliveryDays, notes

InquiryAttachment (پیوست استعلام)
├── id, inquiryId → PurchaseInquiry
├── fileName, filePath, fileType, fileSize
├── type (IMAGE, PROFORMA, OTHER)
├── timestamps
```

### Enum‌های جدید

```prisma
enum PurchaseStatus {
  DRAFT            // پیش‌نویس
  PENDING_INQUIRY  // در انتظار استعلام
  INQUIRED         // استعلام‌شده (ارسال برای تایید)
  APPROVED         // تایید‌شده
  REJECTED         // رد‌شده
  PURCHASED        // خریداری‌شده
}

enum PurchasePriority {
  LOW
  MEDIUM
  HIGH
  URGENT
}

enum ItemAvailability {
  AVAILABLE
  UNAVAILABLE
  PARTIAL
}

enum AttachmentType {
  IMAGE
  PROFORMA
  OTHER
}
```

---

## گردش کار (Workflow)

```
1. مدیر/مدیر میانی → ایجاد درخواست خرید (+ قلم‌ها + صوت اختیاری)
       ↓
2. تخصیص به کاربر → وضعیت: PENDING_INQUIRY
       ↓
3. کاربر/مدیر/مدیر میانی → ایجاد استعلام‌ها از تأمین‌کنندگان مختلف
   - افزودن قیمت هر قلم
   - آپلود عکس/پیش‌فاکتور
   - ثبت روش پرداخت
       ↓
4. کاربر → ارسال برای تایید → وضعیت: INQUIRED
       ↓
5. مدیر/مدیر میانی → بررسی و مقایسه استعلام‌ها
       ↓
6. مدیر/مدیر میانی → تایید یک استعلام → وضعیت خودکار: APPROVED
   یا رد کل درخواست (REJECTED + دلیل)
       ↓
7. پس از خرید → وضعیت: PURCHASED
```

---

## صفحات

| مسیر | عنوان | توضیح |
|------|-------|-------|
| `/purchases` | لیست درخواست‌ها | فیلتر بر اساس وضعیت/اولویت |
| `/purchases/new` | درخواست جدید | فرم + قلم‌ها + ضبط صوت |
| `/purchases/[id]` | جزئیات درخواست | مشاهده + استعلام‌ها + تایید/رد |
| `/purchases/[id]/inquiry/new` | استعلام جدید | فرم استعلام + آپلود |

---

## API (tRPC Router)

```
purchaseRouter:
  list          - لیست درخواست‌ها (فیلتر بر اساس نقش)
  getById       - جزئیات یک درخواست
  create        - ایجاد درخواست (managerProcedure)
  update        - ویرایش درخواست
  addInquiry    - افزودن استعلام (protectedProcedure)
  submit        - ارسال برای تایید
  approve       - تایید (managerProcedure)
  reject        - رد (managerProcedure)
  markPurchased - علامت‌گذاری خریداری‌شده
  uploadFile    - آپلود فایل (Next.js API Route)
```

---

## آپلود فایل

- **محل ذخیره**: `/uploads/purchases/` داخل کانتینر
- **حداکثر حجم**: عکس 5MB، پیش‌فاکتور 10MB، صوت 10MB
- **فرمت‌های مجاز**:
  - عکس: jpg, png, webp
  - پیش‌فاکتور: pdf, jpg, png
  - صوت: webm, mp3, ogg
- **API Route**: `POST /api/upload/purchase`

---

## ضبط صوت (Voice Note)

- استفاده از `MediaRecorder` API مرورگر
- دکمه ضبط/توقف در فرم درخواست خرید
- نمایش پلیر صوتی (شبیه واتس‌اپ) با:
  - دکمه پخش/توقف
  - نوار پیشرفت
  - نمایش مدت زمان
- ذخیره به فرمت webm

---

## اعلان‌ها (Notification)

| رویداد | گیرنده |
|--------|--------|
| درخواست جدید ایجاد شد | کاربر تخصیص‌یافته |
| استعلام‌ها ارسال شد | مدیر/مدیر میانی |
| درخواست تایید شد | کاربر |
| درخواست رد شد | کاربر |

---

## منوی سایدبار

گروه جدید «سامانه خرید» با آیکون `ShoppingCart`:
- **درخواست‌های خرید** - لیست همه درخواست‌ها
- **درخواست‌های در انتظار** - فقط ADMIN/MANAGER (با badge تعداد)

---

## فازبندی پیاده‌سازی

### فاز ۱: زیرساخت
- مدل Prisma + Migration
- tRPC Router پایه (CRUD)
- API آپلود فایل

### فاز ۲: رابط کاربری
- صفحه لیست درخواست‌ها
- فرم ایجاد درخواست (+ قلم‌ها)
- صفحه جزئیات

### فاز ۳: استعلام
- فرم استعلام + آپلود پیش‌فاکتور/عکس
- جدول مقایسه استعلام‌ها
- گردش تایید/رد

### فاز ۴: صوت و اعلان
- کامپوننت ضبط صوت
- پلیر صوتی واتس‌اپی
- اعلان‌ها
