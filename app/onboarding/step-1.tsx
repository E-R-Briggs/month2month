import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../components/ThemeContext';
import PayEditor from '../../components/PayEditor';
import { setPay, getCurrentMonth } from '../../db';
import { importFile } from '../../utils/fileIO';
import { importData } from '../../utils/sync';

export default function Step1() {
  const { theme, currency } = useTheme();
  const router = useRouter();
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState<'monthly' | 'weekly'>('monthly');
  const [monthlyDay, setMonthlyDay] = useState(28);
  const [startDate, setStartDate] = useState(new Date());
  const [payAdjustment, setPayAdjustment] = useState(false);
  const [saving, setSaving] = useState(false);
  const [restorePasswordVisible, setRestorePasswordVisible] = useState(false);
  const [restorePassword, setRestorePassword] = useState('');
  const [showRestorePassword, setShowRestorePassword] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [pendingRestoreData, setPendingRestoreData] = useState<Uint8Array | null>(null);

  const sanitized = amount.replace(/[^0-9.]/g, '');
  const parsedAmount = parseFloat(sanitized);
  const isValid = !isNaN(parsedAmount) && parsedAmount > 0;

  const handleContinue = async () => {
    if (!isValid || saving) return;
    setSaving(true);
    try {
      if (frequency === 'monthly') {
        if (monthlyDay < 0 || monthlyDay > 31) {
          Alert.alert('Invalid', 'Please select a valid day');
          setSaving(false);
          return;
        }
        await setPay(parsedAmount, getCurrentMonth(), monthlyDay, 'monthly', undefined, undefined, payAdjustment);
      } else {
        await setPay(parsedAmount, getCurrentMonth(), startDate.getDate(), 'weekly', startDate.getDay(), startDate.toISOString().slice(0, 10), payAdjustment);
      }
      router.push('/onboarding/step-2');
    } catch {
      Alert.alert('Error', 'Could not save pay');
      setSaving(false);
    }
  };

  const handleRestorePick = async () => {
    try {
      const fileData = await importFile();
      if (!fileData) return;

      if (fileData.length < 5) {
        Alert.alert('Invalid file', 'Corrupted or unsupported backup file');
        return;
      }

      const keySource = fileData[4];
      if (keySource === 0) {
        setPendingRestoreData(fileData);
        setRestorePasswordVisible(true);
        return;
      }

      setRestoreLoading(true);
      await importData(fileData);
      setRestoreLoading(false);
      router.replace('/(tabs)');
    } catch (e: any) {
      setRestoreLoading(false);
      Alert.alert('Restore failed', e.message || 'Could not restore from backup');
    }
  };

  const handleRestoreWithPassword = async () => {
    if (!restorePassword || !pendingRestoreData) return;
    setRestoreLoading(true);
    try {
      await importData(pendingRestoreData, restorePassword);
      setRestorePasswordVisible(false);
      setRestoreLoading(false);
      router.replace('/(tabs)');
    } catch (e: any) {
      setRestoreLoading(false);
      Alert.alert('Restore failed', e.message || 'Wrong password or corrupted file');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inner}
      >
        <View style={styles.content}>
          <Text style={[styles.title, { color: theme.text }]}>Welcome to month2month</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>What's your take-home pay?</Text>

          <PayEditor
            amount={amount}
            frequency={frequency}
            monthlyDay={monthlyDay}
            startDate={startDate}
            currency={currency}
            adjustment={payAdjustment}
            onAmountChange={setAmount}
            onFrequencyChange={setFrequency}
            onMonthlyDayChange={setMonthlyDay}
            onStartDateChange={setStartDate}
            onAdjustmentChange={setPayAdjustment}
          />

          <TouchableOpacity
            style={[styles.button, { backgroundColor: theme.positive }, !isValid && styles.buttonDisabled]}
            onPress={handleContinue}
            disabled={!isValid || saving}
          >
            <Text style={styles.buttonText}>{saving ? 'Saving...' : 'Continue'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.restoreLink}
            onPress={handleRestorePick}
            disabled={restoreLoading}
          >
            <Text style={[styles.restoreText, { color: theme.textTertiary }]}>
              {restoreLoading ? 'Importing...' : 'Restore from backup?'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={restorePasswordVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Enter Password</Text>
            <Text style={[styles.modalLabel, { color: theme.textSecondary }]}>Password used during export</Text>
            <View style={[styles.passwordRow, { borderBottomColor: theme.cardBorder }]}>
              <TextInput
                style={[styles.passwordInput, { color: theme.text }]}
                value={restorePassword}
                onChangeText={setRestorePassword}
                placeholder="Enter password"
                placeholderTextColor={theme.textTertiary}
                secureTextEntry={!showRestorePassword}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowRestorePassword(!showRestorePassword)}
              >
                <Ionicons
                  name={showRestorePassword ? 'eye-outline' : 'eye-off-outline'}
                  size={22}
                  color={theme.textSecondary}
                />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: theme.positive }]}
              onPress={handleRestoreWithPassword}
              disabled={restoreLoading || !restorePassword}
            >
              <Text style={[styles.modalButtonText, { color: '#ffffff' }]}>
                {restoreLoading ? 'Restoring...' : 'Restore'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: theme.card }]}
              onPress={() => { setRestorePasswordVisible(false); setRestorePassword(''); setPendingRestoreData(null); }}
            >
              <Text style={[styles.modalButtonText, { color: theme.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 32,
  },
  button: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.3,
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#ffffff',
  },
  restoreLink: {
    marginTop: 24,
    alignItems: 'center',
    paddingVertical: 8,
  },
  restoreText: {
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    padding: 24,
    borderRadius: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 20,
  },
  modalLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 2,
    paddingBottom: 8,
    marginBottom: 24,
  },
  passwordInput: {
    flex: 1,
    fontSize: 18,
    paddingVertical: 4,
  },
  eyeButton: {
    padding: 4,
  },
  modalButton: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
