'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { PageSkeleton } from '@/components/ui/skeleton';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { useToast } from '@/components/ui/toast-provider';
import { LoadingButton } from '@/components/ui/loading-button';
import { JalaliDatePicker } from '@/components/ui/jalali-date-picker';
import { FolderKanban, ClipboardList, Plus, Eye, X, Zap } from 'lucide-react';
import moment from 'moment-jalaali';

const UNITS = ['متر', 'عدد', 'کیلوگرم', 'مترمربع', 'مترمکعب', 'شاخه', 'تن', 'لیتر', 'سایر'];

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

export default function ContractorDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const toast = useToast();

  const [quickReportOpen, setQuickReportOpen] = useState(false);
  const [qrProjectId, setQrProjectId] = useState('');
  const [qrDescription, setQrDescription] = useState('');
  const [qrUnit, setQrUnit] = useState('متر');
  const [qrQuantity, setQrQuantity] = useState('0');
  const [qrDate, setQrDate] = useState(moment().format('YYYY-MM-DD'));

  const { data: projects, isLoading: projectsLoading } = trpc.project.list.useQuery(
    { page: 1, limit: 100, activeOnly: true },
    { enabled: !!session && session.user.role === 'CONTRACTOR' }
  );

  const { data: myReports, refetch: refetchReports } = trpc.workReport.listMine.useQuery(
    { page: 1, limit: 5 },
    { enabled: !!session }
  );

  const { data: myDocs } = trpc.contractorDoc.listMine.useQuery(
    { page: 1, limit: 5 },
    { enabled: !!session }
  );

  const createReportMutation = trpc.workReport.create.useMutation({
    onSuccess: () => {
      toast.success('گزارش سریع ثبت شد');
      setQuickReportOpen(false);
      setQrProjectId('');
      setQrDescription('');
      setQrUnit('متر');
      setQrQuantity('0');
      setQrDate(moment().format('YYYY-MM-DD'));
      refetchReports();
    },
    onError: (err) => toast.error('خطا در ثبت گزارش', err.message),
  });

  const handleQuickReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!qrProjectId) { toast.error('انتخاب پروژه الزامی است'); return; }
    if (!qrDescription.trim()) { toast.error('شرح عملیات الزامی است'); return; }
    createReportMutation.mutate({
      projectId: qrProjectId,
      reportDate: qrDate,
      items: [{ description: qrDescription.trim(), unit: qrUnit, quantity: parseFloat(qrQuantity) || 0 }],
    });
  };

  if (status === 'loading') return <PageSkeleton />;
  if (!session) { router.push('/login'); return null; }
  if (session.user.role !== 'CONTRACTOR') {
    router.push('/dashboard');
    return null;
  }

  const pendingReports = myReports?.data?.filter((r: any) => r.approvalStatus === 'PENDING').length ?? 0;
  const approvedReports = myReports?.data?.filter((r: any) => r.approvalStatus === 'APPROVED').length ?? 0;
  const rejectedReports = myReports?.data?.filter((r: any) => r.approvalStatus === 'REJECTED').length ?? 0;

  return (
    <div className="p-4 md:p-6">
      <Breadcrumb items={[{ label: 'داشبورد' }]} />

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">
          خوش آمدید، {session.user.name}
        </h1>
        <button
          onClick={() => setQuickReportOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Zap size={16} />
          ثبت گزارش سریع
        </button>
      </div>

      {/* Stats */}
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg bg-gradient-to-br from-yellow-500 to-yellow-600 p-5 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">گزارش‌های در انتظار</p>
              <p className="mt-1 text-3xl font-bold">{pendingReports}</p>
            </div>
            <ClipboardList className="h-9 w-9 opacity-80" />
          </div>
        </div>
        <div className="rounded-lg bg-gradient-to-br from-green-500 to-green-600 p-5 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">گزارش‌های تایید شده</p>
              <p className="mt-1 text-3xl font-bold">{approvedReports}</p>
            </div>
            <ClipboardList className="h-9 w-9 opacity-80" />
          </div>
        </div>
        <div className="rounded-lg bg-gradient-to-br from-red-500 to-red-600 p-5 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">گزارش‌های رد شده</p>
              <p className="mt-1 text-3xl font-bold">{rejectedReports}</p>
            </div>
            <ClipboardList className="h-9 w-9 opacity-80" />
          </div>
        </div>
      </div>

      {/* Projects */}
      <div className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">پروژه‌های من</h2>
        </div>
        {projectsLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 animate-pulse rounded-lg bg-gray-200" />
            ))}
          </div>
        ) : !projects?.data?.length ? (
          <div className="rounded-lg border border-gray-200 bg-white p-6 text-center text-gray-500">
            شما در هیچ پروژه‌ای عضو نیستید.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.data.map((project: any) => (
              <div
                key={project.id}
                className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="mb-3 flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-800">{project.name}</h3>
                    <p className="mt-1 text-xs text-gray-500">{project.code}</p>
                  </div>
                  <FolderKanban className="h-8 w-8 text-blue-400" />
                </div>
                <div className="flex gap-2">
                  <Link
                    href={`/projects/${project.id}`}
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-center text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    مشاهده پروژه
                  </Link>
                  <Link
                    href={`/projects/${project.id}/reports/new`}
                    className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-center text-xs font-medium text-white hover:bg-blue-700"
                  >
                    <Plus size={12} className="ml-1 inline" />
                    گزارش جدید
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Reports */}
      <div className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">آخرین گزارش‌های من</h2>
          <Link href="/my-reports" className="text-sm text-blue-600 hover:text-blue-800">
            مشاهده همه
          </Link>
        </div>
        {!myReports?.data?.length ? (
          <div className="rounded-lg border border-gray-200 bg-white p-6 text-center text-gray-500">
            هنوز گزارشی ثبت نکرده‌اید.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-4 py-3 text-right font-medium">شماره</th>
                  <th className="px-4 py-3 text-right font-medium">پروژه</th>
                  <th className="px-4 py-3 text-right font-medium">تاریخ</th>
                  <th className="px-4 py-3 text-left font-medium">مبلغ کل</th>
                  <th className="px-4 py-3 text-center font-medium">وضعیت</th>
                  <th className="px-4 py-3 text-center font-medium">مشاهده</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {myReports.data.map((report: any) => (
                  <tr key={report.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{report.reportNumber}</td>
                    <td className="px-4 py-3 text-gray-800">{report.project?.name}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {moment(report.reportDate).format('jYYYY/jMM/jDD')}
                    </td>
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
      </div>

      {/* Quick Report Modal */}
      {quickReportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-800">ثبت گزارش سریع</h2>
              <button onClick={() => setQuickReportOpen(false)} className="rounded p-1 text-gray-400 hover:bg-gray-100">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleQuickReport} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">پروژه</label>
                <select
                  value={qrProjectId}
                  onChange={(e) => setQrProjectId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">انتخاب پروژه...</option>
                  {projects?.data?.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">شرح عملیات</label>
                <input
                  type="text"
                  value={qrDescription}
                  onChange={(e) => setQrDescription(e.target.value)}
                  placeholder="شرح عملیات انجام شده..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">واحد</label>
                  <select
                    value={qrUnit}
                    onChange={(e) => setQrUnit(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  >
                    {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">مقدار</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={qrQuantity}
                    onChange={(e) => setQrQuantity(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">تاریخ</label>
                <JalaliDatePicker value={qrDate} onChange={setQrDate} className="h-10" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setQuickReportOpen(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  انصراف
                </button>
                <LoadingButton
                  type="submit"
                  isLoading={createReportMutation.isPending}
                  className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                >
                  ثبت گزارش
                </LoadingButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Recent Docs */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">آخرین مستندات من</h2>
          <Link href="/my-docs" className="text-sm text-blue-600 hover:text-blue-800">
            مشاهده همه
          </Link>
        </div>
        {!myDocs?.data?.length ? (
          <div className="rounded-lg border border-gray-200 bg-white p-6 text-center text-gray-500">
            هنوز مستندی ثبت نکرده‌اید.
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
                  <th className="px-4 py-3 text-center font-medium">پیوست</th>
                  <th className="px-4 py-3 text-center font-medium">وضعیت</th>
                  <th className="px-4 py-3 text-center font-medium">مشاهده</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {myDocs.data.map((doc: any) => (
                  <tr key={doc.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{doc.docNumber}</td>
                    <td className="px-4 py-3 text-gray-800">{doc.project?.name}</td>
                    <td className="px-4 py-3 text-gray-600">{docTypeLabels[doc.type] || doc.type}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {moment(doc.docDate).format('jYYYY/jMM/jDD')}
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
      </div>
    </div>
  );
}
