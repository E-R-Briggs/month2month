import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';
import { getSetting, setSetting } from '../db';
import { getItemSecurely, setItemSecurely, deleteItemSecurely } from '../utils/storage';

const PIN_HASH_KEY = 'app_lock_pin_hash';

async function hashPin(pin: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, pin);
}

export function useAppLock() {
  const [isLocked, setIsLocked] = useState(true);
  const [pinLength, setPinLength] = useState(4);
  const [enabled, setEnabled] = useState(false);
  const [useBiometrics, setUseBiometrics] = useState(false);
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const appStateRef = useRef(AppState.currentState);

  useEffect(() => {
    (async () => {
      const lockEnabled = await getSetting('lock_enabled');
      if (lockEnabled !== 'true') {
        setEnabled(false);
        setIsLocked(false);
        setLoading(false);
        return;
      }

      const storedHash = await getItemSecurely(PIN_HASH_KEY);
      if (!storedHash) {
        setEnabled(false);
        setIsLocked(false);
        setLoading(false);
        return;
      }

      if (Platform.OS !== 'web') {
        const [has, enrolled] = await Promise.all([
          LocalAuthentication.hasHardwareAsync(),
          LocalAuthentication.isEnrolledAsync(),
        ]);
        setBiometricsAvailable(has && enrolled);
        const bioPref = await getSetting('lock_use_biometrics');
        setUseBiometrics(bioPref === 'true' && has && enrolled);
      }

      setEnabled(true);
      setIsLocked(true);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', nextState => {
      if (appStateRef.current === 'active' && nextState.match(/inactive|background/)) {
        setIsLocked(true);
      }
      appStateRef.current = nextState;
    });
    return () => sub.remove();
  }, []);

  const verifyPin = useCallback(async (enteredPin: string): Promise<boolean> => {
    const storedHash = await getItemSecurely(PIN_HASH_KEY);
    if (!storedHash) return false;
    const enteredHash = await hashPin(enteredPin);
    if (enteredHash === storedHash) {
      setIsLocked(false);
      return true;
    }
    return false;
  }, []);

  const authenticateWithBiometrics = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'web') return false;
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock month2month',
        disableDeviceFallback: true,
      });
      if (result.success) {
        setIsLocked(false);
        return true;
      }
    } catch {}
    return false;
  }, []);

  const setPin = useCallback(async (pin: string) => {
    const hash = await hashPin(pin);
    await setItemSecurely(PIN_HASH_KEY, hash);
    await setSetting('lock_enabled', 'true');
    setPinLength(pin.length);
    setEnabled(true);
    setIsLocked(false);
  }, []);

  const disableLock = useCallback(async () => {
    await deleteItemSecurely(PIN_HASH_KEY);
    await setSetting('lock_enabled', 'false');
    await setSetting('lock_use_biometrics', 'false');
    setEnabled(false);
    setIsLocked(false);
  }, []);

  const setBiometricsEnabled = useCallback(async (enabled: boolean) => {
    await setSetting('lock_use_biometrics', enabled ? 'true' : 'false');
    setUseBiometrics(enabled);
  }, []);

  return {
    isLocked,
    loading,
    enabled,
    pinLength,
    useBiometrics,
    biometricsAvailable,
    verifyPin,
    authenticateWithBiometrics,
    setPin,
    disableLock,
    setBiometricsEnabled,
  };
}
