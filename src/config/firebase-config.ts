import { initializeApp } from "firebase/app";
import { getAnalytics, setDefaultEventParameters } from "firebase/analytics";
import { getFirestore, enableNetwork, connectFirestoreEmulator } from "firebase/firestore";
import {
  connectAuthEmulator,
  getAuth,
  indexedDBLocalPersistence,
  initializeAuth,
} from "firebase/auth";
import { getStorage, connectStorageEmulator } from "firebase/storage";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";
import { isNative } from "@/platform/native";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: "moneylogs-89ebf",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
// In the native WebView, getAuth's default persistence and popup/redirect helpers don't
// fit: IndexedDB keeps the session across app restarts, and there are no popups.
export const auth = isNative()
  ? initializeAuth(app, { persistence: indexedDBLocalPersistence })
  : getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);

declare const __APP_VERSION__: string;

const environment = import.meta.env.VITE_FIREBASE_ENV ?? "unknown";
const appVersion = __APP_VERSION__ ?? "unknown";
const isDevelopment = environment === "development";

// Firebase Analytics (gtag) only runs on http(s) pages, so native builds go without.
const analytics = isNative() ? null : getAnalytics(app);

if (analytics) {
  // Set default parameters for all analytics events
  setDefaultEventParameters({
    environment: environment,
    app_version: appVersion,
    build_type: isDevelopment ? "development" : "production",
  });
}
export { analytics };

if (isDevelopment && typeof window !== "undefined") {
  // Only connect if not already connected
  // The emulators run on the dev machine. Reach them at whatever host served the page,
  // so a phone on the LAN (vp dev --host, opened at the machine's IP) talks to them too.
  // Native builds serve themselves from localhost, which also suits them: the iOS
  // simulator shares the Mac's network, and on Android (emulator or USB device)
  // `npm run cap:android` forwards the emulator ports with `adb reverse`. It has to be
  // localhost there: the page is https://localhost, and the WebView blocks plain-http
  // requests to any other host as mixed content. VITE_EMULATOR_HOST overrides it.
  const emulatorHost =
    import.meta.env.VITE_EMULATOR_HOST || window.location.hostname || "localhost";
  try {
    connectFirestoreEmulator(db, emulatorHost, 8888);
    connectAuthEmulator(auth, `http://${emulatorHost}:9099`);
    connectStorageEmulator(storage, emulatorHost, 9199);
    connectFunctionsEmulator(functions, emulatorHost, 5001);
  } catch {
    // Emulators already connected or not running
    console.log("Emulators may already be connected or not running");
  }
}

// Enable offline persistence
enableNetwork(db)
  .then(() => {
    console.log("✅ Firebase offline persistence enabled");
  })
  .catch((error) => {
    console.error("❌ Failed to enable offline persistence:", error);
  });
