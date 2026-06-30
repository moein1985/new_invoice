'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { Pagination } from '@/components/ui/pagination';
import { PageSkeleton, TableSkeleton } from '@/components/ui/skeleton';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { Search, Eye, CheckCircle, XCircle } from 'lucide-react';
import { useToast } from '@/components/ui/toast-provider';
import moment from 'moment-jalaali';

export default function WorkReportsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('');

  const role = session?.user?.role;

  const { data: reports, isLoading, refetch } = trpc.workReport.listAll.useQuery(
    {
      page,
      limit: 15,
      search: search || undefined,
      approvalStatus: statusFilter ? (statusFilter as 'PENDING' | 'APPROVED' | 'REJECTED') : undefined,
    },
    { enabled: !!session && (role === 'ADMIN' || role === 'MANAGER') }
  );

  const approveMutation = trpc.workReport.approve.useMutation({
    onSuccess: () => { refetch(); toast.success('گزارش تایید شد'); },
    onError: (err) => toast.error('خطا', err.message),
  });

  const rejectMutation = trpc.workReport.reject.useMutation({
    onSuccess: () => { refetch(); toast.success('گزارش رد شد'); },
    onError: (err) => toast.error('خطا', err.message),
  });

  if (status === 'loading') return <PageSkeleton />;
  if (!session) { router.push('/login'); return null; }
  if (role !== 'ADMIN' && role !== 'MANAGER') {
    return <div className="p-6 text-center text-gray-500">شما دسترسی به این بخش ندارید.</div>;
  }

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

  return (
    <div className="p-4 md:p-6">
      <Breadcrumb items={[{ label: 'گزارش کار' }]} />

      <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-800">گزارش‌های کار</h1>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="جستجو در شماره گزارش، پروژه، پیمانکار..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full rounded-lg border border-gray-300 py-2 pr-10 pl-4 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>
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
                <th className="px-4 py-3 text-right font-medium">پیمانکار</th>
                <th className="px-4 py-3 text-right font-medium">تاریخ</th>
                <th className="px-4 py-3 text-center font-medium">آیتم‌ها</th>
                <th className="px-4 py-3 text-left font-medium">مبلغ کل</th>
                <th className="px-4 py-3 text-center font-medium">وضعیت</th>
                <th className="px-4 py-3 text-center font-medium">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {reports.data.map((report: any) => (
                <tr key={report.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{report.reportNumber}</td>
                  <td className="px-4 py-3 text-gray-800">
                    <Link href={`/projects/${report.project.id}`} className="hover:text-blue-600">
                      {report.project.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{report.createdBy?.fullName}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {moment(report.reportDate).format('jYYYY/jMM/jDD')}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600">{report._count?.items || 0}</td>
                  <td className="px-4 py-3 text-left text-gray-600 font-mono">
                    {report.totalAmount > 0 ? report.totalAmount.toLocaleString('fa-IR') : '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                      statusColors[report.approvalStatus] || 'bg-gray-100 text-gray-600'
                    }`}>
                      {statusLabels[report.approvalStatus] || report.approvalStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <Link
                        href={`/projects/${report.project.id}/reports/${report.id}`}
                        className="rounded p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                        title="مشاهده و ویرایش"
                      >
                        <Eye size={16} />
                      </Link>
                      {report.approvalStatus === 'PENDING' && (
                        <>
                          <button
                            onClick={() => approveMutation.mutate({ id: report.id })}
                            disabled={approveMutation.isPending}
                            className="rounded p-1.5 text-gray-400 hover:bg-green-50 hover:text-green-600 transition-colors"
                            title="تایید"
                          >
                            <CheckCircle size={16} />
                          </button>
                          <button
                            onClick={() => rejectMutation.mutate({ id: report.id })}
                            disabled={rejectMutation.isPending}
                            className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                            title="رد"
                          >
                            <XCircle size={16} />
                          </button>
                        </>
                      )}
                    </div>
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
