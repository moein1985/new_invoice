# نقشه راه توسعه — سامانه خرید و درخواست‌های خرید

## اصول کلی

- **سازگاری با نسخه قبلی:** تمام تغییرات دیتابیس باید `additive` باشند (فیلد جدید با مقدار پیش‌فرض، بدون حذف/تغییر نام فیلدهای موجود).
- **مهاجرت دیتابیس:** قبل از هر `prisma migrate`، حتماً `npx prisma migrate dev --name <name>` در محیط توسعه اجرا شود. در سرور، `docker-entrypoint.sh` به‌صورت خودکار `prisma migrate deploy` را در هر ری‌استارت اجرا می‌کند.
- **فایل‌های سرور:** هیچ فایل آپلودی روی سرور حذف یا جابجا نمی‌شود. مسیرهای جدید فقط به فایل‌های جدید اشاره می‌کنند.
- **API:** تمام تغییرات `tRPC` باید `backward compatible` باشند — فیلدهای جدید `optional` باشند، فیلدهای موجود حذف یا تغییر نام داده نشوند.
- **نقش‌ها:** سه نقش فعال در سیستم: `ADMIN` (سرپرست)، `MANAGER` (مدیر میانی — دسترسی‌های مشابه ADMIN)، `CONTRACTOR` (پیمانکار — کاملاً جدا از سامانه خرید). `USER` نقش کاربر عادی است که می‌تواند مسئول استعلام باشد.
- **دسترسی‌های خرید:**
  - ایجاد درخواست خرید: فقط `ADMIN` و `MANAGER`
  - اختصاص مسئول استعلام: فقط `ADMIN` و `MANAGER` به نقش `USER`
  - ثبت استعلام: کاربر مسئول (`USER`) و `ADMIN`/`MANAGER`
  - تایید/رد درخواست: فقط `ADMIN` و `MANAGER`
  - علامت‌گذاری خریداری‌شده: فقط `ADMIN` و `MANAGER`
- **تست:** قبل از شروع هر فاز، تست‌های موجود را اجرا کنید: `npx vitest run`. بعد از تغییرات دوباره اجرا کنید.
- **هر فاز مستقل است:** اگر فاز ۱ کامل شد و روی سرور اعمال شد، فاز ۲ می‌تواند جداگانه اعمال شود. هیچ فازی به فاز بعدی وابسته نیست.
- **قبل از هر تغییر:** `git checkout -b purchase-phase-<number>` بزنید تا روی شاخه جداگانه کار کنید.

### معماری سرور

- **محیط:** Docker-based روی `192.168.85.11`
- **کانتینرها:** `invoice_web` (Next.js), `invoice_postgres` (PostgreSQL), `invoice_nginx` (Nginx)
- **مسیر کانتینر:** `process.cwd()` = `/app`
- **Volume آپلود:** `/home/moein/new_invoice/uploads` → `/app/uploads` (در حال حاضر خالی)
- **مهاجرت خودکار:** `docker-entrypoint.sh` در هر ری‌استارت `prisma migrate deploy` اجرا می‌کند
- **استقرار:** با build کردن Docker image جدید و `docker compose up -d`

### وضعیت فعلی

سامانه خرید شامل این مدل‌هاست:
- `PurchaseRequest` — درخواست خرید با وضعیت‌های `DRAFT`, `PENDING_INQUIRY`, `INQUIRED`, `APPROVED`, `REJECTED`, `PURCHASED`
- `PurchaseItem` — اقلام هر درخواست (نام محصول، تعداد، واحد، قیمت تخمینی)
- `PurchaseInquiry` — استعلام قیمت از تامین‌کننده (قیمت کل، روش پرداخت، مهلت)
- `InquiryItem` — اقلام هر استعلام (قیمت واحد، قیمت کل، موجودی، زمان تحویل)
- `InquiryAttachment` — پیوست‌های استعلام (تصویر، پروفرما، سایر)
- `Supplier` — مدیریت تامین‌کنندگان

صفحات فعلی:
- `/purchases` — لیست درخواست‌های خرید با فیلتر وضعیت/اولویت/جستجو
- `/purchases/new` — ایجاد درخواست خرید با اقلام و پیام صوتی
- `/purchases/[id]` — جزئیات درخواست + لیست استعلام‌ها + تایید/رد/خریداری‌شد
- `/purchases/[id]/edit` — ویرایش درخواست
- `/purchases/[id]/inquiry/new` — ثبت استعلام جدید با پیوست

---

## فاز ۱ — رفع باگ‌های حیاتی (P0)

### هدف
رفع دو باگ که مانع کارکرد صحیح پیوست‌های استعلام و آپلود صوتی هستند.

### فایل‌های درگیر
- `server/api/routers/purchase.ts`
- `app/purchases/[id]/inquiry/new/page.tsx`
- `app/purchases/new/page.tsx`
- `app/api/upload/purchase/route.ts`

### گام‌به‌گام

#### ۱.۱ رفع باگ ذخیره نشدن پیوست‌های استعلام

