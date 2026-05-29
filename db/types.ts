import * as schema from './schema';

export type Payment = typeof schema.payments.$inferSelect;
export type NewPayment = typeof schema.payments.$inferInsert;
export type Bill = typeof schema.bills.$inferSelect;
export type NewBill = typeof schema.bills.$inferInsert;

export type MonthData = {
  month: string;
  label: string;
  pay: number;
  payDate: number;
  bills: Bill[];
  totalBills: number;
  remaining: number;
};
