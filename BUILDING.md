# Building month2month

## 1. Download a pre-built APK (easiest)

Go to the [Releases](https://github.com/ellisbriggs/month2month/releases) page, download the latest `.apk`, and install it on your Android device.

## 2. Build from source

### Prerequisites

- [Node.js](https://nodejs.org/) 18 or later
- [JDK](https://adoptium.net/) 17 or later
- [Android Studio](https://developer.android.com/studio) with Android SDK 35
- [Xcode](https://developer.apple.com/xcode/) (iOS only, macOS required)

### Clone and install

```sh
git clone https://github.com/ellisbriggs/month2month.git
cd month2month
npm install
```

### Android (release APK for side-loading)

```sh
npx expo run:android --variant release
```

The APK is written to `android/app/build/outputs/apk/release/app-release.apk`.

### Android (debug on device or emulator)

```sh
npx expo run:android
```

### iOS

```sh
npx expo run:ios
```

A paid Apple Developer account is required to install on a real device. Without one you can still run in the Simulator.

## 3. Web

### Prerequisites

The web export uses `npx expo export`, which is included with Expo SDK 56. No additional tools required.

### pnpm note

If using pnpm, you must set `nodeLinker: hoisted` in `pnpm-workspace.yaml` (already configured in this repo). Run `pnpm install` after changing this setting.

Use the npm scripts (not `pnpx`) for web commands because `pnpx` resolves `expo` from the pnpm store, which breaks Metro's module resolution for static rendering:

```sh
# ✅ Do this
pnpm run export:web

# ❌ Not this
pnpx expo export --platform web
```

### Build for production

```sh
node node_modules/expo/bin/cli export --platform web
# or: npm run export:web
# or: pnpm run export:web
```

The output is written to `dist/`. You can serve it with any static file server.

### Deploy to Cloudflare Pages (recommended)

Cloudflare Pages is free, supports unlimited bandwidth, and serves the required `Cross-Origin-Opener-Policy` / `Cross-Origin-Embedder-Policy` headers needed for `expo-sqlite` on web.

To set it up:

1. Sign up at [Cloudflare Pages](https://pages.cloudflare.com/) (free tier)
2. Click **Create a project > Connect to Git**
3. Select your `month2month` repository
4. Configure the build:

   | Setting | Value |
   |---|---|
    | **Build command** | `npx expo export --platform web` |
   | **Output directory** | `dist` |
   | **Environment variable** | `NODE_VERSION = 22` |

5. Click **Save and Deploy**

The site will be available at `<your-project>.pages.dev`. You can also add a custom domain in the Cloudflare dashboard.

The `public/_headers` file in the repo configures the required COOP/COEP headers automatically on each deploy.

### Run locally for development

```sh
npx expo start --web
```

Note: the local dev server doesn't serve `Cross-Origin-Opener-Policy` headers, so `expo-sqlite` won't work. For a fully functional web build, use the export + serve workflow below.

### Build and serve locally (recommended for testing)

```sh
# Build static files
node node_modules/expo/bin/cli export --platform web
# or: npm run export:web / pnpm run export:web

# Serve with COOP/COEP headers (SharedArrayBuffer support)
node scripts/serve-web.js
# or: npm run serve:web / pnpm run serve:web
```

Open `http://localhost:3000` in your browser. The app will be fully functional including SQLite storage.

Open `http://localhost:3000` in your browser. The app will be fully functional including SQLite storage.

## License

month2month is GPLv3. Building and using it yourself is always free.
