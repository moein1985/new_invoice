# نقشه راه توسعه — پروژه‌ها، پیمانکاران و گزارش کار

## اصول کلی

- **سازگاری با نسخه قبلی:** تمام تغییرات دیتابیس باید `additive` باشند (فیلد جدید با مقدار پیش‌فرض، بدون حذف/تغییر نام فیلدهای موجود).
- **مهاجرت دیتابیس:** قبل از هر `prisma migrate`، حتماً `npx prisma migrate dev --name <name>` در محیط توسعه اجرا شود. در سرور، `docker-entrypoint.sh` به‌صورت خودکار `prisma migrate deploy` را در هر ری‌استارت اجرا می‌کند.
- **فایل‌های سرور:** هیچ فایل آپلودی روی سرور حذف یا جابجا نمی‌شود. مسیرهای جدید فقط به فایل‌های جدید اشاره می‌کنند.
- **API:** تمام تغییرات `tRPC` باید `backward compatible` باشند — فیلدهای جدید `optional` باشند، فیلدهای موجود حذف یا تغییر نام داده نشوند.
- **نقش‌ها:** سه نقش فعال در سیستم: `ADMIN` (سرپرست)، `MANAGER` (مدیر میانی — دسترسی‌های مشابه ADMIN)، `CONTRACTOR` (پیمانکار). هر سه نقش باید حفظ شوند.
- **قیمت‌گذاری:** فقط `ADMIN` و `MANAGER` می‌توانند قیمت واحد/کل را در گزارش کار تعیین کنند. پیمانکار فقط شرح و مقدار وارد می‌کند.
- **ساختار گزارش:** هر گزارش شامل چند ردیف آیتم است. در یک روز می‌توان چند گزارش جداگانه ثبت کرد.
- **تست:** قبل از شروع هر فاز، تست‌های موجود را اجرا کنید: `npx vitest run`. بعد از تغییرات دوباره اجرا کنید.
- **هر فاز مستقل است:** اگر فاز ۱ کامل شد و روی سرور اعمال شد، فاز ۲ می‌تواند جداگانه اعمال شود. هیچ فازی به فاز بعدی وابسته نیست.
- **قبل از هر تغییر:** `git checkout -b phase-<number>` بزنید تا روی شاخه جداگانه کار کنید.

### معماری سرور

- **محیط:** Docker-based روی `192.168.85.11`
- **کانتینرها:** `invoice_web` (Next.js), `invoice_postgres` (PostgreSQL), `invoice_nginx` (Nginx)
- **مسیر کانتینر:** `process.cwd()` = `/app`
- **Volume آپلود:** `/home/moein/new_invoice/uploads` → `/app/uploads` (در حال حاضر خالی)
- **مهاجرت خودکار:** `docker-entrypoint.sh` در هر ری‌استارت `prisma migrate deploy` اجرا می‌کند
- **استقرار:** با build کردن Docker image جدید و `docker compose up -d`

---

## فاز ۱ — رفع باگ‌های حیاتی (P0)

### هدف
رفع ۴ باگ که مانع کارکرد صحیح گزارش کار هستند.

### فایل‌های درگیر
- `prisma/schema.prisma`
- `server/api/routers/workReport.ts`
- `app/projects/[id]/reports/[reportId]/page.tsx`
- `app/dashboard/page.tsx`

### گام‌به‌گام

#### ۱.۱ اضافه کردن فیلد `rejectionReason` به مدل `WorkReport`

**فایل:** `prisma/schema.prisma`

در مدل `WorkReport` (حدود خط ۳۰۰)، بعد از فیلد `notes`، این فیلد را اضافه کن:

```prisma
  rejectionReason String?
```

**نکته سازگاری:** فیلد `optional` است (`?`). رکوردهای موجود مقدار `null` خواهند داشت. هیچ داده‌ای از دست نمی‌رود.

سپس مهاجرت اجرا کن:
```bash
npx prisma migrate dev --name add_rejection_reason_to_work_report
```

#### ۱.۲ ذخیره دلیل رد در `reject` mutation

**فایل:** `server/api/routers/workReport.ts`

در پروسیجر `reject` (حدود خط ۳۰۵)، ورودی `comment` را به `reason` تغییر نام بده (یا `comment` را نگه دار و `optional` باشد) و در دیتابیس ذخیره کن:

```typescript
  reject: managerProcedure
    .input(z.object({
      id: z.string().uuid(),
      comment: z.string().optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      const report = await ctx.prisma.workReport.findUnique({ where: { id: input.id } });
      if (!report) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'گزارش کار یافت نشد' });
      }

      const updated = await ctx.prisma.workReport.update({
        where: { id: input.id },
        data: {
          approvalStatus: 'REJECTED',
          rejectionReason: input.comment || null,
        },
      });

      // نوتیفیکیشن به پیمانکار
      await ctx.prisma.notification.create({
        data: {
          userId: report.createdById,
          type: 'WORK_REPORT_REJECTED',
          title: 'گزارش کار رد شد',
          message: `گزارش ${report.reportNumber} رد شد${input.comment ? `: ${input.comment}` : ''}`,
          link: `/projects/${report.projectId}/reports/${report.id}`,
        },
      });

      return updated;
    }),
```

#### ۱.۳ اضافه کردن نوتیفیکیشن به `create` mutation

**فایل:** `server/api/routers/workReport.ts`

در `create` mutation (حدود خط ۱۵۵)، بعد از `return ctx.prisma.workReport.create(...)`، نوتیفیکیشن به مدیران بفرست. برای این کار باید `create` را در یک متغیر ذخیره کن:

```typescript
      const created = await ctx.prisma.workReport.create({
        data: {
          reportNumber,
          projectId: input.projectId,
          createdById: userId,
          notes: input.notes,
          items: {
            create: input.items.map((item) => ({
              description: item.description,
              unit: item.unit,
              quantity: item.quantity,
              unitPrice: 0,
              totalPrice: 0,
            })),
          },
        },
        include: {
          items: true,
          project: { select: { name: true } },
        },
      });

      // نوتیفیکیشن به مدیران
      const managers = await ctx.prisma.user.findMany({
        where: { isActive: true, role: { in: ['ADMIN', 'MANAGER'] } },
        select: { id: true },
      });

      if (managers.length > 0) {
        await ctx.prisma.notification.createMany({
          data: managers.map((manager) => ({
            userId: manager.id,
            type: 'WORK_REPORT_SUBMITTED',
            title: 'گزارش کار جدید',
            message: `گزارش ${reportNumber} برای پروژه ${created.project.name} ثبت شد`,
            link: `/projects/${input.projectId}/reports/${created.id}`,
          })),
        });
      }

      return created;
```

#### ۱.۴ اضافه کردن نوتیفیکیشن به `approve` mutation

**فایل:** `server/api/routers/workReport.ts`

در `approve` mutation (حدود خط ۳۰۲)، بعد از آپدیت، نوتیفیکیشن به پیمانکار بفرست:

```typescript
  approve: managerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const report = await ctx.prisma.workReport.findUnique({ where: { id: input.id } });
      if (!report) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'گزارش کار یافت نشد' });
      }

      const updated = await ctx.prisma.workReport.update({
        where: { id: input.id },
        data: {
          approvalStatus: 'APPROVED',
          rejectionReason: null,
        },
      });

      await ctx.prisma.notification.create({
        data: {
          userId: report.createdById,
          type: 'WORK_REPORT_APPROVED',
          title: 'گزارش کار تایید شد',
          message: `گزارش ${report.reportNumber} تایید شد`,
          link: `/projects/${report.projectId}/reports/${report.id}`,
        },
      });

      return updated;
    }),
```

#### ۱.۵ بازمحاسبه `totalAmount` در `update` mutation

**فایل:** `server/api/routers/workReport.ts`

در `update` mutation (حدود خط ۲۶۹)، بعد از ساخت آیتم‌ها، `totalAmount` را محاسبه و آپدیت کن:

```typescript
      // بعد از ایجاد آیتم‌ها
      const items = input.items.map((item) => {
        const unitPrice = isManager && item.unitPrice !== undefined ? item.unitPrice : 0;
        return {
          workReportId: input.id,
          description: item.description,
          unit: item.unit,
          quantity: item.quantity,
          unitPrice,
          totalPrice: unitPrice * item.quantity,
        };
      });

      await ctx.prisma.workReportItem.createMany({ data: items });

      // بازمحاسبه totalAmount
      const totalAmount = items.reduce((sum, item) => sum + item.totalPrice, 0);
      await ctx.prisma.workReport.update({
        where: { id: input.id },
        data: { totalAmount },
      });

      return ctx.prisma.workReport.findUnique({
        where: { id: input.id },
        include: {
          items: { orderBy: { createdAt: 'asc' } },
          project: { select: { name: true, code: true } },
        },
      });
```

#### ۱.۶ حذف `console.log` دیباگ

**فایل ۱:** `app/projects/[id]/reports/[reportId]/page.tsx`

خطوط ۵۰-۵۲ را حذف کن:
```typescript
  // Debug logging
  if (typeof window !== 'undefined') {
    console.log('WorkReportDetail Debug:', { reportId, role, isManager, isLoading, hasReport: !!report, queryError: queryError?.message });
  }
```

**فایل ۲:** `app/dashboard/page.tsx`

