# طرح پیاده‌سازی دفترچه مخاطبین و تماس با یک کلیک

## خلاصه

اضافه کردن یک سیستم **دفترچه مخاطبین** (مخاطبین) به اپلیکیشن شامل دو بخش:
1. **دفترچه مخاطبین** — ذخیره، جستجو، ویرایش و حذف اطلاعات تماس
2. **تماس با یک کلیک** — برقراری تماس تلفنی از طریق Asterisk AMI Originate

---

## بخش ۱: مدل داده (Prisma Schema)

### مدل Contact

```prisma
model Contact {
  id           String   @id @default(uuid())
  code         String   @unique              // CON-0001, CON-0002, ...
  firstName    String                        // نام
  lastName     String                        // نام خانوادگی
  company      String?                       // شرکت/سازمان
  position     String?                       // سمت
  phone        String?                       // تلفن ثابت
  mobile       String?                       // موبایل
  email        String?                       // ایمیل
  address      String?                       // آدرس
  notes        String?                       // یادداشت
  category     ContactCategory @default(OTHER) // دسته‌بندی
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  createdById  String
  createdBy    User     @relation(fields: [createdById], references: [id])
}

enum ContactCategory {
  COLLEAGUE    // همکار
  CLIENT       // مشتری
  VENDOR       // تامین‌کننده
  PERSONAL     // شخصی
  OTHER        // سایر
}
```

### فایل‌های تغییر یافته
- `prisma/schema.prisma` — اضافه کردن مدل Contact و enum ContactCategory و relation به User

### دستورات
```bash
npx prisma migrate dev --name add-contacts
npx prisma generate
```

---

## بخش ۲: tRPC Router — مخاطبین

### فایل جدید: `server/api/routers/contact.ts`

| Procedure | نوع | سطح دسترسی | توضیحات |
|-----------|------|------------|---------|
| `list` | query | protectedProcedure | لیست مخاطبین با صفحه‌بندی و جستجو (نام، شماره، شرکت) |
| `getById` | query | protectedProcedure | دریافت اطلاعات یک مخاطب |
| `getAll` | query | protectedProcedure | همه مخاطبین (بدون صفحه‌بندی، برای dropdown) |
| `create` | mutation | protectedProcedure | ایجاد مخاطب جدید (کد خودکار CON-XXXX) |
| `update` | mutation | protectedProcedure | ویرایش مخاطب |
| `delete` | mutation | managerProcedure | حذف مخاطب (فقط مدیر و ادمین) |
| `search` | query | protectedProcedure | جستجوی سریع (برای autocomplete و تماس) |

### ورودی list
```typescript
z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
  search: z.string().optional(),
  category: z.nativeEnum(ContactCategory).optional(),
})
```

### جستجو در فیلدها
- firstName, lastName (ترکیبی)
- phone, mobile
- company
- code

### فایل تغییر یافته
- `server/api/root.ts` — اضافه کردن `contact: contactRouter`

---

## بخش ۳: tRPC Router — AMI Originate (تماس با یک کلیک)

### فایل جدید: `server/api/routers/ami.ts`

| Procedure | نوع | سطح دسترسی | توضیحات |
|-----------|------|------------|---------|
| `originate` | mutation | protectedProcedure | برقراری تماس از طریق AMI |
| `testConnection` | query | adminProcedure | تست اتصال به AMI (فقط ادمین) |

### منطق originate

```
ورودی: { destination: string }  // شماره مقصد

مراحل:
1. دریافت sipExtension کاربر جاری از دیتابیس
2. اگر sipExtension خالی باشد → خطا: "ابتدا شماره داخلی خود را در تنظیمات SIP وارد کنید"
3. اتصال به AMI:
   - Host: 192.168.85.89
   - Port: 5038
   - Username: invoice-app
   - Secret: InvoiceApp2026!
4. ارسال دستور Originate:
   - Channel: SIP/{sipExtension}     ← تلفن کاربر
   - Context: from-internal
   - Exten: {destination}             ← شماره مقصد
   - Priority: 1
   - CallerID: {sipExtension}
   - Timeout: 30000                   ← ۳۰ ثانیه برای جواب دادن
5. بعد از ارسال → Logoff از AMI
6. برگرداندن نتیجه: { success: true, message: "در حال برقراری تماس..." }
```

### نحوه عملکرد تماس
```
کاربر کلیک می‌کند → سرور به AMI وصل می‌شود → AMI به Asterisk دستور می‌دهد
→ Asterisk اول تلفن کاربر (مثلاً داخلی 102) را زنگ می‌زند
→ کاربر گوشی را برمی‌دارد
→ Asterisk شماره مقصد را شماره‌گیری می‌کند
→ تماس برقرار می‌شود
```

