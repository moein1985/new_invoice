# راهنمای به‌روزرسانی و مدیریت داده‌ها

## نصب بکاپ اتوماتیک

برای فعال‌سازی بکاپ خودکار روزانه:

```bash
cd ~/new_invoice
chmod +x setup-backup-cron.sh
sudo ./setup-backup-cron.sh
```

این کار:
- هر شب ساعت ۲ صبح بکاپ میگیره
- بکاپ‌ها رو فشرده می‌کنه
- بکاپ‌های قدیمی‌تر از ۳۰ روز رو حذف می‌کنه

## سناریوهای به‌روزرسانی

### ۱. تغییرات ساده (فقط کد UI/منطق)

```bash
cd ~/new_invoice

# بکاپ امنیتی (اختیاری)
./backup-database.sh

# به‌روزرسانی
git pull
docker compose build
docker compose up -d

# بررسی لاگ‌ها
docker compose logs -f
```

**مدت زمان**: ۲-۵ دقیقه  
**توقف سرویس**: کمتر از ۱۰ ثانیه  
**خطر از دست رفتن داده**: هیچ

---

### ۲. تغییرات دیتابیس (migration جدید)

```bash
cd ~/new_invoice

# 1. بکاپ قبل از به‌روزرسانی (اجباری)
./backup-database.sh

# 2. به‌روزرسانی کد
git pull

# 3. بررسی migration های جدید
ls prisma/migrations/

# 4. Build و اجرا
docker compose build
docker compose up -d

# 5. بررسی لاگ‌ها - migration ها خودکار اجرا میشن
docker compose logs -f web

# 6. تست برنامه
```

**مدت زمان**: ۵-۱۰ دقیقه  
**توقف سرویس**: ۳۰-۶۰ ثانیه  
**خطر از دست رفتن داده**: خیلی کم (با بکاپ)

---

### ۳. تغییرات major (تغییرات بزرگ schema)

```bash
cd ~/new_invoice

# 1. اطلاع‌رسانی به کاربران
echo "سیستم ساعت XX برای به‌روزرسانی متوقف می‌شود"

# 2. بکاپ کامل
./backup-database.sh

# یا بکاپ دستی:
docker exec invoice_postgres pg_dump -U invoice_user invoice_db > backup_manual_$(date +%Y%m%d_%H%M%S).sql

# 3. توقف سرویس
docker compose down

# 4. به‌روزرسانی
git pull

# 5. Build کامل
docker compose build --no-cache

# 6. اجرا
docker compose up -d

# 7. بررسی لاگ‌ها
docker compose logs -f

# 8. تست کامل برنامه
```

**مدت زمان**: ۱۰-۲۰ دقیقه  
**توقف سرویس**: ۵-۱۰ دقیقه  
**خطر از دست رفتن داده**: هیچ (با بکاپ)

---

## بکاپ و بازیابی

### بکاپ دستی

```bash
# بکاپ ساده
./backup-database.sh

# یا بکاپ با نام دلخواه
docker exec invoice_postgres pg_dump -U invoice_user invoice_db > my_backup.sql
gzip my_backup.sql
```

### مشاهده بکاپ‌ها

```bash
ls -lh ~/new_invoice/backups/db/
```

### بازیابی از بکاپ

```bash
# بازیابی (با تایید)
./restore-database.sh ~/new_invoice/backups/db/backup_20251124_020000.sql.gz

# یا بازیابی دستی
docker compose stop web
gunzip -c backup.sql.gz | docker exec -i invoice_postgres psql -U invoice_user invoice_db
docker compose start web
```

---

## استراتژی Zero-Downtime (پیشرفته)

برای سازمان‌های بزرگ که نمی‌توانند توقف داشته باشند:

### راه‌حل ۱: Blue-Green Deployment

```bash
# سرور دوم (Green) راه‌اندازی کنید
# بکاپ از دیتابیس اصلی بگیرید
# به سرور جدید restore کنید
# تست کامل انجام دهید
# ترافیک را به سرور جدید منتقل کنید
```

### راه‌حل ۲: PostgreSQL Replication

برای high-availability:
- Primary-Replica setup
- Automatic failover
- Zero data loss

