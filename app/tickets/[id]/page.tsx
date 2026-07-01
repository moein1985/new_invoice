'use client';

import { useState, useRef, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Send, Paperclip, X, FileText, Image as ImageIcon, Download, Lock, Trash2 } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useToast } from '@/components/ui/toast-provider';
import { LoadingButton } from '@/components/ui/loading-button';
import { PageSkeleton } from '@/components/ui/skeleton';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import moment from 'moment-jalaali';

const statusLabels: Record<string, string> = {
  OPEN: 'باز',
  IN_PROGRESS: 'در حال بررسی',
  RESOLVED: 'حل‌شده',
  CLOSED: 'بسته‌شده',
};

const statusColors: Record<string, string> = {
  OPEN: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-700',
  RESOLVED: 'bg-green-100 text-green-700',
  CLOSED: 'bg-gray-100 text-gray-500',
};

const priorityLabels: Record<string, string> = {
  LOW: 'کم',
  MEDIUM: 'متوسط',
  HIGH: 'زیاد',
  URGENT: 'فوری',
};

export default function TicketDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const toast = useToast();
  const ticketId = params.id as string;
  const replyEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [replyContent, setReplyContent] = useState('');
  const [uploading, setUploading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const role = session?.user?.role;
  const isManager = role === 'ADMIN' || role === 'MANAGER';

  const { data: ticket, isLoading, refetch } = trpc.ticket.getById.useQuery(
    { id: ticketId },
    { enabled: !!ticketId }
  );

  const addReplyMutation = trpc.ticket.addReply.useMutation({
    onSuccess: () => {
      setReplyContent('');
      refetch();
    },
    onError: (error) => {
      toast.error('خطا', error.message);
    },
  });

  const addAttachmentMutation = trpc.ticket.addAttachment.useMutation({
    onSuccess: () => {
      refetch();
    },
    onError: (error) => {
      toast.error('خطا', error.message);
    },
  });

  const closeMutation = trpc.ticket.close.useMutation({
    onSuccess: () => {
      toast.success('تیکت بسته شد');
      refetch();
    },
    onError: (error) => {
      toast.error('خطا', error.message);
    },
  });

  const updateStatusMutation = trpc.ticket.updateStatus.useMutation({
    onSuccess: () => {
      toast.success('وضعیت تیکت تغییر یافت');
      refetch();
    },
    onError: (error) => {
      toast.error('خطا', error.message);
    },
  });

  const deleteMutation = trpc.ticket.delete.useMutation({
    onSuccess: () => {
      toast.success('تیکت حذف شد');
      router.push('/tickets');
    },
    onError: (error) => {
      toast.error('خطا', error.message);
    },
  });

  useEffect(() => {
    replyEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ticket?.replies?.length]);

  if (status === 'loading' || isLoading) return <PageSkeleton />;
  if (!session) { router.push('/login'); return null; }
  if (!ticket) {
    return <div className="p-6 text-center text-gray-500">تیکت یافت نشد</div>;
  }

  const isClosed = ticket.status === 'CLOSED';

  const handleReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyContent.trim()) return;
    addReplyMutation.mutate({ ticketId, content: replyContent });
  };

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
        addAttachmentMutation.mutate({
          ticketId,
          fileName: data.fileName,
          filePath: data.filePath,
          fileType: data.fileType,
          fileSize: data.fileSize,
        });
      }
    } catch {
      toast.error('خطا در آپلود فایل');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="p-4 md:p-6">
      <Breadcrumb items={[
        { label: 'تیکت‌ها', href: '/tickets' },
        { label: ticket.ticketNumber },
      ]} />

      {/* Ticket Header */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-gray-800">{ticket.title}</h1>
            <p className="mt-1 text-sm text-gray-500 font-mono">{ticket.ticketNumber}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${statusColors[ticket.status]}`}>
              {statusLabels[ticket.status]}
            </span>
            <span className="inline-block rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
              {priorityLabels[ticket.priority]}
            </span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-gray-500">پروژه:</span>
            <span className="mr-2 font-medium text-gray-800">{ticket.project?.name}</span>
          </div>
          <div>
            <span className="text-gray-500">ثبت‌کننده:</span>
            <span className="mr-2 font-medium text-gray-800">{ticket.createdBy?.fullName}</span>
          </div>
          <div>
            <span className="text-gray-500">تاریخ:</span>
            <span className="mr-2 font-medium text-gray-800">
              {moment(ticket.createdAt).format('jYYYY/jMM/jDD - HH:mm')}
            </span>
          </div>
        </div>

        <p className="mt-4 text-sm text-gray-600 whitespace-pre-wrap">{ticket.description}</p>

        {/* Action Buttons */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {/* Status management for managers */}
          {isManager && !isClosed && (
            <>
              {ticket.status === 'OPEN' && (
                <button
                  onClick={() => updateStatusMutation.mutate({ id: ticketId, status: 'IN_PROGRESS' })}
                  className="rounded-lg bg-yellow-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-yellow-700"
                >
                  شروع بررسی
                </button>
              )}
              {ticket.status === 'IN_PROGRESS' && (
                <button
                  onClick={() => updateStatusMutation.mutate({ id: ticketId, status: 'RESOLVED' })}
                  className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700"
                >
                  حل‌شده
                </button>
              )}
              <button
                onClick={() => updateStatusMutation.mutate({ id: ticketId, status: 'CLOSED' })}
                className="rounded-lg bg-gray-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700"
              >
                بستن تیکت
              </button>
            </>
          )}

          {/* Close button for employer */}
          {!isManager && !isClosed && (
            <button
              onClick={() => closeMutation.mutate({ id: ticketId })}
              disabled={closeMutation.isPending}
              className="flex items-center gap-1 rounded-lg bg-gray-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700"
            >
              <Lock size={14} />
              بستن تیکت
            </button>
          )}

          {/* Delete for managers */}
          {isManager && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-1 rounded-lg bg-red-50 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-100"
            >
              <Trash2 size={14} />
              حذف
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Conversation */}
        <div className="lg:col-span-2 rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-bold text-gray-800">مکالمه</h2>

          {/* Replies */}
          <div className="space-y-4 mb-4 max-h-[500px] overflow-y-auto">
            {ticket.replies?.map((reply: any) => {
              const isOwn = reply.user.id === session.user.id;
              return (
                <div key={reply.id} className={`flex ${isOwn ? 'justify-left' : 'justify-right'}`}>
                  <div className={`max-w-[80%] rounded-lg px-4 py-3 ${
                    isOwn ? 'bg-blue-50 border border-blue-100' : 'bg-gray-50 border border-gray-100'
                  }`}>
                    <div className="mb-1 flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-700">{reply.user.fullName}</span>
                      <span className="text-xs text-gray-400">
                        {moment(reply.createdAt).format('jYYYY/jMM/jDD - HH:mm')}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{reply.content}</p>
                  </div>
                </div>
              );
            })}
            <div ref={replyEndRef} />
          </div>

          {/* Reply Form */}
          {!isClosed && (
            <form onSubmit={handleReply} className="border-t border-gray-100 pt-4">
              <div className="flex gap-2">
                <textarea
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  placeholder="پاسخ خود را بنویسید..."
                  rows={2}
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
                />
                <LoadingButton
                  type="submit"
                  isLoading={addReplyMutation.isPending}
                  disabled={!replyContent.trim()}
                  className="flex items-center gap-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  <Send size={16} />
                </LoadingButton>
              </div>
            </form>
          )}

          {isClosed && (
            <div className="border-t border-gray-100 pt-4 text-center text-sm text-gray-400">
              این تیکت بسته شده است
            </div>
          )}
        </div>

        {/* Attachments Sidebar */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-800">پیوست‌ها</h2>
            {!isClosed && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-1 rounded-lg border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                <Paperclip size={12} />
                {uploading ? '...' : 'افزودن'}
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>

          {!ticket.attachments?.length ? (
            <p className="text-sm text-gray-400 text-center py-4">پیوستی وجود ندارد</p>
          ) : (
            <div className="space-y-2">
              {ticket.attachments.map((att: any) => (
                <a
                  key={att.id}
                  href={att.filePath}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 hover:bg-gray-100 transition-colors"
                >
                  {att.fileType.startsWith('image/') ? (
                    <ImageIcon size={16} className="text-blue-500" />
                  ) : (
                    <FileText size={16} className="text-red-500" />
                  )}
                  <span className="flex-1 truncate text-sm text-gray-700">{att.fileName}</span>
                  <Download size={14} className="text-gray-400" />
                </a>
              ))}
            </div>
          )}

          {/* Ticket metadata */}
          {ticket.closedBy && (
            <div className="mt-6 border-t border-gray-100 pt-4 text-xs text-gray-500">
              <p>بسته توسط: {ticket.closedBy.fullName}</p>
              {ticket.closedAt && (
                <p className="mt-1">{moment(ticket.closedAt).format('jYYYY/jMM/jDD - HH:mm')}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={showDeleteConfirm}
        title="حذف تیکت"
        message={`آیا از حذف تیکت «${ticket.title}» مطمئن هستید؟ این عمل قابل بازگشت نیست.`}
        confirmText="حذف"
        cancelText="انصراف"
        variant="danger"
        loading={deleteMutation.isPending}
        onConfirm={() => {
          deleteMutation.mutate({ id: ticketId }, {
            onSuccess: () => setShowDeleteConfirm(false),
          });
        }}
        onClose={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}
