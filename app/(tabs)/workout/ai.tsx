import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function AiWorkout() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>AI-Suggested Workout</Text>

      <View style={styles.card}>
        <Ionicons name="sparkles-outline" size={48} color="#7b61ff" style={{ marginBottom: 10 }} />
        <Text style={styles.text}>
          LastRep’s AI coach will create a personalized workout plan based on
          your goals, experience, and availability.
        </Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => alert("AI Workout generation coming soon!")}
        >
          <Text style={styles.buttonText}>Generate Plan</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.back} onPress={() => router.back()}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0d0d1a", padding: 20, paddingTop: 56 },
  title: { color: "#fff", fontSize: 24, fontWeight: "800", marginBottom: 12 },
  card: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
  },
  text: {
    color: "#cfcfe6",
    fontSize: 15,
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 22,
  },
  button: {
    backgroundColor: "#7b61ff",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    width: "100%",
  },
  buttonText: { color: "#fff", fontWeight: "700" },
  back: { marginTop: 24, alignItems: "center" },
  backText: { color: "#7b61ff", fontWeight: "600" },
});
