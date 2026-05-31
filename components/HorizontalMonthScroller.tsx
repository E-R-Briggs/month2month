import { useRef, useCallback } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import type { MonthData } from '../db/types';
import type { Label } from '../db';
import MonthCard from './MonthCard';

type Props = {
  months: string[];
  dataMap: Record<string, MonthData>;
  currentIndex: number;
  onIndexChange: (index: number) => void;
  onRefresh: () => void;
  labels: Label[];
};

const CARD_WIDTH = 360;
const CARD_GAP = 16;

export default function HorizontalMonthScroller({
  months,
  dataMap,
  currentIndex,
  onIndexChange,
  onRefresh,
  labels,
}: Props) {
  const listRef = useRef<FlatList>(null);

  const data = months.map((m, i) => ({
    key: m,
    index: i,
    month: m,
  }));

  const renderItem = useCallback(
    ({ item }: { item: { key: string; index: number; month: string } }) => {
      const monthData = dataMap[item.month];
      if (!monthData) return <View style={styles.cardPlaceholder} />;

      return (
        <View style={styles.cardWrapper}>
          <MonthCard key={item.month} data={monthData} onChanged={onRefresh} labels={labels} />
        </View>
      );
    },
    [dataMap, onRefresh, labels],
  );

  const onMomentumEnd = useCallback(
    (e: any) => {
      const offsetX = e.nativeEvent.contentOffset.x;
      const index = Math.round(offsetX / (CARD_WIDTH + CARD_GAP));
      if (index >= 0 && index < months.length) {
        onIndexChange(index);
      }
    },
    [months.length, onIndexChange],
  );

  return (
    <View style={styles.container}>
      <FlatList
        ref={listRef}
        data={data}
        renderItem={renderItem}
        keyExtractor={item => item.key}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_WIDTH + CARD_GAP}
        snapToAlignment="center"
        decelerationRate="fast"
        contentContainerStyle={styles.listContent}
        onMomentumScrollEnd={onMomentumEnd}
        initialScrollIndex={currentIndex}
        getItemLayout={(_, index) => ({
          length: CARD_WIDTH + CARD_GAP,
          offset: (CARD_WIDTH + CARD_GAP) * index,
          index,
        })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 8,
  },
  cardWrapper: {
    width: CARD_WIDTH,
    marginHorizontal: CARD_GAP / 2,
    flex: 1,
  },
  cardPlaceholder: {
    width: CARD_WIDTH,
    marginHorizontal: CARD_GAP / 2,
    height: 400,
    backgroundColor: '#121212',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#222',
  },
});
