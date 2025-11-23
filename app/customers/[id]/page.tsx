'use client';

import { useRouter, useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import moment from 'moment-jalaali';

const DOC_TYPES: Record<string, string> = {
  TEMP_PROFORMA: 'پیش فاکتور موقت',
  PROFORMA: 'پیش فاکتور',
  INVOICE: 'فاکتور',
  RETURN_INVOICE: 'فاکتور برگشتی',
  RECEIPT: 'رسید',
  OTHER: 'سایر',
};

const DOC_TYPE_COLORS: Record<string, string> = {
  TEMP_PROFORMA: 'bg-gray-100 text-gray-800',
  PROFORMA: 'bg-blue-100 text-blue-800',
  INVOICE: 'bg-green-100 text-green-800',
  RETURN_INVOICE: 'bg-red-100 text-red-800',
  RECEIPT: 'bg-purple-100 text-purple-800',
  OTHER: 'bg-yellow-100 text-yellow-800',
};

export default function CustomerDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const { data: customer, isLoading, refetch } = trpc.customer.getById.useQuery(
    { id },
    { enabled: !!id }
  );

  const deleteMutation = trpc.customer.delete.useMutation({
    onSuccess: () => {
      alert('مشتری با موفقیت حذف شد');
      router.push('/customers');
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

  if (!customer) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-xl text-red-600">مشتری یافت نشد</div>
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fa-IR').format(amount) + ' ریال';
  };

  const formatDate = (date: string | Date) => {
    return moment(date).format('jYYYY/jM/jD');
  };

  const totalSpent = customer.documents?.reduce((sum: number, doc: any) => sum + doc.finalAmount, 0) || 0;
  const documentCount = customer.documents?.length || 0;

  const handleDelete = () => {
    if (documentCount > 0) {
      alert('امکان حذف مشتری با سند وجود ندارد. ابتدا اسناد را حذف کنید.');
      return;
    }
    if (confirm(`آیا از حذف مشتری "${customer.name}" اطمینان دارید؟`)) {
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
                جزئیات مشتری
              </h1>
              <Link href="/customers" className="text-gray-500 hover:text-gray-700">
                بازگشت ←
              </Link>
            </div>
            <div className="flex gap-2">
              <Link
                href={`/customers/edit/${id}`}
                className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
              >
                ✏️ ویرایش
              </Link>
              <button
                onClick={handleDelete}
                disabled={deleteMutation.isPending || documentCount > 0}
                className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleteMutation.isPending ? '⏳ در حال حذف...' : '🗑️ حذف'}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Customer Info Card */}
          <div className="lg:col-span-1">
            <div className="overflow-hidden rounded-lg bg-white shadow">
              <div className="bg-blue-600 p-6 text-white">
                <div className="flex items-center gap-3">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-2xl text-blue-600">
                    👤
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">{customer.name}</h2>
                    <p className="text-blue-100">{customer.code}</p>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <p className="text-sm text-gray-500">شماره تماس</p>
                  <p className="font-bold" style={{ color: '#2a2a2a' }}>
                    {customer.phone || '-'}
                  </p>
                </div>

                {customer.email && (
                  <div>
                    <p className="text-sm text-gray-500">ایمیل</p>
                    <p className="font-bold" style={{ color: '#2a2a2a' }}>
                      {customer.email}
                    </p>
                  </div>
                )}

                {customer.address && (
                  <div>
                    <p className="text-sm text-gray-500">آدرس</p>
                    <p className="font-bold" style={{ color: '#2a2a2a' }}>
                      {customer.address}
                    </p>
                  </div>
                )}

                <div className="border-t pt-4">
                  <p className="text-sm text-gray-500">تاریخ ایجاد</p>
                  <p className="font-bold" style={{ color: '#2a2a2a' }}>
                    {formatDate(customer.createdAt)}
                  </p>
                </div>
              </div>
            </div>

            {/* Stats Card */}
            <div className="mt-6 overflow-hidden rounded-lg bg-white shadow">
              <div className="bg-green-600 p-4 text-white">
                <h3 className="text-lg font-bold">آمار خرید</h3>
              </div>
              <div className="p-6 space-y-4">
                <div className="rounded-lg bg-blue-50 p-4">
                  <p className="text-sm text-gray-600">تعداد اسناد</p>
                  <p className="text-2xl font-bold text-blue-600">{documentCount}</p>
                </div>
                <div className="rounded-lg bg-green-50 p-4">
                  <p className="text-sm text-gray-600">مجموع خرید</p>
                  <p className="text-xl font-bold text-green-600">
                    {formatCurrency(totalSpent)}
                  </p>
                </div>
                {documentCount > 0 && (
                  <div className="rounded-lg bg-purple-50 p-4">
                    <p className="text-sm text-gray-600">میانگین خرید</p>
                    <p className="text-lg font-bold text-purple-600">
                      {formatCurrency(Math.round(totalSpent / documentCount))}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Documents History */}
          <div className="lg:col-span-2">
            <div className="overflow-hidden rounded-lg bg-white shadow">
              <div className="border-b bg-gray-50 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold" style={{ color: '#1a1a1a' }}>
                    تاریخچه اسناد ({documentCount})
                  </h3>
                  <Link
                    href={`/documents/new?customerId=${id}`}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
                  >
                    + سند جدید
                  </Link>
                </div>
              </div>

              <div className="p-6">
                {documentCount === 0 ? (
                  <div className="py-12 text-center text-gray-500">
                    <div className="text-6xl mb-4">📄</div>
                    <p className="text-xl">هنوز سندی ثبت نشده است</p>
                    <Link
                      href={`/documents/new?customerId=${id}`}
                      className="mt-4 inline-block rounded-lg bg-blue-600 px-6 py-3 text-white hover:bg-blue-700"
                    >
                      ایجاد اولین سند
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {customer.documents?.map((doc) => (
                      <Link
                        key={doc.id}
                        href={`/documents/${doc.id}`}
                        className="block rounded-lg border p-4 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="text-3xl">📄</div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-bold" style={{ color: '#1a1a1a' }}>
                                  {doc.documentNumber}
                                </p>
                                <span
                                  className={`rounded-full px-2 py-1 text-xs font-medium ${
                                    DOC_TYPE_COLORS[doc.documentType]
                                  }`}
                                >
                                  {DOC_TYPES[doc.documentType]}
                                </span>
                              </div>
                              <p className="text-sm text-gray-500">
                                {formatDate(doc.issueDate)}
                              </p>
                            </div>
                          </div>
                          <div className="text-left">
                            <p className="text-lg font-bold text-green-600">
                              {formatCurrency(doc.finalAmount)}
                            </p>
                            <p className="text-xs text-gray-500">
                              {doc.approvalStatus === 'APPROVED'
                                ? '✅ تایید شده'
                                : doc.approvalStatus === 'REJECTED'
                                ? '❌ رد شده'
                                : '⏳ در انتظار'}
                            </p>
                          </div>
                        </div>
                        {doc.notes && (
                          <div className="mt-2 text-sm text-gray-600 border-t pt-2">
                            💬 {doc.notes.substring(0, 100)}
                            {doc.notes.length > 100 && '...'}
                          </div>
                        )}
                      </Link>
                    ))}

                    {documentCount > 10 && (
                      <div className="text-center pt-4">
                        <Link
                          href={`/documents?customerId=${id}`}
                          className="text-blue-600 hover:underline"
                        >
                          مشاهده همه اسناد ({documentCount}) ←
                        </Link>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
