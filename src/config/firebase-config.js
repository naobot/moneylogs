import { initializeApp } from "firebase/app"
import { getAnalytics } from "firebase/analytics"
import { getFirestore } from "firebase/firestore"
import { getAuth } from "firebase/auth"

// TODO: Add SDKs for Firebase products that you want to use

// https://firebase.google.com/docs/web/setup#available-libraries


// Your web app's Firebase configuration

// For Firebase JS SDK v7.20.0 and later, measurementId is optional

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
export const db = getFirestore(app);

const analytics = getAnalytics(app)