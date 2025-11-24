# 🐳 Invoice Management System - Docker Deployment

## 🚀 دستورات سریع

### راه‌اندازی اولیه:
```bash
# 1. کلون پروژه
git clone https://github.com/moein1985/new_invoice.git
cd new_invoice

# 2. کپی تنظیمات محیطی
cp .env.example .env

# 3. ویرایش .env و تنظیم NEXTAUTH_URL با IP سرور خود
# مثال: NEXTAUTH_URL="http://192.168.1.100:3000"
nano .env

# 4. راه‌اندازی
docker-compose up -d

# 5. مشاهده لاگ‌ها
docker-compose logs -f
```

### دسترسی:
- **برنامه**: `http://your-server-ip:3000`
- **ورود**: `admin / admin123`

---

## 📋 دستورات Docker

```bash
# ساخت و اجرا
npm run docker:up

# خاموش کردن
npm run docker:down

# مشاهده لاگ‌ها
npm run docker:logs

# ری‌استارت
npm run docker:restart

# پاک کردن کامل (شامل volume‌ها)
npm run docker:clean
```

---

## 🔧 تنظیمات

### Environment Variables:

در فایل `.env`:

```env
# آدرس سرور خود را وارد کنید
NEXTAUTH_URL="http://YOUR_SERVER_IP:3000"

# سایر تنظیمات (پیش‌فرض OK است)
DATABASE_URL="postgresql://invoice_user:invoice_pass_2024@postgres:5432/invoice_db"
NEXTAUTH_SECRET="change-this-to-random-secret-in-production-min-32-chars"
```

---

## 📦 بکاپ و Restore

### بکاپ گرفتن:
```bash
# بکاپ دستی از دیتابیس
docker exec invoice_postgres pg_dump -U invoice_user invoice_db > backup.sql

# بکاپ volume
docker run --rm -v new_invoice_postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/postgres-backup.tar.gz -C /data .
```

### بازگردانی:
```bash
# Restore از فایل SQL
docker exec -i invoice_postgres psql -U invoice_user invoice_db < backup.sql
```

---

## 🔍 بررسی سلامت

```bash
# وضعیت سرویس‌ها
docker-compose ps

# لاگ‌های web
docker logs invoice_web

# لاگ‌های postgres
docker logs invoice_postgres

# دسترسی به shell
docker exec -it invoice_web sh
docker exec -it invoice_postgres sh
```

---

## ⚠️ نکات مهم

1. **فایروال**: پورت 3000 باید باز باشه
2. **PostgreSQL**: داخلی است و از بیرون قابل دسترسی نیست (امن)
3. **Volumes**: داده‌های دیتابیس در volume ذخیره می‌شه و پایدار است
4. **Sentry**: فعال است برای مانیتورینگ خطاها

---

## 🆕 آپدیت برنامه

```bash
# Pull آخرین تغییرات
git pull

# Rebuild و restart
docker-compose up -d --build
```

---

## 🐛 عیب‌یابی

### برنامه start نمیشه:
```bash
# چک کردن لاگ‌ها
docker-compose logs web

# ری‌استارت
docker-compose restart
```

### دیتابیس متصل نمیشه:
```bash
# چک کردن postgres
docker-compose logs postgres

# چک کردن health
docker inspect invoice_postgres
```

### پاک کردن کامل و شروع از نو:
```bash
docker-compose down -v
docker-compose up -d
```

---

## 📊 نمای کلی ساختار

```
invoice-system/
├── postgres (container)     # PostgreSQL 16
│   └── postgres_data (volume) # دیتای دیتابیس
├── web (container)           # Next.js App
└── invoice_network          # شبکه داخلی
```

**Port Mapping:**
- Host:3000 → Container:3000 (Next.js)
- PostgreSQL: فقط داخلی (امن)
