import { setupTestDb, teardownTestDb } from './helpers/setup';
import {
  addBill,
  getBill,
  updateBill,
  deleteBill,
  setPay,
  getPay,
  getMonthData,
  getPayForMonth,
} from '../db';

beforeEach(() => {
  setupTestDb();
});

afterEach(() => {
  teardownTestDb();
});

describe('addBill / getBill / updateBill / deleteBill', () => {
  it('creates and retrieves an expense bill', async () => {
    await addBill('Rent', 800, true, undefined, '2026-04', 1, 'bills');
    const data = await getMonthData('2026-04');
    expect(data.bills).toHaveLength(1);
    expect(data.bills[0].name).toBe('Rent');
    expect(data.bills[0].amount).toBe(800);
  });

  it('creates and retrieves an income entry', async () => {
    await addBill('Freelance', 500, false, '2026-04-15', undefined, undefined, 'other', undefined, undefined, 'income');
    const data = await getMonthData('2026-04');
    expect(data.income).toHaveLength(1);
    expect(data.income[0].name).toBe('Freelance');
    expect(data.income[0].amount).toBe(500);
    expect(data.income[0].type).toBe('income');
  });

  it('updates a bill', async () => {
    await addBill('Netflix', 12.99, true, undefined, '2026-04', 1, 'subscription');
    const data = await getMonthData('2026-04');
    const id = data.bills[0].id;
    await updateBill(id, 'Netflix Premium', 19.99, true, undefined, '2026-04', 1, 'subscription');
    const updated = await getBill(id);
    expect(updated!.name).toBe('Netflix Premium');
    expect(updated!.amount).toBe(19.99);
  });

  it('deletes a bill', async () => {
    await addBill('Delete me', 100, false, '2026-04-01');
    const data = await getMonthData('2026-04');
    expect(data.bills).toHaveLength(1);
    await deleteBill(data.bills[0].id);
    const data2 = await getMonthData('2026-04');
    expect(data2.bills).toHaveLength(0);
  });

  it('round-trips type field', async () => {
    await addBill('Gift', 50, false, '2026-04-10', undefined, undefined, 'other', undefined, undefined, 'income');
    const data = await getMonthData('2026-04');
    expect(data.income[0].type).toBe('income');
  });
});

describe('setPay / getPay', () => {
  it('sets and retrieves monthly pay', async () => {
    await setPay(2000, '2026-04', 15);
    const pay = await getPay('2026-04');
    expect(pay).toBe(2000);
  });

  it('carries pay forward to months without pay set', async () => {
    await setPay(2000, '2026-04', 15);
    const mayPay = await getPay('2026-05');
    expect(mayPay).toBe(2000);
  });

  it('overrides pay in a later month', async () => {
    await setPay(2000, '2026-04', 15);
    await setPay(2500, '2026-06', 20);
    expect(await getPay('2026-05')).toBe(2000);
    expect(await getPay('2026-06')).toBe(2500);
    expect(await getPay('2026-07')).toBe(2500);
  });

  it('sets and retrieves weekly pay', async () => {
    await setPay(500, '2026-04', 1, 'weekly', 5, '2026-04-01');
    const payInfo = await getPayForMonth('2026-04');
    // April 2026 has 4 Fridays (3, 10, 17, 24)
    expect(payInfo.amount).toBe(2000); // 500 * 4
    expect(payInfo.payDate).toBe(24); // last pay day
  });
});

describe('getMonthData — expense splitting', () => {
  beforeEach(async () => {
    await setPay(2000, '2026-04', 15);
  });

  it('includes bills due on or before pay date as pre-pay bills', async () => {
    await addBill('Rent', 800, true, undefined, '2026-04', 15, 'bills'); // on pay day
    await addBill('Netflix', 15, true, undefined, '2026-04', 10, 'subscription'); // before pay day
    const data = await getMonthData('2026-04');
    expect(data.bills).toHaveLength(2);
  });

  it('excludes bills due after pay date from pre-pay', async () => {
    await addBill('Late bill', 100, true, undefined, '2026-04', 25, 'bills'); // after pay day
    const data = await getMonthData('2026-04');
    expect(data.bills).toHaveLength(0);
  });

  it('carries post-pay bills to next month', async () => {
    await addBill('Late bill', 100, true, undefined, '2026-04', 25, 'bills');
    await setPay(2000, '2026-05', 10);
    const mayData = await getMonthData('2026-05');
    expect(mayData.postPayBills).toHaveLength(1);
    expect(mayData.postPayBills[0].name).toBe('Late bill');
  });

  it('does not include pre-pay bills from last month in post-pay', async () => {
    await addBill('Early bill', 100, true, undefined, '2026-04', 5, 'bills'); // before pay day
    await setPay(2000, '2026-05', 10);
    const mayData = await getMonthData('2026-05');
    expect(mayData.postPayBills).toHaveLength(0);
  });
});

