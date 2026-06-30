import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const mockGetHolidays = jest.fn();
const mockMoment = jest.fn((date: string) => {
  if (date === '2026-03-21') {
    return {
      jYear: () => 1405,
      jMonth: () => 0,
      jDate: () => 1,
      year: () => 2026,
    };
  }

  return {
    jYear: () => 1404,
    jMonth: () => 11,
    jDate: () => 29,
    year: () => 2026,
  };
}) as any;

mockMoment.jDaysInMonth = jest.fn(() => 31);

jest.mock('date-holidays', () => {
  return jest.fn().mockImplementation(() => ({
    getHolidays: mockGetHolidays,
  }));
});

jest.mock('moment-jalaali', () => mockMoment);

describe('holidays service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns static holidays for year 1405 and selected month', async () => {
    const { getHolidaysForJalaliMonth } = await import('../lib/services/holidays');

    const result = getHolidaysForJalaliMonth(1405, 0);

    expect(Array.isArray(result)).toBe(true);
    expect(result.every((h) => h.jYear === 1405 && h.jMonth === 0)).toBe(true);
    expect(mockGetHolidays).not.toHaveBeenCalled();
  });

  it('falls back to date-holidays package for non-1405 years', async () => {
    mockGetHolidays.mockReturnValue([
      { date: '2026-03-21T00:00:00.000Z', name: 'Nowruz', type: 'public' },
      { date: '2026-03-22T00:00:00.000Z', name: 'Private Day', type: 'optional' },
    ]);

    const { getHolidaysForJalaliMonth } = await import('../lib/services/holidays');

    const result = getHolidaysForJalaliMonth(1405 - 1, 11);

    expect(mockGetHolidays).toHaveBeenCalled();
    expect(Array.isArray(result)).toBe(true);
  });

  it('uses cache for repeated Gregorian year lookups', async () => {
    jest.resetModules();
    mockGetHolidays.mockReset();

    mockGetHolidays.mockReturnValue([
      { date: '2026-03-21T00:00:00.000Z', name: 'Nowruz', type: 'public' },
    ]);

    const { getHolidaysForJalaliMonth } = await import('../lib/services/holidays');

    getHolidaysForJalaliMonth(1404, 11);
    getHolidaysForJalaliMonth(1404, 11);

    expect(mockGetHolidays).toHaveBeenCalledTimes(1);
  });
});
