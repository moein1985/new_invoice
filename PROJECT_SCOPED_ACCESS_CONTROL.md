# ریفکتورینگ سیستم دسترسی مبتنی بر پروژه + نقش فنی (Technical)

## خلاصه

تغییر سیستم دسترسی از **Global Roles** (نقش‌های سراسری) به **Project-Scoped Access Control** (دسترسی مبتنی بر پروژه). در سیستم جدید، MANAGER پروژه‌ها را ایجاد کرده و کاربران با نقش‌های مختلف (ADMIN، USER، CONTRACTOR، EMPLOYER، TECHNICAL) را به پروژه‌ها اختصاص می‌دهد. هر کاربر فقط داده‌های مربوط به پروژه‌های خودش را می‌بیند. همچنین نقش جدید TECHNICAL (فنی مهندسی) اضافه می‌شود.

---

## نقش‌ها و دسترسی‌ها

### نقش‌های سراسری (Global)

| نقش | توضیح | محدودیت پروژه |
|------|-------|---------------|
| **MANAGER** | مسئول سیستم — ایجاد پروژه، اختصاص کاربران، مدیریت کامل | ❌ بدون محدودیت — همه پروژه‌ها را می‌بیند |
| **ADMIN** (اکانت admin) | سوپرمدیر سیستمی — دسترسی کامل حفظ می‌شود | ❌ بدون محدودیت (superuser override) |

### نقش‌های مبتنی بر پروژه (Project-Scoped)

| نقش | توضیح | محدودیت پروژه |
|------|-------|---------------|
| **ADMIN** (سرپرست پروژه) | سرپرست پروژه — مدیریت داده‌های پروژه‌های خودش | ✅ فقط پروژه‌های اختصاص‌یافته |
| **USER** | کاربر عادی پروژه | ✅ فقط پروژه‌های اختصاص‌یافته |
| **CONTRACTOR** | پیمانکار پروژه | ✅ فقط پروژه‌های اختصاص‌یافته (الان هم هست) |
| **EMPLOYER** | کارفرما پروژه | ✅ فقط پروژه‌های اختصاص‌یافته (الان هم هست) |
| **TECHNICAL** | فنی مهندسی — مشابه پیمانکار ولی با نقش مجزا | ✅ فقط پروژه‌های اختصاص‌یافته |

> **نکته مهم:** نقش کاربر **سراسری** است — یک کاربر با نقش ADMIN در همه پروژه‌های اختصاص‌یافته‌اش سرپرست است. یک کاربر نمی‌تواند در یک پروژه ADMIN و در پروژه دیگر USER باشد.

### ماتریس دسترسی

| عملیات | MANAGER | ADMIN (superuser) | ADMIN (project) | USER | CONTRACTOR | EMPLOYER | TECHNICAL |
|--------|---------|-------------------|-----------------|------|-----------|----------|-----------|
| ایجاد پروژه | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| اختصاص کاربر به پروژه | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| مشاهده همه پروژه‌ها | ✅ | ✅ | ❌ (فقط خودش) | ❌ (فقط خودش) | ❌ (فقط خودش) | ❌ (فقط خودش) | ❌ (فقط خودش) |
| تایید گزارش کار | ✅ | ✅ | ✅ (پروژه خودش) | ❌ | ❌ | ❌ | ❌ |
| تایید اسناد | ✅ | ✅ | ✅ (پروژه خودش) | ❌ | ❌ | ❌ | ❌ |
| ثبت گزارش کار | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| ثبت سند پیمانکار | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| ثبت تیکت | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| مدیریت کاربران | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| تنظیمات سیستم | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## مدل داده (Prisma)

### تغییرات Enum

```prisma
enum UserRole {
  ADMIN
  MANAGER
  USER
  CONTRACTOR
  EMPLOYER
  TECHNICAL    // نقش جدید: فنی مهندسی
}
```

### تغییرات مدل Project

```prisma
model Project {
  // ... فیلدهای موجود
  employerUserId String?    // حفظ می‌شود (ارتباط با کارفرما)
  employerUser   User?      @relation("ProjectEmployer", fields: [employerUserId], references: [id])
  technicalUserIds String[] // اختیاری: اگر بعداً نیاز به ارتباط مستقیم شد
}
```

