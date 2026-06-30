'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import moment from 'moment-jalaali';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ProfileSkeleton } from '@/components/ui/skeleton';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { Pencil, Trash2, Loader2, ShoppingCart, Truck, Clock, CheckCircle, XCircle } from 'lucide-react';

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'پیش‌نویس',
  PENDING: 'در انتظار',
  INQUIRY: 'استعلام',
  APPROVED: 'تایید شده',
  PURCHASED: 'خریداری شده',
  DELIVERED: 'تحویل شده',
  CANCELLED: 'لغو شده',
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  PENDING: 'bg-yellow-100 text-yellow-800',
  INQUIRY: 'bg-blue-100 text-blue-800',
  APPROVED: 'bg-green-100 text-green-800',
  PURCHASED: 'bg-purple-100 text-purple-800',
  DELIVERED: 'bg-teal-100 text-teal-800',
  CANCELLED: 'bg-red-100 text-red-800',
};

export default function SupplierDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const { data: supplier, isLoading } = trpc.supplier.getById.useQuery(
    { id },
    { enabled: !!id }
  );

  const deleteMutation = trpc.supplier.delete.useMutation({
    onSuccess: () => {
      router.push('/suppliers');
    },
    onError: (error) => {
      alert(`خطا: ${error.message}`);
    },
  });

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (status === 'loading' || isLoading) {
    return <ProfileSkeleton />;
  }

  if (!session) {
    router.push('/login');
    return null;
  }

  if (!supplier) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-xl text-red-600">تامین‌کننده یافت نشد</div>
      </div>
    );
  }

  const formatDate = (date: string | Date) => {
    return moment(date).format('jYYYY/jM/jD');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fa-IR').format(amount) + ' ریال';
  };

  const inquiryCount = supplier.inquiries?.length || 0;

  const handleDelete = () => {
    if (inquiryCount > 0) {
      alert('امکان حذف تامین‌کننده با استعلام وجود ندارد. ابتدا استعلام‌ها را حذف کنید.');
      return;
    }
    setShowDeleteConfirm(true);
  };

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl" style={{ fontFamily: 'Vazir, Tahoma, sans-serif' }}>
      {/* Header */}
      <header className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold" style={{ color: '#1a1a1a' }}>
              جزئیات تامین‌کننده
            </h1>
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                disabled={deleteMutation.isPending || inquiryCount > 0}
                className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleteMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> در حال حذف...</> : <><Trash2 className="h-4 w-4" /> حذف</>}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Breadcrumb items={[
          { label: 'تامین‌کنندگان', href: '/suppliers' },
          { label: supplier?.name || 'جزئیات تامین‌کننده' },
        ]} />
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Supplier Info Card */}
          <div className="lg:col-span-1">
            <div className="overflow-hidden rounded-lg bg-white shadow">
              <div className="bg-orange-600 p-6 text-white">
                <div className="flex items-center gap-3">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-orange-600">
                    <Truck className="h-8 w-8" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">{supplier.name}</h2>
                    <p className="text-orange-100">{supplier.code}</p>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <p className="text-sm text-gray-500">شماره تماس</p>
                  <p className="font-bold" style={{ color: '#2a2a2a' }}>
                    {supplier.phone || '-'}
                  </p>
                </div>

                {supplier.email && (
                  <div>
                    <p className="text-sm text-gray-500">ایمیل</p>
                    <p className="font-bold" style={{ color: '#2a2a2a' }}>
                      {supplier.email}
                    </p>
                  </div>
                )}

                {supplier.address && (
                  <div>
                    <p className="text-sm text-gray-500">آدرس</p>
                    <p className="font-bold" style={{ color: '#2a2a2a' }}>
                      {supplier.address}
                    </p>
                  </div>
                )}

                {supplier.description && (
                  <div>
                    <p className="text-sm text-gray-500">توضیحات</p>
                    <p className="font-bold" style={{ color: '#2a2a2a' }}>
                      {supplier.description}
                    </p>
                  </div>
                )}

                <div className="border-t pt-4">
                  <p className="text-sm text-gray-500">وضعیت</p>
                  <p className={`font-bold ${supplier.isActive ? 'text-green-600' : 'text-red-600'}`}>
                    {supplier.isActive ? 'فعال' : 'غیرفعال'}
                  </p>
                </div>

                <div className="border-t pt-4">
                  <p className="text-sm text-gray-500">تاریخ ایجاد</p>
                  <p className="font-bold" style={{ color: '#2a2a2a' }}>
                    {formatDate(supplier.createdAt)}
                  </p>
                </div>
              </div>
            </div>

            {/* Stats Card */}
            <div className="mt-6 overflow-hidden rounded-lg bg-white shadow">
              <div className="bg-blue-600 p-4 text-white">
                <h3 className="text-lg font-bold">آمار استعلام‌ها</h3>
              </div>
              <div className="p-6 space-y-4">
                <div className="rounded-lg bg-blue-50 p-4">
                  <p className="text-sm text-gray-600">تعداد استعلام‌ها</p>
                  <p className="text-2xl font-bold text-blue-600">{inquiryCount}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Inquiries History */}
          <div className="lg:col-span-2">
            <div className="overflow-hidden rounded-lg bg-white shadow">
              <div className="border-b bg-gray-50 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold" style={{ color: '#1a1a1a' }}>
                    تاریخچه استعلام‌ها ({inquiryCount})
                  </h3>
                </div>
              </div>

              <div className="p-6">
                {inquiryCount === 0 ? (
                  <div className="py-12 text-center text-gray-500">
                    <ShoppingCart className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-xl">هنوز استعلامی ثبت نشده است</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {supplier.inquiries?.map((inquiry) => (
                      <Link
                        key={inquiry.id}
                        href={`/purchases/${inquiry.purchaseRequest?.id}`}
                        className="block rounded-lg border p-4 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <ShoppingCart className="h-8 w-8 text-orange-400" />
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-bold" style={{ color: '#1a1a1a' }}>
                                  {inquiry.purchaseRequest?.title || 'درخواست خرید'}
                                </p>
                                {inquiry.purchaseRequest?.status && (
                                  <span
                                    className={`rounded-full px-2 py-1 text-xs font-medium ${
                                      STATUS_COLORS[inquiry.purchaseRequest.status] || 'bg-gray-100 text-gray-800'
                                    }`}
                                  >
                                    {STATUS_LABELS[inquiry.purchaseRequest.status] || inquiry.purchaseRequest.status}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-500">
                                {inquiry.purchaseRequest?.requestNumber} - {formatDate(inquiry.createdAt)}
                              </p>
                            </div>
                          </div>
                          <div className="text-left">
                            <p className="text-lg font-bold text-green-600">
                              {formatCurrency(inquiry.totalPrice)}
                            </p>
                          </div>
                        </div>
                        {inquiry.notes && (
                          <div className="mt-2 text-sm text-gray-600 border-t pt-2">
                            {inquiry.notes.substring(0, 100)}
                            {inquiry.notes.length > 100 && '...'}
                          </div>
                        )}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      <ConfirmDialog
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={() => {
          deleteMutation.mutate({ id });
          setShowDeleteConfirm(false);
        }}
        title={`حذف تامین‌کننده ${supplier.name}`}
        message="آیا از حذف این تامین‌کننده اطمینان دارید؟ این عملیات قابل بازگشت نیست."
        confirmText="حذف تامین‌کننده"
        variant="danger"
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
