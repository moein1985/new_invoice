'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import moment from 'moment-jalaali';
import { generateDocumentExcel } from '@/lib/services/excel-export';
import { useToast } from '@/components/ui/toast-provider';
import { parseDisplaySettings } from '@/components/ui/display-settings';
import { DetailSkeleton } from '@/components/ui/skeleton';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { Pencil, ArrowLeft, FileText, Sheet, Printer, Clock, Loader2, Calendar, User, MessageSquare } from 'lucide-react';

const DOC_TYPES: Record<string, string> = {
  TEMP_PROFORMA: 'پیش فاکتور موقت',
  PROFORMA: 'پیش فاکتور',
  INVOICE: 'فاکتور',
  RETURN_INVOICE: 'فاکتور برگشتی',
  RECEIPT: 'رسید',
  OTHER: 'سایر',
};

const DOC_TYPE_COLORS: Record<string, string> = {
  TEMP_PROFORMA: 'bg-gray-100 text-gray-800 border-gray-300',
  PROFORMA: 'bg-blue-100 text-blue-800 border-blue-300',
  INVOICE: 'bg-green-100 text-green-800 border-green-300',
  RETURN_INVOICE: 'bg-red-100 text-red-800 border-red-300',
  RECEIPT: 'bg-purple-100 text-purple-800 border-purple-300',
  OTHER: 'bg-yellow-100 text-yellow-800 border-yellow-300',
};

const APPROVAL_STATUS: Record<string, string> = {
  PENDING: 'در انتظار تایید',
  APPROVED: 'تایید شده',
  REJECTED: 'رد شده',
};

const APPROVAL_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  APPROVED: 'bg-green-100 text-green-800 border-green-300',
  REJECTED: 'bg-red-100 text-red-800 border-red-300',
};

