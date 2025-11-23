'use client';

import { useRouter, useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import moment from 'moment-jalaali';

const ROLES: Record<string, string> = {
  ADMIN: 'مدیر',
  MANAGER: 'مدیر میانی',
  USER: 'کاربر',
};

const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'bg-red-100 text-red-800 border-red-300',
  MANAGER: 'bg-blue-100 text-blue-800 border-blue-300',
  USER: 'bg-green-100 text-green-800 border-green-300',
};

export default function UserDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const { data: user, isLoading } = trpc.user.getById.useQuery(
    { id },
    { enabled: !!id }
  );

  const deleteMutation = trpc.user.delete.useMutation({
    onSuccess: () => {
      alert('کاربر با موفقیت حذف شد');
      router.push('/users');
    },
    onError: (error) => {
      alert(`خطا: ${error.message}`);
    },
  });

  if (status === 'loading' || isLoading) {
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

  // Only ADMIN can view user details
  if (session.user.role !== 'ADMIN') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-xl text-red-600">دسترسی غیرمجاز</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-xl text-red-600">کاربر یافت نشد</div>
      </div>
    );
  }

  const formatDate = (date: string | Date) => {
    return moment(date).format('jYYYY/jM/jD');
  };

  const handleDelete = () => {
    if (user.id === session.user.id) {
      alert('شما نمی‌توانید خودتان را حذف کنید');
      return;
    }
    if (confirm(`آیا از حذف کاربر "${user.fullName}" اطمینان دارید؟`)) {
      deleteMutation.mutate({ id });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl" style={{ fontFamily: 'Vazir, Tahoma, sans-serif' }}>
      {/* Header */}
      <header className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-3xl font-bold" style={{ color: '#1a1a1a' }}>
                جزئیات کاربر
              </h1>
              <Link href="/users" className="text-gray-500 hover:text-gray-700">
                بازگشت ←
              </Link>
            </div>
            <div className="flex gap-2">
              <Link
                href={`/users/edit/${id}`}
                className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
              >
                ✏️ ویرایش
              </Link>
              <button
                onClick={handleDelete}
                disabled={deleteMutation.isPending || user.id === session.user.id}
                className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleteMutation.isPending ? '⏳ در حال حذف...' : '🗑️ حذف'}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* User Info Card */}
          <div className="lg:col-span-1">
            <div className="overflow-hidden rounded-lg bg-white shadow">
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white">
                <div className="flex items-center gap-3">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white text-3xl">
                    {user.role === 'ADMIN' ? '👑' : user.role === 'MANAGER' ? '👔' : '👤'}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">{user.fullName}</h2>
                    <p className="text-blue-100">@{user.username}</p>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <p className="text-sm text-gray-500">نقش</p>
                  <span
                    className={`inline-block mt-1 rounded-full border-2 px-3 py-1 text-sm font-bold ${
                      ROLE_COLORS[user.role]
                    }`}
                  >
                    {ROLES[user.role]}
                  </span>
                </div>

                <div>
                  <p className="text-sm text-gray-500">وضعیت</p>
                  <span
                    className={`inline-block mt-1 rounded-full border-2 px-3 py-1 text-sm font-bold ${
                      user.isActive
                        ? 'bg-green-100 text-green-800 border-green-300'
                        : 'bg-red-100 text-red-800 border-red-300'
                    }`}
                  >
                    {user.isActive ? '✅ فعال' : '❌ غیرفعال'}
                  </span>
                </div>

                <div className="border-t pt-4">
                  <p className="text-sm text-gray-500">تاریخ ایجاد</p>
                  <p className="font-bold" style={{ color: '#2a2a2a' }}>
                    {formatDate(user.createdAt)}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-gray-500">آخرین بروزرسانی</p>
                  <p className="font-bold" style={{ color: '#2a2a2a' }}>
                    {formatDate(user.updatedAt)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Activity Stats */}
          <div className="lg:col-span-2">
            <div className="grid gap-6">
              {/* Stats Cards */}
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="overflow-hidden rounded-lg bg-white shadow">
                  <div className="bg-blue-50 p-4">
                    <div className="flex items-center gap-3">
                      <div className="text-4xl">📄</div>
                      <div>
                        <p className="text-sm text-gray-600">اسناد ایجاد شده</p>
                        <p className="text-3xl font-bold text-blue-600">
                          {(user as any)._count?.documents || 0}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="overflow-hidden rounded-lg bg-white shadow">
                  <div className="bg-purple-50 p-4">
                    <div className="flex items-center gap-3">
                      <div className="text-4xl">✅</div>
                      <div>
                        <p className="text-sm text-gray-600">تاییدیه‌های انجام شده</p>
                        <p className="text-3xl font-bold text-purple-600">
                          {(user as any)._count?.approvals || 0}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Permissions Card */}
              <div className="overflow-hidden rounded-lg bg-white shadow">
                <div className="bg-gray-50 border-b p-4">
                  <h3 className="text-lg font-bold" style={{ color: '#1a1a1a' }}>
                    دسترسی‌ها
                  </h3>
                </div>
                <div className="p-6">
                  <div className="space-y-3">
                    {user.role === 'ADMIN' && (
                      <>
                        <div className="flex items-center gap-2 text-green-600">
                          <span className="text-xl">✅</span>
                          <span className="font-bold">مدیریت کامل سیستم</span>
                        </div>
                        <div className="flex items-center gap-2 text-green-600">
                          <span className="text-xl">✅</span>
                          <span>مدیریت کاربران</span>
                        </div>
                        <div className="flex items-center gap-2 text-green-600">
                          <span className="text-xl">✅</span>
                          <span>تایید/رد اسناد</span>
                        </div>
                        <div className="flex items-center gap-2 text-green-600">
                          <span className="text-xl">✅</span>
                          <span>مشاهده گزارشات</span>
                        </div>
                      </>
                    )}
                    {user.role === 'MANAGER' && (
                      <>
                        <div className="flex items-center gap-2 text-blue-600">
                          <span className="text-xl">✅</span>
                          <span className="font-bold">تایید/رد اسناد</span>
                        </div>
                        <div className="flex items-center gap-2 text-blue-600">
                          <span className="text-xl">✅</span>
                          <span>مشاهده گزارشات</span>
                        </div>
                        <div className="flex items-center gap-2 text-blue-600">
                          <span className="text-xl">✅</span>
                          <span>ایجاد اسناد</span>
                        </div>
                        <div className="flex items-center gap-2 text-red-600">
                          <span className="text-xl">❌</span>
                          <span>مدیریت کاربران</span>
                        </div>
                      </>
                    )}
                    {user.role === 'USER' && (
                      <>
                        <div className="flex items-center gap-2 text-green-600">
                          <span className="text-xl">✅</span>
                          <span className="font-bold">ایجاد اسناد</span>
                        </div>
                        <div className="flex items-center gap-2 text-green-600">
                          <span className="text-xl">✅</span>
                          <span>مشاهده اسناد خود</span>
                        </div>
                        <div className="flex items-center gap-2 text-red-600">
                          <span className="text-xl">❌</span>
                          <span>تایید/رد اسناد</span>
                        </div>
                        <div className="flex items-center gap-2 text-red-600">
                          <span className="text-xl">❌</span>
                          <span>مدیریت کاربران</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Account Info */}
              <div className="overflow-hidden rounded-lg bg-white shadow">
                <div className="bg-gray-50 border-b p-4">
                  <h3 className="text-lg font-bold" style={{ color: '#1a1a1a' }}>
                    اطلاعات حساب
                  </h3>
                </div>
                <div className="p-6">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b pb-3">
                      <span className="text-gray-600">شناسه کاربری:</span>
                      <span className="font-mono text-sm" style={{ color: '#2a2a2a' }}>
                        {user.id}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-b pb-3">
                      <span className="text-gray-600">نام کاربری:</span>
                      <span className="font-bold" style={{ color: '#2a2a2a' }}>
                        {user.username}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-b pb-3">
                      <span className="text-gray-600">نام کامل:</span>
                      <span className="font-bold" style={{ color: '#2a2a2a' }}>
                        {user.fullName}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">وضعیت حساب:</span>
                      <span
                        className={`font-bold ${
                          user.isActive ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {user.isActive ? 'فعال' : 'غیرفعال'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