**مشکل:** در صفحه `/purchases/[id]/inquiry/new`، فایل‌ها با `fetch('/api/upload/purchase')` آپلود می‌شوند و در `state` ذخیره می‌شوند، ولی در `addInquiryMutation.mutate()` هیچ ورودی `attachments` ارسال نمی‌شود. در `onSuccess` کامنت گذاشته شده «we just need to link them» ولی هیچ کاری انجام نمی‌شود. در نتیجه فایل‌ها آپلود می‌شوند ولی هیچ رکورد `InquiryAttachment` در دیتابیس ساخته نمی‌شود.

**فایل:** `server/api/routers/purchase.ts`

در پروسیجر `addInquiry`، ورودی `attachments` را به schema اضافه کن:

```typescript
  addInquiry: protectedProcedure
    .input(
      z.object({
        purchaseRequestId: z.string().uuid(),
        supplierName: z.string().min(1),
        supplierPhone: z.string().optional().nullable(),
        supplierAddress: z.string().optional().nullable(),
        supplierId: z.string().uuid().optional().nullable(),
        paymentMethod: z.string().optional().nullable(),
        paymentDays: z.number().int().optional().nullable(),
        notes: z.string().optional().nullable(),
        items: z.array(
          z.object({
            purchaseItemId: z.string().uuid(),
            unitPrice: z.number().min(0),
            totalPrice: z.number().min(0),
            availability: z.enum(['AVAILABLE', 'UNAVAILABLE', 'PARTIAL']),
            deliveryDays: z.number().int().optional().nullable(),
            notes: z.string().optional().nullable(),
          })
        ).min(1),
        // جدید: پیوست‌های استعلام
        attachments: z.array(
          z.object({
            fileName: z.string(),
            filePath: z.string(),
            fileType: z.string(),
            fileSize: z.number(),
            type: z.enum(['IMAGE', 'PROFORMA', 'OTHER']),
          })
        ).optional().default([]),
      })
    )
```

و در `data` بخش `create` بعد از `items`:

```typescript
        items: {
          create: input.items.map((item) => ({
            purchaseItemId: item.purchaseItemId,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
            availability: item.availability,
            deliveryDays: item.deliveryDays,
            notes: item.notes,
          })),
        },
        // جدید: ذخیره پیوست‌ها
        attachments: input.attachments.length > 0 ? {
          create: input.attachments.map((att) => ({
            fileName: att.fileName,
            filePath: att.filePath,
            fileType: att.fileType,
            fileSize: att.fileSize,
            type: att.type,
          })),
        } : undefined,
```

**فایل:** `app/purchases/[id]/inquiry/new/page.tsx`

در `addInquiryMutation.mutate()`، `attachments` را اضافه کن:

```typescript
    addInquiryMutation.mutate({
      purchaseRequestId: id,
      supplierName: supplierName.trim(),
      supplierPhone: supplierPhone || undefined,
      supplierAddress: supplierAddress || undefined,
      paymentMethod: finalPayment || undefined,
      paymentDays: paymentDays,
      notes: notes || undefined,
      items: validItems.map((i) => ({
        purchaseItemId: i.purchaseItemId,
        unitPrice: i.unitPrice,
        totalPrice: i.totalPrice,
        availability: i.availability,
        deliveryDays: i.deliveryDays,
        notes: i.notes || undefined,
      })),
      // جدید: ارسال پیوست‌ها
      attachments: attachments.map((a) => ({
        fileName: a.fileName,
        filePath: a.filePath,
        fileType: a.fileType,
        fileSize: a.fileSize,
        type: a.type,
      })),
    });
```

و کامنت‌های `onSuccess` را پاک کن:

```typescript
  const addInquiryMutation = trpc.purchase.addInquiry.useMutation({
    onSuccess: async () => {
      toast.success('استعلام با موفقیت ثبت شد');
      router.push(`/purchases/${id}`);
    },
    onError: (err) => toast.error(err.message),
  });
```

#### ۱.۲ رفع باگ مسیر فایل صوتی

**مشکل:** در صفحه `/purchases/[id]` خط ۲۸۱، مسیر فایل صوتی به این شکل ساخته می‌شود:

```typescript
src={`/api/uploads/purchases${request.voiceNote.replace('/uploads/purchases', '')}`}
```

این مسیر به `/api/uploads/purchases/voice/xxx.webm` تبدیل می‌شود، ولی هیچ route handler‌ای برای `/api/uploads/purchases/[...path]` وجود ندارد. فایل‌ها در `uploads/purchases/voice/` ذخیره می‌شوند ولی از طریق API قابل دسترسی نیستند.

**فایل جدید:** `app/api/uploads/purchases/[...path]/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options';
import { readFile } from 'fs/promises';
import path from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { path: pathParts } = await params;
  const filePath = path.join(process.cwd(), 'uploads', 'purchases', ...pathParts);

  // Prevent directory traversal
  const resolved = path.resolve(filePath);
  const baseDir = path.resolve(process.cwd(), 'uploads', 'purchases');
  if (!resolved.startsWith(baseDir)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const buffer = await readFile(resolved);
    const ext = path.extname(resolved).toLowerCase();
    const contentType =
      ext === '.webm' ? 'audio/webm' :
      ext === '.mp3' || ext === '.mpeg' ? 'audio/mpeg' :
      ext === '.ogg' ? 'audio/ogg' :
      ext === '.mp4' ? 'audio/mp4' :
      ext === '.pdf' ? 'application/pdf' :
      ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' :
      ext === '.png' ? 'image/png' :
      ext === '.webp' ? 'image/webp' :
      'application/octet-stream';

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch {
    return NextResponse.json({ error: 'فایل یافت نشد' }, { status: 404 });
  }
}
```

