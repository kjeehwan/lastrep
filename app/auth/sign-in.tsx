import { Link, useRouter } from "expo-router";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import React, { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { auth, db } from "../../firebaseConfig";
import { useGoogleAuth } from "../../lib/auth/googleAuth"; // Import Google sign-in hook

export default function SignInScreen() {
  const { theme } = useTheme();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { promptAsync } = useGoogleAuth(); // Get Google sign-in function from the hook

  const handleSignIn = async () => {
    if (!email || !password) {
      setError("Please enter both email and password");
      return;
    }

    try {
      setError("");
      setLoading(true);
      await signInWithEmailAndPassword(auth, email.trim(), password.trim());

      const user = auth.currentUser;
      if (user) {
        const userRef = doc(db, "users", user.uid);

        // Check if the user document exists in Firestore
        const snap = await getDoc(userRef);

        if (!snap.exists()) {
          // If no document exists, create the user document using setDoc()
          await setDoc(userRef, {
            email: user.email,
            displayName: null,
            createdAt: new Date(),
            hasCompletedOnboarding: false,
            goal: null,
            experience: null,
            trainingDays: null,
            samplePlan: null,
            profile: {
              gender: null,
              age: null,
              height: null,
              weight: null,
              units: "metric",
            },
            stats: {
              totalWorkouts: 0,
              lastWorkout: null,
            },
          });
          console.log("User document created in Firestore.");
        }

        // Now, safely access the data after ensuring the document exists
        const data = snap.data();
        if (!data) {
          console.log("No data found in Firestore document.");
          return;
        }

        // Check for missing data and redirect to appropriate screen
        if (!data.goal) {
          router.replace("/onboarding/goal"); // Redirect to goal screen if missing
        } else if (!data.experience) {
          router.replace("/onboarding/experience"); // Redirect to experience screen if missing
        } else if (!data.trainingDays) {
          router.replace("/onboarding/availability"); // Redirect to availability screen if missing
        } else if (!data.hasCompletedOnboarding) {
          router.replace("/onboarding/preview"); // Redirect to preview screen if onboarding incomplete
        } else {
          router.replace("/home"); // If everything is completed, redirect to home screen
        }
      }
    } catch (err: any) {
      console.error("Sign-in error:", err);
      let msg = "Failed to sign in.";
      if (err.code === "auth/invalid-email") msg = "Invalid email address.";
      else if (err.code === "auth/user-not-found") msg = "User not found.";
      else if (err.code === "auth/wrong-password") msg = "Incorrect password.";
      else if (err.code === "auth/too-many-requests")
        msg = "Too many attempts. Try again later.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Memoized styles for consistent theme switching
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: theme.background,
        },
        inner: {
          flex: 1,
          justifyContent: "center",
          alignSelf: "center",
          width: "100%",
          maxWidth: 480,
          padding: 20,
        },
        title: {
          fontSize: 26,
          fontWeight: "700",
          textAlign: "center",
          color: theme.textPrimary,
          marginBottom: 24,
        },
        input: {
          height: 50,
          borderWidth: 1,
          borderRadius: 10,
          paddingHorizontal: 15,
          marginBottom: 14,
          fontSize: 16,
          backgroundColor: theme.surface,
          borderColor: theme.border,
          color: theme.textPrimary,
        },
        error: {
          textAlign: "center",
          color: theme.primary,
          marginBottom: 10,
          fontSize: 14,
        },
        button: {
          backgroundColor: theme.primary,
          borderRadius: 10,
          paddingVertical: 15,
          marginTop: 8,
          alignItems: "center",
        },
        buttonText: {
          color: theme.onPrimary,
          textAlign: "center",
          fontSize: 16,
          fontWeight: "700",
        },
        link: {
          textAlign: "center",
          color: theme.primary,
          marginTop: 20,
          fontSize: 14,
          fontWeight: "500",
        },
        googleButton: {
          backgroundColor: "#4285F4", // Google's Blue
          borderRadius: 10,
          paddingVertical: 15,
          marginTop: 14,
          alignItems: "center",
        },
        googleButtonText: {
          color: "white",
          fontWeight: "700",
          fontSize: 16,
        },
      }),
    [theme]
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <View style={styles.inner}>
        <Text style={styles.title}>Sign In</Text>

        <TextInput
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          style={styles.input}
          placeholderTextColor={theme.placeholder}
        />

        <TextInput
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
          style={styles.input}
          placeholderTextColor={theme.placeholder}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.button, loading && { opacity: 0.7 }]}
          onPress={handleSignIn}
          disabled={loading}
          activeOpacity={0.85}
        >
          <Text style={styles.buttonText}>
            {loading ? "Signing in..." : "Sign In"}
          </Text>
        </TouchableOpacity>

        {/* Google Sign-In Button */}
        <TouchableOpacity
          style={styles.googleButton}
          onPress={async () => {
            try {
              console.log("Triggering Google Sign-In...");
              await promptAsync(); // Trigger Google Sign-In flow
            } catch (error) {
              console.error("Google Sign-In error:", error);
            }
          }}
        >
          <Text style={styles.googleButtonText}>Sign in with Google</Text>
        </TouchableOpacity>

        <Link href="/auth/sign-up" asChild>
          <TouchableOpacity activeOpacity={0.7}>
            <Text style={styles.link}>
              Don’t have an account? Sign up now
            </Text>
          </TouchableOpacity>
        </Link>
      </View>
    </KeyboardAvoidingView>
  );
}
