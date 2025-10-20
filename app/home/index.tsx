import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Colors } from "../../styles/colors";

type WorkoutSummary = {
  date: string;
  exercises: { name: string; sets: { weight: string; reps: string }[] }[];
};

export default function Home() {
  const router = useRouter();
  const { workout } = useLocalSearchParams();
  const [history, setHistory] = useState<WorkoutSummary[]>([]);

  useEffect(() => {
    if (typeof workout === "string") {
      try {
        const parsed = JSON.parse(workout);
        if (parsed?.date && parsed?.exercises) {
          setHistory((prev) => [parsed, ...prev]);
        }
      } catch (err) {
        console.error("Invalid workout JSON:", err);
      }
    }
  }, [workout]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Welcome back 👋</Text>

      <TouchableOpacity
        style={styles.startButton}
        onPress={() => router.push("/workout/start")}
        activeOpacity={0.85}
      >
        <Text style={styles.startButtonText}>Start Workout</Text>
      </TouchableOpacity>

      <Text style={styles.subtitle}>Workout History</Text>

      {history.length > 0 ? (
        history.map((item, index) => (
          <View key={index} style={styles.card}>
            <Text style={styles.cardDate}>
              {new Date(item.date).toLocaleDateString()}
            </Text>
            <Text style={styles.cardDetails}>
              {item.exercises.length} exercises logged
            </Text>
          </View>
        ))
      ) : (
        <Text style={styles.emptyText}>No workouts logged yet.</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, backgroundColor: Colors.background },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.textPrimary,
    marginTop: 24,
    marginBottom: 10,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  cardDate: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  cardDetails: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: 15,
    marginTop: 10,
  },
  startButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
  },
  startButtonText: {
    color: Colors.surface,
    fontSize: 16,
    fontWeight: "700",
  },
});
