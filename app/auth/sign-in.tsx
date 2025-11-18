import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import {
  GoogleAuthProvider,
  UserCredential,
  getAdditionalUserInfo,
  signInWithCredential,
  signInWithEmailAndPassword,
} from "firebase/auth";
import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import LastRepLogo from "../../components/LastRepLogo"; // Static logo component
import { auth } from "../../src/config/firebaseConfig";
import { getUserData, saveUserData } from "../../src/userData"; // Firestore helpers

export default function SignIn() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [googleBusy, setGoogleBusy] = useState(false);
  useEffect(() => {
    GoogleSignin.configure({
      webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
      iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
      scopes: ["profile", "email"],
      offlineAccess: true,
    });
  }, []);

  const handleSignIn = async () => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      await finalizeSession(userCredential);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const finalizeSession = async (userCredential: UserCredential) => {
    const userToken = await userCredential.user.getIdToken();
    await AsyncStorage.setItem("userToken", userToken);

    const data = await getUserData(userCredential.user.uid);
    const additionalInfo = getAdditionalUserInfo(userCredential);

    if (!data && additionalInfo?.isNewUser) {
      await saveUserData(userCredential.user.uid, {
        email: userCredential.user.email,
        name:
          userCredential.user.displayName ||
          userCredential.user.email?.split("@")[0] ||
          "New User",
        goal: "Build muscle",
      });
      await AsyncStorage.setItem("isSignedUp", "true");
      router.push("/onboarding/goal");
      return;
    }

    router.push("/home");
  };

  const handleGooglePress = async () => {
    setError(null);
    setGoogleBusy(true);
    try {
      await GoogleSignin.hasPlayServices();
      const signInResult = await GoogleSignin.signIn();
      let idToken = (signInResult as any)?.idToken;
      if (!idToken) {
        // Some devices return tokens via getTokens instead of the sign-in payload
        const tokens = await GoogleSignin.getTokens();
        idToken = tokens?.idToken;
      }
      if (!idToken) throw new Error("Google Sign-In did not return an ID token");
      const credential = GoogleAuthProvider.credential(idToken);
      const userCredential = await signInWithCredential(auth, credential);
      await finalizeSession(userCredential);
    } catch (googleError: any) {
      setError(googleError.message ?? "Google Sign-In failed");
    } finally {
      setGoogleBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <LastRepLogo />

      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      {error && <Text style={styles.error}>{error}</Text>}

      <TouchableOpacity style={styles.button} onPress={handleSignIn}>
        <Text style={styles.buttonText}>Sign In</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, styles.googleButton]}
        onPress={handleGooglePress}
        disabled={googleBusy}
      >
        <Text style={[styles.buttonText, styles.googleButtonText]}>
          {googleBusy ? "Connecting..." : "Continue with Google"}
        </Text>
      </TouchableOpacity>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Don?셳 have an account? </Text>
        <TouchableOpacity onPress={() => router.push("/auth/sign-up")}>
          <Text style={styles.link}>Sign up!</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 60,
    backgroundColor: "#0d0d1a",
  },
  input: {
    height: 50,
    borderColor: "#ccc",
    borderWidth: 1,
    marginBottom: 12,
    paddingLeft: 12,
    borderRadius: 12,
    backgroundColor: "#fff",
  },
  button: {
    backgroundColor: "#2a67b1",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 40,
  },
  footer: {
    marginTop: 20,
    flexDirection: "row",
    justifyContent: "center",
  },
  footerText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  link: {
    color: "#7b61ff",
    fontSize: 16,
    fontWeight: "600",
  },
  error: {
    color: "red",
    marginBottom: 12,
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  googleButton: {
    marginTop: 16,
    backgroundColor: "#fff",
  },
  googleButtonText: {
    color: "#2a67b1",
  },
});





