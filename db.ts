import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import type { Bill, MonthData, Label, ColumnInfo, SettingRow, Holiday } from './db/types';
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
import { buildBillValues } from './db/constants';
import { previousBusinessDay, type CustomHolidays } from './utils/businessDays';

export type { Bill, MonthData, Payment, SyncDeletion, SyncPackage, Holiday, Label } from './db/types';
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

let dbInstance: SQLiteDatabase | null = null;
let dbInitPromise: Promise<SQLiteDatabase> | null = null;
let _testDb: any = null;

export function setTestDatabase(db: any) {
  _testDb = db;
}

export function resetTestDatabase() {
  _testDb = null;
  dbInstance = null;
}

export const getDatabase = async () => {
  if (_testDb) return _testDb;
  if (dbInstance) return dbInstance;

  if (!dbInitPromise) {
    dbInitPromise = (async () => {
      let expoDb: SQLiteDatabase;
      for (let attempt = 0; ; attempt++) {
        try {
          expoDb = await openDatabaseAsync(DATABASE_NAME);
          break;
        } catch (e) {
          if (attempt < 4 && e instanceof Error && e.message.includes('createSyncAccessHandle')) {
            await new Promise(r => setTimeout(r, 500));
            continue;
          }
          throw e;
        }
      }

      await expoDb.execAsync(`
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
        CREATE TABLE IF NOT EXISTS holidays (
          id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
          date TEXT NOT NULL,
          name TEXT DEFAULT '',
          recurring INTEGER DEFAULT true,
          affectsPay INTEGER DEFAULT true
        );
      `);

      const pCols = await expoDb.getAllAsync('PRAGMA table_info(payments)') as ColumnInfo[];
      if (!pCols.find(c => c.name === 'frequency')) {
        await expoDb.execAsync("ALTER TABLE payments ADD COLUMN frequency TEXT DEFAULT 'monthly'");
        await expoDb.execAsync('ALTER TABLE payments ADD COLUMN weekDay INTEGER');
        await expoDb.execAsync('ALTER TABLE payments ADD COLUMN startDate TEXT');
      }
      const bCols = await expoDb.getAllAsync('PRAGMA table_info(bills)') as ColumnInfo[];
      if (!bCols.find(c => c.name === 'frequency')) {
        await expoDb.execAsync("ALTER TABLE bills ADD COLUMN frequency TEXT DEFAULT 'monthly'");
        await expoDb.execAsync('ALTER TABLE bills ADD COLUMN weekDay INTEGER');
      }
      if (!bCols.find(c => c.name === 'overrideMonth')) {
        await expoDb.execAsync('ALTER TABLE bills ADD COLUMN overrideMonth TEXT');
      }
      if (!bCols.find(c => c.name === 'type')) {
        await expoDb.execAsync("ALTER TABLE bills ADD COLUMN type TEXT DEFAULT 'expense'");
      }
      if (!bCols.find(c => c.name === 'updatedAt')) {
        await expoDb.execAsync('ALTER TABLE bills ADD COLUMN updatedAt INTEGER');
        await expoDb.execAsync('ALTER TABLE payments ADD COLUMN updatedAt INTEGER');
      }
      if (!bCols.find(c => c.name === 'labelId')) {
        await expoDb.execAsync('ALTER TABLE bills ADD COLUMN labelId INTEGER');
      }
      if (!bCols.find(c => c.name === 'adjustment')) {
        await expoDb.execAsync("ALTER TABLE bills ADD COLUMN adjustment INTEGER DEFAULT false");
        await expoDb.execAsync("ALTER TABLE payments ADD COLUMN adjustment INTEGER DEFAULT false");
      }

      await expoDb.execAsync('UPDATE bills SET updatedAt = COALESCE(updatedAt, createdAt)');
      await expoDb.execAsync('UPDATE payments SET updatedAt = COALESCE(updatedAt, createdAt)');

      await expoDb.execAsync("DELETE FROM sync_deletions WHERE deletedAt < (strftime('%s', 'now') - 7776000) * 1000");

      const labelCount = (await expoDb.getAllAsync('SELECT COUNT(*) as c FROM labels') as { c: number }[])[0].c;
      if (labelCount === 0) {
        await expoDb.execAsync(
          "INSERT INTO labels (name, color) VALUES " +
          "('Bills', '#ef4444'), ('Subscription', '#f59e0b'), ('Food', '#22c55e'), " +
          "('Transport', '#3b82f6'), ('Shopping', '#a855f7'), ('Other', '#6b7280')"
        );
        await expoDb.execAsync(
          "UPDATE bills SET labelId = (SELECT id FROM labels WHERE LOWER(labels.name) = LOWER(bills.category)) WHERE labelId IS NULL AND category IS NOT NULL"
        );
      }

      dbInstance = expoDb;
      return dbInstance;
    })().catch(e => {
      dbInitPromise = null;
      throw e;
    });
  }

  return dbInitPromise;
};