> **نکته:** جدول `ProjectMember` فعلی برای اختصاص همه نقش‌ها (ADMIN، USER، CONTRACTOR، TECHNICAL) به پروژه استفاده می‌شود. EMPLOYER از طریق `employerUserId` اختصاص می‌یابد (رابطه 1:1).

### جدول ProjectMember (موجود — بدون تغییر ساختاری)

```prisma
model ProjectMember {
  id        String   @id @default(uuid())
  projectId String
  userId    String
  createdAt DateTime @default(now())

  project   Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([projectId, userId])
  @@map("project_members")
}
```

> این جدول رابطه Many-to-Many بین کاربران و پروژه‌ها را برقرار می‌کند. یک ADMIN می‌تواند عضو چندین پروژه باشد و یک پروژه می‌تواند چندین ADMIN داشته باشد.

---

## تغییرات زیرساختی (هسته)

### ۱. تابع کمکی `getUserProjectIds`

یک تابع کمکی در `server/api/trpc.ts` که لیست ID پروژه‌های یک کاربر را برمی‌گرداند:

```typescript
async function getUserProjectIds(prisma: PrismaClient, userId: string, role: string): Promise<string[] | null> {
  // MANAGER و اکانت admin سوپرمدیر — همه پروژه‌ها
  if (role === 'MANAGER') return null; // null = بدون فیلتر
  if (role === 'ADMIN' && userId === SUPERUSER_ID) return null;

  // EMPLOYER: پروژه‌هایی که employerUserId آن‌هاست
  if (role === 'EMPLOYER') {
    const projects = await prisma.project.findMany({
      where: { employerUserId: userId },
      select: { id: true },
    });
    return projects.map(p => p.id);
  }

  // سایر نقش‌ها (ADMIN, USER, CONTRACTOR, TECHNICAL): از طریق ProjectMember
  const memberships = await prisma.projectMember.findMany({
    where: { userId },
    select: { projectId: true },
  });
  return memberships.map(m => m.projectId);
}
```

> **مهم:** `null` به معنای "بدون فیلتر" است (MANAGER و superuser). آرایه خالی به معنای "هیچ پروژه‌ای" است.

### ۲. تغییر `adminProcedure` و `managerProcedure`

```typescript
// MANAGER: فقط نقش MANAGER (و superuser admin)
export const managerProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const isSuperuser = ctx.session.user.username === 'admin';
  if (ctx.session.user.role !== 'MANAGER' && !isSuperuser) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'فقط مدیران به این بخش دسترسی دارند' });
  }
  return next({ ctx });
});

// ADMIN: نقش ADMIN یا MANAGER یا superuser (برای صفحات مدیریتی)
// → حذف adminProcedure و جایگزینی با managerProcedure در اکثر جاها
```

### ۳. پروسیجر جدید `projectScopedProcedure`

برای عملیات‌هایی که نیاز به بررسی دسترسی به پروژه خاص دارند:

```typescript
export const projectScopedProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  // همه نقش‌ها به جز MANAGER و superuser نیاز به بررسی پروژه دارند
  return next({
    ctx: {
      ...ctx,
      // تابع کمکی برای فیلتر کردن بر اساس پروژه
      getProjectFilter: async () => {
        return getUserProjectIds(ctx.prisma, ctx.session.user.id, ctx.session.user.role);
      },
    },
  });
});
```

---

## تغییرات tRPC Routers

### `project.ts`

| Procedure | تغییر |
|-----------|-------|
| `list` | فیلتر بر اساس `getUserProjectIds` — ADMIN/USER/CONTRACTOR/TECHNICAL فقط پروژه‌های خودش |
| `getById` | بررسی عضویت در پروژه (ProjectMember یا employerUserId) |
| `create` | فقط `managerProcedure` (تغییر از admin+manager به فقط manager) |
| `update` | `managerProcedure` |
| `addMember` | `managerProcedure` — اضافه شدن `listTechnical` |
| `removeMember` | `managerProcedure` |
| `listContractors` | `managerProcedure` — حفظ می‌شود |
| `listEmployers` | `managerProcedure` — حفظ می‌شود |
| `listTechnical` | `managerProcedure` — **جدید**: لیست کاربران با نقش TECHNICAL |
| `listUsers` | `managerProcedure` — **جدید**: لیست کاربران با نقش USER |
| `listAdmins` | `managerProcedure` — **جدید**: لیست کاربران با نقش ADMIN (سرپرست) |
| `getSummary` | فیلتر بر اساس `getUserProjectIds` |