describe('getMonthData — income', () => {
  beforeEach(async () => {
    await setPay(2000, '2026-04', 15);
  });

  it('includes income entries in income array', async () => {
    await addBill('Freelance', 500, false, '2026-04-10', undefined, undefined, 'other', undefined, undefined, 'income');
    const data = await getMonthData('2026-04');
    expect(data.income).toHaveLength(1);
    expect(data.income[0].amount).toBe(500);
  });

  it('does not count income in bills or postPayBills', async () => {
    await addBill('Freelance', 500, false, '2026-04-10', undefined, undefined, 'other', undefined, undefined, 'income');
    const data = await getMonthData('2026-04');
    expect(data.bills).toHaveLength(0);
    expect(data.postPayBills).toHaveLength(0);
  });

  it('calculates totalIncome as pay + income sum', async () => {
    await addBill('Freelance', 300, false, '2026-04-10', undefined, undefined, 'other', undefined, undefined, 'income');
    await addBill('Side gig', 200, false, '2026-04-20', undefined, undefined, 'other', undefined, undefined, 'income');
    const data = await getMonthData('2026-04');
    expect(data.totalIncome).toBe(2500); // 2000 + 300 + 200
  });

  it('calculates remaining as totalIncome - totalBills', async () => {
    await addBill('Rent', 800, true, undefined, '2026-04', 10, 'bills');
    await addBill('Freelance', 500, false, '2026-04-15', undefined, undefined, 'other', undefined, undefined, 'income');
    const data = await getMonthData('2026-04');
    expect(data.totalIncome).toBe(2500);
    expect(data.totalBills).toBe(800);
    expect(data.remaining).toBe(1700);
  });

  it('shows recurring income entries', async () => {
    await addBill('Teaching', 50, true, undefined, '2026-04', 1, 'other', 'weekly', 1, 'income');
    const data = await getMonthData('2026-04');
    // 4 Mondays * £50 = £200
    expect(data.income).toHaveLength(1);
    expect(data.income[0].amount).toBe(200);
  });
});

describe('getMonthData — override month', () => {
  beforeEach(async () => {
    await setPay(2000, '2026-04', 15);
    await setPay(2000, '2026-05', 15);
  });

  it('expense with overrideMonth counts toward that month', async () => {
    await addBill('Holiday', 500, false, '2026-05-10', undefined, undefined, 'bills', undefined, undefined, 'expense');
    // Now update to override to April
    const mayData = await getMonthData('2026-05');
    const bill = mayData.calendarBills.find(b => b.name === 'Holiday')!;
    await updateBill(bill.id, 'Holiday', 500, false, '2026-05-10', undefined, undefined, 'bills', undefined, undefined, '2026-04');

    const aprData = await getMonthData('2026-04');
    expect(aprData.bills.find(b => b.name === 'Holiday')).toBeDefined();
    expect(aprData.totalBills).toBe(500);
  });

  it('income with overrideMonth counts toward that month', async () => {
    await addBill('Bonus', 1000, false, '2026-05-01', undefined, undefined, 'other', undefined, undefined, 'income');
    const mayData = await getMonthData('2026-05');
    const bill = mayData.calendarBills.find(b => b.name === 'Bonus')!;
    await updateBill(bill.id, 'Bonus', 1000, false, '2026-05-01', undefined, undefined, 'other', undefined, undefined, '2026-04', 'income');

    const aprData = await getMonthData('2026-04');
    expect(aprData.income.find(b => b.name === 'Bonus')).toBeDefined();
    expect(aprData.totalIncome).toBe(3000); // 2000 + 1000
  });

  it('overridden bills do not appear in their original month', async () => {
    await addBill('Holiday', 500, false, '2026-05-10', undefined, undefined, 'bills', undefined, undefined, 'expense');
    const mayData = await getMonthData('2026-05');
    const bill = mayData.calendarBills.find(b => b.name === 'Holiday')!;
    await updateBill(bill.id, 'Holiday', 500, false, '2026-05-10', undefined, undefined, 'bills', undefined, undefined, '2026-04');

    const mayData2 = await getMonthData('2026-05');
    expect(mayData2.bills.find(b => b.name === 'Holiday')).toBeUndefined();
    expect(mayData2.postPayBills.find(b => b.name === 'Holiday')).toBeUndefined();
  });
});

describe('getMonthData — negative remaining', () => {
  it('shows negative remaining when expenses exceed pay + income', async () => {
    await setPay(1000, '2026-04', 15);
    await addBill('Rent', 1200, true, undefined, '2026-04', 10, 'bills');
    const data = await getMonthData('2026-04');
    expect(data.remaining).toBe(-200);
  });

  it('shows negative remaining with income that still leaves a shortfall', async () => {
    await setPay(1000, '2026-04', 15);
    await addBill('Rent', 1400, true, undefined, '2026-04', 10, 'bills');
    await addBill('Freelance', 200, false, '2026-04-05', undefined, undefined, 'other', undefined, undefined, 'income');
    const data = await getMonthData('2026-04');
    expect(data.totalIncome).toBe(1200);
    expect(data.remaining).toBe(-200);
  });
});

describe('getMonthData — calendar bills', () => {
  beforeEach(async () => {
    await setPay(2000, '2026-04', 15);
  });

  it('includes both expense and income in calendarBills', async () => {
    await addBill('Rent', 800, true, undefined, '2026-04', 10, 'bills');
    await addBill('Freelance', 500, false, '2026-04-20', undefined, undefined, 'other', undefined, undefined, 'income');
    const data = await getMonthData('2026-04');
    expect(data.calendarBills).toHaveLength(2);
  });
});
