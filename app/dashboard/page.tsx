'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { GlobalSearch } from '@/components/ui/global-search';
import { NotificationBell } from '@/components/ui/notification-bell';

const DOC_TYPES: Record<string, string> = {
  TEMP_PROFORMA: 'پیش‌فاکتور موقت',
  PROFORMA: 'پیش‌فاکتور',
  INVOICE: 'فاکتور',
  RETURN_INVOICE: 'فاکتور برگشتی',
  RECEIPT: 'رسید',
  OTHER: 'سایر',
};

const APPROVAL_STATUS: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'در انتظار', color: 'bg-yellow-100 text-yellow-800' },
  APPROVED: { label: 'تایید شده', color: 'bg-green-100 text-green-800' },
  REJECTED: { label: 'رد شده', color: 'bg-red-100 text-red-800' },
};

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  // Fetch dashboard stats
  const { data: stats, isLoading: statsLoading } = trpc.stats.getDashboardStats.useQuery();

  // عنوان چرخان در tab مرورگر
  useEffect(() => {
    if (!session?.user?.name) return;
    
    const title1 = 'سیستم مدیریت فاکتور';
    const title2 = `${session.user.name}`;
    let isFirst = true;
    
    const interval = setInterval(() => {
      document.title = isFirst ? title1 : title2;
      isFirst = !isFirst;
    }, 3000); // هر 3 ثانیه تغییر کند
    
    return () => {
      clearInterval(interval);
      document.title = 'سیستم مدیریت فاکتور';
    };
  }, [session]);

  console.log('Dashboard - Status:', status, 'Session:', session);

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-xl">در حال بارگذاری...</div>
      </div>
    );
  }

  if (!session) {
    console.log('No session found, redirecting to login');
    router.push('/login');
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-gray-900">
              داشبورد - خوش آمدید {session.user.name}
            </h1>
            <div className="flex items-center gap-4">
              <GlobalSearch />
              <NotificationBell />
              <ThemeToggle />
              <div className="text-sm">
                <p className="font-medium text-gray-900">{session.user.name}</p>
                <p className="text-gray-500">{session.user.role}</p>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700"
              >
                خروج
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* آمار کلی */}
        {statsLoading ? (
          <div className="mb-8 text-center text-gray-500">در حال بارگذاری آمار...</div>
        ) : stats ? (
          <div className="mb-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 p-6 text-white shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90">مشتریان</p>
                  <p className="mt-2 text-3xl font-bold">{stats.summary.totalCustomers}</p>
                </div>
                <div className="text-4xl opacity-80">👥</div>
              </div>
            </div>

            <div className="rounded-lg bg-gradient-to-br from-green-500 to-green-600 p-6 text-white shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90">اسناد</p>
                  <p className="mt-2 text-3xl font-bold">{stats.summary.totalDocuments}</p>
                </div>
                <div className="text-4xl opacity-80">📄</div>
              </div>
            </div>

            <div className="rounded-lg bg-gradient-to-br from-yellow-500 to-yellow-600 p-6 text-white shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90">در انتظار تایید</p>
                  <p className="mt-2 text-3xl font-bold">{stats.summary.pendingApprovals}</p>
                </div>
                <div className="text-4xl opacity-80">⏳</div>
              </div>
            </div>

            {stats.summary.totalUsers !== undefined && (
              <div className="rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 p-6 text-white shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm opacity-90">کاربران</p>
                    <p className="mt-2 text-3xl font-bold">{stats.summary.totalUsers}</p>
                  </div>
                  <div className="text-4xl opacity-80">⚙️</div>
                </div>
              </div>
            )}
          </div>
        ) : null}

        {/* منوهای اصلی */}
        <h2 className="mb-4 text-xl font-bold text-gray-900">دسترسی سریع</h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Customers Card */}
          <Link
            href="/customers"
            className="block rounded-lg bg-white p-6 shadow hover:shadow-lg transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  مشتریان
                </h2>
                <p className="mt-2 text-sm text-gray-600">
                  مدیریت اطلاعات مشتریان
                </p>
              </div>
              <div className="text-4xl">👥</div>
            </div>
          </Link>

          {/* Documents Card */}
          <Link
            href="/documents"
            className="block rounded-lg bg-white p-6 shadow hover:shadow-lg transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  اسناد
                </h2>
                <p className="mt-2 text-sm text-gray-600">
                  مدیریت فاکتورها و اسناد
                </p>
              </div>
              <div className="text-4xl">📄</div>
            </div>
          </Link>

          {/* Approvals Card */}
          {(session.user.role === 'ADMIN' || session.user.role === 'MANAGER') && (
            <Link
              href="/approvals"
              className="block rounded-lg bg-white p-6 shadow hover:shadow-lg transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    تاییدیه‌ها
                  </h2>
                  <p className="mt-2 text-sm text-gray-600">
                    تایید یا رد اسناد
                  </p>
                </div>
                <div className="text-4xl">✅</div>
              </div>
            </Link>
          )}

          {/* Users Card (Admin only) */}
          {session.user.role === 'ADMIN' && (
            <Link
              href="/users"
              className="block rounded-lg bg-white p-6 shadow hover:shadow-lg transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    کاربران
                  </h2>
                  <p className="mt-2 text-sm text-gray-600">
                    مدیریت کاربران سیستم
                  </p>
                </div>
                <div className="text-4xl">⚙️</div>
              </div>
            </Link>
          )}

          {/* Backup Card (Admin only) */}
          {session.user.role === 'ADMIN' && (
            <Link
              href="/backup"
              className="block rounded-lg bg-white p-6 shadow hover:shadow-lg transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    بکاپ و بازیابی
                  </h2>
                  <p className="mt-2 text-sm text-gray-600">
                    پشتیبان‌گیری و بازیابی داده‌ها
                  </p>
                </div>
                <div className="text-4xl">💾</div>
              </div>
            </Link>
          )}
        </div>

        {/* آخرین اسناد */}
        {stats && stats.recentDocuments.length > 0 && (
          <div className="mt-8">
            <h2 className="mb-4 text-xl font-bold text-gray-900">آخرین اسناد</h2>
            <div className="overflow-hidden rounded-lg bg-white shadow">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                      شماره سند
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                      نوع
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                      مشتری
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                      مبلغ
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                      وضعیت
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                      تاریخ
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {stats.recentDocuments.map((doc) => (
                    <tr key={doc.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                        <Link href={`/documents/${doc.id}`} className="text-blue-600 hover:text-blue-800">
                          {doc.documentNumber}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                        {DOC_TYPES[doc.documentType] || doc.documentType}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                        {doc.customerName}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                        {new Intl.NumberFormat('fa-IR').format(doc.finalAmount)} ریال
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm">
                        <span
                          className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                            APPROVAL_STATUS[doc.approvalStatus]?.color || 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {APPROVAL_STATUS[doc.approvalStatus]?.label || doc.approvalStatus}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                        {new Date(doc.issueDate).toLocaleDateString('fa-IR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* نمودار اسناد بر اساس نوع */}
        {stats && stats.charts.documentsByType.length > 0 && (
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <div className="rounded-lg bg-white p-6 shadow">
              <h3 className="mb-4 text-lg font-semibold text-gray-900">اسناد بر اساس نوع</h3>
              <div className="space-y-3">
                {stats.charts.documentsByType.map((item) => (
                  <div key={item.type}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="text-gray-700">{DOC_TYPES[item.type] || item.type}</span>
                      <span className="font-semibold text-gray-900">{item.count}</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                      <div
                        className="h-full bg-blue-600"
                        style={{
                          width: `${(item.count / stats.summary.totalDocuments) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg bg-white p-6 shadow">
              <h3 className="mb-4 text-lg font-semibold text-gray-900">اسناد بر اساس وضعیت</h3>
              <div className="space-y-3">
                {stats.charts.documentsByStatus.map((item) => (
                  <div key={item.status}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="text-gray-700">
                        {APPROVAL_STATUS[item.status]?.label || item.status}
                      </span>
                      <span className="font-semibold text-gray-900">{item.count}</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                      <div
                        className={`h-full ${
                          item.status === 'APPROVED'
                            ? 'bg-green-600'
                            : item.status === 'PENDING'
                            ? 'bg-yellow-600'
                            : 'bg-red-600'
                        }`}
                        style={{
                          width: `${(item.count / stats.summary.totalDocuments) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
