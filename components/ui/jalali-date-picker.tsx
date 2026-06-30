'use client';

import { useState, useRef, useEffect } from 'react';
import moment from 'moment-jalaali';
import { ChevronRight, ChevronLeft, Calendar, X } from 'lucide-react';

moment.loadPersian({ usePersianDigits: false });

const JALALI_MONTHS = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
];

const WEEK_DAYS = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

interface JalaliDatePickerProps {
  value: string; // Gregorian date string (YYYY-MM-DD) or empty
  onChange: (value: string) => void; // Returns Gregorian date string
  placeholder?: string;
  className?: string;
}

export function JalaliDatePicker({ value, onChange, placeholder = 'انتخاب تاریخ', className = '' }: JalaliDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewYear, setViewYear] = useState(0);
  const [viewMonth, setViewMonth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize view to the selected date or today
  useEffect(() => {
    const m = value ? moment(value, 'YYYY-MM-DD') : moment();
    setViewYear(m.jYear());
    setViewMonth(m.jMonth());
  }, [value]);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const displayValue = value ? moment(value, 'YYYY-MM-DD').format('jYYYY/jMM/jDD') : '';

  const goToPrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const getDaysInMonth = (jy: number, jm: number) => {
    return moment.jDaysInMonth(jy, jm);
  };

  const getFirstDayOfWeek = (jy: number, jm: number) => {
    // moment day(): 0=Sunday ... 6=Saturday
    // We want Saturday=0
    const firstDay = moment(`${jy}/${jm + 1}/1`, 'jYYYY/jM/jD');
    const day = firstDay.day(); // 0=Sun, 6=Sat
    return day === 6 ? 0 : day + 1;
  };

  const handleDayClick = (day: number) => {
    const selected = moment(`${viewYear}/${viewMonth + 1}/${day}`, 'jYYYY/jM/jD');
    onChange(selected.format('YYYY-MM-DD'));
    setIsOpen(false);
  };

  const isSelectedDay = (day: number) => {
    if (!value) return false;
    const m = moment(value, 'YYYY-MM-DD');
    return m.jYear() === viewYear && m.jMonth() === viewMonth && m.jDate() === day;
  };

  const isToday = (day: number) => {
    const today = moment();
    return today.jYear() === viewYear && today.jMonth() === viewMonth && today.jDate() === day;
  };

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDayOffset = getFirstDayOfWeek(viewYear, viewMonth);

  return (
    <div className="relative" ref={containerRef}>
      <div
        className={`flex items-center gap-2 cursor-pointer rounded-md border border-gray-300 px-2 py-1 text-sm bg-white hover:border-blue-400 transition-colors ${className}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <Calendar size={14} className="text-gray-400 flex-shrink-0" />
        <span className={`flex-1 ${value ? 'text-gray-800' : 'text-gray-400'}`} dir="ltr">
          {displayValue || placeholder}
        </span>
        {value && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange('');
            }}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute top-full mt-1 z-50 w-[280px] rounded-lg border border-gray-200 bg-white p-3 shadow-xl" dir="rtl">
          {/* Header: Year & Month navigation */}
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={goToNextMonth}
              className="rounded p-1 hover:bg-gray-100 transition-colors"
            >
              <ChevronRight size={18} />
            </button>
            <div className="text-sm font-bold text-gray-800">
              {JALALI_MONTHS[viewMonth]} {viewYear}
            </div>
            <button
              type="button"
              onClick={goToPrevMonth}
              className="rounded p-1 hover:bg-gray-100 transition-colors"
            >
              <ChevronLeft size={18} />
            </button>
          </div>

          {/* Week days header */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {WEEK_DAYS.map((d) => (
              <div key={d} className="text-center text-xs font-medium text-gray-500 py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-1">
            {/* Empty cells for offset */}
            {Array.from({ length: firstDayOffset }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {/* Day cells */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const selected = isSelectedDay(day);
              const today = isToday(day);
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => handleDayClick(day)}
                  className={`h-8 w-full rounded text-sm transition-colors
                    ${selected
                      ? 'bg-blue-600 text-white font-bold'
                      : today
                      ? 'bg-blue-50 text-blue-700 font-medium ring-1 ring-blue-300'
                      : 'text-gray-700 hover:bg-gray-100'
                    }`}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Today button */}
          <div className="mt-2 border-t border-gray-100 pt-2">
            <button
              type="button"
              onClick={() => {
                const today = moment();
                setViewYear(today.jYear());
                setViewMonth(today.jMonth());
                onChange(today.format('YYYY-MM-DD'));
                setIsOpen(false);
              }}
              className="w-full rounded py-1 text-xs text-blue-600 hover:bg-blue-50 transition-colors"
            >
              امروز
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
