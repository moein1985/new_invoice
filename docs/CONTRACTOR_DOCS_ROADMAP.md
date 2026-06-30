<style>
  .rtl-doc,
  .rtl-doc p,
  .rtl-doc li,
  .rtl-doc h1,
  .rtl-doc h2,
  .rtl-doc h3,
  .rtl-doc h4,
  .rtl-doc h5,
  .rtl-doc h6,
  .rtl-doc table,
  .rtl-doc blockquote {
    direction: rtl !important;
    text-align: right !important;
  }

  .rtl-doc {
    font-family: "Vazirmatn", "IRANSansX", "Segoe UI", Tahoma, sans-serif;
    line-height: 1.9;
    unicode-bidi: plaintext;
  }

  .rtl-doc ul,
  .rtl-doc ol {
    padding-right: 1.2rem !important;
    padding-left: 0 !important;
    margin-right: 0 !important;
    margin-left: 0 !important;
  }

  .rtl-doc pre,
  .rtl-doc code,
  .rtl-doc kbd,
  .rtl-doc samp {
    direction: ltr !important;
    text-align: left !important;
    unicode-bidi: embed;
    font-family: "Cascadia Mono", "Consolas", "Courier New", monospace;
  }
</style>

<d
# نقشه راه: سیستم مستندات پیمانکار (Contractor Documents)

## هدف
ایجاد سیستمی برای ثبت رسیدهای تحویل/دریافت اقلام از انبار پروژه‌ها و خریدهای جزئی پیمانکاران همراه با آپلود تصویر (عکس رسید، فاکتور و ...) و جریان تأیید توسط مدیر.

---

## فاز ۱: مدل داده (Prisma Schema)

### مدل `ContractorDoc`
در فایل `prisma/schema.prisma` اضافه شود:

- `id` — UUID
- `docNumber` — شماره سند یکتا (فرمت: `CD-YYYY-NNNN`)
- `type` — enum `ContractorDocType`: `RECEIPT` (رسید تحویل/دریافت) | `EXPENSE` (هزینه جزئی) | `GENERAL` (مستند عمومی)
- `direction` — enum `DocDirection`: `RECEIVED` (دریافت از پروژه) | `DELIVERED` (تحویل به پروژه) — فقط برای نوع RECEIPT معنادار است، برای بقیه nullable
- `projectId` — رابطه با Project (الزامی)
- `createdById` — رابطه با User (پیمانکار ثبت‌کننده)
- `description` — شرح سند
- `totalAmount` — مبلغ کل (Float, default 0) — برای EXPENSE الزامی، برای RECEIPT اختیاری
- `approvalStatus` — از enum موجود `ApprovalStatus` استفاده شود (PENDING/APPROVED/REJECTED)
- `rejectionReason` — دلیل رد (nullable)
- `docDate` — تاریخ سند (DateTime, default now)
- `notes` — یادداشت اختیاری
- `createdAt`, `updatedAt`
- رابطه با `ContractorDocItem[]` و `ContractorDocAttachment[]`
- ایندکس روی: projectId, createdById, approvalStatus, type, docDate
- map به `contractor_docs`

### مدل `ContractorDocItem`
آیتم‌های هر سند:

- `id` — UUID
- `contractorDocId` — FK
- `description` — شرح قلم
- `unit` — واحد (از همان لیست واحدهای WorkReportItem: متر، عدد، کیلوگرم، ...)
- `quantity` — تعداد/مقدار (Float)
- `unitPrice` — قیمت واحد (Float, default 0)
- `totalPrice` — قیمت کل (Float, default 0)
- رابطه onDelete: Cascade
- map به `contractor_doc_items`

### مدل `ContractorDocAttachment`
فایل‌های پیوست (عکس رسید، فاکتور، ...):

- `id` — UUID
- `contractorDocId` — FK
- `fileName` — نام فایل اصلی
- `filePath` — مسیر ذخیره روی سرور (در پوشه `uploads/contractor-docs/`)
- `fileSize` — حجم فایل (Int, bytes)
- `mimeType` — نوع فایل (image/jpeg, image/png, application/pdf)
- `createdAt`
- رابطه onDelete: Cascade
- map به `contractor_doc_attachments`

### تغییرات در مدل‌های موجود
- به مدل `Project` رابطه `contractorDocs ContractorDoc[]` اضافه شود
- به مدل `User` رابطه `contractorDocs ContractorDoc[]` اضافه شود

---

## فاز ۲: API آپلود فایل

### مسیر: `app/api/upload/contractor-doc/route.ts`

- یک Next.js Route Handler برای آپلود فایل
- متد POST، دریافت `multipart/form-data`
- اعتبارسنجی: فقط کاربران لاگین‌شده، حداکثر حجم ۱۰ مگابایت، فقط فرمت‌های مجاز (jpeg, png, webp, pdf)
- ذخیره فایل در مسیر `/app/uploads/contractor-docs/` با نام UUID برای جلوگیری از تداخل
- بازگرداندن `{ fileName, filePath, fileSize, mimeType }`
- **نکته امنیتی:** نام فایل اصلی sanitize شود، مسیر ذخیره خارج از public باشد

