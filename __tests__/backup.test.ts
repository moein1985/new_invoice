import CryptoJS from 'crypto-js';

// پسورد ثابت مانند صفحه بکاپ
const BACKUP_PASSWORD = 'admin123';

describe('Backup Encryption/Decryption', () => {
  describe('رمزنگاری و رمزگشایی', () => {
    it('باید JSON را رمزنگاری کند', () => {
      const testData = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        data: {
          customers: [
            { id: 1, name: 'مشتری تست', phone: '09123456789' },
          ],
          documents: [
            { id: 1, type: 'PROFORMA', status: 'APPROVED' },
          ],
        },
      };

      const jsonString = JSON.stringify(testData, null, 2);
      const encrypted = CryptoJS.AES.encrypt(jsonString, BACKUP_PASSWORD).toString();

      // فایل رمزنگاری شده باید متفاوت از JSON اصلی باشد
      expect(encrypted).not.toBe(jsonString);
      expect(encrypted).not.toContain('مشتری تست');
      expect(encrypted.length).toBeGreaterThan(0);
    });

    it('باید داده رمزنگاری شده را صحیح رمزگشایی کند', () => {
      const originalData = {
        version: '1.0',
        data: {
          customers: [
            { id: 1, name: 'علی احمدی', phone: '09121234567' },
            { id: 2, name: 'محمد رضایی', phone: '09129876543' },
          ],
          documents: [],
          users: [],
          documentItems: [],
        },
      };

      // رمزنگاری
      const jsonString = JSON.stringify(originalData);
      const encrypted = CryptoJS.AES.encrypt(jsonString, BACKUP_PASSWORD).toString();

      // رمزگشایی
      const decrypted = CryptoJS.AES.decrypt(encrypted, BACKUP_PASSWORD);
      const decryptedText = decrypted.toString(CryptoJS.enc.Utf8);
      const decryptedData = JSON.parse(decryptedText);

      // بررسی صحت داده‌ها
      expect(decryptedData).toEqual(originalData);
      expect(decryptedData.data.customers).toHaveLength(2);
      expect(decryptedData.data.customers[0].name).toBe('علی احمدی');
    });

    it('باید با پسورد اشتباه رمزگشایی نکند', () => {
      const testData = { test: 'data' };
      const jsonString = JSON.stringify(testData);
      const encrypted = CryptoJS.AES.encrypt(jsonString, BACKUP_PASSWORD).toString();

      // تلاش برای رمزگشایی با پسورد اشتباه
      const decrypted = CryptoJS.AES.decrypt(encrypted, 'wrong-password');
      const decryptedText = decrypted.toString(CryptoJS.enc.Utf8);

      // رمزگشایی باید ناموفق باشد
      expect(decryptedText).toBe('');
    });
  });

  describe('سازگاری با فرمت قدیمی', () => {
    it('باید فایل JSON غیررمزنگاری شده را نیز بپذیرد', () => {
      const plainData = {
        version: '1.0',
        data: {
          customers: [{ id: 1, name: 'تست' }],
          documents: [],
          users: [],
          documentItems: [],
        },
      };

      const jsonString = JSON.stringify(plainData);

      // تلاش برای رمزگشایی - باید fail شود
      let decryptedData;
      try {
        const decrypted = CryptoJS.AES.decrypt(jsonString, BACKUP_PASSWORD);
        const decryptedText = decrypted.toString(CryptoJS.enc.Utf8);
        
        if (!decryptedText) {
          throw new Error('رمزگشایی ناموفق');
        }
        
        decryptedData = JSON.parse(decryptedText);
      } catch {
        // اگر رمزگشایی ناموفق بود، مستقیم JSON پارس کن
        decryptedData = JSON.parse(jsonString);
      }

      // داده باید صحیح پارس شود
      expect(decryptedData).toEqual(plainData);
      expect(decryptedData.data.customers).toHaveLength(1);
    });
  });

  describe('تست داده‌های بزرگ', () => {
    it('باید داده‌های حجیم را رمزنگاری و رمزگشایی کند', () => {
      // ایجاد داده حجیم
      const largeData = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        data: {
          customers: Array.from({ length: 100 }, (_, i) => ({
            id: i + 1,
            name: `مشتری ${i + 1}`,
            phone: `0912345${String(i).padStart(4, '0')}`,
            projectName: `پروژه ${i + 1}`,
          })),
          documents: Array.from({ length: 200 }, (_, i) => ({
            id: i + 1,
            type: 'PROFORMA',
            status: 'APPROVED',
            totalAmount: 1000000 + i * 1000,
          })),
          users: Array.from({ length: 10 }, (_, i) => ({
            id: i + 1,
            username: `user${i + 1}`,
            fullName: `کاربر ${i + 1}`,
            role: 'USER',
          })),
          documentItems: Array.from({ length: 500 }, (_, i) => ({
            id: i + 1,
            description: `کالای ${i + 1}`,
            quantity: 10,
            unitPrice: 5000,
          })),
        },
      };

      const jsonString = JSON.stringify(largeData);
      const encrypted = CryptoJS.AES.encrypt(jsonString, BACKUP_PASSWORD).toString();

      // رمزگشایی
      const decrypted = CryptoJS.AES.decrypt(encrypted, BACKUP_PASSWORD);
      const decryptedText = decrypted.toString(CryptoJS.enc.Utf8);
      const decryptedData = JSON.parse(decryptedText);

      // بررسی صحت
      expect(decryptedData.data.customers).toHaveLength(100);
      expect(decryptedData.data.documents).toHaveLength(200);
      expect(decryptedData.data.users).toHaveLength(10);
      expect(decryptedData.data.documentItems).toHaveLength(500);
      expect(decryptedData.data.customers[99].name).toBe('مشتری 100');
    });
  });

  describe('تست کاراکترهای ویژه فارسی', () => {
    it('باید کاراکترهای فارسی را صحیح رمزنگاری/رمزگشایی کند', () => {
      const persianData = {
        version: '1.0',
        data: {
          customers: [
            {
              id: 1,
              name: 'شرکت پیشگامان صنعت آریا',
              phone: '۰۹۱۲۳۴۵۶۷۸۹',
              projectName: 'پروژه ساختمان‌سازی تهران - فاز ۱',
            },
            {
              id: 2,
              name: 'سازمان برنامه و بودجه',
              phone: '021-12345678',
              projectName: 'طرح توسعه زیرساخت‌های کشور',
            },
          ],
          documents: [],
          users: [],
          documentItems: [],
        },
      };

      const jsonString = JSON.stringify(persianData);
      const encrypted = CryptoJS.AES.encrypt(jsonString, BACKUP_PASSWORD).toString();

      const decrypted = CryptoJS.AES.decrypt(encrypted, BACKUP_PASSWORD);
      const decryptedText = decrypted.toString(CryptoJS.enc.Utf8);
      const decryptedData = JSON.parse(decryptedText);

      expect(decryptedData).toEqual(persianData);
      expect(decryptedData.data.customers[0].name).toBe('شرکت پیشگامان صنعت آریا');
      expect(decryptedData.data.customers[1].projectName).toBe('طرح توسعه زیرساخت‌های کشور');
    });
  });

  describe('تست ساختار فایل بکاپ', () => {
    it('باید ساختار صحیح بکاپ را داشته باشد', () => {
      const backupData = {
        version: '1.0',
        timestamp: '2025-11-24T08:00:00.000Z',
        data: {
          customers: [],
          documents: [],
          users: [],
          documentItems: [],
        },
      };

      expect(backupData).toHaveProperty('version');
      expect(backupData).toHaveProperty('timestamp');
      expect(backupData).toHaveProperty('data');
      expect(backupData.data).toHaveProperty('customers');
      expect(backupData.data).toHaveProperty('documents');
      expect(backupData.data).toHaveProperty('users');
      expect(backupData.data).toHaveProperty('documentItems');
    });

    it('باید version 1.0 باشد', () => {
      const backupData = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        data: {
          customers: [],
          documents: [],
          users: [],
          documentItems: [],
        },
      };

      expect(backupData.version).toBe('1.0');
    });
  });

  describe('تست امنیت', () => {
    it('فایل رمزنگاری شده نباید حاوی اطلاعات حساس به صورت plain text باشد', () => {
      const sensitiveData = {
        version: '1.0',
        data: {
          customers: [
            {
              id: 1,
              name: 'شرکت محرمانه',
              phone: '09123456789',
              projectName: 'پروژه سری',
            },
          ],
          documents: [],
          users: [
            {
              id: 1,
              username: 'admin',
              password: 'hashed_password_here',
              email: 'admin@example.com',
            },
          ],
          documentItems: [],
        },
      };

      const jsonString = JSON.stringify(sensitiveData);
      const encrypted = CryptoJS.AES.encrypt(jsonString, BACKUP_PASSWORD).toString();

      // بررسی که اطلاعات حساس در فایل رمزنگاری شده نیست
      expect(encrypted).not.toContain('شرکت محرمانه');
      expect(encrypted).not.toContain('09123456789');
      expect(encrypted).not.toContain('admin@example.com');
      expect(encrypted).not.toContain('hashed_password_here');
      expect(encrypted).not.toContain('پروژه سری');
    });

    it('فایل رمزنگاری شده باید Base64 باشد', () => {
      const testData = { test: 'data' };
      const jsonString = JSON.stringify(testData);
      const encrypted = CryptoJS.AES.encrypt(jsonString, BACKUP_PASSWORD).toString();

      // Base64 فقط شامل حروف، اعداد، + و / و = است
      const base64Regex = /^[A-Za-z0-9+/=]+$/;
      expect(base64Regex.test(encrypted)).toBe(true);
    });
  });

  describe('تست خطاها', () => {
    it('باید خطای JSON نامعتبر را مدیریت کند', () => {
      const invalidJson = 'این یک JSON معتبر نیست';

      expect(() => {
        const encrypted = CryptoJS.AES.encrypt(invalidJson, BACKUP_PASSWORD).toString();
        const decrypted = CryptoJS.AES.decrypt(encrypted, BACKUP_PASSWORD);
        const decryptedText = decrypted.toString(CryptoJS.enc.Utf8);
        JSON.parse(decryptedText);
      }).toThrow();
    });

    it('باید رشته خالی را مدیریت کند', () => {
      const emptyString = '';
      const encrypted = CryptoJS.AES.encrypt(emptyString, BACKUP_PASSWORD).toString();
      const decrypted = CryptoJS.AES.decrypt(encrypted, BACKUP_PASSWORD);
      const decryptedText = decrypted.toString(CryptoJS.enc.Utf8);

      expect(decryptedText).toBe('');
    });
  });

  describe('تست عملکرد کامل بکاپ و ریستور', () => {
    it('شبیه‌سازی کامل فرآیند بکاپ و ریستور', () => {
      // مرحله 1: ایجاد داده‌های نمونه
      const originalBackup = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        data: {
          customers: [
            { id: 1, name: 'مشتری اول', phone: '09121111111', projectName: 'پروژه A' },
            { id: 2, name: 'مشتری دوم', phone: '09122222222', projectName: 'پروژه B' },
          ],
          documents: [
            { id: 1, type: 'PROFORMA', status: 'APPROVED', customerId: 1, totalAmount: 5000000 },
            { id: 2, type: 'INVOICE', status: 'PENDING', customerId: 2, totalAmount: 3000000 },
          ],
          users: [
            { id: 1, username: 'admin', fullName: 'مدیر سیستم', role: 'ADMIN', email: 'admin@test.com' },
            { id: 2, username: 'user1', fullName: 'کاربر اول', role: 'USER', email: 'user1@test.com' },
          ],
          documentItems: [
            { id: 1, documentId: 1, description: 'کالای اول', quantity: 10, unitPrice: 500000 },
            { id: 2, documentId: 2, description: 'کالای دوم', quantity: 5, unitPrice: 600000 },
          ],
        },
      };

      // مرحله 2: رمزنگاری (مانند exportDatabase)
      const jsonString = JSON.stringify(originalBackup, null, 2);
      const encrypted = CryptoJS.AES.encrypt(jsonString, BACKUP_PASSWORD).toString();

      // مرحله 3: شبیه‌سازی ذخیره و بارگذاری فایل
      const fileContent = encrypted; // این همان محتوایی است که در فایل .enc ذخیره می‌شود

      // مرحله 4: رمزگشایی (مانند importDatabase)
      const decrypted = CryptoJS.AES.decrypt(fileContent, BACKUP_PASSWORD);
      const decryptedText = decrypted.toString(CryptoJS.enc.Utf8);
      const restoredBackup = JSON.parse(decryptedText);

      // مرحله 5: بررسی صحت بازگردانی
      expect(restoredBackup).toEqual(originalBackup);
      expect(restoredBackup.data.customers).toHaveLength(2);
      expect(restoredBackup.data.documents).toHaveLength(2);
      expect(restoredBackup.data.users).toHaveLength(2);
      expect(restoredBackup.data.documentItems).toHaveLength(2);

      // بررسی جزئیات
      expect(restoredBackup.data.customers[0].name).toBe('مشتری اول');
      expect(restoredBackup.data.documents[0].totalAmount).toBe(5000000);
      expect(restoredBackup.data.users[0].role).toBe('ADMIN');
      expect(restoredBackup.data.documentItems[1].quantity).toBe(5);
    });
  });
});
