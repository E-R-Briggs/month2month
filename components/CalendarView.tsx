import { View, Text, StyleSheet } from 'react-native';
import type { Bill } from '../db/types';

type Props = {
  month: string;
  payDate: number;
  bills: Bill[];
};

const DAY_NAMES = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

function getBillDays(bills: Bill[]): Set<number> {
  const days = new Set<number>();
  bills.forEach(b => {
    if (b.isRecurring && b.dueDay) {
      days.add(b.dueDay);
    } else if (b.date) {
      const day = parseInt(b.date.slice(8, 10), 10);
      if (!isNaN(day)) days.add(day);
    }
  });
  return days;
}

export default function CalendarView({ month, payDate, bills }: Props) {
  const [year, monthNum] = month.split('-').map(Number);
  const firstDay = new Date(year, monthNum - 1, 1).getDay();
  const daysInMonth = new Date(year, monthNum, 0).getDate();

  const mondayIndex = firstDay === 0 ? 6 : firstDay - 1;
  const billDays = getBillDays(bills);

  const cells: (number | null)[] = [];
  for (let i = 0; i < mondayIndex; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <View style={styles.container}>
      <View style={styles.weekRow}>
        {DAY_NAMES.map(d => (
          <Text key={d} style={styles.dayName}>{d}</Text>
        ))}
      </View>
      <View style={styles.grid}>
        {cells.map((day, i) => {
          if (day === null) return <View key={`e-${i}`} style={styles.cell} />;

          const isPayDay = day === payDate;
          const hasBill = billDays.has(day);

          return (
            <View key={day} style={styles.cell}>
              <Text style={[styles.dayText, isPayDay && styles.payDayText]}>
                {day}
              </Text>
              {(isPayDay || hasBill) && (
                <View style={styles.dots}>
                  {isPayDay && <View style={[styles.dot, styles.payDot]} />}
                  {hasBill && <View style={[styles.dot, styles.billDot]} />}
                </View>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 4,
  },
  dayName: {
    fontSize: 11,
    color: '#555',
    width: 36,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: '14.28%',
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayText: {
    fontSize: 14,
    color: '#ccc',
  },
  payDayText: {
    color: '#22c55e',
    fontWeight: '700',
  },
  dots: {
    flexDirection: 'row',
    gap: 3,
    position: 'absolute',
    bottom: 2,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  payDot: {
    backgroundColor: '#22c55e',
  },
  billDot: {
    backgroundColor: '#ef4444',
  },
});
