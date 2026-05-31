import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../components/ThemeContext';

function TabIcon({ name, focused, color }: { name: string; focused: boolean; color: string }) {
  const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
    index: focused ? 'home' : 'home-outline',
    settings: focused ? 'settings' : 'settings-outline',
  };
  return <Ionicons name={icons[name] || 'help-outline'} size={22} color={color as string} />;
}

export default function TabLayout() {
  const { theme } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.card,
          borderTopColor: theme.cardBorder,
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: theme.text,
        tabBarInactiveTintColor: theme.textTertiary,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused, color }) => <TabIcon name="index" focused={focused} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ focused, color }) => <TabIcon name="settings" focused={focused} color={color as string} />,
        }}
      />
    </Tabs>
  );
}
