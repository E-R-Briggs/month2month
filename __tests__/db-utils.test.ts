import {
  getMonthLabel,
  getCurrentMonth,
  monthFromDate,
  getAdjacentMonths,
  prevMonth,
  getWeekdayDatesInMonth,
  getBillDay,
  adjustWeeklyAmount,
  billsInMonth,
} from '../db/utils';
import type { Bill } from '../db/types';
import type { CustomHolidays } from '../utils/businessDays';

describe('getMonthLabel', () => {
  it('formats "2026-04" as "April 2026"', () => {
    expect(getMonthLabel('2026-04')).toBe('April 2026');
  });

  it('formats "2025-12" as "December 2025"', () => {
    expect(getMonthLabel('2025-12')).toBe('December 2025');
  });

  it('formats "2026-01" as "January 2026"', () => {
    expect(getMonthLabel('2026-01')).toBe('January 2026');
  });
});

describe('getCurrentMonth', () => {
  it('returns the current month in YYYY-MM format', () => {
    jest.useFakeTimers({ now: new Date('2026-06-15T12:00:00Z') });
    expect(getCurrentMonth()).toBe('2026-06');
    jest.useRealTimers();
  });
});

describe('monthFromDate', () => {
  it('extracts "2026-04" from "2026-04-15"', () => {
    expect(monthFromDate('2026-04-15')).toBe('2026-04');
  });

  it('extracts "2025-12" from "2025-12-01"', () => {
    expect(monthFromDate('2025-12-01')).toBe('2025-12');
  });
});

describe('getAdjacentMonths', () => {
  it('returns 3 months for range 1 (prev, current, next)', () => {
    const result = getAdjacentMonths('2026-04', 1);
    expect(result).toEqual(['2026-03', '2026-04', '2026-05']);
  });

  it('handles year boundary at January', () => {
    const result = getAdjacentMonths('2026-01', 1);
    expect(result).toEqual(['2025-12', '2026-01', '2026-02']);
  });

  it('handles year boundary at December', () => {
    const result = getAdjacentMonths('2026-12', 1);
    expect(result).toEqual(['2026-11', '2026-12', '2027-01']);
  });
});

describe('prevMonth', () => {
  it('returns previous month', () => {
    expect(prevMonth('2026-04')).toBe('2026-03');
  });

  it('handles year boundary', () => {
    expect(prevMonth('2026-01')).toBe('2025-12');
  });
});

describe('getWeekdayDatesInMonth', () => {
  it('finds all Mondays (day 1) in April 2026', () => {
    const mondays = getWeekdayDatesInMonth('2026-04', 1);
    expect(mondays).toEqual([6, 13, 20, 27]);
  });

  it('finds all Fridays (day 5) in April 2026', () => {
    const fridays = getWeekdayDatesInMonth('2026-04', 5);
    expect(fridays).toEqual([3, 10, 17, 24]);
  });

  it('finds all Sundays (day 0) in April 2026', () => {
    const sundays = getWeekdayDatesInMonth('2026-04', 0);
    expect(sundays).toEqual([5, 12, 19, 26]);
  });
});

describe('getBillDay', () => {
  it('returns dueDay for monthly recurring bill', () => {
    const bill: Bill = {
      id: 1, name: 'Test', amount: 100, isRecurring: 1,
      dueDay: 15, frequency: 'monthly', weekDay: null,
      date: null, startMonth: null, endMonth: null,
      category: null, labelId: null, overrideMonth: null, type: 'expense',
      createdAt: new Date(), updatedAt: new Date(), adjustment: 0,
    };
    expect(getBillDay(bill, '2026-04')).toBe(15);
  });

  it('returns first weekday occurrence for weekly recurring bill', () => {
    const bill: Bill = {
      id: 1, name: 'Test', amount: 10, isRecurring: 1,
      dueDay: null, frequency: 'weekly', weekDay: 1, // Monday
      date: null, startMonth: '2026-04', endMonth: null,
      category: null, labelId: null, overrideMonth: null, type: 'expense',
      createdAt: new Date(), updatedAt: new Date(), adjustment: 0,
    };
    expect(getBillDay(bill, '2026-04')).toBe(6); // first Monday in April 2026
  });

  it('returns day from date for one-time bill', () => {
    const bill: Bill = {
      id: 1, name: 'Test', amount: 50, isRecurring: 0,
      date: '2026-04-20', startMonth: null, endMonth: null,
      dueDay: null, frequency: null, weekDay: null,
      category: null, labelId: null, overrideMonth: null, type: 'expense',
      createdAt: new Date(), updatedAt: new Date(), adjustment: 0,
    };
    expect(getBillDay(bill, '2026-04')).toBe(20);
  });

  it('shifts expense to next business day when adjustment is on and date is a custom holiday', () => {
    const bill: Bill = {
      id: 1, name: 'Test', amount: 50, isRecurring: 1,
      dueDay: 4, frequency: 'monthly', weekDay: null,
      date: null, startMonth: null, endMonth: null,
      category: null, labelId: null, overrideMonth: null, type: 'expense',
      createdAt: new Date(), updatedAt: new Date(), adjustment: 1,
    };
    const customHolidays: CustomHolidays = {
      dates: new Set(['2026-07-04']),
      recurringMMDD: new Set(),
    };
    // July 4 2026 is Saturday — that's a weekend so it's already non-business,
    // but the custom holiday set makes it extra non-business.
    // July 4 2026 is Saturday → next business day should be Monday July 6
    expect(getBillDay(bill, '2026-07', customHolidays)).toBe(6);
  });

  it('shifts income to previous business day when custom holiday falls on due date', () => {
    const bill: Bill = {
      id: 1, name: 'Test', amount: 100, isRecurring: 1,
      dueDay: 25, frequency: 'monthly', weekDay: null,
      date: null, startMonth: null, endMonth: null,
      category: null, labelId: null, overrideMonth: null, type: 'income',
      createdAt: new Date(), updatedAt: new Date(), adjustment: 1,
    };
    // Dec 25 2026 is Friday — also a UK bank holiday (Christmas),
    // but let's make it a custom recurring holiday too to test the combined path
    const customHolidays: CustomHolidays = {
      dates: new Set(),
      recurringMMDD: new Set(['12-25']),
    };
    // Friday Dec 25 → next UK business day is... well it's Christmas, then
    // Dec 26 (Boxing Day) is Saturday (substitute Monday Dec 28).
    // Actually Dec 25 2026 is Friday, Boxing Day Dec 26 is Saturday (substitute Dec 28).
    // Previous business day before Dec 25: Dec 24 (Thursday) — not a holiday
    expect(getBillDay(bill, '2026-12', customHolidays)).toBe(24);
  });
});

