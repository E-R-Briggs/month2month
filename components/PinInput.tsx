import { useRef, useState, useEffect, useMemo } from 'react';
import { View, Text, TextInput, StyleSheet, Platform } from 'react-native';
import Animated from 'react-native-reanimated';
import { useTheme } from './ThemeContext';

type Props = {
  length: number;
  onComplete: (pin: string) => void;
  error?: string | null;
};

export default function PinInput({ length, onComplete, error }: Props) {
  const { theme } = useTheme();
  const [pin, setPin] = useState('');
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (pin.length === length) {
      onComplete(pin);
    }
  }, [pin]);

  useEffect(() => {
    let mounted = true;
    setImmediate(() => {
      if (mounted) inputRef.current?.focus();
    });
    return () => { mounted = false; };
  }, []);

  const glowKeyframes = useMemo(() => ({
    '0%': {
      borderColor: theme.text,
      boxShadow: `0 0 4px ${theme.text}40`,
    },
    '50%': {
      borderColor: theme.positive,
      boxShadow: `0 0 10px ${theme.positive}80`,
    },
    '100%': {
      borderColor: theme.text,
      boxShadow: `0 0 4px ${theme.text}40`,
    },
  }), [theme]);

  const dots = [];
  for (let i = 0; i < length; i++) {
    const isFilled = i < pin.length;
    const isActive = i === pin.length;
    dots.push(
      <Animated.View
        key={i}
        style={[
          styles.dot,
          { borderColor: theme.textTertiary },
          isFilled && {
            backgroundColor: theme.text,
            borderColor: theme.text,
            transform: [{ scale: 1.2 }],
          },
          isActive && {
            animationName: glowKeyframes,
            animationDuration: '2000ms',
            animationIterationCount: 'infinite',
            animationTimingFunction: 'ease-in-out',
          },
          {
            transitionProperty: ['transform', 'backgroundColor', 'borderColor', 'borderWidth'],
            transitionDuration: '400ms',
            transitionTimingFunction: 'ease-out',
          },
        ]}
      />,
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.dotsWrapper}>
        <View style={styles.dotsRow}>
          {dots}
        </View>
        <TextInput
          ref={inputRef}
          style={styles.hiddenInput}
          value={pin}
          onChangeText={t => {
            const cleaned = t.replace(/[^0-9]/g, '').slice(0, length);
            setPin(cleaned);
          }}
          keyboardType={Platform.OS === 'web' ? undefined : 'number-pad'}
          maxLength={length}
          autoFocus
          secureTextEntry
          caretHidden={Platform.OS !== 'web'}
        />
      </View>
      {error && (
        <Text style={[styles.error, { color: theme.negative }]}>{error}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 16,
  },
  dotsWrapper: {
    position: 'relative',
    alignItems: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
    cursor: 'pointer',
  },
  dot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
  },
  hiddenInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    color: 'transparent',
    backgroundColor: 'transparent',
    cursor: 'pointer',
  },
  error: {
    fontSize: 14,
    textAlign: 'center',
  },
});
