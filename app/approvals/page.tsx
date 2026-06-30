'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { PageSkeleton, CardsListSkeleton } from '@/components/ui/skeleton';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { CheckCircle, Loader2, ArrowRight, Eye } from 'lucide-react';

const DOC_TYPES: Record<string, string> = {
  TEMP_PROFORMA: 'پیش فاکتور موقت',
  PROFORMA: 'پیش فاکتور',
  INVOICE: 'فاکتور',
  RETURN_INVOICE: 'فاکتور برگشتی',
  RECEIPT: 'رسید',
  OTHER: 'سایر',
};

const DOC_TYPE_COLORS: Record<string, string> = {
  TEMP_PROFORMA: 'bg-gray-100 text-gray-800',
  PROFORMA: 'bg-blue-100 text-blue-800',
  INVOICE: 'bg-green-100 text-green-800',
  RETURN_INVOICE: 'bg-red-100 text-red-800',
  RECEIPT: 'bg-purple-100 text-purple-800',
  OTHER: 'bg-yellow-100 text-yellow-800',
};

export default function ApprovalsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [approveTarget, setApproveTarget] = useState<{ id: string; docNumber: string } | null>(null);
  const [rejectTarget, setRejectTarget] = useState<{ id: string; docNumber: string } | null>(null);
  const [rejectComment, setRejectComment] = useState('');
  const [convertTarget, setConvertTarget] = useState<{ id: string; docNumber: string; nextType: string } | null>(null);

  // Fetch pending approvals
  const { data: approvals, isLoading, refetch } = trpc.document.pendingApprovals.useQuery(
    undefined,
    {
      enabled: !!session,
    }
  );

  // Debug log
  console.log('Approvals data:', approvals);
  console.log('Loading:', isLoading);
  console.log('Session:', session);

  const approveMutation = trpc.document.approve.useMutation({
    onSuccess: () => {
      refetch();
      setToast({ message: 'سند با موفقیت تایید شد', type: 'success' });
      setTimeout(() => setToast(null), 3000);
    },
    onError: (error) => {
      setToast({ message: error.message, type: 'error' });
      setTimeout(() => setToast(null), 5000);
    },
  });

  const rejectMutation = trpc.document.reject.useMutation({
    onSuccess: () => {
      refetch();
      setToast({ message: 'سند رد شد', type: 'success' });
      setTimeout(() => setToast(null), 3000);
    },
    onError: (error) => {
      setToast({ message: error.message, type: 'error' });
      setTimeout(() => setToast(null), 5000);
    },
  });

  const convertMutation = trpc.document.convert.useMutation({
    onSuccess: (data) => {
      refetch();
      setToast({ message: 'سند با موفقیت تبدیل شد', type: 'success' });
      setTimeout(() => {
        setToast(null);
        router.push(`/documents/${data.id}`);
      }, 1500);
    },
    onError: (error) => {
      setToast({ message: error.message, type: 'error' });
      setTimeout(() => setToast(null), 5000);
    },
  });

  if (status === 'loading') {
    return <PageSkeleton />;
  }

  if (!session) {
    router.push('/login');
    return null;
  }

  // فقط ADMIN و MANAGER به کارتابل تاییدیه‌ها دسترسی دارند
  if (session.user.role !== 'ADMIN' && session.user.role !== 'MANAGER') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-xl text-red-600">شما دسترسی به این صفحه ندارید</div>
      </div>
    );
  }

  const handleApprove = (id: string, documentNumber: string) => {
    setApproveTarget({ id, docNumber: documentNumber });
  };

  const handleReject = (id: string, documentNumber: string) => {
    setRejectComment('');
    setRejectTarget({ id, docNumber: documentNumber });
  };

  const getNextDocumentType = (currentType: string) => {
    if (currentType === 'TEMP_PROFORMA') return 'PROFORMA';
    if (currentType === 'PROFORMA') return 'INVOICE';
    return null;
  };

  const handleConvert = (documentId: string, currentType: string, documentNumber: string) => {
    const nextType = getNextDocumentType(currentType);
    if (!nextType) return;
    setConvertTarget({ id: documentId, docNumber: documentNumber, nextType });
  };

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl" style={{ fontFamily: 'Vazir, Tahoma, sans-serif' }}>
      {/* Header */}
      <header className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold" style={{ color: '#1a1a1a' }}>
              کارتابل مدیریت
            </h1>
            {approvals && approvals.length > 0 && (
              <div className="text-sm text-gray-600">
                <span className="font-bold">{approvals.length}</span> سند در انتظار بررسی
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <Breadcrumb items={[{ label: 'کارتابل مدیریت' }]} />
        {isLoading ? (
          <CardsListSkeleton count={3} />
        ) : !approvals || approvals.length === 0 ? (
          <div className="rounded-lg bg-white p-8 text-center shadow">
            <CheckCircle className="h-14 w-14 mx-auto text-green-400" />
            <p className="text-xl font-bold" style={{ color: '#2a2a2a' }}>
              عالی! هیچ سندی در انتظار بررسی نیست
            </p>
            <p className="mt-2 text-gray-500">
              تمام اسناد تایید یا رد شده‌اند
            </p>
          </div>
        ) : (
          <div className="space-y-4" dir="rtl" style={{ fontFamily: 'Vazir, Tahoma, sans-serif' }}>
            {approvals.map((approval: any) => {
              const doc = approval.document;
              const nextType = getNextDocumentType(doc.documentType);
              const canConvert = nextType && doc.approvalStatus === 'APPROVED';

              return (
                <div key={approval.id} className="rounded-lg bg-white p-6 shadow">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <h3 className="text-xl font-bold" style={{ color: '#1a1a1a' }}>
                          {doc.documentNumber}
                        </h3>
                        <span className={`rounded-full px-3 py-1 text-sm font-bold ${DOC_TYPE_COLORS[doc.documentType]}`}>
                          {DOC_TYPES[doc.documentType]}
                        </span>
                        <span className={`rounded-full px-3 py-1 text-sm font-bold ${
                          doc.approvalStatus === 'PENDING'
                            ? 'bg-yellow-100 text-yellow-800'
                            : doc.approvalStatus === 'APPROVED'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {doc.approvalStatus === 'PENDING' && 'در انتظار تایید'}
                          {doc.approvalStatus === 'APPROVED' && 'تایید شده'}
                          {doc.approvalStatus === 'REJECTED' && 'رد شده'}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 text-sm" style={{ color: '#2a2a2a' }}>
                        <div><strong>مشتری:</strong> {doc.customer.name}</div>
                        <div><strong>تاریخ:</strong> {new Date(doc.issueDate).toLocaleDateString('fa-IR')}</div>
                        <div><strong>جمع کل:</strong> {doc.totalAmount.toLocaleString('fa-IR')} ریال</div>
                        <div><strong>مبلغ نهایی:</strong> {doc.finalAmount.toLocaleString('fa-IR')} ریال</div>
                      </div>
                      
                      {doc.notes && (
                        <div className="mt-2 text-sm text-gray-600">
                          <strong>یادداشت:</strong> {doc.notes}
                        </div>
                      )}
                      
                      <div className="mt-3 text-xs text-gray-500">
                        ایجاد شده توسط: {doc.createdBy.fullName} در{' '}
                        {new Date(doc.createdAt).toLocaleDateString('fa-IR')}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      {doc.approvalStatus === 'PENDING' && (
                        <>
                          <button
                            onClick={() => handleApprove(doc.id, doc.documentNumber)}
                            disabled={approveMutation.isPending || rejectMutation.isPending || convertMutation.isPending}
                            className="rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:opacity-50 whitespace-nowrap"
                          >
                            ✓ تایید
                          </button>
                          <button
                            onClick={() => handleReject(doc.id, doc.documentNumber)}
                            disabled={approveMutation.isPending || rejectMutation.isPending || convertMutation.isPending}
                            className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-50 whitespace-nowrap"
                          >
                            ✕ رد
                          </button>
                        </>
                      )}
                      
                      {canConvert && (
                        <button
                          onClick={() => handleConvert(doc.id, doc.documentType, doc.documentNumber)}
                          disabled={convertMutation.isPending}
                          className="rounded-lg bg-purple-600 px-4 py-2 text-white hover:bg-purple-700 disabled:opacity-50 whitespace-nowrap"
                        >
                          {convertMutation.isPending ? <><Loader2 className="inline h-4 w-4 animate-spin" /> در حال تبدیل...</> : <><ArrowRight className="inline h-4 w-4" /> تبدیل به {DOC_TYPES[nextType]}</>}
                        </button>
                      )}
                      
                      <Link
                        href={`/documents/${doc.id}`}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-center text-white hover:bg-blue-700 whitespace-nowrap"
                      >
                        <Eye className="inline h-4 w-4" /> مشاهده
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-4 left-4 right-4 z-50 sm:left-auto sm:right-4 sm:w-96">
          <div
            className={`rounded-lg p-4 shadow-lg ${
              toast.type === 'success'
                ? 'bg-green-500 text-white'
                : 'bg-red-500 text-white'
            }`}
          >
            <div className="flex items-center justify-between">
              <span>{toast.message}</span>
              <button
                onClick={() => setToast(null)}
                className="mr-4 text-white hover:text-gray-200"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!approveTarget}
        onClose={() => setApproveTarget(null)}
        onConfirm={() => {
          if (approveTarget) {
            approveMutation.mutate({ id: approveTarget.id });
            setApproveTarget(null);
          }
        }}
        title={`تایید سند ${approveTarget?.docNumber ?? ''}`}
        message="آیا از تایید این سند اطمینان دارید؟"
        confirmText="تایید سند"
        variant="info"
        loading={approveMutation.isPending}
      />

      {rejectTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setRejectTarget(null); }}
        >
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900">رد سند {rejectTarget.docNumber}</h3>
            <p className="mt-2 text-sm text-gray-600">دلیل رد سند را وارد کنید:</p>
            <textarea
              value={rejectComment}
              onChange={(e) => setRejectComment(e.target.value)}
              className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              rows={3}
              placeholder="دلیل رد..."
              autoFocus
            />
            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => setRejectTarget(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                انصراف
              </button>
              <button
                onClick={() => {
                  if (rejectComment.trim()) {
                    rejectMutation.mutate({ id: rejectTarget.id, comment: rejectComment.trim() });
                    setRejectTarget(null);
                  }
                }}
                disabled={!rejectComment.trim() || rejectMutation.isPending}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
              >
                رد سند
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!convertTarget}
        onClose={() => setConvertTarget(null)}
        onConfirm={() => {
          if (convertTarget) {
            convertMutation.mutate({ id: convertTarget.id, toType: convertTarget.nextType as any });
            setConvertTarget(null);
          }
        }}
        title={`تبدیل سند ${convertTarget?.docNumber ?? ''}`}
        message={`آیا مطمئن هستید که می‌خواهید این سند را به ${convertTarget?.nextType ? DOC_TYPES[convertTarget.nextType] : ''} تبدیل کنید؟`}
        confirmText="تبدیل"
        variant="warning"
        loading={convertMutation.isPending}
      />
    </div>
  );
}
