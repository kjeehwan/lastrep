// Import the functions you need from the SDKs you use
import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCF40-CRIwMlw21ZasrFRbRShKp1R7CRR0",
  authDomain: "lastrep-6e04b.firebaseapp.com",
  projectId: "lastrep-6e04b",
  storageBucket: "lastrep-6e04b.firebasestorage.app",
  messagingSenderId: "600291060273",
  appId: "1:600291060273:web:ee8add613da9f581ed4310",
  measurementId: "G-GCYPJ7GERF",
};

// Initialize Firebase (re-use if already initialized)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Export Firebase services for use in the app
export const auth = getAuth(app);
export const db = getFirestore(app);
export { app };