### `workReport.ts`

| Procedure | تغییر |
|-----------|-------|
| `list` | فیلتر `projectId IN (userProjectIds)` به جای `createdById = userId` |
| `getById` | بررسی عضویت در پروژه (به جای فقط CONTRACTOR) |
| `create` | بررسی عضویت در پروژه برای همه نقش‌ها (به جز MANAGER) |
| `update` | ADMIN (project) می‌تواند ویرایش کند / CONTRACTOR فقط خودش |
| `delete` | ADMIN (project) می‌تواند حذف کند / CONTRACTOR فقط خودش |
| `approve` | ADMIN (project) و MANAGER می‌توانند تایید کنند |
| `pendingCount` | فیلتر بر اساس پروژه‌های کاربر |
| `getItems` | بررسی دسترسی به پروژه |

### `contractorDoc.ts`

| Procedure | تغییر |
|-----------|-------|
| `list` | فیلتر `projectId IN (userProjectIds)` |
| `getById` | بررسی عضویت در پروژه |
| `create` | بررسی عضویت در پروژه برای همه نقش‌ها |
| `update` | ADMIN (project) و MANAGER می‌توانند ویرایش کنند |
| `delete` | ADMIN (project) و MANAGER می‌توانند حذف کنند |
| `approve` | ADMIN (project) و MANAGER |
| `pendingCount` | فیلتر بر اساس پروژه‌های کاربر |
| `assertProjectAccess` | تغییر به بررسی همه نقش‌ها (نه فقط CONTRACTOR) |

### `document.ts`

> **⚠️ نکته مهم:** مدل `Document` فعلی **`projectId` ندارد** — فقط فیلد متنی `projectName` دارد. اسناد به پروژه‌ها متصل نیستند.
>
> **تصمیم لازم:** آیا باید `projectId` به `Document` اضافه شود؟ یا اسناد سراسری بمانند؟ (به نظر می‌رسد اسناد باید سراسری بمانند چون به مشتری متصل هستند نه پروژه)

| Procedure | تغییر |
|-----------|-------|
| `list` | اگر `projectId` اضافه شد → فیلتر بر اساس پروژه‌های کاربر. در غیر این صورت → بدون تغییر (سراسری) |
| `pendingApprovals` | اگر `projectId` اضافه شد → فیلتر. در غیر این صورت → فقط MANAGER + superuser |
| `staleDocuments` | اگر `projectId` اضافه شد → فیلتر. در غیر این صورت → فقط MANAGER + superuser |

### `ticket.ts`

| Procedure | تغییر |
|-----------|-------|
| `list` | EMPLOYER: پروژه‌های خودش / ADMIN (project): پروژه‌های خودش / MANAGER: همه |
| `getById` | بررسی دسترسی برای ADMIN (project) هم |
| `create` | EMPLOYER و ADMIN (project) می‌توانند تیکت ثبت کنند |
| `addReply` | بررسی دسترسی برای همه نقش‌ها |
| `updateStatus` | ADMIN (project) و MANAGER |
| `close` | EMPLOYER و ADMIN (project) و MANAGER |
| `delete` | MANAGER فقط |
| `stats` | فیلتر بر اساس پروژه‌های کاربر |

### `purchase.ts`

| Procedure | تغییر |
|-----------|-------|
| `list` | فیلتر بر اساس پروژه‌های کاربر |
| `getById` | بررسی دسترسی به پروژه |
| `create` | بررسی عضویت در پروژه |
| `pendingCount` | فیلتر بر اساس پروژه‌های کاربر |

### `stats.ts`

> **⚠️ نکته مهم:** آمار فعلی شامل کل مشتریان، کل اسناد، و درآمد ماهانه است — هیچ‌کدام به پروژه متصل نیستند.
>
> **تصمیم لازم:** آمار داشبورد برای ADMIN (project-scoped) باید چه نشان داده شود؟
> - گزینه ۱: آمار فقط پروژه‌های خودش (نیاز به query بر اساس ProjectMember)
> - گزینه ۲: همان آمار سراسری (بدون فیلتر)

