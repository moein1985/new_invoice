'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { useToast } from '@/components/ui/toast-provider';
import { EventModal } from '@/components/ui/event-modal';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { PageSkeleton } from '@/components/ui/skeleton';
import { ChevronRight, ChevronLeft, Plus, Calendar as CalendarIcon } from 'lucide-react';
import moment from 'moment-jalaali';

moment.loadPersian({ usePersianDigits: false });

const JALALI_MONTHS = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
];
const WEEK_DAYS = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];
const WEEK_DAYS_SHORT = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

interface EventData {
  id?: string;
  title: string;
  description?: string | null;
  startDate: string;
  endDate?: string | null;
  allDay: boolean;
  color: string;
  reminderMinutes?: number | null;
  startTime?: string;
  endTime?: string;
}

export default function CalendarPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const toast = useToast();
  const utils = trpc.useUtils();

  const [viewYear, setViewYear] = useState(() => moment().jYear());
  const [viewMonth, setViewMonth] = useState(() => moment().jMonth());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [editingEvent, setEditingEvent] = useState<EventData | null>(null);

  // Calculate gregorian date range for current Jalali month
  const dateRange = useMemo(() => {
    const startOfMonth = moment(`${viewYear}/${viewMonth + 1}/1`, 'jYYYY/jM/jD').startOf('day');
    const daysInMonth = moment.jDaysInMonth(viewYear, viewMonth);
    const endOfMonth = moment(`${viewYear}/${viewMonth + 1}/${daysInMonth}`, 'jYYYY/jM/jD').endOf('day');

    // Extend to full weeks
    const startDow = startOfMonth.day(); // 0=Sun
    const satOffset = startDow === 6 ? 0 : startDow + 1;
    const gridStart = startOfMonth.clone().subtract(satOffset, 'days');
    const gridEnd = endOfMonth.clone().add(6 - ((endOfMonth.day() + 1) % 7), 'days').endOf('day');

    return {
      start: gridStart.toDate(),
      end: gridEnd.toDate(),
      gridStart,
      daysInMonth,
    };
  }, [viewYear, viewMonth]);

  const { data: events, isLoading: eventsLoading } = trpc.calendar.list.useQuery({
    startDate: dateRange.start,
    endDate: dateRange.end,
  });

  // Fetch Iranian holidays for this month
  const { data: holidays } = trpc.calendar.holidays.useQuery({
    jYear: viewYear,
    jMonth: viewMonth,
  });

  const createMutation = trpc.calendar.create.useMutation({
    onSuccess: () => {
      utils.calendar.list.invalidate();
      setIsModalOpen(false);
      setEditingEvent(null);
      toast.success('رویداد با موفقیت ایجاد شد');
    },
    onError: (err) => toast.error('خطا', err.message),
  });

  const updateMutation = trpc.calendar.update.useMutation({
    onSuccess: () => {
      utils.calendar.list.invalidate();
      setIsModalOpen(false);
      setEditingEvent(null);
      toast.success('رویداد با موفقیت ویرایش شد');
    },
    onError: (err) => toast.error('خطا', err.message),
  });

  const deleteMutation = trpc.calendar.delete.useMutation({
    onSuccess: () => {
      utils.calendar.list.invalidate();
      setIsModalOpen(false);
      setEditingEvent(null);
      toast.success('رویداد حذف شد');
    },
    onError: (err) => toast.error('خطا', err.message),
  });

  // Process reminders periodically
  const reminderMutation = trpc.calendar.processReminders.useMutation();
  useEffect(() => {
    // Check reminders every 60 seconds
    const interval = setInterval(() => {
      reminderMutation.mutate();
    }, 60000);
    // Initial check
    reminderMutation.mutate();
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status === 'loading') return <PageSkeleton />;
  if (!session) { router.push('/login'); return null; }

  const today = moment();
  const todayStr = today.format('YYYY-MM-DD');

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewYear(viewYear - 1);
      setViewMonth(11);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewYear(viewYear + 1);
      setViewMonth(0);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const goToday = () => {
    setViewYear(today.jYear());
    setViewMonth(today.jMonth());
  };

  const handleDayClick = (gregorianDate: string) => {
    setSelectedDate(gregorianDate);
    setEditingEvent(null);
    setIsModalOpen(true);
  };

  const handleEventClick = (e: React.MouseEvent, ev: any) => {
    e.stopPropagation();
    const startM = moment(ev.startDate);
    const endM = ev.endDate ? moment(ev.endDate) : null;
    setEditingEvent({
      id: ev.id,
      title: ev.title,
      description: ev.description,
      startDate: startM.format('YYYY-MM-DD'),
      endDate: endM ? endM.format('YYYY-MM-DD') : null,
      allDay: ev.allDay,
      color: ev.color,
      reminderMinutes: ev.reminderMinutes,
      startTime: ev.allDay ? undefined : startM.format('HH:mm'),
      endTime: ev.allDay || !endM ? undefined : endM.format('HH:mm'),
    });
    setIsModalOpen(true);
  };

  const handleSave = (data: EventData) => {
    let startDate = new Date(data.startDate);
    let endDate = data.endDate ? new Date(data.endDate) : undefined;

    if (!data.allDay && data.startTime) {
      const [h, m] = data.startTime.split(':').map(Number);
      startDate.setHours(h, m, 0, 0);
    }
    if (!data.allDay && data.endTime && endDate) {
      const [h, m] = data.endTime.split(':').map(Number);
      endDate.setHours(h, m, 0, 0);
    }

    const payload = {
      title: data.title,
      description: data.description,
      startDate,
      endDate: endDate || null,
      allDay: data.allDay,
      color: data.color,
      reminderMinutes: data.reminderMinutes,
    };

    if (data.id) {
      updateMutation.mutate({ id: data.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate({ id });
  };

  // Build calendar grid
  const buildGrid = () => {
    const rows: { date: moment.Moment; gregorian: string; jDay: number; isCurrentMonth: boolean }[][] = [];
    const current = dateRange.gridStart.clone();
    const daysInMonth = dateRange.daysInMonth;

    while (current.isBefore(dateRange.end) || current.isSame(dateRange.end, 'day')) {
      const week: typeof rows[0] = [];
      for (let i = 0; i < 7; i++) {
        const jD = (current as any).jDate();
        const jM = (current as any).jMonth();
        const jY = (current as any).jYear();
        week.push({
          date: current.clone(),
          gregorian: current.format('YYYY-MM-DD'),
          jDay: jD,
          isCurrentMonth: jM === viewMonth && jY === viewYear,
        });
        current.add(1, 'day');
      }
      rows.push(week);
      if (rows.length >= 6) break; // Max 6 rows
    }
    return rows;
  };

  const grid = buildGrid();

  // Group events by gregorian date
  const eventsByDate = useMemo(() => {
    const map: Record<string, any[]> = {};
    if (!events) return map;
    for (const ev of events) {
      const start = moment(ev.startDate);
      const end = ev.endDate ? moment(ev.endDate) : start;
      const cursor = start.clone().startOf('day');
      while (cursor.isSameOrBefore(end, 'day')) {
        const key = cursor.format('YYYY-MM-DD');
        if (!map[key]) map[key] = [];
        map[key].push(ev);
        cursor.add(1, 'day');
      }
    }
    return map;
  }, [events]);

  // Map holidays by jDay for quick lookup
  const holidaysByDay = useMemo(() => {
    const map: Record<number, string[]> = {};
    if (!holidays) return map;
    for (const h of holidays) {
      if (!map[h.jDay]) map[h.jDay] = [];
      map[h.jDay].push(h.name);
    }
    return map;
  }, [holidays]);

  return (
    <div className="p-4 md:p-6">
      <Breadcrumb items={[{ label: 'تقویم' }]} />

      {/* Header */}
      <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <CalendarIcon size={28} />
          تقویم
        </h1>
        <button
          onClick={() => { setSelectedDate(todayStr); setEditingEvent(null); setIsModalOpen(true); }}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} />
          رویداد جدید
        </button>
      </div>

      {/* Month Navigation */}
      <div className="mb-4 flex items-center justify-between bg-white rounded-xl border border-gray-200 px-4 py-3 shadow-sm">
        <button
          onClick={nextMonth}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
        >
          <ChevronRight size={20} />
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={goToday}
            className="text-xs bg-blue-50 text-blue-600 px-3 py-1 rounded-full hover:bg-blue-100 transition-colors"
          >
            امروز
          </button>
          <h2 className="text-lg font-bold text-gray-800">
            {JALALI_MONTHS[viewMonth]} {viewYear}
          </h2>
        </div>

        <button
          onClick={prevMonth}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
        >
          <ChevronLeft size={20} />
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Weekday Headers */}
        <div className="grid grid-cols-7 border-b border-gray-200">
          {WEEK_DAYS_SHORT.map((day, i) => (
            <div
              key={day}
              className={`text-center py-2.5 text-xs font-bold ${
                i === 6 ? 'text-red-500 bg-red-50/50' : 'text-gray-500 bg-gray-50'
              }`}
            >
              <span className="hidden sm:inline">{WEEK_DAYS[i]}</span>
              <span className="sm:hidden">{day}</span>
            </div>
          ))}
        </div>

        {/* Day Cells */}
        {grid.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 border-b border-gray-100 last:border-b-0">
            {week.map((day, di) => {
              const isToday = day.gregorian === todayStr;
              const dayEvents = eventsByDate[day.gregorian] || [];
              const isFriday = di === 6;
              const dayHolidays = day.isCurrentMonth ? (holidaysByDay[day.jDay] || []) : [];
              const isHoliday = dayHolidays.length > 0;

              return (
                <div
                  key={day.gregorian}
                  onClick={() => handleDayClick(day.gregorian)}
                  className={`min-h-[80px] sm:min-h-[100px] md:min-h-[120px] p-1 border-l border-gray-100 last:border-l-0 cursor-pointer transition-colors hover:bg-blue-50/50 ${
                    !day.isCurrentMonth ? 'bg-gray-50/50' : ''
                  } ${isHoliday ? 'bg-red-50/60' : isFriday ? 'bg-red-50/30' : ''}`}
                >
                  {/* Day Number */}
                  <div className="flex justify-between items-start">
                    <span
                      className={`inline-flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-full text-xs sm:text-sm font-medium ${
                        isToday
                          ? 'bg-blue-600 text-white'
                          : day.isCurrentMonth
                          ? (isHoliday || isFriday) ? 'text-red-500 font-bold' : 'text-gray-800'
                          : 'text-gray-300'
                      }`}
                    >
                      {day.jDay}
                    </span>
                  </div>

                  {/* Holiday Names */}
                  {dayHolidays.length > 0 && (
                    <div className="mt-0.5">
                      {dayHolidays.map((name, hi) => (
                        <div
                          key={hi}
                          className="text-[9px] sm:text-[10px] text-red-600 truncate leading-tight"
                          title={name}
                        >
                          {name}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Events */}
                  <div className="mt-0.5 space-y-0.5">
                    {dayEvents.slice(0, 3).map((ev: any) => (
                      <div
                        key={ev.id}
                        onClick={(e) => handleEventClick(e, ev)}
                        className="text-[10px] sm:text-xs px-1.5 py-0.5 rounded truncate text-white cursor-pointer hover:opacity-80 transition-opacity"
                        style={{ backgroundColor: ev.color || '#3b82f6' }}
                        title={ev.title}
                      >
                        {ev.title}
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <div className="text-[10px] text-gray-400 pr-1">
                        +{dayEvents.length - 3} مورد دیگر
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Event Modal */}
      <EventModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingEvent(null); }}
        onSave={handleSave}
        onDelete={handleDelete}
        event={editingEvent}
        defaultDate={selectedDate}
        isSaving={createMutation.isPending || updateMutation.isPending}
        isDeleting={deleteMutation.isPending}
      />
    </div>
  );
}
