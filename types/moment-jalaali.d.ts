declare module 'moment-jalaali' {
  import moment from 'moment';

  interface JMoment extends moment.Moment {
    jYear(): number;
    jMonth(): number;
    jDate(): number;
    jDayOfYear(): number;
    jWeek(): number;
    jWeekYear(): number;
    jYear(y: number): JMoment;
    jMonth(m: number): JMoment;
    jDate(d: number): JMoment;
    format(format?: string): string;
  }

  interface JMomentStatic {
    (): JMoment;
    (date: string | Date | number, format?: string): JMoment;
    jDaysInMonth(year: number, month: number): number;
    jIsLeapYear(year: number): boolean;
    loadPersian(opts?: { usePersianDigits?: boolean; dialect?: string }): void;
  }

  const jMoment: JMomentStatic;
  export default jMoment;
}