خط ۵۶ را حذف کن:
```typescript
  console.log('Dashboard - Status:', status, 'Session:', session);
```

و خط ۶۳ را حذف کن:
```typescript
    console.log('No session found, redirecting to login');
```

### چک‌لیست فاز ۱

- [x] فیلد `rejectionReason` به `WorkReport` اضافه شده
- [x] `prisma migrate dev` با موفقیت اجرا شده
- [x] `reject` mutation دلیل رد را ذخیره می‌کند
- [x] `create` mutation نوتیفیکیشن به مدیران می‌فرستد
- [x] `approve` mutation نوتیفیکیشن به پیمانکار می‌فرستد
- [x] `reject` mutation نوتیفیکیشن به پیمانکار می‌فرستد
- [x] `update` mutation `totalAmount` را بازمحاسبه می‌کند
- [x] `console.log` از `reports/[reportId]/page.tsx` حذف شده
- [x] `console.log` از `dashboard/page.tsx` حذف شده
- [x] تست‌ها اجرا شده: `npx jest --maxWorkers=1` — ۲۶۷ تست پاس شد
- [ ] دستی تست شده: ثبت گزارش → تایید → بررسی نوتیفیکیشن
- [ ] دستی تست شده: ثبت گزارش → رد با دلیل → بررسی ذخیره دلیل
- [ ] دستی تست شده: ویرایش گزارش با قیمت → بررسی `totalAmount`
- [ ] روی سرور: `npx prisma migrate deploy` اجرا شده
- [ ] روی سرور: سرویس ری‌استارت شده و لاگ‌های خطا بررسی شده

---

## فاز ۲ — داشبورد پیمانکار و بهبود ناوبری (P1)

### هدف
پیمانکار یک صفحه مستقل دارد که از آنجا گزارش روزانه ثبت می‌کند، گزارش‌های خودش را می‌بیند و مستنداتش را مدیریت می‌کند.

### فایل‌های درگیر
- `app/dashboard/contractor/page.tsx` (جدید)
- `app/my-reports/page.tsx` (جدید)
- `app/my-docs/page.tsx` (جدید)
- `components/ui/sidebar.tsx`
- `app/dashboard/page.tsx`
- `app/projects/[id]/reports/new/page.tsx`
- `app/projects/[id]/page.tsx`
- `server/api/routers/workReport.ts`

### گام‌به‌گام

#### ۲.۱ ساخت صفحه داشبورد پیمانکار

**فایل جدید:** `app/dashboard/contractor/page.tsx`

این صفحه باید شامل باشد:
- خلاصه: تعداد گزارش‌های در انتظار / تاییدشده / ردشده
- لیست پروژه‌های عضو (با دکمه «ثبت گزارش» برای هر کدام)
- لیست ۵ گزارش اخیر خودش با ستون‌های: شماره، پروژه، تاریخ، وضعیت، مبلغ کل
- لیست ۵ سند اخیر خودش با ستون‌های: شماره، پروژه، نوع، تاریخ، وضعیت

**نکته:** از `trpc.project.list` (برای پیمانکار فقط پروژه‌های عضو را برمی‌گرداند) و `trpc.workReport.listAll` استفاده نکن (آن `managerProcedure` است). باید یک `listMine` جدید بسازی (گام ۲.۲).

#### ۲.۲ اضافه کردن `listMine` به `workReportRouter`

**فایل:** `server/api/routers/workReport.ts`

پروسیجر جدید اضافه کن (بعد از `list`):

```typescript
  // List work reports for the current user (contractor sees own, manager sees all)
  listMine: protectedProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(20),
        status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional().nullable(),
        projectId: z.string().uuid().optional().nullable(),
      })
    )
    .query(async ({ ctx, input }) => {
      const skip = (input.page - 1) * input.limit;
      const userId = ctx.session.user.id;
      const role = ctx.session.user.role;

      const where: any = {};
      if (role === 'CONTRACTOR') {
        where.createdById = userId;
      }
      if (input.status) {
        where.approvalStatus = input.status;
      }
      if (input.projectId) {
        where.projectId = input.projectId;
      }

      const [reports, total] = await Promise.all([
        ctx.prisma.workReport.findMany({
          where,
          skip,
          take: input.limit,
          orderBy: { reportDate: 'desc' },
          include: {
            project: { select: { id: true, name: true, code: true } },
            createdBy: { select: { id: true, fullName: true } },
            items: { select: { totalPrice: true } },
          },
        }),
        ctx.prisma.workReport.count({ where }),
      ]);

      return {
        data: reports.map((r) => ({
          ...r,
          totalAmount: r.items.reduce((sum, i) => sum + (i.totalPrice || 0), 0),
        })),
        meta: {
          page: input.page,
          limit: input.limit,
          total,
          totalPages: Math.ceil(total / input.limit),
        },
      };
    }),
```