| Procedure | تغییر |
|-----------|-------|
| `getDashboardStats` | برای ADMIN (project): آمار فقط پروژه‌های خودش (تعداد گزارش‌ها، اسناد پیمانکار، درخواست‌های خرید) |
| `getTopCustomers` | **بدون تغییر** (سراسری) |

### `calendar.ts`

> **⚠️ نکته مهم:** `CalendarEvent` فعلی **`projectId` ندارد** — فقط `userId` دارد. رویدادهای تقویم شخصی هستند، نه پروژه‌ای.
>
> **تصمیم:** تقویم باید **بدون تغییر** بماند (شخصی برای هر کاربر). نیازی به فیلتر پروژه نیست.

| Procedure | تغییر |
|-----------|-------|
| `list` | **بدون تغییر** — رویدادها شخصی هستند (فیلتر با `userId`) |
| `create` | **بدون تغییر** |
| `update` | **بدون تغییر** |
| `delete` | **بدون تغییر** |

### `user.ts`

| Procedure | تغییر |
|-----------|-------|
| `create` | افزودن `TECHNICAL` به enum |
| `update` | افزودن `TECHNICAL` به enum |
| `list` | فقط `managerProcedure` (به جای adminProcedure) |

### `search.ts`

> **⚠️ نکته مهم:** جستجوی سراسری شامل مشتریان، اسناد، آیتم‌های سند، و کاربران است. هیچ‌کدام `projectId` ندارند.
>
> **تصمیم لازم:** آیا جستجو باید بر اساس پروژه فیلتر شود؟ یا سراسری بماند؟
>
> - مشتریان و تامین‌کنندگان: سراسری هستند (متعلق به پروژه نیستند)
> - اسناد: `projectId` ندارند
> - کاربران: فقط MANAGER باید بتواند جستجو کند

| Procedure | تغییر |
|-----------|-------|
| `globalSearch` | **بدون تغییر** (یا محدود کردن جستجوی کاربران به MANAGER فقط) |

---

## صفحات

### صفحات جدید برای TECHNICAL

| مسیر | عنوان | توضیح |
|------|-------|-------|
| `/dashboard/technical` | داشبورد فنی | خلاصه گزارش‌ها و اسناد فنی |
| `/my-reports` | گزارش‌های من | مشابه پیمانکار — گزارش‌های کار خودش |
| `/my-docs` | مستندات من | مشابه پیمانکار — اسناد خودش |
| `/calendar` | تقویم | تقویم مشترک |
| `/projects` | پروژه‌ها | فقط پروژه‌های اختصاص‌یافته |

### تغییرات صفحه پروژه (`/projects/[id]`)

- بخش **اختصاص کاربران** به ۵ بخش تقسیم شود:
  1. **سرپرست‌ها (ADMIN)** — افزودن/حذف سرپرست پروژه
  2. **کاربران (USER)** — افزودن/حذف کاربر عادی
  3. **پیمانکاران (CONTRACTOR)** — موجود
  4. **فنی مهندسی (TECHNICAL)** — جدید
  5. **کارفرما (EMPLOYER)** — موجود (از طریق employerUserId)

- فقط **MANAGER** می‌تواند کاربران را به پروژه اختصاص دهد
- **ADMIN (project)** می‌تواند بخش‌های پروژه را ببیند ولی نمی‌تواند کاربر اختصاص دهد

### تغییرات صفحه کاربران (`/users`)

- فقط **MANAGER** (و superuser admin) دسترسی دارد
- افزودن گزینه **فنی مهندسی (TECHNICAL)** به dropdown نقش

### تغییرات داشبورد

| نقش | داشبورد |
|------|---------|
| MANAGER / superuser | `/dashboard` — آمار کامل همه پروژه‌ها |
| ADMIN (project) | `/dashboard` — آمار فقط پروژه‌های خودش |
| USER | `/dashboard` — آمار فقط پروژه‌های خودش |
| CONTRACTOR | `/dashboard/contractor` — موجود |
| EMPLOYER | `/dashboard/employer` — موجود |
| TECHNICAL | `/dashboard/technical` — **جدید** |

---

## منوی سایدبار

