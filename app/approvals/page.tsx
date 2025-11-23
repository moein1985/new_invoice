'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';

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
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-xl">در حال بارگذاری...</div>
      </div>
    );
  }

  if (!session) {
    router.push('/login');
    return null;
  }

  const handleApprove = (id: string, documentNumber: string) => {
    if (confirm(`آیا از تایید سند "${documentNumber}" اطمینان دارید؟`)) {
      approveMutation.mutate({ id });
    }
  };

  const handleReject = (id: string, documentNumber: string) => {
    const comment = prompt(`دلیل رد سند "${documentNumber}" را وارد کنید:`);
    if (comment) {
      rejectMutation.mutate({ id, comment });
    }
  };

  const getNextDocumentType = (currentType: string) => {
    if (currentType === 'TEMP_PROFORMA') return 'PROFORMA';
    if (currentType === 'PROFORMA') return 'INVOICE';
    return null;
  };

  const handleConvert = (documentId: string, currentType: string, documentNumber: string) => {
    const nextType = getNextDocumentType(currentType);
    if (!nextType) return;

    if (confirm(`آیا مطمئن هستید که می‌خواهید سند "${documentNumber}" را به ${DOC_TYPES[nextType]} تبدیل کنید؟`)) {
      convertMutation.mutate({ id: documentId, toType: nextType as any });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl" style={{ fontFamily: 'Vazir, Tahoma, sans-serif' }}>
      {/* Header */}
      <header className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-3xl font-bold" style={{ color: '#1a1a1a' }}>
                کارتابل مدیریت
              </h1>
              <Link href="/dashboard" className="text-gray-500 hover:text-gray-700">
                بازگشت ←
              </Link>
            </div>
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
        {isLoading ? (
          <div className="text-center text-lg" style={{ color: '#2a2a2a' }}>
            ⏳ در حال بارگذاری...
          </div>
        ) : !approvals || approvals.length === 0 ? (
          <div className="rounded-lg bg-white p-8 text-center shadow">
            <div className="text-6xl mb-4">✅</div>
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
                          {convertMutation.isPending ? '⏳ در حال تبدیل...' : `➡️ تبدیل به ${DOC_TYPES[nextType]}`}
                        </button>
                      )}
                      
                      <Link
                        href={`/documents/${doc.id}`}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-center text-white hover:bg-blue-700 whitespace-nowrap"
                      >
                        👁️ مشاهده
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
    </div>
  );
}