#### ۲.۳ اضافه کردن `listMine` به `contractorDocRouter`

**فایل:** `server/api/routers/contractorDoc.ts`

پروسیجر جدید اضافه کن (بعد از `list`):

```typescript
  listMine: protectedProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(20),
        status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional().nullable(),
        projectId: z.string().uuid().optional().nullable(),
      })
    )
    .query(async ({ ctx, input }) => {
      const skip = (input.page - 1) * input.limit;
      const userId = ctx.session.user.id;
      const role = ctx.session.user.role;

      const where: any = {};
      if (role === 'CONTRACTOR') {
        where.createdById = userId;
      }
      if (input.status) {
        where.approvalStatus = input.status;
      }
      if (input.projectId) {
        where.projectId = input.projectId;
      }

      const [docs, total] = await Promise.all([
        ctx.prisma.contractorDoc.findMany({
          where,
          skip,
          take: input.limit,
          orderBy: { docDate: 'desc' },
          include: {
            project: { select: { id: true, name: true, code: true } },
            createdBy: { select: { id: true, fullName: true } },
            _count: { select: { items: true, attachments: true } },
          },
        }),
        ctx.prisma.contractorDoc.count({ where }),
      ]);

      return {
        data: docs,
        meta: {
          page: input.page,
          limit: input.limit,
          total,
          totalPages: Math.ceil(total / input.limit),
        },
      };
    }),
```

#### ۲.۴ ساخت صفحه «گزارش‌های من»

**فایل جدید:** `app/my-reports/page.tsx`

صفحه لیست گزارش‌های پیمانکار با:
- فیلتر بر اساس پروژه و وضعیت
- جدول: شماره، پروژه، تاریخ، وضعیت (با رنگ)، مبلغ کل، دکمه مشاهده
- لینک به `/projects/[id]/reports/[reportId]`
- استفاده از `trpc.workReport.listMine`

#### ۲.۵ ساخت صفحه «مستندات من»

**فایل جدید:** `app/my-docs/page.tsx`

صفحه لیست اسناد پیمانکار با:
- فیلتر بر اساس پروژه و وضعیت
- جدول: شماره، پروژه، نوع، تاریخ، وضعیت، تعداد پیوست، دکمه مشاهده
- لینک به `/projects/[id]/contractor-docs/[docId]`
- استفاده از `trpc.contractorDoc.listMine`

#### ۲.۶ به‌روزرسانی سایدبار پیمانکار

**فایل:** `components/ui/sidebar.tsx`

در بخش `role === 'CONTRACTOR'` (حدود خط ۱۰۱)، آیتم‌های جدید اضافه کن:

```typescript
  const navGroups: NavGroup[] = role === 'CONTRACTOR' ? [
    {
      label: '',
      items: [
        { href: '/dashboard/contractor', label: 'داشبورد', icon: <LayoutDashboard size={20} /> },
        { href: '/projects', label: 'پروژه‌ها', icon: <FolderKanban size={20} /> },
        { href: '/my-reports', label: 'گزارش‌های من', icon: <ClipboardList size={20} /> },
        { href: '/my-docs', label: 'مستندات من', icon: <FileImage size={20} /> },
        { href: '/calendar', label: 'تقویم', icon: <Calendar size={20} /> },
      ],
    },
  ] : [
```

#### ۲.۷ به‌روزرسانی ریدایرکت داشبورد

**فایل:** `app/dashboard/page.tsx`

خط ۶۹-۷۱ را تغییر بده:

```typescript
  // Redirect contractors to their own dashboard
  if (session.user.role === 'CONTRACTOR') {
    router.push('/dashboard/contractor');
    return null;
  }
```

#### ۲.۸ اضافه کردن انتخاب تاریخ به فرم ثبت گزارش

**فایل:** `app/projects/[id]/reports/new/page.tsx`

- یک `useState` برای `reportDate` اضافه کن (پیش‌فرض امروز).
- کامپوننت `JalaliDatePicker` را در فرم قرار بده (مثل `contractor-docs/new/page.tsx`).
- در `createMutation.mutate`، `reportDate` را ارسال کن.

**فایل:** `server/api/routers/workReport.ts`

در `create` mutation، ورودی `reportDate` را بپذیر:

```typescript
  create: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        notes: z.string().optional().nullable(),
        reportDate: z.string().optional().nullable(), // جدید
        items: z.array(
          z.object({
            description: z.string().min(1),
            unit: z.string().min(1),
            quantity: z.number().min(0),
          })
        ).min(1),
      })
    )
```

و در `data`:
```typescript
        data: {
          reportNumber,
          projectId: input.projectId,
          createdById: userId,
          notes: input.notes,
          reportDate: input.reportDate ? new Date(input.reportDate) : new Date(),
          items: { ... },
        },
```

