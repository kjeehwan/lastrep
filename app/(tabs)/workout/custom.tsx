import { Href, useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function CustomWorkout() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Custom Workout</Text>
      <View style={styles.card}>
        <Text style={styles.text}>
          Build your own workout by selecting exercises and tracking sets,
          reps, and weight.
        </Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => router.push("/(tab)/workout/builder" as Href)}
        >
          <Text style={styles.buttonText}>Start Building</Text>
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
    padding: 20,
    marginBottom: 16,
  },
  text: { color: "#cfcfe6", fontSize: 15, marginBottom: 20 },
  button: {
    backgroundColor: "#7b61ff",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontWeight: "700" },
  back: { marginTop: 20, alignItems: "center" },
  backText: { color: "#7b61ff", fontWeight: "600" },
});