### مسیر: `app/api/upload/contractor-doc/[id]/route.ts`

- متد GET برای serve کردن فایل‌ها
- اعتبارسنجی session — فقط کاربران لاگین‌شده
- id = نام فایل UUID
- بازگرداندن فایل با Content-Type مناسب

---

## فاز ۳: tRPC Router

### فایل: `server/api/routers/contractorDoc.ts`

**پروسیجرها:**

#### `list` (protectedProcedure)
- ورودی: `projectId`, `page`, `limit`, `type?` (فیلتر نوع), `status?` (فیلتر وضعیت), `search?`
- پیمانکار (USER): فقط اسناد خودش
- مدیر (MANAGER/ADMIN): همه اسناد
- مرتب‌سازی بر اساس docDate نزولی
- شامل: items count, attachments count, project name, creator name

#### `listAll` (managerProcedure)
- لیست همه اسناد در همه پروژه‌ها با فیلتر و جستجو
- ورودی: `page`, `limit`, `type?`, `status?`, `projectId?`, `createdById?`, `search?`, `dateFrom?`, `dateTo?`
- برای صفحه مدیریت کل

#### `getById` (protectedProcedure)
- ورودی: `id`
- بازگرداندن سند کامل با items, attachments, project, createdBy
- پیمانکار فقط سند خودش

#### `create` (protectedProcedure)
- ورودی: `projectId`, `type`, `direction?`, `description`, `totalAmount?`, `docDate?`, `notes?`, `items[]`, `attachments[]`
- items: آرایه‌ای از `{ description, unit, quantity, unitPrice?, totalPrice? }`
- attachments: آرایه‌ای از `{ fileName, filePath, fileSize, mimeType }` (قبلاً آپلود شده)
- اعتبارسنجی عضویت در پروژه (برای پیمانکاران)
- تولید شماره سند خودکار: `CD-YYYY-NNNN`
- وضعیت اولیه: PENDING

#### `update` (protectedProcedure)
- فقط اسناد PENDING قابل ویرایش
- پیمانکار فقط سند خودش
- مدیر می‌تواند مبالغ را ویرایش کند
- امکان اضافه/حذف آیتم و پیوست

#### `approve` (managerProcedure)
- تغییر وضعیت به APPROVED
- ارسال نوتیفیکیشن به پیمانکار

#### `reject` (managerProcedure)
- تغییر وضعیت به REJECTED با دلیل رد
- ارسال نوتیفیکیشن به پیمانکار

#### `delete` (protectedProcedure)
- پیمانکار: فقط PENDING خودش
- مدیر: هر سند
- حذف فایل‌های پیوست از دیسک هم انجام شود

#### `summary` (managerProcedure)
- خلاصه آماری: تعداد اسناد در انتظار، مجموع هزینه‌های تأیید‌شده، به تفکیک پروژه و پیمانکار
- برای داشبورد مدیر

#### `pendingCount` (protectedProcedure)
- تعداد اسناد در انتظار تأیید (برای badge)

### ثبت Router
- در `server/api/root.ts` اضافه شود: `contractorDoc: contractorDocRouter`

---

## فاز ۴: صفحات UI

### ۴.۱ صفحه لیست اسناد پروژه: `app/projects/[id]/contractor-docs/page.tsx`

- لیست اسناد مربوط به یک پروژه
- فیلتر بر اساس: نوع (رسید/هزینه/عمومی)، وضعیت (در انتظار/تأیید/رد)
- جستجو در شرح
- نمایش جدولی (دسکتاپ) و کارتی (موبایل) — مشابه الگوی صفحه مخاطبین
- ستون‌ها: شماره سند، نوع (با آیکون و رنگ)، شرح (truncated)، مبلغ، وضعیت (badge)، تاریخ، تعداد پیوست
- دکمه «ثبت سند جدید»
- لینک به صفحه جزئیات هر سند
- Pagination

### ۴.۲ صفحه ثبت سند جدید: `app/projects/[id]/contractor-docs/new/page.tsx`

- فرم شامل:
  - انتخاب نوع سند (رسید/هزینه/عمومی) — با توضیح کوتاه هر نوع
  - جهت تحویل (دریافت/تحویل) — فقط وقتی نوع = رسید
  - شرح سند (textarea)
  - تاریخ سند (date picker شمسی با moment-jalaali — همانند بقیه فرم‌ها)
  - آیتم‌ها: ردیف‌های داینامیک (شرح، واحد، تعداد، قیمت واحد، قیمت کل) — مشابه فرم گزارش کار
  - مبلغ برای نوع EXPENSE الزامی
  - **بخش آپلود تصویر:**
    - دکمه «افزودن تصویر» و «عکس از دوربین» (روی موبایل input با capture="environment")
    - پیش‌نمایش تصاویر آپلود‌شده (thumbnail)
    - امکان حذف تصویر قبل از ثبت
    - پشتیبانی از چند فایل همزمان
    - نمایش progress آپلود
  - یادداشت (اختیاری)
