import DateTimePicker from '@react-native-community/datetimepicker';
import WebDateInput from '../components/WebDateInput';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect, useCallback } from 'react';
import {
  Alert,
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
import { useTheme } from '../components/ThemeContext';
import {
  addBill,
  getBill,
  updateBill,
  deleteBill,
  monthFromDate,
  getAdjacentMonths,
  getCurrentMonth,
  getMonthLabel,
  getLabels,
  getOrCreateLabel,
} from '../db';
import type { Label } from '../db';
import { getCurrencySymbol } from '../utils/currency';
import { LABEL_COLORS } from '../utils/colors';
import { capitalize, formatDateLocal } from '../utils/helpers';

type EntryType = 'expense' | 'income';

export default function AddScreen() {
  const { theme, currency } = useTheme();
  const router = useRouter();
  const { type: rawType, id: rawId } = useLocalSearchParams<{ type: string; id?: string }>();
  const editId = rawId ? parseInt(rawId, 10) : null;
  const isEditing = editId !== null;

  const [entryType, setEntryType] = useState<EntryType>(rawType === 'income' ? 'income' : 'expense');
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [date, setDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [showStartMonthPicker, setShowStartMonthPicker] = useState(false);
  const [labelId, setLabelId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEditing);
  const [overrideMonth, setOverrideMonth] = useState<string | null>(null);
  const [showOverridePicker, setShowOverridePicker] = useState(false);
  const [frequency, setFrequency] = useState('monthly');
  const [weekDay, setWeekDay] = useState(0);
  const [endMonth, setEndMonth] = useState<string | null>(null);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [adjustment, setAdjustment] = useState(false);
  const [labels, setLabels] = useState<Label[]>([]);
  const [customMode, setCustomMode] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customColor, setCustomColor] = useState<string>(LABEL_COLORS[0]);

  const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const selectedLabel = labels.find(l => l.id === labelId) || null;

  useEffect(() => {
    if (!editId) return;
    getBill(editId).then(bill => {
      if (!bill) return;
      setEntryType((bill.type || 'expense') as EntryType);
      setName(bill.name);
      setAmount(String(bill.amount));
      setIsRecurring(!!bill.isRecurring);
      setLabelId(bill.labelId ?? null);
      setOverrideMonth(bill.overrideMonth || null);
      setFrequency(bill.frequency || 'monthly');
      setWeekDay(bill.weekDay ?? 0);
      setEndMonth(bill.endMonth || null);
      setAdjustment(!!bill.adjustment);
      if (bill.date) {
        setDate(new Date(bill.date + 'T00:00:00'));
      } else if (bill.startMonth) {
        const [y, m] = bill.startMonth.split('-').map(Number);
        setDate(new Date(y, m - 1, bill.dueDay || 1));
      }
      setLoading(false);
    });
  }, [editId]);

  const fetchLabels = useCallback(async () => {
    const result = await getLabels();
    setLabels(result);
    if (!labelId && result.length > 0) {
      setLabelId(result[0].id);
    }
  }, [labelId]);

  useEffect(() => {
    fetchLabels();
  }, [fetchLabels]);

  const availableMonths = getAdjacentMonths(getCurrentMonth(), 1);

  function onDateChange(_: any, selected?: Date) {
    setShowPicker(Platform.OS === 'ios');
    if (selected) setDate(selected);
  }

  async function handleSave() {
    const sanitized = amount.replace(/[^0-9.]/g, '');
    const parsedAmount = parseFloat(sanitized);
    if (saving) return;
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Invalid', 'Please enter a valid amount');
      return;
    }

    const cat = selectedLabel?.name.toLowerCase() || 'other';
    setSaving(true);

    if (isEditing) {
      await updateBill(
        editId,
        name || 'Untitled',
        parsedAmount,
        isRecurring,
        isRecurring ? undefined : formatDateLocal(date),
        isRecurring ? monthFromDate(formatDateLocal(date)) : undefined,
        isRecurring && frequency === 'monthly' ? date.getDate() : undefined,
        cat,
        isRecurring ? frequency : undefined,
        isRecurring ? weekDay : undefined,
        overrideMonth,
        entryType,
        isRecurring ? endMonth : null,
        adjustment,
      );
    } else if (isRecurring) {
      const startMonth = monthFromDate(formatDateLocal(date));
      await addBill(
        name || 'Untitled', parsedAmount, true, undefined, startMonth,
        frequency === 'monthly' ? date.getDate() : undefined, cat,
        frequency, frequency === 'weekly' ? weekDay : undefined, entryType, endMonth, adjustment,
      );
    } else {
      const dateStr = formatDateLocal(date);
      await addBill(
        name || 'Untitled', parsedAmount, false, dateStr, undefined, undefined, cat,
        undefined, undefined, entryType, undefined, adjustment,
      );
    }

    router.back();
  }

  async function handleDelete() {
    if (!editId) return;
    Alert.alert('Delete', 'Remove this permanently?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteBill(editId);
          router.back();
        },
      },
    ]);
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { borderBottomColor: theme.cardBorder }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={{ color: theme.negative, fontSize: 16 }}>Cancel</Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: theme.text }]}>Edit</Text>
          <View style={{ width: 60 }} />
        </View>
      </SafeAreaView>
    );
  }

  const accentColor = entryType === 'income' ? theme.positive : theme.negative;
  const title = isEditing ? (entryType === 'income' ? 'Edit Income' : 'Edit Bill') : entryType === 'income' ? 'Add Income' : 'Add Bill';
  const buttonText = saving ? 'Saving...' : isEditing ? 'Save Changes' : title;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { borderBottomColor: theme.cardBorder }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: theme.negative, fontSize: 16 }}>Cancel</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.typeToggle}>
          <TouchableOpacity
            style={[
              styles.typeOption,
              { backgroundColor: entryType === 'expense' ? theme.negative : theme.cardBorder },
            ]}
            onPress={() => setEntryType('expense')}
          >
            <Text style={[styles.typeText, { color: entryType === 'expense' ? '#fff' : theme.textSecondary }]}>
              Expense
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.typeOption,
              { backgroundColor: entryType === 'income' ? theme.positive : theme.cardBorder },
            ]}
            onPress={() => setEntryType('income')}
          >
            <Text style={[styles.typeText, { color: entryType === 'income' ? '#fff' : theme.textSecondary }]}>
              Income
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.label, { color: theme.textSecondary }]}>Name</Text>
        <TextInput
          style={[styles.input, { color: theme.text, borderBottomColor: theme.cardBorder }]}
          value={name}
          onChangeText={setName}
          placeholder={entryType === 'income' ? 'Freelance, gift, etc.' : 'Rent, Netflix, etc.'}
          placeholderTextColor={theme.textTertiary}
        />

        <Text style={[styles.label, { color: theme.textSecondary }]}>Amount</Text>
        <View style={[styles.inputRow, { borderBottomColor: theme.cardBorder }]}>
          <View style={styles.poundContainer}>
            <Text style={[styles.pound, { color: theme.text }]}>{getCurrencySymbol(currency)}</Text>
          </View>
          <TextInput
            style={[styles.inputWide, { color: theme.text, paddingLeft: 30 }]}
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
            placeholder="0.00"
            placeholderTextColor={theme.textTertiary}
            autoFocus={!isEditing}
          />
        </View>

        {!isRecurring && (
          <>
            <Text style={[styles.label, { color: theme.textSecondary }]}>
              {entryType === 'income' ? 'Date received' : 'Due date'}
            </Text>
            {Platform.OS === 'web' ? (
              <View style={styles.webDateContainer}>
                <WebDateInput value={date} onChange={(d) => setDate(d)} />
              </View>
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.dateButton, { backgroundColor: theme.card }]}
                  onPress={() => setShowPicker(true)}
                >
                  <Text style={{ color: theme.text, fontSize: 16 }}>
                    {date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </Text>
                </TouchableOpacity>

                {showPicker && (
                  <DateTimePicker
                    value={date}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onValueChange={onDateChange}
                  />
                )}
              </>
            )}
          </>
        )}

        <View style={styles.switchRow}>
          <Text style={{ color: theme.text, fontSize: 15 }}>Recurring</Text>
          <Switch
            value={isRecurring}
            onValueChange={setIsRecurring}
            trackColor={{ false: theme.cardBorder, true: accentColor }}
            thumbColor="#fff"
          />
        </View>

        <View style={styles.switchRow}>
          <Text style={{ color: theme.text, fontSize: 15, flex: 1, marginRight: 12 }}>
            {entryType === 'income'
              ? 'Move to previous working day on weekends & bank holidays'
              : 'Move to next working day on weekends & bank holidays'}
          </Text>
          <Switch
            value={adjustment}
            onValueChange={setAdjustment}
            trackColor={{ false: theme.cardBorder, true: accentColor }}
            thumbColor="#fff"
          />
        </View>

        {isRecurring && (
          <>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Frequency</Text>
            <View style={styles.modeRow}>
              {(['monthly', 'weekly'] as const).map(f => (
                <TouchableOpacity
                  key={f}
                  style={[
                    styles.modeButton,
                    {
                      backgroundColor: frequency === f ? accentColor : theme.card,
                      borderColor: theme.cardBorder,
                    },
                  ]}
                  onPress={() => setFrequency(f)}
                >
                  <Text style={[styles.modeText, { color: frequency === f ? '#ffffff' : theme.textSecondary }]}>
                    {capitalize(f)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {frequency === 'weekly' && (
              <>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Day of Week</Text>
                <View style={styles.weekdayRow}>
                  {WEEKDAYS.map((name, i) => (
                    <TouchableOpacity
                      key={name}
                      style={[
                        styles.weekdayButton,
                        {
                          backgroundColor: weekDay === i ? accentColor : theme.card,
                          borderColor: theme.cardBorder,
                        },
                      ]}
                      onPress={() => setWeekDay(i)}
                    >
                      <Text style={[styles.weekdayText, { color: weekDay === i ? '#ffffff' : theme.textSecondary }]}>
                        {name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            <Text style={[styles.label, { color: theme.textSecondary }]}>Start month</Text>
            <TouchableOpacity
              style={[styles.overrideRow, { backgroundColor: theme.card }]}
              onPress={() => setShowStartMonthPicker(!showStartMonthPicker)}
            >
              <Text style={{ color: theme.text, fontSize: 15 }}>
                {getMonthLabel(monthFromDate(formatDateLocal(date)))}
              </Text>
              <Text style={{ color: theme.textTertiary, fontSize: 12 }}>
                {showStartMonthPicker ? '▲' : '▼'}
              </Text>
            </TouchableOpacity>

            {showStartMonthPicker && (
              <View style={styles.overrideList}>
                {getAdjacentMonths(getCurrentMonth(), 6).map(m => (
                  <TouchableOpacity
                    key={m}
                    style={[
                      styles.overrideOption,
                      monthFromDate(formatDateLocal(date)) === m && { backgroundColor: theme.cardBorder },
                    ]}
                    onPress={() => {
                      const [y, mon] = m.split('-').map(Number);
                      setDate(new Date(y, mon - 1, date.getDate()));
                      setShowStartMonthPicker(false);
                    }}
                  >
                    <Text style={{ color: theme.text, fontSize: 14, flex: 1 }}>
                      {getMonthLabel(m)}
                    </Text>
                    {monthFromDate(formatDateLocal(date)) === m && (
                      <Text style={{ color: theme.positive, fontSize: 16 }}>✓</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <Text style={[styles.label, { color: theme.textSecondary, marginTop: 8 }]}>End month (optional)</Text>
            <TouchableOpacity
              style={[styles.overrideRow, { backgroundColor: theme.card }]}
              onPress={() => setShowEndPicker(!showEndPicker)}
            >
              <Text style={{ color: theme.text, fontSize: 15 }}>
                {endMonth ? getMonthLabel(endMonth) : 'No end date'}
              </Text>
              <Text style={{ color: theme.textTertiary, fontSize: 12 }}>
                {showEndPicker ? '▲' : '▼'}
              </Text>
            </TouchableOpacity>

            {showEndPicker && (
              <View style={styles.overrideList}>
                <TouchableOpacity
                  style={[
                    styles.overrideOption,
                    endMonth === null && { backgroundColor: theme.cardBorder },
                  ]}
                  onPress={() => { setEndMonth(null); setShowEndPicker(false); }}
                >
                  <Text style={{ color: theme.text, fontSize: 14, flex: 1 }}>No end date</Text>
                  {endMonth === null && (
                    <Text style={{ color: theme.positive, fontSize: 16 }}>✓</Text>
                  )}
                </TouchableOpacity>
                {getAdjacentMonths(monthFromDate(formatDateLocal(date)), 2).map(m => (
                  <TouchableOpacity
                    key={m}
                    style={[
                      styles.overrideOption,
                      endMonth === m && { backgroundColor: theme.cardBorder },
                    ]}
                    onPress={() => { setEndMonth(m); setShowEndPicker(false); }}
                  >
                    <Text style={{ color: theme.text, fontSize: 14, flex: 1 }}>
                      {getMonthLabel(m)}
                    </Text>
                    {endMonth === m && (
                      <Text style={{ color: theme.positive, fontSize: 16 }}>✓</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </>
        )}

        <Text style={[styles.label, { color: theme.textSecondary }]}>Label</Text>
        {customMode ? (
          <View style={styles.customLabelBox}>
            <TextInput
              style={[styles.input, { color: theme.text, borderBottomColor: theme.cardBorder }]}
              value={customName}
              onChangeText={setCustomName}
              placeholder="Label name"
              placeholderTextColor={theme.textTertiary}
              autoFocus
            />
            <Text style={[styles.label, { color: theme.textSecondary, marginTop: 12 }]}>Colour</Text>
            <View style={styles.colorRow}>
              {LABEL_COLORS.map(c => (
                <TouchableOpacity
                  key={c}
                  style={[styles.colorDot, { backgroundColor: c }, customColor === c && styles.colorDotSelected]}
                  onPress={() => setCustomColor(c)}
                />
              ))}
            </View>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: accentColor, marginTop: 12 }]}
              onPress={async () => {
                if (!customName.trim()) return;
                const label = await getOrCreateLabel(customName, customColor);
                setLabels(await getLabels());
                setLabelId(label.id);
                setCustomMode(false);
                setCustomName('');
              }}
            >
              <Text style={styles.buttonText}>Add Label</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setCustomMode(false); setCustomName(''); }}>
              <Text style={{ color: theme.textSecondary, fontSize: 14, textAlign: 'center', marginTop: 8 }}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {labels.map(l => (
              <TouchableOpacity
                key={l.id}
                style={[
                  styles.category,
                  { backgroundColor: labelId === l.id ? (l.color + '30') : theme.card },
                ]}
                onPress={() => setLabelId(l.id)}
              >
                <View style={[styles.labelDot, { backgroundColor: l.color }]} />
                <Text
                  style={[
                    { color: theme.textSecondary, fontSize: 16, marginLeft: 10 },
                    labelId === l.id && { color: theme.text, fontWeight: '600' },
                  ]}
                >
                  {l.name}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.category, { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.cardBorder, borderStyle: 'dashed' }]}
              onPress={() => setCustomMode(true)}
            >
              <Text style={{ color: theme.textSecondary, fontSize: 16, textAlign: 'center' }}>
                + Add custom label
              </Text>
            </TouchableOpacity>
          </>
        )}

        <Text style={[styles.label, { color: theme.textSecondary, marginTop: 8 }]}>Affects month</Text>
        <TouchableOpacity
          style={[styles.overrideRow, { backgroundColor: theme.card }]}
          onPress={() => setShowOverridePicker(!showOverridePicker)}
        >
          <Text style={{ color: theme.text, fontSize: 15 }}>
            {overrideMonth ? getMonthLabel(overrideMonth) : 'Auto (based on date)'}
          </Text>
          <Text style={{ color: theme.textTertiary, fontSize: 12 }}>
            {showOverridePicker ? '▲' : '▼'}
          </Text>
        </TouchableOpacity>

        {showOverridePicker && (
          <View style={styles.overrideList}>
            <TouchableOpacity
              style={[
                styles.overrideOption,
                overrideMonth === null && { backgroundColor: theme.cardBorder },
              ]}
              onPress={() => { setOverrideMonth(null); setShowOverridePicker(false); }}
            >
              <Text style={{ color: theme.text, fontSize: 14, flex: 1 }}>Auto</Text>
              {overrideMonth === null && (
                <Text style={{ color: theme.positive, fontSize: 16 }}>✓</Text>
              )}
            </TouchableOpacity>
            {availableMonths.map(m => (
              <TouchableOpacity
                key={m}
                style={[
                  styles.overrideOption,
                  overrideMonth === m && { backgroundColor: theme.cardBorder },
                ]}
                onPress={() => { setOverrideMonth(m); setShowOverridePicker(false); }}
              >
                <Text style={{ color: theme.text, fontSize: 14, flex: 1 }}>
                  {getMonthLabel(m)}
                </Text>
                {overrideMonth === m && (
                  <Text style={{ color: theme.positive, fontSize: 16 }}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.button,
            { backgroundColor: accentColor },
            (!amount || parseFloat(amount.replace(/[^0-9.]/g, '')) <= 0) && { opacity: 0.3 },
          ]}
          onPress={handleSave}
          disabled={!amount || parseFloat(amount.replace(/[^0-9.]/g, '')) <= 0 || saving}
        >
          <Text style={styles.buttonText}>{buttonText}</Text>
        </TouchableOpacity>

        {isEditing && (
          <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
            <Text style={[styles.deleteButtonText, { color: theme.negative }]}>Delete</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  content: {
    padding: 24,
  },
  typeToggle: {
    flexDirection: 'row',
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 24,
  },
  typeOption: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  typeText: {
    fontSize: 15,
    fontWeight: '600',
  },
  label: {
    fontSize: 14,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 2,
    paddingBottom: 8,
    marginBottom: 24,
  },
  pound: {
    fontSize: 24,
  },
  poundContainer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    width: 28,
    zIndex: 1,
  },
  input: {
    fontSize: 16,
    borderBottomWidth: 2,
    paddingBottom: 8,
    marginBottom: 24,
  },
  inputWide: {
    flex: 1,
    fontSize: 24,
  },
  dateButton: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 24,
  },
  webDateContainer: {
    marginBottom: 24,
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
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 20,
  },
  category: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  labelDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  customLabelBox: {
    marginBottom: 16,
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  colorDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  colorDotSelected: {
    borderWidth: 3,
    borderColor: '#ffffff',
  },
  overrideRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 8,
  },
  overrideList: {
    marginBottom: 16,
  },
  overrideOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 4,
  },
  button: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#ffffff',
  },
  deleteButton: {
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  deleteButtonText: {
    fontSize: 15,
    fontWeight: '500',
  },
});
