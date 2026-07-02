'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { useToast } from '@/components/ui/toast-provider';
import { PageSkeleton } from '@/components/ui/skeleton';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import {
  FolderKanban,
  UserPlus,
  UserMinus,
  Building2,
  ClipboardList,
  FileImage,
  ShoppingCart,
  FileText,
  Ticket as TicketIcon,
  Eye,
  EyeOff,
  ArrowRight,
} from 'lucide-react';
import moment from 'moment-jalaali';

const TYPE_ICONS: Record<string, React.ReactNode> = {
  PROJECT_CREATED: <FolderKanban size={18} />,
  MEMBER_ADDED: <UserPlus size={18} />,
  MEMBER_REMOVED: <UserMinus size={18} />,
  EMPLOYER_ASSIGNED: <Building2 size={18} />,
  WORK_REPORT: <ClipboardList size={18} />,
  CONTRACTOR_DOC: <FileImage size={18} />,
  PURCHASE_REQUEST: <ShoppingCart size={18} />,
  DOCUMENT: <FileText size={18} />,
  TICKET: <TicketIcon size={18} />,
};

const TYPE_COLORS: Record<string, string> = {
  PROJECT_CREATED: 'bg-green-100 text-green-600',
  MEMBER_ADDED: 'bg-green-100 text-green-600',
  MEMBER_REMOVED: 'bg-orange-100 text-orange-600',
  EMPLOYER_ASSIGNED: 'bg-teal-100 text-teal-600',
  WORK_REPORT: 'bg-emerald-100 text-emerald-600',
  CONTRACTOR_DOC: 'bg-yellow-100 text-yellow-600',
  PURCHASE_REQUEST: 'bg-purple-100 text-purple-600',
  DOCUMENT: 'bg-blue-100 text-blue-600',
  TICKET: 'bg-red-100 text-red-600',
};

const STATUS_LABELS: Record<string, string> = {
  IN_PROGRESS: 'در حال انجام',
  COMPLETED: 'تکمیل شده',
  REJECTED: 'رد شده',
  INFO: 'اطلاع‌رسانی',
};

const STATUS_COLORS: Record<string, string> = {
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  INFO: 'bg-gray-100 text-gray-600',
};

const TYPE_LABELS: Record<string, string> = {
  PROJECT_CREATED: 'ایجاد پروژه',
  MEMBER_ADDED: 'افزودن عضو',
  MEMBER_REMOVED: 'حذف عضو',
  EMPLOYER_ASSIGNED: 'اختصاص کارفرما',
  WORK_REPORT: 'گزارش کار',
  CONTRACTOR_DOC: 'مستندات پیمانکار',
  PURCHASE_REQUEST: 'درخواست خرید',
  DOCUMENT: 'سند',
  TICKET: 'تیکت',
};

const TYPE_LINKS: Record<string, (refId: string, projectId: string) => string> = {
  WORK_REPORT: (refId, projectId) => `/projects/${projectId}/reports/${refId}`,
  CONTRACTOR_DOC: (refId, projectId) => `/projects/${projectId}/contractor-docs/${refId}`,
  PURCHASE_REQUEST: (refId) => `/purchases/${refId}`,
  TICKET: (refId) => `/tickets/${refId}`,
};

