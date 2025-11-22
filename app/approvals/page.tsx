'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';

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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="text-gray-500 hover:text-gray-700">
                ← بازگشت
              </Link>
              <h1 className="text-3xl font-bold text-gray-900">تاییدیه‌ها</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {isLoading ? (
          <div className="text-center">در حال بارگذاری...</div>
        ) : !approvals || approvals.length === 0 ? (
          <div className="rounded-lg bg-white p-8 text-center">
            <p className="text-gray-500">هیچ سند در انتظار تاییدی وجود ندارد</p>
          </div>
        ) : (
          <div className="space-y-4">
            {approvals.map((approval: any) => (
              <div key={approval.id} className="rounded-lg bg-white p-6 shadow">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-4 mb-2">
                      <h3 className="text-lg font-semibold">
                        {approval.document.documentNumber}
                      </h3>
                      <span className={`rounded-full px-3 py-1 text-sm ${
                        approval.document.type === 'INVOICE'
                          ? 'bg-blue-100 text-blue-800'
                          : approval.document.type === 'DELIVERY_NOTE'
                          ? 'bg-green-100 text-green-800'
                          : approval.document.type === 'PROFORMA'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-purple-100 text-purple-800'
                      }`}>
                        {approval.document.type === 'INVOICE' && 'فاکتور'}
                        {approval.document.type === 'DELIVERY_NOTE' && 'حواله'}
                        {approval.document.type === 'PROFORMA' && 'پیش‌فاکتور'}
                        {approval.document.type === 'ORDER' && 'سفارش'}
                      </span>
                    </div>
                    
                    <div className="space-y-1 text-sm text-gray-600">
                      <p>مشتری: {approval.document.customer.name}</p>
                      <p>تاریخ: {new Date(approval.document.documentDate).toLocaleDateString('fa-IR')}</p>
                      <p>مبلغ: {approval.document.totalAmount.toLocaleString('fa-IR')} تومان</p>
                      {approval.document.description && (
                        <p>توضیحات: {approval.document.description}</p>
                      )}
                      <p className="text-xs text-gray-500 mt-2">
                        ارسال شده توسط: {approval.document.createdBy.name} در{' '}
                        {new Date(approval.createdAt).toLocaleDateString('fa-IR')}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApprove(approval.id, approval.document.documentNumber)}
                      disabled={approveMutation.isPending || rejectMutation.isPending}
                      className="rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      تایید
                    </button>
                    <button
                      onClick={() => handleReject(approval.id, approval.document.documentNumber)}
                      disabled={approveMutation.isPending || rejectMutation.isPending}
                      className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      رد
                    </button>
                    <Link
                      href={`/documents/${approval.document.id}`}
                      className="rounded-lg bg-gray-200 px-4 py-2 text-gray-700 hover:bg-gray-300"
                    >
                      مشاهده
                    </Link>
                  </div>
                </div>
              </div>
            ))}
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
