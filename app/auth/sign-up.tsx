import { useRouter } from "expo-router";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import React, { useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { db } from "../../firebaseConfig";
import { isAuthError, signUpUser } from "../../lib/authUtils";

export default function SignUpScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSignUp = async () => {
    setError("");
    setLoading(true);

    const result = await signUpUser(email.trim(), password.trim());
    setLoading(false);

    if (result.success) {
      const user = result.user;

      try {
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

        router.replace("/onboarding/ready");
      } catch (err) {
        console.error("Error creating Firestore user doc:", err);
        setError("Error setting up your account. Please try again.");
      }
    } else if (isAuthError(result)) {
      setError(result.message);
    } else {
      setError("Unknown error during sign up.");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Account</Text>

      <TextInput
        placeholder="Email"
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <TextInput
        placeholder="Password"
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity
        style={[styles.button, loading && { opacity: 0.7 }]}
        onPress={handleSignUp}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? "Signing Up..." : "Sign Up"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push("/auth/sign-in")}>
        <Text style={styles.link}>Already have an account? Sign in</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 10,
    padding: 12,
    marginVertical: 8,
  },
  button: {
    backgroundColor: "#222",
    borderRadius: 10,
    padding: 14,
    marginTop: 12,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
    textAlign: "center",
  },
  link: {
    color: "#007AFF",
    textAlign: "center",
    marginTop: 18,
  },
  error: {
    color: "red",
    textAlign: "center",
    marginTop: 8,
  },
});
