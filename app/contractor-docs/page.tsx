'use client';

import { useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import moment from 'moment-jalaali';
import { Search, Eye } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { PageSkeleton, TableSkeleton } from '@/components/ui/skeleton';
import { Pagination } from '@/components/ui/pagination';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'در انتظار',
  APPROVED: 'تایید شده',
  REJECTED: 'رد شده',
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
};

const TYPE_LABELS: Record<string, string> = {
  RECEIPT: 'رسید',
  EXPENSE: 'هزینه جزئی',
  GENERAL: 'عمومی',
};

export default function ContractorDocsManagementPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [projectId, setProjectId] = useState('');
  const [createdById, setCreatedById] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const isManager = session?.user.role === 'ADMIN' || session?.user.role === 'MANAGER';

  const { data: projects } = trpc.project.list.useQuery(
    { page: 1, limit: 100, activeOnly: false },
    { enabled: !!session && isManager }
  );

  const { data: users } = trpc.user.list.useQuery(
    { page: 1, limit: 100 },
    { enabled: !!session && isManager }
  );

  const queryInput = useMemo(() => ({
    page,
    limit: 15,
    search: search || undefined,
    type: (type || undefined) as 'RECEIPT' | 'EXPENSE' | 'GENERAL' | undefined,
    status: (statusFilter || undefined) as 'PENDING' | 'APPROVED' | 'REJECTED' | undefined,
    projectId: projectId || undefined,
    createdById: createdById || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  }), [page, search, type, statusFilter, projectId, createdById, dateFrom, dateTo]);

  const { data: docs, isLoading } = trpc.contractorDoc.listAll.useQuery(queryInput, {
    enabled: !!session && isManager,
  });

  const { data: summary } = trpc.contractorDoc.summary.useQuery(undefined, {
    enabled: !!session && isManager,
  });

  if (status === 'loading') {
    return <PageSkeleton />;
  }

  if (!session) {
    router.push('/login');
    return null;
  }

  if (!isManager) {
    return <div className="p-6 text-center text-gray-500">دسترسی به این صفحه فقط برای مدیران مجاز است</div>;
  }

  return (
    <div className="p-4 md:p-6">
      <Breadcrumb items={[{ label: 'مستندات پیمانکار' }]} />

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-800">مدیریت مستندات پیمانکار</h1>
      </div>

      {summary && (
        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-lg bg-gradient-to-br from-yellow-500 to-yellow-600 p-4 text-white shadow">
            <p className="text-sm opacity-90">در انتظار تایید</p>
            <p className="mt-1 text-2xl font-bold">{summary.pendingCount}</p>
          </div>
          <div className="rounded-lg bg-gradient-to-br from-green-500 to-green-600 p-4 text-white shadow">
            <p className="text-sm opacity-90">مجموع تایید شده</p>
            <p className="mt-1 text-2xl font-bold">{Number(summary.approvedExpenseTotal || 0).toLocaleString('fa-IR')}</p>
          </div>
          <div className="rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 p-4 text-white shadow">
            <p className="text-sm opacity-90">تعداد پروژه در گزارش</p>
            <p className="mt-1 text-2xl font-bold">{summary.byProject?.length || 0}</p>
          </div>
        </div>
      )}

      <div className="mb-4 grid grid-cols-1 gap-3 rounded-lg border border-gray-200 bg-white p-3 md:grid-cols-4">
        <div className="relative md:col-span-2">
          <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="جستجو در شماره، شرح، پروژه، پیمانکار..."
            className="w-full rounded-lg border border-gray-300 py-2 pr-10 pl-3 text-sm"
          />
        </div>

        <select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
          <option value="">همه نوع‌ها</option>
          <option value="RECEIPT">رسید</option>
          <option value="EXPENSE">هزینه جزئی</option>
          <option value="GENERAL">عمومی</option>
        </select>

        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
          <option value="">همه وضعیت‌ها</option>
          <option value="PENDING">در انتظار</option>
          <option value="APPROVED">تایید شده</option>
          <option value="REJECTED">رد شده</option>
        </select>

        <select value={projectId} onChange={(e) => { setProjectId(e.target.value); setPage(1); }} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
          <option value="">همه پروژه‌ها</option>
          {projects?.data?.map((project: any) => (
            <option key={project.id} value={project.id}>{project.name}</option>
          ))}
        </select>

        <select value={createdById} onChange={(e) => { setCreatedById(e.target.value); setPage(1); }} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
          <option value="">همه پیمانکاران</option>
          {users?.data
            ?.filter((user: any) => user.role === 'CONTRACTOR')
            .map((user: any) => (
              <option key={user.id} value={user.id}>{user.fullName}</option>
            ))}
        </select>

        <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
      </div>

      {isLoading ? (
        <TableSkeleton />
      ) : !docs?.data?.length ? (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500">سندی یافت نشد</div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-4 py-3 text-right font-medium">شماره</th>
                  <th className="px-4 py-3 text-right font-medium">پروژه</th>
                  <th className="px-4 py-3 text-right font-medium">پیمانکار</th>
                  <th className="px-4 py-3 text-right font-medium">نوع</th>
                  <th className="px-4 py-3 text-left font-medium">مبلغ</th>
                  <th className="px-4 py-3 text-center font-medium">وضعیت</th>
                  <th className="px-4 py-3 text-right font-medium">تاریخ</th>
                  <th className="px-4 py-3 text-center font-medium">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {docs.data.map((doc: any) => (
                  <tr key={doc.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{doc.docNumber}</td>
                    <td className="px-4 py-3 text-gray-700">{doc.project?.name}</td>
                    <td className="px-4 py-3 text-gray-700">{doc.createdBy?.fullName}</td>
                    <td className="px-4 py-3 text-gray-700">{TYPE_LABELS[doc.type] || doc.type}</td>
                    <td className="px-4 py-3 text-left font-mono text-gray-700">{Number(doc.totalAmount || 0).toLocaleString('fa-IR')}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[doc.approvalStatus] || 'bg-gray-100 text-gray-700'}`}>
                        {STATUS_LABELS[doc.approvalStatus] || doc.approvalStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{moment(doc.docDate).format('jYYYY/jMM/jDD')}</td>
                    <td className="px-4 py-3 text-center">
                      <Link
                        href={`/projects/${doc.projectId}/contractor-docs/${doc.id}`}
                        className="inline-flex rounded p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600"
                      >
                        <Eye size={16} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {docs.meta && (
            <div className="mt-4">
              <Pagination
                currentPage={docs.meta.page}
                totalPages={docs.meta.totalPages}
                totalItems={docs.meta.total}
                itemsPerPage={docs.meta.limit}
                onPageChange={setPage}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
