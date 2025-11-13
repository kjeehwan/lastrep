import { useRouter } from "expo-router";
import { getAuth } from "firebase/auth";
import { MotiView } from "moti";
import React, { useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import OnboardingLayout from "../../components/OnboardingLayout";
import { saveUserData } from "../../src/userData"; // Import Firestore save function

const NicknameScreen = () => {
  const [nickname, setNickname] = useState("");
  const router = useRouter();

  const handleFinish = async () => {
    // Save nickname to Firestore
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) {
      console.error("No authenticated user found");
      return;
    }
    const userId = user.uid;
    await saveUserData(userId, { nickname }); // Save nickname to Firestore
    router.push("/onboarding/preview"); // Navigate to the home screen after saving the nickname
  };

  return (
    <OnboardingLayout
      title="What’s your nickname?"
      onSkip={() => router.push("/home")}
    >
      <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ duration: 400 }}
          style={styles.inputContainer}
        >
          <TextInput
            style={styles.input}
            value={nickname}
            onChangeText={setNickname}
            placeholder="Enter your nickname"
            placeholderTextColor="#888"
          />
        </MotiView>

        <MotiView
          from={{ opacity: 0, translateY: 10 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ delay: 300, duration: 400 }}
        >
          <TouchableOpacity
            style={[styles.button, !nickname && styles.disabled]}
            disabled={!nickname}
            onPress={handleFinish}
          >
            <Text style={styles.buttonText}>Finish</Text>
          </TouchableOpacity>
        </MotiView>
      </SafeAreaView>
    </OnboardingLayout>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, justifyContent: "center" },
  inputContainer: { flex: 1, justifyContent: "center" },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    marginBottom: 20,
    backgroundColor: "#fff",
  },
  button: {
    backgroundColor: "#2a67b1",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  disabled: { opacity: 0.5 },
  buttonText: { color: "#fff", fontSize: 18, fontWeight: "700" },
});

export default NicknameScreen;
