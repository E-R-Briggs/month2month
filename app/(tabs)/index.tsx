import { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getCurrentMonth, getAdjacentMonths, getMonthData } from '../../db';
import type { MonthData } from '../../db/types';
import HorizontalMonthScroller from '../../components/HorizontalMonthScroller';

const MONTH_RANGE = 4;

export default function HomeScreen() {
  const router = useRouter();
  const [allMonths] = useState(() => getAdjacentMonths(getCurrentMonth(), MONTH_RANGE));
  const [dataMap, setDataMap] = useState<Record<string, MonthData>>({});
  const [currentIndex, setCurrentIndex] = useState(MONTH_RANGE);

  useFocusEffect(
    useCallback(() => {
      loadAllMonths();
    }, [])
  );

  const loadAllMonths = useCallback(() => {
    Promise.all(allMonths.map(m => getMonthData(m))).then(results => {
      const map: Record<string, MonthData> = {};
      results.forEach(r => { map[r.month] = r; });
      setDataMap(map);
    });
  }, []);

  const currentMonth = allMonths[currentIndex];
  const currentData = dataMap[currentMonth];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.appName}>month2month</Text>
      </View>

      <HorizontalMonthScroller
        months={allMonths}
        dataMap={dataMap}
        currentIndex={currentIndex}
        onIndexChange={setCurrentIndex}
        onRefresh={loadAllMonths}
      />

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.actionButton, styles.removeButton]}
          onPress={() => router.push('/add?type=bill')}
        >
          <Text style={styles.actionButtonText}>-</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.addButton]}
          onPress={() => router.push('/add?type=income')}
        >
          <Text style={styles.actionButtonText}>+</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  appName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: 20,
    paddingBottom: 20,
    justifyContent: 'center',
  },
  actionButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButton: {
    backgroundColor: '#22c55e',
  },
  removeButton: {
    backgroundColor: '#ef4444',
  },
  actionButtonText: {
    fontSize: 28,
    fontWeight: '600',
    color: '#ffffff',
  },
});
