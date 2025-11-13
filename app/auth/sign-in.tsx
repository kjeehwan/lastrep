import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { signInWithEmailAndPassword } from "firebase/auth";
import React, { useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import LastRepLogo from "../../components/LastRepLogo"; // Static logo component
import { auth } from "../../src/config/firebaseConfig";
import { getUserData } from "../../src/userData"; // Function to fetch user data from Firestore

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSignIn = async () => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const userToken = await userCredential.user.getIdToken(); // Get the Firebase ID token
      await AsyncStorage.setItem("userToken", userToken); // Store the user token

      // Fetch user data from Firestore
      const userData = await getUserData(userCredential.user.uid); // Fetch user data
      console.log(userData); // You can use user data here if needed

      router.push("/home"); // Redirect to home after successful sign-in
    } catch (err: any) {
      setError(err.message); // Display error if sign-in fails
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

      <TouchableOpacity style={styles.button} onPress={handleSignIn}>
        <Text style={styles.buttonText}>Sign In</Text>
      </TouchableOpacity>

      {/* Link to Sign-Up */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Don’t have an account? </Text>
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

