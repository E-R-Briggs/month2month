import { getCurrentMonth } from './utils';

export function buildBillValues(opts: {
  name: string;
  amount: number;
  isRecurring: boolean;
  date?: string;
  startMonth?: string;
  endMonth?: string | null;
  dueDay?: number;
  category?: string;
  frequency?: string;
  weekDay?: number | null;
  type?: string;
  adjustment?: boolean;
}) {
  const { name, amount, isRecurring, date, startMonth, endMonth, dueDay, category, frequency, weekDay, type, adjustment } = opts;
  return {
    name,
    amount,
    isRecurring: isRecurring ? 1 : 0,
    date: isRecurring ? null : (date || null),
    startMonth: isRecurring ? (startMonth || getCurrentMonth()) : null,
    endMonth: isRecurring ? (endMonth ?? null) : null,
    dueDay: isRecurring ? (dueDay || 1) : null,
    frequency: isRecurring ? (frequency || 'monthly') : null,
    weekDay: isRecurring ? (weekDay ?? null) : null,
    category: category || 'other',
    type: type || 'expense',
    adjustment: adjustment ? 1 : 0,
  };
}