### نقش MANAGER (بدون تغییر عمده)
- داشبورد، تقویم، مخاطبین
- مدیریت اسناد (اسناد، تاییدیه‌ها، اسناد بلاتکلیف)
- افراد و پروژه‌ها (مشتریان، تامین‌کنندگان، پروژه‌ها، گزارش کار، مستندات پیمانکار)
- سامانه خرید
- کارفرمایان (مدیریت تیکت‌ها)
- تنظیمات و سیستم (کاربران، تنظیمات SIP، بکاپ)

### نقش ADMIN (project-scoped) — **تغییر عمده**
- داشبورد (آمار پروژه‌های خودش)
- تقویم
- پروژه‌ها (فقط پروژه‌های خودش)
- گزارش کار (با badge تاییدیه‌های در انتظار — فقط پروژه‌های خودش)
- مستندات پیمانکار (با badge — فقط پروژه‌های خودش)
- اسناد (فقط پروژه‌های خودش)
- تاییدیه‌ها (فقط پروژه‌های خودش)
- درخواست‌های خرید (فقط پروژه‌های خودش)
- ❌ کاربران، تنظیمات سیستم، بکاپ — **حذف**

### نقش USER — **جدید**
- داشبورد
- تقویم
- پروژه‌ها (فقط پروژه‌های خودش)
- گزارش کار (ثبت و مشاهده)
- مستندات (ثبت و مشاهده)

### نقش TECHNICAL — **جدید**
- داشبورد فنی (`/dashboard/technical`)
- پروژه‌ها (فقط پروژه‌های خودش)
- گزارش‌های من (`/my-reports`)
- مستندات من (`/my-docs`)
- تقویم

### نقش CONTRACTOR (بدون تغییر)
- داشبورد پیمانکار
- پروژه‌ها
- گزارش‌های من
- مستندات من
- تقویم

### نقش EMPLOYER (بدون تغییر)
- داشبورد کارفرما
- تقویم
- تیکت‌ها

---

## فازبندی پیاده‌سازی

### فاز ۱: زیرساخت و مدل داده
- [ ] افزودن `TECHNICAL` به enum `UserRole` در `schema.prisma`
- [ ] Migration دیتابیس
- [ ] ایجاد تابع `getUserProjectIds` در `trpc.ts`
- [ ] تغییر `managerProcedure` (فقط MANAGER + superuser)
- [ ] ایجاد `projectAdminProcedure` (ADMIN project-scoped + MANAGER + superuser)
- [ ] به‌روزرسانی `user.ts` router (افزودن TECHNICAL، تغییر دسترسی به managerProcedure)

### فاز ۲: تغییرات tRPC Routers (Access Control)
- [ ] `project.ts` — فیلتر `list`، `getById`، `getSummary` + `listTechnical`، `listUsers`، `listAdmins`
- [ ] `workReport.ts` — فیلتر همه query‌ها بر اساس پروژه + دسترسی تایید برای ADMIN (project)
- [ ] `contractorDoc.ts` — فیلتر همه query‌ها + تغییر `assertProjectAccess` برای همه نقش‌ها
- [ ] `document.ts` — فیلتر بر اساس پروژه
- [ ] `ticket.ts` — فیلتر برای ADMIN (project)
- [ ] `purchase.ts` — فیلتر بر اساس پروژه
- [ ] `stats.ts` — فیلتر آمار
- [ ] `calendar.ts` — فیلتر رویدادها
- [ ] `search.ts` — فیلتر نتایج

### فاز ۳: رابط کاربری — سایدبار و صفحات
- [ ] به‌روزرسانی `sidebar.tsx` — منوی ADMIN (project-scoped)، USER، TECHNICAL
- [ ] صفحه `/dashboard/technical` — داشبورد فنی
- [ ] به‌روزرسانی `/users` — افزودن TECHNICAL، تغییر دسترسی به MANAGER
- [ ] به‌روزرسانی `/projects/[id]` — بخش اختصاص سرپرست، کاربر، فنی
- [ ] به‌روزرسانی `/dashboard` — فیلتر آمار برای ADMIN (project)

