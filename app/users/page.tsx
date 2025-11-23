'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';

export default function UsersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const { data: users, isLoading, refetch } = trpc.user.list.useQuery(
    {},
    { enabled: !!session }
  );

  const createMutation = trpc.user.create.useMutation({
    onSuccess: () => {
      refetch();
      setIsModalOpen(false);
      setEditingUser(null);
      setToast({ message: 'کاربر با موفقیت اضافه شد', type: 'success' });
      setTimeout(() => setToast(null), 3000);
    },
    onError: (error) => {
      setToast({ message: error.message, type: 'error' });
      setTimeout(() => setToast(null), 5000);
    },
  });

  const updateMutation = trpc.user.update.useMutation({
    onSuccess: () => {
      refetch();
      setIsModalOpen(false);
      setEditingUser(null);
      setToast({ message: 'کاربر با موفقیت ویرایش شد', type: 'success' });
      setTimeout(() => setToast(null), 3000);
    },
    onError: (error) => {
      setToast({ message: error.message, type: 'error' });
      setTimeout(() => setToast(null), 5000);
    },
  });

  const deleteMutation = trpc.user.delete.useMutation({
    onSuccess: () => {
      refetch();
      setToast({ message: 'کاربر با موفقیت حذف شد', type: 'success' });
      setTimeout(() => setToast(null), 3000);
    },
    onError: (error) => {
      setToast({ message: error.message, type: 'error' });
      setTimeout(() => setToast(null), 5000);
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

  // Only admins can access
  if (session.user.role !== 'ADMIN') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-xl text-red-600">شما دسترسی به این صفحه ندارید</div>
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      username: formData.get('username') as string,
      fullName: formData.get('fullName') as string,
      email: formData.get('email') as string,
      phone: formData.get('phone') as string,
      password: formData.get('password') as string,
      role: formData.get('role') as 'ADMIN' | 'MANAGER' | 'USER',
    };

    if (editingUser) {
      updateMutation.mutate({
        id: editingUser.id,
        ...data,
        password: data.password || undefined,
      });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = (id: string, fullName: string) => {
    if (id === session.user.id) {
      setToast({ message: 'نمی‌توانید خودتان را حذف کنید', type: 'error' });
      setTimeout(() => setToast(null), 5000);
      return;
    }
    
    if (confirm(`آیا از حذف کاربر "${fullName}" اطمینان دارید؟`)) {
      deleteMutation.mutate({ id });
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
              <h1 className="text-3xl font-bold text-gray-900">مدیریت کاربران</h1>
            </div>
            <button
              onClick={() => {
                setEditingUser(null);
                setIsModalOpen(true);
              }}
              className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              کاربر جدید
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {isLoading ? (
          <div className="text-center">در حال بارگذاری...</div>
        ) : (
          <div className="overflow-hidden rounded-lg bg-white shadow">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    نام
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    نام کاربری
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    ایمیل
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    تلفن
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    نقش
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    عملیات
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {users?.data?.map((user: any) => (
                  <tr key={user.id}>
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                      {user.fullName}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {user.username}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {user.email || '-'}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {user.phone || '-'}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      <span className={`rounded-full px-2 py-1 text-xs ${
                        user.role === 'ADMIN'
                          ? 'bg-red-100 text-red-800'
                          : user.role === 'MANAGER'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {user.role === 'ADMIN' && 'مدیر'}
                        {user.role === 'MANAGER' && 'مدیر میانی'}
                        {user.role === 'USER' && 'کاربر'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium">
                      <Link
                        href={`/users/${user.id}`}
                        className="ml-4 text-green-600 hover:text-green-900"
                      >
                        مشاهده
                      </Link>
                      <button
                        onClick={() => {
                          setEditingUser(user);
                          setIsModalOpen(true);
                        }}
                        className="ml-4 text-blue-600 hover:text-blue-900"
                      >
                        ویرایش
                      </button>
                      <button
                        onClick={() => handleDelete(user.id, user.fullName)}
                        className="text-red-600 hover:text-red-900"
                        disabled={user.id === session.user.id}
                      >
                        حذف
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="fixed inset-0 bg-black opacity-30" onClick={() => setIsModalOpen(false)} />
            <div className="relative w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
              <h2 className="mb-4 text-xl font-bold">
                {editingUser ? 'ویرایش کاربر' : 'افزودن کاربر'}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    نام کاربری <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="username"
                    required
                    disabled={!!editingUser}
                    defaultValue={editingUser?.username}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 disabled:bg-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    نام کامل <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="fullName"
                    required
                    defaultValue={editingUser?.fullName}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    ایمیل <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    required
                    defaultValue={editingUser?.email}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    شماره تلفن <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    required
                    pattern="[0-9]{11}"
                    placeholder="09123456789"
                    defaultValue={editingUser?.phone}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    رمز عبور {editingUser ? '(خالی بگذارید برای عدم تغییر)' : <span className="text-red-500">*</span>}
                  </label>
                  <div className="relative mt-1">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      required={!editingUser}
                      minLength={6}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      {showPassword ? (
                        <EyeSlashIcon className="h-5 w-5" />
                      ) : (
                        <EyeIcon className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">نقش</label>
                  <select
                    name="role"
                    required
                    defaultValue={editingUser?.role || 'USER'}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                  >
                    <option value="USER">کاربر</option>
                    <option value="MANAGER">مدیر میانی</option>
                    <option value="ADMIN">مدیر</option>
                  </select>
                </div>
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                    className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {editingUser ? 'ذخیره تغییرات' : 'افزودن'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 rounded-lg bg-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-400"
                  >
                    انصراف
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 left-4 right-4 z-50 sm:left-auto sm:right-4 sm:w-96">
          <div
            className={`rounded-lg p-4 shadow-lg ${
              toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
            }`}
          >
            <div className="flex items-center justify-between">
              <span>{toast.message}</span>
              <button onClick={() => setToast(null)} className="mr-4 text-white hover:text-gray-200">
                ✕
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