---

## بکاپ از طریق رابط برنامه

کاربران می‌توانند از منوی **Backup** در برنامه:

1. **دانلود بکاپ**: فایل `.enc` دریافت کنند (رمزنگاری شده)
2. **بازیابی**: فایل `.enc` را آپلود کنند (فقط ADMIN)

**مزیت**: شامل تمام داده‌های کاربری  
**رمز عبور**: `admin123`

---

## Rollback (بازگشت به نسخه قبل)

اگر به‌روزرسانی مشکل داشت:

```bash
cd ~/new_invoice

# 1. بازگشت کد به نسخه قبل
git log --oneline
git reset --hard <commit-hash-قبلی>

# 2. بازیابی دیتابیس
./restore-database.sh ~/new_invoice/backups/db/safety_backup_*.sql.gz

# 3. Build و اجرا
docker compose build
docker compose up -d
```

---

## نکات امنیتی

### ۱. محافظت از بکاپ‌ها

```bash
# رمزنگاری بکاپ
docker exec invoice_postgres pg_dump -U invoice_user invoice_db | gzip | openssl enc -aes-256-cbc -salt -pbkdf2 -out backup_encrypted.sql.gz.enc

# رمزگشایی
openssl enc -aes-256-cbc -d -pbkdf2 -in backup_encrypted.sql.gz.enc | gunzip | docker exec -i invoice_postgres psql -U invoice_user invoice_db
```

### ۲. بکاپ خارج از سرور

```bash
# انتقال به سرور دیگر
scp ~/new_invoice/backups/db/backup_*.sql.gz user@backup-server:/backups/

# یا آپلود به cloud
# AWS S3, Google Drive, Dropbox, etc.
```

### ۳. تست بازیابی

**مهم**: حتماً هر ۳ ماه یکبار بکاپ‌ها رو تست کنید:

```bash
# محیط تست ایجاد کنید
docker run -d --name test-postgres -e POSTGRES_PASSWORD=test postgres:16-alpine

# بکاپ را restore کنید
gunzip -c backup.sql.gz | docker exec -i test-postgres psql -U postgres

# پاک‌سازی
docker rm -f test-postgres
```

---

## مانیتورینگ

### بررسی فضای دیسک

```bash
df -h
du -sh ~/new_invoice/backups/
```

### بررسی لاگ بکاپ

```bash
tail -f ~/new_invoice/backups/backup.log
```

### بررسی cron jobs

```bash
crontab -l
```

---

## چک‌لیست قبل از به‌روزرسانی

- [ ] بکاپ گرفته شد
- [ ] لاگ‌های فعلی بررسی شد
- [ ] فضای دیسک کافی است
- [ ] کاربران مطلع شدند
- [ ] زمان مناسب انتخاب شد (شب یا تعطیلات)
- [ ] راهنمای rollback آماده است

---

## پشتیبانی و عیب‌یابی

### مشکل: Migration fail شد

```bash
# بررسی لاگ
docker compose logs web

# Rollback دستی
docker exec invoice_postgres psql -U invoice_user invoice_db
# در psql:
# SELECT * FROM "_prisma_migrations" ORDER BY finished_at DESC LIMIT 5;
```

### مشکل: دیتابیس corrupt شد

```bash
# بازیابی از آخرین بکاپ
./restore-database.sh ~/new_invoice/backups/db/backup_<latest>.sql.gz
```

### مشکل: فضای دیسک تمام شد

```bash
# حذف بکاپ‌های قدیمی
find ~/new_invoice/backups/db/ -name "backup_*.sql.gz" -mtime +7 -delete

# حذف docker images قدیمی
docker image prune -a
```

---

## خلاصه دستورات مهم

```bash
# بکاپ دستی
./backup-database.sh

# بازیابی
./restore-database.sh /path/to/backup.sql.gz

# به‌روزرسانی ساده
git pull && docker compose build && docker compose up -d

# به‌روزرسانی کامل
git pull && docker compose down && docker compose build --no-cache && docker compose up -d

# مشاهده لاگ‌ها
docker compose logs -f

# Rollback
git reset --hard <commit> && docker compose build && docker compose up -d
```
