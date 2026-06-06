import { useEffect, useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as LocalAuthentication from 'expo-local-authentication';
import { useTheme } from '../../components/ThemeContext';
import LockSetup from '../../components/LockSetup';
import { useAppLock } from '../../hooks/useAppLock';

export default function Step2() {
  const { theme } = useTheme();
  const router = useRouter();
  const lock = useAppLock();
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const [useBiometrics, setUseBiometrics] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      LocalAuthentication.hasHardwareAsync().then(async has => {
        if (has) {
          const enrolled = await LocalAuthentication.isEnrolledAsync();
          setBiometricsAvailable(has && enrolled);
        }
      });
    }
  }, []);

  const handleSkip = () => {
    router.replace('/(tabs)');
  };

  const handleSetPin = async (pin: string) => {
    await lock.setPin(pin);
    if (useBiometrics) {
      await lock.setBiometricsEnabled(true);
    }
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inner}
      >
        <View style={styles.content}>
          <LockSetup
            onSetPin={handleSetPin}
            onSkip={handleSkip}
            biometricsAvailable={biometricsAvailable}
            useBiometrics={useBiometrics}
            onBiometricsChange={setUseBiometrics}
          />
        </View>
      </KeyboardAvoidingView>
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
});
