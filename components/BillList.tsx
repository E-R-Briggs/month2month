import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import type { Bill } from '../db/types';
import { deleteBill } from '../db';
type Props = {
  bills: Bill[];
  onChanged: () => void;
};

function formatBillDate(bill: Bill): string | null {
  if (bill.isRecurring) {
    if (bill.startMonth) {
      const label = bill.startMonth;
      if (bill.endMonth) return `${label} \u2192 ${bill.endMonth}`;
      return `${label} \u2192 \u221E`;
    }
    return 'Recurring';
  }
  if (bill.date) {
    const d = new Date(bill.date + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }
  return null;
}

export default function BillList({ bills, onChanged }: Props) {
  const handleDelete = (bill: Bill) => {
    Alert.alert(
      'Delete Bill',
      `Remove "${bill.name}" (\u00A3${bill.amount.toFixed(2)})?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteBill(bill.id);
            onChanged();
          },
        },
      ],
    );
  };

  if (bills.length === 0) {
    return <Text style={styles.empty}>No bills yet. Tap - to add one.</Text>;
  }

  return (
    <View style={styles.list}>
      {bills.map(bill => (
        <TouchableOpacity
          key={bill.id}
          style={styles.row}
          onPress={() => handleDelete(bill)}
        >
          <View style={styles.left}>
            <Text style={styles.name}>{bill.name}</Text>
            <View style={styles.badges}>
              {bill.isRecurring && <Text style={styles.badge}>recurring</Text>}
              {formatBillDate(bill) && (
                <Text style={styles.dateBadge}>{formatBillDate(bill)}</Text>
              )}
            </View>
          </View>
          <Text style={styles.amount}>
            -{'\u00A3'}{bill.amount.toFixed(2)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    color: '#555',
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 16,
  },
  list: {
    gap: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#141414',
    borderRadius: 8,
  },
  left: {
    gap: 4,
    flex: 1,
  },
  name: {
    fontSize: 15,
    color: '#ccc',
  },
  badges: {
    flexDirection: 'row',
    gap: 4,
  },
  badge: {
    fontSize: 10,
    color: '#22c55e',
    backgroundColor: 'rgba(34,197,94,0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  dateBadge: {
    fontSize: 10,
    color: '#888',
    backgroundColor: '#222',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  amount: {
    fontSize: 15,
    color: '#ef4444',
    fontWeight: '600',
  },
});
