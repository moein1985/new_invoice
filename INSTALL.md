# راهنمای نصب سریع روی Ubuntu

## پیش‌نیازها

Ubuntu 22.04 یا 24.04 با دسترسی root

## مرحله ۱: نصب Docker

```bash
# نصب Docker
curl -fsSL https://get.docker.com | sudo sh

# اضافه کردن کاربر به گروه docker
sudo usermod -aG docker $USER

# خروج و ورود مجدد برای اعمال تغییرات
exit
# دوباره SSH کنید
```

## مرحله ۲: دانلود برنامه

```bash
cd ~
git clone https://github.com/moein1985/new_invoice.git
cd new_invoice
```

## مرحله ۳: تنظیم آدرس سرور

```bash
# ویرایش docker-compose.yml
nano docker-compose.yml

# خط زیر را پیدا کنید و IP سرور خود را جایگزین کنید:
# NEXTAUTH_URL=http://YOUR_SERVER_IP:3000

# ذخیره: Ctrl+O, Enter, Ctrl+X
```

## مرحله ۴: اجرای برنامه

```bash
docker compose up -d --build
```

صبر کنید تا build تمام شود (حدود ۵ دقیقه).

## مرحله ۵: بررسی وضعیت

```bash
docker compose ps
docker compose logs -f
```

## مرحله ۶: فعال‌سازی اتوماتیک (بعد از ریبوت)

```bash
chmod +x setup-autostart.sh
sudo ./setup-autostart.sh
```

## دسترسی به برنامه

- آدرس: `http://YOUR_SERVER_IP:3000`
- نام کاربری: `admin`
- رمز عبور: `admin123`

⚠️ **مهم**: بعد از ورود، رمز عبور را تغییر دهید!

---

## دستورات مفید

```bash
# مشاهده وضعیت
docker compose ps

# مشاهده لاگ
docker compose logs -f

# ری‌استارت
docker compose restart

# توقف
docker compose stop

# شروع
docker compose start

# به‌روزرسانی
git pull && docker compose up -d --build
```

## بکاپ

```bash
# بکاپ دستی
chmod +x backup-database.sh
./backup-database.sh

# فعال‌سازی بکاپ روزانه
chmod +x setup-backup-cron.sh
sudo ./setup-backup-cron.sh
```

## عیب‌یابی

```bash
# بررسی لاگ‌ها
docker compose logs web
docker compose logs postgres

# ری‌استارت کامل
docker compose down
docker compose up -d
```
