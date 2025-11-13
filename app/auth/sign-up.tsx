import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { createUserWithEmailAndPassword } from "firebase/auth";
import React, { useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import LastRepLogo from "../../components/LastRepLogo"; // Static logo component
import { auth } from "../../src/config/firebaseConfig";
import { saveUserData } from "../../src/userData"; // Function to save user data in Firestore

export default function SignUp() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSignUp = async () => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const userToken = await userCredential.user.getIdToken(); // Get the Firebase ID token
      await AsyncStorage.setItem("userToken", userToken); // Save the user token

      // Create user data object
      const userData = {
        email: userCredential.user.email,
        name: userCredential.user.displayName || "New User",
        goals: "Build muscle", // Default goal
      };

      // Save the user data to Firestore
      await saveUserData(userCredential.user.uid, userData); // Write to Firestore

      // Mark the user as signed up
      await AsyncStorage.setItem("isSignedUp", "true");

      router.push("/onboarding/goal"); // Redirect to onboarding after successful sign-up
    } catch (err: any) {
      setError(err.message); // Show error message if sign-up fails
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
});
