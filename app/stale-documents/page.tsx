'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import moment from 'moment-jalaali';
import { trpc } from '@/lib/trpc';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { PageSkeleton, CardsListSkeleton } from '@/components/ui/skeleton';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { AlertTriangle, Eye, CheckCircle, XCircle, Loader2, ArrowRight, Clock } from 'lucide-react';

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

function getDaysAgo(date: string | Date): number {
  const now = new Date();
  const created = new Date(date);
  return Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
}

export default function StaleDocumentsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [approveTarget, setApproveTarget] = useState<{ id: string; docNumber: string } | null>(null);
  const [rejectTarget, setRejectTarget] = useState<{ id: string; docNumber: string } | null>(null);
  const [rejectComment, setRejectComment] = useState('');

  const { data: staleApprovals, isLoading, refetch } = trpc.document.staleDocuments.useQuery(
    undefined,
    { enabled: !!session }
  );

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

  if (status === 'loading') {
    return <PageSkeleton />;
  }

  if (!session) {
    router.push('/login');
    return null;
  }

  if (session.user.role !== 'ADMIN' && session.user.role !== 'MANAGER') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-xl text-red-600">شما دسترسی به این صفحه ندارید</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl" style={{ fontFamily: 'Vazir, Tahoma, sans-serif' }}>
      {/* Header */}
      <header className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-7 w-7 text-amber-500" />
              <h1 className="text-3xl font-bold" style={{ color: '#1a1a1a' }}>
                اسناد بلاتکلیف
              </h1>
            </div>
            {staleApprovals && staleApprovals.length > 0 && (
              <div className="text-sm text-gray-600">
                <span className="font-bold text-amber-600">{staleApprovals.length}</span> سند بیش از ۱ ماه بلاتکلیف
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <Breadcrumb items={[{ label: 'اسناد بلاتکلیف' }]} />

        {/* Info Banner */}
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2 text-sm text-amber-800">
            <Clock size={16} />
            <span>اسنادی که بیش از <strong>۱ ماه</strong> از ایجادشان گذشته و هنوز تعیین تکلیف نشده‌اند در این بخش نمایش داده می‌شوند.</span>
          </div>
        </div>

        {isLoading ? (
          <CardsListSkeleton count={3} />
        ) : !staleApprovals || staleApprovals.length === 0 ? (
          <div className="rounded-lg bg-white p-8 text-center shadow">
            <CheckCircle className="h-14 w-14 mx-auto text-green-400" />
            <p className="text-xl font-bold mt-4" style={{ color: '#2a2a2a' }}>
              هیچ سند بلاتکلیفی وجود ندارد
            </p>
            <p className="mt-2 text-gray-500">
              تمام اسناد در موعد مناسب تعیین تکلیف شده‌اند
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {staleApprovals.map((approval: any) => {
              const doc = approval.document;
              const daysAgo = getDaysAgo(approval.createdAt);

              return (
                <div key={approval.id} className="rounded-lg bg-white p-6 shadow border-r-4 border-amber-400">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <h3 className="text-xl font-bold" style={{ color: '#1a1a1a' }}>
                          {doc.documentNumber}
                        </h3>
                        <span className={`rounded-full px-3 py-1 text-sm font-bold ${DOC_TYPE_COLORS[doc.documentType]}`}>
                          {DOC_TYPES[doc.documentType]}
                        </span>
                        <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-800">
                          <Clock className="inline h-3.5 w-3.5 ml-1" />
                          {daysAgo} روز بلاتکلیف
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-sm" style={{ color: '#2a2a2a' }}>
                        <div><strong>مشتری:</strong> {doc.customer.name}</div>
                        <div><strong>تاریخ صدور:</strong> {moment(doc.issueDate).format('jYYYY/jMM/jDD')}</div>
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
                        {moment(doc.createdAt).format('jYYYY/jMM/jDD')}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => setApproveTarget({ id: doc.id, docNumber: doc.documentNumber })}
                        disabled={approveMutation.isPending || rejectMutation.isPending}
                        className="rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:opacity-50 whitespace-nowrap"
                      >
                        ✓ تایید
                      </button>
                      <button
                        onClick={() => {
                          setRejectComment('');
                          setRejectTarget({ id: doc.id, docNumber: doc.documentNumber });
                        }}
                        disabled={approveMutation.isPending || rejectMutation.isPending}
                        className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-50 whitespace-nowrap"
                      >
                        ✕ رد
                      </button>
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
            className={`rounded-lg p-4 text-white shadow-lg ${
              toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
            }`}
          >
            {toast.message}
          </div>
        </div>
      )}

      {/* Approve Confirm */}
      <ConfirmDialog
        open={!!approveTarget}
        title="تایید سند"
        message={`آیا از تایید سند ${approveTarget?.docNumber} اطمینان دارید؟`}
        onConfirm={() => {
          if (approveTarget) {
            approveMutation.mutate({ id: approveTarget.id });
            setApproveTarget(null);
          }
        }}
        onClose={() => setApproveTarget(null)}
      />

      {/* Reject Confirm */}
      <ConfirmDialog
        open={!!rejectTarget}
        title="رد سند"
        message={`آیا از رد سند ${rejectTarget?.docNumber} اطمینان دارید؟ (دلیل رد را در یادداشت وارد کنید)`}
        onConfirm={() => {
          if (rejectTarget) {
            rejectMutation.mutate({
              id: rejectTarget.id,
              comment: rejectComment || 'بلاتکلیف - رد شده توسط مدیر',
            });
            setRejectTarget(null);
          }
        }}
        onClose={() => setRejectTarget(null)}
        variant="danger"
      />
    </div>
  );
}