### اطلاعات AMI (از env یا hardcode)
```env
AMI_HOST=192.168.85.89
AMI_PORT=5038
AMI_USERNAME=invoice-app
AMI_SECRET=InvoiceApp2026!
AMI_CONTEXT=from-internal
```

### پیاده‌سازی AMI
از **raw TCP socket** (ماژول `net` نود) استفاده می‌کنیم:
```typescript
import net from 'net';

async function amiOriginate(extension: string, destination: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(5038, '192.168.85.89');
    let step = 'banner';

    socket.on('data', (data) => {
      const response = data.toString();
      if (step === 'banner') {
        // ارسال Login
        socket.write('Action: Login\r\nUsername: invoice-app\r\nSecret: InvoiceApp2026!\r\n\r\n');
        step = 'login';
      } else if (step === 'login' && response.includes('Success')) {
        // ارسال Originate
        socket.write(
          `Action: Originate\r\n` +
          `Channel: SIP/${extension}\r\n` +
          `Context: from-internal\r\n` +
          `Exten: ${destination}\r\n` +
          `Priority: 1\r\n` +
          `CallerID: ${extension}\r\n` +
          `Timeout: 30000\r\n` +
          `Async: true\r\n\r\n`
        );
        step = 'originate';
      } else if (step === 'originate') {
        // Logoff
        socket.write('Action: Logoff\r\n\r\n');
        resolve(response.includes('Success'));
        socket.end();
      }
    });

    socket.on('error', (err) => reject(err));
    setTimeout(() => { socket.destroy(); reject(new Error('Timeout')); }, 10000);
  });
}
```

### فایل تغییر یافته
- `server/api/root.ts` — اضافه کردن `ami: amiRouter`

---

## بخش ۴: صفحه مخاطبین

### فایل جدید: `app/contacts/page.tsx`

### عناصر صفحه

```
┌──────────────────────────────────────────────────────┐
│  مخاطبین                          [+ افزودن مخاطب]  │
├──────────────────────────────────────────────────────┤
│  🔍 جستجو... _______________    [فیلتر دسته‌بندی ▼] │
├──────────────────────────────────────────────────────┤
│  ☐ │ کد       │ نام         │ شرکت  │ تلفن/موبایل │ دسته │ عملیات        │
│  ──┼──────────┼─────────────┼───────┼─────────────┼──────┼───────────────│
│  ☐ │ CON-0001 │ علی احمدی   │ شرکت آ│ 📞021-1234  │همکار │ 📱✏️🗑️        │
│    │          │             │       │ 📱0912-xxx  │      │               │
│  ──┼──────────┼─────────────┼───────┼─────────────┼──────┼───────────────│
│  ☐ │ CON-0002 │ زهرا محمدی  │ شرکت ب│ 📞044-5678  │مشتری │ 📱✏️🗑️        │
│    │          │             │       │ 📱0935-xxx  │      │               │
├──────────────────────────────────────────────────────┤
│  صفحه ۱ از ۵    [◀ قبلی] [۱] [۲] [۳] [بعدی ▶]      │
└──────────────────────────────────────────────────────┘
```

### ستون عملیات
| آیکون | عملکرد | توضیحات |
|-------|--------|---------|
| 📱 (Phone) | تماس با یک کلیک | فراخوانی `ami.originate` — اگر هم تلفن ثابت و هم موبایل داشته باشد، منوی انتخاب نمایش داده می‌شود |
| ✏️ (Pencil) | ویرایش | باز کردن مودال ویرایش |
| 🗑️ (Trash) | حذف | فقط مدیر/ادمین — با تأیید |

### مودال ایجاد/ویرایش
```
┌────────────────────────────────┐
│  افزودن مخاطب جدید             │
├────────────────────────────────┤
│  نام*:          ___________    │
│  نام خانوادگی*: ___________    │
│  شرکت/سازمان:   ___________    │
│  سمت:           ___________    │
│  تلفن ثابت:     ___________    │
│  موبایل:        ___________    │
│  ایمیل:         ___________    │
│  آدرس:          ___________    │
│  دسته‌بندی:     [سایر     ▼]   │
│  یادداشت:       ___________    │
│                                │
│  [انصراف]          [ذخیره]     │
└────────────────────────────────┘
```

### قابلیت‌ها
- جستجوی real-time (debounced ۳۰۰ms)
- فیلتر بر اساس دسته‌بندی
- صفحه‌بندی (۲۰ مخاطب در هر صفحه)
- انتخاب چندتایی و حذف گروهی
- خروجی Excel
- نمایش ریسپانسیو (جدول در دسکتاپ، کارت در موبایل)