- دکمه ثبت

### ۴.۳ صفحه جزئیات/ویرایش سند: `app/projects/[id]/contractor-docs/[docId]/page.tsx`

- نمایش اطلاعات کامل سند
- جدول آیتم‌ها با مبالغ
- **گالری تصاویر پیوست:** نمایش thumbnailها، کلیک برای بزرگنمایی (lightbox ساده)
- اگر PDF است، لینک دانلود
- وضعیت تأیید با badge رنگی
- **برای مدیر:**
  - دکمه تأیید / رد (با فیلد دلیل رد)
  - امکان ویرایش مبالغ
- **برای پیمانکار:**
  - ویرایش فقط اگر PENDING
  - اضافه کردن تصویر جدید

### ۴.۴ صفحه مدیریت کل اسناد (مدیر): `app/contractor-docs/page.tsx`

- لیست همه اسناد همه پروژه‌ها
- فیلتر: پروژه، پیمانکار، نوع، وضعیت، بازه تاریخی
- خلاصه آماری بالای صفحه: تعداد در انتظار، مجموع هزینه‌ها
- دسترسی: فقط MANAGER/ADMIN

---

## فاز ۵: ناوبری و یکپارچه‌سازی

### سایدبار (`components/ui/sidebar.tsx`)
- اضافه کردن آیتم «مستندات پیمانکار» با آیکون `FileImage` از lucide-react
- بعد از «گزارش‌ کار» یا «مخاطبین»
- لینک به `/contractor-docs`
- badge تعداد اسناد در انتظار (برای مدیران)

### صفحه پروژه
- در صفحه جزئیات پروژه (`app/projects/[id]/page.tsx`) یک تب یا لینک به «مستندات پیمانکار» اضافه شود

### نوتیفیکیشن
- از سیستم نوتیفیکیشن موجود (`notification` router) استفاده شود
- هنگام ثبت سند جدید → نوتیفیکیشن برای مدیران
- هنگام تأیید/رد → نوتیفیکیشن برای پیمانکار

### داشبورد
- در صفحه داشبورد (`app/dashboard/page.tsx`) یک کارت خلاصه برای اسناد در انتظار اضافه شود (برای مدیران)

---

## فاز ۶: Docker و استقرار

### Volume برای آپلودها
- در `docker-compose.yml` یک volume جدید برای مسیر آپلود اضافه شود:
  ```
  volumes:
    - uploads_data:/app/uploads
  ```
- یا bind mount به مسیر host:
  ```
  volumes:
    - ./uploads:/app/uploads
  ```

### Prisma Migration
- پس از تغییر schema، اجرای `npx prisma db push` در کانتینر

---

## نکات فنی مهم

### الگوهای موجود که باید رعایت شوند:
- **tRPC Router:** الگوی `workReport.ts` و `contact.ts` را دنبال کنید
- **صفحات UI:** الگوی RTL فارسی، استفاده از کامپوننت‌های موجود (`LoadingButton`, `Pagination`, `Breadcrumb`, `PageSkeleton`, `toast-provider`)
- **اعتبارسنجی:** استفاده از zod در router — مشابه بقیه routerها
- **دسترسی‌ها:** استفاده از `protectedProcedure` و `managerProcedure` از `server/api/trpc.ts`
- **شماره سند:** الگوی `WR-YYYY-NNNN` را برای `CD-YYYY-NNNN` تکرار کنید
- **تاریخ شمسی:** از `moment-jalaali` استفاده شود — مشابه بقیه صفحات
- **واحدها:** لیست واحدها از WorkReport استفاده شود (متر، عدد، کیلوگرم، مترمربع، مترمکعب، شاخه، تن، لیتر، سایر)
- **Responsive:** جدول برای دسکتاپ، کارت برای موبایل — الگوی `contacts/page.tsx`

### امنیت آپلود:
- اعتبارسنجی نوع فایل سمت سرور (نه فقط extension، بلکه magic bytes)
- محدودیت حجم ۱۰ مگابایت
- نام فایل UUID (جلوگیری از path traversal)
- serve فایل فقط با اعتبارسنجی session
- مسیر uploads خارج از public (دسترسی فقط از طریق API)

### سرور استقرار:
- IP: 192.168.85.11
- سرور اینترنت بین‌الملل ندارد — از mirror داخلی `repo.iut.ac.ir` استفاده می‌شود
- Dockerfile: `Dockerfile.deploy`
- Build: `docker build --no-cache -t new_invoice-web:vXX-tag -f Dockerfile.deploy .`
- Deploy: تغییر image در `docker-compose.yml` و `docker compose up -d web`
