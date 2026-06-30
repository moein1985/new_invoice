'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import moment from 'moment-jalaali';
import { useToast } from '@/components/ui/toast-provider';
import { LoadingButton } from '@/components/ui/loading-button';
import { PageSkeleton } from '@/components/ui/skeleton';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import {
  ShoppingCart, Plus, CheckCircle, XCircle, Send, Package,
  Phone, MapPin, CreditCard, Clock, FileText, Image, Play, Pause,
  Trash2, Download, Eye,
} from 'lucide-react';
import { useRef } from 'react';

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'پیش‌نویس',
  PENDING_INQUIRY: 'در انتظار استعلام',
  INQUIRED: 'استعلام‌شده',
  APPROVED: 'تایید‌شده',
  REJECTED: 'رد‌شده',
  PURCHASED: 'خریداری‌شده',
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  PENDING_INQUIRY: 'bg-yellow-100 text-yellow-800',
  INQUIRED: 'bg-blue-100 text-blue-800',
  APPROVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
  PURCHASED: 'bg-purple-100 text-purple-800',
};

const PRIORITY_LABELS: Record<string, string> = {
  LOW: 'کم',
  MEDIUM: 'متوسط',
  HIGH: 'زیاد',
  URGENT: 'فوری',
};

const AVAILABILITY_LABELS: Record<string, string> = {
  AVAILABLE: 'موجود',
  UNAVAILABLE: 'ناموجود',
  PARTIAL: 'موجودی محدود',
};

function formatPrice(n: number) {
  return new Intl.NumberFormat('fa-IR').format(Math.round(n));
}

