# سامانه جریان پروژه (Project Flow) - طرح پیشنهادی

## خلاصه
افزودن بخش «جریان پروژه» — تایم‌لاین خودکار از تمام رویدادها و فرم‌های ثبت‌شده برای هر پروژه. هدف: در هر لحظه وضعیت و مرحله پروژه قابل مشاهده باشد. MANAGER می‌تواند موارد را از فلو مخفی کند.

---

## نقش‌ها و دسترسی‌ها

| عملیات | ADMIN | MANAGER | TECHNICAL | CONTRACTOR | EMPLOYER |
|--------|-------|---------|-----------|------------|----------|
| مشاهده جریان پروژه | ✅ | ✅ | ✅ (پروژه خودش) | ✅ (پروژه خودش) | ✅ (پروژه خودش) |
| مخفی/نمایش مورد | ❌ | ✅ | ❌ | ❌ | ❌ |
| فیلتر بر اساس نوع/وضعیت | ✅ | ✅ | ✅ | ✅ | ✅ |

> ثبت موارد کاملاً خودکار است.

---

## مدل داده (Prisma)

```prisma
model ProjectFlowItem {
  id          String   @id @default(uuid())
  projectId   String
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  type        FlowItemType
  referenceId String?
  title       String
  description String?
  status      FlowItemStatus
  createdById String
  createdBy   User     @relation("FlowItemsCreatedBy", fields: [createdById], references: [id])
  hidden      Boolean  @default(false)
  hiddenById  String?
  hiddenBy    User?    @relation("FlowItemsHiddenBy", fields: [hiddenById], references: [id])
  hiddenAt    DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  @@index([projectId, type])
  @@index([projectId, status])
}

enum FlowItemType {
  PROJECT_CREATED
  MEMBER_ADDED
  MEMBER_REMOVED
  EMPLOYER_ASSIGNED
  WORK_REPORT
  CONTRACTOR_DOC
  PURCHASE_REQUEST
  DOCUMENT
  TICKET
}

enum FlowItemStatus {
  IN_PROGRESS
  COMPLETED
  REJECTED
  INFO
}
```

---

## ثبت خودکار رویدادها

| رویداد | Type | Status | عنوان |
|--------|------|--------|-------|
| ایجاد پروژه | PROJECT_CREATED | INFO | "پروژه ایجاد شد" |
| اضافه شدن عضو | MEMBER_ADDED | INFO | "عضو اضافه شد: {نام} ({نقش})" |
| حذف عضو | MEMBER_REMOVED | INFO | "عضو حذف شد: {نام}" |
| اختصاص کارفرما | EMPLOYER_ASSIGNED | INFO | "کارفرما اختصاص یافت: {نام}" |
| ایجاد گزارش کار | WORK_REPORT | IN_PROGRESS | "گزارش کار #{شماره}" |
| تایید/رد گزارش | WORK_REPORT | COMPLETED/REJECTED | (آپدیت همان entry) |
| ایجاد مستندات | CONTRACTOR_DOC | IN_PROGRESS | "مستندات #{شماره}" |
| تایید/رد مستندات | CONTRACTOR_DOC | COMPLETED/REJECTED | (آپدیت) |
| ایجاد خرید | PURCHASE_REQUEST | IN_PROGRESS | "درخواست خرید #{شماره}" |
| تایید/رد خرید | PURCHASE_REQUEST | COMPLETED/REJECTED | (آپدیت) |
| ایجاد سند | DOCUMENT | IN_PROGRESS | "سند: {عنوان}" |
| تایید/رد سند | DOCUMENT | COMPLETED/REJECTED | (آپدیت) |
| ایجاد تیکت | TICKET | IN_PROGRESS | "تیکت: {عنوان}" |
| بستن تیکت | TICKET | COMPLETED | (آپدیت) |

### نحوه ثبت
- **رویدادهای INFO**: هنگام اجرای mutation، record جدید ایجاد می‌شود.
- **رویدادهای فرم‌ها**: هنگام ایجاد فرم → `IN_PROGRESS`. هنگام تغییر وضعیت → آپدیت با `referenceId`.

---

## نمایش (UI)

### مسیر: `/projects/[id]/flow`

#### نوار پیشرفت (Progress Bar)
- محاسبه: `(COMPLETED) / (کل - INFO - HIDDEN) * 100`

#### تایم‌لاین عمودی
هر مورد: آیکون رنگی + عنوان + badge وضعیت + تاریخ شمسی + نام ایجاد‌کننده + لینک به فرم + دکمه مخفی‌سازی (MANAGER)

#### رنگ‌ها بر اساس نوع
- 🟢 سبز: PROJECT_CREATED / MEMBER_ADDED
- 🟠 نارنجی: MEMBER_REMOVED
- 🔵 آبی: DOCUMENT
- 🟣 بنفش: PURCHASE_REQUEST
- 🟢 تیره: WORK_REPORT
- 🟡 زرد: CONTRACTOR_DOC
- 🔴 قرمز: TICKET

#### فیلترها
- نوع (همه / گزارش / خرید / سند / ...)
- وضعیت (همه / در حال انجام / تکمیل / رد شده)
- نمایش موارد مخفی (فقط MANAGER)

---

## API (tRPC Router)

```
projectFlowRouter:
  list         - لیست موارد (protectedProcedure، فیلتر، غیر MANAGER: includeHidden=false)
  stats        - آمار برای نوار پیشرفت (protectedProcedure)
  toggleHidden - مخفی/نمایش مورد (managerProcedure)
```

### تغییرات router‌های موجود
در mutation‌های ایجاد/تایید/رد، کد ثبت/آپدیت `ProjectFlowItem` اضافه می‌شود:

| Router | Mutations |
|--------|-----------|
| project | create, addMember, removeMember, assignEmployer |
| workReport | create, approve, reject |
| contractorDoc | create, approve, reject |
| purchase | create, approve, reject |
| document | create, approve, reject |
| ticket | create, close |

---

## منوی سایدبار
دکمه «جریان پروژه» در صفحه جزئیات پروژه → لینک به `/projects/[id]/flow`

---

## فازبندی پیاده‌سازی

### فاز ۱: زیرساخت
- افزودن `ProjectFlowItem` و enum‌ها به `schema.prisma`
- Prisma Migration
- ایجاد `projectFlow.ts` router (list, stats, toggleHidden)
- ثبت router در `root.ts`

### فاز ۲: ثبت خودکار رویدادها
- اضافه کردن کد فلو به `project.ts`
- اضافه کردن کد فلو به `workReport.ts`
- اضافه کردن کد فلو به `contractorDoc.ts`
- اضافه کردن کد فلو به `purchase.ts`
- اضافه کردن کد فلو به `document.ts`
- اضافه کردن کد فلو به `ticket.ts`

### فاز ۳: رابط کاربری
- ایجاد صفحه `/projects/[id]/flow`
- کامپوننت Progress Bar
- کامپوننت Timeline
- فیلترها
- دکمه مخفی‌سازی
