'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { useToast } from '@/components/ui/toast-provider';
import { LoadingButton } from '@/components/ui/loading-button';
import { Pagination } from '@/components/ui/pagination';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { PageSkeleton, TableSkeleton } from '@/components/ui/skeleton';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { Plus, Search, Edit2, Trash2, Users, Eye } from 'lucide-react';
import moment from 'moment-jalaali';
import { JalaliDatePicker } from '@/components/ui/jalali-date-picker';

export default function ProjectsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const role = session?.user?.role;
  const isManager = role === 'ADMIN' || role === 'MANAGER';

  const { data: projects, isLoading, refetch } = trpc.project.list.useQuery({
    page,
    limit: 10,
    search: search || undefined,
    activeOnly: !showInactive,
  });

  const createMutation = trpc.project.create.useMutation({
    onSuccess: () => {
      refetch();
      setIsModalOpen(false);
      setEditingProject(null);
      toast.success('پروژه با موفقیت ایجاد شد');
    },
    onError: (error) => {
      toast.error('خطا در ایجاد پروژه', error.message);
    },
  });

  const updateMutation = trpc.project.update.useMutation({
    onSuccess: () => {
      refetch();
      setIsModalOpen(false);
      setEditingProject(null);
      toast.success('پروژه با موفقیت ویرایش شد');
    },
    onError: (error) => {
      toast.error('خطا در ویرایش پروژه', error.message);
    },
  });

  const deleteMutation = trpc.project.delete.useMutation({
    onSuccess: () => {
      refetch();
      toast.success('پروژه با موفقیت حذف شد');
    },
    onError: (error) => {
      toast.error('خطا در حذف پروژه', error.message);
    },
  });

  if (status === 'loading') return <PageSkeleton />;
  if (!session) { router.push('/login'); return null; }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name') as string,
      description: (formData.get('description') as string) || undefined,
      address: (formData.get('address') as string) || undefined,
      employerName: (formData.get('employerName') as string) || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    };

    if (editingProject) {
      updateMutation.mutate({ id: editingProject.id, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <div className="p-4 md:p-6">
      <Breadcrumb items={[{ label: 'پروژه‌ها' }]} />

      <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-800">پروژه‌ها</h1>
        <div className="flex gap-2 items-center">
          {isManager && (
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="rounded border-gray-300"
              />
              نمایش غیرفعال‌ها
            </label>
          )}
          {isManager && (
            <button
              onClick={() => { setEditingProject(null); setStartDate(''); setEndDate(''); setIsModalOpen(true); }}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              <Plus size={16} />
              پروژه جدید
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="mb-4 relative">
        <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="جستجوی پروژه..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-full rounded-lg border border-gray-300 py-2 pr-10 pl-4 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <TableSkeleton />
      ) : !projects?.data?.length ? (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500">
          پروژه‌ای یافت نشد
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-4 py-3 text-right font-medium">کد</th>
                <th className="px-4 py-3 text-right font-medium">نام پروژه</th>
                <th className="px-4 py-3 text-right font-medium">کارفرما</th>
                <th className="px-4 py-3 text-center font-medium">اعضا</th>
                <th className="px-4 py-3 text-center font-medium">گزارش‌ها</th>
                <th className="px-4 py-3 text-center font-medium">وضعیت</th>
                <th className="px-4 py-3 text-center font-medium">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {projects.data.map((project: any) => (
                <tr key={project.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{project.code}</td>
                  <td className="px-4 py-3 font-medium text-gray-800">
                    <Link href={`/projects/${project.id}`} className="hover:text-blue-600">
                      {project.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{project.employerName || '—'}</td>
                  <td className="px-4 py-3 text-center text-gray-600">
                    {project.members?.length || 0}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600">
                    {project._count?.workReports || 0}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                      project.isActive
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}>
                      {project.isActive ? 'فعال' : 'غیرفعال'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <Link
                        href={`/projects/${project.id}`}
                        className="rounded p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                        title="مشاهده"
                      >
                        <Eye size={16} />
                      </Link>
                      {isManager && (
                        <>
                          <button
                            onClick={() => { setEditingProject(project); setStartDate(project.startDate?.slice(0, 10) || ''); setEndDate(project.endDate?.slice(0, 10) || ''); setIsModalOpen(true); }}
                            className="rounded p-1.5 text-gray-400 hover:bg-yellow-50 hover:text-yellow-600 transition-colors"
                            title="ویرایش"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => setDeleteTarget({ id: project.id, name: project.name })}
                            className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                            title="حذف"
                          >
                            <Trash2 size={16} />
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

      {projects?.meta && (
        <div className="mt-4">
          <Pagination
            currentPage={projects.meta.page}
            totalPages={projects.meta.totalPages}
            totalItems={projects.meta.total}
            itemsPerPage={projects.meta.limit}
            onPageChange={setPage}
          />
        </div>
      )}

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setIsModalOpen(false)}>
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl mx-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4 text-lg font-bold text-gray-800">
              {editingProject ? 'ویرایش پروژه' : 'پروژه جدید'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">نام پروژه *</label>
                <input
                  name="name"
                  defaultValue={editingProject?.name || ''}
                  required
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">کارفرما</label>
                <input
                  name="employerName"
                  defaultValue={editingProject?.employerName || ''}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">آدرس</label>
                <input
                  name="address"
                  defaultValue={editingProject?.address || ''}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">توضیحات</label>
                <textarea
                  name="description"
                  rows={3}
                  defaultValue={editingProject?.description || ''}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">تاریخ شروع</label>
                  <JalaliDatePicker
                    value={startDate}
                    onChange={setStartDate}
                    placeholder="انتخاب تاریخ"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">تاریخ پایان</label>
                  <JalaliDatePicker
                    value={endDate}
                    onChange={setEndDate}
                    placeholder="انتخاب تاریخ"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setIsModalOpen(false); setEditingProject(null); }}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  انصراف
                </button>
                <LoadingButton
                  type="submit"
                  isLoading={createMutation.isPending || updateMutation.isPending}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  {editingProject ? 'ذخیره تغییرات' : 'ایجاد پروژه'}
                </LoadingButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="حذف پروژه"
        message={`آیا از حذف پروژه «${deleteTarget?.name}» مطمئن هستید؟ این عمل قابل بازگشت نیست.`}
        confirmText="حذف"
        cancelText="انصراف"
        variant="danger"
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteTarget) {
            deleteMutation.mutate({ id: deleteTarget.id }, {
              onSuccess: () => setDeleteTarget(null),
            });
          }
        }}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
