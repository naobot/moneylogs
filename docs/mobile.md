# Mobile apps (iOS + Android)

Capacitor 8 shells (`ios/`, `android/`, app id `app.moneylogs`) around the same Vite build.

## Develop

- `npm run cap:ios` / `npm run cap:android`: development build (local emulators) → sync → run on a simulator, emulator or USB device. Pass a device with `npm run cap:android -- --target <id>` (`adb devices` lists ids).
- `npm run cap:sync`: production build → sync. Both set `CAPACITOR_BUILD=1`, so React is bundled rather than loaded from the CDN.
- Native dev builds reach the Firebase emulators at `localhost`. The iOS simulator shares the Mac's network. On Android, `cap:android` forwards the emulator ports with `adb reverse` after launching (it has to come after: `cap run` restarts adb, which drops forwards). After replugging a phone, run `npm run android:forward`. `VITE_EMULATOR_HOST` overrides the host, but on Android anything other than `localhost` is blocked as mixed content, because the app itself is served from `https://localhost`.
- Android builds need JDK 17–24 (CI uses 21). Recent Android Studio bundles a newer JDK that this project's Gradle 8.14 can't run on, so point `JAVA_HOME` at one, e.g. `export JAVA_HOME=$(/usr/libexec/java_home -v 21)`. `cap:android` checks this first.
- Capacitor recreates the iOS Swift Package symlinks (`ios/App/CapApp-SPM/symlinks/`) with absolute paths on every sync. The `capacitor:update:after` script (`scripts/relative-spm-symlinks.mjs`) rewrites them as relative paths straight afterwards, so they work in any checkout and syncing doesn't dirty the tree.
- Native-only code sits behind `isNative()` in `@/platform`. Use `@/platform` for storage, the clipboard, links and sharing.

## Release

- `npm version <x.y.z>` also updates the native versions (`scripts/sync-native-version.mjs`). The build number is major×10000 + minor×100 + patch.
- To force old builds to update, set `config/app.minNativeVersion` in Firestore. The store links go in the same doc as `iosStoreUrl` and `androidStoreUrl`.
- App icons and splash screens are drawn from `public/favicon.svg` by `node scripts/generate-native-icons.mjs`; rerun it whenever the favicon changes. It writes the Android vector mark, adaptive icon, splash and legacy launcher PNGs, the iOS app icon, launch image and `SplashBackground` colour, and the store-listing icons in `assets/` (`icon-only.png` 1024, `icon-512.png` for Play). Don't use `@capacitor/assets`: it resamples the pixel art, which blurs it.

## Checklist (outside the code)

1. Install Android Studio, and set up an emulator with a Google Play image.
2. Register the iOS and Android apps (`app.moneylogs`) in the Firebase console. Add `GoogleService-Info.plist` to `ios/App/App/` and `google-services.json` to `android/app/`. Both get committed.
3. Apple Developer account:
   - Put the Team ID in `public/.well-known/apple-app-site-association` and set it as the Xcode signing team.
   - Upload an APNs key to Firebase.
   - Switch `aps-environment` to `production` for store builds.
4. Google Play Console: put the upload-key and Play app-signing SHA-256 fingerprints in `public/.well-known/assetlinks.json`. New personal accounts need 12+ testers for 14 days before production.
5. Demo account for review: `scripts/seed-review-account.ts` (try `--emulator` first).
6. Store listings: privacy policy at https://moneylogs.app/privacy, privacy and data-safety forms (Firebase, Sentry; no replay in the apps), a demo account with a seeded log for review, and a note that the app moves no money.
7. Deploy when the epic merges: `firestore:rules` (config, devices), `functions` (`sendPushOnNotification`) and hosting (`.well-known`).
