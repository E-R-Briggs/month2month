import { useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedReaction,
  withTiming,
  withSpring,
  withDelay,
  interpolateColor,
  Easing,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { formatCurrency, getCurrencySymbol } from '../utils/currency';
import { hexToRgba } from '../utils/helpers';
import type { CurrencyCode } from '../utils/currency';

function FloatingDiff({
  amount,
  isIncrease,
  positiveColor,
  negativeColor,
  currency,
}: {
  amount: number;
  isIncrease: boolean;
  positiveColor: string;
  negativeColor: string;
  currency: CurrencyCode;
}) {
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(1);
  const scale = useSharedValue(0);

  useEffect(() => {
    scale.value = withSpring(1, { damping: 12 });
    translateY.value = withTiming(isIncrease ? -80 : 80, {
      duration: 1000,
      easing: Easing.out(Easing.cubic),
    });
    opacity.value = withDelay(200, withTiming(0, {
      duration: 800,
      easing: Easing.out(Easing.cubic),
    }));
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.Text
      style={[
        styles.floating,
        animStyle,
        { color: isIncrease ? positiveColor : negativeColor },
      ]}
    >
      {isIncrease ? '+' : '-'}{getCurrencySymbol(currency)}{Math.abs(amount).toFixed(2)}
    </Animated.Text>
  );
}

type Props = {
  value: number;
  positiveColor?: string;
  negativeColor?: string;
  color?: string;
  currency?: CurrencyCode;
  style?: any;
};

export default function AnimatedBalance({ value, positiveColor = '#22c55e', negativeColor = '#ef4444', color = '#ffffff', currency = 'GBP', style }: Props) {
  const animatedValue = useSharedValue(value);
  const flashProgress = useSharedValue(0);
  const currencySymSV = useSharedValue(getCurrencySymbol(currency));
  const isIncreaseSV = useSharedValue(true);
  const prevValueSV = useSharedValue(value);
  const [diffs, setDiffs] = useState<{ id: number; amount: number; inc: boolean }[]>([]);
  const [displayText, setDisplayText] = useState(
    () => formatCurrency(value, currency),
  );
  const nextId = useRef(0);

  const posRgba = useRef(hexToRgba(positiveColor, 0.15)).current;
  const negRgba = useRef(hexToRgba(negativeColor, 0.15)).current;

  useEffect(() => {
    if (value !== prevValueSV.value) {
      const diff = value - prevValueSV.value;
      const inc = diff > 0;
      isIncreaseSV.value = inc;
      prevValueSV.value = value;

      const id = nextId.current++;
      setDiffs(prev => [...prev, { id, amount: Math.abs(diff), inc }]);
      setTimeout(() => {
        setDiffs(prev => prev.filter(d => d.id !== id));
      }, 1200);

      flashProgress.value = 0;
      flashProgress.value = withTiming(1, {
        duration: 1200,
        easing: Easing.out(Easing.cubic),
      });

      animatedValue.value = withTiming(value, {
        duration: 800,
        easing: Easing.out(Easing.cubic),
      });
    }
  }, [value]);

  useEffect(() => {
    currencySymSV.value = getCurrencySymbol(currency);
  }, [currency]);

  useAnimatedReaction(
    () => animatedValue.value,
    (current) => {
      const prefix = current < 0 ? '-' : '';
      scheduleOnRN(setDisplayText, `${prefix}${currencySymSV.value}${Math.abs(current).toFixed(2)}`);
    },
  );

  const textStyle = useAnimatedStyle(() => {
    const flashColor = interpolateColor(
      flashProgress.value,
      [0, 0.25, 1],
      [
        color,
        isIncreaseSV.value ? positiveColor : negativeColor,
        color,
      ],
    );
    return { color: flashColor };
  });

  const bgStyle = useAnimatedStyle(() => {
    const active = isIncreaseSV.value ? posRgba : negRgba;
    const bg = interpolateColor(
      flashProgress.value,
      [0, 0.2, 0.6, 1],
      ['rgba(255,255,255,0)', active, active, 'rgba(255,255,255,0)'],
    );
    return { backgroundColor: bg };
  });

  return (
    <View style={[styles.container, style]}>
      <Animated.View style={[styles.bg, bgStyle]}>
        <Animated.Text style={[styles.amount, textStyle]}>
          {displayText}
        </Animated.Text>
      </Animated.View>
      {diffs.map(d => (
        <FloatingDiff
          key={d.id}
          amount={d.amount}
          isIncrease={d.inc}
          positiveColor={positiveColor}
          negativeColor={negativeColor}
          currency={currency}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    position: 'relative',
  },
  bg: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  amount: {
    fontSize: 36,
    fontWeight: '800',
  },
  floating: {
    position: 'absolute',
    fontSize: 20,
    fontWeight: '700',
    top: 0,
  },
});
