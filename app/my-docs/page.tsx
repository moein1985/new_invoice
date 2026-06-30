'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { Pagination } from '@/components/ui/pagination';
import { PageSkeleton, TableSkeleton } from '@/components/ui/skeleton';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { Eye } from 'lucide-react';
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

const docTypeLabels: Record<string, string> = {
  RECEIPT: 'رسید',
  EXPENSE: 'هزینه',
  GENERAL: 'سایر',
};

export default function MyDocsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('');

  const { data: docs, isLoading } = trpc.contractorDoc.listMine.useQuery(
    {
      page,
      limit: 15,
      status: statusFilter ? (statusFilter as 'PENDING' | 'APPROVED' | 'REJECTED') : undefined,
    },
    { enabled: !!session }
  );

  if (status === 'loading') return <PageSkeleton />;
  if (!session) { router.push('/login'); return null; }

  return (
    <div className="p-4 md:p-6">
      <Breadcrumb items={[{ label: 'مستندات من' }]} />

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">مستندات من</h1>
      </div>

      {/* Filter */}
      <div className="mb-4 flex flex-col sm:flex-row gap-3">
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
      ) : !docs?.data?.length ? (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500">
          مستندی یافت نشد
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-4 py-3 text-right font-medium">شماره</th>
                <th className="px-4 py-3 text-right font-medium">پروژه</th>
                <th className="px-4 py-3 text-right font-medium">نوع</th>
                <th className="px-4 py-3 text-right font-medium">تاریخ</th>
                <th className="px-4 py-3 text-left font-medium">مبلغ کل</th>
                <th className="px-4 py-3 text-center font-medium">پیوست</th>
                <th className="px-4 py-3 text-center font-medium">وضعیت</th>
                <th className="px-4 py-3 text-center font-medium">مشاهده</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {docs.data.map((doc: any) => (
                <tr key={doc.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{doc.docNumber}</td>
                  <td className="px-4 py-3 text-gray-800">
                    <Link href={`/projects/${doc.project?.id}`} className="hover:text-blue-600">
                      {doc.project?.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{docTypeLabels[doc.type] || doc.type}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {moment(doc.docDate).format('jYYYY/jMM/jDD')}
                  </td>
                  <td className="px-4 py-3 text-left text-gray-600 font-mono">
                    {doc.totalAmount > 0 ? Number(doc.totalAmount).toLocaleString('fa-IR') : '—'}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600">{doc._count?.attachments || 0}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[doc.approvalStatus] || 'bg-gray-100 text-gray-600'}`}>
                      {statusLabels[doc.approvalStatus] || doc.approvalStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Link
                      href={`/projects/${doc.project?.id}/contractor-docs/${doc.id}`}
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

      {docs?.meta && (
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
    </div>
  );
}
