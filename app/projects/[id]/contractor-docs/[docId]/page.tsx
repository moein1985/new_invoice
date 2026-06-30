'use client';

import { useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import moment from 'moment-jalaali';
import { CheckCircle2, Download, Edit2, Image as ImageIcon, Save, XCircle } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { LoadingButton } from '@/components/ui/loading-button';
import { PageSkeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast-provider';

type EditableAttachment = {
  id: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf';
  progress: number;
  previewUrl?: string;
};

function normalizeAttachmentId(filePath: string) {
  return filePath.split('.')[0] || filePath;
}

function uploadFileWithProgress(
  file: File,
  onProgress: (progress: number) => void
): Promise<{ fileName: string; filePath: string; fileSize: number; mimeType: EditableAttachment['mimeType'] }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload/contractor-doc');

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          reject(new Error('پاسخ آپلود نامعتبر است'));
        }
      } else {
        try {
          const parsed = JSON.parse(xhr.responseText);
          reject(new Error(parsed.error || 'خطا در آپلود'));
        } catch {
          reject(new Error('خطا در آپلود'));
        }
      }
    };

    xhr.onerror = () => reject(new Error('خطا در ارتباط با سرور'));

    const formData = new FormData();
    formData.append('file', file);
    xhr.send(formData);
  });
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'در انتظار',
  APPROVED: 'تایید شده',
  REJECTED: 'رد شده',
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  APPROVED: 'bg-green-100 text-green-700 border-green-200',
  REJECTED: 'bg-red-100 text-red-700 border-red-200',
};

const TYPE_LABELS: Record<string, string> = {
  RECEIPT: 'رسید',
  EXPENSE: 'هزینه جزئی',
  GENERAL: 'عمومی',
};

type EditableItem = {
  id: string;
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
};

