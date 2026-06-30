'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import moment from 'moment-jalaali';
import { Search, Plus, ShoppingCart, Filter, Pencil, Trash2 } from 'lucide-react';
import { Pagination } from '@/components/ui/pagination';
import { PageSkeleton, TableSkeleton } from '@/components/ui/skeleton';
import { Breadcrumb } from '@/components/ui/breadcrumb';

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'پیش‌نویس',
  PENDING_INQUIRY: 'در انتظار استعلام',
  INQUIRED: 'استعلام‌شده',
  APPROVED: 'تایید‌شده',
  REJECTED: 'رد‌شده',
  PURCHASED: 'خریداری‌شده',
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  PENDING_INQUIRY: 'bg-yellow-100 text-yellow-800',
  INQUIRED: 'bg-blue-100 text-blue-800',
  APPROVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
  PURCHASED: 'bg-purple-100 text-purple-800',
};

const PRIORITY_LABELS: Record<string, string> = {
  LOW: 'کم',
  MEDIUM: 'متوسط',
  HIGH: 'زیاد',
  URGENT: 'فوری',
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'bg-gray-100 text-gray-600',
  MEDIUM: 'bg-blue-100 text-blue-700',
  HIGH: 'bg-orange-100 text-orange-700',
  URGENT: 'bg-red-100 text-red-700',
};

export default function PurchasesPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const role = session?.user?.role;
  const isManager = role === 'ADMIN' || role === 'MANAGER';

  const { data, isLoading } = trpc.purchase.list.useQuery(
    {
      page,
      limit,
      search: search || undefined,
      status: (statusFilter || undefined) as any,
      priority: (priorityFilter || undefined) as any,
    },
    { enabled: !!session }
  );

  const utils = trpc.useUtils();
  const deleteMutation = trpc.purchase.delete.useMutation({
    onSuccess: () => {
      utils.purchase.list.invalidate();
      setDeleteId(null);
      setDeleting(false);
    },
    onError: () => {
      setDeleting(false);
    },
  });

  if (authStatus === 'loading') return <PageSkeleton />;
  if (!session) {
    router.push('/login');
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 space-y-6">
      <Breadcrumb items={[{ label: 'سامانه خرید' }]} />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <ShoppingCart className="h-6 w-6 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900">درخواست‌های خرید</h1>
        </div>
        {isManager && (
          <Link
            href="/purchases/new"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            <Plus size={18} />
            درخواست جدید
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="جستجو در عنوان، شماره درخواست..."
              className="w-full rounded-lg border border-gray-300 py-2 pr-10 pl-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <select
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          >
            <option value="">همه وضعیت‌ها</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            value={priorityFilter}
            onChange={(e) => { setPriorityFilter(e.target.value); setPage(1); }}
          >
            <option value="">همه اولویت‌ها</option>
            {Object.entries(PRIORITY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        {isLoading ? (
          <TableSkeleton rows={5} columns={7} />
        ) : !data || data.data.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <ShoppingCart className="mx-auto h-12 w-12 text-gray-300 mb-3" />
            <p>درخواست خریدی یافت نشد</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-right font-medium text-gray-600">شماره</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">عنوان</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">پروژه</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">اولویت</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">وضعیت</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">ایجادکننده</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">مسئول</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">تاریخ</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">تعداد قلم</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">استعلام</th>
                  {isManager && <th className="px-4 py-3 text-right font-medium text-gray-600">عملیات</th>}
                </tr>
              </thead>
              <tbody>
                {data.data.map((req: any) => (
                  <tr
                    key={req.id}
                    className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => router.push(`/purchases/${req.id}`)}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">
                      {req.requestNumber}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{req.title}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {req.project?.name || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_COLORS[req.priority]}`}>
                        {PRIORITY_LABELS[req.priority]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[req.status]}`}>
                        {STATUS_LABELS[req.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{req.createdBy.fullName}</td>
                    <td className="px-4 py-3 text-gray-600">{req.assignedTo?.fullName || '—'}</td>
                    <td className="px-4 py-3 text-gray-600" dir="ltr">
                      {moment(req.createdAt).format('jYYYY/jMM/jDD')}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600">{req._count.items}</td>
                    <td className="px-4 py-3 text-center text-gray-600">{req._count.inquiries}</td>
                    {isManager && (
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); router.push(`/purchases/${req.id}/edit`); }}
                            className="rounded p-1 text-blue-600 hover:bg-blue-50 transition-colors"
                            title="ویرایش"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleteId(req.id); }}
                            className="rounded p-1 text-red-600 hover:bg-red-50 transition-colors"
                            title="حذف"
                            disabled={req.status === 'PURCHASED'}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {data && data.meta.totalPages > 1 && (
        <Pagination
          currentPage={data.meta.page}
          totalPages={data.meta.totalPages}
          onPageChange={setPage}
        />
      )}

      {/* Delete confirmation modal */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setDeleteId(null)}>
          <div className="rounded-xl bg-white p-6 shadow-xl max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-3">حذف درخواست خرید</h3>
            <p className="text-sm text-gray-600 mb-5">آیا از حذف این درخواست خرید اطمینان دارید؟ این عمل قابل بازگشت نیست.</p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                انصراف
              </button>
              <button
                onClick={() => { setDeleting(true); deleteMutation.mutate({ id: deleteId }); }}
                disabled={deleting}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'در حال حذف...' : 'حذف'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
