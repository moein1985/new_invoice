'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import moment from 'moment-jalaali';

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
  const [typeFilters, setTypeFilters] = useState<Set<DocumentType>>(new Set());
  const [deepSearch, setDeepSearch] = useState(false);

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

  const handleEditClick = (doc: any) => {
    // اگر پیش‌فاکتور موقت تایید شده است، هشدار بده
    if (doc.documentType === 'TEMP_PROFORMA' && doc.approvalStatus === 'APPROVED') {
      // پخش صدای هشدار
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjGJ0fPTgjMGHm7A7+OZRQ0PVa3n77BdGAg+lt35xXIqBSh+zPLaizsIGGS56+adTRAMTqfi8LdjHAU2jdXzzn0vBSd8yPDekUEJE1yx6OyrWBUIQ5zd8sFuIwUwhM/z1YU2Bhxqvu7mnEgND1Kt5++vXRYIPZTV+shyKwUogM/y2oo8ByFluezmm0kNDU+r5O+wXRYHPJLU+spzKwUngM7y2Yk7BxhluezmmlUNDUyp5O+xXhYHOpHT+sl0KwUngM3y2Ik6BxhmvOzmnVENDUyr5O+vXhUIOpHU+sl0KwUmgM3y2Yk6BxhmvOzmnFANDEyq5O+wXRUIOpHU+sl0KwUmgM3y2Yk6BxhmvOzmnFANDEyq5O+wXRUIOpHU+sl0KwUmgM3y2Yk6BxhmvOzmnFANDEyq5O+wXRUIOpHU+sl0KwUmgM3y2Yk6BxhmvOzmnFANDEyq5O+wXRUIOpHU+sl0KwUmgM3y2Yk6BxhmvOzmnFANDEyq5O+wXRUIOpHU+sl0KwUmgM3y2Yk6BxhmvOzmnFANDEyq5O+wXRUIOpHU+sl0KwUmgM3y2Yk6BxhmvOzmnFANDEyq5O+wXRUIOpHU+sl0KwUmgM3y2Yk6BxhmvOzmnFANDEyq5O+wXRUIOpHU+sl0KwUmgM3y2Yk6BxhmvOzmnFANDEyq5O+wXRUIOpHU+sl0KwUmgM3y2Yk6Bxhm');
      audio.play().catch(() => {});

      const confirmed = confirm(
        `⚠️ هشدار مهم!\n\n` +
        `این پیش‌فاکتور موقت قبلاً توسط مدیر تایید شده است.\n\n` +
        `با ویرایش این سند، تمام اسناد مرتبط (پیش‌فاکتور و فاکتور) که از روی آن ساخته شده‌اند حذف خواهند شد!\n\n` +
        `آیا از ادامه اطمینان دارید؟`
      );
      
      if (confirmed) {
        router.push(`/documents/edit/${doc.id}`);
      }
    } else {
      // برای بقیه اسناد مستقیم برو به صفحه ویرایش
      router.push(`/documents/edit/${doc.id}`);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fa-IR').format(amount) + ' ریال';
  };

  const toPersianNumber = (num: number | string) => {
    const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return num.toString().replace(/\d/g, (digit) => persianDigits[parseInt(digit)]);
  };

  const formatDate = (date: string | Date) => {
    if (!date) return '-';
    return moment(date).format('jYYYY/jMM/jDD');
  };

  const toggleTypeFilter = (type: DocumentType) => {
    setTypeFilters((prev) => {
      const newFilters = new Set(prev);
      if (newFilters.has(type)) {
        newFilters.delete(type);
      } else {
        newFilters.add(type);
      }
      return newFilters;
    });
  };

  const filteredDocuments = documents?.data.filter((doc: any) => {
    if (typeFilters.size > 0 && !typeFilters.has(doc.documentType)) return false;
    if (search) {
      const searchLower = search.toLowerCase();
      
      // جستجوی پایه در شماره سند و نام مشتری
      const basicMatch = 
        doc.documentNumber?.toLowerCase().includes(searchLower) ||
        doc.customerName?.toLowerCase().includes(searchLower) ||
        doc.projectName?.toLowerCase().includes(searchLower);
      
      if (!deepSearch) {
        return basicMatch;
      }
      
      // جستجوی عمیق در همه فیلدها
      if (basicMatch) return true;
      
      // جستجو در یادداشت
      if (doc.notes?.toLowerCase().includes(searchLower)) return true;
      
      // جستجو در اقلام سند
      if (doc.items && Array.isArray(doc.items)) {
        return doc.items.some((item: any) =>
          item.productName?.toLowerCase().includes(searchLower) ||
          item.description?.toLowerCase().includes(searchLower) ||
          item.supplier?.toLowerCase().includes(searchLower) ||
          item.unit?.toLowerCase().includes(searchLower)
        );
      }
    }
    return true;
  });

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
        <div className="mb-6 space-y-4">
          {/* جستجو */}
          <div className="space-y-2">
            <input
              type="text"
              placeholder="جستجو در اسناد (شماره سند، نام مشتری، نام مسیر)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900 focus:border-blue-500 focus:outline-none"
              style={{ fontFamily: 'Vazir, Tahoma, sans-serif', fontSize: '14px', fontWeight: 500 }}
            />
            <label className="flex items-center gap-2 cursor-pointer pr-2">
              <input
                type="checkbox"
                checked={deepSearch}
                onChange={(e) => setDeepSearch(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700" style={{ fontFamily: 'Vazir, Tahoma, sans-serif' }}>
                🔍 جستجوی دقیق (در محصولات، تامین‌کنندگان، توضیحات و...)
              </span>
            </label>
          </div>

          {/* فیلتر نوع سند با چک‌باکس */}
          <div className="rounded-lg border border-gray-300 bg-white p-4">
            <div className="mb-3 text-sm font-bold text-gray-900" style={{ fontFamily: 'Vazir, Tahoma, sans-serif' }}>
              فیلتر بر اساس نوع سند:
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={typeFilters.has('TEMP_PROFORMA')}
                  onChange={() => toggleTypeFilter('TEMP_PROFORMA')}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-900" style={{ fontFamily: 'Vazir, Tahoma, sans-serif' }}>
                  پیش‌فاکتور موقت
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={typeFilters.has('PROFORMA')}
                  onChange={() => toggleTypeFilter('PROFORMA')}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-900" style={{ fontFamily: 'Vazir, Tahoma, sans-serif' }}>
                  پیش‌فاکتور
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={typeFilters.has('INVOICE')}
                  onChange={() => toggleTypeFilter('INVOICE')}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-900" style={{ fontFamily: 'Vazir, Tahoma, sans-serif' }}>
                  فاکتور
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={typeFilters.has('OTHER')}
                  onChange={() => toggleTypeFilter('OTHER')}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-900" style={{ fontFamily: 'Vazir, Tahoma, sans-serif' }}>
                  سایر
                </span>
              </label>
            </div>
          </div>
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
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-6 py-3 text-right text-sm font-bold text-gray-900" style={{ fontFamily: 'Vazir, Tahoma, sans-serif' }}>
                      شماره سند
                    </th>
                    <th className="px-6 py-3 text-right text-sm font-bold text-gray-900" style={{ fontFamily: 'Vazir, Tahoma, sans-serif' }}>
                      نوع
                    </th>
                    <th className="px-6 py-3 text-right text-sm font-bold text-gray-900" style={{ fontFamily: 'Vazir, Tahoma, sans-serif' }}>
                      مشتری
                    </th>
                    <th className="px-6 py-3 text-right text-sm font-bold text-gray-900" style={{ fontFamily: 'Vazir, Tahoma, sans-serif' }}>
                      تاریخ
                    </th>
                    <th className="px-6 py-3 text-right text-sm font-bold text-gray-900" style={{ fontFamily: 'Vazir, Tahoma, sans-serif' }}>
                      مبلغ کل
                    </th>
                    <th className="px-6 py-3 text-right text-sm font-bold text-gray-900" style={{ fontFamily: 'Vazir, Tahoma, sans-serif' }}>
                      وضعیت
                    </th>
                    <th className="px-6 py-3 text-right text-sm font-bold text-gray-900" style={{ fontFamily: 'Vazir, Tahoma, sans-serif' }}>
                      عملیات
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {filteredDocuments?.map((doc: any) => (
                    <tr key={doc.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                        {doc.documentNumber}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm">
                        <span className={`rounded-full px-2 py-1 text-xs font-medium ${DOC_TYPE_COLORS[doc.documentType]}`}>
                          {DOC_TYPES[doc.documentType as keyof typeof DOC_TYPES]}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                        {doc.customerName}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                        {formatDate(doc.issueDate)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                        {formatCurrency(doc.totalAmount)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm">
                        {doc.documentType === 'TEMP_PROFORMA' ? (
                          doc.approvalStatus === 'APPROVED' ? (
                            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-800" style={{ fontFamily: 'Vazir, Tahoma, sans-serif' }}>
                              تایید شده ✓
                            </span>
                          ) : doc.approvalStatus === 'REJECTED' ? (
                            <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-800" style={{ fontFamily: 'Vazir, Tahoma, sans-serif' }}>
                              رد شده ✗
                            </span>
                          ) : (
                            <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-bold text-yellow-800" style={{ fontFamily: 'Vazir, Tahoma, sans-serif' }}>
                              در انتظار تایید ⏳
                            </span>
                          )
                        ) : (
                          <span className="text-gray-400">-</span>
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
                            onClick={() => handleEditClick(doc)}
                            className="text-green-600 hover:text-green-900"
                          >
                            ویرایش
                          </button>
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
          <div className="mt-4 text-sm font-medium text-gray-700" style={{ fontFamily: 'Vazir, Tahoma, sans-serif' }}>
            {typeFilters.size > 0 || search ? (
              <>
                تعداد فیلتر شده: <span className="font-bold text-blue-600">{toPersianNumber(filteredDocuments?.length || 0)}</span> سند از مجموع <span className="font-bold">{toPersianNumber(documents.meta.total)}</span> سند
              </>
            ) : (
              <>
                تعداد کل: <span className="font-bold">{toPersianNumber(documents.meta.total)}</span> سند
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
