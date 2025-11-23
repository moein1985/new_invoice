'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { useToast } from '@/components/ui/toast-provider';
import { LoadingButton } from '@/components/ui/loading-button';
import { Pagination } from '@/components/ui/pagination';
import { exportCustomersToExcel } from '@/lib/services/excel-export';
import { Download } from 'lucide-react';

export default function CustomersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<{
    id: string;
    code: string;
    name: string;
    phone: string | null;
    email?: string | null;
    address?: string | null;
    _count?: { documents: number };
  } | null>(null);

  // Fetch customers with search
  const { data: customers, isLoading, refetch } = trpc.customer.list.useQuery({
    page,
    limit: 10,
    search: search || undefined,
  });

  // Debug log
  console.log('🔍 Customers Page Debug:', {
    customers,
    isLoading,
    hasData: !!customers,
    dataArray: customers?.data,
    dataLength: customers?.data?.length,
  });

  const createMutation = trpc.customer.create.useMutation({
    onSuccess: () => {
      refetch();
      setIsModalOpen(false);
      setEditingCustomer(null);
      toast.success('مشتری با موفقیت اضافه شد');
    },
    onError: (error) => {
      toast.error('خطا در افزودن مشتری', error.message);
    },
  });

  const updateMutation = trpc.customer.update.useMutation({
    onSuccess: () => {
      refetch();
      setIsModalOpen(false);
      setEditingCustomer(null);
      toast.success('مشتری با موفقیت ویرایش شد');
    },
    onError: (error) => {
      toast.error('خطا در ویرایش مشتری', error.message);
    },
  });

  const deleteMutation = trpc.customer.delete.useMutation({
    onSuccess: () => {
      refetch();
      toast.success('مشتری با موفقیت حذف شد');
    },
    onError: (error) => {
      toast.error('خطا در حذف مشتری', error.message);
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
            <div className="flex gap-3">
              <button
                onClick={() => {
                  if (customers?.data) {
                    exportCustomersToExcel(customers.data, 'customers.xlsx');
                    toast.success('فایل Excel با موفقیت دانلود شد');
                  }
                }}
                className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700"
                disabled={!customers?.data?.length}
              >
                <Download className="h-4 w-4" />
                دانلود Excel
              </button>
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

        {/* Customers - Table for desktop, Cards for mobile */}
        <div className="overflow-hidden bg-white shadow sm:rounded-lg">
          {isLoading ? (
            <div className="p-8 text-center">در حال بارگذاری...</div>
          ) : !customers?.data.length ? (
            <div className="p-8 text-center text-gray-500">
              هیچ مشتری‌ای یافت نشد
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <table className="hidden md:table min-w-full divide-y divide-gray-200">
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
                {customers.data.map((customer) => (
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

            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-gray-200">
              {customers.data.map((customer) => (
                <div key={customer.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900">{customer.name}</h3>
                      <p className="text-sm text-gray-500 mt-1">کد: {customer.code}</p>
                    </div>
                    <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                      {customer._count?.documents || 0} سند
                    </span>
                  </div>
                  
                  <div className="space-y-2 mb-3">
                    <div className="flex items-center text-sm text-gray-600">
                      <svg className="ml-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      {customer.phone}
                    </div>
                    {customer.email && (
                      <div className="flex items-center text-sm text-gray-600">
                        <svg className="ml-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        {customer.email}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex gap-2">
                    <Link
                      href={`/customers/${customer.id}`}
                      className="flex-1 text-center rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-100"
                    >
                      مشاهده
                    </Link>
                    <button
                      onClick={() => {
                        setEditingCustomer(customer);
                        setIsModalOpen(true);
                      }}
                      className="flex-1 rounded-lg bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
                    >
                      ویرایش
                    </button>
                    <button
                      onClick={() => handleDelete(customer.id, customer.name)}
                      disabled={customer._count?.documents > 0}
                      className="flex-1 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      حذف
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
          )}
        </div>

        {/* Pagination */}
        {customers && customers.meta.totalPages > 1 && (
          <div className="mt-4 rounded-lg bg-white shadow">
            <Pagination
              currentPage={page}
              totalPages={customers.meta.totalPages}
              totalItems={customers.meta.total}
              itemsPerPage={customers.meta.limit}
              onPageChange={(newPage) => setPage(newPage)}
            />
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
                    defaultValue={editingCustomer?.phone || ''}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">ایمیل</label>
                  <input
                    type="email"
                    name="email"
                    defaultValue={editingCustomer?.email || ''}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">آدرس</label>
                  <textarea
                    name="address"
                    rows={3}
                    defaultValue={editingCustomer?.address || ''}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                  />
                </div>
                <div className="flex gap-3">
                  <LoadingButton
                    type="submit"
                    isLoading={createMutation.isPending || updateMutation.isPending}
                    variant="primary"
                    className="flex-1"
                  >
                    {editingCustomer ? 'ذخیره تغییرات' : 'افزودن'}
                  </LoadingButton>
                  <LoadingButton
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    variant="secondary"
                    className="flex-1"
                  >
                    انصراف
                  </LoadingButton>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
