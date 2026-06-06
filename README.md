# month2month

A local-only monthly budget tracker for iOS, Android, and Web. See what's left after bills hit — no accounts, no servers, no tracking.

## Features

- **Pay setup** — monthly or weekly frequency, configurable pay day, business-day adjustment
- **Bills & income** — one-off or recurring entries with date, amount, label, and smart bill-splitting across pay cycles
- **Month-by-month view** — horizontal scroller, mini-calendar, animated playback of money flow, category filtering
- **UK bank holidays** — built-in formula-based holidays + custom user holidays with pay/bill shift toggle
- **Labels** — color-coded categories with custom label creation (Bills, Food, Subscriptions, etc.)
- **Multi-currency** — GBP, USD, EUR, JPY, CAD, AUD
- **Dark / light / system theme** — fully customizable accent, background, and text colors
- **Encrypted backup/restore** — AES-encrypted `.m2m` files via share or file picker
- **App lock** — PIN + Face ID / fingerprint
- **Zero servers** — all data stays in local SQLite. No accounts, no analytics, no network requests.

## Quick Start

```sh
npm install
npx expo run:ios     # iOS (macOS + Xcode required)
npx expo run:android  # Android
```

For APK builds, web export, and Cloudflare Pages deployment, see [BUILDING.md](BUILDING.md).

## Tech Stack

React Native 0.85 · Expo SDK 56 · expo-sqlite · expo-router · react-native-reanimated · TypeScript

## License

GNU General Public License v3.0. See [LICENSE](LICENSE).

Building and using it yourself is always free. The app is also available on the App Store for £1.99 to support development.
