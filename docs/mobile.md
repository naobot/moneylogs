# Mobile apps (iOS + Android)

Capacitor 8 shells (`ios/`, `android/`, app id `app.moneylogs`) around the same Vite build.

## Develop

- `npm run cap:ios` / `npm run cap:android`: development build (local emulators) → sync → run on a simulator or emulator.
- `npm run cap:sync`: production build → sync. Both set `CAPACITOR_BUILD=1`, so React is bundled rather than loaded from the CDN.
- On a real device, set `VITE_EMULATOR_HOST` to the Mac's LAN IP.
- Native-only code sits behind `isNative()` in `@/platform`. Use `@/platform` for storage, the clipboard, links and sharing.

## Release

- `npm version <x.y.z>` also updates the native versions (`scripts/sync-native-version.mjs`). The build number is major×10000 + minor×100 + patch.
- To force old builds to update, set `config/app.minNativeVersion` in Firestore. The store links go in the same doc as `iosStoreUrl` and `androidStoreUrl`.
- Icon and splash sources are in `assets/` (made from `public/favicon.svg`). Regenerate with `npx @capacitor/assets@4.0.0 generate --ios --android` and the colour flags used in the epic PR.

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