describe('adjustWeeklyAmount', () => {
  it('multiplies amount by weekday count for weekly bills', () => {
    const bill: Bill = {
      id: 1, name: 'Test', amount: 10, isRecurring: 1,
      dueDay: null, frequency: 'weekly', weekDay: 1, // Monday (4 in April 2026)
      date: null, startMonth: '2026-04', endMonth: null,
      category: null, labelId: null, overrideMonth: null, type: 'expense',
      createdAt: new Date(), updatedAt: new Date(), adjustment: 0,
    };
    const adjusted = adjustWeeklyAmount(bill, '2026-04');
    expect(adjusted.amount).toBe(40); // 10 * 4 Mondays
  });

  it('returns unchanged for monthly bills', () => {
    const bill: Bill = {
      id: 1, name: 'Test', amount: 100, isRecurring: 1,
      dueDay: 15, frequency: 'monthly', weekDay: null,
      date: null, startMonth: '2026-04', endMonth: null,
      category: null, labelId: null, overrideMonth: null, type: 'expense',
      createdAt: new Date(), updatedAt: new Date(), adjustment: 0,
    };
    expect(adjustWeeklyAmount(bill, '2026-04').amount).toBe(100);
  });
});

describe('billsInMonth', () => {
  const bills: Bill[] = [
    {
      id: 1, name: 'Recurring', amount: 100, isRecurring: 1,
      startMonth: '2026-01', endMonth: null, dueDay: 15,
      frequency: 'monthly', weekDay: null, date: null,
      category: null, labelId: null, overrideMonth: null, type: 'expense',
      createdAt: new Date(), updatedAt: new Date(), adjustment: 0,
    },
    {
      id: 2, name: 'One-time', amount: 50, isRecurring: 0,
      date: '2026-04-10', startMonth: null, endMonth: null,
      dueDay: null, frequency: null, weekDay: null,
      category: null, labelId: null, overrideMonth: null, type: 'expense',
      createdAt: new Date(), updatedAt: new Date(), adjustment: 0,
    },
    {
      id: 3, name: 'Expired', amount: 30, isRecurring: 1,
      startMonth: '2025-01', endMonth: '2025-12', dueDay: 1,
      frequency: 'monthly', weekDay: null, date: null,
      category: null, labelId: null, overrideMonth: null, type: 'expense',
      createdAt: new Date(), updatedAt: new Date(), adjustment: 0,
    },
  ];

  it('includes recurring and one-time bills in active month', () => {
    const result = billsInMonth(bills, '2026-04');
    expect(result).toHaveLength(2);
    expect(result.map(b => b.name)).toEqual(['Recurring', 'One-time']);
  });

  it('excludes bills past their endMonth', () => {
    const result = billsInMonth(bills, '2026-04');
    expect(result.find(b => b.name === 'Expired')).toBeUndefined();
  });

  it('returns empty for month before startMonth', () => {
    const futureBill: Bill = {
      id: 4, name: 'Future', amount: 20, isRecurring: 1,
      startMonth: '2026-06', endMonth: null, dueDay: 1,
      frequency: 'monthly', weekDay: null, date: null,
      category: null, labelId: null, overrideMonth: null, type: 'expense',
      createdAt: new Date(), updatedAt: new Date(), adjustment: 0,
    };
    expect(billsInMonth([futureBill], '2026-04')).toHaveLength(0);
  });
});