**نکته سازگاری:** این یک فایل جدید است. هیچ فایل موجودی تغییر نمی‌کند.

### چک‌لیست فاز ۱

- [ ] `addInquiry` ورودی `attachments` را می‌پذیرد و در دیتابیس ذخیره می‌کند
- [ ] صفحه استعلام جدید `attachments` را در mutation ارسال می‌کند
- [ ] کامنت‌های اضافی `onSuccess` پاک شده‌اند
- [ ] route handler برای `/api/uploads/purchases/[...path]` ساخته شده
- [ ] فایل صوتی در صفحه جزئیات خرید قابل پخش است
- [ ] پیوست‌های استعلام در صفحه جزئیات خرید نمایش داده می‌شوند
- [ ] تست‌ها اجرا شده: `npx vitest run`
- [ ] `npm run build` بدون خطا
- [ ] دستی تست: ثبت استعلام با پیوست → بررسی نمایش پیوست در صفحه جزئیات
- [ ] دستی تست: ثبت درخواست با پیام صوتی → بررسی پخش صوت
- [ ] روی سرور: `npx prisma migrate deploy` اجرا شده (در صورت نیاز)
- [ ] روی سرور: بیلد بدون خطا
- [ ] روی سرور: لاگ خطا بررسی شده

---

## فاز ۲ — مقایسه استعلام‌ها و برچسب ارزان‌ترین (P1)

### هدف
وقتی چند استعلام برای یک درخواست ثبت شده، مدیر بتواند به‌راحتی مقایسه کند و بهترین را انتخاب کند.

### فایل‌های درگیر
- `app/purchases/[id]/page.tsx`
- `server/api/routers/purchase.ts`

### گام‌به‌گام

#### ۲.۱ برچسب «ارزان‌ترین» روی استعلام

**فایل:** `app/purchases/[id]/page.tsx`

در بخش نمایش استعلام‌ها (حدود خط ۳۴۱)، قبل از `map`، استعلام با کمترین `totalPrice` را پیدا کن:

```typescript
{request.inquiries.length > 0 && (
  <div className="grid gap-4">
    {(() => {
      const validInquiries = request.inquiries.filter((inq: any) => inq.totalPrice > 0);
      const cheapestInquiryId = validInquiries.length > 0
        ? validInquiries.reduce((min: any, inq: any) =>
            inq.totalPrice < min.totalPrice ? inq : min
          ).id
        : null;

      return request.inquiries.map((inq: any) => {
        const isApproved = request.approvedInquiryId === inq.id;
        const isCheapest = inq.id === cheapestInquiryId && inq.totalPrice > 0;
        // ... existing rendering
```

و در هدر استعلام، بعد از نام تامین‌کننده:

```tsx
{isCheapest && !isApproved && (
  <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
    <TrendingDown size={12} />
    ارزان‌ترین
  </span>
)}
```

#### ۲.۲ جدول مقایسه‌ای استعلام‌ها

**فایل:** `app/purchases/[id]/page.tsx`

بعد از لیست استعلام‌ها و قبل از `Reject Modal`، یک بخش «مقایسه استعلام‌ها» اضافه کن (فقط اگر بیش از یک استعلام با قیمت وجود دارد):

```tsx
{request.inquiries.filter((inq: any) => inq.totalPrice > 0).length > 1 && (
  <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
    <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
      <h3 className="text-sm font-medium text-gray-700">مقایسه استعلام‌ها</h3>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50/50">
            <th className="px-4 py-2 text-right text-gray-600 font-medium">محصول</th>
            {request.inquiries.filter((inq: any) => inq.totalPrice > 0).map((inq: any) => (
              <th key={inq.id} className="px-4 py-2 text-right text-gray-600 font-medium">
                {inq.supplierName}
                {inq.id === cheapestInquiryId && (
                  <span className="mr-1 text-green-600">★</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {request.items.map((item: any) => (
            <tr key={item.id} className="border-b border-gray-100">
              <td className="px-4 py-2 font-medium">{item.productName}</td>
              {request.inquiries.filter((inq: any) => inq.totalPrice > 0).map((inq: any) => {
                const inqItem = inq.items.find((ii: any) => ii.purchaseItemId === item.id);
                return (
                  <td key={inq.id} className="px-4 py-2">
                    {inqItem ? `${formatPrice(inqItem.unitPrice)} تومان` : '—'}
                  </td>
                );
              })}
            </tr>
          ))}
          <tr className="border-t-2 border-gray-200 bg-gray-50/50 font-bold">
            <td className="px-4 py-2">جمع کل</td>
            {request.inquiries.filter((inq: any) => inq.totalPrice > 0).map((inq: any) => (
              <td key={inq.id} className="px-4 py-2">
                {formatPrice(inq.totalPrice)} تومان
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  </div>
)}
```

#### ۲.۳ محاسبه صرفه‌جویی

در همان بخش مقایسه، بعد از جدول، میزان صرفه‌جویی را نمایش بده:

