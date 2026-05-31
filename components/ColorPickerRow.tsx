import { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Dimensions } from 'react-native';
import ColorPicker, {
  Preview,
  Swatches,
} from 'reanimated-color-picker';
import type { ThemeColors } from './ThemeContext';

type Props = {
  label: string;
  color: string;
  onColor: (hex: string) => void;
  theme: ThemeColors;
};

const SWATCHES = [
  '#22c55e', '#16a34a', '#ef4444', '#dc2626',
  '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899',
  '#ffffff', '#000000', '#888888', '#555555',
];

export default function ColorPickerRow({ label, color, onColor, theme }: Props) {
  const [open, setOpen] = useState(false);

  const handleSelect = (c: { hex: string }) => {
    onColor(c.hex);
  };

  const s = useMemo(() => ({
    row: { ...styles.row, backgroundColor: theme.card, borderColor: theme.cardBorder },
    label: { ...styles.label, color: theme.text },
    hex: { ...styles.hex, color: theme.textTertiary },
    swatch: { ...styles.swatch, borderColor: theme.cardBorder },
    overlay: { ...styles.overlay },
    pickerContainer: { ...styles.pickerContainer, backgroundColor: theme.card },
    pickerTitle: { ...styles.pickerTitle, color: theme.text },
    doneButton: { ...styles.doneButton, backgroundColor: theme.text },
    doneText: { ...styles.doneText, color: theme.background },
  }), [theme]);

  return (
    <>
      <TouchableOpacity style={s.row} onPress={() => setOpen(true)}>
        <Text style={s.label}>{label}</Text>
        <View style={styles.right}>
          <Text style={s.hex}>{color}</Text>
          <View style={[s.swatch, { backgroundColor: color }]} />
        </View>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade">
        <View style={s.overlay}>
          <View style={s.pickerContainer}>
            <Text style={s.pickerTitle}>{label}</Text>
            <ColorPicker
              style={styles.picker}
              value={color}
              onComplete={handleSelect}
            >
              <Preview />
              <Swatches colors={SWATCHES} />
            </ColorPicker>
            <TouchableOpacity
              style={s.doneButton}
              onPress={() => setOpen(false)}
            >
              <Text style={s.doneText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
  },
  label: {
    fontSize: 15,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hex: {
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  swatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  pickerContainer: {
    borderRadius: 20,
    padding: 24,
    width: Dimensions.get('window').width - 48,
    alignItems: 'center',
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  picker: {
    width: '100%',
    marginBottom: 16,
  },
  doneButton: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 10,
  },
  doneText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
