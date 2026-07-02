'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { useToast } from '@/components/ui/toast-provider';
import { LoadingButton } from '@/components/ui/loading-button';
import { Pagination } from '@/components/ui/pagination';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { PageSkeleton } from '@/components/ui/skeleton';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { Plus, Trash2, Eye, UserPlus, ClipboardList, FileImage, Building2, Activity } from 'lucide-react';
import moment from 'moment-jalaali';

export default function ProjectDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const toast = useToast();
  const projectId = params.id as string;

  const [reportPage, setReportPage] = useState(1);
  const [showAddMember, setShowAddMember] = useState(false);
  const [selectedMember, setSelectedMember] = useState('');
  const [memberRole, setMemberRole] = useState<'ADMIN' | 'TECHNICAL' | 'CONTRACTOR' | 'USER'>('CONTRACTOR');
  const [removeMemberTarget, setRemoveMemberTarget] = useState<{ userId: string; name: string } | null>(null);
  const [deleteReportTarget, setDeleteReportTarget] = useState<{ id: string; number: string } | null>(null);
  const [selectedEmployer, setSelectedEmployer] = useState('');
  const [showAddEmployer, setShowAddEmployer] = useState(false);

  const role = session?.user?.role;
  const isManager = role === 'ADMIN' || role === 'MANAGER';

  const { data: project, isLoading: projectLoading, refetch: refetchProject } = trpc.project.getById.useQuery(
    { id: projectId },
    { enabled: !!projectId }
  );

  const { data: reports, isLoading: reportsLoading, refetch: refetchReports } = trpc.workReport.list.useQuery(
    { projectId, page: reportPage, limit: 10 },
    { enabled: !!projectId }
  );

  const { data: summary } = trpc.project.getSummary.useQuery(
    { id: projectId },
    { enabled: !!projectId }
  );

  const { data: contractors } = trpc.project.listContractors.useQuery(undefined, {
    enabled: isManager && showAddMember && memberRole === 'CONTRACTOR',
  });

  const { data: admins } = trpc.project.listAdmins.useQuery(undefined, {
    enabled: isManager && showAddMember && memberRole === 'ADMIN',
  });

  const { data: technicalStaff } = trpc.project.listTechnical.useQuery(undefined, {
    enabled: isManager && showAddMember && memberRole === 'TECHNICAL',
  });

  const { data: regularUsers } = trpc.project.listUsers.useQuery(undefined, {
    enabled: isManager && showAddMember && memberRole === 'USER',
  });

  const { data: employers } = trpc.project.listEmployers.useQuery(undefined, {
    enabled: isManager && showAddEmployer,
  });

  const assignEmployerMutation = trpc.project.assignEmployer.useMutation({
    onSuccess: () => {
      refetchProject();
      setShowAddEmployer(false);
      setSelectedEmployer('');
      toast.success('کارفرما به پروژه اختصاص یافت');
    },
    onError: (error) => {
      toast.error('خطا', error.message);
    },
  });

  const removeEmployerMutation = trpc.project.removeEmployer.useMutation({
    onSuccess: () => {
      refetchProject();
      toast.success('کارفرما از پروژه حذف شد');
    },
    onError: (error) => {
      toast.error('خطا', error.message);
    },
  });

  const addMemberMutation = trpc.project.addMember.useMutation({
    onSuccess: () => {
      refetchProject();
      setShowAddMember(false);
      setSelectedMember('');
      toast.success('عضو به پروژه اضافه شد');
    },
    onError: (error) => {
      toast.error('خطا', error.message);
    },
  });

  const removeMemberMutation = trpc.project.removeMember.useMutation({
    onSuccess: () => {
      refetchProject();
      toast.success('عضو از پروژه حذف شد');
    },
    onError: (error) => {
      toast.error('خطا', error.message);
    },
  });

  const deleteReportMutation = trpc.workReport.delete.useMutation({
    onSuccess: () => {
      refetchReports();
      toast.success('گزارش کار حذف شد');
    },
    onError: (error) => {
      toast.error('خطا', error.message);
    },
  });

  if (status === 'loading' || projectLoading) return <PageSkeleton />;
  if (!session) { router.push('/login'); return null; }
  if (!project) {
    return (
      <div className="p-6 text-center text-gray-500">
        پروژه یافت نشد
      </div>
    );
  }

  const existingMemberIds = new Set(project.members?.map((m: any) => m.userId) || []);
  const availableByRole: Record<string, any[]> = {
    ADMIN: admins?.filter((c: any) => !existingMemberIds.has(c.id)) || [],
    TECHNICAL: technicalStaff?.filter((c: any) => !existingMemberIds.has(c.id)) || [],
    CONTRACTOR: contractors?.filter((c: any) => !existingMemberIds.has(c.id)) || [],
    USER: regularUsers?.filter((c: any) => !existingMemberIds.has(c.id)) || [],
  };
  const availableMembers = availableByRole[memberRole] || [];

  const roleLabels: Record<string, string> = {
    ADMIN: 'مدیر پروژه',
    TECHNICAL: 'فنی',
    CONTRACTOR: 'پیمانکار',
    USER: 'کاربر',
    MANAGER: 'مسئول سیستم',
    EMPLOYER: 'کارفرما',
  };

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
      <Breadcrumb items={[
        { label: 'پروژه‌ها', href: '/projects' },
        { label: project.name },
      ]} />

      {/* Project Info */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">{project.name}</h1>
            <p className="mt-1 text-sm text-gray-500 font-mono">{project.code}</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href={`/projects/${projectId}/flow`}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
            >
              <Activity size={18} />
              جریان پروژه
            </Link>
            <span className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${
              project.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
            }`}>
              {project.isActive ? 'فعال' : 'غیرفعال'}
            </span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          {project.employerName && (
            <div>
              <span className="text-gray-500">کارفرما:</span>
              <span className="mr-2 font-medium text-gray-800">{project.employerName}</span>
            </div>
          )}
          {project.address && (
            <div>
              <span className="text-gray-500">آدرس:</span>
              <span className="mr-2 font-medium text-gray-800">{project.address}</span>
            </div>
          )}
          {project.startDate && (
            <div>
              <span className="text-gray-500">تاریخ شروع:</span>
              <span className="mr-2 font-medium text-gray-800">
                {moment(project.startDate).format('jYYYY/jMM/jDD')}
              </span>
            </div>
          )}
          {project.endDate && (
            <div>
              <span className="text-gray-500">تاریخ پایان:</span>
              <span className="mr-2 font-medium text-gray-800">
                {moment(project.endDate).format('jYYYY/jMM/jDD')}
              </span>
            </div>
          )}
        </div>
        {project.description && (
          <p className="mt-3 text-sm text-gray-600">{project.description}</p>
        )}
      </div>

      {/* Members Section - Managers only */}
      {isManager && (
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <UserPlus size={20} />
              اعضای پروژه
            </h2>
            <button
              onClick={() => { setShowAddMember(true); setSelectedMember(''); }}
              className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Plus size={14} />
              افزودن عضو
            </button>
          </div>

          {project.members?.length === 0 ? (
            <p className="text-sm text-gray-500">هنوز عضوی به این پروژه اضافه نشده است.</p>
          ) : (
            <div className="space-y-2">
              {project.members?.map((member: any) => (
                <div key={member.userId} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-800">{member.user.fullName}</span>
                    <span className="text-xs text-gray-500">({member.user.username})</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      member.user.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' :
                      member.user.role === 'TECHNICAL' ? 'bg-blue-100 text-blue-700' :
                      member.user.role === 'CONTRACTOR' ? 'bg-orange-100 text-orange-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {roleLabels[member.user.role] || member.user.role}
                    </span>
                  </div>
                  <button
                    onClick={() => setRemoveMemberTarget({ userId: member.userId, name: member.user.fullName })}
                    className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
                    title="حذف از پروژه"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add Member Modal */}
          {showAddMember && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowAddMember(false)}>
              <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl mx-4" onClick={(e) => e.stopPropagation()}>
                <h3 className="mb-4 text-lg font-bold text-gray-800">افزودن عضو به پروژه</h3>

                <div className="mb-3">
                  <label className="mb-1 block text-sm font-medium text-gray-700">نقش</label>
                  <select
                    value={memberRole}
                    onChange={(e) => { setMemberRole(e.target.value as any); setSelectedMember(''); }}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="ADMIN">مدیر پروژه</option>
                    <option value="TECHNICAL">فنی</option>
                    <option value="CONTRACTOR">پیمانکار</option>
                    <option value="USER">کاربر</option>
                  </select>
                </div>

                {availableMembers.length === 0 ? (
                  <p className="text-sm text-gray-500">کاربری با این نقش برای افزودن وجود ندارد. ابتدا از بخش کاربران یک کاربر با این نقش ایجاد کنید.</p>
                ) : (
                  <>
                    <select
                      value={selectedMember}
                      onChange={(e) => setSelectedMember(e.target.value)}
                      className="mb-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="">انتخاب کاربر...</option>
                      {availableMembers.map((c: any) => (
                        <option key={c.id} value={c.id}>{c.fullName} ({c.username})</option>
                      ))}
                    </select>
                    <div className="flex justify-end gap-3">
                      <button
                        onClick={() => setShowAddMember(false)}
                        className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        انصراف
                      </button>
                      <LoadingButton
                        onClick={() => {
                          if (selectedMember) {
                            addMemberMutation.mutate({ projectId, userId: selectedMember });
                          }
                        }}
                        isLoading={addMemberMutation.isPending}
                        disabled={!selectedMember}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        افزودن
                      </LoadingButton>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Remove Member Confirm */}
          <ConfirmDialog
            open={!!removeMemberTarget}
            title="حذف عضو"
            message={`آیا از حذف «${removeMemberTarget?.name}» از این پروژه مطمئن هستید؟`}
            confirmText="حذف"
            cancelText="انصراف"
            variant="danger"
            loading={removeMemberMutation.isPending}
            onConfirm={() => {
              if (removeMemberTarget) {
                removeMemberMutation.mutate(
                  { projectId, userId: removeMemberTarget.userId },
                  { onSuccess: () => setRemoveMemberTarget(null) }
                );
              }
            }}
            onClose={() => setRemoveMemberTarget(null)}
          />
        </div>
      )}

      {/* Employer Section - Managers only */}
      {isManager && (
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <Building2 size={20} />
              کارفرمای پروژه
            </h2>
            {!project.employerUser && (
              <button
                onClick={() => setShowAddEmployer(true)}
                className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
              >
                <Plus size={14} />
                اختصاص کارفرما
              </button>
            )}
          </div>

          {project.employerUser ? (
            <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-2">
              <div>
                <span className="font-medium text-gray-800">{project.employerUser.fullName}</span>
                <span className="mr-2 text-xs text-gray-500">({project.employerUser.username})</span>
              </div>
              <button
                onClick={() => removeEmployerMutation.mutate({ projectId })}
                className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
                title="حذف کارفرما"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ) : (
            <p className="text-sm text-gray-500">هنوز کارفرمایی به این پروژه اختصاص نیافته است.</p>
          )}

          {/* Add Employer Modal */}
          {showAddEmployer && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowAddEmployer(false)}>
              <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl mx-4" onClick={(e) => e.stopPropagation()}>
                <h3 className="mb-4 text-lg font-bold text-gray-800">انتخاب کارفرما</h3>
                {!employers?.length ? (
                  <p className="text-sm text-gray-500">کارفرمایی برای انتخاب وجود ندارد. ابتدا از بخش کاربران یک کاربر با نقش EMPLOYER ایجاد کنید.</p>
                ) : (
                  <>
                    <select
                      value={selectedEmployer}
                      onChange={(e) => setSelectedEmployer(e.target.value)}
                      className="mb-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="">انتخاب کارفرما...</option>
                      {employers.map((e: any) => (
                        <option key={e.id} value={e.id}>{e.fullName} ({e.username})</option>
                      ))}
                    </select>
                    <div className="flex justify-end gap-3">
                      <button
                        onClick={() => setShowAddEmployer(false)}
                        className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        انصراف
                      </button>
                      <LoadingButton
                        onClick={() => {
                          if (selectedEmployer) {
                            assignEmployerMutation.mutate({ projectId, userId: selectedEmployer });
                          }
                        }}
                        isLoading={assignEmployerMutation.isPending}
                        disabled={!selectedEmployer}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        اختصاص
                      </LoadingButton>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Financial Summary */}
      {summary && (
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          {(() => {
            const wrApproved = summary.workReports.find((g: any) => g.approvalStatus === 'APPROVED');
            const wrPending = summary.workReports.find((g: any) => g.approvalStatus === 'PENDING');
            const docApproved = summary.contractorDocs.find((g: any) => g.approvalStatus === 'APPROVED');
            const docPending = summary.contractorDocs.find((g: any) => g.approvalStatus === 'PENDING');
            return (
              <>
                <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                  <p className="text-xs text-green-700">گزارش‌های تاییدشده</p>
                  <p className="mt-1 text-2xl font-bold text-green-800">{wrApproved?._count?._all ?? 0}</p>
                  <p className="mt-1 text-xs text-green-600 font-mono">
                    {wrApproved?._sum?.totalAmount ? Number(wrApproved._sum.totalAmount).toLocaleString('fa-IR') : '۰'} تومان
                  </p>
                </div>
                <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
                  <p className="text-xs text-yellow-700">گزارش‌های در انتظار</p>
                  <p className="mt-1 text-2xl font-bold text-yellow-800">{wrPending?._count?._all ?? 0}</p>
                </div>
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                  <p className="text-xs text-blue-700">اسناد تاییدشده</p>
                  <p className="mt-1 text-2xl font-bold text-blue-800">{docApproved?._count?._all ?? 0}</p>
                  <p className="mt-1 text-xs text-blue-600 font-mono">
                    {docApproved?._sum?.totalAmount ? Number(docApproved._sum.totalAmount).toLocaleString('fa-IR') : '۰'} تومان
                  </p>
                </div>
                <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
                  <p className="text-xs text-orange-700">اسناد در انتظار</p>
                  <p className="mt-1 text-2xl font-bold text-orange-800">{docPending?._count?._all ?? 0}</p>
                </div>
              </>
            );
          })()}

          {summary.purchases?.map((p: any) => (
            <div key={p.status} className="rounded-lg border border-gray-200 bg-white p-3">
              <p className="text-xs text-gray-500">
                {p.status === 'DRAFT' ? 'خرید پیش‌نویس' :
                 p.status === 'PENDING_INQUIRY' ? 'در انتظار استعلام' :
                 p.status === 'INQUIRED' ? 'استعلام‌شده' :
                 p.status === 'APPROVED' ? 'خرید تاییدشده' :
                 p.status === 'REJECTED' ? 'خرید ردشده' :
                 p.status === 'PURCHASED' ? 'خریداری‌شده' : p.status}
              </p>
              <p className="text-lg font-bold text-gray-900">{p._count._all}</p>
            </div>
          ))}
          {summary.totalPurchaseAmount > 0 && (
            <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3">
              <p className="text-xs text-indigo-500">مبلغ کل خرید</p>
              <p className="text-lg font-bold text-indigo-900">
                {Number(summary.totalPurchaseAmount).toLocaleString('fa-IR')}
                <span className="text-xs font-normal mr-1">تومان</span>
              </p>
            </div>
          )}
        </div>
      )}

      {/* Work Reports Section */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <ClipboardList size={20} />
            گزارش‌های کار
          </h2>
          <div className="flex items-center gap-2">
            <Link
              href={`/projects/${projectId}/contractor-docs`}
              className="flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <FileImage size={14} />
              مستندات پیمانکار
            </Link>
            <Link
              href={`/projects/${projectId}/reports/new`}
              className="flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700"
            >
              <Plus size={14} />
              گزارش جدید
            </Link>
          </div>
        </div>

        {reportsLoading ? (
          <div className="py-8 text-center text-gray-400">در حال بارگذاری...</div>
        ) : !reports?.data?.length ? (
          <p className="py-4 text-sm text-gray-500 text-center">هنوز گزارش کاری ثبت نشده است.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-4 py-3 text-right font-medium">شماره گزارش</th>
                  <th className="px-4 py-3 text-right font-medium">تاریخ</th>
                  <th className="px-4 py-3 text-right font-medium">ثبت‌کننده</th>
                  <th className="px-4 py-3 text-center font-medium">تعداد آیتم</th>
                  <th className="px-4 py-3 text-left font-medium">مبلغ کل</th>
                  <th className="px-4 py-3 text-center font-medium">وضعیت</th>
                  <th className="px-4 py-3 text-center font-medium">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {reports.data.map((report: any) => (
                  <tr key={report.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{report.reportNumber}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {moment(report.reportDate).format('jYYYY/jMM/jDD')}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{report.createdBy?.fullName}</td>
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
                          href={`/projects/${projectId}/reports/${report.id}`}
                          className="rounded p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                          title="مشاهده"
                        >
                          <Eye size={16} />
                        </Link>
                        {(isManager || (role === 'CONTRACTOR' && report.approvalStatus !== 'APPROVED')) && (
                          <button
                            onClick={() => setDeleteReportTarget({ id: report.id, number: report.reportNumber })}
                            className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                            title="حذف"
                          >
                            <Trash2 size={16} />
                          </button>
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
              onPageChange={setReportPage}
            />
          </div>
        )}
      </div>

      {/* Delete Report Confirm */}
      <ConfirmDialog
        open={!!deleteReportTarget}
        title="حذف گزارش کار"
        message={`آیا از حذف گزارش «${deleteReportTarget?.number}» مطمئن هستید؟`}
        confirmText="حذف"
        cancelText="انصراف"
        variant="danger"
        loading={deleteReportMutation.isPending}
        onConfirm={() => {
          if (deleteReportTarget) {
            deleteReportMutation.mutate(
              { id: deleteReportTarget.id },
              { onSuccess: () => setDeleteReportTarget(null) }
            );
          }
        }}
        onClose={() => setDeleteReportTarget(null)}
      />
    </div>
  );
}