```tsx
{(() => {
  const priced = request.inquiries.filter((inq: any) => inq.totalPrice > 0);
  if (priced.length < 2) return null;
  const max = Math.max(...priced.map((inq: any) => inq.totalPrice));
  const min = Math.min(...priced.map((inq: any) => inq.totalPrice));
  const savings = max - min;
  const savingsPercent = ((savings / max) * 100).toFixed(1);
  return (
    <div className="mt-3 flex items-center gap-2 text-sm">
      <span className="text-gray-500">صرفه‌جویی با انتخاب ارزان‌ترین:</span>
      <span className="font-bold text-green-600">
        {formatPrice(savings)} تومان ({savingsPercent}٪)
      </span>
    </div>
  );
})()}
```

#### ۲.۴ اضافه کردن `TrendingDown` به import‌ها

**فایل:** `app/purchases/[id]/page.tsx`

```typescript
import { ..., TrendingDown } from 'lucide-react';
```

### چک‌لیست فاز ۲

- [ ] برچسب «ارزان‌ترین» روی استعلام با کمترین قیمت نمایش داده می‌شود
- [ ] جدول مقایسه‌ای قیمت اقلام بین تامین‌کنندگان نمایش داده می‌شود
- [ ] میزان صرفه‌جویی محاسبه و نمایش داده می‌شود
- [ ] `TrendingDown` به import‌ها اضافه شده
- [ ] تست‌ها اجرا شده: `npx vitest run`
- [ ] `npm run build` بدون خطا
- [ ] دستی تست: ثبت ۲+ استعلام برای یک درخواست → بررسی جدول مقایسه و برچسب ارزان‌ترین
- [ ] روی سرور: بیلد بدون خطا
- [ ] روی سرور: لاگ خطا بررسی شده

---

## فاز ۳ — Audit Log خرید و فیلتر تاریخ (P2)

### هدف
اضافه کردن تاریخچه تغییرات به درخواست‌های خرید (مشابه `WorkReportAudit`) و فیلتر بازه تاریخ در لیست خرید.

### فایل‌های درگیر
- `prisma/schema.prisma`
- `server/api/routers/purchase.ts`
- `app/purchases/page.tsx`
- `app/purchases/[id]/page.tsx`

### گام‌به‌گام

#### ۳.۱ مدل `PurchaseAudit`

**فایل:** `prisma/schema.prisma`

بعد از مدل `InquiryAttachment`، مدل جدید اضافه کن:

```prisma
model PurchaseAudit {
  id                String   @id @default(uuid())
  purchaseRequestId String
  userId            String
  action            String   // 'CREATED' | 'UPDATED' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'PURCHASED' | 'INQUIRY_ADDED' | 'INQUIRY_APPROVED' | 'DELETED'
  changes           String?  // JSON string of changed fields
  createdAt         DateTime @default(now())

  purchaseRequest   PurchaseRequest @relation(fields: [purchaseRequestId], references: [id], onDelete: Cascade)
  user              User            @relation(fields: [userId], references: [id])

  @@index([purchaseRequestId])
  @@map("purchase_audits")
}
```

و در مدل `PurchaseRequest`، بعد از `approvedInquiry`، relation را اضافه کن:

```prisma
  audits            PurchaseAudit[]
```

و در مدل `User`، بعد از relation‌های خرید موجود:

```prisma
  purchaseAudits    PurchaseAudit[]
```

سپس مهاجرت اجرا کن:
```bash
npx prisma migrate dev --name add_purchase_audit
```

**نکته سازگاری:** جدول جدید. هیچ جدول موجودی تغییر نمی‌کند.

#### ۳.۲ ثبت Audit Log در mutation‌های خرید

**فایل:** `server/api/routers/purchase.ts`

در هر mutation، بعد از عملیات اصلی، یک رکورد audit ثبت کن:

```typescript
// در create:
await ctx.prisma.purchaseAudit.create({
  data: {
    purchaseRequestId: created.id,
    userId: ctx.session.user.id,
    action: 'CREATED',
  },
});

// در update:
await ctx.prisma.purchaseAudit.create({
  data: {
    purchaseRequestId: input.id,
    userId: ctx.session.user.id,
    action: 'UPDATED',
    changes: JSON.stringify(input),
  },
});

// در submitForApproval:
await ctx.prisma.purchaseAudit.create({
  data: {
    purchaseRequestId: input.id,
    userId: ctx.session.user.id,
    action: 'SUBMITTED',
  },
});

// در approve:
await ctx.prisma.purchaseAudit.create({
  data: {
    purchaseRequestId: input.purchaseRequestId,
    userId: ctx.session.user.id,
    action: 'INQUIRY_APPROVED',
  },
});

// در reject:
await ctx.prisma.purchaseAudit.create({
  data: {
    purchaseRequestId: input.id,
    userId: ctx.session.user.id,
    action: 'REJECTED',
    changes: JSON.stringify({ reason: input.reason }),
  },
});

// در markPurchased:
await ctx.prisma.purchaseAudit.create({
  data: {
    purchaseRequestId: input.id,
    userId: ctx.session.user.id,
    action: 'PURCHASED',
  },
});

// در addInquiry:
await ctx.prisma.purchaseAudit.create({
  data: {
    purchaseRequestId: input.purchaseRequestId,
    userId: ctx.session.user.id,
    action: 'INQUIRY_ADDED',
  },
});
```

