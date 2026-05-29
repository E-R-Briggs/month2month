import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  interpolateColor,
  useDerivedValue,
  Easing,
} from 'react-native-reanimated';

function FloatingDiff({ amount, isIncrease }: { amount: number; isIncrease: boolean }) {
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
        { color: isIncrease ? '#22c55e' : '#ef4444' },
      ]}
    >
      {isIncrease ? '+' : '-'}£{Math.abs(amount).toFixed(2)}
    </Animated.Text>
  );
}

type Props = {
  value: number;
  style?: any;
};

export default function AnimatedBalance({ value, style }: Props) {
  const animatedValue = useSharedValue(value);
  const flashProgress = useSharedValue(0);
  const isIncreaseRef = useRef(true);
  const prevValueRef = useRef(value);
  const [diffs, setDiffs] = useState<{ id: number; amount: number; inc: boolean }[]>([]);
  const nextId = useRef(0);

  useEffect(() => {
    if (value !== prevValueRef.current) {
      const diff = value - prevValueRef.current;
      const inc = diff > 0;
      isIncreaseRef.current = inc;
      prevValueRef.current = value;

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

  const displayText = useDerivedValue(() => {
    return `\u00A3${Math.abs(animatedValue.value).toFixed(2)}`;
  });

  const textStyle = useAnimatedStyle(() => {
    const color = interpolateColor(
      flashProgress.value,
      [0, 0.25, 1],
      [
        '#ffffff',
        isIncreaseRef.current ? '#22c55e' : '#ef4444',
        '#ffffff',
      ],
    );
    return { color };
  });

  const bgStyle = useAnimatedStyle(() => {
    const bg = interpolateColor(
      flashProgress.value,
      [0, 0.2, 0.6, 1],
      [
        'rgba(255,255,255,0)',
        isIncreaseRef.current ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
        isIncreaseRef.current ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
        'rgba(255,255,255,0)',
      ],
    );
    return { backgroundColor: bg };
  });

  return (
    <View style={[styles.container, style]}>
      <Animated.View style={[styles.bg, bgStyle]}>
        <Animated.Text style={[styles.amount, textStyle]}>
          {displayText.value}
        </Animated.Text>
      </Animated.View>
      {diffs.map(d => (
        <FloatingDiff key={d.id} amount={d.amount} isIncrease={d.inc} />
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
    color: '#ffffff',
  },
  floating: {
    position: 'absolute',
    fontSize: 20,
    fontWeight: '700',
    top: 0,
  },
});
