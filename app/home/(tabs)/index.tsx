import { Stack, useRouter } from "expo-router";
import { getAuth } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { Settings } from "lucide-react-native";
import React, { useEffect, useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../../../contexts/ThemeContext";
import { db } from "../../../firebaseConfig";
import { cacheGet, cacheSet } from "../../../lib/cache"; // 🧠 cache integration

type WorkoutSummary = {
  date: string;
  exercises: { name: string; sets: { weight: string; reps: string }[] }[];
};

export default function Home() {
  const router = useRouter();
  const { theme } = useTheme();
  const auth = getAuth();
  const user = auth.currentUser;

  const [history, setHistory] = useState<WorkoutSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadWorkoutHistory = async () => {
      if (!user) return;

      // 1️⃣ Load from cache first for instant display
      const cached = await cacheGet<WorkoutSummary[]>("workout_history", []);
      if (cached && cached.length > 0) {
        setHistory(cached);
        setLoading(false);
      }

      // 2️⃣ Then fetch latest from Firestore (if online)
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) {
          const data = snap.data();
          const workouts = data.workoutHistory || [];
          setHistory(workouts);
          await cacheSet("workout_history", workouts); // 🆕 store updated cache
        }
      } catch (err) {
        console.warn("Failed to fetch workout history:", err);
      } finally {
        setLoading(false);
      }
    };

    loadWorkoutHistory();
  }, [user]);

  // ✅ Memoized styles to respond to theme changes efficiently
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flexGrow: 1,
          backgroundColor: theme.background,
          padding: 24,
        },
        title: {
          fontSize: 24,
          fontWeight: "700",
          color: theme.textPrimary,
          marginBottom: 16,
        },
        subtitle: {
          fontSize: 18,
          fontWeight: "600",
          color: theme.textPrimary,
          marginTop: 24,
          marginBottom: 10,
        },
        card: {
          borderRadius: 14,
          paddingVertical: 16,
          paddingHorizontal: 20,
          marginBottom: 14,
          borderWidth: 1,
          borderColor: theme.border,
          backgroundColor: theme.surface,
        },
        cardDate: {
          fontSize: 15,
          fontWeight: "700",
          color: theme.textPrimary,
        },
        cardDetails: {
          fontSize: 14,
          marginTop: 4,
          color: theme.textSecondary,
        },
        emptyText: {
          fontSize: 15,
          color: theme.textSecondary,
          marginTop: 10,
        },
        startButton: {
          backgroundColor: theme.primary,
          borderRadius: 14,
          paddingVertical: 16,
          alignItems: "center",
        },
        startButtonText: {
          fontSize: 16,
          fontWeight: "700",
          color: theme.buttonText,
        },
      }),
    [theme]
  );

  return (
    <>
      {/* 🧭 Header */}
      <Stack.Screen
        options={{
          title: "Home",
          headerTitleStyle: {
            color: theme.textPrimary,
            fontWeight: "700",
            fontSize: 20,
          },
          headerStyle: { backgroundColor: theme.surface },
          headerRight: () => (
            <TouchableOpacity
              onPress={() => router.push("/home/settings")}
              style={{ marginRight: 16 }}
              activeOpacity={0.7}
            >
              <Settings size={22} color={theme.textPrimary} />
            </TouchableOpacity>
          ),
        }}
      />

      {/* 🏠 Main content */}
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.background }}
        contentContainerStyle={styles.container}
      >
        <Text style={styles.title}>Welcome back 👋</Text>

        <TouchableOpacity
          style={styles.startButton}
          onPress={() => router.push("/workout/start")}
          activeOpacity={0.85}
        >
          <Text style={styles.startButtonText}>Start Workout</Text>
        </TouchableOpacity>

        <Text style={styles.subtitle}>Workout History</Text>

        {loading ? (
          <Text style={styles.emptyText}>Loading...</Text>
        ) : history.length > 0 ? (
          history.map((item, index) => (
            <View key={index} style={styles.card}>
              <Text style={styles.cardDate}>
                {item.date ? new Date(item.date).toLocaleDateString() : "No date available"}
              </Text>
              <Text style={styles.cardDetails}>
                {item.exercises && item.exercises.length > 0
                  ? `${item.exercises.length} exercises logged`
                  : "No exercises logged"}
              </Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>No workouts logged yet.</Text>
        )}

      </ScrollView>
    </>
  );
}
