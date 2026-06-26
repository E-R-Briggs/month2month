import { useState } from 'react';
import { Platform, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import DateTimePicker from '@expo/ui/community/datetime-picker';
import SegmentedControl from '@expo/ui/community/segmented-control';
import { useTheme } from './ThemeContext';
import WebDateInput from './WebDateInput';
import type { CurrencyCode } from '../utils/currency';
import { getCurrencySymbol } from '../utils/currency';

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

type Props = {
  amount: string;
  frequency: 'monthly' | 'weekly';
  monthlyDay: number;
  startDate: Date;
  currency: CurrencyCode;
  adjustment: boolean;
  onAmountChange: (v: string) => void;
  onFrequencyChange: (f: 'monthly' | 'weekly') => void;
  onMonthlyDayChange: (d: number) => void;
  onStartDateChange: (d: Date) => void;
  onAdjustmentChange: (v: boolean) => void;
};

export default function PayEditor(props: Props) {
  const { theme } = useTheme();
  const [showStartPicker, setShowStartPicker] = useState(false);
  const { amount, frequency, monthlyDay, startDate, currency, adjustment, onAmountChange, onFrequencyChange, onMonthlyDayChange, onStartDateChange, onAdjustmentChange } = props;

  return (
    <>
      <Text style={[styles.label, { color: theme.textSecondary }]}>Frequency</Text>
      <SegmentedControl
        values={['Monthly', 'Weekly']}
        selectedIndex={frequency === 'monthly' ? 0 : 1}
        onChange={(event) => {
          onFrequencyChange(event.nativeEvent.selectedSegmentIndex === 0 ? 'monthly' : 'weekly');
        }}
        appearance="dark"
        style={{ marginBottom: 20 }}
      />

      <Text style={[styles.label, { color: theme.textSecondary }]}>
        {frequency === 'monthly' ? 'Monthly Pay' : 'Weekly Pay Amount'}
      </Text>
      <View style={[styles.inputRow, { borderBottomColor: theme.cardBorder }]}>
        <TextInput
          style={[styles.input, { color: theme.text }]}
          value={amount ? `${getCurrencySymbol(currency)}${amount}` : ''}
          onChangeText={v => {
            const stripped = v.replace(new RegExp(`[^0-9.]`, 'g'), '');
            onAmountChange(stripped);
          }}
          keyboardType="numeric"
          placeholder="0.00"
          placeholderTextColor={theme.textTertiary}
        />
      </View>

      {frequency === 'monthly' ? (
        <>
          <Text style={[styles.label, { color: theme.textSecondary }]}>Pay Day</Text>
          <View style={styles.dayGrid}>
            {DAYS.map(day => (
              <TouchableOpacity
                key={day}
                style={[
                  styles.dayButton,
                  {
                    backgroundColor: monthlyDay === day ? theme.positive : theme.card,
                    borderColor: theme.cardBorder,
                  },
                ]}
                onPress={() => onMonthlyDayChange(day)}
              >
                <Text style={[styles.dayText, { color: monthlyDay === day ? '#ffffff' : theme.text }]}>
                  {day}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[
                styles.dayButton,
                {
                  backgroundColor: monthlyDay === 0 ? theme.positive : theme.card,
                  borderColor: theme.cardBorder,
                },
              ]}
              onPress={() => onMonthlyDayChange(0)}
            >
              <Text style={[styles.dayText, { color: monthlyDay === 0 ? '#ffffff' : theme.text }]}>
                Last
              </Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <>
          <Text style={[styles.label, { color: theme.textSecondary }]}>Start Date (first pay day)</Text>
          {Platform.OS === 'web' ? (
            <WebDateInput value={startDate} onChange={onStartDateChange} />
          ) : (
            <>
              <TouchableOpacity
                style={[styles.dateButton, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
                onPress={() => setShowStartPicker(true)}
              >
                <Text style={{ color: theme.text, fontSize: 16 }}>
                  {startDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                </Text>
              </TouchableOpacity>
              {showStartPicker && (
                <DateTimePicker
                  value={startDate}
                  mode="date"
                  presentation="dialog"
                  onChange={(event, selectedDate) => {
                    setShowStartPicker(false);
                    if (selectedDate) onStartDateChange(selectedDate);
                  }}
                />
              )}
            </>
          )}
        </>
      )}

      <View style={[styles.switchRow, { borderBottomColor: theme.cardBorder }]}>
        <Text style={[styles.switchLabel, { color: theme.text }]}>
          Adjust for weekends & bank holidays
        </Text>
        <Switch
          value={adjustment}
          onValueChange={onAdjustmentChange}
          trackColor={{ false: theme.cardBorder, true: theme.positive }}
          thumbColor="#fff"
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 14,
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 2,
    paddingBottom: 8,
    marginBottom: 24,
    maxWidth: Platform.select({ web: 400, default: undefined }),
  },
  input: {
    flex: 1,
    fontSize: Platform.select({ web: 16, default: 24 }),
  },
  dayGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 24,
  },
  dayButton: {
    width: 42,
    height: 42,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: {
    fontSize: 13,
    fontWeight: '600',
  },
  dateButton: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 24,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    marginBottom: 24,
  },
  switchLabel: {
    fontSize: 14,
    flex: 1,
    marginRight: 12,
  },
});