---

## بخش ۵: منوی سایدبار

### تغییر در: `components/ui/sidebar.tsx`

### محل اضافه شدن
در گروه اول (بدون عنوان)، بعد از **تقویم**:

```
داشبورد          → /dashboard
تقویم            → /calendar
مخاطبین   ★ جدید → /contacts
```

### آیکون
`Users` از lucide-react (یا `Contact` / `BookUser`)

### دسترسی
همه نقش‌ها **به‌جز** CONTRACTOR

---

## بخش ۶: UX تماس با یک کلیک

### جریان کاربری
```
1. کاربر وارد صفحه مخاطبین می‌شود
2. روی آیکون تلفن 📱 کنار شماره کلیک می‌کند
3. اگر مخاطب هم تلفن ثابت و هم موبایل دارد:
   → یک dropdown کوچک نمایش: "تماس با 021-12345678" / "تماس با 0912-1234567"
4. اگر فقط یک شماره دارد → مستقیم تماس
5. Toast نمایش داده می‌شود: "در حال برقراری تماس با 021-12345678..."
6. تلفن فیزیکی کاربر زنگ می‌زند
7. کاربر گوشی را برمی‌دارد
8. شماره مقصد شماره‌گیری می‌شود
```

### پیش‌نیاز‌های تماس
- کاربر باید `sipExtension` را در تنظیمات SIP وارد کرده باشد
- اگر وارد نکرده باشد: Toast خطا → "ابتدا شماره داخلی خود را در تنظیمات SIP وارد کنید"
- لینک مستقیم به `/settings/sip`

### مدیریت خطا
| وضعیت | پیام |
|-------|------|
| بدون داخلی | "ابتدا شماره داخلی خود را در تنظیمات SIP وارد کنید" |
| AMI خطا | "خطا در اتصال به سیستم تلفن" |
| Timeout | "تماس پاسخ داده نشد" |
| موفق | "در حال برقراری تماس..." |

---

## ترتیب پیاده‌سازی

| مرحله | شرح | فایل‌ها | وابستگی |
|-------|------|---------|---------|
| **۱** | مدل Contact در Prisma + Migration | `prisma/schema.prisma` | — |
| **۲** | tRPC Router مخاطبین (CRUD) | `server/api/routers/contact.ts`, `server/api/root.ts` | مرحله ۱ |
| **۳** | صفحه مخاطبین (UI) | `app/contacts/page.tsx` | مرحله ۲ |
| **۴** | منوی سایدبار | `components/ui/sidebar.tsx` | مرحله ۳ |
| **۵** | tRPC Router تماس AMI | `server/api/routers/ami.ts`, `server/api/root.ts` | — |
| **۶** | دکمه تماس در صفحه مخاطبین | `app/contacts/page.tsx` | مرحله ۳ + ۵ |
| **۷** | تست و دیپلوی | Docker build v35 | همه مراحل |

---

## اطلاعات فنی مهم

### سرور Asterisk (ایزابل)
- **IP:** 192.168.85.89
- **AMI Port:** 5038
- **AMI User:** invoice-app
- **AMI Secret:** InvoiceApp2026!
- **Permit:** 192.168.85.0/24
- **Asterisk Version:** 13.30.0
- **Context:** from-internal

### SIP Peers فعال
| داخلی | وضعیت | IP |
|-------|-------|----|
| 100 | آفلاین | — |
| 101 | آفلاین | — |
| 102 | آنلاین | 192.168.85.42 |
| 110 | آفلاین | — |
| 201 | آفلاین | — |
| 202 | آفلاین | — |

### Docker
- **Container:** invoice_web
- **Container IP:** 172.18.0.3
- **Image فعلی:** new_invoice-web:v34-purchase-edit
- **Image هدف:** new_invoice-web:v35-contacts

---

## ملاحظات امنیتی

1. **اعتبارسنجی شماره تلفن:** فقط اعداد، +، - و فاصله مجاز هستند (جلوگیری از injection)
2. **AMI Credentials:** در environment variable ذخیره می‌شوند، نه در کد
3. **Rate Limiting:** هر کاربر حداکثر ۱ تماس در ۱۰ ثانیه (جلوگیری از سوءاستفاده)
4. **Sanitize:** تمام ورودی‌ها با `sanitize` موجود پاک‌سازی می‌شوند
5. **دسترسی:** فقط کاربران احراز هویت شده (غیر CONTRACTOR)
