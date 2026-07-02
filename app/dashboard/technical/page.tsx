'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { PageSkeleton } from '@/components/ui/skeleton';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { FolderKanban, ClipboardList, FileImage } from 'lucide-react';
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

export default function TechnicalDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const { data: projects, isLoading: projectsLoading } = trpc.project.list.useQuery(
    { page: 1, limit: 100, activeOnly: true },
    { enabled: !!session && session.user.role === 'TECHNICAL' }
  );

  const { data: myReports } = trpc.workReport.listMine.useQuery(
    { page: 1, limit: 5 },
    { enabled: !!session && session.user.role === 'TECHNICAL' }
  );

  const { data: myDocs } = trpc.contractorDoc.listMine.useQuery(
    { page: 1, limit: 5 },
    { enabled: !!session && session.user.role === 'TECHNICAL' }
  );

  if (status === 'loading' || projectsLoading) return <PageSkeleton />;

  if (!session || session.user.role !== 'TECHNICAL') {
    router.push('/dashboard');
    return null;
  }

  const stats = [
    {
      label: 'پروژه‌های من',
      value: projects?.meta.total ?? 0,
      icon: <FolderKanban size={24} />,
      href: '/projects',
      color: 'bg-blue-50 text-blue-600',
    },
    {
      label: 'گزارش‌های من',
      value: myReports?.meta.total ?? 0,
      icon: <ClipboardList size={24} />,
      href: '/my-reports',
      color: 'bg-purple-50 text-purple-600',
    },
    {
      label: 'مستندات من',
      value: myDocs?.meta.total ?? 0,
      icon: <FileImage size={24} />,
      href: '/my-docs',
      color: 'bg-orange-50 text-orange-600',
    },
  ];

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'داشبورد فنی' }]} />

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">داشبورد فنی</h1>
        <p className="text-sm text-gray-500">{session.user.name}</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md"
          >
            <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${stat.color}`}>
              {stat.icon}
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{stat.value}</p>
              <p className="text-sm text-gray-500">{stat.label}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Recent work reports */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">آخرین گزارش‌های کار</h2>
          <Link href="/my-reports" className="text-sm text-blue-600 hover:underline">
            مشاهده همه
          </Link>
        </div>
        {myReports?.data.length === 0 ? (
          <p className="text-sm text-gray-400">گزارشی ثبت نشده است</p>
        ) : (
          <div className="space-y-2">
            {myReports?.data.map((report) => (
              <Link
                key={report.id}
                href={`/work-reports/${report.id}`}
                className="flex items-center justify-between rounded-lg border border-gray-100 p-3 transition hover:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  <ClipboardList size={18} className="text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-700">{report.reportNumber}</p>
                    <p className="text-xs text-gray-400">
                      {report.project?.name} • {moment(report.reportDate).format('jYYYY/jMM/jDD')}
                    </p>
                  </div>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[report.approvalStatus]}`}>
                  {statusLabels[report.approvalStatus]}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Recent contractor docs */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">آخرین مستندات</h2>
          <Link href="/my-docs" className="text-sm text-blue-600 hover:underline">
            مشاهده همه
          </Link>
        </div>
        {myDocs?.data.length === 0 ? (
          <p className="text-sm text-gray-400">مستندی ثبت نشده است</p>
        ) : (
          <div className="space-y-2">
            {myDocs?.data.map((doc) => (
              <Link
                key={doc.id}
                href={`/projects/${doc.projectId}/contractor-docs/${doc.id}`}
                className="flex items-center justify-between rounded-lg border border-gray-100 p-3 transition hover:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  <FileImage size={18} className="text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-700">{doc.docNumber}</p>
                    <p className="text-xs text-gray-400">
                      {doc.project?.name} • {moment(doc.docDate).format('jYYYY/jMM/jDD')}
                    </p>
                  </div>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[doc.approvalStatus]}`}>
                  {statusLabels[doc.approvalStatus]}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
