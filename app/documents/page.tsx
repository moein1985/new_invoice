'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';

const DOC_TYPES = {
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

type DocumentType = 'TEMP_PROFORMA' | 'PROFORMA' | 'INVOICE' | 'RETURN_INVOICE' | 'RECEIPT' | 'OTHER';

export default function DocumentsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [selectedType, setSelectedType] = useState<DocumentType | ''>('');
  const [search, setSearch] = useState('');

  // Fetch documents
  const { data: documents, isLoading, refetch } = trpc.document.list.useQuery({
    page: 1,
    limit: 50,
    documentType: selectedType ? (selectedType as DocumentType) : undefined,
  });

  const deleteMutation = trpc.document.delete.useMutation({
    onSuccess: () => {
      refetch();
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

  const handleDelete = (id: string, docNumber: string) => {
    if (confirm(`آیا از حذف سند "${docNumber}" اطمینان دارید؟`)) {
      deleteMutation.mutate({ id });
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fa-IR').format(amount) + ' ریال';
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('fa-IR');
  };

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl" style={{ fontFamily: 'Vazir, Tahoma, sans-serif' }}>
      {/* Header */}
      <header className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-3xl font-bold text-gray-900">اسناد</h1>
              <Link href="/dashboard" className="text-gray-500 hover:text-gray-700">
                بازگشت ←
              </Link>
            </div>
            <Link
              href="/documents/new"
              className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              + ایجاد سند جدید
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Filters */}
        <div className="mb-6 grid gap-4 md:grid-cols-2">
          <input
            type="text"
            placeholder="جستجو در اسناد (شماره سند، نام مشتری)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none"
          />
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value as DocumentType | '')}
            className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none"
          >
            <option value="">همه انواع اسناد</option>
            {Object.entries(DOC_TYPES).map(([key, value]) => (
              <option key={key} value={key}>
                {value}
              </option>
            ))}
          </select>
        </div>

        {/* Documents Table */}
        <div className="overflow-hidden bg-white shadow sm:rounded-lg">
          {isLoading ? (
            <div className="p-8 text-center">در حال بارگذاری...</div>
          ) : !documents?.data.length ? (
            <div className="p-8 text-center text-gray-500">
              هیچ سندی یافت نشد
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-right text-xs font-medium tracking-wider text-gray-700">
                      شماره سند
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium tracking-wider text-gray-700">
                      نوع
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium tracking-wider text-gray-700">
                      مشتری
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium tracking-wider text-gray-700">
                      تاریخ
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium tracking-wider text-gray-700">
                      مبلغ کل
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium tracking-wider text-gray-700">
                      وضعیت
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium tracking-wider text-gray-700">
                      عملیات
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {documents.data.map((doc: any) => (
                    <tr key={doc.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                        {doc.documentNumber}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm">
                        <span className={`rounded-full px-2 py-1 text-xs font-medium ${DOC_TYPE_COLORS[doc.type]}`}>
                          {DOC_TYPES[doc.type as keyof typeof DOC_TYPES]}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                        {doc.customerName}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                        {formatDate(doc.documentDate)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                        {formatCurrency(doc.totalAmount)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm">
                        {doc.approvals?.length > 0 ? (
                          <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
                            تایید شده
                          </span>
                        ) : (
                          <span className="rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-800">
                            در انتظار تایید
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-medium">
                        <div className="flex gap-3">
                          <Link
                            href={`/documents/${doc.id}`}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            مشاهده
                          </Link>
                          <button
                            onClick={() => handleDelete(doc.id, doc.documentNumber)}
                            className="text-red-600 hover:text-red-900"
                          >
                            حذف
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination info */}
        {documents && (
          <div className="mt-4 text-sm text-gray-500">
            تعداد کل: {documents.meta.total} سند
          </div>
        )}
      </main>
    </div>
  );
}
