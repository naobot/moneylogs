import { initializeApp } from "firebase/app"
import { getAnalytics, setDefaultEventParameters } from "firebase/analytics"
import { getFirestore, enableNetwork, connectFirestoreEmulator } from "firebase/firestore"
import { connectAuthEmulator, getAuth } from "firebase/auth"

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: "moneylogs-89ebf",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)

declare const __APP_VERSION__: string

const environment = import.meta.env.VITE_FIREBASE_ENV ?? 'unknown'
const appVersion = __APP_VERSION__ ?? 'unknown'
const isDevelopment = environment === 'development'

const analytics = getAnalytics(app)

if (typeof window !== 'undefined') {
  // Set default parameters for all analytics events
  setDefaultEventParameters({
    environment: environment,
    app_version: appVersion,
    build_type: isDevelopment ? 'development' : 'production',
  })
}
export { analytics }

// if (isDevelopment && typeof window !== 'undefined') {
//   // Only connect if not already connected
//   try {
//     connectFirestoreEmulator(db, 'localhost', 8080)
//     connectAuthEmulator(auth, 'http://localhost:9099')
//   } catch (error) {
//     // Emulators already connected or not running
//     console.log('Emulators may already be connected or not running')
//   }
// }

// Enable offline persistence
enableNetwork(db).then(() => {
  console.log('✅ Firebase offline persistence enabled')
}).catch((error) => {
  console.error('❌ Failed to enable offline persistence:', error)
})