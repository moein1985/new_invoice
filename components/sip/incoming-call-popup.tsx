'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useSip } from '@/components/sip/sip-provider';
import { trpc } from '@/lib/trpc';
import { Phone, X, User, FileText, MapPin, Mail, AlertTriangle, CheckCircle, Clock, UserPlus } from 'lucide-react';

const DOC_TYPE_LABELS: Record<string, string> = {
  TEMP_PROFORMA: 'پیش فاکتور موقت',
  PROFORMA: 'پیش فاکتور',
  INVOICE: 'فاکتور',
  RETURN_INVOICE: 'فاکتور برگشتی',
  RECEIPT: 'رسید',
  OTHER: 'سایر',
};

const DOC_TYPE_PREFIXES: Record<string, string> = {
  TEMP_PROFORMA: 'TMP',
  PROFORMA: 'PRF',
  INVOICE: 'INV',
  RETURN_INVOICE: 'RET',
  RECEIPT: 'RCP',
  OTHER: 'OTH',
};

const APPROVAL_STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
  PENDING: {
    label: 'در انتظار تایید',
    icon: <Clock size={14} />,
    className: 'text-amber-600 bg-amber-50',
  },
  REJECTED: {
    label: 'رد شده',
    icon: <AlertTriangle size={14} />,
    className: 'text-red-600 bg-red-50',
  },
  APPROVED: {
    label: 'تایید شده',
    icon: <CheckCircle size={14} />,
    className: 'text-green-600 bg-green-50',
  },
};

function formatAmount(amount: number): string {
  return new Intl.NumberFormat('fa-IR').format(amount);
}

export function IncomingCallPopup() {
  const { incomingCall, dismissCall } = useSip();

  const isValidPhone = !!incomingCall?.callerNumber && 
    !['ناشناس', 'anonymous', 'Unknown', 'unknown', 'Unavailable', 'unavailable', 'restricted', 'withheld'].includes(incomingCall.callerNumber) &&
    /\d{3,}/.test(incomingCall.callerNumber);

  const { data: customerData, isLoading } = trpc.customer.findByPhone.useQuery(
    { phone: incomingCall?.callerNumber || '' },
    {
      enabled: isValidPhone,
      staleTime: 0,
    }
  );

  // Play notification sound
  useEffect(() => {
    if (!incomingCall) return;
    try {
      const audio = new Audio('/sounds/notification.mp3');
      audio.volume = 0.5;
      audio.play().catch(() => {});
    } catch {}
  }, [incomingCall]);

  if (!incomingCall) return null;

  const customer = customerData;

  return (
    <div className="fixed top-4 left-4 z-[100] w-[420px] max-h-[80vh] overflow-y-auto animate-slide-in-left">
      <div className="rounded-xl border border-gray-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between rounded-t-xl bg-blue-600 px-4 py-3 text-white">
          <div className="flex items-center gap-2">
            <div className="animate-pulse">
              <Phone size={20} />
            </div>
            <span className="text-sm font-medium">تماس ورودی</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm" dir="ltr">
              {incomingCall.callerNumber}
            </span>
            <button
              onClick={dismissCall}
              className="rounded-full p-1 hover:bg-blue-500 transition-colors"
              aria-label="بستن"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
              <span className="mr-2 text-sm text-gray-500">در حال جستجو...</span>
            </div>
          ) : customer ? (
            <KnownCustomer customer={customer} callerNumber={incomingCall.callerNumber} />
          ) : (
            <UnknownCustomer callerNumber={incomingCall.callerNumber} />
          )}
        </div>
      </div>
    </div>
  );
}

function KnownCustomer({ customer, callerNumber }: { customer: any; callerNumber: string }) {
  return (
    <div className="space-y-4">
      {/* Customer Info */}
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
          <User size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-bold text-gray-800">{customer.name}</h3>
          <p className="text-xs text-gray-500">{customer.code}</p>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
            {customer.phone && (
              <span className="flex items-center gap-1">
                <Phone size={12} />
                <span dir="ltr">{customer.phone}</span>
              </span>
            )}
            {customer.email && (
              <span className="flex items-center gap-1">
                <Mail size={12} />
                {customer.email}
              </span>
            )}
          </div>
          {customer.address && (
            <p className="mt-1 flex items-center gap-1 text-xs text-gray-500">
              <MapPin size={12} className="shrink-0" />
              <span className="truncate">{customer.address}</span>
            </p>
          )}
        </div>
      </div>

      {/* Recent Documents */}
      {customer.documents && customer.documents.length > 0 && (
        <div>
          <h4 className="mb-2 flex items-center gap-1 text-sm font-semibold text-gray-700">
            <FileText size={14} />
            آخرین اسناد
          </h4>
          <div className="space-y-2">
            {customer.documents.map((doc: any) => {
              const statusConfig = APPROVAL_STATUS_CONFIG[doc.approvalStatus] || APPROVAL_STATUS_CONFIG.PENDING;
              return (
                <Link
                  key={doc.id}
                  href={`/documents/${doc.id}`}
                  className="block rounded-lg border border-gray-100 p-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${statusConfig.className}`}>
                        {statusConfig.icon}
                        {statusConfig.label}
                      </span>
                      <span className="text-xs font-mono text-gray-500" dir="ltr">
                        {doc.documentNumber}
                      </span>
                    </div>
                    <span className="text-xs text-gray-400">
                      {DOC_TYPE_LABELS[doc.documentType] || doc.documentType}
                    </span>
                  </div>
                  {doc.notes && (
                    <p className="mt-1 text-sm text-gray-700 font-medium leading-relaxed line-clamp-2">
                      📝 {doc.notes}
                    </p>
                  )}
                  <div className="mt-1 text-xs text-gray-500">
                    💰 {formatAmount(doc.finalAmount)} ریال
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Financial Summary */}
      {customer.financialSummary && (
        <div className="rounded-lg bg-gray-50 p-3 text-xs">
          <h4 className="mb-2 font-semibold text-gray-700">📊 خلاصه مالی</h4>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <span className="text-gray-500">فاکتورها:</span>
              <p className="font-medium text-gray-800">{formatAmount(customer.financialSummary.totalInvoices)} ریال</p>
            </div>
            <div>
              <span className="text-gray-500">رسیدها:</span>
              <p className="font-medium text-gray-800">{formatAmount(customer.financialSummary.totalReceipts)} ریال</p>
            </div>
            <div>
              <span className="text-gray-500">مانده:</span>
              <p className={`font-bold ${customer.financialSummary.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {formatAmount(customer.financialSummary.balance)} ریال
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <Link
          href={`/customers/${customer.id}`}
          className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-center text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          مشاهده پروفایل
        </Link>
        <Link
          href={`/documents/new?customerId=${customer.id}`}
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-center text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          ثبت سند جدید
        </Link>
      </div>
    </div>
  );
}

function UnknownCustomer({ callerNumber }: { callerNumber: string }) {
  return (
    <div className="py-4 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
        <User size={24} />
      </div>
      <p className="text-sm font-medium text-gray-600">مشتری ناشناس</p>
      <p className="mt-1 text-xs text-gray-400" dir="ltr">
        {callerNumber}
      </p>
      <Link
        href={`/customers?newPhone=${encodeURIComponent(callerNumber)}`}
        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors"
      >
        <UserPlus size={16} />
        ثبت مشتری جدید
      </Link>
    </div>
  );
}
