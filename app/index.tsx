import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { hasOnboardingData } from '../db';

export default function Index() {
  const [ready, setReady] = useState(false);
  const [hasData, setHasData] = useState(false);

  useEffect(() => {
    hasOnboardingData().then(data => {
      setHasData(data);
      setReady(true);
    });
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0a' }}>
        <ActivityIndicator size="large" color="#ffffff" />
      </View>
    );
  }

  if (!hasData) return <Redirect href="/onboarding/step-1" />;
  return <Redirect href="/(tabs)" />;
}
