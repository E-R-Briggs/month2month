import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { useColorScheme, Platform } from 'react-native';
import { getAllSettings, setSetting } from '../db';
import type { CurrencyCode } from '../utils/currency';

export type ThemeColors = {
  positive: string;
  negative: string;
  background: string;
  card: string;
  cardBorder: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
};

type ThemeSettings = {
  mode: 'dark' | 'light' | 'system';
  useAndroidSystem: boolean;
  currency: CurrencyCode;
  colors: Partial<ThemeColors>;
};

type ThemeContextValue = {
  theme: ThemeColors;
  resolvedMode: 'dark' | 'light';
  rawSettings: ThemeSettings;
  currency: CurrencyCode;
  updateColor: (key: keyof ThemeColors, value: string) => Promise<void>;
  updateMode: (mode: 'dark' | 'light' | 'system') => Promise<void>;
  toggleAndroidSystem: () => Promise<void>;
  resetTheme: () => Promise<void>;
  updateCurrency: (code: CurrencyCode) => Promise<void>;
};

const DARK_DEFAULTS: ThemeColors = {
  positive: '#22c55e',
  negative: '#ef4444',
  background: '#0a0a0a',
  card: '#121212',
  cardBorder: '#222222',
  text: '#ffffff',
  textSecondary: '#888888',
  textTertiary: '#555555',
};

const LIGHT_DEFAULTS: ThemeColors = {
  positive: '#16a34a',
  negative: '#dc2626',
  background: '#f5f5f5',
  card: '#ffffff',
  cardBorder: '#e0e0e0',
  text: '#000000',
  textSecondary: '#666666',
  textTertiary: '#999999',
};

const ANDROID_SYSTEM_COLORS: Partial<ThemeColors> = {
  positive: '#1a73e8',
  negative: '#d93025',
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function mergeColors(base: ThemeColors, overrides: Partial<ThemeColors>): ThemeColors {
  return { ...base, ...overrides };
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [ready, setReady] = useState(false);
  const [rawSettings, setRawSettings] = useState<ThemeSettings>({
    mode: 'system',
    useAndroidSystem: false,
    currency: 'GBP',
    colors: {},
  });

  useEffect(() => {
    getAllSettings()
      .then(settings => {
        const parsed: ThemeSettings = {
          mode: (settings['theme_mode'] as 'dark' | 'light' | 'system') || 'system',
          useAndroidSystem: settings['theme_use_android_system'] === 'true',
          currency: (settings['currency'] as CurrencyCode) || 'GBP',
          colors: {},
        };

        const colorKeys: (keyof ThemeColors)[] = [
          'positive', 'negative', 'background', 'card',
          'cardBorder', 'text', 'textSecondary', 'textTertiary',
        ];
        for (const key of colorKeys) {
          const val = settings[`theme_color_${key}`];
          if (val) parsed.colors[key] = val;
        }

        setRawSettings(parsed);
        setReady(true);
      })
      .catch(() => setReady(true));
  }, []);

  const resolvedMode: 'dark' | 'light' =
    rawSettings.mode === 'system'
      ? (systemScheme === 'light' ? 'light' : 'dark')
      : rawSettings.mode;

  const theme = useMemo(() => {
    const base = resolvedMode === 'light' ? LIGHT_DEFAULTS : DARK_DEFAULTS;
    let merged = mergeColors(base, rawSettings.colors);

    if (rawSettings.useAndroidSystem && Platform.OS === 'android') {
      merged = mergeColors(merged, ANDROID_SYSTEM_COLORS);
    }

    return merged;
  }, [resolvedMode, rawSettings]);

  const updateColor = useCallback(async (key: keyof ThemeColors, value: string) => {
    await setSetting(`theme_color_${key}`, value);
    setRawSettings(prev => ({
      ...prev,
      colors: { ...prev.colors, [key]: value },
    }));
  }, []);

  const updateMode = useCallback(async (mode: 'dark' | 'light' | 'system') => {
    await setSetting('theme_mode', mode);
    setRawSettings(prev => ({ ...prev, mode }));
  }, []);

  const toggleAndroidSystem = useCallback(async () => {
    const next = !rawSettings.useAndroidSystem;
    await setSetting('theme_use_android_system', next ? 'true' : 'false');
    setRawSettings(prev => ({ ...prev, useAndroidSystem: next }));
  }, [rawSettings.useAndroidSystem]);

  const updateCurrency = useCallback(async (code: CurrencyCode) => {
    await setSetting('currency', code);
    setRawSettings(prev => ({ ...prev, currency: code }));
  }, []);

  const resetTheme = useCallback(async () => {
    const colorKeys: (keyof ThemeColors)[] = [
      'positive', 'negative', 'background', 'card',
      'cardBorder', 'text', 'textSecondary', 'textTertiary',
    ];
    for (const key of colorKeys) {
      await setSetting(`theme_color_${key}`, '');
    }
    await setSetting('theme_mode', 'system');
    await setSetting('theme_use_android_system', 'false');
    await setSetting('currency', 'GBP');
    setRawSettings({ mode: 'system', useAndroidSystem: false, currency: 'GBP', colors: {} });
  }, []);

  if (!ready) return null;

  return (
    <ThemeContext.Provider
      value={{
        theme,
        resolvedMode,
        rawSettings,
        currency: rawSettings.currency,
        updateColor,
        updateMode,
        toggleAndroidSystem,
        resetTheme,
        updateCurrency,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
