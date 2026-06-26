import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@expo/ui/community/datetime-picker';
import ColorPickerRow from '../../components/ColorPickerRow';
import PayEditor from '../../components/PayEditor';
import LockSetup from '../../components/LockSetup';
import WebDateInput from '../../components/WebDateInput';
import { useTheme, type ThemeColors } from '../../components/ThemeContext';
import { useAppLock } from '../../hooks/useAppLock';
import { getCurrentMonth, getPayForMonth, resetAllData, setPay, getHolidays, addHoliday, updateHoliday, removeHoliday } from '../../db';
import type { Holiday } from '../../db';
import { CURRENCY_OPTIONS, type CurrencyCode } from '../../utils/currency';
import { exportFile, importFile } from '../../utils/fileIO';
import { capitalize, formatDateLocal } from '../../utils/helpers';
import { createBiometricKey, exportData, getBiometricKey, importData } from '../../utils/sync';

const APP_VERSION = Constants.expoConfig?.version || '0.0.0';

const cardAnimation = {
  animationName: {
    from: { opacity: 0, transform: [{ translateY: 10 }] },
    to: { opacity: 1, transform: [{ translateY: 0 }] },
  },
  animationDuration: '400ms',
  animationTimingFunction: 'ease-out',
  animationFillMode: 'backwards' as const,
};

const COLOR_KEYS: { key: keyof ThemeColors; label: string }[] = [
  { key: 'positive', label: 'Positive (income)' },
  { key: 'negative', label: 'Negative (bills)' },
  { key: 'background', label: 'Background' },
  { key: 'card', label: 'Card' },
  { key: 'cardBorder', label: 'Card Border' },
  { key: 'text', label: 'Text' },
  { key: 'textSecondary', label: 'Muted Text' },
  { key: 'textTertiary', label: 'Placeholder Text' },
];

