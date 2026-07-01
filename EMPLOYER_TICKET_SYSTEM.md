# سامانه تیکت کارفرمایان - طرح پیشنهادی

## خلاصه
افزودن نقش جدید Employer (کارفرما) به سیستم. کارفرما کاربر سیستمی است که توسط admin/manager به پروژه‌ای اختصاص می‌یابد و می‌تواند برای پروژه‌های خود تیکت ثبت کند، در مکالمه تیکت مشارکت کند و تیکت را ببندد. admin/manager تمام تیکت‌ها را مدیریت می‌کنند.

---

## نقش‌ها و دسترسی‌ها

| عملیات | ADMIN | MANAGER | EMPLOYER |
|--------|-------|---------|----------|
| ایجاد کاربر کارفرما | ✅ | ✅ | ❌ |
| اختصاص کارفرما به پروژه | ✅ | ✅ | ❌ |
| ثبت تیکت جدید | ✅ | ✅ | ✅ (فقط پروژه خودش) |
| مشاهده تیکت‌ها | ✅ (همه) | ✅ (همه) | ✅ (فقط پروژه خودش) |
| پاسخ در مکالمه تیکت | ✅ | ✅ | ✅ |
| تغییر وضعیت تیکت | ✅ | ✅ | ❌ (فقط بستن) |
| بستن تیکت | ✅ | ✅ | ✅ |
| حذف تیکت | ✅ | ✅ | ❌ |
| آپلود پیوست | ✅ | ✅ | ✅ |

---

## مدل داده (Prisma)

### تغییرات موجودیت‌های موجود

#### ۱. enum UserRole
افزودن مقدار جدید:
```prisma
enum UserRole {
  ADMIN
  MANAGER
  USER
  CONTRACTOR
  EMPLOYER    // نقش جدید: کارفرما
}
```

#### ۲. مدل Project
افزودن فیلد `employerUserId`:
```prisma
model Project {
  // ... فیلدهای موجود
  employerUserId String?    // کاربر کارفرمای پروژه (اختیاری)
  employerUser   User?      @relation("ProjectEmployer", fields: [employerUserId], references: [id])
}
```
> **نکته:** فیلد `employerName` موجود حفظ می‌شود (متنی آزاد) ولی `employerUserId` ارتباط رسمی با کاربر سیستم را برقرار می‌کند.

### جداول جدید

```
Ticket (تیکت)
├── id, ticketNumber (auto: TKT-1405-000001)
├── title, description
├── priority (LOW, MEDIUM, HIGH, URGENT)
├── status (OPEN, IN_PROGRESS, RESOLVED, CLOSED)
├── projectId → Project
├── createdById → User (کارفرما یا مدیر)
├── closedById → User (اختیاری)
├── closedAt (اختیاری)
├── timestamps

TicketReply (پاسخ/مکالمه تیکت)
├── id, ticketId → Ticket
├── content (متن پیام)
├── userId → User (نویسنده)
├── timestamps

TicketAttachment (پیوست تیکت)
├── id, ticketId → Ticket
├── fileName, filePath, fileType, fileSize
├── uploadedById → User
├── timestamps
```

### Enum‌های جدید

```prisma
enum TicketStatus {
  OPEN         // باز
  IN_PROGRESS  // در حال بررسی
  RESOLVED     // حل‌شده
  CLOSED       // بسته‌شده
}

enum TicketPriority {
  LOW
  MEDIUM
  HIGH
  URGENT
}
```

---

## گردش کار (Workflow)

```
۱. admin/manager → ایجاد کاربر با نقش EMPLOYER
       ↓
۲. admin/manager → اختصاص کارفرما به پروژه (فیلد employerUserId)
       ↓
۳. کارفرما → ورود به سیستم (منوی اختصاصی: داشبورد، تقویم، تیکت)
       ↓
۴. کارفرما → ثبت تیکت جدید برای پروژه خودش
   - عنوان، توضیح، اولویت
   - پیوست فایل (اختیاری)
   - وضعیت خودکار: OPEN
       ↓
۵. admin/manager → مشاهده تیکت در پنل مدیریت کارفرمایان
   - تغییر وضعیت به IN_PROGRESS
   - پاسخ در مکالمه
       ↓
۶. کارفرما / admin / manager → ادامه مکالمه (Thread)
   - افزودن پیام
   - افزودن پیوست
       ↓
۷. admin/manager → تغییر وضعیت به RESOLVED (حل‌شده)
       ↓
۸. کارفرما یا admin/manager → بستن تیکت → وضعیت: CLOSED
```

---

## صفحات

### صفحات کارفرما (نقش EMPLOYER)