#### ۲.۹ اضافه کردن ستون وضعیت و مبلغ به لیست گزارش‌های پروژه

**فایل:** `app/projects/[id]/page.tsx`

در جدول گزارش‌های کار (حدود خط ۲۶۶)، ستون‌های «وضعیت» و «مبلغ کل» را اضافه کن:

```tsx
<th className="px-4 py-3 text-center font-medium">وضعیت</th>
<th className="px-4 py-3 text-left font-medium">مبلغ کل</th>
```

و در بدنه جدول برای هر گزارش:
```tsx
<td className="px-4 py-3 text-center">
  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
    report.approvalStatus === 'APPROVED' ? 'bg-green-100 text-green-700' :
    report.approvalStatus === 'REJECTED' ? 'bg-red-100 text-red-700' :
    'bg-yellow-100 text-yellow-700'
  }`}>
    {report.approvalStatus === 'APPROVED' ? 'تایید شده' :
     report.approvalStatus === 'REJECTED' ? 'رد شده' : 'در انتظار'}
  </span>
</td>
<td className="px-4 py-3 text-left font-mono text-xs text-gray-700">
  {report.totalAmount > 0 ? Number(report.totalAmount).toLocaleString('fa-IR') : '—'}
</td>
```

**نکته:** `trpc.workReport.list` در `project.ts` باید `totalAmount` را برگرداند. بررسی کن که `select` یا `include` آن را شامل باشد.

### چک‌لیست فاز ۲

- [x] صفحه `/dashboard/contractor` ساخته شده و کار می‌کند
- [x] `listMine` به `workReportRouter` اضافه شده
- [x] `listMine` به `contractorDocRouter` اضافه شده
- [x] صفحه `/my-reports` ساخته شده و فیلتر دارد
- [x] صفحه `/my-docs` ساخته شده و فیلتر دارد
- [x] سایدبار پیمانکار آیتم‌های جدید دارد
- [x] ریدایرکت پیمانکار به `/dashboard/contractor` تغییر کرده
- [x] فرم ثبت گزارش `JalaliDatePicker` دارد
- [x] `create` mutation `reportDate` را می‌پذیرد و ذخیره می‌کند
- [x] جدول گزارش‌های پروژه ستون وضعیت و مبلغ دارد
- [x] تست‌ها اجرا شده: `npx jest --maxWorkers=1` — ۲۶۷ تست پاس شد
- [ ] دستی تست: ورود به‌عنوان پیمانکار → داشبورد → ثبت گزارش → مشاهده در «گزارش‌های من»
- [ ] دستی تست: ورود به‌عنوان مدیر → تایید گزارش → پیمانکار در لیست وضعیت تاییدشده را می‌بیند
- [ ] روی سرور: بیلد بدون خطا انجام شده
- [ ] روی سرور: لاگ خطا بررسی شده

---

## فاز ۳ — بهبودهای متوسط (P2)

### هدف
رفع باگ مسیر آپلود، اضافه کردن خلاصه مالی پروژه، نمایش دلیل رد به پیمانکار.

### فایل‌های درگیر
- `server/api/routers/contractorDoc.ts`
- `app/projects/[id]/page.tsx`
- `app/projects/[id]/reports/[reportId]/page.tsx`
- `app/projects/[id]/contractor-docs/[docId]/page.tsx`
- `server/api/routers/project.ts`

### گام‌به‌گام

#### ۳.۱ رفع مسیر هاردکدشده آپلود

**فایل:** `server/api/routers/contractorDoc.ts`

تابع `resolveAttachmentAbsolutePath` (حدود خط ۸۱) را تغییر بده:

```typescript
async function resolveAttachmentAbsolutePath(filePathOrId: string) {
  const baseDir = path.join(process.cwd(), 'uploads', 'contractor-docs');

  if (!existsSync(baseDir)) {
    return null;
  }

  const safeValue = path.basename(filePathOrId);

  if (safeValue.includes('.')) {
    return path.join(baseDir, safeValue);
  }

  const entries = await readdir(baseDir);
  const matched = entries.find((entry) => entry.startsWith(`${safeValue}.`));
  return matched ? path.join(baseDir, matched) : null;
}
```

**نکته سازگاری:** `process.cwd()` در سرور هم مسیر پروژه را برمی‌گرداند. فایل‌های موجود در `/app/uploads/contractor-docs` (در Docker) باید به `uploads/contractor-docs` نسبت به `process.cwd()` منتقل شوند یا یک `symlink` ساخته شود. قبل از اعمال روی سرور، بررسی کن که فایل‌های آپلود شده قبلی کجا هستند و آیا مسیر جدید آن‌ها را پیدا می‌کند.

**اقدام قبل از اعمال روی سرور:**
```bash
# بررسی مسیر فعلی فایل‌های آپلود
ls -la /app/uploads/contractor-docs/
# اگر در Docker هست و process.cwd() = /app، پس مسیر جدید همان مسیر قبلی است و مشکلی نیست
```

#### ۳.۲ خلاصه مالی پروژه

**فایل:** `server/api/routers/project.ts`

پروسیجر جدید اضافه کن:

```typescript
  getSummary: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const role = ctx.session.user.role;
      const userId = ctx.session.user.id;

      const project = await ctx.prisma.project.findUnique({
        where: { id: input.id },
        select: { id: true },
      });

      if (!project) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'پروژه یافت نشد' });
      }

      if (role === 'CONTRACTOR') {
        const isMember = await ctx.prisma.projectMember.findUnique({
          where: { projectId_userId: { projectId: input.id, userId } },
        });
        if (!isMember) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'دسترسی ندارید' });
        }
      }

      const [workReports, contractorDocs] = await Promise.all([
        ctx.prisma.workReport.groupBy({
          by: ['approvalStatus'],
          where: { projectId: input.id },
          _sum: { totalAmount: true },
          _count: { _all: true },
        }),
        ctx.prisma.contractorDoc.groupBy({
          by: ['approvalStatus'],
          where: { projectId: input.id },
          _sum: { totalAmount: true },
          _count: { _all: true },
        }),
      ]);

      return { workReports, contractorDocs };
    }),
