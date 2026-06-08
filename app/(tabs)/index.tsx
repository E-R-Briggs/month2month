import { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getCurrentMonth, getAdjacentMonths, getMonthData, getLabels } from '../../db';
import type { MonthData, Label } from '../../db/types';
import HorizontalMonthScroller from '../../components/HorizontalMonthScroller';
import { useTheme } from '../../components/ThemeContext';

const MONTH_RANGE = 4;

export default function HomeScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const [allMonths] = useState(() => getAdjacentMonths(getCurrentMonth(), MONTH_RANGE));
  const [dataMap, setDataMap] = useState<Record<string, MonthData>>({});
  const [currentIndex, setCurrentIndex] = useState(MONTH_RANGE);
  const [labels, setLabels] = useState<Label[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadAllMonths();
      getLabels().then(setLabels);
    }, []),
  );

  const loadAllMonths = useCallback(() => {
    getLabels().then(setLabels);
    Promise.all(allMonths.map(m => getMonthData(m))).then(results => {
      const map: Record<string, MonthData> = {};
      results.forEach(r => { map[r.month] = r; });
      setDataMap(map);
    });
  }, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>

      <HorizontalMonthScroller
        months={allMonths}
        dataMap={dataMap}
        currentIndex={currentIndex}
        onIndexChange={setCurrentIndex}
        onRefresh={loadAllMonths}
        labels={labels}
      />

      <View style={[styles.buttonRow, { pointerEvents: 'box-none' }]}>
        <View style={styles.buttonCol}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: theme.negative }]}
            onPress={() => router.push('/add?type=bill')}
          >
            <Text style={styles.actionButtonText}>-</Text>
          </TouchableOpacity>
          <Text style={[styles.actionLabel, { color: theme.textSecondary }]}>Bill</Text>
        </View>
        <View style={styles.buttonCol}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: theme.positive }]}
            onPress={() => router.push('/add?type=income')}
          >
            <Text style={styles.actionButtonText}>+</Text>
          </TouchableOpacity>
          <Text style={[styles.actionLabel, { color: theme.textSecondary }]}>Income</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  buttonRow: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    gap: 28,
    zIndex: 10,
  },
  buttonCol: {
    alignItems: 'center',
    gap: 4,
  },
  actionButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
  },
  actionButtonText: {
    fontSize: 28,
    fontWeight: '600',
    color: '#ffffff',
  },
  actionLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
});
