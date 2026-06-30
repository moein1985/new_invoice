'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { useToast } from '@/components/ui/toast-provider';
import { LoadingButton } from '@/components/ui/loading-button';
import { PageSkeleton } from '@/components/ui/skeleton';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { Plus, Trash2 } from 'lucide-react';
import { JalaliDatePicker } from '@/components/ui/jalali-date-picker';
import moment from 'moment-jalaali';

const UNITS = [
  'متر',
  'عدد',
  'کیلوگرم',
  'مترمربع',
  'مترمکعب',
  'شاخه',
  'تن',
  'لیتر',
  'سایر',
];

type WorkItem = {
  id: string;
  description: string;
  unit: string;
  quantity: number;
};

export default function NewWorkReportPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const toast = useToast();
  const projectId = params.id as string;

  const [items, setItems] = useState<WorkItem[]>([
    { id: '1', description: '', unit: 'متر', quantity: 0 },
  ]);
  const [notes, setNotes] = useState('');
  const [reportDate, setReportDate] = useState(moment().format('YYYY-MM-DD'));
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState<number | null>(null);
  const [suggestionQuery, setSuggestionQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  const { data: project, isLoading: projectLoading } = trpc.project.getById.useQuery(
    { id: projectId },
    { enabled: !!projectId }
  );

  // Debounce suggestion query
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(suggestionQuery), 300);
    return () => clearTimeout(t);
  }, [suggestionQuery]);

  const { data: suggestions } = trpc.workReport.searchDescriptions.useQuery(
    { query: debouncedQuery },
    { enabled: debouncedQuery.length >= 2 }
  );

  const createMutation = trpc.workReport.create.useMutation({
    onSuccess: () => {
      toast.success('گزارش کار با موفقیت ثبت شد');
      router.push(`/projects/${projectId}`);
    },
    onError: (error) => {
      toast.error('خطا در ثبت گزارش', error.message);
    },
  });

  if (status === 'loading' || projectLoading) return <PageSkeleton />;
  if (!session) { router.push('/login'); return null; }
  if (!project) {
    return <div className="p-6 text-center text-gray-500">پروژه یافت نشد</div>;
  }

  const addItem = () => {
    setItems([...items, {
      id: Date.now().toString(),
      description: '',
      unit: 'متر',
      quantity: 0,
    }]);
  };

  const removeItem = (id: string) => {
    if (items.length === 1) return;
    setItems(items.filter((i) => i.id !== id));
  };

  const updateItem = (id: string, field: keyof WorkItem, value: string | number) => {
    setItems(items.map((i) => i.id === id ? { ...i, [field]: value } : i));
  };

  const handleDescriptionChange = (id: string, value: string, index: number) => {
    updateItem(id, 'description', value);
    setSuggestionQuery(value);
    setActiveSuggestionIndex(index);
  };

  const selectSuggestion = (id: string, text: string) => {
    updateItem(id, 'description', text);
    setActiveSuggestionIndex(null);
    setSuggestionQuery('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const validItems = items.filter((i) => i.description.trim());
    if (validItems.length === 0) {
      toast.error('حداقل یک آیتم با شرح الزامی است');
      return;
    }

    createMutation.mutate({
      projectId,
      items: validItems.map((i) => ({
        description: i.description.trim(),
        unit: i.unit,
        quantity: i.quantity,
      })),
      notes: notes || undefined,
      reportDate,
    });
  };

  return (
    <div className="p-4 md:p-6">
      <Breadcrumb items={[
        { label: 'پروژه‌ها', href: '/projects' },
        { label: project.name, href: `/projects/${projectId}` },
        { label: 'گزارش جدید' },
      ]} />

      <h1 className="mb-6 text-2xl font-bold text-gray-800">ثبت گزارش کار جدید</h1>

      <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
        <span className="font-medium">پروژه:</span> {project.name} ({project.code})
        {project.employerName && <> | <span className="font-medium">کارفرما:</span> {project.employerName}</>}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Report Date */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">تاریخ گزارش</label>
          <JalaliDatePicker value={reportDate} onChange={setReportDate} className="h-10" />
        </div>

        {/* Items Table */}
        <div className="rounded-lg border border-gray-200 bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-3 py-3 text-center font-medium w-12">ردیف</th>
                <th className="px-3 py-3 text-right font-medium min-w-[250px]">شرح عملیات</th>
                <th className="px-3 py-3 text-center font-medium w-32">واحد</th>
                <th className="px-3 py-3 text-center font-medium w-28">مقدار</th>
                <th className="px-3 py-3 text-center font-medium w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item, index) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-center text-gray-500 font-mono">{index + 1}</td>
                  <td className="px-3 py-2 relative">
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => handleDescriptionChange(item.id, e.target.value, index)}
                      onFocus={() => { setActiveSuggestionIndex(index); setSuggestionQuery(item.description); }}
                      onBlur={() => setTimeout(() => setActiveSuggestionIndex(null), 200)}
                      placeholder="شرح عملیات انجام شده..."
                      className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                    {/* Autocomplete Suggestions */}
                    {activeSuggestionIndex === index && suggestions && suggestions.length > 0 && (
                      <div className="absolute top-full right-0 left-0 z-10 mt-1 max-h-40 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                        {suggestions.map((s: any) => (
                          <button
                            key={s.id}
                            type="button"
                            onMouseDown={() => selectSuggestion(item.id, s.text)}
                            className="w-full px-3 py-2 text-right text-sm hover:bg-blue-50 transition-colors"
                          >
                            {s.text}
                          </button>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={item.unit}
                      onChange={(e) => updateItem(item.id, 'unit', e.target.value)}
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
                      onChange={(e) => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                      className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-center focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      placeholder="0"
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      disabled={items.length === 1}
                      className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed"
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
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              <Plus size={16} />
              افزودن ردیف
            </button>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">توضیحات (اختیاری)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            placeholder="توضیحات تکمیلی..."
          />
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-lg border border-gray-300 px-6 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            انصراف
          </button>
          <LoadingButton
            type="submit"
            isLoading={createMutation.isPending}
            className="rounded-lg bg-green-600 px-6 py-2 text-sm font-medium text-white hover:bg-green-700"
          >
            ارسال جهت تایید
          </LoadingButton>
        </div>
      </form>
    </div>
  );
}
