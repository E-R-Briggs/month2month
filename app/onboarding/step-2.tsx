import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { setPay, getCurrentMonth } from '../../db';

export default function Step2() {
  const router = useRouter();
  const { pay } = useLocalSearchParams<{ pay: string }>();
  const [payDate, setPayDate] = useState<number>(28);
  const [saving, setSaving] = useState(false);

  const handleDone = async () => {
    if (saving) return;
    setSaving(true);
    const amount = parseFloat(pay || '0');
    const month = getCurrentMonth();
    await setPay(amount, month, payDate);
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>When do you get paid?</Text>
        <Text style={styles.subtitle}>Select the day of the month</Text>

        <View style={styles.daysGrid}>
          {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
            <TouchableOpacity
              key={day}
              style={[styles.day, payDate === day && styles.daySelected]}
              onPress={() => setPayDate(day)}
            >
              <Text style={[styles.dayText, payDate === day && styles.dayTextSelected]}>
                {day}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.button} onPress={handleDone}>
          <Text style={styles.buttonText}>{saving ? 'Saving...' : 'Done'}</Text>
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
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#888',
    marginBottom: 24,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    marginBottom: 40,
  },
  day: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
  daySelected: {
    backgroundColor: '#ffffff',
  },
  dayText: {
    fontSize: 16,
    color: '#888',
    fontWeight: '500',
  },
  dayTextSelected: {
    color: '#0a0a0a',
    fontWeight: '700',
  },
  button: {
    backgroundColor: '#ffffff',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#0a0a0a',
  },
});