#### ۳.۳ پروسیجر `listAudit`

**فایل:** `server/api/routers/purchase.ts`

```typescript
  listAudit: protectedProcedure
    .input(z.object({ purchaseRequestId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const role = ctx.session.user.role;
      if (role !== 'ADMIN' && role !== 'MANAGER') {
        const req = await ctx.prisma.purchaseRequest.findUnique({
          where: { id: input.purchaseRequestId },
          select: { createdById: true, assignedToId: true },
        });
        if (req?.createdById !== ctx.session.user.id && req?.assignedToId !== ctx.session.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
      }
      return ctx.prisma.purchaseAudit.findMany({
        where: { purchaseRequestId: input.purchaseRequestId },
        include: { user: { select: { fullName: true } } },
        orderBy: { createdAt: 'desc' },
      });
    }),
```

#### ۳.۴ نمایش تاریخچه در صفحه جزئیات خرید

**فایل:** `app/purchases/[id]/page.tsx`

بعد از بخش استعلام‌ها و قبل از `Reject Modal`:

```tsx
{isManager && auditLog && auditLog.length > 0 && (
  <div className="rounded-xl border border-gray-200 bg-white p-4">
    <h3 className="mb-3 text-sm font-semibold text-gray-700">تاریخچه تغییرات</h3>
    <div className="space-y-2">
      {auditLog.map((log: any) => (
        <div key={log.id} className="flex items-center gap-3 text-sm">
          <span className="text-gray-400">{moment(log.createdAt).format('jYYYY/jMM/jDD - HH:mm')}</span>
          <span className="font-medium text-gray-700">{log.user.fullName}</span>
          <span className="text-gray-500">
            {log.action === 'CREATED' ? 'درخواست را ایجاد کرد' :
             log.action === 'UPDATED' ? 'درخواست را ویرایش کرد' :
             log.action === 'SUBMITTED' ? 'برای تایید ارسال کرد' :
             log.action === 'INQUIRY_ADDED' ? 'استعلام جدید ثبت کرد' :
             log.action === 'INQUIRY_APPROVED' ? 'استعلام را تایید کرد' :
             log.action === 'APPROVED' ? 'درخواست را تایید کرد' :
             log.action === 'REJECTED' ? 'درخواست را رد کرد' :
             log.action === 'PURCHASED' ? 'خریداری شد' :
             log.action === 'DELETED' ? 'حذف کرد' :
             log.action}
          </span>
        </div>
      ))}
    </div>
  </div>
)}
```

و query را اضافه کن:

```typescript
const { data: auditLog } = trpc.purchase.listAudit.useQuery(
  { purchaseRequestId: id },
  { enabled: !!id && isManager }
);
```

#### ۳.۵ فیلتر بازه تاریخ در لیست خرید

**فایل:** `server/api/routers/purchase.ts`

در پروسیجر `list`، ورودی `dateFrom` و `dateTo` را اضافه کن:

```typescript
  list: protectedProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(20),
        status: z.enum(['DRAFT', 'PENDING_INQUIRY', 'INQUIRED', 'APPROVED', 'REJECTED', 'PURCHASED']).optional().nullable(),
        priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional().nullable(),
        search: z.string().optional().nullable(),
        projectId: z.string().uuid().optional().nullable(),
        assignedToId: z.string().uuid().optional().nullable(),
        dateFrom: z.string().optional().nullable(), // جدید
        dateTo: z.string().optional().nullable(),   // جدید
      })
    )
```

و در `where`:

```typescript
      if (input.dateFrom || input.dateTo) {
        where.createdAt = {};
        if (input.dateFrom) where.createdAt.gte = new Date(input.dateFrom);
        if (input.dateTo) where.createdAt.lte = new Date(input.dateTo);
      }
```

**فایل:** `app/purchases/page.tsx`

دو `JalaliDatePicker` برای فیلتر تاریخ اضافه کن و در query ارسال کن:

```typescript
const [dateFrom, setDateFrom] = useState('');
const [dateTo, setDateTo] = useState('');

// در trpc.purchase.list.useQuery:
  { ..., dateFrom: dateFrom || undefined, dateTo: dateTo || undefined }

// در UI فیلترها:
<div className="flex items-center gap-2">
  <JalaliDatePicker value={dateFrom} onChange={setDateFrom} placeholder="از تاریخ" />
  <span className="text-gray-400">—</span>
  <JalaliDatePicker value={dateTo} onChange={setDateTo} placeholder="تا تاریخ" />
</div>
```

### چک‌لیست فاز ۳

- [ ] مدل `PurchaseAudit` اضافه شده و `migrate` اجرا شده
- [ ] در `create`, `update`, `submitForApproval`, `approve`, `reject`, `markPurchased`, `addInquiry` رکورد audit ثبت می‌شود
- [ ] `listAudit` پروسیجر اضافه شده
- [ ] بخش تاریخچه تغییرات در صفحه جزئیات خرید نمایش داده می‌شود
- [ ] فیلتر `dateFrom` و `dateTo` به `list` اضافه شده
- [ ] `JalaliDatePicker` در صفحه لیست خرید اضافه شده
- [ ] تست‌ها اجرا شده: `npx vitest run`
- [ ] `npm run build` بدون خطا
- [ ] دستی تست: ایجاد → ویرایش → ارسال → تایید → بررسی تاریخچه
- [ ] دستی تست: فیلتر بازه تاریخ در لیست خرید
- [ ] روی سرور: `npx prisma migrate deploy` اجرا شده
- [ ] روی سرور: بیلد بدون خطا
- [ ] روی سرور: لاگ خطا بررسی شده

