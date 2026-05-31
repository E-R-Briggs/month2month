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

## License

month2month is GPLv3. Building and using it yourself is always free.
