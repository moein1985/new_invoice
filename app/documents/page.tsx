'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import moment from 'moment-jalaali';
import { exportDocumentsToExcel } from '@/lib/services/excel-export';
import { useToast } from '@/components/ui/toast-provider';
import { Download, Search, Clock } from 'lucide-react';
import { Pagination } from '@/components/ui/pagination';
import { PageSkeleton, TableSkeleton } from '@/components/ui/skeleton';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { JalaliDatePicker } from '@/components/ui/jalali-date-picker';

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
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [typeFilters, setTypeFilters] = useState<Set<DocumentType>>(new Set());
  const [deepSearch, setDeepSearch] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; docNumber: string } | null>(null);
  const [editWarningDoc, setEditWarningDoc] = useState<{ id: string; documentNumber: string } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const qp = Number(params.get('page') || '1');
    const ql = Number(params.get('limit') || '50');
    const qs = params.get('search') || '';
    const qd = params.get('deep') === '1';
    const qt = params.get('types');
    const qf = params.get('from') || '';
    const qtDate = params.get('to') || '';

    setPage(Number.isFinite(qp) && qp > 0 ? qp : 1);
    setLimit([20, 50, 100].includes(ql) ? ql : 50);
    setSearch(qs);
    setDeepSearch(qd);
    setTypeFilters(new Set((qt ? qt.split(',') : []).filter(Boolean) as DocumentType[]));
    setDateFrom(qf);
    setDateTo(qtDate);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(limit));
    if (search.trim()) params.set('search', search.trim());
    if (deepSearch) params.set('deep', '1');
    if (typeFilters.size > 0) params.set('types', Array.from(typeFilters).join(','));
    if (dateFrom) params.set('from', dateFrom);
    if (dateTo) params.set('to', dateTo);
    router.replace(`/documents?${params.toString()}`);
  }, [page, limit, search, deepSearch, typeFilters, dateFrom, dateTo, router]);

  useEffect(() => {
    setPage(1);
  }, [search, deepSearch, typeFilters, limit, dateFrom, dateTo]);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
    }, 350);

    return () => clearTimeout(t);
  }, [search]);

  // Fetch documents
  const { data: documents, isLoading, refetch } = trpc.document.list.useQuery({
    page,
    limit,
    types: typeFilters.size > 0 ? Array.from(typeFilters) : undefined,
    search: debouncedSearch.trim() || undefined,
    deepSearch,
    dateFrom: dateFrom ? new Date(dateFrom) : undefined,
    dateTo: dateTo ? new Date(`${dateTo}T23:59:59.999`) : undefined,
  });

  const exportAllMutation = trpc.document.exportFiltered.useMutation();

  useEffect(() => {
    if (documents?.meta.totalPages && page > documents.meta.totalPages) {
      setPage(documents.meta.totalPages);
    }
  }, [documents, page]);

  const deleteMutation = trpc.document.delete.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  if (status === 'loading') {
    return <PageSkeleton />;
  }

  if (!session) {
    router.push('/login');
    return null;
  }

  const handleDelete = (id: string, docNumber: string) => {
    setDeleteTarget({ id, docNumber });
  };

  const handleEditClick = (doc: any) => {
    // اگر پیش‌فاکتور موقت تایید شده است، هشدار بده
    if (doc.documentType === 'TEMP_PROFORMA' && doc.approvalStatus === 'APPROVED') {
      // پخش صدای هشدار
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjGJ0fPTgjMGHm7A7+OZRQ0PVa3n77BdGAg+lt35xXIqBSh+zPLaizsIGGS56+adTRAMTqfi8LdjHAU2jdXzzn0vBSd8yPDekUEJE1yx6OyrWBUIQ5zd8sFuIwUwhM/z1YU2Bhxqvu7mnEgND1Kt5++vXRYIPZTV+shyKwUogM/y2oo8ByFluezmm0kNDU+r5O+wXRYHPJLU+spzKwUngM7y2Yk7BxhluezmmlUNDUyp5O+xXhYHOpHT+sl0KwUngM3y2Ik6BxhmvOzmnVENDUyr5O+vXhUIOpHU+sl0KwUmgM3y2Yk6BxhmvOzmnFANDEyq5O+wXRUIOpHU+sl0KwUmgM3y2Yk6BxhmvOzmnFANDEyq5O+wXRUIOpHU+sl0KwUmgM3y2Yk6BxhmvOzmnFANDEyq5O+wXRUIOpHU+sl0KwUmgM3y2Yk6BxhmvOzmnFANDEyq5O+wXRUIOpHU+sl0KwUmgM3y2Yk6BxhmvOzmnFANDEyq5O+wXRUIOpHU+sl0KwUmgM3y2Yk6BxhmvOzmnFANDEyq5O+wXRUIOpHU+sl0KwUmgM3y2Yk6BxhmvOzmnFANDEyq5O+wXRUIOpHU+sl0KwUmgM3y2Yk6BxhmvOzmnFANDEyq5O+wXRUIOpHU+sl0KwUmgM3y2Yk6BxhmvOzmnFANDEyq5O+wXRUIOpHU+sl0KwUmgM3y2Yk6Bxhm');
      audio.play().catch(() => {});

      setEditWarningDoc({ id: doc.id, documentNumber: doc.documentNumber });
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

  const clearFilters = () => {
    setSearch('');
    setDeepSearch(false);
    setTypeFilters(new Set());
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  const removeFilterChip = (type: 'search' | 'deepSearch' | 'dateFrom' | 'dateTo' | 'docType', value?: string) => {
    if (type === 'search') setSearch('');
    if (type === 'deepSearch') setDeepSearch(false);
    if (type === 'dateFrom') setDateFrom('');
    if (type === 'dateTo') setDateTo('');
    if (type === 'docType' && value) {
      setTypeFilters((prev) => {
        const next = new Set(prev);
        next.delete(value as DocumentType);
        return next;
      });
    }
  };

  const visibleDocuments = documents?.data || [];

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === visibleDocuments.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(visibleDocuments.map((d: any) => d.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    for (const id of selectedIds) {
      await deleteMutation.mutateAsync({ id });
    }
    setSelectedIds(new Set());
    refetch();
    toast.success(`${count} سند با موفقیت حذف شد`);
  };

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl" style={{ fontFamily: 'Vazir, Tahoma, sans-serif' }}>
      {/* Header */}
      <header className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-gray-900">اسناد</h1>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  if (visibleDocuments.length > 0) {
                    const docsForExport = visibleDocuments.map((doc: any) => ({
                      id: doc.id,
                      type: doc.documentType,
                      approvalStatus: doc.approvalStatus,
                      approvalOrder: doc.approvalOrder,
                      customerName: doc.customerName,
                      totalAmount: doc.totalAmount,
                      createdAt: doc.createdAt,
                    }));
                    exportDocumentsToExcel(docsForExport, 'documents.xlsx');
                    toast.success('فایل Excel با موفقیت دانلود شد');
                  }
                }}
                className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700"
                disabled={!visibleDocuments.length}
              >
                <Download className="h-4 w-4" />
                خروجی صفحه جاری
              </button>
              <button
                onClick={async () => {
                  try {
                    const result = await exportAllMutation.mutateAsync({
                      types: typeFilters.size > 0 ? Array.from(typeFilters) : undefined,
                      search: debouncedSearch.trim() || undefined,
                      deepSearch,
                      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
                      dateTo: dateTo ? new Date(`${dateTo}T23:59:59.999`) : undefined,
                    });

                    if (!result.data.length) {
                      toast.warning('نتیجه‌ای برای خروجی یافت نشد');
                      return;
                    }

                    const docsForExport = result.data.map((doc: any) => ({
                      id: doc.id,
                      type: doc.documentType,
                      approvalStatus: doc.approvalStatus,
                      approvalOrder: doc.approvalOrder,
                      customerName: doc.customerName,
                      totalAmount: doc.totalAmount,
                      createdAt: doc.createdAt,
                    }));

                    exportDocumentsToExcel(docsForExport, 'documents-filtered.xlsx');
                    toast.success('خروجی کل نتایج فیلترشده دانلود شد');
                  } catch (error) {
                    toast.error('خطا در دریافت خروجی', (error as Error).message);
                  }
                }}
                className="flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-white hover:bg-emerald-800 disabled:opacity-60"
                disabled={exportAllMutation.isPending}
              >
                <Download className="h-4 w-4" />
                {exportAllMutation.isPending ? 'در حال آماده‌سازی...' : 'خروجی همه نتایج'}
              </button>
              <Link
                href="/documents/new"
                className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
              >
                + ایجاد سند جدید
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Breadcrumb items={[{ label: 'اسناد' }]} />
        {/* Filters */}
        <div className="mb-6 space-y-4">
          <div className="sticky top-3 z-10 flex flex-wrap items-center gap-3 rounded-lg border border-gray-300 bg-white p-3 shadow-sm">
            <label className="text-sm font-medium text-gray-800">تعداد در صفحه:</label>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="rounded-md border border-gray-300 px-2 py-1 text-sm"
            >
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <label className="text-sm font-medium text-gray-800">از تاریخ:</label>
            <JalaliDatePicker
              value={dateFrom}
              onChange={(v) => setDateFrom(v)}
              placeholder="از تاریخ"
            />
            <label className="text-sm font-medium text-gray-800">تا تاریخ:</label>
            <JalaliDatePicker
              value={dateTo}
              onChange={(v) => setDateTo(v)}
              placeholder="تا تاریخ"
            />
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-md bg-gray-100 px-3 py-1 text-sm text-gray-700 hover:bg-gray-200"
            >
              پاک کردن فیلترها
            </button>
          </div>

          {(search.trim() || deepSearch || typeFilters.size > 0 || dateFrom || dateTo) && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white p-3">
              {search.trim() && (
                <button
                  type="button"
                  onClick={() => removeFilterChip('search')}
                  className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800"
                >
                  جستجو: {search} ✕
                </button>
              )}
              {deepSearch && (
                <button
                  type="button"
                  onClick={() => removeFilterChip('deepSearch')}
                  className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-medium text-indigo-800"
                >
                  جستجوی دقیق ✕
                </button>
              )}
              {dateFrom && (
                <button
                  type="button"
                  onClick={() => removeFilterChip('dateFrom')}
                  className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800"
                >
                  از: {dateFrom} ✕
                </button>
              )}
              {dateTo && (
                <button
                  type="button"
                  onClick={() => removeFilterChip('dateTo')}
                  className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800"
                >
                  تا: {dateTo} ✕
                </button>
              )}
              {Array.from(typeFilters).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => removeFilterChip('docType', type)}
                  className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800"
                >
                  {DOC_TYPES[type]} ✕
                </button>
              ))}
            </div>
          )}
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
                <Search className="inline h-4 w-4" /> جستجوی دقیق (در محصولات، تامین‌کنندگان، توضیحات و...)
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
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={typeFilters.has('RETURN_INVOICE')}
                  onChange={() => toggleTypeFilter('RETURN_INVOICE')}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-900" style={{ fontFamily: 'Vazir, Tahoma, sans-serif' }}>
                  فاکتور برگشتی
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={typeFilters.has('RECEIPT')}
                  onChange={() => toggleTypeFilter('RECEIPT')}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-900" style={{ fontFamily: 'Vazir, Tahoma, sans-serif' }}>
                  رسید
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Bulk Action Bar */}
        {selectedIds.size > 0 && (
          <div className="mb-4 flex items-center gap-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
            <span className="text-sm font-bold text-blue-800">
              {selectedIds.size} سند انتخاب شده
            </span>
            <button
              type="button"
              onClick={handleBulkDelete}
              disabled={deleteMutation.isPending}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700 disabled:opacity-50"
            >
              حذف انتخاب‌شده‌ها
            </button>
            <button
              type="button"
              onClick={() => {
                if (documents?.data) {
                  const selectedDocs = documents.data.filter((d: any) => selectedIds.has(d.id));
                  exportDocumentsToExcel(selectedDocs, 'selected-documents.xlsx');
                  toast.success('فایل Excel انتخاب‌شده‌ها دانلود شد');
                }
              }}
              className="rounded-lg bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700"
            >
              دانلود Excel انتخاب‌شده‌ها
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="mr-auto text-sm text-gray-600 hover:text-gray-800"
            >
              لغو انتخاب
            </button>
          </div>
        )}

        {/* Documents Table */}
        <div className="overflow-hidden bg-white shadow sm:rounded-lg">
          {isLoading ? (
            <TableSkeleton columns={7} rows={10} />
          ) : !visibleDocuments.length ? (
            <div className="p-8 text-center text-gray-500">
              هیچ سندی یافت نشد
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="w-10 px-3 py-3">
                      <input
                        type="checkbox"
                        checked={visibleDocuments.length > 0 && selectedIds.size === visibleDocuments.length}
                        onChange={toggleSelectAll}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </th>
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
                  {visibleDocuments.map((doc: any) => (
                    <tr key={doc.id} className={`hover:bg-gray-50 ${selectedIds.has(doc.id) ? 'bg-blue-50' : ''}`}>
                      <td className="w-10 px-3 py-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(doc.id)}
                          onChange={() => toggleSelect(doc.id)}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
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
                              در انتظار تایید <Clock className="inline h-3 w-3" />
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
                          {/* فقط پیش‌فاکتور موقت قابل ویرایش است */}
                          {doc.documentType === 'TEMP_PROFORMA' && (
                            <button
                              onClick={() => handleEditClick(doc)}
                              className="text-green-600 hover:text-green-900"
                            >
                              ویرایش
                            </button>
                          )}
                          {/* پیش‌فاکتور و فاکتور قابل ویرایش نیستند، فقط پیش‌فاکتور موقت آنها */}
                          {(doc.documentType === 'PROFORMA' || doc.documentType === 'INVOICE') && (
                            <span className="text-gray-400 cursor-not-allowed" title="برای ویرایش، پیش‌فاکتور موقت مربوطه را ویرایش کنید">
                              ویرایش غیرفعال
                            </span>
                          )}
                          {/* سایر اسناد قابل ویرایش هستند */}
                          {doc.documentType !== 'TEMP_PROFORMA' && doc.documentType !== 'PROFORMA' && doc.documentType !== 'INVOICE' && (
                            <button
                              onClick={() => handleEditClick(doc)}
                              className="text-green-600 hover:text-green-900"
                            >
                              ویرایش
                            </button>
                          )}
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
                تعداد این صفحه: <span className="font-bold text-blue-600">{toPersianNumber(visibleDocuments.length)}</span> سند از مجموع <span className="font-bold">{toPersianNumber(documents.meta.total)}</span> سند
              </>
            ) : (
              <>
                تعداد این صفحه: <span className="font-bold text-blue-600">{toPersianNumber(visibleDocuments.length)}</span> سند از مجموع <span className="font-bold">{toPersianNumber(documents.meta.total)}</span> سند
              </>
            )}
          </div>
        )}

        {/* Pagination */}
        {documents && documents.meta.totalPages > 1 && (
          <div className="mt-4">
            <Pagination
              currentPage={page}
              totalPages={documents.meta.totalPages}
              totalItems={documents.meta.total}
              itemsPerPage={documents.meta.limit}
              onPageChange={(newPage) => setPage(newPage)}
            />
          </div>
        )}
      </main>

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900">حذف سند {deleteTarget.docNumber}</h3>
            <p className="mt-2 text-sm leading-6 text-gray-700">آیا از حذف این سند اطمینان دارید؟ این عملیات قابل بازگشت نیست.</p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleteMutation.isPending}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteMutation.mutate(
                    { id: deleteTarget.id },
                    {
                      onSuccess: () => {
                        setDeleteTarget(null);
                        toast.success('سند با موفقیت حذف شد');
                      },
                      onError: (error) => {
                        toast.error('حذف سند ناموفق بود', error.message);
                      },
                    }
                  );
                }}
                disabled={deleteMutation.isPending}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-60"
              >
                {deleteMutation.isPending ? 'در حال حذف...' : 'حذف سند'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editWarningDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900">ویرایش سند {editWarningDoc.documentNumber}</h3>
            <p className="mt-2 whitespace-pre-line text-sm leading-6 text-gray-700">
              {'این پیش‌فاکتور موقت قبلا تایید شده است.\n\nدر صورت ویرایش، تمام اسناد مرتبط (پیش‌فاکتور و فاکتور) که از روی آن ساخته شده‌اند حذف خواهند شد.\n\nآیا ادامه می‌دهید؟'}
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditWarningDoc(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={() => {
                  const targetId = editWarningDoc.id;
                  setEditWarningDoc(null);
                  router.push(`/documents/edit/${targetId}`);
                }}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
              >
                بله، ادامه
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
