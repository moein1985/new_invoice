'use client';

import { useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import moment from 'moment-jalaali';
import { Camera, Paperclip, Plus, Trash2, Upload } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { PageSkeleton } from '@/components/ui/skeleton';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { LoadingButton } from '@/components/ui/loading-button';
import { useToast } from '@/components/ui/toast-provider';
import { JalaliDatePicker } from '@/components/ui/jalali-date-picker';

const UNITS = ['متر', 'عدد', 'کیلوگرم', 'مترمربع', 'مترمکعب', 'شاخه', 'تن', 'لیتر', 'سایر'];

type DocItem = {
  id: string;
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
};

type UploadedAttachment = {
  id: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf';
  progress: number;
  previewUrl?: string;
};

function uploadFileWithProgress(
  file: File,
  onProgress: (progress: number) => void
): Promise<{ fileName: string; filePath: string; fileSize: number; mimeType: UploadedAttachment['mimeType'] }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload/contractor-doc');

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100);
        onProgress(percent);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const parsed = JSON.parse(xhr.responseText);
          resolve(parsed);
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

export default function NewProjectContractorDocPage() {
  const { data: session, status } = useSession();
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const projectId = params.id as string;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [type, setType] = useState<'RECEIPT' | 'EXPENSE' | 'GENERAL'>('RECEIPT');
  const [direction, setDirection] = useState<'RECEIVED' | 'DELIVERED'>('RECEIVED');
  const [description, setDescription] = useState('');
  const [docDate, setDocDate] = useState(moment().format('YYYY-MM-DD'));
  const [totalAmount, setTotalAmount] = useState('0');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<DocItem[]>([
    {
      id: 'item-1',
      description: '',
      unit: 'عدد',
      quantity: 1,
      unitPrice: 0,
      totalPrice: 0,
    },
  ]);
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);

  const { data: project, isLoading: projectLoading } = trpc.project.getById.useQuery(
    { id: projectId },
    { enabled: !!projectId }
  );

  const createMutation = trpc.contractorDoc.create.useMutation({
    onSuccess: (doc) => {
      toast.success('سند پیمانکار با موفقیت ثبت شد');
      router.push(`/projects/${projectId}/contractor-docs/${doc.id}`);
    },
    onError: (error) => {
      toast.error('خطا', error.message);
    },
  });

  if (status === 'loading' || projectLoading) {
    return <PageSkeleton />;
  }

  if (!session) {
    router.push('/login');
    return null;
  }

  if (!project) {
    return <div className="p-6 text-center text-gray-500">پروژه یافت نشد</div>;
  }

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: `item-${Date.now()}`,
        description: '',
        unit: 'عدد',
        quantity: 1,
        unitPrice: 0,
        totalPrice: 0,
      },
    ]);
  };

  const removeItem = (id: string) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const updateItem = (id: string, patch: Partial<DocItem>) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const next = { ...item, ...patch };
        next.totalPrice = next.quantity * next.unitPrice;
        return next;
      })
    );
  };

  const handleUploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      const tempId = `upload-${Date.now()}-${Math.random()}`;
      const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined;

      setAttachments((prev) => [
        ...prev,
        {
          id: tempId,
          fileName: file.name,
          filePath: '',
          fileSize: file.size,
          mimeType: (file.type as UploadedAttachment['mimeType']) || 'image/jpeg',
          progress: 0,
          previewUrl,
        },
      ]);

      try {
        const uploaded = await uploadFileWithProgress(file, (progress) => {
          setAttachments((prev) =>
            prev.map((attachment) =>
              attachment.id === tempId ? { ...attachment, progress } : attachment
            )
          );
        });

        setAttachments((prev) =>
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
        setAttachments((prev) => prev.filter((attachment) => attachment.id !== tempId));
        toast.error('خطا در آپلود فایل', error instanceof Error ? error.message : 'خطای ناشناخته');
      }
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((attachment) => attachment.id !== id));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (!description.trim()) {
      toast.error('شرح سند الزامی است');
      return;
    }

    const cleanedItems = items
      .filter((item) => item.description.trim())
      .map((item) => ({
        description: item.description.trim(),
        unit: item.unit,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
      }));

    if (cleanedItems.length === 0) {
      toast.error('حداقل یک آیتم با شرح معتبر لازم است');
      return;
    }

    if (type === 'EXPENSE' && Number(totalAmount) <= 0) {
      toast.error('برای سند هزینه، مبلغ کل باید بیشتر از صفر باشد');
      return;
    }

    const pendingUpload = attachments.some((attachment) => attachment.progress < 100);
    if (pendingUpload) {
      toast.error('منتظر اتمام آپلود فایل‌ها بمانید');
      return;
    }

    createMutation.mutate({
      projectId,
      type,
      direction: type === 'RECEIPT' ? direction : undefined,
      description: description.trim(),
      totalAmount: Number(totalAmount),
      docDate,
      notes: notes || undefined,
      items: cleanedItems,
      attachments: attachments
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
          { label: project.name, href: `/projects/${projectId}` },
          { label: 'مستندات پیمانکار', href: `/projects/${projectId}/contractor-docs` },
          { label: 'ثبت سند جدید' },
        ]}
      />

      <h1 className="mb-6 text-2xl font-bold text-gray-800">ثبت سند پیمانکار</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 gap-4 rounded-lg border border-gray-200 bg-white p-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">نوع سند</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as 'RECEIPT' | 'EXPENSE' | 'GENERAL')}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              <option value="RECEIPT">رسید تحویل/دریافت</option>
              <option value="EXPENSE">هزینه جزئی</option>
              <option value="GENERAL">مستند عمومی</option>
            </select>
          </div>

          {type === 'RECEIPT' && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">جهت سند</label>
              <select
                value={direction}
                onChange={(e) => setDirection(e.target.value as 'RECEIVED' | 'DELIVERED')}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                <option value="RECEIVED">دریافت از پروژه</option>
                <option value="DELIVERED">تحویل به پروژه</option>
              </select>
            </div>
          )}

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-700">شرح سند</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="شرح کامل سند..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">تاریخ سند</label>
            <JalaliDatePicker value={docDate} onChange={setDocDate} className="h-10" />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">مبلغ کل</label>
            <input
              type="number"
              min="0"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-3 py-3 text-center font-medium">ردیف</th>
                <th className="px-3 py-3 text-right font-medium">شرح قلم</th>
                <th className="px-3 py-3 text-center font-medium">واحد</th>
                <th className="px-3 py-3 text-center font-medium">مقدار</th>
                <th className="px-3 py-3 text-center font-medium">قیمت واحد</th>
                <th className="px-3 py-3 text-center font-medium">قیمت کل</th>
                <th className="px-3 py-3 text-center font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item, index) => (
                <tr key={item.id}>
                  <td className="px-3 py-2 text-center text-gray-500">{index + 1}</td>
                  <td className="px-3 py-2">
                    <input
                      value={item.description}
                      onChange={(e) => updateItem(item.id, { description: e.target.value })}
                      className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                      placeholder="شرح قلم"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={item.unit}
                      onChange={(e) => updateItem(item.id, { unit: e.target.value })}
                      className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                    >
                      {UNITS.map((unit) => (
                        <option key={unit} value={unit}>
                          {unit}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.quantity}
                      onChange={(e) => updateItem(item.id, { quantity: Number(e.target.value) || 0 })}
                      className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-center"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min="0"
                      value={item.unitPrice}
                      onChange={(e) => updateItem(item.id, { unitPrice: Number(e.target.value) || 0 })}
                      className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-center"
                    />
                  </td>
                  <td className="px-3 py-2 text-center font-mono text-xs text-gray-700">
                    {item.totalPrice > 0 ? item.totalPrice.toLocaleString('fa-IR') : '0'}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
                      disabled={items.length === 1}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-gray-100 px-4 py-3">
            <button
              type="button"
              onClick={addItem}
              className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              <Plus size={14} />
              افزودن ردیف
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              <Upload size={14} />
              افزودن تصویر/فایل
            </button>
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              <Camera size={14} />
              عکس از دوربین
            </button>
            <span className="text-xs text-gray-500">jpeg, png, webp, pdf - حداکثر 10MB</span>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            multiple
            accept="image/jpeg,image/png,image/webp,application/pdf"
            onChange={(e) => handleUploadFiles(e.target.files)}
          />
          <input
            ref={cameraInputRef}
            type="file"
            className="hidden"
            multiple
            accept="image/*"
            capture="environment"
            onChange={(e) => handleUploadFiles(e.target.files)}
          />

          {attachments.length > 0 && (
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {attachments.map((attachment) => (
                <div key={attachment.id} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  {attachment.previewUrl ? (
                    <img src={attachment.previewUrl} alt={attachment.fileName} className="mb-2 h-24 w-full rounded object-cover" />
                  ) : (
                    <div className="mb-2 flex h-24 items-center justify-center rounded bg-white text-gray-400">
                      <Paperclip size={18} />
                    </div>
                  )}
                  <p className="truncate text-xs text-gray-700" title={attachment.fileName}>{attachment.fileName}</p>
                  <div className="mt-1 h-1.5 rounded bg-gray-200">
                    <div className="h-1.5 rounded bg-blue-500" style={{ width: `${attachment.progress}%` }} />
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[11px] text-gray-500">{attachment.progress}%</span>
                    <button
                      type="button"
                      onClick={() => removeAttachment(attachment.id)}
                      className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <label className="mb-1 block text-sm font-medium text-gray-700">یادداشت</label>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="توضیحات تکمیلی..."
          />
        </div>

        <div className="flex justify-end gap-3">
          <Link
            href={`/projects/${projectId}/contractor-docs`}
            className="rounded-lg border border-gray-300 px-5 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            انصراف
          </Link>
          <LoadingButton
            type="submit"
            isLoading={createMutation.isPending}
            className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            ثبت سند
          </LoadingButton>
        </div>
      </form>
    </div>
  );
}