---

## فاز ۴ — خلاصه خرید در صفحه پروژه و چاپ درخواست (P3)

### هدف
اضافه کردن کارت خلاصه خرید به صفحه پروژه و دکمه چاپ برای درخواست خرید و استعلام تاییدشده.

### فایل‌های درگیر
- `server/api/routers/project.ts`
- `app/projects/[id]/page.tsx`
- `app/purchases/[id]/page.tsx`
- `lib/services/purchase-pdf.ts` (جدید)
- `app/api/purchases/[id]/pdf/route.ts` (جدید)

### گام‌به‌گام

#### ۴.۱ خلاصه خرید در صفحه پروژه

**فایل:** `server/api/routers/project.ts`

در پروسیجر `getSummary` (که قبلاً برای گزارش کار و مستندات ساخته شده)، بخش خرید را اضافه کن:

```typescript
      const [workReports, contractorDocs, purchases] = await Promise.all([
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
        // جدید: خلاصه خرید
        ctx.prisma.purchaseRequest.groupBy({
          by: ['status'],
          where: { projectId: input.id },
          _count: { _all: true },
        }),
      ]);

      // محاسبه مبلغ کل خریدهای تاییدشده
      const approvedPurchases = await ctx.prisma.purchaseRequest.findMany({
        where: { projectId: input.id, status: { in: ['APPROVED', 'PURCHASED'] } },
        select: { approvedInquiry: { select: { totalPrice: true } } },
      });
      const totalPurchaseAmount = approvedPurchases.reduce(
        (sum, p) => sum + (p.approvedInquiry?.totalPrice || 0),
        0
      );

      return { workReports, contractorDocs, purchases, totalPurchaseAmount };
```

**فایل:** `app/projects/[id]/page.tsx`

بعد از کارت‌های خلاصه موجود، کارت‌های خرید اضافه کن:

```tsx
{summary && (
  <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
    {/* کارت‌های موجود: گزارش کار و مستندات */}
    {/* ... */}

    {/* جدید: کارت خرید */}
    {summary.purchases.map((p: any) => (
      <div key={p.status} className="rounded-lg border border-gray-200 bg-white p-3">
        <p className="text-xs text-gray-500">
          {p.status === 'DRAFT' ? 'پیش‌نویس' :
           p.status === 'PENDING_INQUIRY' ? 'در انتظار استعلام' :
           p.status === 'INQUIRED' ? 'استعلام‌شده' :
           p.status === 'APPROVED' ? 'تاییدشده' :
           p.status === 'REJECTED' ? 'ردشده' :
           p.status === 'PURCHASED' ? 'خریداری‌شده' : p.status}
        </p>
        <p className="text-lg font-bold text-gray-900">{p._count._all}</p>
      </div>
    ))}
    {summary.totalPurchaseAmount > 0 && (
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
        <p className="text-xs text-blue-500">مبلغ کل خرید</p>
        <p className="text-lg font-bold text-blue-900">
          {Number(summary.totalPurchaseAmount).toLocaleString('fa-IR')}
          <span className="text-xs font-normal mr-1">تومان</span>
        </p>
      </div>
    )}
  </div>
)}
```

#### ۴.۲ خروجی PDF درخواست خرید

**فایل جدید:** `lib/services/purchase-pdf.ts`

مشابه `lib/services/work-report-pdf.ts`، یک تابع `generatePurchasePDF` بساز که:
- اطلاعات درخواست (شماره، عنوان، اولویت، وضعیت، پروژه، ایجادکننده، مسئول، مهلت)
- توضیحات و دلیل رد (در صورت وجود)
- جدول اقلام (ردیف، نام محصول، توضیحات، تعداد، واحد، قیمت تخمینی)
- جدول استعلام تاییدشده (تامین‌کننده، قیمت کل، روش پرداخت، اقلام)
- مبلغ کل
را در PDF تولید کند.

```typescript
import PDFDocument from 'pdfkit';
import { writeFileSync } from 'fs';
import path from 'path';

export async function generatePurchasePDF(request: any, outputPath: string): Promise<void> {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  writeFileSync(outputPath, '');

  doc.pipe(createWriteStream(outputPath));

  // عنوان
  doc.fontSize(18).text('درخواست خرید', { align: 'center' });
  doc.moveDown();

  // اطلاعات درخواست
  doc.fontSize(12);
  doc.text(`شماره: ${request.requestNumber}`);
  doc.text(`عنوان: ${request.title}`);
  doc.text(`وضعیت: ${request.status}`);
  doc.text(`اولویت: ${request.priority}`);
  if (request.project) doc.text(`پروژه: ${request.project.name}`);
  if (request.createdBy) doc.text(`ایجادکننده: ${request.createdBy.fullName}`);
  if (request.assignedTo) doc.text(`مسئول استعلام: ${request.assignedTo.fullName}`);
  if (request.deadline) doc.text(`مهلت: ${new Date(request.deadline).toLocaleDateString('fa-IR')}`);
  doc.moveDown();

  // اقلام
  doc.fontSize(14).text('اقلام درخواست');
  doc.moveDown();
  // ... جدول اقلام

  // استعلام تاییدشده
  if (request.approvedInquiry) {
    doc.moveDown();
    doc.fontSize(14).text('استعلام تاییدشده');
    doc.fontSize(12);
    doc.text(`تامین‌کننده: ${request.approvedInquiry.supplierName}`);
    doc.text(`قیمت کل: ${request.approvedInquiry.totalPrice} تومان`);
    // ... جدول اقلام استعلام
  }

  doc.end();
}
```

