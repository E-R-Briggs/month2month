import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Platform,
  Switch,
  Modal,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import { getCurrentMonth, setPay, getPayForMonth, getMonthLabel, resetAllData } from '../../db';
import { useTheme } from '../../components/ThemeContext';
import ColorPickerRow from '../../components/ColorPickerRow';
import { CURRENCY_OPTIONS, getCurrencySymbol } from '../../utils/currency';
import { exportData, importData, createBiometricKey, getBiometricKey, deleteBiometricKey } from '../../utils/sync';
import { exportFile, importFile } from '../../utils/fileIO';
import type { CurrencyCode } from '../../utils/currency';

const APP_VERSION = require('../../package.json').version;

const COLOR_KEYS: { key: keyof ReturnType<typeof useTheme>['theme']; label: string }[] = [
  { key: 'positive', label: 'Positive (income)' },
  { key: 'negative', label: 'Negative (bills)' },
  { key: 'background', label: 'Background' },
  { key: 'card', label: 'Card' },
  { key: 'cardBorder', label: 'Card Border' },
  { key: 'text', label: 'Text' },
  { key: 'textSecondary', label: 'Muted Text' },
  { key: 'textTertiary', label: 'Placeholder Text' },
];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function SettingsScreen() {
  const { theme, resolvedMode, rawSettings, currency, updateColor, updateMode, toggleAndroidSystem, resetTheme, updateCurrency } = useTheme();
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState('28');
  const [payFrequency, setPayFrequency] = useState('monthly');
  const [payWeekDay, setPayWeekDay] = useState(5);
  const [startDate, setStartDate] = useState(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [syncPassword, setSyncPassword] = useState('');
  const [syncLoading, setSyncLoading] = useState(false);
  const [showExportPassword, setShowExportPassword] = useState(false);
  const [showImportPassword, setShowImportPassword] = useState(false);
  const [hasBiometrics, setHasBiometrics] = useState(false);
  const [pendingImportData, setPendingImportData] = useState<Uint8Array | null>(null);

  useEffect(() => {
    loadPay();
    LocalAuthentication.hasHardwareAsync().then(setHasBiometrics);
  }, []);

  async function loadPay() {
    const month = getCurrentMonth();
    const info = await getPayForMonth(month);
    if (info.amount > 0) {
      setPayAmount(info.amount.toString());
      setPayFrequency(info.frequency);
      if (info.frequency === 'weekly' && info.weekDay != null) {
        setPayWeekDay(info.weekDay);
        if (info.startDate) {
          setStartDate(new Date(info.startDate + 'T00:00:00'));
        }
      } else {
        setPayDate(String(info.payDate));
      }
    }
    setLoading(false);
  }

  async function handleSavePay() {
    const sanitized = payAmount.replace(/[^0-9.]/g, '');
    const amount = parseFloat(sanitized);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid', 'Please enter a valid pay amount');
      return;
    }
    if (payFrequency === 'monthly') {
      const day = parseInt(payDate, 10);
      if (isNaN(day) || day < 1 || day > 31) {
        Alert.alert('Invalid', 'Please enter a valid day (1-31)');
        return;
      }
      await setPay(amount, getCurrentMonth(), day, 'monthly');
    } else {
      await setPay(amount, getCurrentMonth(), payWeekDay, 'weekly', payWeekDay, startDate.toISOString().slice(0, 10));
    }
    Alert.alert('Saved', 'Your pay has been updated');
  }

  async function handleExportWithPassword() {
    if (!syncPassword) {
      Alert.alert('Password required', 'Enter a password to encrypt the backup');
      return;
    }
    if (syncPassword.length < 4) {
      Alert.alert('Password too short', 'Use at least 4 characters');
      return;
    }
    setSyncLoading(true);
    try {
      const data = await exportData(syncPassword);
      await exportFile(data);
      setExportModalVisible(false);
      setSyncPassword('');
      Alert.alert('Exported', 'Your data has been exported');
    } catch (e: any) {
      Alert.alert('Export failed', e.message || 'Unknown error');
    } finally {
      setSyncLoading(false);
    }
  }

  async function handleExportWithBiometric() {
    setSyncLoading(true);
    try {
      const existing = await getBiometricKey();
      if (!existing) {
        await createBiometricKey();
      }
      const data = await exportData();
      await exportFile(data);
      Alert.alert('Exported', 'Your data has been encrypted with biometric key');
    } catch (e: any) {
      Alert.alert('Export failed', e.message || 'Unknown error');
    } finally {
      setSyncLoading(false);
    }
  }

  async function handleImport() {
    setSyncLoading(true);
    try {
      const fileData = await importFile();
      if (!fileData) {
        setSyncLoading(false);
        return;
      }

      if (fileData.length < 5) {
        Alert.alert('Invalid file', 'Corrupted or unsupported backup file');
        setSyncLoading(false);
        return;
      }

      const keySource = fileData[4];

      if (keySource === 0) {
        setPendingImportData(fileData);
        setImportModalVisible(true);
        setSyncLoading(false);
        return;
      }

      const existing = await getBiometricKey();
      if (!existing) {
        Alert.alert('No key found', 'Set up biometric export first, or use a password-encrypted backup');
        setSyncLoading(false);
        return;
      }

      await importData(fileData);
      Alert.alert('Imported', 'Your data has been restored');
    } catch (e: any) {
      Alert.alert('Import failed', e.message || 'Unknown error');
    } finally {
      setSyncLoading(false);
    }
  }

  async function handleImportWithPassword() {
    if (!syncPassword) {
      Alert.alert('Password required', 'Enter the password used during export');
      return;
    }
    if (!pendingImportData) {
      Alert.alert('No file', 'Please select a backup file first');
      return;
    }
    setSyncLoading(true);
    try {
      await importData(pendingImportData, syncPassword);
      setImportModalVisible(false);
      setSyncPassword('');
      setPendingImportData(null);
      Alert.alert('Imported', 'Your data has been restored');
    } catch (e: any) {
      Alert.alert('Import failed', e.message || 'Wrong password or corrupted file');
    } finally {
      setSyncLoading(false);
    }
  }

  if (loading) return null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: theme.text }]}>Settings</Text>

        {/* Pay section */}
        <Text style={[styles.section, { color: theme.textSecondary }]}>PAY</Text>

        <Text style={[styles.label, { color: theme.textSecondary }]}>Frequency</Text>
        <View style={styles.modeRow}>
          {(['monthly', 'weekly'] as const).map(freq => (
            <TouchableOpacity
              key={freq}
              style={[
                styles.modeButton,
                {
                  backgroundColor: payFrequency === freq ? theme.positive : theme.card,
                  borderColor: theme.cardBorder,
                },
              ]}
              onPress={() => setPayFrequency(freq)}
            >
              <Text style={[styles.modeText, { color: payFrequency === freq ? '#ffffff' : theme.textSecondary }]}>
                {freq.charAt(0).toUpperCase() + freq.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.label, { color: theme.textSecondary }]}>
          {payFrequency === 'monthly' ? `Monthly Pay (${getMonthLabel(getCurrentMonth())})` : 'Weekly Pay Amount'}
        </Text>
        <View style={[styles.inputRow, { borderBottomColor: theme.cardBorder }]}>
          <TextInput
            style={[styles.input, { color: theme.text, borderBottomColor: theme.cardBorder, paddingBottom: 0, borderBottomWidth: 0 }]}
            value={payAmount ? `${getCurrencySymbol(currency)}${payAmount}` : ''}
            onChangeText={v => {
              const stripped = v.replace(new RegExp(`[^0-9.]`, 'g'), '');
              setPayAmount(stripped);
            }}
            keyboardType="numeric"
            placeholder="0.00"
            placeholderTextColor={theme.textTertiary}
          />
        </View>

        {payFrequency === 'monthly' ? (
          <>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Pay Day</Text>
            <TextInput
              style={[styles.input, { color: theme.text, borderBottomColor: theme.cardBorder }]}
              value={payDate}
              onChangeText={setPayDate}
              keyboardType="number-pad"
              placeholder="1-31"
              placeholderTextColor={theme.textTertiary}
            />
          </>
        ) : (
          <>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Pay Day of Week</Text>
            <View style={styles.weekdayRow}>
              {WEEKDAYS.map((name, i) => (
                <TouchableOpacity
                  key={name}
                  style={[
                    styles.weekdayButton,
                    {
                      backgroundColor: payWeekDay === i ? theme.positive : theme.card,
                      borderColor: theme.cardBorder,
                    },
                  ]}
                  onPress={() => setPayWeekDay(i)}
                >
                  <Text style={[styles.weekdayText, { color: payWeekDay === i ? '#ffffff' : theme.textSecondary }]}>
                    {name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Start Date</Text>
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
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onValueChange={(_: any, selected?: Date) => {
                  setShowStartPicker(Platform.OS === 'ios');
                  if (selected) setStartDate(selected);
                }}
              />
            )}
          </>
        )}

        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.positive }]}
          onPress={handleSavePay}
        >
          <Text style={[styles.buttonText, { color: '#ffffff' }]}>Save Pay</Text>
        </TouchableOpacity>

        {/* Currency section */}
        <Text style={[styles.section, { color: theme.textSecondary, marginTop: 40 }]}>CURRENCY</Text>
        <View style={styles.currencyGrid}>
          {CURRENCY_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.code}
              style={[
                styles.currencyButton,
                {
                  backgroundColor: currency === opt.code ? theme.positive : theme.card,
                  borderColor: theme.cardBorder,
                },
              ]}
              onPress={() => updateCurrency(opt.code as CurrencyCode)}
            >
              <Text style={[styles.currencySymbol, { color: currency === opt.code ? '#ffffff' : theme.text }]}>
                {opt.symbol}
              </Text>
              <Text style={[styles.currencyLabel, { color: currency === opt.code ? '#ffffff' : theme.textSecondary }]}>
                {opt.code}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Theme section */}
        <Text style={[styles.section, { color: theme.textSecondary, marginTop: 40 }]}>THEME</Text>

        <Text style={[styles.label, { color: theme.textSecondary }]}>Mode</Text>
        <View style={styles.modeRow}>
          {(['dark', 'light', 'system'] as const).map(mode => (
            <TouchableOpacity
              key={mode}
              style={[
                styles.modeButton,
                {
                  backgroundColor: rawSettings.mode === mode ? theme.positive : theme.card,
                  borderColor: theme.cardBorder,
                },
              ]}
              onPress={() => updateMode(mode)}
            >
              <Text
                style={[
                  styles.modeText,
                  { color: rawSettings.mode === mode ? '#ffffff' : theme.textSecondary },
                ]}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {Platform.OS === 'android' && (
          <View style={styles.switchRow}>
            <Text style={[styles.label, { color: theme.textSecondary, marginBottom: 0, flex: 1 }]}>
              Use Android system colours
            </Text>
            <Switch
              value={rawSettings.useAndroidSystem}
              onValueChange={toggleAndroidSystem}
              trackColor={{ false: theme.cardBorder, true: theme.positive }}
              thumbColor="#ffffff"
            />
          </View>
        )}

        <Text style={[styles.label, { color: theme.textSecondary, marginTop: 16 }]}>Colours</Text>
        {COLOR_KEYS.map(({ key, label }) => (
          <ColorPickerRow
            key={key}
            label={label}
            color={theme[key]}
            onColor={hex => updateColor(key, hex)}
            theme={theme}
          />
        ))}

        <TouchableOpacity
          style={[styles.resetButton, { borderColor: theme.negative }]}
          onPress={() => {
            Alert.alert('Reset Theme', 'Reset all colours to defaults?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Reset', style: 'destructive', onPress: resetTheme },
            ]);
          }}
        >
          <Text style={[styles.resetText, { color: theme.negative }]}>Reset Theme to Defaults</Text>
        </TouchableOpacity>

        {/* Data Export/Import */}
        <Text style={[styles.section, { color: theme.textSecondary, marginTop: 40 }]}>DATA</Text>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.positive }]}
          onPress={() => setExportModalVisible(true)}
        >
          <Text style={[styles.buttonText, { color: '#ffffff' }]}>Export Backup</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.card, borderColor: theme.cardBorder, borderWidth: 1 }]}
          onPress={handleImport}
        >
          <Text style={[styles.buttonText, { color: theme.text }]}>Import Backup</Text>
        </TouchableOpacity>

        <Modal visible={exportModalVisible} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Export Backup</Text>

              <Text style={[styles.label, { color: theme.textSecondary }]}>Password (at least 4 characters)</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={[styles.passwordInput, { color: theme.text }]}
                  value={syncPassword}
                  onChangeText={setSyncPassword}
                  placeholder="Enter password"
                  placeholderTextColor={theme.textTertiary}
                  secureTextEntry={!showExportPassword}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowExportPassword(!showExportPassword)}
                >
                  <Ionicons
                    name={showExportPassword ? 'eye-outline' : 'eye-off-outline'}
                    size={22}
                    color={theme.textSecondary}
                  />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.button, { backgroundColor: theme.positive }]}
                onPress={handleExportWithPassword}
                disabled={syncLoading}
              >
                <Text style={[styles.buttonText, { color: '#ffffff' }]}>
                  {syncLoading ? 'Exporting…' : 'Export with Password'}
                </Text>
              </TouchableOpacity>

              {hasBiometrics && (
                <TouchableOpacity
                  style={[styles.button, { backgroundColor: theme.card, borderColor: theme.cardBorder, borderWidth: 1 }]}
                  onPress={handleExportWithBiometric}
                  disabled={syncLoading}
                >
                  <Text style={[styles.buttonText, { color: theme.text }]}>
                    {syncLoading ? 'Exporting…' : 'Export with Biometric'}
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.button, { backgroundColor: theme.card }]}
                onPress={() => { setExportModalVisible(false); setSyncPassword(''); }}
              >
                <Text style={[styles.buttonText, { color: theme.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <Modal visible={importModalVisible} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Enter Password</Text>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Password used during export</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={[styles.passwordInput, { color: theme.text }]}
                  value={syncPassword}
                  onChangeText={setSyncPassword}
                  placeholder="Enter password"
                  placeholderTextColor={theme.textTertiary}
                  secureTextEntry={!showImportPassword}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowImportPassword(!showImportPassword)}
                >
                  <Ionicons
                    name={showImportPassword ? 'eye-outline' : 'eye-off-outline'}
                    size={22}
                    color={theme.textSecondary}
                  />
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: theme.positive }]}
                onPress={handleImportWithPassword}
                disabled={syncLoading}
              >
                <Text style={[styles.buttonText, { color: '#ffffff' }]}>
                  {syncLoading ? 'Importing…' : 'Import'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: theme.card }]}
                onPress={() => { setImportModalVisible(false); setSyncPassword(''); setPendingImportData(null); }}
              >
                <Text style={[styles.buttonText, { color: theme.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* About */}
        <View style={[styles.about, { borderTopColor: theme.cardBorder }]}>
          <Text style={[styles.aboutTitle, { color: theme.text }]}>About</Text>
          <Text style={[styles.aboutText, { color: theme.textSecondary }]}>
            month2month {'\u2014'} a local-only monthly budget tracker.{'\n\n'}
            All data is stored on-device. No servers, no accounts, no tracking.{'\n\n'}
            Licensed under GPLv3.
          </Text>
          <Text style={[styles.versionText, { color: theme.textTertiary }]}>
            v{APP_VERSION}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.card, borderColor: theme.negative, borderWidth: 1, marginTop: 40 }]}
          onPress={() => {
            Alert.alert(
              'Delete All Data',
              'This will permanently delete all your bills, income, pay, and settings. This cannot be undone.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete Everything',
                  style: 'destructive',
                  onPress: async () => {
                    await resetAllData();
                    Alert.alert('Deleted', 'All data has been removed. Restart the app to begin fresh.');
                  },
                },
              ],
            );
          }}
        >
          <Text style={[styles.buttonText, { color: theme.negative }]}>Delete All Data</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  currencyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  currencyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  currencySymbol: {
    fontSize: 18,
    fontWeight: '700',
  },
  currencyLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  container: {
    flex: 1,
  },
  content: {
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 24,
  },
  section: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.5,
    marginBottom: 12,
  },
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
  input: {
    flex: 1,
    fontSize: 24,
    borderBottomWidth: 2,
    paddingBottom: 8,
    marginBottom: 24,
  },
  button: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '600',
  },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
  },
  modeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  weekdayRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 24,
  },
  weekdayButton: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  weekdayText: {
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
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  resetButton: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    marginTop: 16,
  },
  resetText: {
    fontSize: 14,
    fontWeight: '600',
  },
  about: {
    borderTopWidth: 1,
    paddingTop: 24,
    marginTop: 40,
  },
  aboutTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  aboutText: {
    fontSize: 14,
    lineHeight: 20,
  },
  versionText: {
    fontSize: 13,
    marginTop: 16,
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
});