export async function getPayForMonth(month: string): Promise<{ amount: number; payDate: number; frequency: string; weekDay: number | null; startDate: string | null; adjustment: boolean }> {
  const db = await getDatabase();
  const rows = await db.getAllAsync(
    'SELECT * FROM payments WHERE month <= ? ORDER BY month DESC LIMIT 1',
    [month],
  );
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
      return { amount: totalPay, payDate: lastPayDay, frequency: 'weekly', weekDay: row.weekDay, startDate: row.startDate, adjustment: !!row.adjustment };
    }
    let payDate = row.payDate;
    if (payDate === 0) {
      const [y, m] = month.split('-').map(Number);
      payDate = new Date(y, m, 0).getDate();
    }
    return { amount: row.amount, payDate, frequency: 'monthly', weekDay: null, startDate: null, adjustment: !!row.adjustment };
  }
  return { amount: 0, payDate: 1, frequency: 'monthly', weekDay: null, startDate: null, adjustment: false };
}

export async function getMonthData(month: string): Promise<MonthData> {
  const db = await getDatabase();
  const allBills = await db.getAllAsync('SELECT * FROM bills') as Bill[];

  const payInfo = await getPayForMonth(month);
  const prevPayInfo = await getPayForMonth(prevMonth(month));
  const { amount: pay, payDate, frequency: payFreq, weekDay: payWeekDay, startDate: payStartDate, adjustment: payAdjustment } = payInfo;
  const customHolidays = await getCustomHolidaySet();

  const expenses = allBills.filter(b => (b.type || 'expense') === 'expense');
  const incomes = allBills.filter(b => b.type === 'income');

  const thisMonthExpenses = billsInMonth(expenses, month);
  const prevMonthExpenses = billsInMonth(expenses, prevMonth(month));
  const thisMonthIncomes = billsInMonth(incomes, month);

  const expenseOverrideToThis = expenses.filter(b => b.overrideMonth === month);
  const expenseOverrideIds = new Set(expenseOverrideToThis.map(b => b.id));
  const expenseOverriddenElsewhere = new Set(expenses.filter(b => b.overrideMonth && b.overrideMonth !== month).map(b => b.id));

  const incomeOverrideToThis = incomes.filter(b => b.overrideMonth === month);
  const incomeOverrideIds = new Set(incomeOverrideToThis.map(b => b.id));
  const incomeOverriddenElsewhere = new Set(incomes.filter(b => b.overrideMonth && b.overrideMonth !== month).map(b => b.id));

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

  if (payAdjustment) {
    const [y, m] = month.split('-').map(Number);
    payDates = payDates.map(d => {
      const date = new Date(y, m - 1, d);
      const adjusted = previousBusinessDay(date, customHolidays);
      return adjusted.getDate();
    });
  }

  const adjustedPayDate = payAdjustment && payDates.length > 0 ? payDates[0] : payDate;

  const bills: Bill[] = [];
  const calendarBills: Bill[] = [];
  const allThisMonth = [...thisMonthExpenses, ...thisMonthIncomes];

  for (const b of allThisMonth) {
    const adj = adjustWeeklyAmount(b, month);
    calendarBills.push(adj);
  }

  for (const b of thisMonthExpenses) {
    const adj = adjustWeeklyAmount(b, month);
    if (b.overrideMonth) {
      if (b.overrideMonth === month) bills.push(adj);
    } else if (!expenseOverriddenElsewhere.has(b.id)) {
      const day = getBillDay(b, month, customHolidays);
      if (day != null && day <= payDate) bills.push(adj);
    }
  }

  for (const b of expenseOverrideToThis) {
    if (!bills.some(bb => bb.id === b.id)) {
      bills.push(adjustWeeklyAmount(b, month));
    }
  }

  const postPayBills: Bill[] = [];
  for (const b of prevMonthExpenses) {
    if (expenseOverrideIds.has(b.id) || expenseOverriddenElsewhere.has(b.id)) continue;
    const day = getBillDay(b, prevMonth(month), customHolidays);
    const adj = adjustWeeklyAmount(b, prevMonth(month));
    if (day != null && day > prevPayInfo.payDate) postPayBills.push(adj);
  }

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

  return {
    month,
    label: getMonthLabel(month),
    pay,
    payDate,
    adjustedPayDate,
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
  const db = await getDatabase();
  const rows = await db.getAllAsync('SELECT 1 FROM payments LIMIT 1');
  return rows.length > 0;
}

export async function setPay(amount: number, month: string, payDate: number, frequency: string = 'monthly', weekDay?: number | null, startDate?: string | null, adjustment?: boolean) {
  const db = await getDatabase();
  const now = Date.now();
  const adj = adjustment ? 1 : 0;
  const existing = await db.getAllAsync('SELECT 1 FROM payments WHERE month = ? LIMIT 1', [month]);
  if (existing.length > 0) {
    await db.runAsync(
      'UPDATE payments SET amount = ?, payDate = ?, frequency = ?, weekDay = ?, startDate = ?, adjustment = ?, updatedAt = ? WHERE month = ?',
      [amount, payDate, frequency, weekDay, startDate, adj, now, month],
    );
  } else {
    await db.runAsync(
      'INSERT INTO payments (amount, month, payDate, frequency, weekDay, startDate, adjustment, updatedAt, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [amount, month, payDate, frequency, weekDay, startDate, adj, now, now],
    );
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
  adjustment?: boolean,
) {
  const db = await getDatabase();
  const now = Date.now();
  const v = buildBillValues({ name, amount, isRecurring, date, startMonth, endMonth, dueDay, category, frequency, weekDay, type, adjustment });
  await db.runAsync(
    `INSERT INTO bills (name, amount, isRecurring, date, startMonth, endMonth, dueDay, frequency, weekDay, category, type, adjustment, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [v.name, v.amount, v.isRecurring, v.date, v.startMonth, v.endMonth, v.dueDay, v.frequency, v.weekDay, v.category, v.type, v.adjustment, now, now],
  );
}

export async function deleteBill(id: number) {
  const db = await getDatabase();
  const bill = await db.getAllAsync('SELECT id FROM bills WHERE id = ? LIMIT 1', [id]);
  if (bill.length > 0) {
    await db.runAsync('INSERT INTO sync_deletions (tableName, rowId) VALUES (?, ?)', ['bills', id]);
  }
  await db.runAsync('DELETE FROM bills WHERE id = ?', [id]);
}

export async function getBill(id: number): Promise<Bill | undefined> {
  const db = await getDatabase();
  const rows = await db.getAllAsync('SELECT * FROM bills WHERE id = ? LIMIT 1', [id]);
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
  adjustment?: boolean,
) {
  const db = await getDatabase();
  const v = buildBillValues({ name, amount, isRecurring, date, startMonth, endMonth, dueDay, category, frequency, weekDay, type, adjustment });
  await db.runAsync(
    `UPDATE bills SET name = ?, amount = ?, isRecurring = ?, date = ?, startMonth = ?, endMonth = ?, dueDay = ?,
     frequency = ?, weekDay = ?, category = ?, overrideMonth = ?, type = ?, adjustment = ?, updatedAt = ? WHERE id = ?`,
    [v.name, v.amount, v.isRecurring, v.date, v.startMonth, v.endMonth, v.dueDay, v.frequency, v.weekDay, v.category, overrideMonth ?? null, v.type, v.adjustment, Date.now(), id],
  );
}

export async function getSetting(key: string, defaultValue?: string): Promise<string | null> {
  const db = await getDatabase();
  const rows = await db.getAllAsync('SELECT value FROM settings WHERE key = ? LIMIT 1', [key]) as { value: string }[];
  if (rows.length > 0) return rows[0].value;
  return defaultValue ?? null;
}

export async function setSetting(key: string, value: string) {
  const db = await getDatabase();
  await db.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?',
    [key, value, value],
  );
}

export async function getAllSettings(): Promise<Record<string, string>> {
  const db = await getDatabase();
  const rows = await db.getAllAsync('SELECT key, value FROM settings') as SettingRow[];
  const map: Record<string, string> = {};
  rows.forEach(r => { map[r.key] = r.value; });
  return map;
}

export async function resetAllData() {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM bills');
  await db.runAsync('DELETE FROM payments');
  await db.runAsync('DELETE FROM settings');
  await db.runAsync('DELETE FROM sync_deletions');
  await db.runAsync('DELETE FROM labels');
  await db.runAsync('DELETE FROM holidays');
  await db.closeAsync();
  dbInstance = null;
}

export async function getLabels(): Promise<Label[]> {
  const db = await getDatabase();
  return db.getAllAsync('SELECT * FROM labels ORDER BY name') as Promise<Label[]>;
}

export async function getLabel(id: number): Promise<Label | undefined> {
  const db = await getDatabase();
  const rows = await db.getAllAsync('SELECT * FROM labels WHERE id = ? LIMIT 1', [id]) as Label[];
  return rows[0];
}

export async function getCustomHolidaySet(): Promise<CustomHolidays> {
  const db = await getDatabase();
  const rows = await db.getAllAsync(
    'SELECT date, recurring, affectsPay FROM holidays',
  ) as { date: string; recurring: number; affectsPay: number }[];
  const dates = new Set<string>();
  const recurringMMDD = new Set<string>();
  for (const row of rows) {
    if (!row.affectsPay) continue;
    if (row.recurring) {
      recurringMMDD.add(row.date.slice(5));
    } else {
      dates.add(row.date);
    }
  }
  return { dates, recurringMMDD };
}

export async function getHolidays(): Promise<Holiday[]> {
  const db = await getDatabase();
  return db.getAllAsync('SELECT * FROM holidays ORDER BY date') as Promise<Holiday[]>;
}

export async function addHoliday(date: string, name: string, recurring: boolean, affectsPay: boolean): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync(
    'INSERT INTO holidays (date, name, recurring, affectsPay) VALUES (?, ?, ?, ?)',
    [date, name, recurring ? 1 : 0, affectsPay ? 1 : 0],
  );
  return result.lastInsertRowId;
}

export async function updateHoliday(id: number, date: string, name: string, recurring: boolean, affectsPay: boolean) {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE holidays SET date = ?, name = ?, recurring = ?, affectsPay = ? WHERE id = ?',
    [date, name, recurring ? 1 : 0, affectsPay ? 1 : 0, id],
  );
}

export async function removeHoliday(id: number) {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM holidays WHERE id = ?', [id]);
}

export async function getOrCreateLabel(name: string, color: string): Promise<Label> {
  const db = await getDatabase();
  const trimmed = name.trim();
  if (!trimmed) {
    const rows = await db.getAllAsync('SELECT * FROM labels WHERE name = ? LIMIT 1', ['Other']) as Label[];
    return rows[0];
  }
  const titleCased = trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
  const existing = await db.getAllAsync('SELECT * FROM labels WHERE LOWER(name) = ? LIMIT 1', [trimmed.toLowerCase()]) as Label[];
  if (existing.length > 0) return existing[0];
  const result = await db.runAsync('INSERT INTO labels (name, color) VALUES (?, ?)', [titleCased, color]);
  const created = await db.getAllAsync('SELECT * FROM labels WHERE id = ? LIMIT 1', [result.lastInsertRowId]) as Label[];
  return created[0];
}