| مسیر | عنوان | توضیح |
|------|-------|-------|
| `/dashboard/employer` | داشبورد کارفرما | خلاصه تیکت‌ها و پروژه‌ها |
| `/calendar` | تقویم | تقویم مشترک |
| `/tickets` | لیست تیکت‌ها | تیکت‌های پروژه‌های کارفرما |
| `/tickets/new` | تیکت جدید | فرم ثبت تیکت |
| `/tickets/[id]` | جزئیات تیکت | مکالمه + پیوست + وضعیت |

### صفحات مدیریت (ADMIN/MANAGER)

| مسیر | عنوان | توضیح |
|------|-------|-------|
| `/employers` | کارفرمایان | لیست کارفرماها + تیکت‌هایشان |
| `/employers/tickets` | مدیریت تیکت‌ها | همه تیکت‌ها با فیلتر |
| `/employers/tickets/[id]` | جزئیات تیکت | مدیریت کامل تیکت |

> **نکته:** مسیر `/tickets` و `/tickets/[id]` بین کارفرما و مدیر مشترک است ولی با منطق دسترسی متفاوت (کارفرما فقط تیکت‌های پروژه خودش، مدیر همه).

---

## API (tRPC Router)

```
ticketRouter:
  list              - لیست تیکت‌ها (فیلتر بر اساس نقش)
    - EMPLOYER: فقط تیکت‌های پروژه‌های خودش
    - ADMIN/MANAGER: همه تیکت‌ها
  getById           - جزئیات یک تیکت (بررسی دسترسی)
  create            - ثبت تیکت جدید (protectedProcedure)
    - EMPLOYER: فقط برای پروژه‌های خودش
    - ADMIN/MANAGER: برای هر پروژه
  addReply          - افزودن پاسخ به مکالمه (protectedProcedure)
  addAttachment     - افزودن پیوست (protectedProcedure)
  updateStatus      - تغییر وضعیت (managerProcedure)
    - ADMIN/MANAGER: OPEN → IN_PROGRESS → RESOLVED
  close             - بستن تیکت (protectedProcedure)
    - EMPLOYER: فقط تیکت‌های خودش
    - ADMIN/MANAGER: همه تیکت‌ها
  delete            - حذف تیکت (managerProcedure)
  stats             - آمار تیکت‌ها (برای داشبورد)

projectRouter (تغییرات):
  listEmployers     - لیست کاربران با نقش EMPLOYER (managerProcedure)
  assignEmployer    - اختصاص کارفرما به پروژه (managerProcedure)
  removeEmployer    - حذف کارفرما از پروژه (managerProcedure)
```

---

## آپلود فایل

- **محل ذخیره**: `/uploads/tickets/` داخل کانتینر
- **حداکثر حجم**: عکس ۵MB، PDF ۱۰MB
- **فرمت‌های مجاز**:
  - عکس: jpg, png, webp
  - مستند: pdf
  - دیگر: zip, rar
- **API Route**: `POST /api/upload/ticket`

---

## منوی سایدبار

### نقش EMPLOYER (منوی اختصاصی)
گروه‌های منو:
- **اصلی**: داشبورد، تقویم، تیکت‌ها (با badge تعداد باز)

### نقش‌های ADMIN/MANAGER (افزودن به منوی موجود)
گروه جدید «کارفرمایان» با آیکون `Building2`:
- **مدیریت تیکت‌ها** - لیست همه تیکت‌ها (با badge تعداد باز)

---

## اعلان‌ها (Notification)

| رویداد | گیرنده |
|--------|--------|
| تیکت جدید ثبت شد | admin/manager (همه) |
| پاسخ جدید در تیکت | طرف مقابل مکالمه |
| تیکت بسته شد | نویسنده تیکت (اگر کارفرما بست → admin/manager، اگر admin بست → کارفرما) |
| وضعیت تیکت تغییر کرد | کارفرمای پروژه |

---

## فازبندی پیاده‌سازی

### فاز ۱: زیرساخت
- افزودن EMPLOYER به enum UserRole
- افزودن employerUserId به مدل Project
- ایجاد مدل‌های Ticket, TicketReply, TicketAttachment
- Prisma Migration
- tRPC Router پایه (CRUD)
- API آپلود فایل تیکت

### فاز ۲: رابط کاربری کارفرما
- منوی سایدبار اختصاصی EMPLOYER
- صفحه داشبورد کارفرما
- صفحه لیست تیکت‌ها
- فرم ثبت تیکت جدید (+ پیوست)
- صفحه جزئیات تیکت (مکالمه + پیوست + بستن)

### فاز ۳: رابط کاربری مدیریت
- صفحه مدیریت کارفرمایان
- لیست همه تیکت‌ها با فیلتر (پروژه/وضعیت/اولویت)
- صفحه جزئیات تیکت با مدیریت کامل (تغییر وضعیت + پاسخ + حذف)
- اختصاص کارفرما به پروژه (در صفحه پروژه)

### فاز ۴: اعلان‌ها و نهایی
- اعلان‌های تیکت
- آمار داشبورد
- بهبود UI و تجربه کاربری