**فایل جدید:** `app/api/purchases/[id]/pdf/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options';
import { prisma } from '@/lib/prisma';
import { generatePurchasePDF } from '@/lib/services/purchase-pdf';
import path from 'path';
import { readFile, unlink } from 'fs/promises';
import { randomUUID } from 'crypto';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const purchaseRequest = await prisma.purchaseRequest.findUnique({
    where: { id },
    include: {
      project: { select: { name: true } },
      createdBy: { select: { fullName: true } },
      assignedTo: { select: { fullName: true } },
      items: true,
      approvedInquiry: {
        include: {
          items: { include: { purchaseItem: true } },
        },
      },
    },
  });

  if (!purchaseRequest) {
    return NextResponse.json({ error: 'یافت نشد' }, { status: 404 });
  }

  const tmpFile = path.join(process.cwd(), 'tmp', `purchase-${randomUUID()}.pdf`);
  await generatePurchasePDF(purchaseRequest, tmpFile);
  const buffer = await readFile(tmpFile);
  await unlink(tmpFile).catch(() => {});

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="purchase-${purchaseRequest.requestNumber}.pdf"`,
    },
  });
}
```

**فایل:** `app/purchases/[id]/page.tsx`

دکمه PDF اضافه کن:

```tsx
<a
  href={`/api/purchases/${id}/pdf`}
  target="_blank"
  className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
>
  <Download size={16} />
  PDF
</a>
```

### چک‌لیست فاز ۴

- [ ] `getSummary` بخش خرید را برمی‌گرداند
- [ ] کارت‌های خلاصه خرید در صفحه پروژه نمایش داده می‌شود
- [ ] `generatePurchasePDF` ساخته شده
- [ ] مسیر `/api/purchases/[id]/pdf` کار می‌کند
- [ ] دکمه PDF در صفحه جزئیات خرید اضافه شده
- [ ] تست‌ها اجرا شده: `npx vitest run`
- [ ] `npm run build` بدون خطا
- [ ] دستی تست: باز کردن صفحه پروژه → بررسی کارت‌های خرید
- [ ] دستی تست: تولید PDF درخواست خرید
- [ ] روی سرور: بیلد بدون خطا
- [ ] روی سرور: لاگ خطا بررسی شده

---

## فاز ۵ — رد استعلام جداگانه و بهبودهای رابط کاربری (P4)

### هدف
امکان رد یک استعلام خاص بدون رد کل درخواست، و بهبودهای رابط کاربری.

### فایل‌های درگیر
- `server/api/routers/purchase.ts`
- `app/purchases/[id]/page.tsx`
- `app/purchases/page.tsx`

### گام‌به‌گام

#### ۵.۱ رد استعلام جداگانه

**فایل:** `server/api/routers/purchase.ts`

پروسیجر جدید اضافه کن:

```typescript
  rejectInquiry: managerProcedure
    .input(z.object({
      inquiryId: z.string().uuid(),
      reason: z.string().optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      const inquiry = await ctx.prisma.purchaseInquiry.findUnique({
        where: { id: input.inquiryId },
        include: { purchaseRequest: { select: { id: true, status: true } } },
      });
      if (!inquiry) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'استعلام یافت نشد' });
      }
      if (inquiry.purchaseRequest.status === 'APPROVED' || inquiry.purchaseRequest.status === 'PURCHASED') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'درخواست تاییدشده است' });
      }

      // حذف استعلام ردشده (یا علامت‌گذاری)
      await ctx.prisma.purchaseInquiry.delete({
        where: { id: input.inquiryId },
      });

      await ctx.prisma.purchaseAudit.create({
        data: {
          purchaseRequestId: inquiry.purchaseRequestId,
          userId: ctx.session.user.id,
          action: 'INQUIRY_REJECTED',
          changes: JSON.stringify({ inquiryId: input.inquiryId, reason: input.reason }),
        },
      });

      return { success: true };
    }),