```

**فایل:** `app/projects/[id]/page.tsx`

در بالای بخش گزارش‌های کار، یک کارت خلاصه اضافه کن:

```tsx
const { data: summary } = trpc.project.getSummary.useQuery(
  { id: projectId },
  { enabled: !!projectId }
);

{summary && (
  <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
    {/* تعداد و مبلغ گزارش‌های تاییدشده */}
    {/* تعداد گزارش‌های در انتظار */}
    {/* تعداد و مبلغ مستندات تاییدشده */}
    {/* تعداد مستندات در انتظار */}
  </div>
)}
```

#### ۳.۳ نمایش دلیل رد در صفحه گزارش کار

**فایل:** `app/projects/[id]/reports/[reportId]/page.tsx`

وقتی `report.approvalStatus === 'REJECTED'` و `report.rejectionReason` وجود دارد، آن را نمایش بده:

```tsx
{report.approvalStatus === 'REJECTED' && report.rejectionReason && (
  <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4">
    <h3 className="mb-1 text-sm font-medium text-red-800">دلیل رد:</h3>
    <p className="text-sm text-red-700">{report.rejectionReason}</p>
  </div>
)}
```

#### ۳.۴ نمایش دلیل رد در صفحه سند پیمانکار

**فایل:** `app/projects/[id]/contractor-docs/[docId]/page.tsx`

وقتی `doc.approvalStatus === 'REJECTED'` و `doc.rejectionReason` وجود دارد، آن را نمایش بده (مثل بالا).

### چک‌لیست فاز ۳

- [x] مسیر آپلود به `process.cwd()` تغییر کرده
- [ ] روی سرور بررسی شده که فایل‌های آپلود قبلی همچنان قابل دسترسی هستند
- [x] `getSummary` به `projectRouter` اضافه شده
- [x] کارت خلاصه مالی در صفحه پروژه نمایش داده می‌شود
- [x] دلیل رد در صفحه گزارش کار نمایش داده می‌شود
- [x] دلیل رد در صفحه سند پیمانکار نمایش داده می‌شود
- [x] تست‌ها اجرا شده: `npx jest --maxWorkers=1` — ۲۶۷ تست پاس شد
- [ ] دستی تست: آپلود فایل در سند پیمانکار → بررسی دسترسی به فایل
- [ ] دستی تست: رد گزارش با دلیل → پیمانکار دلیل را می‌بیند
- [ ] روی سرور: بیلد بدون خطا
- [ ] روی سرور: فایل‌های آپلود قبلی قابل دسترسی هستند

---

## فاز ۴ — ویژگی‌های پیشرفته (P3)

### هدف
گزارش روزانه سریع، فیلتر پیشرفته، PDF مستندات، Audit Log.

### فایل‌های درگیر
- `app/dashboard/contractor/page.tsx`
- `app/my-reports/page.tsx`
- `app/api/contractor-docs/[docId]/pdf/route.ts` (جدید)
- `lib/services/contractor-doc-pdf.ts` (جدید)
- `prisma/schema.prisma`
- `server/api/routers/workReport.ts`
- `server/api/routers/contractorDoc.ts`

### گام‌به‌گام

#### ۴.۱ گزارش روزانه سریع (Quick Report)

**فایل:** `app/dashboard/contractor/page.tsx`

یک مودال «ثبت گزارش سریع» اضافه کن:
- انتخاب پروژه (از پروژه‌های عضو)
- فرم ساده: شرح + واحد + مقدار + تاریخ (پیش‌فرض امروز)
- دکمه ثبت → `trpc.workReport.create.mutate`
- بعد از ثبت، مودال بسته شود و لیست به‌روزرسانی شود

#### ۴.۲ فیلتر پیشرفته «گزارش‌های من»

**فایل:** `app/my-reports/page.tsx`

فیلترهای اضافه:
- بازه تاریخ (از/تا با `JalaliDatePicker`)
- جستجو در شرح آیتم‌ها

**فایل:** `server/api/routers/workReport.ts`

در `listMine`، ورودی `dateFrom` و `dateTo` و `search` را اضافه کن:

```typescript
  listMine: protectedProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(20),
        status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional().nullable(),
        projectId: z.string().uuid().optional().nullable(),
        dateFrom: z.string().optional().nullable(), // جدید
        dateTo: z.string().optional().nullable(),   // جدید
        search: z.string().optional().nullable(),   // جدید
      })
    )
