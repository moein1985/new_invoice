'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { useToast } from '@/components/ui/toast-provider';
import { LoadingButton } from '@/components/ui/loading-button';
import { Pagination } from '@/components/ui/pagination';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { PageSkeleton, TableSkeleton } from '@/components/ui/skeleton';
import { Breadcrumb } from '@/components/ui/breadcrumb';

export default function SuppliersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<{
    id: string;
    code: string;
    name: string;
    phone: string | null;
    email?: string | null;
    address?: string | null;
    description?: string | null;
    _count?: { inquiries: number };
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  // Fetch suppliers with search
  const { data: suppliers, isLoading, refetch } = trpc.supplier.list.useQuery({
    page,
    limit: 10,
    search: search || undefined,
  });

  const createMutation = trpc.supplier.create.useMutation({
    onSuccess: () => {
      refetch();
      setIsModalOpen(false);
      setEditingSupplier(null);
      toast.success('تامین‌کننده با موفقیت اضافه شد');
    },
    onError: (error) => {
      toast.error('خطا در افزودن تامین‌کننده', error.message);
    },
  });

  const updateMutation = trpc.supplier.update.useMutation({
    onSuccess: () => {
      refetch();
      setIsModalOpen(false);
      setEditingSupplier(null);
      toast.success('تامین‌کننده با موفقیت ویرایش شد');
    },
    onError: (error) => {
      toast.error('خطا در ویرایش تامین‌کننده', error.message);
    },
  });

  const deleteMutation = trpc.supplier.delete.useMutation({
    onSuccess: () => {
      refetch();
      toast.success('تامین‌کننده با موفقیت حذف شد');
    },
    onError: (error) => {
      toast.error('خطا در حذف تامین‌کننده', error.message);
    },
  });

  if (status === 'loading') {
    return <PageSkeleton />;
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
      description: formData.get('description') as string,
    };

    if (editingSupplier) {
      updateMutation.mutate({ id: editingSupplier.id, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = (id: string, name: string) => {
    setDeleteTarget({ id, name });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-gray-900">تامین‌کنندگان</h1>
            <button
              onClick={() => {
                setEditingSupplier(null);
                setIsModalOpen(true);
              }}
              className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              + افزودن تامین‌کننده
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Breadcrumb items={[{ label: 'تامین‌کنندگان' }]} />
        {/* Search */}
        <div className="mb-6 space-y-2">
          <input
            type="text"
            placeholder="جستجو در تامین‌کنندگان..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none"
          />
          {search.trim() && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setSearch('')}
                className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800"
              >
                جستجو: {search} ✕
              </button>
            </div>
          )}
        </div>

        {/* Suppliers Table */}
        <div className="overflow-hidden bg-white shadow sm:rounded-lg">
          {isLoading ? (
            <TableSkeleton columns={6} rows={10} />
          ) : !suppliers?.data.length ? (
            <div className="p-8 text-center text-gray-500">
              هیچ تامین‌کننده‌ای یافت نشد
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
                      آدرس
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                      تعداد استعلام
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                      عملیات
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {suppliers.data.map((supplier) => (
                    <tr key={supplier.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                        {supplier.code}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                        {supplier.name}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                        {supplier.phone || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                        {supplier.address || '-'}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                        {supplier.inquiryCount || 0}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-medium">
                        <Link
                          href={`/suppliers/${supplier.id}`}
                          className="ml-4 text-green-600 hover:text-green-900"
                        >
                          مشاهده
                        </Link>
                        <button
                          onClick={() => {
                            setEditingSupplier(supplier);
                            setIsModalOpen(true);
                          }}
                          className="ml-4 text-blue-600 hover:text-blue-900"
                        >
                          ویرایش
                        </button>
                        <button
                          onClick={() => handleDelete(supplier.id, supplier.name)}
                          className="text-red-600 hover:text-red-900"
                          disabled={(supplier.inquiryCount || 0) > 0}
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
                {suppliers.data.map((supplier) => (
                  <div key={supplier.id} className="p-4 hover:bg-gray-50">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900">{supplier.name}</h3>
                        <p className="text-sm text-gray-500 mt-1">کد: {supplier.code}</p>
                      </div>
                      <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                        {supplier.inquiryCount || 0} استعلام
                      </span>
                    </div>

                    <div className="space-y-2 mb-3">
                      {supplier.phone && (
                        <div className="flex items-center text-sm text-gray-600">
                          <svg className="ml-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                          {supplier.phone}
                        </div>
                      )}
                      {supplier.address && (
                        <div className="flex items-center text-sm text-gray-600">
                          <svg className="ml-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          {supplier.address}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Link
                        href={`/suppliers/${supplier.id}`}
                        className="flex-1 text-center rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-100"
                      >
                        مشاهده
                      </Link>
                      <button
                        onClick={() => {
                          setEditingSupplier(supplier);
                          setIsModalOpen(true);
                        }}
                        className="flex-1 rounded-lg bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
                      >
                        ویرایش
                      </button>
                      <button
                        onClick={() => handleDelete(supplier.id, supplier.name)}
                        disabled={(supplier.inquiryCount || 0) > 0}
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
        {suppliers && suppliers.meta.totalPages > 1 && (
          <div className="mt-4 rounded-lg bg-white shadow">
            <Pagination
              currentPage={page}
              totalPages={suppliers.meta.totalPages}
              totalItems={suppliers.meta.total}
              itemsPerPage={suppliers.meta.limit}
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
                {editingSupplier ? 'ویرایش تامین‌کننده' : 'افزودن تامین‌کننده جدید'}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                {editingSupplier && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">کد</label>
                    <input
                      type="text"
                      value={editingSupplier.code}
                      disabled
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-gray-100 px-3 py-2 text-gray-600"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700">نام <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    name="name"
                    required
                    defaultValue={editingSupplier?.name}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">تلفن</label>
                  <input
                    type="text"
                    name="phone"
                    defaultValue={editingSupplier?.phone || ''}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">ایمیل</label>
                  <input
                    type="email"
                    name="email"
                    defaultValue={editingSupplier?.email || ''}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">آدرس</label>
                  <textarea
                    name="address"
                    rows={2}
                    defaultValue={editingSupplier?.address || ''}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">توضیحات</label>
                  <textarea
                    name="description"
                    rows={2}
                    defaultValue={editingSupplier?.description || ''}
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
                    {editingSupplier ? 'ذخیره تغییرات' : 'افزودن'}
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

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            deleteMutation.mutate({ id: deleteTarget.id }, {
              onSuccess: () => setDeleteTarget(null),
            });
          }
        }}
        title={`حذف تامین‌کننده ${deleteTarget?.name ?? ''}`}
        message="آیا از حذف این تامین‌کننده اطمینان دارید؟ این عملیات قابل بازگشت نیست."
        confirmText="حذف تامین‌کننده"
        variant="danger"
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
