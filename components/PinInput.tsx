import { useRef, useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Platform } from 'react-native';
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

  const dots = [];
  for (let i = 0; i < length; i++) {
    dots.push(
      <View
        key={i}
        style={[
          styles.dot,
          { borderColor: theme.textTertiary },
          i < pin.length && { backgroundColor: theme.text, borderColor: theme.text },
        ]}
      />,
    );
  }

  return (
    <View style={styles.container}>
      <Pressable onPress={() => inputRef.current?.focus()} style={styles.dotsRow}>
        {dots}
      </Pressable>
      <TextInput
        ref={inputRef}
        style={styles.hiddenInput}
        value={pin}
        onChangeText={t => {
          const cleaned = t.replace(/[^0-9]/g, '').slice(0, length);
          setPin(cleaned);
        }}
        keyboardType="number-pad"
        maxLength={length}
        autoFocus
        secureTextEntry
      />
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
    width: 1,
    height: 1,
    opacity: 0,
  },
  error: {
    fontSize: 14,
    textAlign: 'center',
  },
});
