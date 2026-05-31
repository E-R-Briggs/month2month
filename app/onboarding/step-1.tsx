import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../components/ThemeContext';

export default function Step1() {
  const { theme } = useTheme();
  const router = useRouter();
  const [amount, setAmount] = useState('');

  const sanitized = amount.replace(/[^0-9.]/g, '');
  const parsedAmount = parseFloat(sanitized);
  const isValid = !isNaN(parsedAmount) && parsedAmount > 0;

  const handleContinue = () => {
    if (!isValid) return;
    router.push({ pathname: '/onboarding/step-2', params: { pay: sanitized } });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inner}
      >
        <View style={styles.content}>
          <Text style={[styles.title, { color: theme.text }]}>Welcome to month2month</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>What's your monthly take-home pay?</Text>
          <View style={[styles.inputRow, { borderBottomColor: theme.cardBorder }]}>
            <View style={styles.poundContainer}>
              <Text style={[styles.pound, { color: theme.text }]}>£</Text>
            </View>
            <TextInput
              style={[styles.input, { color: theme.text, paddingLeft: 38 }]}
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              placeholder="0.00"
              placeholderTextColor={theme.textTertiary}
              autoFocus
            />
          </View>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: theme.positive }, !isValid && styles.buttonDisabled]}
            onPress={handleContinue}
            disabled={!isValid}
          >
            <Text style={styles.buttonText}>Continue</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  inner: {
    flex: 1,
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
    marginBottom: 32,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#333',
    paddingBottom: 8,
    marginBottom: 40,
  },
  pound: {
    fontSize: 32,
    color: '#ffffff',
  },
  poundContainer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    width: 36,
    zIndex: 1,
  },
  input: {
    flex: 1,
    fontSize: 32,
    color: '#ffffff',
    fontWeight: '600',
  },
  button: {
    backgroundColor: '#ffffff',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
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
