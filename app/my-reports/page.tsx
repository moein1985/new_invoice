'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { Pagination } from '@/components/ui/pagination';
import { PageSkeleton, TableSkeleton } from '@/components/ui/skeleton';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { JalaliDatePicker } from '@/components/ui/jalali-date-picker';
import { Eye, Search } from 'lucide-react';
import moment from 'moment-jalaali';

const statusColors: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
};

const statusLabels: Record<string, string> = {
  PENDING: 'در انتظار تایید',
  APPROVED: 'تایید شده',
  REJECTED: 'رد شده',
};

export default function MyReportsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');

  const { data: reports, isLoading } = trpc.workReport.listMine.useQuery(
    {
      page,
      limit: 15,
      status: statusFilter ? (statusFilter as 'PENDING' | 'APPROVED' | 'REJECTED') : undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      search: search || undefined,
    },
    { enabled: !!session }
  );

  if (status === 'loading') return <PageSkeleton />;
  if (!session) { router.push('/login'); return null; }

  return (
    <div className="p-4 md:p-6">
      <Breadcrumb items={[{ label: 'گزارش‌های من' }]} />

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">گزارش‌های من</h1>
      </div>

      {/* Filter */}
      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          >
            <option value="">همه وضعیت‌ها</option>
            <option value="PENDING">در انتظار تایید</option>
            <option value="APPROVED">تایید شده</option>
            <option value="REJECTED">رد شده</option>
          </select>
          <div className="relative flex-1">
            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="جستجو در شرح آیتم‌ها..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-9 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 items-end">
          <div>
            <label className="mb-1 block text-xs text-gray-500">از تاریخ</label>
            <JalaliDatePicker value={dateFrom} onChange={(v) => { setDateFrom(v); setPage(1); }} className="h-9" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">تا تاریخ</label>
            <JalaliDatePicker value={dateTo} onChange={(v) => { setDateTo(v); setPage(1); }} className="h-9" />
          </div>
          {(dateFrom || dateTo || search || statusFilter) && (
            <button
              onClick={() => { setDateFrom(''); setDateTo(''); setSearch(''); setStatusFilter(''); setPage(1); }}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              پاک کردن فیلترها
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <TableSkeleton />
      ) : !reports?.data?.length ? (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500">
          گزارشی یافت نشد
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-4 py-3 text-right font-medium">شماره</th>
                <th className="px-4 py-3 text-right font-medium">پروژه</th>
                <th className="px-4 py-3 text-right font-medium">تاریخ</th>
                <th className="px-4 py-3 text-center font-medium">آیتم‌ها</th>
                <th className="px-4 py-3 text-left font-medium">مبلغ کل</th>
                <th className="px-4 py-3 text-center font-medium">وضعیت</th>
                <th className="px-4 py-3 text-center font-medium">مشاهده</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {reports.data.map((report: any) => (
                <tr key={report.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{report.reportNumber}</td>
                  <td className="px-4 py-3 text-gray-800">
                    <Link href={`/projects/${report.project?.id}`} className="hover:text-blue-600">
                      {report.project?.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {moment(report.reportDate).format('jYYYY/jMM/jDD')}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600">{report._count?.items || report.items?.length || 0}</td>
                  <td className="px-4 py-3 text-left text-gray-600 font-mono">
                    {report.totalAmount > 0 ? Number(report.totalAmount).toLocaleString('fa-IR') : '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[report.approvalStatus] || 'bg-gray-100 text-gray-600'}`}>
                      {statusLabels[report.approvalStatus] || report.approvalStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Link
                      href={`/projects/${report.project?.id}/reports/${report.id}`}
                      className="inline-block rounded p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600"
                    >
                      <Eye size={16} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {reports?.meta && (
        <div className="mt-4">
          <Pagination
            currentPage={reports.meta.page}
            totalPages={reports.meta.totalPages}
            totalItems={reports.meta.total}
            itemsPerPage={reports.meta.limit}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  );
}