export default function ProjectFlowPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const toast = useToast();
  const projectId = params.id as string;

  const [typeFilter, setTypeFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [showHidden, setShowHidden] = useState(false);

  const role = session?.user?.role;
  const isManager = role === 'ADMIN' || role === 'MANAGER';

  const { data: project } = trpc.project.getById.useQuery(
    { id: projectId },
    { enabled: !!projectId }
  );

  const { data: flowItems, isLoading } = trpc.projectFlow.list.useQuery(
    {
      projectId,
      type: typeFilter ? (typeFilter as any) : undefined,
      status: statusFilter ? (statusFilter as any) : undefined,
      includeHidden: showHidden,
    },
    { enabled: !!projectId }
  );

  const { data: stats } = trpc.projectFlow.stats.useQuery(
    { projectId },
    { enabled: !!projectId }
  );

  const toggleHiddenMutation = trpc.projectFlow.toggleHidden.useMutation({
    onSuccess: () => {
      toast.success('وضعیت مورد تغییر کرد');
    },
    onError: (err) => toast.error('خطا', err.message),
  });

  if (status === 'loading') return <PageSkeleton />;
  if (!session) { router.push('/login'); return null; }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <Breadcrumb
          items={[
            { label: 'پروژه‌ها', href: '/projects' },
            { label: project?.name || '...', href: `/projects/${projectId}` },
            { label: 'جریان پروژه' },
          ]}
        />

        {/* Header */}
        <div className="mt-4 mb-6 rounded-lg border border-gray-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-800">جریان پروژه</h1>
              <p className="mt-1 text-sm text-gray-500">
                {project?.name} — {project?.code}
              </p>
            </div>
            <Link
              href={`/projects/${projectId}`}
              className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              <ArrowRight size={16} />
              بازگشت به پروژه
            </Link>
          </div>

          {/* Progress Bar */}
          {stats && (
            <div className="mt-6">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-medium text-gray-700">پیشرفت پروژه</span>
                <span className="text-gray-500">{stats.progressPercent}%</span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-500"
                  style={{ width: `${stats.progressPercent}%` }}
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-3 text-xs">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-blue-500" />
                  در حال انجام: {stats.inProgress}
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-green-500" />
                  تکمیل شده: {stats.completed}
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-red-500" />
                  رد شده: {stats.rejected}
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-gray-400" />
                  اطلاع‌رسانی: {stats.info}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          >
            <option value="">همه انواع</option>
            {Object.entries(TYPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          >
            <option value="">همه وضعیت‌ها</option>
            <option value="IN_PROGRESS">در حال انجام</option>
            <option value="COMPLETED">تکمیل شده</option>
            <option value="REJECTED">رد شده</option>
            <option value="INFO">اطلاع‌رسانی</option>
          </select>

          {isManager && (
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={showHidden}
                onChange={(e) => setShowHidden(e.target.checked)}
                className="rounded border-gray-300"
              />
              نمایش موارد مخفی
            </label>
          )}
        </div>

        {/* Timeline */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-lg bg-white" />
            ))}
          </div>
        ) : !flowItems || flowItems.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-12 text-center text-gray-500">
            هنوز موردی در جریان پروژه ثبت نشده است.
          </div>
        ) : (
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute right-5 top-0 bottom-0 w-0.5 bg-gray-200" />

            <div className="space-y-4">
              {flowItems.map((item) => {
                const linkFn = TYPE_LINKS[item.type];
                const link = linkFn ? linkFn(item.referenceId || '', projectId) : null;

                return (
                  <div
                    key={item.id}
                    className={`relative pr-12 ${item.hidden ? 'opacity-50' : ''}`}
                  >
                    {/* Icon dot */}
                    <div
                      className={`absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full ring-4 ring-gray-50 ${TYPE_COLORS[item.type] || 'bg-gray-100 text-gray-600'}`}
                    >
                      {TYPE_ICONS[item.type] || <FileText size={18} />}
                    </div>

                    {/* Content card */}
                    <div className={`rounded-lg border bg-white p-4 ${item.hidden ? 'border-dashed border-gray-300' : 'border-gray-200'}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-800">{item.title}</span>
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[item.status]}`}>
                              {STATUS_LABELS[item.status]}
                            </span>
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                              {TYPE_LABELS[item.type]}
                            </span>
                            {item.hidden && (
                              <span className="flex items-center gap-1 rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-500">
                                <EyeOff size={12} /> مخفی
                              </span>
                            )}
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                            <span>{moment(item.createdAt).format('jYYYY/jMM/jDD - HH:mm')}</span>
                            <span>•</span>
                            <span>{item.createdBy?.fullName || '—'}</span>
                            {link && (
                              <>
                                <span>•</span>
                                <Link
                                  href={link}
                                  className="flex items-center gap-1 text-blue-600 hover:text-blue-700"
                                >
                                  <Eye size={14} />
                                  مشاهده
                                </Link>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Hide/Show button for managers */}
                        {isManager && (
                          <button
                            onClick={() => toggleHiddenMutation.mutate({ itemId: item.id, hidden: !item.hidden })}
                            className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                            title={item.hidden ? 'نمایش در فلو' : 'مخفی کردن از فلو'}
                          >
                            {item.hidden ? <Eye size={16} /> : <EyeOff size={16} />}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
