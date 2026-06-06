import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, Platform } from 'react-native';
import { useTheme } from './ThemeContext';
import PinInput from './PinInput';

type Props = {
  onSetPin: (pin: string) => Promise<void>;
  onSkip: () => void;
  biometricsAvailable: boolean;
  useBiometrics: boolean;
  onBiometricsChange: (v: boolean) => void;
  saving?: boolean;
  cancelLabel?: string;
};

export default function LockSetup(props: Props) {
  const { theme } = useTheme();
  const [pin, setPin] = useState('');
  const [phase, setPhase] = useState<'set' | 'confirm'>('set');
  const [error, setError] = useState<string | null>(null);
  const { onSetPin, onSkip, biometricsAvailable, useBiometrics, onBiometricsChange, saving, cancelLabel } = props;

  const handleSetPin = (enteredPin: string) => {
    setPin(enteredPin);
    setPhase('confirm');
    setError(null);
  };

  const handleConfirmPin = async (enteredPin: string) => {
    if (enteredPin === pin) {
      await onSetPin(pin);
    } else {
      setError('PINs do not match');
      setTimeout(() => {
        setPin('');
        setPhase('set');
        setError(null);
      }, 2000);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: theme.text }]}>Secure your data?</Text>
      <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
        {phase === 'set' ? 'Set a PIN to lock the app' : 'Confirm your PIN'}
      </Text>

      {phase === 'set' ? (
        <PinInput key="set" length={4} onComplete={handleSetPin} error={error} />
      ) : (
        <PinInput key="confirm" length={4} onComplete={handleConfirmPin} error={error} />
      )}

      {phase === 'set' && biometricsAvailable && (
        <View style={styles.switchRow}>
          <Text style={[styles.switchLabel, { color: theme.text }]}>
            Use {Platform.OS === 'ios' ? 'Face ID' : 'Fingerprint'}
          </Text>
          <Switch
            value={useBiometrics}
            onValueChange={onBiometricsChange}
            trackColor={{ false: theme.cardBorder, true: theme.positive }}
            thumbColor="#ffffff"
          />
        </View>
      )}

      <TouchableOpacity
        style={[styles.button, { backgroundColor: theme.card, borderColor: theme.cardBorder, borderWidth: 1 }]}
        onPress={onSkip}
      >
        <Text style={[styles.buttonText, { color: theme.textSecondary }]}>
          {cancelLabel || 'Skip'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 8,
  },
  switchLabel: {
    fontSize: 15,
  },
  button: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    width: '100%',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
