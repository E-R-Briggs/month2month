import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import type { Bill } from '../db/types';
import { deleteBill, type Label } from '../db';
import type { ThemeColors } from './ThemeContext';
import { formatCurrency } from '../utils/currency';
import { hexToRgba } from '../utils/helpers';
import type { CurrencyCode } from '../utils/currency';

type Props = {
  bills: Bill[];
  onChanged: () => void;
  theme: ThemeColors;
  currency: CurrencyCode;
  accentColor?: string;
  kind?: string;
  labels: Label[];
  highlightedBillId?: number | null;
};

function formatBillDate(bill: Bill): string | null {
  if (bill.isRecurring) {
    const freq = bill.frequency === 'weekly' ? 'weekly' : 'monthly';
    if (bill.startMonth) {
      const label = bill.startMonth;
      if (bill.endMonth) return `${freq} · ${label} → ${bill.endMonth}`;
      return `${freq} · ${label} → ∞`;
    }
    return freq;
  }
  if (bill.date) {
    const d = new Date(bill.date + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }
  return null;
}

export default function BillList({ bills, onChanged, theme, currency, accentColor, kind, labels, highlightedBillId }: Props) {
  const router = useRouter();
  const color = accentColor || theme.negative;
  const itemKind = kind || 'Bill';

  const labelColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const l of labels) {
      map[l.name.toLowerCase()] = l.color;
    }
    return map;
  }, [labels]);

  const handleDelete = (bill: Bill) => {
    Alert.alert(
      `Delete ${itemKind}`,
      `Remove "${bill.name}" (${formatCurrency(bill.amount, currency)})?`,
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

  const handleTap = (bill: Bill) => {
    const t = bill.type === 'income' ? 'income' : 'bill';
    router.push(`/add?type=${t}&id=${bill.id}`);
  };

  if (bills.length === 0) {
    return (
      <Text style={{ color: theme.textTertiary, fontSize: 14, textAlign: 'center', paddingVertical: 16 }}>
        No {itemKind.toLowerCase()}s yet.
      </Text>
    );
  }

  return (
    <View>
      {bills.map(bill => (
        <TouchableOpacity
          key={bill.id}
          style={[
            styles.row,
            {
              backgroundColor: bill.id === highlightedBillId ? hexToRgba(theme.positive, 0.12) : theme.card,
              borderColor: bill.id === highlightedBillId ? theme.positive : theme.cardBorder,
            },
          ]}
          onPress={() => handleTap(bill)}
          onLongPress={() => handleDelete(bill)}
        >
          <View style={styles.left}>
            <View style={styles.nameRow}>
              {bill.category && (
                <View style={[styles.colorDot, { backgroundColor: labelColorMap[bill.category.toLowerCase()] ?? theme.textTertiary }]} />
              )}
              <Text style={{ color: theme.text, fontSize: 15 }}>{bill.name}</Text>
            </View>
            <View style={styles.badges}>
              {bill.isRecurring && (
                <Text style={[styles.badge, { color: theme.positive, backgroundColor: hexToRgba(theme.positive, 0.1) }]} numberOfLines={1}>
                  {bill.frequency === 'weekly' ? 'weekly' : 'recurring'}
                </Text>
              )}
              {formatBillDate(bill) && (
                <Text style={[styles.dateBadge, { color: theme.textSecondary, backgroundColor: theme.cardBorder }]} numberOfLines={1}>
                  {formatBillDate(bill)}
                </Text>
              )}
            </View>
          </View>
          <Text style={{ color, fontSize: 15, fontWeight: '600' }}>
            {bill.type === 'income' ? formatCurrency(bill.amount, currency) : formatCurrency(-bill.amount, currency)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  left: {
    gap: 4,
    flex: 1,
  },
  badges: {
    flexDirection: 'row',
    gap: 4,
  },
  badge: {
    fontSize: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  dateBadge: {
    fontSize: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
});