```

و در `where`:
```typescript
      if (input.dateFrom || input.dateTo) {
        where.reportDate = {};
        if (input.dateFrom) where.reportDate.gte = new Date(input.dateFrom);
        if (input.dateTo) where.reportDate.lte = new Date(input.dateTo);
      }
      if (input.search) {
        where.items = { some: { description: { contains: input.search, mode: 'insensitive' } } };
      }
```

#### ۴.۳ خروجی PDF برای مستندات پیمانکار

**فایل جدید:** `lib/services/contractor-doc-pdf.ts`

مشابه `lib/services/work-report-pdf.ts`، یک تابع `generateContractorDocPDF` بساز که:
- اطلاعات سند (شماره، نوع، تاریخ، پروژه، پیمانکار)
- جدول اقلام
- مبلغ کل
- لیست پیوست‌ها (نام فایل)
را در PDF تولید کند.

**فایل جدید:** `app/api/contractor-docs/[docId]/pdf/route.ts`

مشابه `app/api/work-reports/[reportId]/pdf/route.ts`:
- بررسی session
- دریافت سند از دیتابیس
- بررسی دسترسی (پیمانکار فقط سند خودش)
- تولید PDF و برگرداندن

**فایل:** `app/projects/[id]/contractor-docs/[docId]/page.tsx`

دکمه PDF اضافه کن (مثل صفحه گزارش کار):
```tsx
<a
  href={`/api/contractor-docs/${docId}/pdf`}
  target="_blank"
  className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
>
  <Download size={14} />
  PDF
