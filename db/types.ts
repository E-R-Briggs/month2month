import * as schema from './schema';

export type Payment = typeof schema.payments.$inferSelect;
export type NewPayment = typeof schema.payments.$inferInsert;
export type Bill = typeof schema.bills.$inferSelect;
export type NewBill = typeof schema.bills.$inferInsert;
export type SyncDeletion = typeof schema.syncDeletions.$inferSelect;
export type Label = typeof schema.labels.$inferSelect;

export type MonthData = {
  month: string;
  label: string;
  pay: number;
  payDate: number;
  payDates: number[];
  bills: Bill[];
  postPayBills: Bill[];
  income: Bill[];
  calendarBills: Bill[];
  totalBills: number;
  totalIncome: number;
  remaining: number;
};

export type SyncPackage = {
  exportedAt: number;
  lastSyncTimestamp: number | null;
  bills: Bill[];
  payments: Payment[];
  settings: { key: string; value: string }[];
  deletedBillIds: number[];
  deletedPaymentIds: number[];
};
