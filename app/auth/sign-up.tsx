import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import {
  GoogleAuthProvider,
  UserCredential,
  createUserWithEmailAndPassword,
  getAdditionalUserInfo,
  signInWithCredential,
} from "firebase/auth";
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import LastRepLogo from "../../components/LastRepLogo"; // Static logo component
import { auth } from "../../src/config/firebaseConfig";
import { buildDefaultUserDoc, getDecisionUsage, getUserData, saveUserData } from "../../src/userData"; // Function to save user data in Firestore

export default function SignUp() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [googleBusy, setGoogleBusy] = useState(false);
  const router = useRouter();
  useEffect(() => {
    GoogleSignin.configure({
      webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
      iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
      scopes: ["profile", "email"],
      offlineAccess: true,
    });
  }, []);

  const handleSignUp = async () => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await finalizeRegistration(userCredential, true);
    } catch (err: any) {
      setError(err.message); // Show error message if sign-up fails
    }
  };

  const finalizeRegistration = async (userCredential: UserCredential, isNewUser: boolean) => {
    const userToken = await userCredential.user.getIdToken(); // Get the Firebase ID token
    await AsyncStorage.setItem("userToken", userToken); // Save the user token

    const tzOffsetMinutes = new Date().getTimezoneOffset();
    if (isNewUser) {
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
      router.push("/onboarding/goal"); // Redirect to onboarding after successful sign-up
    } else {
      const data = await getUserData(userCredential.user.uid);
      if (data) {
        const normalized = getDecisionUsage(data, new Date(), tzOffsetMinutes);
        await saveUserData(userCredential.user.uid, {
          entitlement: data.entitlement ?? buildDefaultUserDoc({}, new Date(), tzOffsetMinutes).entitlement,
          usage: { decisions: normalized },
        });
      }
      router.push("/home");
    }
  };

  const handleGooglePress = async () => {
    setError(null);
    setGoogleBusy(true);
    try {
      await GoogleSignin.hasPlayServices();
      const signInResult = await GoogleSignin.signIn();
      let idToken = (signInResult as any)?.idToken;
      if (!idToken) {
        const tokens = await GoogleSignin.getTokens();
        idToken = tokens?.idToken;
      }
      if (!idToken) throw new Error("Google Sign-Up did not return an ID token");
      const credential = GoogleAuthProvider.credential(idToken);
      const userCredential = await signInWithCredential(auth, credential);
      const additionalInfo = getAdditionalUserInfo(userCredential);
      await finalizeRegistration(userCredential, additionalInfo?.isNewUser ?? false);
    } catch (googleError: any) {
      setError(googleError.message ?? "Google Sign-Up failed");
    } finally {
      setGoogleBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Static logo at the top */}
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

      <TouchableOpacity style={styles.button} onPress={handleSignUp}>
        <Text style={styles.buttonText}>Sign Up</Text>
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

      {/* Link to Sign-In */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Already have an account? </Text>
        <TouchableOpacity onPress={() => router.push("/auth/sign-in")}>
          <Text style={styles.link}>Sign in!</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 60, // new: slight padding from top
    backgroundColor: "#0d0d1a",
  },
  form: {
    flexGrow: 1,
    justifyContent: "flex-start", // move up toward top
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
  googleButton: {
    marginTop: 16,
    backgroundColor: "#fff",
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
  googleButtonText: {
    color: "#2a67b1",
  },
});

