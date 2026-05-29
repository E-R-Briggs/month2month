import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getCurrentMonth, setPay, getPay, getMonthLabel } from '../../db';

export default function SettingsScreen() {
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState('28');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPay();
  }, []);

  async function loadPay() {
    const month = getCurrentMonth();
    const amount = await getPay(month);
    if (amount > 0) {
      setPayAmount(amount.toString());
    }
    setLoading(false);
  }

  async function handleSave() {
    const amount = parseFloat(payAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid', 'Please enter a valid pay amount');
      return;
    }
    const day = parseInt(payDate, 10);
    if (isNaN(day) || day < 1 || day > 31) {
      Alert.alert('Invalid', 'Please enter a valid day (1-31)');
      return;
    }
    await setPay(amount, getCurrentMonth(), day);
    Alert.alert('Saved', 'Your pay has been updated');
  }

  if (loading) return null;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Settings</Text>

        <Text style={styles.label}>Monthly Pay ({getMonthLabel(getCurrentMonth())})</Text>
        <View style={styles.inputRow}>
          <Text style={styles.pound}>£</Text>
          <TextInput
            style={styles.input}
            value={payAmount}
            onChangeText={setPayAmount}
            keyboardType="numeric"
            placeholder="0.00"
            placeholderTextColor="#555"
          />
        </View>

        <Text style={styles.label}>Pay Day</Text>
        <TextInput
          style={styles.input}
          value={payDate}
          onChangeText={setPayDate}
          keyboardType="number-pad"
          placeholder="1-31"
          placeholderTextColor="#555"
        />

        <TouchableOpacity style={styles.button} onPress={handleSave}>
          <Text style={styles.buttonText}>Save</Text>
        </TouchableOpacity>

        <View style={styles.about}>
          <Text style={styles.aboutTitle}>About</Text>
          <Text style={styles.aboutText}>
            month2month — a local-only monthly budget tracker.{'\n\n'}
            All data is stored on-device. No servers, no accounts, no tracking.{'\n\n'}
            Licensed under GPLv3.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  content: {
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 32,
  },
  label: {
    fontSize: 14,
    color: '#888',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
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
    flex: 1,
    fontSize: 24,
    color: '#ffffff',
    borderBottomWidth: 2,
    borderBottomColor: '#333',
    paddingBottom: 8,
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#ffffff',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 48,
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#0a0a0a',
  },
  about: {
    borderTopWidth: 1,
    borderTopColor: '#222',
    paddingTop: 24,
  },
  aboutTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
  },
  aboutText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
});
