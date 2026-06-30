'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { useToast } from '@/components/ui/toast-provider';
import { LoadingButton } from '@/components/ui/loading-button';
import { PageSkeleton } from '@/components/ui/skeleton';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { JalaliDatePicker } from '@/components/ui/jalali-date-picker';

export default function EditPurchasePage() {
  const { id } = useParams<{ id: string }>();
  const { data: session, status } = useSession();
  const router = useRouter();
  const toast = useToast();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [projectId, setProjectId] = useState('');
  const [assignedToId, setAssignedToId] = useState('');
  const [deadline, setDeadline] = useState('');
  const [loaded, setLoaded] = useState(false);

  const { data: request, isLoading } = trpc.purchase.getById.useQuery(
    { id },
    { enabled: !!session && !!id }
  );

  const { data: projects } = trpc.project.list.useQuery(
    { page: 1, limit: 100 },
    { enabled: !!session }
  );

  const { data: users } = trpc.purchase.getUsers.useQuery(undefined, {
    enabled: !!session && (session.user.role === 'ADMIN' || session.user.role === 'MANAGER'),
  });

  const updateMutation = trpc.purchase.update.useMutation({
    onSuccess: () => {
      toast.success('درخواست خرید با موفقیت ویرایش شد');
      router.push(`/purchases/${id}`);
    },
    onError: (err) => {
      toast.error(err.message || 'خطا در ویرایش درخواست خرید');
    },
  });

  useEffect(() => {
    if (request && !loaded) {
      setTitle(request.title);
      setDescription(request.description || '');
      setPriority(request.priority);
      setProjectId(request.projectId || '');
      setAssignedToId(request.assignedToId || '');
      setDeadline(request.deadline ? new Date(request.deadline).toISOString().split('T')[0] : '');
      setLoaded(true);
    }
  }, [request, loaded]);

  const handleSubmit = () => {
    if (!title.trim()) {
      toast.error('عنوان درخواست الزامی است');
      return;
    }

    updateMutation.mutate({
      id,
      title: title.trim(),
      description: description.trim() || null,
      priority: priority as any,
      projectId: projectId || null,
      assignedToId: assignedToId || null,
      deadline: deadline || null,
    });
  };

  if (status === 'loading' || isLoading) return <PageSkeleton />;
  if (!session || (session.user.role !== 'ADMIN' && session.user.role !== 'MANAGER')) {
    router.push('/purchases');
    return null;
  }
  if (!request) return <div className="text-center py-12 text-gray-500">درخواست خرید یافت نشد</div>;
  if (request.status === 'APPROVED' || request.status === 'PURCHASED') {
    toast.error('امکان ویرایش درخواست تایید‌شده/خریداری‌شده وجود ندارد');
    router.push(`/purchases/${id}`);
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 space-y-6">
      <Breadcrumb items={[
        { label: 'سامانه خرید', href: '/purchases' },
        { label: request.requestNumber, href: `/purchases/${id}` },
        { label: 'ویرایش' },
      ]} />

      <h1 className="text-2xl font-bold text-gray-900">ویرایش درخواست خرید - {request.requestNumber}</h1>

      <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">عنوان درخواست *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">اولویت</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="LOW">کم</option>
              <option value="MEDIUM">متوسط</option>
              <option value="HIGH">زیاد</option>
              <option value="URGENT">فوری</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">پروژه / محل استفاده</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="">انتخاب کنید</option>
              {projects?.data?.map((p: any) => (
                <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">مسئول استعلام (کاربر)</label>
            <select
              value={assignedToId}
              onChange={(e) => setAssignedToId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="">انتخاب کنید</option>
              {users?.map((u: any) => (
                <option key={u.id} value={u.id}>{u.fullName}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">مهلت استعلام</label>
            <JalaliDatePicker
              value={deadline}
              onChange={setDeadline}
              placeholder="انتخاب تاریخ"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">توضیحات</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-gray-200 pt-4">
          <button
            type="button"
            onClick={() => router.push(`/purchases/${id}`)}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            انصراف
          </button>
          <LoadingButton
            onClick={handleSubmit}
            loading={updateMutation.isLoading}
            className="rounded-lg bg-blue-600 px-6 py-2 text-sm text-white hover:bg-blue-700 transition-colors"
          >
            ذخیره تغییرات
          </LoadingButton>
        </div>
      </div>
    </div>
  );
}
