export interface Payment {
  id: number;
  amount: number;
  month: string;
  payDate: number;
  frequency: string | null;
  weekDay: number | null;
  startDate: string | null;
  adjustment: number | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface Bill {
  id: number;
  name: string;
  amount: number;
  isRecurring: number | null;
  date: string | null;
  startMonth: string | null;
  endMonth: string | null;
  dueDay: number | null;
  frequency: string | null;
  weekDay: number | null;
  category: string | null;
  labelId: number | null;
  overrideMonth: string | null;
  type: string;
  adjustment: number | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface SyncDeletion {
  id: number;
  tableName: string;
  rowId: number;
  deletedAt: Date | null;
}

export interface Holiday {
  id: number;
  date: string;
  name: string;
  recurring: number | null;
  affectsPay: number | null;
}

export interface Label {
  id: number;
  name: string;
  color: string;
}

export type MonthData = {
  month: string;
  label: string;
  pay: number;
  payDate: number;
  adjustedPayDate: number;
  payDates: number[];
  bills: Bill[];
  postPayBills: Bill[];
  income: Bill[];
  calendarBills: Bill[];
  totalBills: number;
  totalIncome: number;
  remaining: number;
};

export interface ColumnInfo {
  name: string;
}

export interface SettingRow {
  key: string;
  value: string;
}

export interface EntitySyncInfo {
  id: number;
  updatedAt: string | null;
}

export type SyncPackage = {
  exportedAt: number;
  lastSyncTimestamp: number | null;
  bills: Bill[];
  payments: Payment[];
  settings: SettingRow[];
  deletedBillIds: number[];
  deletedPaymentIds: number[];
  holidays: Holiday[];
};