export default function SettingsScreen() {
  const router = useRouter();
  const { theme, rawSettings, currency, updateColor, updateMode, toggleAndroidSystem, resetTheme, updateCurrency } = useTheme();
  const lock = useAppLock();
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(28);
  const [payFrequency, setPayFrequency] = useState<'monthly' | 'weekly'>('monthly');
  const [startDate, setStartDate] = useState(new Date());
  const [payAdjustment, setPayAdjustment] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [syncPassword, setSyncPassword] = useState('');
  const [syncLoading, setSyncLoading] = useState(false);
  const [showExportPassword, setShowExportPassword] = useState(false);
  const [showImportPassword, setShowImportPassword] = useState(false);
  const [hasBiometrics, setHasBiometrics] = useState(false);
  const [pendingImportData, setPendingImportData] = useState<Uint8Array | null>(null);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [lockModalVisible, setLockModalVisible] = useState(false);
  const [lockUseBiometrics, setLockUseBiometrics] = useState(false);

  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [addHolidayModalVisible, setAddHolidayModalVisible] = useState(false);
  const [editHolidayId, setEditHolidayId] = useState<number | null>(null);
  const [holidayFormDate, setHolidayFormDate] = useState(new Date());
  const [holidayFormName, setHolidayFormName] = useState('');
  const [holidayFormRecurring, setHolidayFormRecurring] = useState(true);
  const [holidayFormAffectsPay, setHolidayFormAffectsPay] = useState(true);

  useEffect(() => {
    loadPay();
    if (Platform.OS !== 'web') {
      LocalAuthentication.hasHardwareAsync().then(setHasBiometrics);
    }
  }, []);

  async function loadPay() {
    const month = getCurrentMonth();
    const info = await getPayForMonth(month);
    if (info.amount > 0) {
      setPayAmount(info.amount.toString());
      setPayFrequency(info.frequency as 'monthly' | 'weekly');
      setPayAdjustment(info.adjustment);
      if (info.frequency === 'weekly') {
        if (info.startDate) {
          setStartDate(new Date(info.startDate + 'T00:00:00'));
        }
      } else {
        setPayDate(info.payDate);
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
      if (payDate < 0 || payDate > 31) {
        Alert.alert('Invalid', 'Please select a valid day');
        return;
      }
      await setPay(amount, getCurrentMonth(), payDate, 'monthly', undefined, undefined, payAdjustment);
    } else {
      await setPay(amount, getCurrentMonth(), startDate.getDate(), 'weekly', startDate.getDay(), startDate.toISOString().slice(0, 10), payAdjustment);
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

  useEffect(() => {
    getHolidays().then(setHolidays);
  }, []);

  function resetHolidayForm(date?: Date) {
    setHolidayFormDate(date || new Date());
    setHolidayFormName('');
    setHolidayFormRecurring(true);
    setHolidayFormAffectsPay(true);
  }

  function startEditHoliday(h: Holiday) {
    setEditHolidayId(prev => prev === h.id ? null : h.id);
    setHolidayFormDate(new Date(h.date + 'T00:00:00'));
    setHolidayFormName(h.name);
    setHolidayFormRecurring(!!h.recurring);
    setHolidayFormAffectsPay(!!h.affectsPay);
  }

  async function handleSaveHoliday() {
    const dateStr = formatDateLocal(holidayFormDate);
    if (editHolidayId != null) {
      await updateHoliday(editHolidayId, dateStr, holidayFormName, holidayFormRecurring, holidayFormAffectsPay);
    } else {
      await addHoliday(dateStr, holidayFormName, holidayFormRecurring, holidayFormAffectsPay);
    }
    setHolidays(await getHolidays());
    setEditHolidayId(null);
    setAddHolidayModalVisible(false);
  }

  async function handleDeleteHoliday(id: number) {
    await removeHoliday(id);
    setHolidays(await getHolidays());
    if (editHolidayId === id) setEditHolidayId(null);
  }

  function cardCss(delay: number) {
    return {
      backgroundColor: theme.card,
      borderColor: theme.cardBorder,
      borderWidth: 1,
      borderRadius: 12,
      padding: 16,
      marginBottom: 24,
      boxShadow: [{ offsetX: 0, offsetY: 4, blurRadius: 12, color: 'rgba(0,0,0,0.3)' }],
      ...cardAnimation,
      animationDelay: `${delay}ms`,
    };
  }

  if (loading) return null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: theme.text }]}>Settings</Text>

        <View style={cardCss(0)}>
          <Text style={[styles.section, { color: theme.textSecondary }]}>PAY</Text>

          <PayEditor
            amount={payAmount}
            frequency={payFrequency}
            monthlyDay={payDate}
            startDate={startDate}
            currency={currency}
            adjustment={payAdjustment}
            onAmountChange={setPayAmount}
            onFrequencyChange={setPayFrequency}
            onMonthlyDayChange={setPayDate}
            onStartDateChange={setStartDate}
            onAdjustmentChange={setPayAdjustment}
          />

          <TouchableOpacity
            style={[styles.button, { backgroundColor: theme.positive }]}
            onPress={handleSavePay}
          >
            <Text style={[styles.buttonText, { color: '#ffffff' }]}>Save Pay</Text>
          </TouchableOpacity>
        </View>

        <View style={cardCss(80)}>
          <Text style={[styles.section, { color: theme.textSecondary }]}>CURRENCY</Text>
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
        </View>

        <View style={cardCss(160)}>
          <Text style={[styles.section, { color: theme.textSecondary }]}>THEME</Text>

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
                  {capitalize(mode)}
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
        </View>

        <View style={cardCss(240)}>
          <Text style={[styles.section, { color: theme.textSecondary }]}>APP LOCK</Text>

          <View style={styles.switchRow}>
            <Text style={{ color: theme.text, fontSize: 15, flex: 1 }}>App Lock</Text>
            <Switch
              value={lock.enabled}
              onValueChange={async enabled => {
                if (enabled) {
                  setLockUseBiometrics(lock.useBiometrics);
                  setLockModalVisible(true);
                } else {
                  await lock.disableLock();
                }
              }}
              trackColor={{ false: theme.cardBorder, true: theme.positive }}
              thumbColor="#ffffff"
            />
          </View>

          {lock.enabled && (
            <>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: theme.card, borderColor: theme.cardBorder, borderWidth: 1 }]}
                onPress={() => { setLockUseBiometrics(lock.useBiometrics); setLockModalVisible(true); }}
              >
                <Text style={[styles.buttonText, { color: theme.text }]}>
                  {lock.enabled ? 'Change PIN' : 'Set PIN'}
                </Text>
              </TouchableOpacity>

              {lock.biometricsAvailable && (
                <View style={styles.switchRow}>
                  <Text style={{ color: theme.text, fontSize: 15, flex: 1 }}>
                    Use {Platform.OS === 'ios' ? 'Face ID' : 'Fingerprint'}
                  </Text>
                  <Switch
                    value={lock.useBiometrics}
                    onValueChange={lock.setBiometricsEnabled}
                    trackColor={{ false: theme.cardBorder, true: theme.positive }}
                    thumbColor="#ffffff"
                  />
                </View>
              )}
            </>
          )}
        </View>

        <View style={cardCss(320)}>
          <Text style={[styles.section, { color: theme.textSecondary }]}>CUSTOM HOLIDAYS</Text>

          {holidays.length === 0 && (
            <Text style={[styles.emptyText, { color: theme.textTertiary }]}>
              No custom holidays added.
            </Text>
          )}

          {holidays.map(holiday => (
            <View key={holiday.id}>
              <TouchableOpacity
                style={[styles.holidayRow, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
                onPress={() => startEditHoliday(holiday)}
                activeOpacity={0.7}
              >
                <View style={styles.holidayInfo}>
                  <Text style={[{ color: theme.text, fontSize: 15 }]}>
                    {holiday.date}
                    {holiday.name ? `  ${holiday.name}` : ''}
                  </Text>
                </View>
                <View style={styles.holidayBadges}>
                  {holiday.recurring ? (
                    <Text style={[{ color: theme.positive, fontSize: 12, fontWeight: '600' }]}>Annual</Text>
                  ) : null}
                  {holiday.affectsPay ? (
                    <Text style={[{ color: theme.textSecondary, fontSize: 12, fontWeight: '600', marginLeft: 8 }]}>Shifts</Text>
                  ) : null}
                </View>
                <TouchableOpacity onPress={() => handleDeleteHoliday(holiday.id)} hitSlop={8}>
                  <Ionicons name="close-circle" size={20} color={theme.negative} />
                </TouchableOpacity>
              </TouchableOpacity>

              {editHolidayId === holiday.id && (
                <View style={[styles.holidayEditForm, { backgroundColor: theme.background, borderColor: theme.cardBorder }]}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>Date</Text>
                  {Platform.OS === 'web' ? (
                    <WebDateInput
                      value={holidayFormDate}
                      onChange={d => setHolidayFormDate(d)}
                    />
                  ) : (
                    <DateTimePicker
                      value={holidayFormDate}
                      mode="date"
                      presentation="dialog"
                      onChange={(_e: any, d?: Date) => d && setHolidayFormDate(d)}
                    />
                  )}

                  <Text style={[styles.label, { color: theme.textSecondary, marginTop: 12 }]}>Name (optional)</Text>
                  <TextInput
                    style={[styles.holidayInput, { color: theme.text, borderColor: theme.cardBorder }]}
                    value={holidayFormName}
                    onChangeText={setHolidayFormName}
                    placeholder="e.g. Independence Day"
                    placeholderTextColor={theme.textTertiary}
                  />

                  <View style={styles.switchRow}>
                    <Text style={[{ color: theme.text, fontSize: 15 }]}>Repeats annually</Text>
                    <Switch
                      value={holidayFormRecurring}
                      onValueChange={setHolidayFormRecurring}
                      trackColor={{ false: theme.cardBorder, true: theme.positive }}
                      thumbColor="#ffffff"
                    />
                  </View>

                  <View style={styles.switchRow}>
                    <Text style={[{ color: theme.text, fontSize: 15 }]}>Shifts pay & bills</Text>
                    <Switch
                      value={holidayFormAffectsPay}
                      onValueChange={setHolidayFormAffectsPay}
                      trackColor={{ false: theme.cardBorder, true: theme.positive }}
                      thumbColor="#ffffff"
                    />
                  </View>

                  <View style={styles.holidayEditButtons}>
                    <TouchableOpacity
                      style={[styles.button, { backgroundColor: theme.positive, flex: 1 }]}
                      onPress={handleSaveHoliday}
                    >
                      <Text style={[styles.buttonText, { color: '#ffffff' }]}>Save</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.button, { backgroundColor: theme.card, borderColor: theme.cardBorder, borderWidth: 1, flex: 1, marginLeft: 8 }]}
                      onPress={() => setEditHolidayId(null)}
                    >
                      <Text style={[styles.buttonText, { color: theme.textSecondary }]}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          ))}

          <TouchableOpacity
            style={[styles.button, { backgroundColor: theme.card, borderColor: theme.cardBorder, borderWidth: 1 }]}
            onPress={() => { resetHolidayForm(); setEditHolidayId(null); setAddHolidayModalVisible(true); }}
          >
            <Text style={[styles.buttonText, { color: theme.text }]}>+ Add Holiday</Text>
          </TouchableOpacity>
        </View>

        <Modal visible={addHolidayModalVisible} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Add Holiday</Text>

              <Text style={[styles.label, { color: theme.textSecondary }]}>Date</Text>
              {Platform.OS === 'web' ? (
                <WebDateInput
                  value={holidayFormDate}
                  onChange={d => setHolidayFormDate(d)}
                />
              ) : (
                <DateTimePicker
                  value={holidayFormDate}
                  mode="date"
                  presentation="dialog"
                  onChange={(_e: any, d?: Date) => d && setHolidayFormDate(d)}
                />
              )}

              <Text style={[styles.label, { color: theme.textSecondary, marginTop: 12 }]}>Name (optional)</Text>
              <TextInput
                style={[styles.holidayInput, { color: theme.text, borderColor: theme.cardBorder }]}
                value={holidayFormName}
                onChangeText={setHolidayFormName}
                placeholder="e.g. Independence Day"
                placeholderTextColor={theme.textTertiary}
              />

              <View style={styles.switchRow}>
                <Text style={[{ color: theme.text, fontSize: 15 }]}>Repeats annually</Text>
                <Switch
                  value={holidayFormRecurring}
                  onValueChange={setHolidayFormRecurring}
                  trackColor={{ false: theme.cardBorder, true: theme.positive }}
                  thumbColor="#ffffff"
                />
              </View>

              <View style={styles.switchRow}>
                <Text style={[{ color: theme.text, fontSize: 15 }]}>Shifts pay & bills</Text>
                <Switch
                  value={holidayFormAffectsPay}
                  onValueChange={setHolidayFormAffectsPay}
                  trackColor={{ false: theme.cardBorder, true: theme.positive }}
                  thumbColor="#ffffff"
                />
              </View>

              <TouchableOpacity
                style={[styles.button, { backgroundColor: theme.positive }]}
                onPress={handleSaveHoliday}
              >
                <Text style={[styles.buttonText, { color: '#ffffff' }]}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: theme.card }]}
                onPress={() => setAddHolidayModalVisible(false)}
              >
                <Text style={[styles.buttonText, { color: theme.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <View style={cardCss(400)}>
          <Text style={[styles.section, { color: theme.textSecondary }]}>DATA</Text>

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
        </View>

        <View style={cardCss(480)}>
          <Text style={[styles.section, { color: theme.textSecondary }]}>ABOUT</Text>
          <Text style={[styles.aboutText, { color: theme.textSecondary }]}>
            month2month {'\u2014'} a local-only monthly budget tracker.{'\n\n'}
            All data is stored on-device. No servers, no accounts, no tracking.{'\n\n'}
            Licensed under GPLv3.
          </Text>
          <Text style={[styles.versionText, { color: theme.textTertiary }]}>
            v{APP_VERSION}
          </Text>

          {Platform.OS === 'web' && (
            <TouchableOpacity onPress={() => router.push('/privacy-policy')}>
              <Text style={[styles.privacyLink, { color: theme.textSecondary }]}>
                Privacy Policy
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={{ ...cardCss(560), borderColor: theme.negative }}>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: theme.card, borderColor: theme.negative, borderWidth: 1, marginTop: 0 }]}
            onPress={() => setDeleteModalVisible(true)}
          >
            <Text style={[styles.buttonText, { color: theme.negative }]}>Delete All Data</Text>
          </TouchableOpacity>
        </View>

        <Modal visible={deleteModalVisible} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Delete All Data</Text>
              <Text style={[styles.label, { color: theme.textSecondary }]}>
                This will permanently delete all your bills, income, pay, and settings. This cannot be undone.
              </Text>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: theme.negative, marginTop: 20 }]}
                onPress={async () => {
                  setDeleteModalVisible(false);
                  await new Promise(r => setTimeout(r, 100));
                  await resetAllData();
                  if (Platform.OS === 'web') {
                    window.location.href = '/onboarding/step-1';
                  } else {
                    router.replace('/onboarding/step-1');
                  }
                }}
              >
                <Text style={[styles.buttonText, { color: '#ffffff' }]}>Delete Everything</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: theme.card }]}
                onPress={() => setDeleteModalVisible(false)}
              >
                <Text style={[styles.buttonText, { color: theme.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Lock setup modal */}
        <Modal visible={lockModalVisible} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
              <LockSetup
                onSetPin={async (pin) => {
                  await lock.setPin(pin);
                  if (lockUseBiometrics) {
                    await lock.setBiometricsEnabled(true);
                  }
                  setLockModalVisible(false);
                }}
                onSkip={() => setLockModalVisible(false)}
                biometricsAvailable={lock.biometricsAvailable}
                useBiometrics={lockUseBiometrics}
                onBiometricsChange={setLockUseBiometrics}
                cancelLabel="Cancel"
              />
            </View>
          </View>
        </Modal>
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
  aboutText: {
    fontSize: 14,
    lineHeight: 20,
  },
  versionText: {
    fontSize: 13,
    marginTop: 16,
  },
  privacyLink: {
    fontSize: 14,
    marginTop: 16,
    textDecorationLine: 'underline',
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
    boxShadow: [{ offsetX: 0, offsetY: 8, blurRadius: 32, color: 'rgba(0,0,0,0.4)' }],
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 14,
    marginBottom: 12,
  },
  holidayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  holidayInfo: {
    flex: 1,
  },
  holidayBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  holidayEditForm: {
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
    marginTop: -4,
  },
  holidayInput: {
    fontSize: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 16,
  },
  holidayEditButtons: {
    flexDirection: 'row',
    marginTop: 8,
  },
});
