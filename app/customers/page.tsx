'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';

export default function CustomersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Fetch customers with search
  const { data: customers, isLoading, refetch } = trpc.customer.list.useQuery({
    page: 1,
    limit: 50,
    search: search || undefined,
  });

  const createMutation = trpc.customer.create.useMutation({
    onSuccess: () => {
      refetch();
      setIsModalOpen(false);
      setEditingCustomer(null);
      setToast({ message: 'مشتری با موفقیت اضافه شد', type: 'success' });
      setTimeout(() => setToast(null), 3000);
    },
    onError: (error) => {
      setToast({ message: error.message, type: 'error' });
      setTimeout(() => setToast(null), 5000);
    },
  });

  const updateMutation = trpc.customer.update.useMutation({
    onSuccess: () => {
      refetch();
      setIsModalOpen(false);
      setEditingCustomer(null);
      setToast({ message: 'مشتری با موفقیت ویرایش شد', type: 'success' });
      setTimeout(() => setToast(null), 3000);
    },
    onError: (error) => {
      setToast({ message: error.message, type: 'error' });
      setTimeout(() => setToast(null), 5000);
    },
  });

  const deleteMutation = trpc.customer.delete.useMutation({
    onSuccess: () => {
      refetch();
      setToast({ message: 'مشتری با موفقیت حذف شد', type: 'success' });
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

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name') as string,
      phone: formData.get('phone') as string,
      email: formData.get('email') as string,
      address: formData.get('address') as string,
    };

    if (editingCustomer) {
      updateMutation.mutate({ id: editingCustomer.id, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`آیا از حذف مشتری "${name}" اطمینان دارید؟`)) {
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
              <h1 className="text-3xl font-bold text-gray-900">مشتریان</h1>
            </div>
            <button
              onClick={() => {
                setEditingCustomer(null);
                setIsModalOpen(true);
              }}
              className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              + افزودن مشتری
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="جستجو در مشتریان..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none"
          />
        </div>

        {/* Customers Table */}
        <div className="overflow-hidden bg-white shadow sm:rounded-lg">
          {isLoading ? (
            <div className="p-8 text-center">در حال بارگذاری...</div>
          ) : !customers?.data.length ? (
            <div className="p-8 text-center text-gray-500">
              هیچ مشتری‌ای یافت نشد
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    کد
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    نام
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    تلفن
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    ایمیل
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    تعداد اسناد
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    عملیات
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {customers.data.map((customer: any) => (
                  <tr key={customer.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                      {customer.code}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                      {customer.name}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {customer.phone}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {customer.email || '-'}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {customer._count?.documents || 0}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium">
                      <Link
                        href={`/customers/${customer.id}`}
                        className="ml-4 text-green-600 hover:text-green-900"
                      >
                        مشاهده
                      </Link>
                      <button
                        onClick={() => {
                          setEditingCustomer(customer);
                          setIsModalOpen(true);
                        }}
                        className="ml-4 text-blue-600 hover:text-blue-900"
                      >
                        ویرایش
                      </button>
                      <button
                        onClick={() => handleDelete(customer.id, customer.name)}
                        className="text-red-600 hover:text-red-900"
                        disabled={customer._count?.documents > 0}
                      >
                        حذف
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination info */}
        {customers && (
          <div className="mt-4 text-sm text-gray-500">
            تعداد کل: {customers.meta.total} مشتری
          </div>
        )}
      </main>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center px-4">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={() => setIsModalOpen(false)} />
            <div className="relative z-50 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
              <h2 className="mb-4 text-xl font-bold">
                {editingCustomer ? 'ویرایش مشتری' : 'افزودن مشتری جدید'}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                {editingCustomer && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">کد</label>
                    <input
                      type="text"
                      value={editingCustomer.code}
                      disabled
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-gray-100 px-3 py-2 text-gray-600"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700">نام</label>
                  <input
                    type="text"
                    name="name"
                    required
                    defaultValue={editingCustomer?.name}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">تلفن *</label>
                  <input
                    type="text"
                    name="phone"
                    required
                    defaultValue={editingCustomer?.phone}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">ایمیل</label>
                  <input
                    type="email"
                    name="email"
                    defaultValue={editingCustomer?.email}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">آدرس</label>
                  <textarea
                    name="address"
                    rows={3}
                    defaultValue={editingCustomer?.address}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                    className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {editingCustomer ? 'ذخیره تغییرات' : 'افزودن'}
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

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-4 left-4 right-4 z-50 sm:left-auto sm:right-4 sm:w-96">
          <div
            className={`rounded-lg p-4 shadow-lg ${
              toast.type === 'success'
                ? 'bg-green-500 text-white'
                : 'bg-red-500 text-white'
            }`}
          >
            <div className="flex items-center justify-between">
              <span>{toast.message}</span>
              <button
                onClick={() => setToast(null)}
                className="mr-4 text-white hover:text-gray-200"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
