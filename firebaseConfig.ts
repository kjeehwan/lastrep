import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApp, getApps, initializeApp } from "firebase/app";
import { Auth, getAuth, initializeAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { Platform } from "react-native";

// Firebase config (exactly as provided)
const firebaseConfig = {
  apiKey: "AIzaSyCF40-CRIwMlw21ZasrFRbRShKp1R7CRR0",
  authDomain: "lastrep-6e04b.firebaseapp.com",
  projectId: "lastrep-6e04b",
  storageBucket: "lastrep-6e04b.firebasestorage.app",
  messagingSenderId: "600291060273",
  appId: "1:600291060273:web:ee8add613da9f581ed4310",
  measurementId: "G-GCYPJ7GERF",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// 🧩 Custom React Native persistence shim (Firebase removed official helper)
const reactNativePersistence = {
  type: "LOCAL",
  async getItem(key: string) {
    return AsyncStorage.getItem(key);
  },
  async setItem(key: string, value: string) {
    await AsyncStorage.setItem(key, value);
  },
  async removeItem(key: string) {
    await AsyncStorage.removeItem(key);
  },
};

let auth: Auth;

if (Platform.OS === "web") {
  // Web default persistence is fine
  auth = getAuth(app);
} else {
  // ✅ Use custom AsyncStorage persistence
  auth = initializeAuth(app, {
    persistence: reactNativePersistence as any,
  });
}

export const db = getFirestore(app);
export { app, auth };

