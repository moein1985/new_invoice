'use client';

import { useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import moment from 'moment-jalaali';
import { Search, Plus, Eye, Paperclip, FileText } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { PageSkeleton, TableSkeleton } from '@/components/ui/skeleton';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { Pagination } from '@/components/ui/pagination';

const TYPE_LABELS: Record<string, string> = {
  RECEIPT: 'رسید',
  EXPENSE: 'هزینه جزئی',
  GENERAL: 'عمومی',
};

const TYPE_COLORS: Record<string, string> = {
  RECEIPT: 'bg-blue-100 text-blue-700',
  EXPENSE: 'bg-amber-100 text-amber-700',
  GENERAL: 'bg-gray-100 text-gray-700',
};

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

export default function ProjectContractorDocsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const { data: project, isLoading: projectLoading } = trpc.project.getById.useQuery(
    { id: projectId },
    { enabled: !!projectId }
  );

  const queryInput = useMemo(() => ({
    projectId,
    page,
    limit: 12,
    search: search || undefined,
    type: (typeFilter || undefined) as 'RECEIPT' | 'EXPENSE' | 'GENERAL' | undefined,
    status: (statusFilter || undefined) as 'PENDING' | 'APPROVED' | 'REJECTED' | undefined,
  }), [projectId, page, search, typeFilter, statusFilter]);

  const { data: docs, isLoading } = trpc.contractorDoc.list.useQuery(queryInput, {
    enabled: !!projectId && !!session,
  });

  if (status === 'loading' || projectLoading) {
    return <PageSkeleton />;
  }

  if (!session) {
    router.push('/login');
    return null;
  }

  if (!project) {
    return <div className="p-6 text-center text-gray-500">پروژه یافت نشد</div>;
  }

  return (
    <div className="p-4 md:p-6">
      <Breadcrumb
        items={[
          { label: 'پروژه‌ها', href: '/projects' },
          { label: project.name, href: `/projects/${projectId}` },
          { label: 'مستندات پیمانکار' },
        ]}
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">مستندات پیمانکار</h1>
          <p className="text-sm text-gray-500">پروژه {project.name}</p>
        </div>
        <Link
          href={`/projects/${projectId}/contractor-docs/new`}
          className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus size={16} />
          ثبت سند جدید
        </Link>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="جستجو در شماره و شرح سند..."
            className="w-full rounded-lg border border-gray-300 py-2 pr-10 pl-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        >
          <option value="">همه نوع‌ها</option>
          <option value="RECEIPT">رسید</option>
          <option value="EXPENSE">هزینه جزئی</option>
          <option value="GENERAL">عمومی</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        >
          <option value="">همه وضعیت‌ها</option>
          <option value="PENDING">در انتظار</option>
          <option value="APPROVED">تایید شده</option>
          <option value="REJECTED">رد شده</option>
        </select>
      </div>

      {isLoading ? (
        <TableSkeleton />
      ) : !docs?.data?.length ? (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500">
          سندی برای نمایش وجود ندارد
        </div>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-lg border border-gray-200 bg-white md:block">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-4 py-3 text-right font-medium">شماره سند</th>
                  <th className="px-4 py-3 text-right font-medium">نوع</th>
                  <th className="px-4 py-3 text-right font-medium">شرح</th>
                  <th className="px-4 py-3 text-left font-medium">مبلغ</th>
                  <th className="px-4 py-3 text-center font-medium">وضعیت</th>
                  <th className="px-4 py-3 text-right font-medium">تاریخ</th>
                  <th className="px-4 py-3 text-center font-medium">پیوست</th>
                  <th className="px-4 py-3 text-center font-medium">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {docs.data.map((doc: any) => (
                  <tr key={doc.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{doc.docNumber}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_COLORS[doc.type] || 'bg-gray-100 text-gray-700'}`}>
                        {TYPE_LABELS[doc.type] || doc.type}
                      </span>
                    </td>
                    <td className="max-w-xs truncate px-4 py-3 text-gray-700" title={doc.description}>
                      {doc.description}
                    </td>
                    <td className="px-4 py-3 text-left font-mono text-gray-700">
                      {doc.totalAmount > 0 ? Number(doc.totalAmount).toLocaleString('fa-IR') : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[doc.approvalStatus] || 'bg-gray-100 text-gray-700'}`}>
                        {STATUS_LABELS[doc.approvalStatus] || doc.approvalStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{moment(doc.docDate).format('jYYYY/jMM/jDD')}</td>
                    <td className="px-4 py-3 text-center text-gray-600">{doc._count?.attachments || 0}</td>
                    <td className="px-4 py-3 text-center">
                      <Link
                        href={`/projects/${projectId}/contractor-docs/${doc.id}`}
                        className="inline-flex rounded p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600"
                        title="مشاهده"
                      >
                        <Eye size={16} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {docs.data.map((doc: any) => (
              <Link
                key={doc.id}
                href={`/projects/${projectId}/contractor-docs/${doc.id}`}
                className="block rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
              >
                <div className="mb-2 flex items-start justify-between gap-3">
                  <span className="font-mono text-xs text-gray-500">{doc.docNumber}</span>
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[doc.approvalStatus] || 'bg-gray-100 text-gray-700'}`}>
                    {STATUS_LABELS[doc.approvalStatus] || doc.approvalStatus}
                  </span>
                </div>
                <div className="mb-2 flex items-center gap-2">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_COLORS[doc.type] || 'bg-gray-100 text-gray-700'}`}>
                    {TYPE_LABELS[doc.type] || doc.type}
                  </span>
                </div>
                <p className="line-clamp-2 text-sm text-gray-700">{doc.description}</p>
                <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                  <span>{moment(doc.docDate).format('jYYYY/jMM/jDD')}</span>
                  <span className="inline-flex items-center gap-1">
                    <Paperclip size={12} />
                    {doc._count?.attachments || 0}
                  </span>
                  <span className="font-mono text-gray-700">
                    {doc.totalAmount > 0 ? Number(doc.totalAmount).toLocaleString('fa-IR') : '—'}
                  </span>
                </div>
              </Link>
            ))}
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
