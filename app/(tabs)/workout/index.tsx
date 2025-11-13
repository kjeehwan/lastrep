// app/workout/index.tsx
import { Href, useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function WorkoutIndex() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Workout</Text>

      <View style={styles.card}>
        <Text style={styles.cardText}>Start your session</Text>
        <TouchableOpacity style={styles.primary} onPress={() => router.push("/(tab)/workout/custom" as Href)}>
          <Text style={styles.primaryText}>Set Up My Workout</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondary} onPress={() => router.push("/(tab)/workout/ai" as Href)}>
          <Text style={styles.secondaryText}>AI Suggestion</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Recent Templates</Text>
        <Text style={styles.muted}>No templates yet.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0d0d1a", padding: 20, paddingTop: 56 },
  title: { color: "#fff", fontSize: 24, fontWeight: "800", marginBottom: 12 },
  card: { backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 16, padding: 18, marginBottom: 14 },
  cardText: { color: "#cfcfe6", marginBottom: 14 },
  cardTitle: { color: "#fff", fontSize: 16, fontWeight: "700", marginBottom: 8 },
  primary: { backgroundColor: "#7b61ff", paddingVertical: 12, borderRadius: 12, alignItems: "center", marginBottom: 10 },
  primaryText: { color: "#fff", fontWeight: "700" },
  secondary: { backgroundColor: "#fff", paddingVertical: 12, borderRadius: 12, alignItems: "center" },
  secondaryText: { color: "#7b61ff", fontWeight: "700" },
  muted: { color: "#9aa", fontStyle: "italic" },
});
