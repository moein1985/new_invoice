'use client';

import { useState, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Paperclip, X, FileText, Image as ImageIcon } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useToast } from '@/components/ui/toast-provider';
import { LoadingButton } from '@/components/ui/loading-button';
import { PageSkeleton } from '@/components/ui/skeleton';
import { Breadcrumb } from '@/components/ui/breadcrumb';

export default function NewTicketPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>('MEDIUM');
  const [projectId, setProjectId] = useState('');
  const [attachments, setAttachments] = useState<Array<{ fileName: string; filePath: string; fileType: string; fileSize: number }>>([]);
  const [uploading, setUploading] = useState(false);

  const role = session?.user?.role;
  const isManager = role === 'ADMIN' || role === 'MANAGER';

  // Employers get their projects, managers get all projects
  const { data: myProjects } = trpc.ticket.myProjects.useQuery(undefined, {
    enabled: !!session && role === 'EMPLOYER',
  });

  const { data: allProjects } = trpc.project.list.useQuery(
    { page: 1, limit: 100, activeOnly: true },
    { enabled: !!session && isManager }
  );

  const createMutation = trpc.ticket.create.useMutation({
    onSuccess: (data) => {
      toast.success('تیکت با موفقیت ثبت شد');
      router.push(`/tickets/${data.id}`);
    },
    onError: (error) => {
      toast.error('خطا در ثبت تیکت', error.message);
    },
  });

  if (status === 'loading') return <PageSkeleton />;
  if (!session) { router.push('/login'); return null; }

  const projects = role === 'EMPLOYER' ? myProjects : allProjects?.data;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append('file', file);

        const isImage = file.type.startsWith('image/');
        formData.append('type', isImage ? 'image' : 'pdf');

        const res = await fetch('/api/upload/ticket', {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) {
          const err = await res.json();
          toast.error('خطا در آپلود', err.error || 'خطا');
          continue;
        }

        const data = await res.json();
        setAttachments((prev) => [...prev, data]);
      }
    } catch {
      toast.error('خطا در آپلود فایل');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) {
      toast.error('خطا', 'انتخاب پروژه الزامی است');
      return;
    }
    createMutation.mutate({
      title,
      description,
      priority,
      projectId,
      attachments,
    });
  };

  return (
    <div className="p-4 md:p-6">
      <Breadcrumb items={[
        { label: 'تیکت‌ها', href: '/tickets' },
        { label: 'تیکت جدید' },
      ]} />

      <h1 className="mb-6 text-2xl font-bold text-gray-800">تیکت جدید</h1>

      <form onSubmit={handleSubmit} className="max-w-2xl space-y-4">
        {/* Project Selection */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">پروژه *</label>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          >
            <option value="">انتخاب پروژه...</option>
            {projects?.map((p: any) => (
              <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
            ))}
          </select>
        </div>

        {/* Title */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">عنوان *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Description */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">توضیحات *</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            rows={5}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Priority */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">اولویت</label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as any)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          >
            <option value="LOW">کم</option>
            <option value="MEDIUM">متوسط</option>
            <option value="HIGH">زیاد</option>
            <option value="URGENT">فوری</option>
          </select>
        </div>

        {/* Attachments */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">پیوست‌ها</label>
          <div className="space-y-2">
            {attachments.map((att, index) => (
              <div key={index} className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  {att.fileType.startsWith('image/') ? <ImageIcon size={16} className="text-gray-400" /> : <FileText size={16} className="text-gray-400" />}
                  <span className="truncate text-sm text-gray-700">{att.fileName}</span>
                </div>
                <button
                  type="button"
                  onClick={() => removeAttachment(index)}
                  className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 rounded-lg border border-dashed border-gray-300 px-4 py-2 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 disabled:opacity-50"
            >
              <Paperclip size={16} />
              {uploading ? 'در حال آپلود...' : 'افزودن فایل'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            انصراف
          </button>
          <LoadingButton
            type="submit"
            isLoading={createMutation.isPending}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            ثبت تیکت
          </LoadingButton>
        </div>
      </form>
    </div>
  );
}
