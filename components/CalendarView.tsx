import { View, Text, StyleSheet } from 'react-native';
import type { Bill, Label } from '../db/types';

type Props = {
  month: string;
  payDate: number;
  payDates: number[];
  bills: Bill[];
  labels: Label[];
  positiveColor: string;
};

const DAY_NAMES = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

function getDayLabelColors(bills: Bill[], labels: Label[], month: string): Map<number, Set<string>> {
  const map = new Map<number, Set<string>>();
  const labelColorMap = new Map<number | string, string>();
  for (const l of labels) labelColorMap.set(l.id, l.color);

  bills.forEach(b => {
    const color = b.labelId != null ? labelColorMap.get(b.labelId) : undefined;
    if (!color) return;

    const addDay = (day: number) => {
      if (!map.has(day)) map.set(day, new Set());
      map.get(day)!.add(color);
    };

    if (b.isRecurring && b.frequency === 'weekly' && b.weekDay != null) {
      const [y, m] = month.split('-').map(Number);
      const daysInMonth = new Date(y, m, 0).getDate();
      for (let d = 1; d <= daysInMonth; d++) {
        if (new Date(y, m - 1, d).getDay() === b.weekDay) addDay(d);
      }
    } else if (b.isRecurring && b.dueDay) {
      addDay(b.dueDay);
    } else if (b.date) {
      const day = parseInt(b.date.slice(8, 10), 10);
      if (!isNaN(day)) addDay(day);
    }
  });
  return map;
}

export default function CalendarView({ month, payDate, payDates, bills, labels, positiveColor }: Props) {
  const [year, monthNum] = month.split('-').map(Number);
  const firstDay = new Date(year, monthNum - 1, 1).getDay();
  const daysInMonth = new Date(year, monthNum, 0).getDate();

  const mondayIndex = firstDay === 0 ? 6 : firstDay - 1;
  const payDaySet = new Set(payDates);
  const dayLabelColors = getDayLabelColors(bills, labels, month);

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

          const isPayDay = payDaySet.has(day);
          const colors = dayLabelColors.get(day);

          return (
            <View key={day} style={styles.cell}>
              <Text style={[styles.dayText, isPayDay && { color: positiveColor, fontWeight: '700' }]}>
                {day}
              </Text>
              {colors && colors.size > 0 && (
                <View style={styles.dots}>
                  {Array.from(colors).map((c, ci) => (
                    <View key={ci} style={[styles.dot, { backgroundColor: c }]} />
                  ))}
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
});