export default function ContractorDocDetailPage() {
  const { data: session, status } = useSession();
  const params = useParams();
  const router = useRouter();
  const toast = useToast();

  const projectId = params.id as string;
  const docId = params.docId as string;

  const [isEditing, setIsEditing] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const { data: doc, isLoading, refetch } = trpc.contractorDoc.getById.useQuery(
    { id: docId },
    { enabled: !!docId }
  );

  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [totalAmount, setTotalAmount] = useState('0');
  const [items, setItems] = useState<EditableItem[]>([]);
  const [editableAttachments, setEditableAttachments] = useState<EditableAttachment[]>([]);

  const canManage = session?.user.role === 'ADMIN' || session?.user.role === 'MANAGER';
  const isContractorOwner = session?.user.role === 'CONTRACTOR' && doc?.createdById === session.user.id;
  const canEdit = !!doc && doc.approvalStatus === 'PENDING' && (canManage || isContractorOwner);

  const updateMutation = trpc.contractorDoc.update.useMutation({
    onSuccess: () => {
      toast.success('سند با موفقیت ویرایش شد');
      setIsEditing(false);
      refetch();
    },
    onError: (error) => {
      toast.error('خطا', error.message);
    },
  });

  const approveMutation = trpc.contractorDoc.approve.useMutation({
    onSuccess: () => {
      toast.success('سند تایید شد');
      refetch();
    },
    onError: (error) => toast.error('خطا', error.message),
  });

  const rejectMutation = trpc.contractorDoc.reject.useMutation({
    onSuccess: () => {
      toast.success('سند رد شد');
      setRejectReason('');
      refetch();
    },
    onError: (error) => toast.error('خطا', error.message),
  });

  const deleteMutation = trpc.contractorDoc.delete.useMutation({
    onSuccess: () => {
      toast.success('سند حذف شد');
      router.push(`/projects/${projectId}/contractor-docs`);
    },
    onError: (error) => toast.error('خطا', error.message),
  });

  const printableTotal = useMemo(() => {
    if (!doc) return 0;
    return doc.items.reduce((sum: number, item: any) => sum + Number(item.totalPrice || 0), 0);
  }, [doc]);

  if (status === 'loading' || isLoading) {
    return <PageSkeleton />;
  }

  if (!session) {
    router.push('/login');
    return null;
  }

  if (!doc) {
    return <div className="p-6 text-center text-gray-500">سند یافت نشد</div>;
  }

  const startEdit = () => {
    setDescription(doc.description || '');
    setNotes(doc.notes || '');
    setTotalAmount(String(doc.totalAmount || 0));
    setItems(
      doc.items.map((item: any) => ({
        id: item.id,
        description: item.description,
        unit: item.unit,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        totalPrice: Number(item.totalPrice),
      }))
    );
    setEditableAttachments(
      doc.attachments.map((attachment: any) => ({
        id: attachment.id,
        fileName: attachment.fileName,
        filePath: attachment.filePath,
        fileSize: attachment.fileSize,
        mimeType: attachment.mimeType,
        progress: 100,
      }))
    );
    setIsEditing(true);
  };

  const handleUploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      const tempId = `upload-${Date.now()}-${Math.random()}`;
      const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined;

      setEditableAttachments((prev) => [
        ...prev,
        {
          id: tempId,
          fileName: file.name,
          filePath: '',
          fileSize: file.size,
          mimeType: (file.type as EditableAttachment['mimeType']) || 'image/jpeg',
          progress: 0,
          previewUrl,
        },
      ]);

      try {
        const uploaded = await uploadFileWithProgress(file, (progress) => {
          setEditableAttachments((prev) =>
            prev.map((attachment) =>
              attachment.id === tempId ? { ...attachment, progress } : attachment
            )
          );
        });

        setEditableAttachments((prev) =>
          prev.map((attachment) =>
            attachment.id === tempId
              ? {
                  ...attachment,
                  fileName: uploaded.fileName,
                  filePath: uploaded.filePath,
                  fileSize: uploaded.fileSize,
                  mimeType: uploaded.mimeType,
                  progress: 100,
                }
              : attachment
          )
        );
      } catch (error) {
        setEditableAttachments((prev) => prev.filter((attachment) => attachment.id !== tempId));
        toast.error('خطا در آپلود فایل', error instanceof Error ? error.message : 'خطای ناشناخته');
      }
    }
  };

  const removeEditableAttachment = (id: string) => {
    setEditableAttachments((prev) => prev.filter((attachment) => attachment.id !== id));
  };

  const updateItem = (id: string, patch: Partial<EditableItem>) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const next = { ...item, ...patch };
        next.totalPrice = next.quantity * next.unitPrice;
        return next;
      })
    );
  };

  const handleSave = () => {
    const cleanItems = items
      .filter((item) => item.description.trim())
      .map((item) => ({
        description: item.description.trim(),
        unit: item.unit,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
      }));

    if (cleanItems.length === 0) {
      toast.error('حداقل یک آیتم معتبر لازم است');
      return;
    }

    if (editableAttachments.some((attachment) => attachment.progress < 100)) {
      toast.error('منتظر اتمام آپلود فایل‌ها بمانید');
      return;
    }

    updateMutation.mutate({
      id: docId,
      description: description.trim(),
      notes,
      totalAmount: Number(totalAmount),
      items: cleanItems,
      attachments: editableAttachments
        .filter((attachment) => !!attachment.filePath)
        .map((attachment) => ({
          fileName: attachment.fileName,
          filePath: attachment.filePath,
          fileSize: attachment.fileSize,
          mimeType: attachment.mimeType,
        })),
    });
  };

  return (
    <div className="p-4 md:p-6">
      <Breadcrumb
        items={[
          { label: 'پروژه‌ها', href: '/projects' },
          { label: doc.project.name, href: `/projects/${projectId}` },
          { label: 'مستندات پیمانکار', href: `/projects/${projectId}/contractor-docs` },
          { label: doc.docNumber },
        ]}
      />

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">سند {doc.docNumber}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {TYPE_LABELS[doc.type] || doc.type} - {moment(doc.docDate).format('jYYYY/jMM/jDD')} - {doc.createdBy.fullName}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full border px-3 py-1 text-xs font-medium ${STATUS_COLORS[doc.approvalStatus] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
            {STATUS_LABELS[doc.approvalStatus] || doc.approvalStatus}
          </span>

          {canEdit && !isEditing && (
            <button
              type="button"
              onClick={startEdit}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              <Edit2 size={14} />
              ویرایش
            </button>
          )}

          <a
            href={`/api/contractor-docs/${docId}/pdf`}
            target="_blank"
            className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Download size={14} />
            PDF
          </a>

          {canManage && (
            <button
              type="button"
              onClick={() => deleteMutation.mutate({ id: docId })}
              className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
            >
              <XCircle size={14} />
              حذف
            </button>
          )}
        </div>
      </div>

      {/* Rejection Reason */}
      {doc.approvalStatus === 'REJECTED' && doc.rejectionReason && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4">
          <h3 className="mb-1 text-sm font-medium text-red-800">دلیل رد:</h3>
          <p className="text-sm text-red-700">{doc.rejectionReason}</p>
        </div>
      )}

      <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4">
        {isEditing ? (
          <>
            <label className="mb-1 block text-sm font-medium text-gray-700">شرح</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="mb-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />

            <label className="mb-1 block text-sm font-medium text-gray-700">مبلغ کل</label>
            <input
              type="number"
              min="0"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              className="mb-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />

            <label className="mb-1 block text-sm font-medium text-gray-700">یادداشت</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </>
        ) : (
          <>
            <p className="mb-2 text-sm text-gray-700">{doc.description}</p>
            {doc.notes && <p className="text-sm text-gray-500">یادداشت: {doc.notes}</p>}
          </>
        )}
      </div>

      <div className="mb-4 overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-3 py-3 text-center font-medium">ردیف</th>
              <th className="px-3 py-3 text-right font-medium">شرح</th>
              <th className="px-3 py-3 text-center font-medium">واحد</th>
              <th className="px-3 py-3 text-center font-medium">تعداد</th>
              <th className="px-3 py-3 text-center font-medium">قیمت واحد</th>
              <th className="px-3 py-3 text-center font-medium">قیمت کل</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(isEditing ? items : doc.items).map((item: any, index: number) => (
              <tr key={item.id}>
                <td className="px-3 py-2 text-center text-gray-500">{index + 1}</td>
                <td className="px-3 py-2 text-gray-700">
                  {isEditing ? (
                    <input
                      value={item.description}
                      onChange={(e) => updateItem(item.id, { description: e.target.value })}
                      className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                    />
                  ) : (
                    item.description
                  )}
                </td>
                <td className="px-3 py-2 text-center text-gray-600">
                  {isEditing ? (
                    <input
                      value={item.unit}
                      onChange={(e) => updateItem(item.id, { unit: e.target.value })}
                      className="w-24 rounded border border-gray-300 px-2 py-1 text-center text-sm"
                    />
                  ) : (
                    item.unit
                  )}
                </td>
                <td className="px-3 py-2 text-center text-gray-600">
                  {isEditing ? (
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.quantity}
                      onChange={(e) => updateItem(item.id, { quantity: Number(e.target.value) || 0 })}
                      className="w-20 rounded border border-gray-300 px-2 py-1 text-center text-sm"
                    />
                  ) : (
                    item.quantity
                  )}
                </td>
                <td className="px-3 py-2 text-center text-gray-600">
                  {isEditing ? (
                    <input
                      type="number"
                      min="0"
                      value={item.unitPrice}
                      onChange={(e) => updateItem(item.id, { unitPrice: Number(e.target.value) || 0 })}
                      className="w-28 rounded border border-gray-300 px-2 py-1 text-center text-sm"
                    />
                  ) : (
                    Number(item.unitPrice || 0).toLocaleString('fa-IR')
                  )}
                </td>
                <td className="px-3 py-2 text-center font-mono text-xs text-gray-700">
                  {Number(item.totalPrice || 0).toLocaleString('fa-IR')}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-50">
            <tr>
              <td colSpan={5} className="px-3 py-2 text-left font-medium text-gray-700">جمع کل</td>
              <td className="px-3 py-2 text-center font-mono text-xs text-gray-800">
                {isEditing
                  ? items.reduce((sum, item) => sum + item.totalPrice, 0).toLocaleString('fa-IR')
                  : printableTotal.toLocaleString('fa-IR')}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">پیوست‌ها</h2>
        {(isEditing ? editableAttachments : doc.attachments).length === 0 ? (
          <p className="text-sm text-gray-500">پیوستی ثبت نشده است</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(isEditing ? editableAttachments : doc.attachments).map((attachment: any) => {
              const attachmentId = normalizeAttachmentId(attachment.filePath);
              const url = `/api/upload/contractor-doc/${attachmentId}`;
              const isPdf = attachment.mimeType === 'application/pdf';
              return (
                <div key={attachment.id} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  {isPdf ? (
                    <div className="mb-2 flex h-24 items-center justify-center rounded bg-white text-gray-500">
                      <Download size={18} />
                    </div>
                  ) : (
                    <button type="button" className="mb-2 block w-full" onClick={() => setLightboxUrl(url)}>
                      <img src={url} alt={attachment.fileName} className="h-24 w-full rounded object-cover" />
                    </button>
                  )}

                  <p className="truncate text-xs text-gray-700" title={attachment.fileName}>{attachment.fileName}</p>
                  {isEditing && attachment.progress !== undefined && attachment.progress < 100 && (
                    <div className="mt-1 h-1.5 rounded bg-gray-200">
                      <div className="h-1.5 rounded bg-blue-500" style={{ width: `${attachment.progress}%` }} />
                    </div>
                  )}
                  <div className="mt-2 flex items-center justify-between">
                    <a
                      href={url}
                      target="_blank"
                      className="inline-flex items-center gap-1 rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-100"
                    >
                      {isPdf ? <Download size={12} /> : <ImageIcon size={12} />}
                      {isPdf ? 'دانلود PDF' : 'نمایش'}
                    </a>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-gray-500">{Math.round(attachment.fileSize / 1024)}KB</span>
                      {isEditing && (
                        <button
                          type="button"
                          onClick={() => removeEditableAttachment(attachment.id)}
                          className="rounded p-1 text-red-500 hover:bg-red-50"
                        >
                          <XCircle size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {isEditing && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
            <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
              افزودن تصویر/فایل
              <input
                type="file"
                className="hidden"
                multiple
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={(e) => handleUploadFiles(e.target.files)}
              />
            </label>
          </div>
        )}
      </div>

      {isEditing && (
        <div className="mb-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            انصراف
          </button>
          <LoadingButton
            onClick={handleSave}
            isLoading={updateMutation.isPending}
            className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
          >
            <Save size={14} />
            ذخیره
          </LoadingButton>
        </div>
      )}

      {canManage && doc.approvalStatus === 'PENDING' && !isEditing && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-gray-700">اقدامات مدیر</h3>
          <div className="flex flex-wrap items-center gap-2">
            <LoadingButton
              onClick={() => approveMutation.mutate({ id: docId })}
              isLoading={approveMutation.isPending}
              className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700"
            >
              <CheckCircle2 size={14} />
              تایید سند
            </LoadingButton>

            <input
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="دلیل رد"
              className="min-w-52 rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <LoadingButton
              onClick={() => {
                if (!rejectReason.trim()) {
                  toast.error('دلیل رد را وارد کنید');
                  return;
                }
                rejectMutation.mutate({ id: docId, reason: rejectReason.trim() });
              }}
              isLoading={rejectMutation.isPending}
              className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
            >
              <XCircle size={14} />
              رد سند
            </LoadingButton>
          </div>
        </div>
      )}

      {lightboxUrl && (
        <button
          type="button"
          onClick={() => setLightboxUrl(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
        >
          <img src={lightboxUrl} alt="preview" className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain" />
        </button>
      )}
    </div>
  );
}
