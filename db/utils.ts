import type { Bill } from './types';

function dayFromDate(dateStr: string): number {
  return parseInt(dateStr.slice(8, 10), 10);
}

export function getWeekdayDatesInMonth(month: string, weekDay: number): number[] {
  const [y, m] = month.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const dates: number[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    if (new Date(y, m - 1, d).getDay() === weekDay) {
      dates.push(d);
    }
  }
  return dates;
}

export function prevMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function getMonthLabel(monthStr: string): string {
  const [year, month] = monthStr.split('-').map(Number);
  const date = new Date(year, month - 1);
  return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

export function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function monthFromDate(dateStr: string): string {
  return dateStr.slice(0, 7);
}

export function getAdjacentMonths(center: string, range: number): string[] {
  const [year, month] = center.split('-').map(Number);
  const months: string[] = [];
  for (let i = -range; i <= range; i++) {
    const d = new Date(year, month - 1 + i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return months;
}

export function getBillDay(b: Bill, month: string): number | null {
  if (b.isRecurring && b.frequency === 'weekly' && b.weekDay != null) {
    const dates = getWeekdayDatesInMonth(month, b.weekDay);
    return dates.length > 0 ? dates[0] : null;
  }
  if (b.isRecurring) return b.dueDay ?? null;
  if (b.date) return dayFromDate(b.date);
  return null;
}

export function adjustWeeklyAmount(b: Bill, month: string): Bill {
  if (b.isRecurring && b.frequency === 'weekly' && b.weekDay != null) {
    return { ...b, amount: b.amount * getWeekdayDatesInMonth(month, b.weekDay).length };
  }
  return b;
}

export function billsInMonth(allBills: Bill[], month: string): Bill[] {
  return allBills.filter(b => {
    if (b.isRecurring) {
      const active = b.startMonth ? b.startMonth <= month : true;
      const done = b.endMonth ? b.endMonth >= month : true;
      return active && done;
    }
    if (b.date) return monthFromDate(b.date) === month;
    return false;
  });
}