export default function PurchaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const toast = useToast();
  const utils = trpc.useUtils();

  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [playingVoice, setPlayingVoice] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const role = session?.user?.role;
  const userId = session?.user?.id;
  const isManager = role === 'ADMIN' || role === 'MANAGER';

  const { data: request, isLoading } = trpc.purchase.getById.useQuery(
    { id },
    { enabled: !!session && !!id }
  );

  const submitMutation = trpc.purchase.submit.useMutation({
    onSuccess: () => {
      toast.success('استعلام‌ها برای تایید ارسال شد');
      utils.purchase.getById.invalidate({ id });
    },
    onError: (err) => toast.error(err.message),
  });

  const approveMutation = trpc.purchase.approveInquiry.useMutation({
    onSuccess: () => {
      toast.success('استعلام تایید شد');
      utils.purchase.getById.invalidate({ id });
    },
    onError: (err) => toast.error(err.message),
  });

  const rejectMutation = trpc.purchase.reject.useMutation({
    onSuccess: () => {
      toast.success('درخواست رد شد');
      utils.purchase.getById.invalidate({ id });
      setShowRejectModal(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const purchasedMutation = trpc.purchase.markPurchased.useMutation({
    onSuccess: () => {
      toast.success('وضعیت به خریداری‌شده تغییر کرد');
      utils.purchase.getById.invalidate({ id });
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.purchase.delete.useMutation({
    onSuccess: () => {
      toast.success('درخواست حذف شد');
      router.push('/purchases');
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteInquiryMutation = trpc.purchase.deleteInquiry.useMutation({
    onSuccess: () => {
      toast.success('استعلام حذف شد');
      utils.purchase.getById.invalidate({ id });
    },
    onError: (err) => toast.error(err.message),
  });

  if (authStatus === 'loading' || isLoading) return <PageSkeleton />;
  if (!session) { router.push('/login'); return null; }
  if (!request) {
    return (
      <div className="text-center py-12 text-gray-500">درخواست خرید یافت نشد</div>
    );
  }

  const canAddInquiry =
    (request.status === 'PENDING_INQUIRY' || request.status === 'INQUIRED' || request.status === 'DRAFT') &&
    request.status !== 'APPROVED' && request.status !== 'PURCHASED' &&
    (isManager || request.assignedToId === userId);

  const canSubmit =
    role === 'USER' &&
    request.assignedToId === userId &&
    request.status === 'PENDING_INQUIRY' &&
    request.inquiries.length > 0;

  const canApprove =
    isManager &&
    (request.status === 'INQUIRED' || request.status === 'PENDING_INQUIRY') &&
    request.inquiries.length > 0;

  const canReject =
    isManager &&
    request.status !== 'APPROVED' && request.status !== 'PURCHASED' && request.status !== 'REJECTED';

  return (
    <div className="min-h-screen bg-gray-50 p-6 space-y-6">
      <Breadcrumb items={[
        { label: 'سامانه خرید', href: '/purchases' },
        { label: request.requestNumber },
      ]} />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <ShoppingCart className="h-6 w-6 text-blue-600" />
            {request.title}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-gray-500">
            <span>{request.requestNumber}</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[request.status]}`}>
              {STATUS_LABELS[request.status]}
            </span>
            <span className="text-xs">{PRIORITY_LABELS[request.priority]}</span>
            <span>{moment(request.createdAt).format('jYYYY/jMM/jDD')}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {canAddInquiry && (
            <Link
              href={`/purchases/${id}/inquiry/new`}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Plus size={16} />
              استعلام جدید
            </Link>
          )}
          {canSubmit && (
            <LoadingButton
              onClick={() => submitMutation.mutate({ id })}
              loading={submitMutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
            >
              <Send size={16} />
              ارسال برای تایید
            </LoadingButton>
          )}
          {canReject && (
            <button
              onClick={() => setShowRejectModal(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              <XCircle size={16} />
              رد درخواست
            </button>
          )}
          {isManager && request.status === 'APPROVED' && (
            <LoadingButton
              onClick={() => purchasedMutation.mutate({ id })}
              loading={purchasedMutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
            >
              <Package size={16} />
              خریداری شد
            </LoadingButton>
          )}
          {isManager && request.status !== 'PURCHASED' && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="text-sm font-medium text-gray-500 mb-2">اطلاعات درخواست</h3>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">ایجادکننده:</dt>
              <dd className="font-medium">{request.createdBy.fullName}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">مسئول استعلام:</dt>
              <dd className="font-medium">{request.assignedTo?.fullName || '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">پروژه:</dt>
              <dd className="font-medium">{request.project?.name || '—'}</dd>
            </div>
            {request.deadline && (
              <div className="flex justify-between">
                <dt className="text-gray-500">مهلت:</dt>
                <dd className="font-medium">{moment(request.deadline).format('jYYYY/jMM/jDD')}</dd>
              </div>
            )}
          </dl>
        </div>

        {request.description && (
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <h3 className="text-sm font-medium text-gray-500 mb-2">توضیحات</h3>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{request.description}</p>
          </div>
        )}

        {request.voiceNote && (
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <h3 className="text-sm font-medium text-gray-500 mb-2">پیام صوتی</h3>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  if (audioRef.current) {
                    if (playingVoice) audioRef.current.pause();
                    else audioRef.current.play();
                    setPlayingVoice(!playingVoice);
                  }
                }}
                className="rounded-full bg-blue-100 p-2 text-blue-600 hover:bg-blue-200"
              >
                {playingVoice ? <Pause size={20} /> : <Play size={20} />}
              </button>
              <div className="flex-1 h-1 bg-gray-200 rounded-full" />
              <audio
                ref={audioRef}
                src={`/api/uploads/purchases${request.voiceNote.replace('/uploads/purchases', '')}`}
                onEnded={() => setPlayingVoice(false)}
              />
            </div>
          </div>
        )}

        {request.rejectionReason && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4">
            <h3 className="text-sm font-medium text-red-600 mb-2">دلیل رد</h3>
            <p className="text-sm text-red-700">{request.rejectionReason}</p>
          </div>
        )}
      </div>

      {/* Items Table */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
          <h3 className="text-sm font-medium text-gray-700">اقلام درخواست ({request.items.length} قلم)</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/50">
                <th className="px-4 py-2 text-right text-gray-600 font-medium">ردیف</th>
                <th className="px-4 py-2 text-right text-gray-600 font-medium">نام محصول</th>
                <th className="px-4 py-2 text-right text-gray-600 font-medium">توضیحات</th>
                <th className="px-4 py-2 text-right text-gray-600 font-medium">تعداد</th>
                <th className="px-4 py-2 text-right text-gray-600 font-medium">واحد</th>
                <th className="px-4 py-2 text-right text-gray-600 font-medium">قیمت تخمینی</th>
              </tr>
            </thead>
            <tbody>
              {request.items.map((item: any, idx: number) => (
                <tr key={item.id} className="border-b border-gray-100">
                  <td className="px-4 py-2 text-gray-500">{idx + 1}</td>
                  <td className="px-4 py-2 font-medium">{item.productName}</td>
                  <td className="px-4 py-2 text-gray-500">{item.description || '—'}</td>
                  <td className="px-4 py-2">{item.quantity}</td>
                  <td className="px-4 py-2">{item.unit}</td>
                  <td className="px-4 py-2">{item.estimatedPrice ? `${formatPrice(item.estimatedPrice)} تومان` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inquiries */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-gray-900">
          استعلام‌ها ({request.inquiries.length})
        </h2>

        {request.inquiries.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-gray-500">
            هنوز استعلامی ثبت نشده است
          </div>
        ) : (
          <div className="grid gap-4">
            {request.inquiries.map((inq: any) => {
              const isApproved = request.approvedInquiryId === inq.id;
              return (
                <div
                  key={inq.id}
                  className={`rounded-xl border bg-white overflow-hidden ${
                    isApproved ? 'border-green-300 ring-2 ring-green-100' : 'border-gray-200'
                  }`}
                >
                  {/* Inquiry Header */}
                  <div className={`flex items-center justify-between px-4 py-3 ${
                    isApproved ? 'bg-green-50' : 'bg-gray-50'
                  }`}>
                    <div className="flex items-center gap-3">
                      <h4 className="font-medium text-gray-900">{inq.supplierName}</h4>
                      {isApproved && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                          <CheckCircle size={12} />
                          تایید‌شده
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-gray-900">
                        {formatPrice(inq.totalPrice)} تومان
                      </span>
                      {canApprove && !request.approvedInquiryId && (
                        <LoadingButton
                          onClick={() => approveMutation.mutate({ purchaseRequestId: id, inquiryId: inq.id })}
                          loading={approveMutation.isPending}
                          className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
                        >
                          <CheckCircle size={14} />
                          تایید
                        </LoadingButton>
                      )}
                      {request.status !== 'APPROVED' && request.status !== 'PURCHASED' && (
                        <button
                          onClick={() => deleteInquiryMutation.mutate({ id: inq.id })}
                          className="text-red-400 hover:text-red-600"
                          title="حذف استعلام"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Inquiry Info */}
                  <div className="px-4 py-3 border-b border-gray-100">
                    <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                      {inq.supplierPhone && (
                        <span className="flex items-center gap-1"><Phone size={12} /> {inq.supplierPhone}</span>
                      )}
                      {inq.supplierAddress && (
                        <span className="flex items-center gap-1"><MapPin size={12} /> {inq.supplierAddress}</span>
                      )}
                      {inq.paymentMethod && (
                        <span className="flex items-center gap-1"><CreditCard size={12} /> {inq.paymentMethod}</span>
                      )}
                      {inq.paymentDays != null && (
                        <span className="flex items-center gap-1"><Clock size={12} /> {inq.paymentDays} روز مهلت</span>
                      )}
                      <span>ثبت‌کننده: {inq.createdBy.fullName}</span>
                      <span>{moment(inq.createdAt).format('jYYYY/jMM/jDD')}</span>
                    </div>
                    {inq.notes && <p className="mt-2 text-sm text-gray-600">{inq.notes}</p>}
                  </div>

                  {/* Inquiry Items */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50/50">
                          <th className="px-4 py-2 text-right text-gray-500">محصول</th>
                          <th className="px-4 py-2 text-right text-gray-500">قیمت واحد</th>
                          <th className="px-4 py-2 text-right text-gray-500">قیمت کل</th>
                          <th className="px-4 py-2 text-right text-gray-500">موجودی</th>
                          <th className="px-4 py-2 text-right text-gray-500">زمان تحویل</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inq.items.map((ii: any) => (
                          <tr key={ii.id} className="border-t border-gray-50">
                            <td className="px-4 py-2">{ii.purchaseItem.productName}</td>
                            <td className="px-4 py-2">{formatPrice(ii.unitPrice)} تومان</td>
                            <td className="px-4 py-2">{formatPrice(ii.totalPrice)} تومان</td>
                            <td className="px-4 py-2">{AVAILABILITY_LABELS[ii.availability]}</td>
                            <td className="px-4 py-2">{ii.deliveryDays ? `${ii.deliveryDays} روز` : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Attachments */}
                  {inq.attachments.length > 0 && (
                    <div className="px-4 py-3 border-t border-gray-100">
                      <span className="text-xs font-medium text-gray-500 mb-2 block">پیوست‌ها:</span>
                      <div className="flex flex-wrap gap-2">
                        {inq.attachments.map((att: any) => (
                          <a
                            key={att.id}
                            href={`/api/uploads/purchases${att.filePath.replace('/uploads/purchases', '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
                          >
                            {att.type === 'IMAGE' ? <Image size={12} /> : <FileText size={12} />}
                            {att.fileName}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowRejectModal(false)}>
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-4">رد درخواست خرید</h3>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="دلیل رد را وارد کنید..."
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 mb-4"
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowRejectModal(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                انصراف
              </button>
              <LoadingButton
                onClick={() => rejectMutation.mutate({ id, reason: rejectReason })}
                loading={rejectMutation.isPending}
                disabled={!rejectReason.trim()}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                رد درخواست
              </LoadingButton>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowDeleteConfirm(false)}>
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-2">حذف درخواست</h3>
            <p className="text-sm text-gray-600 mb-4">آیا از حذف این درخواست خرید مطمئن هستید؟</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                انصراف
              </button>
              <LoadingButton
                onClick={() => deleteMutation.mutate({ id })}
                loading={deleteMutation.isPending}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                حذف
              </LoadingButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