</a>
```

#### ۴.۴ Audit Log (تاریخچه تغییرات)

**فایل:** `prisma/schema.prisma`

مدل جدید اضافه کن:

```prisma
model WorkReportAudit {
  id          String   @id @default(uuid())
  workReportId String
  userId      String
  action      String   // 'CREATED' | 'UPDATED' | 'APPROVED' | 'REJECTED' | 'PRICED'
  changes     String?  // JSON string of changed fields
  createdAt   DateTime @default(now())

  workReport  WorkReport @relation(fields: [workReportId], references: [id], onDelete: Cascade)
  user        User       @relation(fields: [userId], references: [id])

  @@index([workReportId])
  @@map("work_report_audits")
}
```

**نکته سازگاری:** جدول جدید. هیچ جدول موجودی تغییر نمی‌کند.

سپس:
```bash
npx prisma migrate dev --name add_work_report_audit
```

**فایل:** `server/api/routers/workReport.ts`

در هر `mutation` (`create`, `update`, `approve`, `reject`)، یک رکورد `WorkReportAudit` ایجاد کن:

```typescript
await ctx.prisma.workReportAudit.create({
  data: {
    workReportId: created.id,
    userId,
    action: 'CREATED',
  },
});
```

**فایل:** `app/projects/[id]/reports/[reportId]/page.tsx`

بخش «تاریخچه تغییرات» اضافه کن (فقط برای مدیران):
```tsx
{isManager && auditLog && auditLog.length > 0 && (
  <div className="mt-6 rounded-lg border border-gray-200 bg-white p-4">
    <h3 className="mb-3 text-sm font-semibold text-gray-700">تاریخچه تغییرات</h3>
    {/* نمایش timeline تغییرات */}
  </div>
)}
```

برای این کار یک `listAudit` پروسیجر به `workReportRouter` اضافه کن:

```typescript
  listAudit: protectedProcedure
    .input(z.object({ workReportId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const role = ctx.session.user.role;
      if (role !== 'ADMIN' && role !== 'MANAGER') {
        // پیمانکار فقط audit گزارش خودش را ببیند
        const report = await ctx.prisma.workReport.findUnique({
          where: { id: input.workReportId },
          select: { createdById: true },
        });
        if (report?.createdById !== ctx.session.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
      }
      return ctx.prisma.workReportAudit.findMany({
        where: { workReportId: input.workReportId },
        include: { user: { select: { fullName: true } } },
        orderBy: { createdAt: 'desc' },
      });
    }),
```

### چک‌لیست فاز ۴

- [x] مودال «ثبت گزارش سریع» در داشبورد پیمانکار کار می‌کند
- [x] فیلتر بازه تاریخ و جستجو در «گزارش‌های من» کار می‌کند
- [x] `listMine` ورودی‌های `dateFrom`, `dateTo`, `search` را می‌پذیرد
- [x] `generateContractorDocPDF` ساخته شده
- [x] مسیر `/api/contractor-docs/[docId]/pdf` کار می‌کند
- [x] دکمه PDF در صفحه سند پیمانکار اضافه شده
- [x] مدل `WorkReportAudit` اضافه شده و `migrate` اجرا شده
- [x] در `create`, `update`, `approve`, `reject` رکورد audit ثبت می‌شود
- [x] `listAudit` پروسیجر اضافه شده
- [x] بخش تاریخچه تغییرات در صفحه گزارش کار نمایش داده می‌شود
- [x] تست‌ها اجرا شده: `npx jest --maxWorkers=1` — ۲۶۷ تست پاس شد
- [ ] دستی تست: ثبت گزارش سریع از داشبورد پیمانکار
- [ ] دستی تست: تولید PDF سند پیمانکار
- [ ] دستی تست: بررسی تاریخچه تغییرات بعد از ویرایش/تایید
- [ ] روی سرور: `npx prisma migrate deploy` اجرا شده
- [ ] روی سرور: بیلد بدون خطا
- [ ] روی سرور: لاگ خطا بررسی شده

---

## چک‌لیست استقرار روی سرور (برای هر فاز)

سرور: Docker-based روی `192.168.85.11` — کانتینر `invoice_web` با image `new_invoice-web`

قبل از اعمال هر فاز روی سرور:

1. [ ] در محیط توسعه تمام چک‌لیست فاز تکمیل شده
2. [ ] `npx vitest run` بدون خطا اجرا شده
3. [ ] `npm run build` بدون خطا اجرا شده
4. [ ] تغییرات در `git commit` و `git push` شده
5. [ ] روی سرور: `cd /home/moein/new_invoice && git pull` انجام شده
6. [ ] روی سرور: Docker image جدید build شده: `docker build -t new_invoice-web:v<version>-<phase> .`
7. [ ] روی سرور: `docker-compose.yml` آپدیت شده (image جدید) یا `docker compose up -d` اجرا شده
8. [ ] روی سرور: مهاجرت دیتابیس به‌صورت خودکار توسط `docker-entrypoint.sh` اجرا شده (در ری‌استارت)
9. [ ] روی سرور: لاگ کانتینر بررسی شده: `docker logs invoice_web --tail 50`
10. [ ] روی سرور: تست دستی حداقل یک سناریوی کلیدی
11. [ ] روی سرور: بررسی دسترسی به فایل‌های آپلود قبلی (اگر فاز ۳ شامل می‌شود)
12. [ ] روی سرور: بررسی سلامت کانتینر: `docker ps` و وضعیت `healthy`

### دستورات سریع استقرار

```bash
# روی سرور (SSH: moein@192.168.85.11)
cd /home/moein/new_invoice
git pull

# build image جدید (شماره نسخه را متناسب با فاز تغییر دهید)
docker build -t new_invoice-web:v40-phase1 .

# آپدیت docker-compose.yml با image جدید (در صورت نیاز)
# سپس:
docker compose up -d

# بررسی لاگ
docker logs invoice_web --tail 50

# بررسی وضعیت
docker ps
```

---

## خلاصه فازها

| فاز | عنوان | تعداد گام | تغییر دیتابیس | فایل جدید | سطح ریسک |
|-----|-------|-----------|---------------|-----------|----------|
| ۱ | رفع باگ‌های حیاتی | ۶ | ۱ مهاجرت | ۰ | پایین |
| ۲ | داشبورد پیمانکار و ناوبری | ۹ | ۰ | ۳ | متوسط |
| ۳ | بهبودهای متوسط | ۴ | ۰ | ۰ | متوسط |
| ۴ | ویژگی‌های پیشرفته | ۴ | ۱ مهاجرت | ۳ | متوسط-بالا |
| ۵ | تست‌های خودکار | ۴ فایل تست | ۰ | ۴ | پایین |
