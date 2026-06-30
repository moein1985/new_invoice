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
import { Plus, Trash2, Eye, UserPlus, ClipboardList, FileImage } from 'lucide-react';
import moment from 'moment-jalaali';

export default function ProjectDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const toast = useToast();
  const projectId = params.id as string;

  const [reportPage, setReportPage] = useState(1);
  const [showAddMember, setShowAddMember] = useState(false);
  const [selectedContractor, setSelectedContractor] = useState('');
  const [removeMemberTarget, setRemoveMemberTarget] = useState<{ userId: string; name: string } | null>(null);
  const [deleteReportTarget, setDeleteReportTarget] = useState<{ id: string; number: string } | null>(null);

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
    enabled: isManager && showAddMember,
  });

  const addMemberMutation = trpc.project.addMember.useMutation({
    onSuccess: () => {
      refetchProject();
      setShowAddMember(false);
      setSelectedContractor('');
      toast.success('پیمانکار به پروژه اضافه شد');
    },
    onError: (error) => {
      toast.error('خطا', error.message);
    },
  });

  const removeMemberMutation = trpc.project.removeMember.useMutation({
    onSuccess: () => {
      refetchProject();
      toast.success('پیمانکار از پروژه حذف شد');
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
  const availableContractors = contractors?.filter((c: any) => !existingMemberIds.has(c.id)) || [];

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
          <span className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${
            project.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
          }`}>
            {project.isActive ? 'فعال' : 'غیرفعال'}
          </span>
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
              پیمانکاران پروژه
            </h2>
            <button
              onClick={() => setShowAddMember(true)}
              className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Plus size={14} />
              افزودن پیمانکار
            </button>
          </div>

          {project.members?.length === 0 ? (
            <p className="text-sm text-gray-500">هنوز پیمانکاری به این پروژه اضافه نشده است.</p>
          ) : (
            <div className="space-y-2">
              {project.members?.map((member: any) => (
                <div key={member.userId} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-2">
                  <div>
                    <span className="font-medium text-gray-800">{member.user.fullName}</span>
                    <span className="mr-2 text-xs text-gray-500">({member.user.username})</span>
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
                <h3 className="mb-4 text-lg font-bold text-gray-800">افزودن پیمانکار</h3>
                {availableContractors.length === 0 ? (
                  <p className="text-sm text-gray-500">پیمانکاری برای افزودن وجود ندارد. ابتدا از بخش کاربران یک پیمانکار ایجاد کنید.</p>
                ) : (
                  <>
                    <select
                      value={selectedContractor}
                      onChange={(e) => setSelectedContractor(e.target.value)}
                      className="mb-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="">انتخاب پیمانکار...</option>
                      {availableContractors.map((c: any) => (
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
                          if (selectedContractor) {
                            addMemberMutation.mutate({ projectId, userId: selectedContractor });
                          }
                        }}
                        isLoading={addMemberMutation.isPending}
                        disabled={!selectedContractor}
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
            title="حذف پیمانکار"
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
