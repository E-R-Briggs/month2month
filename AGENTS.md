# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.

## CVE Checking Required Before Adding Dependencies

Before installing any new npm package, check for recent CVEs:
1. Search for `{package-name} CVE vulnerability 2025 2026` via websearch
2. Check the latest version on npm for security fixes
3. For Expo packages, also check the Expo SDK 56 changelog at https://docs.expo.dev/versions/v56.0.0/sdk/{package-name}
4. Note any known issues in AGENTS.md under a CVE section

## Known Package Issues

- **expo-crypto**: Xcode 26.4 build issue with `expo-crypto@56.0.4` (macro plugin not found) — pin to `56.0.3` if using `buildReactNativeFromSource: true` on modern Xcode
