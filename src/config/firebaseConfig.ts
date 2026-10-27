import AsyncStorage from '@react-native-async-storage/async-storage'; // Import AsyncStorage
import { getApp, getApps, initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, getReactNativePersistence, initializeAuth } from 'firebase/auth'; // Firebase Authentication
import { connectFirestoreEmulator, getFirestore, initializeFirestore, setLogLevel as setFirestoreLogLevel } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions';
import { Platform } from 'react-native';

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
setFirestoreLogLevel(Platform.OS === 'web' && __DEV__ ? 'error' : 'silent');

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
// An explicit demo project is required: local QA must never silently target real accounts.
const emulatorHost = __DEV__ && firebaseConfig.projectId?.startsWith('demo-') ? process.env.EXPO_PUBLIC_LOCAL_FIREBASE_HOST : undefined;
const emulatorState = globalThis as typeof globalThis & { __lastrepFirebaseEmulators?: boolean };
if (emulatorHost && !emulatorState.__lastrepFirebaseEmulators) {
  if (!['127.0.0.1', 'localhost', '10.0.2.2'].includes(emulatorHost)) throw Error('Use a local Firebase emulator host.');
  connectAuthEmulator(auth, `http://${emulatorHost}:19100`, { disableWarnings: true });
  connectFirestoreEmulator(db, emulatorHost, 18081);
  connectFunctionsEmulator(getFunctions(app, 'asia-northeast3'), emulatorHost, 15001);
  emulatorState.__lastrepFirebaseEmulators = true;
}
export { auth, db, firebaseConfig };
