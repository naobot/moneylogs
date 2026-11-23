# Mobile apps (iOS + Android)

Capacitor 8 shells (`ios/`, `android/`, app id `app.moneylogs`) around the same Vite build.

## Develop

- `npm run cap:ios` / `npm run cap:android`: development build (local emulators) → sync → run on a simulator, emulator or USB device. Pass a device with `npm run cap:android -- --target <id>` (`adb devices` lists ids).
- `npm run cap:sync`: production build → sync. Both set `CAPACITOR_BUILD=1`, so React is bundled rather than loaded from the CDN.
- Native dev builds reach the Firebase emulators at `localhost`. The iOS simulator shares the Mac's network. On Android, `cap:android` forwards the emulator ports with `adb reverse` after launching (it has to come after: `cap run` restarts adb, which drops forwards). After replugging a phone, run `npm run android:forward`. `VITE_EMULATOR_HOST` overrides the host, but on Android anything other than `localhost` is blocked as mixed content, because the app itself is served from `https://localhost`.
- Android builds need JDK 17–24 (CI uses 21), and JDK 21 must be installed even if `JAVA_HOME` points elsewhere: `@capacitor/filesystem` asks Gradle for a Java 21 toolchain (`brew install --cask temurin@21`). Gradle finds the SDK through `android/local.properties` (`sdk.dir=…/Library/Android/sdk`, git-ignored) or `ANDROID_HOME`. Recent Android Studio bundles a newer JDK that this project's Gradle 8.14 can't run on, so point `JAVA_HOME` at one, e.g. `export JAVA_HOME=$(/usr/libexec/java_home -v 21)`. `cap:android` checks this first.
- Capacitor recreates the iOS Swift Package symlinks (`ios/App/CapApp-SPM/symlinks/`) with absolute paths on every sync. The `capacitor:update:after` script (`scripts/relative-spm-symlinks.mjs`) rewrites them as relative paths straight afterwards, so they work in any checkout and syncing doesn't dirty the tree.
- Native-only code sits behind `isNative()` in `@/platform`. Use `@/platform` for storage, the clipboard, links and sharing.
- Share cards (`shareImage`) write the PNG to the app's cache with `@capacitor/filesystem`, then hand the file URI to `@capacitor/share`. Android serves it through the Capacitor template's FileProvider (`res/xml/file_paths.xml` must keep its `cache-path` entry). After pulling this plugin in, run `npm run cap:sync` so the native projects pick it up.

## Release

- `npm version <x.y.z>` also updates the native versions (`scripts/sync-native-version.mjs`). The build number is major×10000 + minor×100 + patch. A unit test (`src/features/native/__tests__/nativeVersion.test.ts`) fails if a bump skipped the sync; run the script to fix it. Play rejects an upload whose build number isn't higher than the last.
- **Android release:** `npm run android:release` syncs the versions, makes a production build and writes a signed bundle to `android/app/build/outputs/bundle/release/app-release.aab` for upload to Play. It needs the upload key:
  1. Once, create it: `keytool -genkeypair -v -keystore android/moneylogs-upload.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload`.
  2. Copy `android/keystore.properties.example` to `android/keystore.properties` and fill in the passwords. Both files are git-ignored; keep copies in a password manager.
  3. In Play Console, enrol in Play App Signing (Google holds the app-signing key; you upload with this key).
     Without `keystore.properties`, release builds stop with directions rather than producing an unsigned bundle. Debug builds and CI don't need it.
- To force old builds to update, set `config/app.minNativeVersion` in Firestore. The store links go in the same doc as `iosStoreUrl` and `androidStoreUrl`.
- App icons and splash screens are drawn from `public/favicon.svg` by `node scripts/generate-native-icons.mjs`; rerun it whenever the favicon changes. It writes the Android vector mark, adaptive icon, splash and legacy launcher PNGs, the iOS app icon, launch image and `SplashBackground` colour, and the store-listing icons in `assets/` (`icon-only.png` 1024, `icon-512.png` for Play). Don't use `@capacitor/assets`: it resamples the pixel art, which blurs it.

## Checklist (outside the code)

Done: 1, 2, the Team ID in 3, and the fingerprints in 4. The first internal-test build (5.18.0) is uploaded.

1. Install Android Studio, and set up an emulator with a Google Play image.
2. Register the iOS and Android apps (`app.moneylogs`) in the Firebase console. Add `GoogleService-Info.plist` to `ios/App/App/` and `google-services.json` to `android/app/`. Both get committed.
3. Apple Developer account:
   - Put the Team ID (`N95N7S65JJ`) in `public/.well-known/apple-app-site-association` and set it as the Xcode signing team.
   - Upload an APNs key to Firebase.
   - Switch `aps-environment` to `production` for store builds.
4. Google Play Console:
   - New personal accounts need a closed test with 12+ testers for 14 days before production, so start early.
   - Put the upload-key and Play app-signing SHA-256 fingerprints (Play Console → App integrity) in `public/.well-known/assetlinks.json`, then deploy hosting. Until then, moneylogs.app links won't open the app.
   - Store listing: 512 icon is `assets/icon-512.png`; still needed are a 1024×500 feature graphic and 2+ phone screenshots.
   - Forms: Data safety (Firebase, Sentry; account deletion link https://moneylogs.app/privacy), Financial features (personal budgeting only; no money moves), content rating, target audience, no ads, and App access (the demo account below).
   - The app calls Firebase from `https://localhost`. If the Firebase API key is restricted to moneylogs.app in Google Cloud, sign-in fails in the app: check on the first internal-test build.
5. Demo account for review: `scripts/seed-review-account.ts` (try `--emulator` first).
6. Store listings: privacy policy at https://moneylogs.app/privacy, privacy and data-safety forms (Firebase, Sentry; no replay in the apps), a demo account with a seeded log for review, and a note that the app moves no money.
7. Deploy when the epic merges: `firestore:rules` (config, devices), `functions` (`sendPushOnNotification`) and hosting (`.well-known`).
