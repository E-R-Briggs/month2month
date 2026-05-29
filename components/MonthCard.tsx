import { View, Text, StyleSheet } from 'react-native';
import type { MonthData } from '../db/types';
import CalendarView from './CalendarView';
import BillList from './BillList';
import AnimatedBalance from './AnimatedBalance';

type Props = {
  data: MonthData;
  onChanged: () => void;
};

export default function MonthCard({ data, onChanged }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.monthLabel}>{data.label}</Text>
        <AnimatedBalance value={data.remaining} />
      </View>

      <View style={styles.divider} />

      <CalendarView month={data.month} payDate={data.payDate} bills={data.bills} />

      <View style={styles.divider} />

      <BillList bills={data.bills} onChanged={onChanged} />

      <View style={styles.divider} />

      <View style={styles.footer}>
        <View style={styles.footerRow}>
          <Text style={styles.footerLabel}>Income</Text>
          <Text style={styles.incomeText}>+£{data.pay.toFixed(2)}</Text>
        </View>
        <View style={styles.footerRow}>
          <Text style={styles.footerLabel}>Bills</Text>
          <Text style={styles.billTotalText}>-£{data.totalBills.toFixed(2)}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#121212',
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: '#222',
  },
  header: {
    alignItems: 'center',
    gap: 8,
  },
  monthLabel: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#222',
    marginVertical: 16,
  },
  footer: {
    gap: 8,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerLabel: {
    fontSize: 14,
    color: '#666',
  },
  incomeText: {
    fontSize: 16,
    color: '#22c55e',
    fontWeight: '600',
  },
  billTotalText: {
    fontSize: 16,
    color: '#ef4444',
    fontWeight: '600',
  },
});
