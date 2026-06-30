import Holidays from 'date-holidays';
import { HOLIDAYS_1405 } from '@/lib/data/iran-holidays-1405';

export interface HolidayInfo {
  date: string;       // Gregorian YYYY-MM-DD
  jYear: number;
  jMonth: number;     // 0-based
  jDay: number;
  name: string;
  type: string;
}

// Cache holidays per Gregorian year (used for date-holidays fallback)
const cache = new Map<number, HolidayInfo[]>();

/**
 * Get holidays for a Jalali month using static data from time.ir.
 * Falls back to date-holidays package for unsupported years.
 * jMonth is 0-based (0 = Farvardin).
 */
export function getHolidaysForJalaliMonth(jYear: number, jMonth: number): HolidayInfo[] {
  // Use static data for 1405 (sourced from time.ir - authoritative Iranian calendar)
  if (jYear === 1405) {
    const month1Based = jMonth + 1;
    return HOLIDAYS_1405
      .filter(h => h.jMonth === month1Based)
      .map(h => ({
        date: h.gdate,
        jYear: 1405,
        jMonth: jMonth,     // 0-based
        jDay: h.jDay,
        name: h.title,
        type: 'public',
      }));
  }

  // Fallback to date-holidays for other years
  return getHolidaysFromDateHolidaysPackage(jYear, jMonth);
}

function getHolidaysForGregorianYear(gYear: number): HolidayInfo[] {
  if (cache.has(gYear)) return cache.get(gYear)!;

  const hd = new Holidays('IR');
  const raw = hd.getHolidays(gYear);

  const moment = require('moment-jalaali');

  const holidays: HolidayInfo[] = raw
    .filter((h: any) => h.type === 'public')
    .map((h: any) => {
      const dateStr = h.date.slice(0, 10); // YYYY-MM-DD
      const m = moment(dateStr, 'YYYY-MM-DD');
      return {
        date: dateStr,
        jYear: m.jYear(),
        jMonth: m.jMonth(),    // 0-based
        jDay: m.jDate(),
        name: h.name,
        type: h.type,
      };
    });

  cache.set(gYear, holidays);
  return holidays;
}

function getHolidaysFromDateHolidaysPackage(jYear: number, jMonth: number): HolidayInfo[] {
  const moment = require('moment-jalaali');

  const startOfMonth = moment(`${jYear}/${jMonth + 1}/1`, 'jYYYY/jM/jD');
  const daysInMonth = moment.jDaysInMonth(jYear, jMonth);
  const endOfMonth = moment(`${jYear}/${jMonth + 1}/${daysInMonth}`, 'jYYYY/jM/jD');

  const gYearStart = startOfMonth.year();
  const gYearEnd = endOfMonth.year();

  const allHolidays: HolidayInfo[] = [];
  allHolidays.push(...getHolidaysForGregorianYear(gYearStart));
  if (gYearEnd !== gYearStart) {
    allHolidays.push(...getHolidaysForGregorianYear(gYearEnd));
  }

  return allHolidays.filter(h => h.jYear === jYear && h.jMonth === jMonth);
}
