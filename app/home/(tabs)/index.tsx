import { Stack, useRouter } from "expo-router";
import { Settings } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../../../contexts/ThemeContext";

type WorkoutSummary = {
  date: string;
  exercises: { name: string; sets: { weight: string; reps: string }[] }[];
};

export default function Home() {
  const router = useRouter();
  const { theme } = useTheme(); // 🎨 use theme context
  const [history, setHistory] = useState<WorkoutSummary[]>([]);

  useEffect(() => {
    // Later: load history from Firestore or local cache
  }, []);

  return (
    <>
      {/* Header with gear icon */}
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

      {/* Main content */}
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.background }} // ✅ Add this line
        contentContainerStyle={[
          styles.container,
          { backgroundColor: theme.background },
        ]}
      >
        <Text style={[styles.title, { color: theme.textPrimary }]}>
          Welcome back 👋
        </Text>

        <TouchableOpacity
          style={[
            styles.startButton,
            { backgroundColor: theme.primary, borderColor: theme.primary },
          ]}
          onPress={() => router.push("/workout/start")}
          activeOpacity={0.85}
        >
          <Text style={[styles.startButtonText, { color: theme.surface }]}>
            Start Workout
          </Text>
        </TouchableOpacity>

        <Text style={[styles.subtitle, { color: theme.textPrimary }]}>
          Workout History
        </Text>

        {history.length > 0 ? (
          history.map((item, index) => (
            <View
              key={index}
              style={[
                styles.card,
                {
                  backgroundColor: theme.surface,
                  borderColor: "#E5E7EB",
                },
              ]}
            >
              <Text style={[styles.cardDate, { color: theme.textPrimary }]}>
                {new Date(item.date).toLocaleDateString()}
              </Text>
              <Text style={[styles.cardDetails, { color: theme.textSecondary }]}>
                {item.exercises.length} exercises logged
              </Text>
            </View>
          ))
        ) : (
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            No workouts logged yet.
          </Text>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24 },
  title: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 24,
    marginBottom: 10,
  },
  card: {
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 14,
    borderWidth: 1,
  },
  cardDate: {
    fontSize: 15,
    fontWeight: "700",
  },
  cardDetails: {
    fontSize: 14,
    marginTop: 4,
  },
  emptyText: {
    fontSize: 15,
    marginTop: 10,
  },
  startButton: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
  },
  startButtonText: {
    fontSize: 16,
    fontWeight: "700",
  },
});
