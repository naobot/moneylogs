import { initializeApp } from "firebase/app"
import { getAnalytics } from "firebase/analytics"
import { getFirestore, enableNetwork } from "firebase/firestore"
import { getAuth } from "firebase/auth"

const firebaseConfig = {
  apiKey: "AIzaSyDDhnpAzuM3TyPJEgRSgSvpcMQrl18DMEk",
  authDomain: "moneylogs-89ebf.firebaseapp.com",
  projectId: "moneylogs-89ebf",
  storageBucket: "moneylogs-89ebf.firebasestorage.app",
  messagingSenderId: "272073869426",
  appId: "1:272073869426:web:dd96782f802554cf41daeb",
  measurementId: "G-MZ8E93J89D"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)

const environment = import.meta.env.VITE_FIREBASE_ENV || 'unknown'
const appVersion = import.meta.env.VITE_APP_VERSION || 'unknown'
const isDevelopment = environment === 'development'

const analytics = getAnalytics(app)

if (typeof window !== 'undefined' && !isDevelopment) {
  analytics = getAnalytics(app);

  // Set default parameters for all analytics events
  setDefaultEventParameters(analytics, {
    environment: environment,
    app_version: appVersion,
    build_type: isDevelopment ? 'development' : 'production'
  });
}
export { analytics }

if (isDevelopment && typeof window !== 'undefined') {
  // Only connect if not already connected
  try {
    connectFirestoreEmulator(db, 'localhost', 8080)
    connectAuthEmulator(auth, 'http://localhost:9099')
  } catch (error) {
    // Emulators already connected or not running
    console.log('Emulators may already be connected or not running')
  }
}

// Enable offline persistence
enableNetwork(db).then(() => {
  console.log('✅ Firebase offline persistence enabled')
}).catch((error) => {
  console.error('❌ Failed to enable offline persistence:', error)
})