import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const payments = sqliteTable('payments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  amount: real('amount').notNull(),
  month: text('month').notNull(),
  payDate: integer('payDate').notNull(),
  createdAt: integer('createdAt', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const bills = sqliteTable('bills', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  amount: real('amount').notNull(),
  isRecurring: integer('isRecurring', { mode: 'boolean' }).default(false),
  date: text('date'),
  startMonth: text('startMonth'),
  endMonth: text('endMonth'),
  dueDay: integer('dueDay'),
  category: text('category').default('other'),
  createdAt: integer('createdAt', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});
