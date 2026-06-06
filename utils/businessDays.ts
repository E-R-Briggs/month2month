const BANK_HOLIDAY_RULES: ((year: number) => { month: number; day: number } | null)[] = [
  // New Year's Day — Jan 1, substitute the following Monday if on weekend
  (year) => {
    const d = new Date(year, 0, 1);
    const day = d.getDay();
    if (day === 0) return { month: 0, day: 2 };
    if (day === 6) return { month: 0, day: 3 };
    return { month: 0, day: 1 };
  },

  // Good Friday — 2 days before Easter Sunday
  (year) => {
    const easter = getEasterSunday(year);
    const gf = new Date(easter);
    gf.setDate(gf.getDate() - 2);
    return { month: gf.getMonth(), day: gf.getDate() };
  },

  // Easter Monday — 1 day after Easter Sunday
  (year) => {
    const easter = getEasterSunday(year);
    const em = new Date(easter);
    em.setDate(em.getDate() + 1);
    return { month: em.getMonth(), day: em.getDate() };
  },

  // Early May Bank Holiday — first Monday in May
  (year) => {
    const d = new Date(year, 4, 1);
    const diff = d.getDay() === 0 ? 1 : (8 - d.getDay()) % 7;
    d.setDate(d.getDate() + diff);
    return { month: d.getMonth(), day: d.getDate() };
  },

  // Spring Bank Holiday — last Monday in May
  (year) => {
    const d = new Date(year, 4, 31);
    const diff = d.getDay() === 0 ? 0 : d.getDay() - 1;
    d.setDate(d.getDate() - diff);
    return { month: d.getMonth(), day: d.getDate() };
  },

  // Summer Bank Holiday — last Monday in August
  (year) => {
    const d = new Date(year, 7, 31);
    const diff = d.getDay() === 0 ? 0 : d.getDay() - 1;
    d.setDate(d.getDate() - diff);
    return { month: d.getMonth(), day: d.getDate() };
  },

  // Christmas Day — Dec 25, substitute rules apply
  (year) => {
    const d = new Date(year, 11, 25);
    const day = d.getDay();
    if (day === 0) return { month: 11, day: 26 };
    if (day === 6) return { month: 11, day: 27 };
    return { month: 11, day: 25 };
  },

  // Boxing Day — Dec 26, substitute rules apply
  (year) => {
    const d = new Date(year, 11, 26);
    const day = d.getDay();
    if (day === 0) return { month: 11, day: 27 };
    if (day === 6) {
      const nextYear = new Date(year, 11, 28);
      return { month: nextYear.getMonth() - 12, day: nextYear.getDate() };
    }
    return { month: 11, day: 26 };
  },
];

import { formatDateLocal } from './helpers';

export type CustomHolidays = {
  dates: Set<string>;
  recurringMMDD: Set<string>;
};

export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

export function getEasterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

export function getUKBankHolidays(year: number): Date[] {
  return BANK_HOLIDAY_RULES
    .map(rule => rule(year))
    .filter((r): r is { month: number; day: number } => r !== null)
    .map(r => new Date(year, r.month, r.day));
}

export function isUKBankHoliday(date: Date): boolean {
  const holidays = getUKBankHolidays(date.getFullYear());
  return holidays.some(h =>
    h.getMonth() === date.getMonth() && h.getDate() === date.getDate()
  );
}

export function isBusinessDay(date: Date, custom?: CustomHolidays): boolean {
  if (isWeekend(date)) return false;
  if (isUKBankHoliday(date)) return false;
  if (custom) {
    const dateStr = formatDateLocal(date);
    if (custom.dates.has(dateStr)) return false;
    if (custom.recurringMMDD.has(dateStr.slice(5))) return false;
  }
  return true;
}

export function previousBusinessDay(date: Date, custom?: CustomHolidays): Date {
  const result = new Date(date);
  if (isBusinessDay(result, custom)) return result;
  result.setDate(result.getDate() - 1);
  while (!isBusinessDay(result, custom)) {
    result.setDate(result.getDate() - 1);
  }
  return result;
}

export function nextBusinessDay(date: Date, custom?: CustomHolidays): Date {
  const result = new Date(date);
  if (isBusinessDay(result, custom)) return result;
  result.setDate(result.getDate() + 1);
  while (!isBusinessDay(result, custom)) {
    result.setDate(result.getDate() + 1);
  }
  return result;
}


