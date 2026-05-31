import { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useTheme } from './ThemeContext';
import PinInput from './PinInput';
import type { useAppLock } from '../hooks/useAppLock';

type LockState = ReturnType<typeof useAppLock>;

type Props = {
  lock: LockState;
  children: React.ReactNode;
};

export default function AppLock({ lock, children }: Props) {
  const { theme } = useTheme();
  const [mode, setMode] = useState<'loading' | 'pin' | 'unlocked'>('loading');
  const [pinError, setPinError] = useState<string | null>(null);
  const prevLocked = useRef(lock.isLocked);

  useEffect(() => {
    if (lock.loading) return;
    if (!lock.isLocked) {
      setMode('unlocked');
      return;
    }

    const justRelocked = prevLocked.current === false && lock.isLocked === true;
    if (justRelocked && lock.useBiometrics && Platform.OS !== 'web') {
      lock.authenticateWithBiometrics().then(ok => {
        if (ok) setMode('unlocked');
        else setMode('pin');
      });
      prevLocked.current = lock.isLocked;
      return;
    }

    setMode('pin');
  }, [lock.loading, lock.isLocked, lock.useBiometrics]);

  useEffect(() => {
    prevLocked.current = lock.isLocked;
  }, [lock.isLocked]);

  const handlePinComplete = useCallback(
    async (pin: string) => {
      const ok = await lock.verifyPin(pin);
      if (ok) {
        setMode('unlocked');
      } else {
        setPinError('Incorrect PIN');
        setTimeout(() => setPinError(null), 2000);
      }
    },
    [lock.verifyPin],
  );

  if (mode === 'unlocked') {
    return <>{children}</>;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.appName, { color: theme.text }]}>month2month</Text>
      <Text style={[styles.prompt, { color: theme.textSecondary }]}>Enter PIN</Text>

      <PinInput length={lock.pinLength} onComplete={handlePinComplete} error={pinError} />

      {lock.biometricsAvailable && (
        <TouchableOpacity style={styles.bioFallback} onPress={() => {
          lock.authenticateWithBiometrics().then(ok => {
            if (ok) setMode('unlocked');
          });
        }}>
          <Text style={{ color: theme.positive, fontSize: 15 }}>
            Use {Platform.OS === 'ios' ? 'Face ID' : 'Fingerprint'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 32,
    padding: 32,
  },
  appName: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 1,
  },
  prompt: {
    fontSize: 16,
  },
  bioFallback: {
    marginTop: 32,
    padding: 12,
  },
});
