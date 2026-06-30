'use client';

import { useState, useEffect } from 'react';
import { X, Trash2 } from 'lucide-react';
import { JalaliDatePicker } from '@/components/ui/jalali-date-picker';
import { LoadingButton } from '@/components/ui/loading-button';

const COLORS = [
  { value: '#3b82f6', label: 'آبی' },
  { value: '#ef4444', label: 'قرمز' },
  { value: '#22c55e', label: 'سبز' },
  { value: '#f59e0b', label: 'زرد' },
  { value: '#8b5cf6', label: 'بنفش' },
  { value: '#ec4899', label: 'صورتی' },
  { value: '#06b6d4', label: 'فیروزه‌ای' },
  { value: '#f97316', label: 'نارنجی' },
];

const REMINDER_OPTIONS = [
  { value: null, label: 'بدون یادآوری' },
  { value: 10, label: '۱۰ دقیقه قبل' },
  { value: 30, label: '۳۰ دقیقه قبل' },
  { value: 60, label: '۱ ساعت قبل' },
  { value: 180, label: '۳ ساعت قبل' },
  { value: 1440, label: '۱ روز قبل' },
  { value: 2880, label: '۲ روز قبل' },
  { value: 10080, label: '۱ هفته قبل' },
];

interface EventData {
  id?: string;
  title: string;
  description?: string | null;
  startDate: string; // YYYY-MM-DD
  endDate?: string | null;
  allDay: boolean;
  color: string;
  reminderMinutes?: number | null;
  startTime?: string; // HH:mm
  endTime?: string; // HH:mm
}

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: EventData) => void;
  onDelete?: (id: string) => void;
  event?: EventData | null;
  defaultDate?: string;
  isSaving?: boolean;
  isDeleting?: boolean;
}

export function EventModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  event,
  defaultDate,
  isSaving,
  isDeleting,
}: EventModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [allDay, setAllDay] = useState(true);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [color, setColor] = useState('#3b82f6');
  const [reminderMinutes, setReminderMinutes] = useState<number | null>(null);

  useEffect(() => {
    if (event) {
      setTitle(event.title);
      setDescription(event.description || '');
      setStartDate(event.startDate);
      setEndDate(event.endDate || '');
      setAllDay(event.allDay);
      setStartTime(event.startTime || '09:00');
      setEndTime(event.endTime || '10:00');
      setColor(event.color);
      setReminderMinutes(event.reminderMinutes ?? null);
    } else {
      setTitle('');
      setDescription('');
      setStartDate(defaultDate || '');
      setEndDate('');
      setAllDay(true);
      setStartTime('09:00');
      setEndTime('10:00');
      setColor('#3b82f6');
      setReminderMinutes(null);
    }
  }, [event, defaultDate, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !startDate) return;

    onSave({
      id: event?.id,
      title: title.trim(),
      description: description.trim() || null,
      startDate,
      endDate: endDate || null,
      allDay,
      startTime: allDay ? undefined : startTime,
      endTime: allDay ? undefined : endTime,
      color,
      reminderMinutes,
    });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-800">
            {event?.id ? 'ویرایش رویداد' : 'رویداد جدید'}
          </h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">عنوان *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="عنوان رویداد"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Color */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">رنگ</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColor(c.value)}
                  className={`w-7 h-7 rounded-full border-2 transition-all ${
                    color === c.value ? 'border-gray-800 scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c.value }}
                  title={c.label}
                />
              ))}
            </div>
          </div>

          {/* All Day Toggle */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="allDay"
              checked={allDay}
              onChange={(e) => setAllDay(e.target.checked)}
              className="rounded border-gray-300"
            />
            <label htmlFor="allDay" className="text-sm text-gray-700">تمام روز</label>
          </div>

          {/* Start Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">تاریخ شروع *</label>
              <JalaliDatePicker value={startDate} onChange={setStartDate} placeholder="انتخاب تاریخ" />
            </div>
            {!allDay && (
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">ساعت شروع</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            )}
          </div>

          {/* End Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">تاریخ پایان</label>
              <JalaliDatePicker value={endDate} onChange={setEndDate} placeholder="انتخاب تاریخ" />
            </div>
            {!allDay && (
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">ساعت پایان</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            )}
          </div>

          {/* Reminder */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">یادآوری</label>
            <select
              value={reminderMinutes === null ? 'null' : String(reminderMinutes)}
              onChange={(e) => setReminderMinutes(e.target.value === 'null' ? null : Number(e.target.value))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              {REMINDER_OPTIONS.map((opt) => (
                <option key={String(opt.value)} value={opt.value === null ? 'null' : String(opt.value)}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Description / Notes */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">یادداشت</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="توضیحات یا یادداشت..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            <div>
              {event?.id && onDelete && (
                <LoadingButton
                  type="button"
                  isLoading={isDeleting}
                  onClick={() => onDelete(event.id!)}
                  className="rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  <Trash2 size={16} className="inline ml-1" />
                  حذف
                </LoadingButton>
              )}
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                انصراف
              </button>
              <LoadingButton
                type="submit"
                isLoading={isSaving}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                {event?.id ? 'ذخیره تغییرات' : 'ایجاد رویداد'}
              </LoadingButton>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
