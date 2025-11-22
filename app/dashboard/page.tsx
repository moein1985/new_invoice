'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

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
              داشبورد
            </h1>
            <div className="flex items-center gap-4">
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
        </div>

        {/* Welcome Message */}
        <div className="mt-8 rounded-lg bg-blue-50 p-6">
          <h3 className="text-lg font-semibold text-blue-900">
            خوش آمدید! 👋
          </h3>
          <p className="mt-2 text-blue-700">
            سیستم مدیریت فاکتور با موفقیت راه‌اندازی شد. از منوی بالا می‌توانید به بخش‌های مختلف دسترسی داشته باشید.
          </p>
        </div>
      </main>
    </div>
  );
}
