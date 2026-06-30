'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { useToast } from '@/components/ui/toast-provider';
import { LoadingButton } from '@/components/ui/loading-button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { PageSkeleton } from '@/components/ui/skeleton';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { Plus, Trash2, CheckCircle, XCircle, Printer, Edit2, Save, Download } from 'lucide-react';
import moment from 'moment-jalaali';

const UNITS = ['متر', 'عدد', 'کیلوگرم', 'مترمربع', 'مترمکعب', 'شاخه', 'تن', 'لیتر', 'سایر'];

type EditItem = {
  id?: string;
  tempId: string;
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
};

export default function WorkReportDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const toast = useToast();
  const projectId = params.id as string;
  const reportId = params.reportId as string;

  const [isEditing, setIsEditing] = useState(false);
  const [editItems, setEditItems] = useState<EditItem[]>([]);
  const [editNotes, setEditNotes] = useState('');
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);

  const role = session?.user?.role;
  const isManager = role === 'ADMIN' || role === 'MANAGER';

  const { data: report, isLoading, error: queryError, refetch } = trpc.workReport.getById.useQuery(
    { id: reportId },
    { enabled: !!reportId }
  );

  const { data: auditLog } = trpc.workReport.listAudit.useQuery(
    { workReportId: reportId },
    { enabled: !!reportId }
  );

  const updateMutation = trpc.workReport.update.useMutation({
    onSuccess: () => {
      refetch();
      setIsEditing(false);
      toast.success('گزارش با موفقیت ویرایش شد');
    },
    onError: (err) => toast.error('خطا', err.message),
  });

  const approveMutation = trpc.workReport.approve.useMutation({
    onSuccess: () => { refetch(); toast.success('گزارش تایید شد'); },
    onError: (err) => toast.error('خطا', err.message),
  });

  const rejectMutation = trpc.workReport.reject.useMutation({
    onSuccess: () => { refetch(); setRejectDialogOpen(false); toast.success('گزارش رد شد'); },
    onError: (err) => toast.error('خطا', err.message),
  });

  // Initialize edit mode
  const startEditing = () => {
    if (!report) return;
    setEditItems(
      report.items.map((item: any, index: number) => ({
        id: item.id,
        tempId: `edit-${index}`,
        description: item.description,
        unit: item.unit,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
      }))
    );
    setEditNotes(report.notes || '');
    setIsEditing(true);
  };

  const addEditItem = () => {
    setEditItems([...editItems, {
      tempId: Date.now().toString(),
      description: '',
      unit: 'متر',
      quantity: 0,
      unitPrice: 0,
      totalPrice: 0,
    }]);
  };

  const removeEditItem = (tempId: string) => {
    if (editItems.length === 1) return;
    setEditItems(editItems.filter((i) => i.tempId !== tempId));
  };

  const updateEditItem = (tempId: string, field: keyof EditItem, value: string | number) => {
    setEditItems(editItems.map((i) => {
      if (i.tempId !== tempId) return i;
      const updated = { ...i, [field]: value };
      // Recalculate total if quantity or unitPrice changes
      if (field === 'quantity' || field === 'unitPrice') {
        updated.totalPrice = (updated.unitPrice || 0) * (updated.quantity || 0);
      }
      return updated;
    }));
  };

  const handleSave = () => {
    const validItems = editItems.filter((i) => i.description.trim());
    if (validItems.length === 0) {
      toast.error('حداقل یک آیتم با شرح الزامی است');
      return;
    }

    updateMutation.mutate({
      id: reportId,
      items: validItems.map((i) => ({
        id: i.id,
        description: i.description.trim(),
        unit: i.unit,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
      })),
      notes: editNotes || undefined,
    });
  };

  if (status === 'loading' || isLoading) return <PageSkeleton />;
  if (!session) { router.push('/login'); return null; }
  if (queryError) {
    return <div className="p-6 text-center text-red-500">خطای دریافت گزارش: {queryError.message}</div>;
  }
  if (!report) {
    return <div className="p-6 text-center text-gray-500">گزارش کار یافت نشد</div>;
  }

  const statusColors: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    APPROVED: 'bg-green-100 text-green-700 border-green-200',
    REJECTED: 'bg-red-100 text-red-700 border-red-200',
  };

  const statusLabels: Record<string, string> = {
    PENDING: 'در انتظار تایید',
    APPROVED: 'تایید شده',
    REJECTED: 'رد شده',
  };

  const canEdit = isManager || (role === 'CONTRACTOR' && report.approvalStatus !== 'APPROVED');
  const showPrices = isManager || report.approvalStatus === 'APPROVED';
  const grandTotal = report.items.reduce((sum: number, i: any) => sum + (i.totalPrice || 0), 0);

  return (
    <div className="p-4 md:p-6">
      <Breadcrumb items={[
        { label: 'پروژه‌ها', href: '/projects' },
        { label: report.project?.name || '', href: `/projects/${projectId}` },
        { label: `گزارش ${report.reportNumber}` },
      ]} />

      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">گزارش کار {report.reportNumber}</h1>
          <p className="mt-1 text-sm text-gray-500">
            تاریخ: {moment(report.reportDate).format('jYYYY/jMM/jDD')} | 
            ثبت‌کننده: {report.createdBy?.fullName}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full border px-3 py-1 text-sm font-medium ${
            statusColors[report.approvalStatus] || 'bg-gray-100 text-gray-600'
          }`}>
            {statusLabels[report.approvalStatus] || report.approvalStatus}
          </span>
          {canEdit && !isEditing && (
            <button
              onClick={startEditing}
              className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Edit2 size={14} />
              ویرایش
            </button>
          )}
          <a
            href={`/api/work-reports/${reportId}/pdf`}
            target="_blank"
            className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Download size={14} />
            PDF
          </a>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Printer size={14} />
            چاپ
          </button>
        </div>
      </div>

      {/* Project Info */}
      <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-800">
        <span className="font-medium">پروژه:</span> {report.project?.name} ({report.project?.code})
        {report.project?.employerName && <> | <span className="font-medium">کارفرما:</span> {report.project?.employerName}</>}
      </div>

      {/* View Mode */}
      {!isEditing ? (
        <div className="rounded-lg border border-gray-200 bg-white overflow-x-auto print:border-black">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 print:bg-gray-200">
              <tr>
                <th className="px-4 py-3 text-center font-medium w-12">ردیف</th>
                <th className="px-4 py-3 text-right font-medium">شرح عملیات</th>
                <th className="px-4 py-3 text-center font-medium w-24">واحد</th>
                <th className="px-4 py-3 text-center font-medium w-24">مقدار</th>
                {showPrices && <th className="px-4 py-3 text-left font-medium w-32">فی (ریال)</th>}
                {showPrices && <th className="px-4 py-3 text-left font-medium w-36">مبلغ کل (ریال)</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {report.items.map((item: any, index: number) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-center text-gray-500">{index + 1}</td>
                  <td className="px-4 py-3 text-gray-800">{item.description}</td>
                  <td className="px-4 py-3 text-center text-gray-600">{item.unit}</td>
                  <td className="px-4 py-3 text-center text-gray-600">{item.quantity}</td>
                  {showPrices && (
                    <td className="px-4 py-3 text-left text-gray-600 font-mono">
                      {item.unitPrice > 0 ? item.unitPrice.toLocaleString('fa-IR') : '—'}
                    </td>
                  )}
                  {showPrices && (
                    <td className="px-4 py-3 text-left text-gray-800 font-mono font-medium">
                      {item.totalPrice > 0 ? item.totalPrice.toLocaleString('fa-IR') : '—'}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            {showPrices && grandTotal > 0 && (
              <tfoot className="bg-gray-50 font-bold">
                <tr>
                  <td colSpan={5} className="px-4 py-3 text-left text-gray-700">جمع کل:</td>
                  <td className="px-4 py-3 text-left text-gray-900 font-mono">
                    {grandTotal.toLocaleString('fa-IR')} ریال
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      ) : (
        /* Edit Mode */
        <div className="rounded-lg border border-gray-200 bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-3 py-3 text-center font-medium w-12">ردیف</th>
                <th className="px-3 py-3 text-right font-medium min-w-[200px]">شرح عملیات</th>
                <th className="px-3 py-3 text-center font-medium w-28">واحد</th>
                <th className="px-3 py-3 text-center font-medium w-24">مقدار</th>
                {isManager && <th className="px-3 py-3 text-center font-medium w-32">فی (ریال)</th>}
                {isManager && <th className="px-3 py-3 text-center font-medium w-32">مبلغ کل</th>}
                <th className="px-3 py-3 text-center font-medium w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {editItems.map((item, index) => (
                <tr key={item.tempId}>
                  <td className="px-3 py-2 text-center text-gray-500 font-mono">{index + 1}</td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => updateEditItem(item.tempId, 'description', e.target.value)}
                      className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={item.unit}
                      onChange={(e) => updateEditItem(item.tempId, 'unit', e.target.value)}
                      className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    >
                      {UNITS.map((u) => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.quantity || ''}
                      onChange={(e) => updateEditItem(item.tempId, 'quantity', parseFloat(e.target.value) || 0)}
                      className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-center focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  </td>
                  {isManager && (
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min="0"
                        value={item.unitPrice || ''}
                        onChange={(e) => updateEditItem(item.tempId, 'unitPrice', parseFloat(e.target.value) || 0)}
                        className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-center focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      />
                    </td>
                  )}
                  {isManager && (
                    <td className="px-3 py-2 text-center text-gray-700 font-mono text-xs">
                      {item.totalPrice > 0 ? item.totalPrice.toLocaleString('fa-IR') : '—'}
                    </td>
                  )}
                  <td className="px-3 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => removeEditItem(item.tempId)}
                      disabled={editItems.length === 1}
                      className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-30"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            {isManager && (
              <tfoot className="bg-gray-50 font-bold">
                <tr>
                  <td colSpan={5} className="px-4 py-3 text-left text-gray-700">جمع کل:</td>
                  <td className="px-4 py-3 text-center text-gray-900 font-mono text-xs">
                    {editItems.reduce((s, i) => s + (i.totalPrice || 0), 0).toLocaleString('fa-IR')}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>

          <div className="border-t border-gray-100 px-4 py-3">
            <button
              type="button"
              onClick={addEditItem}
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              <Plus size={16} />
              افزودن ردیف
            </button>
          </div>
        </div>
      )}

      {/* Notes */}
      {isEditing ? (
        <div className="mt-4">
          <label className="mb-1 block text-sm font-medium text-gray-700">توضیحات</label>
          <textarea
            value={editNotes}
            onChange={(e) => setEditNotes(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>
      ) : report.notes ? (
        <div className="mt-4 rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="mb-1 text-sm font-medium text-gray-700">توضیحات:</h3>
          <p className="text-sm text-gray-600 whitespace-pre-wrap">{report.notes}</p>
        </div>
      ) : null}

      {/* Actions */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        {isEditing ? (
          <div className="flex gap-3">
            <button
              onClick={() => setIsEditing(false)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              انصراف
            </button>
            <LoadingButton
              onClick={handleSave}
              isLoading={updateMutation.isPending}
              className="flex items-center gap-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Save size={14} />
              ذخیره تغییرات
            </LoadingButton>
          </div>
        ) : (
          <div />
        )}

        {/* Approve/Reject for managers */}
        {isManager && report.approvalStatus === 'PENDING' && !isEditing && (
          <div className="flex gap-2">
            <LoadingButton
              onClick={() => approveMutation.mutate({ id: reportId })}
              isLoading={approveMutation.isPending}
              className="flex items-center gap-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
            >
              <CheckCircle size={14} />
              تایید گزارش
            </LoadingButton>
            <button
              onClick={() => setRejectDialogOpen(true)}
              className="flex items-center gap-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              <XCircle size={14} />
              رد گزارش
            </button>
          </div>
        )}

      </div>

      {/* Rejection Reason */}
      {report.approvalStatus === 'REJECTED' && report.rejectionReason && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4">
          <h3 className="mb-1 text-sm font-medium text-red-800">دلیل رد:</h3>
          <p className="text-sm text-red-700">{report.rejectionReason}</p>
        </div>
      )}

      {/* Audit Log */}
      {isManager && auditLog && auditLog.length > 0 && (
        <div className="mt-6 rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-gray-700">تاریخچه تغییرات</h3>
          <div className="space-y-2">
            {auditLog.map((entry: any) => (
              <div key={entry.id} className="flex items-start gap-3 border-b border-gray-100 pb-2 last:border-0">
                <div className="flex-shrink-0">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                    entry.action === 'CREATED' ? 'bg-blue-100 text-blue-700' :
                    entry.action === 'UPDATED' ? 'bg-yellow-100 text-yellow-700' :
                    entry.action === 'APPROVED' ? 'bg-green-100 text-green-700' :
                    entry.action === 'REJECTED' ? 'bg-red-100 text-red-700' :
                    entry.action === 'PRICED' ? 'bg-purple-100 text-purple-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {entry.action === 'CREATED' ? 'ایجاد' :
                     entry.action === 'UPDATED' ? 'ویرایش' :
                     entry.action === 'APPROVED' ? 'تایید' :
                     entry.action === 'REJECTED' ? 'رد' :
                     entry.action === 'PRICED' ? 'قیمت‌گذاری' :
                     entry.action}
                  </span>
                </div>
                <div className="flex-1 text-sm text-gray-600">
                  <span className="font-medium">{entry.user?.fullName || 'ناشناس'}</span>
                  <span className="text-gray-400"> — {moment(entry.createdAt).format('jYYYY/jMM/jDD HH:mm')}</span>
                  {entry.changes && <p className="mt-1 text-xs text-gray-500">{entry.changes}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reject Confirm */}
      <ConfirmDialog
        open={rejectDialogOpen}
        title="رد گزارش کار"
        message="آیا از رد این گزارش کار مطمئن هستید؟ پیمانکار می‌تواند گزارش را ویرایش و مجدد ارسال کند."
        confirmText="رد گزارش"
        cancelText="انصراف"
        variant="danger"
        loading={rejectMutation.isPending}
        onConfirm={() => rejectMutation.mutate({ id: reportId })}
        onClose={() => setRejectDialogOpen(false)}
      />
    </div>
  );
}
