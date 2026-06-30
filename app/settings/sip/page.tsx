'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { useToast } from '@/components/ui/toast-provider';
import { LoadingButton } from '@/components/ui/loading-button';
import { PageSkeleton } from '@/components/ui/skeleton';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { Phone, Save, TestTube, Eye, EyeOff, PhoneCall, Server } from 'lucide-react';

export default function SipSettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const toast = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [showAmiSecret, setShowAmiSecret] = useState(false);

  const isManager = session?.user?.role === 'ADMIN' || session?.user?.role === 'MANAGER';

  // User SIP settings form
  const [form, setForm] = useState({
    sipServer: '',
    sipPort: 8089,
    sipUsername: '',
    sipPassword: '',
    sipExtension: '',
    sipEnabled: false,
    sipTransport: 'ws' as 'ws' | 'wss',
    physicalExtension: '',
    trunkPrefix: '',
  });

  // AMI settings form (global, admin only)
  const [amiForm, setAmiForm] = useState({
    amiHost: '',
    amiPort: 5038,
    amiUsername: '',
    amiSecret: '',
  });

  const { data: settings, isLoading } = trpc.user.getSipSettings.useQuery(undefined, {
    enabled: !!session,
  });

  const { data: amiSettings, isLoading: amiLoading } = trpc.systemSettings.getAmiSettings.useQuery(undefined, {
    enabled: !!session && isManager,
  });

  const updateMutation = trpc.user.updateSipSettings.useMutation({
    onSuccess: () => {
      toast.success('تنظیمات SIP با موفقیت ذخیره شد');
    },
    onError: (error) => {
      toast.error('خطا در ذخیره تنظیمات', error.message);
    },
  });

  const updateAmiMutation = trpc.systemSettings.updateAmiSettings.useMutation({
    onSuccess: () => {
      toast.success('تنظیمات AMI با موفقیت ذخیره شد');
    },
    onError: (error) => {
      toast.error('خطا در ذخیره تنظیمات AMI', error.message);
    },
  });

  useEffect(() => {
    if (settings) {
      setForm({
        sipServer: settings.sipServer || '',
        sipPort: settings.sipPort || 8089,
        sipUsername: settings.sipUsername || '',
        sipPassword: settings.sipPassword || '',
        sipExtension: settings.sipExtension || '',
        sipEnabled: settings.sipEnabled || false,
        sipTransport: (settings.sipTransport as 'ws' | 'wss') || 'ws',
        physicalExtension: settings.physicalExtension || '',
        trunkPrefix: settings.trunkPrefix || '',
      });
    }
  }, [settings]);

  useEffect(() => {
    if (amiSettings && 'amiHost' in amiSettings) {
      setAmiForm({
        amiHost: amiSettings.amiHost || '',
        amiPort: amiSettings.amiPort || 5038,
        amiUsername: amiSettings.amiUsername || '',
        amiSecret: amiSettings.amiSecret || '',
      });
    }
  }, [amiSettings]);

  if (status === 'loading' || isLoading) {
    return <PageSkeleton />;
  }

  if (!session) {
    router.push('/login');
    return null;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({
      sipServer: form.sipServer || null,
      sipPort: form.sipPort || null,
      sipUsername: form.sipUsername || null,
      sipPassword: form.sipPassword || null,
      sipExtension: form.sipExtension || null,
      sipEnabled: form.sipEnabled,
      sipTransport: form.sipTransport || null,
      physicalExtension: form.physicalExtension || null,
      trunkPrefix: form.trunkPrefix || null,
    });
  };

  const handleAmiSubmit = () => {
    updateAmiMutation.mutate({
      amiHost: amiForm.amiHost || null,
      amiPort: amiForm.amiPort || null,
      amiUsername: amiForm.amiUsername || null,
      amiSecret: amiForm.amiSecret || null,
    });
  };

  const handleTestConnection = () => {
    if (!form.sipServer || !form.sipUsername || !form.sipPassword) {
      toast.warning('لطفاً ابتدا آدرس سرور، نام کاربری و رمز عبور را وارد کنید');
      return;
    }
    toast.info('تست اتصال در نسخه‌های بعدی اضافه خواهد شد');
  };

  const [isTestingAmi, setIsTestingAmi] = useState(false);
  const utils = trpc.useUtils();

  const handleTestAmi = async () => {
    if (!amiForm.amiHost || !amiForm.amiUsername || !amiForm.amiSecret) {
      toast.warning('لطفاً ابتدا تنظیمات AMI را ذخیره کنید');
      return;
    }
    setIsTestingAmi(true);
    try {
      // Save first, then test
      await updateAmiMutation.mutateAsync({
        amiHost: amiForm.amiHost || null,
        amiPort: amiForm.amiPort || null,
        amiUsername: amiForm.amiUsername || null,
        amiSecret: amiForm.amiSecret || null,
      });
      // Now test
      const result = await utils.ami.testConnection.fetch();
      if (result?.success) {
        toast.success(result.message);
      } else {
        toast.error('خطا', result?.message || 'خطا در تست اتصال');
      }
    } catch (err: any) {
      toast.error('خطا', err?.message || 'خطا در تست اتصال AMI');
    } finally {
      setIsTestingAmi(false);
    }
  };

  return (
    <div className="p-4 lg:p-8">
      <Breadcrumb
        items={[
          { label: 'داشبورد', href: '/dashboard' },
          { label: 'تنظیمات SIP' },
        ]}
      />

      <div className="mt-6 max-w-2xl">
        {/* SIP Section Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
            <Phone size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800">تنظیمات SIP/CTI</h1>
            <p className="text-sm text-gray-500">
              اتصال به مرکز تلفن برای شناسایی تماس‌های ورودی
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Enable/Disable */}
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="text-sm font-medium text-gray-800">فعال‌سازی SIP</span>
                <p className="text-xs text-gray-500 mt-1">
                  با فعال کردن، مرورگر شما به مرکز تلفن متصل می‌شود
                </p>
              </div>
              <div className="relative">
                <input
                  type="checkbox"
                  checked={form.sipEnabled}
                  onChange={(e) => setForm({ ...form, sipEnabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="h-6 w-11 rounded-full bg-gray-300 peer-checked:bg-blue-600 transition-colors"></div>
                <div className="absolute top-0.5 right-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:-translate-x-5"></div>
              </div>
            </label>
          </div>

          {/* Server Settings */}
          <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">تنظیمات سرور</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  آدرس سرور PBX
                </label>
                <input
                  type="text"
                  value={form.sipServer}
                  onChange={(e) => setForm({ ...form, sipServer: e.target.value })}
                  placeholder="192.168.1.100"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  پورت WebSocket
                </label>
                <input
                  type="number"
                  value={form.sipPort}
                  onChange={(e) => setForm({ ...form, sipPort: parseInt(e.target.value) || 8089 })}
                  placeholder="8089"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  dir="ltr"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                نوع اتصال
              </label>
              <select
                value={form.sipTransport}
                onChange={(e) => setForm({ ...form, sipTransport: e.target.value as 'ws' | 'wss' })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="ws">WS (بدون رمزنگاری)</option>
                <option value="wss">WSS (با رمزنگاری SSL)</option>
              </select>
            </div>
          </div>

          {/* Account Settings */}
          <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">اطلاعات حساب SIP</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  نام کاربری SIP
                </label>
                <input
                  type="text"
                  value={form.sipUsername}
                  onChange={(e) => setForm({ ...form, sipUsername: e.target.value })}
                  placeholder="201"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  رمز عبور SIP
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={form.sipPassword}
                    onChange={(e) => setForm({ ...form, sipPassword: e.target.value })}
                    placeholder="••••••••"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 pl-10 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                شماره داخلی SIP
              </label>
              <input
                type="text"
                value={form.sipExtension}
                onChange={(e) => setForm({ ...form, sipExtension: e.target.value })}
                placeholder="201"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 max-w-xs"
                dir="ltr"
              />
              <p className="text-xs text-gray-500 mt-1">
                داخلی وب (WebRTC) برای مانیتور تماس‌های ورودی
              </p>
            </div>
          </div>

          {/* SIP Info */}
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <h3 className="text-sm font-semibold text-amber-800 mb-2">راهنمای تنظیمات SIP</h3>
            <ul className="text-xs text-amber-700 space-y-1 list-disc list-inside">
              <li>WebSocket باید در Issabel/Asterisk فعال باشد (<code dir="ltr">http.conf</code>)</li>
              <li>یک داخلی مجزا برای اتصال وب ایجاد کنید (مثلاً 201)</li>
              <li>transport باید <code dir="ltr">ws</code> یا <code dir="ltr">wss</code> باشد</li>
              <li>پورت پیش‌فرض WebSocket: 8089 (wss) یا 8088 (ws)</li>
            </ul>
          </div>

          {/* Outgoing Call Settings */}
          <div className="border-t border-gray-300 my-6"></div>

          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-green-600">
              <PhoneCall size={22} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-800">تنظیمات تماس خروجی</h2>
              <p className="text-sm text-gray-500">
                برای برقراری تماس از طریق مخاطبین
              </p>
            </div>
          </div>

          {/* Physical Extension */}
          <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">داخلی فیزیکی</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  شماره داخلی تلفن فیزیکی
                </label>
                <input
                  type="text"
                  value={form.physicalExtension}
                  onChange={(e) => setForm({ ...form, physicalExtension: e.target.value })}
                  placeholder="101"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  dir="ltr"
                />
                <p className="text-xs text-gray-500 mt-1">
                  داخلی تلفن روی میز شما. هنگام click-to-call ابتدا این داخلی زنگ می‌خورد.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  پیش‌شماره خط شهری
                </label>
                <input
                  type="text"
                  value={form.trunkPrefix}
                  onChange={(e) => setForm({ ...form, trunkPrefix: e.target.value })}
                  placeholder="9"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  dir="ltr"
                />
                <p className="text-xs text-gray-500 mt-1">
                  پیش‌شماره‌ای که سیستم تلفنی برای دسترسی به خطوط شهری نیاز دارد (مثلاً 9 یا 0). اگر خالی باشد، بدون پیش‌شماره شماره‌گیری می‌شود.
                </p>
              </div>
            </div>
          </div>

          {/* Outgoing Info */}
          <div className="rounded-lg border border-green-200 bg-green-50 p-4">
            <h3 className="text-sm font-semibold text-green-800 mb-2">راهنمای تماس خروجی</h3>
            <ul className="text-xs text-green-700 space-y-1 list-disc list-inside">
              <li><strong>داخلی فیزیکی:</strong> شماره تلفن روی میز شما (مثلاً 101). هنگام تماس خروجی ابتدا این تلفن زنگ می‌خورد.</li>
              <li><strong>پیش‌شماره:</strong> اگر سیستم تلفنی شما برای تماس شهری به پیش‌شماره نیاز دارد (مثلاً 9)، آن را وارد کنید.</li>
              <li>مثال: با پیش‌شماره 9، شماره 03133333333 بصورت 903133333333 شماره‌گیری می‌شود.</li>
            </ul>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <LoadingButton
              type="submit"
              isLoading={updateMutation.isPending}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              <Save size={18} />
              ذخیره تنظیمات
            </LoadingButton>

            <button
              type="button"
              onClick={handleTestConnection}
              className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <TestTube size={18} />
              تست اتصال SIP
            </button>
          </div>
        </form>

        {/* AMI Settings - Manager/Admin only */}
        {isManager && (
          <>
            <div className="border-t border-gray-300 my-8"></div>

            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 text-purple-600">
                <Server size={22} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-800">تنظیمات AMI <span className="text-xs font-normal text-purple-600 bg-purple-100 px-2 py-0.5 rounded-full mr-2">مدیر</span></h2>
                <p className="text-sm text-gray-500">
                  تنظیمات رابط مدیریت Asterisk — برای همه کاربران اعمال می‌شود
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    آدرس سرور AMI
                  </label>
                  <input
                    type="text"
                    value={amiForm.amiHost}
                    onChange={(e) => setAmiForm({ ...amiForm, amiHost: e.target.value })}
                    placeholder="192.168.85.89"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    پورت AMI
                  </label>
                  <input
                    type="number"
                    value={amiForm.amiPort}
                    onChange={(e) => setAmiForm({ ...amiForm, amiPort: parseInt(e.target.value) || 5038 })}
                    placeholder="5038"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    نام کاربری AMI
                  </label>
                  <input
                    type="text"
                    value={amiForm.amiUsername}
                    onChange={(e) => setAmiForm({ ...amiForm, amiUsername: e.target.value })}
                    placeholder="invoice-app"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    رمز AMI
                  </label>
                  <div className="relative">
                    <input
                      type={showAmiSecret ? 'text' : 'password'}
                      value={amiForm.amiSecret}
                      onChange={(e) => setAmiForm({ ...amiForm, amiSecret: e.target.value })}
                      placeholder="••••••••"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 pl-10 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      dir="ltr"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAmiSecret(!showAmiSecret)}
                      className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showAmiSecret ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-purple-200 bg-purple-50 p-4 mt-4">
              <h3 className="text-sm font-semibold text-purple-800 mb-2">راهنمای AMI</h3>
              <ul className="text-xs text-purple-700 space-y-1 list-disc list-inside">
                <li>این تنظیمات برای <strong>همه کاربران</strong> اعمال می‌شود</li>
                <li>AMI (Asterisk Manager Interface) امکان کنترل تماس‌ها را فراهم می‌کند</li>
                <li>پورت پیش‌فرض AMI: 5038</li>
                <li>اگر خالی بگذارید، از تنظیمات پیش‌فرض سرور استفاده می‌شود</li>
              </ul>
            </div>

            <div className="flex items-center gap-3 mt-4">
              <LoadingButton
                type="button"
                onClick={handleAmiSubmit}
                isLoading={updateAmiMutation.isPending}
                className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-purple-700 transition-colors"
              >
                <Save size={18} />
                ذخیره تنظیمات AMI
              </LoadingButton>

              <button
                type="button"
                onClick={handleTestAmi}
                disabled={isTestingAmi}
                className="flex items-center gap-2 rounded-lg border border-purple-300 px-4 py-2.5 text-sm font-medium text-purple-700 hover:bg-purple-50 transition-colors disabled:opacity-50"
              >
                <TestTube size={18} />
                {isTestingAmi ? 'در حال تست...' : 'تست اتصال AMI'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