### فاز ۴: رابط کاربری — فیلتر صفحات موجود
- [ ] `/work-reports` — فیلتر بر اساس پروژه‌های کاربر
- [ ] `/contractor-docs` — فیلتر بر اساس پروژه‌های کاربر
- [ ] `/documents` — فیلتر بر اساس پروژه‌های کاربر
- [ ] `/approvals` — فیلتر بر اساس پروژه‌های کاربر
- [ ] `/purchases` — فیلتر بر اساس پروژه‌های کاربر
- [ ] `/stale-documents` — فیلتر بر اساس پروژه‌های کاربر
- [ ] `/calendar` — فیلتر بر اساس پروژه‌های کاربر

### فاز ۵: تست و دیپلوی
- [ ] تست دسترسی هر نقش
- [ ] تست data isolation بین پروژه‌ها
- [ ] Build و deploy به سرور `192.168.85.114:3001`

---

## نکات مهم

1. **اکانت admin (superuser):** اکانت `admin` با username `admin` همیشه دسترسی کامل دارد — بدون فیلتر پروژه. این با `MANAGER` تفاوت دارد: MANAGER هم دسترسی کامل دارد ولی نمی‌تواند نقش‌های مدیریتی را تغییر دهد (فقط superuser می‌تواند).

2. **نقش ADMIN سراسری است:** یک کاربر با نقش ADMIN در همه پروژه‌های عضو شده‌اش سرپرست است. نقش در ProjectMember ذخیره نمی‌شود — نقش از `User.role` خوانده می‌شود.

3. **EMPLOYER و ProjectMember:** EMPLOYER از طریق `employerUserId` به پروژه متصل می‌شود (رابطه 1:1). سایر نقش‌ها از طریق `ProjectMember` (Many-to-Many).

4. **TECHNICAL مشابه CONTRACTOR:** از نظر دسترسی به داده‌ها، TECHNICAL دقیقاً مثل CONTRACTOR رفتار می‌کند — فقط صفحات و منوی متفاوت دارد.

5. **تغییر `adminProcedure`:** بسیاری از صفحاتی که قبلاً `adminProcedure` بودند باید به `managerProcedure` تغییر کنند (چون ADMIN دیگر سوپرمدیر نیست، بلکه سرپرست پروژه است).

6. **Data Isolation در همه سطوح:** نه فقط در query‌های tRPC، بلکه در صفحات Next.js هم باید بررسی شود که کاربر به داده‌های پروژه‌ای که عضو نیست دسترسی نداشته باشد.

7. **الگوی `isManager` در فرانت‌اند:** در حال حاضر بسیاری از صفحات از `const isManager = role === 'ADMIN' || role === 'MANAGER'` استفاده می‌کنند. بعد از ریفکتورینگ، ADMIN (project-scoped) هم باید به این صفحات دسترسی داشته باشد (مثل `/work-reports`، `/contractor-docs`) ولی با داده‌های فیلتر شده. این الگو باید به `const canManage = role === 'MANAGER' || role === 'ADMIN' || isSuperuser` تغییر کند یا منطق دیگری استفاده شود.

8. **مدل `Document` و `projectId`:** مدل `Document` فعلی فیلد `projectId` ندارد — فقط `projectName` (متنی). اگر اسناد باید بر اساس پروژه فیلتر شوند، باید `projectId` به schema اضافه شود. در غیر این صورت، اسناد سراسری می‌مانند.

9. **تقویم شخصی است:** `CalendarEvent` فقط `userId` دارد و `projectId` ندارد. تقویم باید بدون تغییر بماند (شخصی برای هر کاربر).

10. **مشتریان و تامین‌کنندگان سراسری هستند:** مدل‌های `Customer` و `Supplier` به پروژه متصل نیستند. باید سراسری بمانند.

11. **مدیریت کاربران — privilege escalation:** اگر MANAGER بتواند کاربر با نقش MANAGER ایجاد کند، این مشکل امنیتی دارد. پیشنهاد: MANAGER فقط بتواند کاربر با نقش‌های ADMIN، USER، CONTRACTOR، TECHNICAL، EMPLOYER ایجاد کند. ایجاد MANAGER فقط توسط superuser (`username === 'admin'`).

12. **مهاجرت داده:** کاربران ADMIN فعلی (به جز superuser) بعد از ریفکتورینگ به سرپرست پروژه تبدیل می‌شوند. باید بررسی شود که آیا کاربران ADMIN فعلی به پروژه‌ای اختصاص داده شده‌اند یا خیر. اگر نه، بعد از ریفکتورینگ هیچ پروژه‌ای نمی‌بینند.
