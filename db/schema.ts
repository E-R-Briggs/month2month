import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const payments = sqliteTable('payments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  amount: real('amount').notNull(),
  month: text('month').notNull(),
  payDate: integer('payDate').notNull(),
  frequency: text('frequency').default('monthly'),
  weekDay: integer('weekDay'),
  startDate: text('startDate'),
  createdAt: integer('createdAt', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }).$defaultFn(() => new Date()),
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
  frequency: text('frequency').default('monthly'),
  weekDay: integer('weekDay'),
  category: text('category').default('other'),
  labelId: integer('labelId'),
  overrideMonth: text('overrideMonth'),
  type: text('type').default('expense'),
  createdAt: integer('createdAt', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const syncDeletions = sqliteTable('sync_deletions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tableName: text('tableName').notNull(),
  rowId: integer('rowId').notNull(),
  deletedAt: integer('deletedAt', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export const labels = sqliteTable('labels', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  color: text('color').notNull(),
});
