import { eq, desc, lte, and, or, isNull, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';
import * as schema from './db/schema';
import type { Bill, MonthData } from './db/types';

export { eq, desc, and, or, isNull, sql, schema };

const DATABASE_NAME = 'month2month.db';

let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;

export const getDatabase = () => {
  if (dbInstance) return dbInstance;
  const expoDb = openDatabaseSync(DATABASE_NAME, { enableChangeListener: true });
  dbInstance = drizzle(expoDb, { schema });
  return dbInstance;
};

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

export async function getPayForMonth(month: string): Promise<{ amount: number; payDate: number }> {
  const db = getDatabase();
  const rows = await db
    .select()
    .from(schema.payments)
    .where(lte(schema.payments.month, month))
    .orderBy(desc(schema.payments.month))
    .limit(1);
  if (rows.length > 0) {
    return { amount: rows[0].amount, payDate: rows[0].payDate };
  }
  return { amount: 0, payDate: 1 };
}

export async function getMonthData(month: string): Promise<MonthData> {
  const db = getDatabase();
  const allBills: Bill[] = await db.select().from(schema.bills);

  const monthBills = allBills.filter(b => {
    if (b.isRecurring) {
      const startOk = b.startMonth ? b.startMonth <= month : true;
      const endOk = b.endMonth ? b.endMonth >= month : true;
      return startOk && endOk;
    }
    if (b.date) {
      return monthFromDate(b.date) === month;
    }
    return false;
  });

  const { amount: pay, payDate } = await getPayForMonth(month);
  const totalBills = monthBills.reduce((acc, b) => acc + b.amount, 0);

  return {
    month,
    label: getMonthLabel(month),
    pay,
    payDate,
    bills: monthBills,
    totalBills,
    remaining: pay - totalBills,
  };
}

export async function hasOnboardingData(): Promise<boolean> {
  const db = getDatabase();
  const rows = await db.select().from(schema.payments).limit(1);
  return rows.length > 0;
}

export async function setPay(amount: number, month: string, payDate: number) {
  const db = getDatabase();
  const existing = await db.select().from(schema.payments).where(eq(schema.payments.month, month)).limit(1);
  if (existing.length > 0) {
    await db.update(schema.payments).set({ amount, payDate }).where(eq(schema.payments.month, month));
  } else {
    await db.insert(schema.payments).values({ amount, month, payDate });
  }
}

export async function addBill(
  name: string,
  amount: number,
  isRecurring: boolean,
  date?: string,
  startMonth?: string,
  dueDay?: number,
  category?: string,
) {
  const db = getDatabase();
  await db.insert(schema.bills).values({
    name,
    amount,
    isRecurring,
    date: isRecurring ? null : (date || null),
    startMonth: isRecurring ? (startMonth || getCurrentMonth()) : null,
    endMonth: null,
    dueDay: isRecurring ? (dueDay || 1) : null,
    category: category || 'other',
  });
}

export async function deleteBill(id: number) {
  const db = getDatabase();
  await db.delete(schema.bills).where(eq(schema.bills.id, id));
}

export async function getPay(month: string): Promise<number> {
  const { amount } = await getPayForMonth(month);
  return amount;
}
