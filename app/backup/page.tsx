'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { useToast } from '@/components/ui/toast-provider';
import { LoadingButton } from '@/components/ui/loading-button';
import { Download, Upload, AlertTriangle, Database } from 'lucide-react';
import CryptoJS from 'crypto-js';

// پسورد ثابت برای رمزنگاری/رمزگشایی
const BACKUP_PASSWORD = 'admin123';

export default function BackupPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const toast = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [clearExisting, setClearExisting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const exportMutation = trpc.backup.exportDatabase.useMutation({
    onSuccess: (data: any) => {
      // رمزنگاری JSON با پسورد ثابت
      const jsonString = JSON.stringify(data.backup, null, 2);
      const encrypted = CryptoJS.AES.encrypt(jsonString, BACKUP_PASSWORD).toString();
      
      // Download the encrypted backup file
      const blob = new Blob([encrypted], {
        type: 'application/octet-stream',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = data.filename.replace('.json', '.enc');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('بکاپ رمزنگاری شده با موفقیت ایجاد و دانلود شد');
    },
    onError: (error: any) => {
      toast.error('خطا در ایجاد بکاپ', error.message);
    },
  });

  const importMutation = trpc.backup.importDatabase.useMutation({
    onSuccess: (data: any) => {
      toast.success(
        `بازیابی موفق: ${data.results.customers} مشتری، ${data.results.documents} سند، ${data.results.documentItems} آیتم`
      );
      setSelectedFile(null);
      setIsImporting(false);
    },
    onError: (error: any) => {
      toast.error('خطا در بازیابی بکاپ', error.message);
      setIsImporting(false);
    },
  });

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-xl">در حال بارگذاری...</div>
      </div>
    );
  }

  if (!session) {
    router.push('/login');
    return null;
  }

  // همه کاربران می‌توانند به این صفحه دسترسی داشته باشند

  const handleExport = () => {
    exportMutation.mutate();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // قبول فایل‌های .enc (رمزنگاری شده) و .json
      setSelectedFile(file);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) {
      toast.error('لطفا یک فایل انتخاب کنید');
      return;
    }

    const confirmMessage = clearExisting
      ? '⚠️ هشدار: با این کار تمام داده‌های موجود حذف شده و با داده‌های بکاپ جایگزین می‌شوند. آیا مطمئن هستید؟'
      : 'داده‌های بکاپ وارد سیستم می‌شوند. آیا ادامه می‌دهید؟';

    if (!confirm(confirmMessage)) {
      return;
    }

    setIsImporting(true);

    try {
      const text = await selectedFile.text();
      
      // تلاش برای رمزگشایی
      let backup;
      try {
        const decrypted = CryptoJS.AES.decrypt(text, BACKUP_PASSWORD);
        const decryptedText = decrypted.toString(CryptoJS.enc.Utf8);
        
        if (!decryptedText) {
          throw new Error('رمزگشایی ناموفق - فایل معتبر نیست');
        }
        
        backup = JSON.parse(decryptedText);
      } catch (decryptError) {
        // اگر رمزگشایی ناموفق بود، شاید فایل رمزنگاری نشده باشه
        try {
          backup = JSON.parse(text);
        } catch {
          throw new Error('فایل بکاپ معتبر نیست یا رمز اشتباه است');
        }
      }

      if (!backup.data) {
        throw new Error('فرمت فایل بکاپ نامعتبر است');
      }

      importMutation.mutate({
        data: backup.data,
        clearExisting,
      });
    } catch (error) {
      toast.error('خطا در خواندن فایل بکاپ', (error as Error).message);
      setIsImporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="text-gray-500 hover:text-gray-700">
                ← بازگشت
              </Link>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <Database className="h-8 w-8" />
                بکاپ و بازیابی
              </h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-6">
          {/* Export Section */}
          <div className="bg-white shadow sm:rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <Download className="h-6 w-6 text-blue-600" />
              <h2 className="text-xl font-bold text-gray-900">ایجاد بکاپ</h2>
            </div>
            <p className="text-gray-600 mb-4">
              با استفاده از این گزینه، یک فایل JSON شامل تمام داده‌های سیستم (مشتریان، اسناد، و
              آیتم‌ها) ایجاد و دانلود می‌شود.
            </p>
            <LoadingButton
              onClick={handleExport}
              isLoading={exportMutation.isPending}
              variant="primary"
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              ایجاد و دانلود بکاپ
            </LoadingButton>
          </div>

          {/* Import Section - فقط برای مدیر */}
          {session.user.role === 'ADMIN' && (
            <div className="bg-white shadow sm:rounded-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <Upload className="h-6 w-6 text-green-600" />
                <h2 className="text-xl font-bold text-gray-900">بازیابی از بکاپ</h2>
              </div>
              <p className="text-gray-600 mb-4">
                فایل بکاپ (JSON) خود را انتخاب کنید تا داده‌ها بازیابی شوند.
              </p>

            {/* Warning */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-yellow-800">
                  <p className="font-medium mb-1">توجه:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>قبل از بازیابی، حتما از داده‌های فعلی خود بکاپ بگیرید</li>
                    <li>فقط فایل‌های بکاپ معتبر (JSON) قابل بازیابی هستند</li>
                    <li>در صورت فعال کردن "حذف داده‌های موجود"، تمام داده‌ها پاک می‌شوند</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* File Input */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                انتخاب فایل بکاپ:
              </label>
              <input
                type="file"
                accept=".enc,.json"
                onChange={handleFileSelect}
                className="block w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-lg file:border-0
                  file:text-sm file:font-medium
                  file:bg-blue-50 file:text-blue-700
                  hover:file:bg-blue-100
                  cursor-pointer"
              />
              {selectedFile && (
                <p className="mt-2 text-sm text-gray-600">
                  فایل انتخاب شده: <span className="font-medium">{selectedFile.name}</span>
                </p>
              )}
            </div>

            {/* Clear Existing Option */}
            <div className="mb-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={clearExisting}
                  onChange={(e) => setClearExisting(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                />
                <span className="text-sm text-gray-700">
                  حذف تمام داده‌های موجود قبل از بازیابی{' '}
                  <span className="text-red-600 font-medium">(خطرناک!)</span>
                </span>
              </label>
            </div>

              {/* Import Button */}
              <LoadingButton
                onClick={handleImport}
                isLoading={isImporting || importMutation.isPending}
                variant="primary"
                className="flex items-center gap-2"
                disabled={!selectedFile}
              >
                <Upload className="h-4 w-4" />
                بازیابی از بکاپ
              </LoadingButton>
            </div>
          )}

          {/* Info Section */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-medium text-blue-900 mb-2">نکات مهم:</h3>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li>بکاپ‌های منظم از داده‌های خود تهیه کنید</li>
              <li>فایل‌های بکاپ را در مکان امن ذخیره کنید</li>
              <li>قبل از هر بروزرسانی مهم، حتما بکاپ بگیرید</li>
              <li>همه کاربران می‌توانند بکاپ بگیرند، اما فقط مدیر می‌تواند بازگردانی (restore) انجام دهد</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}
