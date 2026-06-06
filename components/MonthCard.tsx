import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import type { MonthData } from '../db/types';
import type { Label } from '../db';
import { useTheme } from './ThemeContext';
import CalendarView from './CalendarView';
import BillList from './BillList';
import { formatCurrency } from '../utils/currency';
import { capitalize } from '../utils/helpers';
import AnimatedBalance from './AnimatedBalance';

type Step = {
  billId: number | null;
  runningTotal: number;
  name: string;
};

type Props = {
  data: MonthData;
  onChanged: () => void;
  labels: Label[];
};

export default function MonthCard({ data, onChanged, labels }: Props) {
  const { theme, currency } = useTheme();
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackValue, setPlaybackValue] = useState<number | null>(null);
  const [highlightedBillId, setHighlightedBillId] = useState<number | null>(null);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const steps = useMemo(() => {
    const all = [...data.income, ...data.bills, ...data.postPayBills];

    const result: Step[] = [];
    let running = data.pay;
    result.push({ billId: null, runningTotal: running, name: 'Starting pay' });

    for (const item of all) {
      if (item.type === 'income') {
        running += item.amount;
      } else {
        running -= item.amount;
      }
      result.push({ billId: item.id, runningTotal: running, name: item.name });
    }
    return result;
  }, [data]);

  const startPlayback = useCallback(() => {
    if (isPlaying || steps.length <= 1) return;
    setIsPlaying(true);

    steps.forEach((step, i) => {
      const t = setTimeout(() => {
        setPlaybackValue(step.runningTotal);
        setHighlightedBillId(step.billId);
        if (i === steps.length - 1) {
          setTimeout(() => {
            setPlaybackValue(null);
            setHighlightedBillId(null);
            setIsPlaying(false);
          }, 1200);
        }
      }, i * 1200);
      timeoutsRef.current.push(t);
    });
  }, [isPlaying, steps]);

  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach(clearTimeout);
      timeoutsRef.current = [];
    };
  }, []);

  const labelColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const l of labels) {
      map[l.name.toLowerCase()] = l.color;
    }
    return map;
  }, [labels]);

  const allItems = useMemo(
    () => [...data.bills, ...data.postPayBills, ...data.income],
    [data.bills, data.postPayBills, data.income],
  );
  const categories = useMemo(() => {
    const set = new Set(allItems.map(b => b.category || 'other'));
    return ['all', ...Array.from(set)];
  }, [allItems]);

  const filteredBills = activeCategory ? data.bills.filter(b => (b.category || 'other') === activeCategory) : data.bills;
  const filteredPostPay = activeCategory ? data.postPayBills.filter(b => (b.category || 'other') === activeCategory) : data.postPayBills;
  const filteredIncome = activeCategory ? data.income.filter(b => (b.category || 'other') === activeCategory) : data.income;

  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
      {steps.length > 1 && (
        <TouchableOpacity
          style={[styles.playButton, { backgroundColor: isPlaying ? theme.cardBorder : theme.positive }]}
          onPress={startPlayback}
          disabled={isPlaying}
        >
          <Ionicons name={isPlaying ? 'hourglass-outline' : 'play-outline'} size={18} color="#fff" />
        </TouchableOpacity>
      )}
      <View style={styles.header}>
        <Text style={[styles.monthLabel, { color: theme.textSecondary }]}>{data.label}</Text>
        <AnimatedBalance
          value={playbackValue ?? data.remaining}
          positiveColor={theme.positive}
          negativeColor={theme.negative}
          color={theme.text}
          currency={currency}
        />
      </View>

      <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
        <View style={[styles.divider, { backgroundColor: theme.cardBorder }]} />

        <CalendarView
          month={data.month}
          payDate={data.payDate}
          payDates={data.payDates}
          bills={data.calendarBills}
          labels={labels}
          positiveColor={theme.positive}
        />

        <View style={[styles.divider, { backgroundColor: theme.cardBorder }]} />

        {categories.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
            {categories.map(cat => {
              const active = cat === 'all' ? activeCategory === null : activeCategory === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.filterChip,
                    { backgroundColor: active ? (labelColorMap[cat] ?? theme.positive) : theme.cardBorder },
                  ]}
                  onPress={() => setActiveCategory(cat === 'all' ? null : cat)}
                >
                  <Text style={[styles.filterChipText, { color: active ? '#fff' : theme.textSecondary }]}>
                    {cat === 'all' ? 'All' : capitalize(cat)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {filteredIncome.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { color: theme.positive }]}>Income</Text>
            <BillList
              bills={filteredIncome}
              onChanged={onChanged}
              theme={theme}
              currency={currency}
              accentColor={theme.positive}
              kind="Income"
              labels={labels}
              highlightedBillId={highlightedBillId}
            />
          </>
        )}

        <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Bills</Text>
        <BillList bills={filteredBills} onChanged={onChanged} theme={theme} currency={currency} labels={labels} highlightedBillId={highlightedBillId} />

        {filteredPostPay.length > 0 && (
          <>
            <View style={[styles.postDivider, { backgroundColor: theme.cardBorder }]} />
            <Text style={[styles.otherLabel, { color: theme.textTertiary }]}>
              Bills from last month (affect this month)
            </Text>
            <BillList bills={filteredPostPay} onChanged={onChanged} theme={theme} currency={currency} labels={labels} highlightedBillId={highlightedBillId} />
          </>
        )}

        <View style={[styles.divider, { backgroundColor: theme.cardBorder }]} />
        <View style={styles.footer}>
          <View style={styles.footerRow}>
            <Text style={{ color: theme.textSecondary, fontSize: 14 }}>Pay</Text>
            <Text style={{ color: theme.positive, fontSize: 16, fontWeight: '600' }}>
              {formatCurrency(data.pay, currency)}
            </Text>
          </View>
          {data.income.length > 0 && (
            <View style={styles.footerRow}>
              <Text style={{ color: theme.textSecondary, fontSize: 14 }}>Extra</Text>
              <Text style={{ color: theme.positive, fontSize: 16, fontWeight: '600' }}>
                {formatCurrency(data.totalIncome - data.pay, currency)}
              </Text>
            </View>
          )}
          <View style={styles.footerRow}>
            <Text style={{ color: theme.textSecondary, fontSize: 14 }}>Bills</Text>
            <Text style={{ color: theme.negative, fontSize: 16, fontWeight: '600' }}>
              {formatCurrency(-data.totalBills, currency)}
            </Text>
          </View>
        </View>
        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={[styles.fabSpacer, { pointerEvents: 'box-none' }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 110,
    marginHorizontal: 16,
    borderWidth: 1,
    flex: 1,
  },
  scrollArea: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    gap: 8,
  },
  monthLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  playButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  divider: {
    height: 1,
    marginVertical: 16,
  },
  postDivider: {
    height: 1,
    marginTop: 16,
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  otherLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  filterRow: {
    marginBottom: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 6,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  footer: {
    gap: 8,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  fabSpacer: {
    height: 0,
  },
});