```

**فایل:** `app/purchases/[id]/page.tsx`

در هدر هر استعلام، دکمه «رد استعلام» اضافه کن (در کنار دکمه تایید):

```tsx
{canApprove && !request.approvedInquiryId && (
  <>
    <LoadingButton
      onClick={() => approveMutation.mutate({ purchaseRequestId: id, inquiryId: inq.id })}
      loading={approveMutation.isPending}
      className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
    >
      <CheckCircle size={14} />
      تایید
    </LoadingButton>
    <button
      onClick={() => {
        if (confirm('این استعلام رد شود؟')) {
          rejectInquiryMutation.mutate({ inquiryId: inq.id });
        }
      }}
      className="inline-flex items-center gap-1 rounded-lg bg-red-100 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-200"
    >
      <XCircle size={14} />
      رد
    </button>
  </>
)}
```

و mutation را اضافه کن:

```typescript
const rejectInquiryMutation = trpc.purchase.rejectInquiry.useMutation({
  onSuccess: async () => {
    toast.success('استعلام رد شد');
    utils.purchase.getById.invalidate({ id });
  },
  onError: (err) => toast.error(err.message),
});
```

#### ۵.۲ نمایش شمارش استعلام‌ها در لیست خرید

**فایل:** `app/purchases/page.tsx`

در جدول لیست خرید، ستون «تعداد استعلام» اضافه کن:

```tsx
<th className="px-4 py-3 text-center font-medium">استعلام</th>
```

و در بدنه:

```tsx
<td className="px-4 py-3 text-center">
  {item._count?.inquiries > 0 ? (
    <span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
      {item._count.inquiries}
    </span>
  ) : (
    <span className="text-gray-300">—</span>
  )}
</td>
```

**فایل:** `server/api/routers/purchase.ts`

در `list`، `_count` را به `include` اضافه کن:

```typescript
      const [requests, total] = await Promise.all([
        ctx.prisma.purchaseRequest.findMany({
          where,
          skip,
          take: input.limit,
          orderBy: { createdAt: 'desc' },
          include: {
            project: { select: { id: true, name: true } },
            createdBy: { select: { id: true, fullName: true } },
            assignedTo: { select: { id: true, fullName: true } },
            _count: { select: { inquiries: true, items: true } }, // جدید
          },
        }),
        ctx.prisma.purchaseRequest.count({ where }),
      ]);
```

#### ۵.۳ نمایش مبلغ استعلام تاییدشده در لیست خرید

در `list`، `approvedInquiry` را به `include` اضافه کن:

```typescript
          include: {
            project: { select: { id: true, name: true } },
            createdBy: { select: { id: true, fullName: true } },
            assignedTo: { select: { id: true, fullName: true } },
            _count: { select: { inquiries: true, items: true } },
            approvedInquiry: { select: { totalPrice: true, supplierName: true } }, // جدید
          },
```

و در جدول لیست:

```tsx
<th className="px-4 py-3 text-left font-medium">مبلغ تاییدشده</th>
```

```tsx
<td className="px-4 py-3 text-left font-mono text-xs">
  {item.approvedInquiry ? (
    <span className="text-gray-900">{formatPrice(item.approvedInquiry.totalPrice)}</span>
  ) : (
    <span className="text-gray-300">—</span>
  )}
</td>
```

### چک‌لیست فاز ۵

- [ ] `rejectInquiry` پروسیجر اضافه شده
- [ ] دکمه «رد استعلام» در صفحه جزئیات کار می‌کند
- [ ] ستون «تعداد استعلام» در لیست خرید نمایش داده می‌شود
- [ ] ستون «مبلغ تاییدشده» در لیست خرید نمایش داده می‌شود
- [ ] `_count` و `approvedInquiry` به `list` اضافه شده
- [ ] تست‌ها اجرا شده: `npx vitest run`
- [ ] `npm run build` بدون خطا
- [ ] دستی تست: رد یک استعلام بدون تاثیر روی بقیه
- [ ] دستی تست: بررسی ستون‌های جدید در لیست خرید
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
6. [ ] روی سرور: Docker image جدید build شده: `docker build -t new_invoice-web:v<version>-purchase-phase<phase> .`
7. [ ] روی سرور: `docker-compose.yml` آپدیت شده (image جدید) یا `docker compose up -d` اجرا شده
8. [ ] روی سرور: مهاجرت دیتابیس به‌صورت خودکار توسط `docker-entrypoint.sh` اجرا شده (در ری‌استارت)
9. [ ] روی سرور: لاگ کانتینر بررسی شده: `docker logs invoice_web --tail 50`
10. [ ] روی سرور: تست دستی حداقل یک سناریوی کلیدی
11. [ ] روی سرور: بررسی سلامت کانتینر: `docker ps` و وضعیت `healthy`

### دستورات سریع استقرار

```bash
# روی سرور (SSH: moein@192.168.85.11)
cd /home/moein/new_invoice
git pull

# build image جدید (شماره نسخه را متناسب با فاز تغییر دهید)
docker build -t new_invoice-web:v50-purchase-phase1 .

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
| ۱ | رفع باگ‌های حیاتی (پیوست استعلام + فایل صوتی) | ۲ | ۰ | ۱ | پایین |
| ۲ | مقایسه استعلام‌ها و برچسب ارزان‌ترین | ۴ | ۰ | ۰ | پایین |
| ۳ | Audit Log خرید و فیلتر تاریخ | ۵ | ۱ مهاجرت | ۰ | متوسط |
| ۴ | خلاصه خرید در پروژه و چاپ PDF | ۲ | ۰ | ۲ | متوسط |
| ۵ | رد استعلام جداگانه و بهبود UI | ۳ | ۰ | ۰ | پایین |
