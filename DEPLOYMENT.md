# راهنمای نصب و راه‌اندازی خودکار

## نصب اولیه

### ۱. آماده‌سازی سرور

```bash
# کلون کردن پروژه
cd ~
git clone https://github.com/moein1985/new_invoice.git
cd new_invoice

# ساخت و اجرای کانتینرها
docker compose up -d --build
```

### ۲. راه‌اندازی خودکار (Auto-start)

برای اینکه برنامه بعد از ریبوت سرور به صورت خودکار اجرا شود:

```bash
# اجرای اسکریپت نصب (نیاز به دسترسی root)
chmod +x setup-autostart.sh
sudo ./setup-autostart.sh
```

این اسکریپت:
- سرویس Docker را فعال می‌کند
- یک سرویس systemd برای برنامه ایجاد می‌کند
- برنامه را برای اجرای خودکار تنظیم می‌کند

### ۳. تست اتوماتیک بودن

```bash
# ریبوت سرور
sudo reboot

# بعد از ریبوت، بررسی وضعیت
sudo systemctl status invoice-app
docker compose ps
```

## دستورات مدیریتی

### مدیریت سرویس

```bash
# بررسی وضعیت
sudo systemctl status invoice-app

# شروع سرویس
sudo systemctl start invoice-app

# توقف سرویس
sudo systemctl stop invoice-app

# ری‌استارت سرویس
sudo systemctl restart invoice-app

# مشاهده لاگ‌ها
sudo journalctl -u invoice-app -f
```

### مدیریت کانتینرها

```bash
# مشاهده کانتینرهای در حال اجرا
docker compose ps

# مشاهده لاگ‌ها
docker compose logs -f

# ری‌استارت کانتینرها
docker compose restart

# توقف کانتینرها
docker compose down

# شروع کانتینرها
docker compose up -d
```

### به‌روزرسانی برنامه

```bash
cd ~/new_invoice
git pull
docker compose down
docker compose up -d --build
```

### به‌روزرسانی با حفظ دیتابیس

```bash
cd ~/new_invoice
git pull
docker compose build --no-cache
docker compose up -d
```

### پاک کردن کامل (همراه با دیتابیس)

```bash
docker compose down -v
```

## تنظیمات

### تغییر پورت

فایل `docker-compose.yml` را ویرایش کنید:

```yaml
ports:
  - "8080:3000"  # به جای 3000:3000
```

### تغییر آدرس URL

فایل `docker-compose.yml` را ویرایش کنید:

```yaml
environment:
  - NEXTAUTH_URL=http://192.168.85.11:3000  # آدرس واقعی سرور
```

### تغییر رمز دیتابیس

فایل `docker-compose.yml` را ویرایش کنید و رمز را تغییر دهید:

```yaml
environment:
  POSTGRES_PASSWORD: your-new-password
```

و در متغیر `DATABASE_URL` نیز تغییر دهید.

## عیب‌یابی

### برنامه بالا نمی‌آید

```bash
# بررسی لاگ‌های Docker
docker compose logs -f

# بررسی وضعیت سرویس
sudo systemctl status docker
sudo systemctl status invoice-app
```

### دیتابیس به برنامه وصل نمیشه

```bash
# بررسی وضعیت دیتابیس
docker exec -it invoice_postgres pg_isready -U invoice_user

# اتصال به دیتابیس
docker exec -it invoice_postgres psql -U invoice_user -d invoice_db
```

### مشکل در Prisma

```bash
# ری‌جنریت Prisma Client
docker compose exec web npx prisma generate

# اجرای migration
docker compose exec web npx prisma migrate deploy
```

## بکاپ و بازیابی

### بکاپ از دیتابیس

```bash
# بکاپ دستی
docker exec invoice_postgres pg_dump -U invoice_user invoice_db > backup_$(date +%Y%m%d).sql

# بکاپ از طریق رابط برنامه
# وارد برنامه شوید و از منوی Backup استفاده کنید
```

### بازیابی دیتابیس

```bash
# بازیابی از فایل SQL
docker exec -i invoice_postgres psql -U invoice_user invoice_db < backup_20251124.sql

# بازیابی از طریق رابط برنامه
# وارد برنامه شوید و فایل .enc را restore کنید
```

## امنیت

### تغییر رمزهای پیش‌فرض

1. رمز دیتابیس در `docker-compose.yml`
2. مقدار `NEXTAUTH_SECRET` در `docker-compose.yml`
3. رمز کاربر admin بعد از اولین ورود

### فایروال

```bash
# فقط پورت 3000 را باز کنید
sudo ufw allow 3000/tcp
sudo ufw enable
```

## اطلاعات ورود پیش‌فرض

- **نام کاربری**: admin
- **رمز عبور**: admin123

⚠️ **مهم**: حتماً بعد از اولین ورود، رمز عبور را تغییر دهید!

## پشتیبانی

در صورت بروز مشکل، لاگ‌ها را بررسی کنید:

```bash
# لاگ سیستمی
sudo journalctl -u invoice-app -n 100

# لاگ Docker
docker compose logs --tail=100

# لاگ برنامه
docker compose logs web --tail=100

# لاگ دیتابیس
docker compose logs postgres --tail=100
```
