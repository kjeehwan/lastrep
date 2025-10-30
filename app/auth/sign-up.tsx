import { useRouter } from "expo-router";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { db } from "../../src/config/firebaseConfig";
import { useTheme } from "../../src/contexts/ThemeContext";
import { signUpUser } from "../../src/lib/auth/authUtils";

export default function SignUpScreen() {
  const router = useRouter();
  const { theme } = useTheme();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    setError("");
    setLoading(true);

    const result = await signUpUser(email.trim(), password.trim());
    setLoading(false);

    if (result.success) {
      const user = result.user;

      try {
        // Ensure the Firestore user document is created using setDoc
        await setDoc(doc(db, "users", user.uid), {
          email: user.email,
          displayName: null,
          createdAt: serverTimestamp(),
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

        // Proceed to the ready screen after document creation
        router.replace("/onboarding/ready");
      } catch (err) {
        console.error("Error creating Firestore user doc:", err);
        setError("Error setting up your account. Please try again.");
      }
    } else {
      setError("Sign-up failed. Please try again.");
    }
  };

  const styles = StyleSheet.create({
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
  });

  return (
    <View style={styles.inner}>
      <Text style={styles.title}>Create Account</Text>

      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        style={styles.input}
      />

      <TextInput
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={styles.input}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity
        style={[styles.button, loading && { opacity: 0.7 }]}
        onPress={handleSignUp}
        disabled={loading}
      >
        <Text style={styles.buttonText}>{loading ? "Signing Up..." : "Sign Up"}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.push("/auth/sign-in")}
      >
        <Text style={styles.link}>Already have an account? Sign in</Text>
      </TouchableOpacity>
    </View>
  );
}
