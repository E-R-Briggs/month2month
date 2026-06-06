import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import { useTheme } from '../components/ThemeContext';

export default function PrivacyPolicyPage() {
  const { theme } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: theme.text }]}>Privacy Policy</Text>
        <Text style={[styles.updated, { color: theme.textTertiary }]}>Last updated: May 2026</Text>

        <Text style={[styles.section, { color: theme.text }]}>Data Collection</Text>
        <Text style={[styles.body, { color: theme.textSecondary }]}>
          month2month does not collect, store, or transmit any personal data. All information you enter
          — bills, income, settings — is stored exclusively on your device using local on-device SQLite
          storage. No data is ever sent to any server.
        </Text>

        <Text style={[styles.section, { color: theme.text }]}>Analytics & Crash Reporting</Text>
        <Text style={[styles.body, { color: theme.textSecondary }]}>
          month2month uses no analytics services, crash reporters, or third-party SDKs that collect data.
          The app has no network access beyond what you explicitly initiate (data export/import).
        </Text>

        <Text style={[styles.section, { color: theme.text }]}>Export & Import</Text>
        <Text style={[styles.body, { color: theme.textSecondary }]}>
          Any data export is user-initiated and encrypted with AES-256-GCM before being saved to your
          chosen location. Imported data is decrypted locally and stored only on your device. The
          encryption password never leaves your device.
        </Text>

        <Text style={[styles.section, { color: theme.text }]}>Third-Party Services</Text>
        <Text style={[styles.body, { color: theme.textSecondary }]}>
          month2month does not integrate any third-party services that collect user data. The app icon
          uses no network access.
        </Text>

        <Text style={[styles.section, { color: theme.text }]}>Changes to This Policy</Text>
        <Text style={[styles.body, { color: theme.textSecondary }]}>
          This policy may be updated from time to time. Users will be notified of material changes via
          the app's version release notes.
        </Text>

        <Text style={[styles.section, { color: theme.text }]}>Contact</Text>
        <Text style={[styles.body, { color: theme.textSecondary }]}>
          For questions about this privacy policy, please open an issue on the{' '}
          <Text style={[styles.link, { color: theme.positive }]} onPress={() => {
            if (Platform.OS === 'web') {
              window.open('https://github.com/ellisbriggs/month2month/issues', '_blank');
            }
          }}>
            GitHub repository
          </Text>.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 24,
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 4,
  },
  updated: {
    fontSize: 13,
    marginBottom: 24,
  },
  section: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 8,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
  },
  link: {
    textDecorationLine: 'underline',
  },
});
