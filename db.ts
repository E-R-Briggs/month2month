import { eq, desc, lte, and, or, isNull, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';
import * as schema from './db/schema';
import type { Bill, MonthData, Label } from './db/types';
import {
  getWeekdayDatesInMonth,
  prevMonth,
  getMonthLabel,
  getCurrentMonth,
  monthFromDate,
  getBillDay,
  adjustWeeklyAmount,
  billsInMonth,
} from './db/utils';

export { eq, desc, and, or, isNull, sql, schema };
export type { Bill, MonthData, Payment, NewPayment, NewBill, SyncDeletion, SyncPackage, Label } from './db/types';
export {
  getWeekdayDatesInMonth,
  prevMonth,
  getMonthLabel,
  getCurrentMonth,
  monthFromDate,
  getAdjacentMonths,
  getBillDay,
  adjustWeeklyAmount,
  billsInMonth,
} from './db/utils';

const DATABASE_NAME = 'month2month.db';

let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;
let _testDb: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function setTestDatabase(db: any) {
  _testDb = db;
}

export function resetTestDatabase() {
  _testDb = null;
  dbInstance = null;
}

export const getDatabase = () => {
  if (_testDb) return _testDb;
  if (dbInstance) return dbInstance;
  const expoDb = openDatabaseSync(DATABASE_NAME, { enableChangeListener: true });

  expoDb.execSync(`
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      amount REAL NOT NULL,
      month TEXT NOT NULL,
      payDate INTEGER NOT NULL,
      frequency TEXT DEFAULT 'monthly',
      weekDay INTEGER,
      startDate TEXT,
      createdAt INTEGER,
      updatedAt INTEGER
    );
    CREATE TABLE IF NOT EXISTS bills (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      name TEXT NOT NULL,
      amount REAL NOT NULL,
      isRecurring INTEGER DEFAULT false,
      date TEXT,
      startMonth TEXT,
      endMonth TEXT,
      dueDay INTEGER,
      frequency TEXT DEFAULT 'monthly',
      weekDay INTEGER,
      category TEXT DEFAULT 'other',
      createdAt INTEGER,
      updatedAt INTEGER
    );
    CREATE TABLE IF NOT EXISTS sync_deletions (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      tableName TEXT NOT NULL,
      rowId INTEGER NOT NULL,
      deletedAt INTEGER
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS labels (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL
    );
  `);

  const pCols = expoDb.getAllSync('PRAGMA table_info(payments)') as { name: string }[];
  if (!pCols.find(c => c.name === 'frequency')) {
    expoDb.execSync("ALTER TABLE payments ADD COLUMN frequency TEXT DEFAULT 'monthly'");
    expoDb.execSync('ALTER TABLE payments ADD COLUMN weekDay INTEGER');
    expoDb.execSync('ALTER TABLE payments ADD COLUMN startDate TEXT');
  }
  const bCols = expoDb.getAllSync('PRAGMA table_info(bills)') as { name: string }[];
  if (!bCols.find(c => c.name === 'frequency')) {
    expoDb.execSync("ALTER TABLE bills ADD COLUMN frequency TEXT DEFAULT 'monthly'");
    expoDb.execSync('ALTER TABLE bills ADD COLUMN weekDay INTEGER');
  }
  if (!bCols.find(c => c.name === 'overrideMonth')) {
    expoDb.execSync('ALTER TABLE bills ADD COLUMN overrideMonth TEXT');
  }
  if (!bCols.find(c => c.name === 'type')) {
    expoDb.execSync("ALTER TABLE bills ADD COLUMN type TEXT DEFAULT 'expense'");
  }
  if (!bCols.find(c => c.name === 'updatedAt')) {
    expoDb.execSync('ALTER TABLE bills ADD COLUMN updatedAt INTEGER');
    expoDb.execSync('ALTER TABLE payments ADD COLUMN updatedAt INTEGER');
  }
  if (!bCols.find(c => c.name === 'labelId')) {
    expoDb.execSync('ALTER TABLE bills ADD COLUMN labelId INTEGER');
  }

  // Set updatedAt = createdAt for existing rows where updatedAt is null
  expoDb.execSync('UPDATE bills SET updatedAt = COALESCE(updatedAt, createdAt)');
  expoDb.execSync('UPDATE payments SET updatedAt = COALESCE(updatedAt, createdAt)');

  // Prune tombstones older than 90 days — only needed for incremental sync range
  expoDb.execSync("DELETE FROM sync_deletions WHERE deletedAt < (strftime('%s', 'now') - 7776000) * 1000");

  // Seed default labels
  const labelCount = (expoDb.getAllSync('SELECT COUNT(*) as c FROM labels') as { c: number }[])[0].c;
  if (labelCount === 0) {
    expoDb.execSync(
      "INSERT INTO labels (name, color) VALUES " +
      "('Bills', '#ef4444'), ('Subscription', '#f59e0b'), ('Food', '#22c55e'), " +
      "('Transport', '#3b82f6'), ('Shopping', '#a855f7'), ('Other', '#6b7280')"
    );
    // Migrate existing category values to labelId
    expoDb.execSync(
      "UPDATE bills SET labelId = (SELECT id FROM labels WHERE LOWER(labels.name) = LOWER(bills.category)) WHERE labelId IS NULL AND category IS NOT NULL"
    );
  }

  dbInstance = drizzle(expoDb, { schema });
  return dbInstance;
};

export async function getPayForMonth(month: string): Promise<{ amount: number; payDate: number; frequency: string; weekDay: number | null; startDate: string | null }> {
  const db = getDatabase();
  const rows = await db
    .select()
    .from(schema.payments)
    .where(lte(schema.payments.month, month))
    .orderBy(desc(schema.payments.month))
    .limit(1);
  if (rows.length > 0) {
    const row = rows[0];
    if (row.frequency === 'weekly' && row.weekDay != null) {
      const dates = getWeekdayDatesInMonth(month, row.weekDay).filter(d => {
        if (row.startDate) {
          return new Date(parseInt(month.split('-')[0]), parseInt(month.split('-')[1]) - 1, d) >= new Date(row.startDate + 'T00:00:00');
        }
        return true;
      });
      const totalPay = row.amount * dates.length;
      const lastPayDay = dates.length > 0 ? dates[dates.length - 1] : 28;
      return { amount: totalPay, payDate: lastPayDay, frequency: 'weekly', weekDay: row.weekDay, startDate: row.startDate };
    }
    return { amount: row.amount, payDate: row.payDate, frequency: 'monthly', weekDay: null, startDate: null };
  }
  return { amount: 0, payDate: 1, frequency: 'monthly', weekDay: null, startDate: null };
}

export async function getMonthData(month: string): Promise<MonthData> {
  const db = getDatabase();
  const allBills: Bill[] = await db.select().from(schema.bills);

  const payInfo = await getPayForMonth(month);
  const prevPayInfo = await getPayForMonth(prevMonth(month));
  const { amount: pay, payDate, frequency: payFreq, weekDay: payWeekDay, startDate: payStartDate } = payInfo;
  const prevPayDate = prevPayInfo.payDate;

  // Split bills by type
  const expenses = allBills.filter(b => (b.type || 'expense') === 'expense');
  const incomes = allBills.filter(b => b.type === 'income');

  const thisMonthExpenses = billsInMonth(expenses, month);
  const prevMonthExpenses = billsInMonth(expenses, prevMonth(month));
  const thisMonthIncomes = billsInMonth(incomes, month);

  // Override handling for expenses
  const expenseOverrideToThis = expenses.filter(b => b.overrideMonth === month);
  const expenseOverrideIds = new Set(expenseOverrideToThis.map(b => b.id));
  const expenseOverriddenElsewhere = new Set(expenses.filter(b => b.overrideMonth && b.overrideMonth !== month).map(b => b.id));

  // Override handling for income
  const incomeOverrideToThis = incomes.filter(b => b.overrideMonth === month);
  const incomeOverrideIds = new Set(incomeOverrideToThis.map(b => b.id));
  const incomeOverriddenElsewhere = new Set(incomes.filter(b => b.overrideMonth && b.overrideMonth !== month).map(b => b.id));

  const bills: Bill[] = [];
  const calendarBills: Bill[] = [];
  const allThisMonth = [...thisMonthExpenses, ...thisMonthIncomes];

  for (const b of allThisMonth) {
    const adj = adjustWeeklyAmount(b, month);
    calendarBills.push(adj);
  }

  // Pre-pay expenses
  for (const b of thisMonthExpenses) {
    const adj = adjustWeeklyAmount(b, month);
    if (b.overrideMonth) {
      if (b.overrideMonth === month) bills.push(adj);
    } else if (!expenseOverriddenElsewhere.has(b.id)) {
      const day = getBillDay(b, month);
      if (day != null && day <= payDate) bills.push(adj);
    }
  }

  for (const b of expenseOverrideToThis) {
    if (!bills.some(bb => bb.id === b.id)) {
      bills.push(adjustWeeklyAmount(b, month));
    }
  }

  // Post-pay expenses from last month
  const postPayBills: Bill[] = [];
  for (const b of prevMonthExpenses) {
    if (expenseOverrideIds.has(b.id) || expenseOverriddenElsewhere.has(b.id)) continue;
    const day = getBillDay(b, prevMonth(month));
    const adj = adjustWeeklyAmount(b, prevMonth(month));
    if (day != null && day > prevPayDate) postPayBills.push(adj);
  }

  // Income entries (no pay-date split — all count toward this month)
  const income: Bill[] = [];
  for (const b of thisMonthIncomes) {
    const adj = adjustWeeklyAmount(b, month);
    if (b.overrideMonth) {
      if (b.overrideMonth === month) income.push(adj);
    } else if (!incomeOverriddenElsewhere.has(b.id)) {
      income.push(adj);
    }
  }

  for (const b of incomeOverrideToThis) {
    if (!income.some(bb => bb.id === b.id)) {
      income.push(adjustWeeklyAmount(b, month));
    }
  }

  const totalBills = [...bills, ...postPayBills].reduce((acc, b) => acc + b.amount, 0);
  const incomeSum = income.reduce((acc, b) => acc + b.amount, 0);
  const totalIncome = pay + incomeSum;

  let payDates: number[];
  if (payFreq === 'weekly' && payWeekDay != null) {
    payDates = getWeekdayDatesInMonth(month, payWeekDay);
    if (payStartDate) {
      const start = new Date(payStartDate + 'T00:00:00');
      payDates = payDates.filter(d =>
        new Date(parseInt(month.split('-')[0]), parseInt(month.split('-')[1]) - 1, d) >= start,
      );
    }
  } else {
    payDates = [payDate];
  }

  return {
    month,
    label: getMonthLabel(month),
    pay,
    payDate,
    payDates,
    bills,
    postPayBills,
    income,
    calendarBills,
    totalBills,
    totalIncome,
    remaining: totalIncome - totalBills,
  };
}

export async function hasOnboardingData(): Promise<boolean> {
  const db = getDatabase();
  const rows = await db.select().from(schema.payments).limit(1);
  return rows.length > 0;
}

export async function setPay(amount: number, month: string, payDate: number, frequency: string = 'monthly', weekDay?: number | null, startDate?: string | null) {
  const db = getDatabase();
  const now = new Date();
  const existing = await db.select().from(schema.payments).where(eq(schema.payments.month, month)).limit(1);
  if (existing.length > 0) {
    await db.update(schema.payments).set({ amount, payDate, frequency, weekDay, startDate, updatedAt: now }).where(eq(schema.payments.month, month));
  } else {
    await db.insert(schema.payments).values({ amount, month, payDate, frequency, weekDay, startDate, updatedAt: now, createdAt: now });
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
  frequency?: string,
  weekDay?: number | null,
  type?: string,
  endMonth?: string | null,
) {
  const db = getDatabase();
  await db.insert(schema.bills).values({
    name,
    amount,
    isRecurring,
    date: isRecurring ? null : (date || null),
    startMonth: isRecurring ? (startMonth || getCurrentMonth()) : null,
    endMonth: isRecurring ? (endMonth ?? null) : null,
    dueDay: isRecurring ? (dueDay || 1) : null,
    frequency: isRecurring ? (frequency || 'monthly') : null,
    weekDay: isRecurring ? (weekDay ?? null) : null,
    category: category || 'other',
    type: type || 'expense',
  });
}

export async function deleteBill(id: number) {
  const db = getDatabase();
  const bill = await db.select({ id: schema.bills.id }).from(schema.bills).where(eq(schema.bills.id, id)).limit(1);
  if (bill.length > 0) {
    await db.insert(schema.syncDeletions).values({ tableName: 'bills', rowId: bill[0].id });
  }
  await db.delete(schema.bills).where(eq(schema.bills.id, id));
}

export async function getBill(id: number): Promise<Bill | undefined> {
  const db = getDatabase();
  const rows = await db.select().from(schema.bills).where(eq(schema.bills.id, id)).limit(1);
  return rows[0];
}

export async function updateBill(
  id: number,
  name: string,
  amount: number,
  isRecurring: boolean,
  date?: string,
  startMonth?: string,
  dueDay?: number,
  category?: string,
  frequency?: string,
  weekDay?: number | null,
  overrideMonth?: string | null,
  type?: string,
  endMonth?: string | null,
) {
  const db = getDatabase();
  await db.update(schema.bills).set({
    name,
    amount,
    isRecurring,
    date: isRecurring ? null : (date || null),
    startMonth: isRecurring ? (startMonth || getCurrentMonth()) : null,
    endMonth: isRecurring ? (endMonth ?? null) : null,
    dueDay: isRecurring ? (dueDay || 1) : null,
    frequency: isRecurring ? (frequency || 'monthly') : null,
    weekDay: isRecurring ? (weekDay ?? null) : null,
    category: category || 'other',
    overrideMonth: overrideMonth ?? null,
    type: type || 'expense',
    updatedAt: new Date(),
  }).where(eq(schema.bills.id, id));
}

export async function getPay(month: string): Promise<number> {
  const { amount } = await getPayForMonth(month);
  return amount;
}

export async function getSetting(key: string, defaultValue?: string): Promise<string | null> {
  const db = getDatabase();
  const rows = await db.select().from(schema.settings).where(eq(schema.settings.key, key)).limit(1);
  if (rows.length > 0) return rows[0].value;
  return defaultValue ?? null;
}

export async function setSetting(key: string, value: string) {
  const db = getDatabase();
  const existing = await db.select().from(schema.settings).where(eq(schema.settings.key, key)).limit(1);
  if (existing.length > 0) {
    await db.update(schema.settings).set({ value }).where(eq(schema.settings.key, key));
  } else {
    await db.insert(schema.settings).values({ key, value });
  }
}

export async function getAllSettings(): Promise<Record<string, string>> {
  const db = getDatabase();
  const rows = await db.select().from(schema.settings);
  const map: Record<string, string> = {};
  rows.forEach(r => { map[r.key] = r.value; });
  return map;
}

export async function resetAllData() {
  const db = getDatabase();
  await db.delete(schema.bills);
  await db.delete(schema.payments);
  await db.delete(schema.settings);
  await db.delete(schema.syncDeletions);
  await db.delete(schema.labels);
}

export async function getLabels(): Promise<Label[]> {
  const db = getDatabase();
  return db.select().from(schema.labels).orderBy(schema.labels.name);
}

export async function getLabel(id: number): Promise<Label | undefined> {
  const db = getDatabase();
  const rows = await db.select().from(schema.labels).where(eq(schema.labels.id, id)).limit(1);
  return rows[0];
}

export async function getOrCreateLabel(name: string, color: string): Promise<Label> {
  const db = getDatabase();
  const trimmed = name.trim();
  if (!trimmed) {
    const rows = await db.select().from(schema.labels).where(eq(schema.labels.name, 'Other')).limit(1);
    return rows[0];
  }
  const titleCased = trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
  const existing = await db.select().from(schema.labels).where(sql`LOWER(name) = ${trimmed.toLowerCase()}`).limit(1);
  if (existing.length > 0) return existing[0];
  await db.insert(schema.labels).values({ name: titleCased, color });
  const created = await db.select().from(schema.labels).where(eq(schema.labels.name, titleCased)).limit(1);
  return created[0];
}

export async function hasAnyData(): Promise<boolean> {
  const db = getDatabase();
  const b = await db.select({ id: schema.bills.id }).from(schema.bills).limit(1);
  if (b.length > 0) return true;
  const p = await db.select({ id: schema.payments.id }).from(schema.payments).limit(1);
  if (p.length > 0) return true;
  return false;
}
