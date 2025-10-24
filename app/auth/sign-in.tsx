import { Link, useRouter } from "expo-router";
import { signInWithEmailAndPassword } from "firebase/auth";
import React, { useState } from "react";
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
import { auth } from "../../firebaseConfig";

export default function SignInScreen() {
  const { theme } = useTheme();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    if (!email || !password) {
      setError("Please enter both email and password");
      return;
    }

    try {
      setError("");
      setLoading(true);

      await signInWithEmailAndPassword(auth, email.trim(), password.trim());

      // ✅ Auth listener in _layout.tsx will handle redirection to /home
      router.replace("/"); // ensures a single navigation event
    } catch (err: any) {
      console.error("Sign-in error:", err);
      let msg = "Failed to sign in.";
      if (err.code === "auth/invalid-email") msg = "Invalid email address.";
      else if (err.code === "auth/user-not-found") msg = "User not found.";
      else if (err.code === "auth/wrong-password") msg = "Incorrect password.";
      else if (err.code === "auth/too-many-requests") msg = "Too many attempts. Try again later.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <View style={styles.inner}>
        <Text style={[styles.title, { color: theme.textPrimary }]}>Sign In</Text>

        <TextInput
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          style={[
            styles.input,
            {
              backgroundColor: theme.surface,
              color: theme.textPrimary,
              borderColor: theme.border,
            },
          ]}
          placeholderTextColor={theme.placeholder}
        />

        <TextInput
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
          style={[
            styles.input,
            {
              backgroundColor: theme.surface,
              color: theme.textPrimary,
              borderColor: theme.border,
            },
          ]}
          placeholderTextColor={theme.placeholder}
        />

        {error ? (
          <Text style={[styles.error, { color: theme.primary }]}>{error}</Text>
        ) : null}

        <TouchableOpacity
          style={[
            styles.button,
            { backgroundColor: theme.primary },
            loading && { opacity: 0.7 },
          ]}
          onPress={handleSignIn}
          disabled={loading}
          activeOpacity={0.85}
        >
          <Text style={[styles.buttonText, { color: theme.buttonText }]}>
            {loading ? "Signing in..." : "Sign In"}
          </Text>
        </TouchableOpacity>

        <Link href="/auth/sign-up" asChild>
          <TouchableOpacity>
            <Text style={[styles.link, { color: theme.primary }]}>
              Don’t have an account? Sign up now
            </Text>
          </TouchableOpacity>
        </Link>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
    marginBottom: 24,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 15,
    marginBottom: 14,
    fontSize: 16,
  },
  error: {
    textAlign: "center",
    marginBottom: 10,
    fontSize: 14,
  },
  button: {
    borderRadius: 10,
    paddingVertical: 15,
    marginTop: 8,
  },
  buttonText: {
    textAlign: "center",
    fontSize: 16,
    fontWeight: "700",
  },
  link: {
    textAlign: "center",
    marginTop: 20,
    fontSize: 14,
    fontWeight: "500",
  },
});
