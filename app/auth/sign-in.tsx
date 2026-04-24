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
import { buildDefaultUserDoc, getDecisionUsage, getUserData, saveUserData } from "../../src/userData";

const normalizeGoogleAuthErrorMessage = (error: unknown, fallback: string): string => {
  const raw =
    typeof (error as { message?: unknown } | undefined)?.message === "string"
      ? (error as { message: string }).message
      : "";
  const normalized = raw.toLowerCase();
  if (
    normalized.includes("gettokens requires a user to be signed in") ||
    normalized.includes("user cancelled") ||
    normalized.includes("user canceled") ||
    normalized.includes("sign_in_cancelled")
  ) {
    return "Google sign-in was canceled.";
  }
  return raw || fallback;
};

const normalizeEmailSignInErrorMessage = (error: unknown): string => {
  const code =
    typeof (error as { code?: unknown } | undefined)?.code === "string"
      ? (error as { code: string }).code.toLowerCase()
      : "";
  const raw =
    typeof (error as { message?: unknown } | undefined)?.message === "string"
      ? (error as { message: string }).message.toLowerCase()
      : "";

  if (code.includes("invalid-email") || raw.includes("invalid-email")) {
    return "Please enter a valid email address.";
  }
  if (
    code.includes("invalid-credential") ||
    code.includes("user-not-found") ||
    code.includes("wrong-password") ||
    raw.includes("invalid-credential") ||
    raw.includes("user-not-found") ||
    raw.includes("wrong-password")
  ) {
    return "Email or password is incorrect.";
  }
  if (code.includes("too-many-requests") || raw.includes("too-many-requests")) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  return "Sign-in failed. Please try again.";
};

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
      setError(normalizeEmailSignInErrorMessage(err));
    }
  };

  const finalizeSession = async (userCredential: UserCredential) => {
    const userToken = await userCredential.user.getIdToken();
    await AsyncStorage.setItem("userToken", userToken);

    const data = await getUserData(userCredential.user.uid);
    const additionalInfo = getAdditionalUserInfo(userCredential);

    const tzOffsetMinutes = new Date().getTimezoneOffset();
    if (!data && additionalInfo?.isNewUser) {
      await saveUserData(
        userCredential.user.uid,
        buildDefaultUserDoc({
          email: userCredential.user.email,
          name:
            userCredential.user.displayName ||
            userCredential.user.email?.split("@")[0] ||
            "New User",
          goal: "Build muscle",
        }, new Date(), tzOffsetMinutes)
      );
      await AsyncStorage.setItem("isSignedUp", "true");
      router.push("/onboarding/goal");
      return;
    }

    if (data) {
      const normalized = getDecisionUsage(data, new Date(), tzOffsetMinutes);
      await saveUserData(userCredential.user.uid, {
        usage: { decisions: normalized },
      });
    }

    router.replace("/(tabs)/home");
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
      setError(normalizeGoogleAuthErrorMessage(googleError, "Google Sign-In failed"));
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
        placeholderTextColor="#777"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#777"
        secureTextEntry={true}
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="password"
        autoComplete="password"
        selectionColor="#2a67b1"
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
        <Text style={styles.footerText}>Don&apos;t have an account? </Text>
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
    color: "#111",
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