export default function DocumentDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const toast = useToast();
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);

  const { data: document, isLoading, refetch } = trpc.document.getById.useQuery(
    { id },
    { enabled: !!id }
  );

  const convertMutation = trpc.document.convert.useMutation({
    onSuccess: (newDoc) => {
      toast.success('تبدیل سند با موفقیت انجام شد', `به ${DOC_TYPES[newDoc.documentType]} تبدیل شد`);
      router.push(`/documents/${newDoc.id}`);
    },
    onError: (error) => {
      toast.error('تبدیل سند ناموفق بود', error.message);
    },
  });

  if (status === 'loading' || isLoading) {
    return <DetailSkeleton />;
  }

  if (!session) {
    router.push('/login');
    return null;
  }

  if (!document) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-xl text-red-600">سند یافت نشد</div>
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fa-IR').format(amount) + ' ریال';
  };

  const formatDate = (date: string | Date) => {
    return moment(date).format('jYYYY/jM/jD');
  };

  // محاسبه مجموع خرید و سود
  const totalPurchase = document.items.reduce(
    (sum: number, item: any) => sum + item.purchasePrice * item.quantity,
    0
  );
  const totalProfit = document.items.reduce(
    (sum: number, item: any) => sum + (item.sellPrice - item.purchasePrice) * item.quantity,
    0
  );

  // نوع بعدی سند برای تبدیل
  const getNextDocumentType = () => {
    if (document.documentType === 'TEMP_PROFORMA') return 'PROFORMA';
    if (document.documentType === 'PROFORMA') return 'INVOICE';
    return null;
  };

  const nextType = getNextDocumentType();
  const canConvert = nextType !== null && document.approvalStatus === 'APPROVED';

  const ds = parseDisplaySettings((document as any).displaySettings);
  const showInternal = document.documentType === 'TEMP_PROFORMA';

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl" style={{ fontFamily: 'Vazir, Tahoma, sans-serif' }}>
      {/* Header */}
      <header className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold" style={{ color: '#1a1a1a' }}>
              جزئیات سند
            </h1>
            <div className="flex gap-2">
              <button
                onClick={() => router.push(`/documents/edit/${id}`)}
                className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
              >
                <Pencil className="h-4 w-4" /> ویرایش
              </button>
              {canConvert && (
                <button
                  onClick={() => setShowConvertModal(true)}
                  disabled={convertMutation.isPending}
                  className="rounded-lg bg-purple-600 px-4 py-2 text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {convertMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> در حال تبدیل...</> : <><ArrowLeft className="h-4 w-4" /> تبدیل به {DOC_TYPES[nextType]}</>}
                </button>
              )}
              <button
                onClick={async () => {
                  setIsPdfGenerating(true);
                  try {
                    const response = await fetch(`/api/documents/${id}/pdf`);
                    if (!response.ok) {
                      const err = await response.json().catch(() => ({ error: 'خطا در تولید PDF' }));
                      throw new Error(err.error || 'خطا در تولید PDF');
                    }
                    const blob = await response.blob();
                    const url = URL.createObjectURL(blob);
                    const a = window.document.createElement('a');
                    a.href = url;
                    a.download = `${document.documentNumber}.pdf`;
                    a.click();
                    URL.revokeObjectURL(url);
                  } catch (error) {
                    toast.error('خطا در تولید PDF', (error as Error).message);
                  } finally {
                    setIsPdfGenerating(false);
                  }
                }}
                disabled={isPdfGenerating}
                className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPdfGenerating ? <><Loader2 className="h-4 w-4 animate-spin" /> در حال تولید PDF...</> : <><FileText className="h-4 w-4" /> PDF</>}
              </button>
              <button
                onClick={async () => {
                  try {
                    await generateDocumentExcel(document as any);
                  } catch (error) {
                    toast.error('خطا در تولید Excel', (error as Error).message);
                  }
                }}
                className="rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700"
              >
                <Sheet className="h-4 w-4" /> Excel
              </button>
              <button
                onClick={() => {
                  window.print();
                }}
                className="rounded-lg bg-gray-600 px-4 py-2 text-white hover:bg-gray-700"
              >
                <Printer className="h-4 w-4" /> چاپ
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Breadcrumb items={[
          { label: 'اسناد', href: '/documents' },
          { label: document?.documentNumber || 'جزئیات سند' },
        ]} />
        <div className="overflow-hidden rounded-lg bg-white shadow">
          <div className="p-8">
            {/* Header Info */}
            <div className="mb-8 flex items-center justify-between border-b-2 pb-6">
              <div>
                <h2 className="text-3xl font-bold text-blue-600">
                  {DOC_TYPES[document.documentType]}
                </h2>
                <p className="mt-2 text-lg" style={{ color: '#2a2a2a' }}>
                  شماره سند: <span className="font-bold">{document.documentNumber}</span>
                </p>
              </div>
              <div className="flex gap-3">
                <span
                  className={`rounded-full border-2 px-4 py-2 text-sm font-bold ${DOC_TYPE_COLORS[document.documentType]}`}
                >
                  {DOC_TYPES[document.documentType]}
                </span>
                <span
                  className={`rounded-full border-2 px-4 py-2 text-sm font-bold ${APPROVAL_COLORS[document.approvalStatus]}`}
                >
                  {APPROVAL_STATUS[document.approvalStatus]}
                </span>
              </div>
            </div>

            {/* Document Info */}
            <div className="mb-8 rounded-lg border bg-gray-50 p-6">
              <h3 className="mb-4 text-xl font-bold" style={{ color: '#1a1a1a' }}>
                اطلاعات سند
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {ds.showDate && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-6 w-6 text-gray-500" />
                  <div>
                    <p className="text-sm text-gray-500">تاریخ سند</p>
                    <p className="font-bold" style={{ color: '#2a2a2a' }}>
                      {formatDate(document.issueDate)}
                    </p>
                  </div>
                </div>
                )}
                {ds.showDueDate && document.dueDate && (
                  <div className="flex items-center gap-2">
                    <Clock className="h-6 w-6 text-gray-500" />
                    <div>
                      <p className="text-sm text-gray-500">سررسید</p>
                      <p className="font-bold" style={{ color: '#2a2a2a' }}>
                        {formatDate(document.dueDate)}
                      </p>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Clock className="h-6 w-6 text-gray-500" />
                  <div>
                    <p className="text-sm text-gray-500">تاریخ ایجاد</p>
                    <p className="font-bold" style={{ color: '#2a2a2a' }}>
                      {formatDate(document.createdAt)}
                    </p>
                  </div>
                </div>
                {ds.showOperator && (
                <div className="flex items-center gap-2">
                  <User className="h-6 w-6 text-gray-500" />
                  <div>
                    <p className="text-sm text-gray-500">ایجاد توسط</p>
                    <p className="font-bold" style={{ color: '#2a2a2a' }}>
                      {document.createdBy.fullName}
                    </p>
                  </div>
                </div>
                )}
              </div>
            </div>

            {/* Customer Info */}
            <div className="mb-8 rounded-lg border bg-blue-50 p-6">
              <h3 className="mb-4 text-xl font-bold" style={{ color: '#1a1a1a' }}>
                اطلاعات مشتری
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {ds.showCustomerName && (
                <div>
                  <p className="text-sm text-gray-600">نام</p>
                  <p className="font-bold" style={{ color: '#2a2a2a' }}>
                    {document.customer.name}
                  </p>
                </div>
                )}
                {ds.showCustomerCode && (
                <div>
                  <p className="text-sm text-gray-600">کد مشتری</p>
                  <p className="font-bold" style={{ color: '#2a2a2a' }}>
                    {document.customer.code}
                  </p>
                </div>
                )}
                {ds.showCustomerPhone && (
                <div>
                  <p className="text-sm text-gray-600">شماره تماس</p>
                  <p className="font-bold" style={{ color: '#2a2a2a' }}>
                    {document.customer.phone}
                  </p>
                </div>
                )}
                {document.customer.address && (
                  <div className="col-span-2">
                    <p className="text-sm text-gray-600">آدرس</p>
                    <p className="font-bold" style={{ color: '#2a2a2a' }}>
                      {document.customer.address}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Items Table */}
            <div className="mb-8">
              <h3 className="mb-4 text-xl font-bold" style={{ color: '#1a1a1a' }}>
                ردیف‌های سند
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="border p-3 text-center" style={{ color: '#1a1a1a' }}>
                        ردیف
                      </th>
                      <th className="border p-3 text-right" style={{ color: '#1a1a1a' }}>
                        نام محصول
                      </th>
                      <th className="border p-3 text-center" style={{ color: '#1a1a1a' }}>
                        تعداد
                      </th>
                      <th className="border p-3 text-center" style={{ color: '#1a1a1a' }}>
                        واحد
                      </th>
                      {showInternal && ds.showPurchasePrice && (
                        <>
                          <th className="border p-3 text-right" style={{ color: '#1a1a1a' }}>
                            قیمت خرید
                          </th>
                          <th className="border p-3 text-center" style={{ color: '#1a1a1a' }}>
                            درصد سود
                          </th>
                        </>
                      )}
                      <th className="border p-3 text-right" style={{ color: '#1a1a1a' }}>
                        قیمت فروش
                      </th>
                      {showInternal && ds.showProfit && (
                        <th className="border p-3 text-right" style={{ color: '#1a1a1a' }}>
                          سود
                        </th>
                      )}
                      <th className="border p-3 text-right" style={{ color: '#1a1a1a' }}>
                        مبلغ کل
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {document.items.map((item: any, index: number) => {
                      const profit = (item.sellPrice - item.purchasePrice) * item.quantity;
                      const profitPercent =
                        item.purchasePrice > 0
                          ? ((item.sellPrice - item.purchasePrice) / item.purchasePrice) * 100
                          : 0;

                      return (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="border p-3 text-center" style={{ color: '#2a2a2a' }}>
                            {index + 1}
                          </td>
                          <td className="border p-3" style={{ color: '#2a2a2a' }}>
                            <div className="font-bold">{item.productName}</div>
                            {ds.showItemDescription && item.description && (
                              <div className="text-sm text-gray-600">{item.description}</div>
                            )}
                          </td>
                          <td className="border p-3 text-center" style={{ color: '#2a2a2a' }}>
                            {item.quantity}
                          </td>
                          <td className="border p-3 text-center" style={{ color: '#2a2a2a' }}>
                            {item.unit}
                          </td>
                          {showInternal && ds.showPurchasePrice && (
                            <>
                              <td className="border p-3 text-right" style={{ color: '#2a2a2a' }}>
                                {formatCurrency(item.purchasePrice)}
                              </td>
                              <td className="border p-3 text-center" style={{ color: '#2a2a2a' }}>
                                {profitPercent.toFixed(1)}%
                              </td>
                            </>
                          )}
                          <td className="border p-3 text-right" style={{ color: '#2a2a2a' }}>
                            {formatCurrency(item.sellPrice)}
                          </td>
                          {showInternal && ds.showProfit && (
                            <td className="border p-3 text-right text-green-600 font-bold">
                              {formatCurrency(profit)}
                            </td>
                          )}
                          <td className="border p-3 text-right font-bold" style={{ color: '#2a2a2a' }}>
                            {formatCurrency(item.sellPrice * item.quantity)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totals */}
            <div className="mb-8 rounded-lg border-2 border-blue-200 bg-blue-50 p-6">
              <h3 className="mb-4 text-xl font-bold" style={{ color: '#1a1a1a' }}>
                محاسبات
              </h3>
              <div className="space-y-3">
                {showInternal && ds.showPurchasePrice && (
                  <>
                    <div className="flex justify-between border-b pb-2">
                      <span className="font-bold" style={{ color: '#2a2a2a' }}>
                        جمع خرید:
                      </span>
                      <span className="font-bold" style={{ color: '#2a2a2a' }}>
                        {formatCurrency(totalPurchase)}
                      </span>
                    </div>
                  </>
                )}
                {showInternal && ds.showProfit && (
                    <div className="flex justify-between border-b pb-2">
                      <span className="font-bold text-green-600">جمع سود:</span>
                      <span className="font-bold text-green-600">
                        {formatCurrency(totalProfit)}
                      </span>
                    </div>
                )}
                <div className="flex justify-between border-b pb-2">
                  <span className="font-bold" style={{ color: '#2a2a2a' }}>
                    جمع کل:
                  </span>
                  <span className="font-bold" style={{ color: '#2a2a2a' }}>
                    {formatCurrency(document.totalAmount)}
                  </span>
                </div>
                {document.discountAmount > 0 && (
                  <div className="flex justify-between border-b pb-2">
                    <span className="font-bold text-red-600">تخفیف:</span>
                    <span className="font-bold text-red-600">
                      {formatCurrency(document.discountAmount)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between border-t-2 border-blue-300 pt-3">
                  <span className="text-xl font-bold text-blue-600">مبلغ قابل پرداخت:</span>
                  <span className="text-xl font-bold text-blue-600">
                    {formatCurrency(document.finalAmount)}
                  </span>
                </div>
              </div>
            </div>

            {/* Notes */}
            {ds.showNotes && document.notes && (
              <div className="mb-8 rounded-lg border bg-yellow-50 p-6">
                <h3 className="mb-3 text-xl font-bold" style={{ color: '#1a1a1a' }}>
                  یادداشت‌ها
                </h3>
                <p className="whitespace-pre-wrap" style={{ color: '#2a2a2a' }}>
                  {document.notes}
                </p>
              </div>
            )}

            {/* Conversion Chain */}
            {(document.convertedFrom || document.convertedTo) && (
              <div className="mb-8 rounded-lg border bg-purple-50 p-6">
                <h3 className="mb-4 text-xl font-bold" style={{ color: '#1a1a1a' }}>
                  زنجیره تبدیل
                </h3>
                <div className="space-y-2">
                  {document.convertedFrom && (
                    <div>
                      <span className="text-sm text-gray-600">تبدیل شده از: </span>
                      <Link
                        href={`/documents/${document.convertedFrom.id}`}
                        className="text-blue-600 hover:underline font-bold"
                      >
                        {DOC_TYPES[document.convertedFrom.documentType]} -{' '}
                        {document.convertedFrom.documentNumber}
                      </Link>
                    </div>
                  )}
                  {document.convertedTo && (
                    <div>
                      <span className="text-sm text-gray-600">تبدیل شده به: </span>
                      <Link
                        href={`/documents/${document.convertedTo.id}`}
                        className="text-blue-600 hover:underline font-bold ml-2"
                      >
                        {DOC_TYPES[document.convertedTo.documentType]} - {document.convertedTo.documentNumber}
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Approval History */}
            {ds.showApprovals && document.approvals && document.approvals.length > 0 && (
              <div className="rounded-lg border bg-gray-50 p-6">
                <h3 className="mb-4 text-xl font-bold" style={{ color: '#1a1a1a' }}>
                  تاریخچه تاییدیه‌ها
                </h3>
                <div className="space-y-3">
                  {document.approvals.map((approval: any) => (
                    <div
                      key={approval.id}
                      className="rounded border bg-white p-4 flex items-center justify-between"
                    >
                      <div>
                        <p className="font-bold" style={{ color: '#2a2a2a' }}>
                          {approval.user.fullName}
                        </p>
                        <p className="text-sm text-gray-600">
                          {formatDate(approval.createdAt)}
                        </p>
                        {approval.comment && (
                          <p className="mt-2 text-sm" style={{ color: '#2a2a2a' }}>
                            <MessageSquare className="inline h-4 w-4 ml-1" /> {approval.comment}
                          </p>
                        )}
                      </div>
                      <span
                        className={`rounded-full border px-3 py-1 text-sm font-bold ${
                          approval.status === 'APPROVED'
                            ? 'bg-green-100 text-green-800 border-green-300'
                            : 'bg-red-100 text-red-800 border-red-300'
                        }`}
                      >
                        {approval.status === 'APPROVED' ? 'تایید' : 'رد'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {showConvertModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900">تبدیل سند</h3>
            <p className="mt-2 text-sm leading-6 text-gray-700">
              آیا مطمئن هستید که می‌خواهید این سند را به {nextType ? DOC_TYPES[nextType] : ''} تبدیل کنید؟
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowConvertModal(false)}
                disabled={convertMutation.isPending}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!nextType) return;
                  setShowConvertModal(false);
                  convertMutation.mutate({ id, toType: nextType });
                }}
                disabled={convertMutation.isPending}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {convertMutation.isPending ? 'در حال انجام...' : 'تبدیل'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          header,
          button {
            display: none !important;
          }
          body {
            background: white !important;
          }
          .shadow {
            box-shadow: none !important;
          }
        }
      `}</style>
    </div>
  );
}
