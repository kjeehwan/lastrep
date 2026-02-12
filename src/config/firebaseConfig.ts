import AsyncStorage from '@react-native-async-storage/async-storage'; // Import AsyncStorage
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, initializeAuth } from 'firebase/auth'; // Firebase Authentication
import { getFirestore, initializeFirestore } from 'firebase/firestore';
import { Platform } from 'react-native';

// @ts-ignore - ignore the TypeScript error for missing typings in Firebase SDK
import { getReactNativePersistence } from 'firebase/auth'; // Import getReactNativePersistence

// Firebase configuration (populate these values from your .env file)
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase if not already initialized
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Initialize Firebase Authentication with AsyncStorage persistence
const auth =
  Platform.OS === 'web'
    ? getAuth(app)
    : initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage),  // Correctly apply persistence for React Native
      });

// Firestore web channel can be unstable on Android dev builds without long polling.
// Use long polling for React Native; fall back to existing instance on fast refresh.
const db =
  Platform.OS === 'web'
    ? getFirestore(app)
    : (() => {
        try {
          return initializeFirestore(app, {
            experimentalForceLongPolling: true,
          });
        } catch {
          return getFirestore(app);
        }
      })();

// Export the Firebase services
export { auth, db, firebaseConfig };

