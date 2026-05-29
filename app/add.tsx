import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Switch,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { addBill, getCurrentMonth, setPay, getMonthData, monthFromDate } from '../db';

export default function AddScreen() {
  const router = useRouter();
  const { type: rawType } = useLocalSearchParams<{ type: string }>();
  const isIncome = rawType === 'income';

  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [date, setDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [category, setCategory] = useState('bills');
  const [saving, setSaving] = useState(false);

  function onDateChange(_: DateTimePickerEvent, selected?: Date) {
    setShowPicker(Platform.OS === 'ios');
    if (selected) setDate(selected);
  }

  async function handleSave() {
    const parsedAmount = parseFloat(amount);
    if (saving) return;
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Invalid', 'Please enter a valid amount');
      return;
    }

    setSaving(true);

    if (isIncome) {
      const month = monthFromDate(date.toISOString().slice(0, 10));
      const existing = await getMonthData(month);
      const newAmount = existing.pay + parsedAmount;
      await setPay(newAmount, month, date.getDate());
    } else if (isRecurring) {
      const startMonth = monthFromDate(date.toISOString().slice(0, 10));
      await addBill(
        name || 'Untitled',
        parsedAmount,
        true,
        undefined,
        startMonth,
        date.getDate(),
        category,
      );
    } else {
      const dateStr = date.toISOString().slice(0, 10);
      await addBill(
        name || 'Untitled',
        parsedAmount,
        false,
        dateStr,
        undefined,
        undefined,
        category,
      );
    }

    router.back();
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.cancel}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{isIncome ? 'Add Income' : 'Add Bill'}</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {!isIncome && (
          <>
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Rent, Netflix, etc."
              placeholderTextColor="#555"
            />
          </>
        )}

        <Text style={styles.label}>Amount</Text>
        <View style={styles.inputRow}>
          <Text style={styles.pound}>£</Text>
          <TextInput
            style={styles.inputWide}
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
            placeholder="0.00"
            placeholderTextColor="#555"
            autoFocus
          />
        </View>

        <Text style={styles.label}>
          {isIncome ? 'Date received' : isRecurring ? 'Start date' : 'Due date'}
        </Text>
        <TouchableOpacity style={styles.dateButton} onPress={() => setShowPicker(true)}>
          <Text style={styles.dateText}>
            {date.toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </Text>
        </TouchableOpacity>

        {showPicker && (
          <DateTimePicker
            value={date}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={onDateChange}
          />
        )}

        {!isIncome && (
          <>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Recurring every month</Text>
              <Switch
                value={isRecurring}
                onValueChange={setIsRecurring}
                trackColor={{ false: '#333', true: '#22c55e' }}
                thumbColor="#fff"
              />
            </View>

            <Text style={styles.label}>Category</Text>
            {['bills', 'subscription', 'food', 'transport', 'shopping', 'other'].map(cat => (
              <TouchableOpacity
                key={cat}
                style={[styles.category, category === cat && styles.categorySelected]}
                onPress={() => setCategory(cat)}
              >
                <Text
                  style={[
                    styles.categoryText,
                    category === cat && styles.categoryTextSelected,
                  ]}
                >
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </>
        )}

        <TouchableOpacity
          style={[styles.button, (!amount || parseFloat(amount) <= 0) && styles.buttonDisabled]}
          onPress={handleSave}
          disabled={!amount || parseFloat(amount) <= 0 || saving}
        >
          <Text style={styles.buttonText}>
            {saving ? 'Saving...' : isIncome ? 'Add Income' : 'Add Bill'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  cancel: {
    fontSize: 16,
    color: '#ef4444',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  content: {
    padding: 24,
  },
  label: {
    fontSize: 14,
    color: '#888',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  switchLabel: {
    fontSize: 15,
    color: '#ccc',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#333',
    paddingBottom: 8,
    marginBottom: 24,
  },
  pound: {
    fontSize: 24,
    color: '#ffffff',
    marginRight: 8,
  },
  input: {
    fontSize: 16,
    color: '#ffffff',
    borderBottomWidth: 2,
    borderBottomColor: '#333',
    paddingBottom: 8,
    marginBottom: 24,
  },
  inputWide: {
    flex: 1,
    fontSize: 24,
    color: '#ffffff',
  },
  dateButton: {
    backgroundColor: '#1a1a1a',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 24,
  },
  dateText: {
    fontSize: 16,
    color: '#ffffff',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 8,
  },
  category: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#1a1a1a',
    marginBottom: 8,
  },
  categorySelected: {
    backgroundColor: '#333',
  },
  categoryText: {
    fontSize: 16,
    color: '#888',
  },
  categoryTextSelected: {
    color: '#ffffff',
    fontWeight: '600',
  },
  button: {
    backgroundColor: '#ffffff',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonDisabled: {
    opacity: 0.3,
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#0a0a0a',
  },
});
