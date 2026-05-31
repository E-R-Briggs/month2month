import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { getDatabase } from '../db';
import { ThemeProvider, useTheme } from '../components/ThemeContext';

function StatusBarTheme() {
  const { resolvedMode } = useTheme();
  return <StatusBar style={resolvedMode === 'dark' ? 'light' : 'dark'} />;
}

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [fontsLoaded] = useFonts({
    'MartianMono NFM': require('../assets/fonts/MartianMonoNerdFontMono-Regular.ttf'),
  });

  useEffect(() => {
    getDatabase();
    setReady(true);
  }, []);

  if (!ready || !fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0a' }}>
        <ActivityIndicator size="large" color="#ffffff" />
      </View>
    );
  }

  return (
    <ThemeProvider>
      <View style={{ flex: 1 }}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="add" options={{ presentation: 'modal' }} />
        </Stack>
        <StatusBarTheme />
      </View>
    </ThemeProvider>
  );
}
