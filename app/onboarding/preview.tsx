import { useRouter } from "expo-router";
import { getAuth } from "firebase/auth";
import { MotiView } from "moti";
import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import OnboardingLayout from "../../components/OnboardingLayout";
import { getUserData } from "../../src/userData";
import { buildSampleProgramDays } from "../../src/workouts/program";

type DayPlan = {
  dayLabel: string;
  title: string;
  exercises: string[];
  durationMinutes: number | null;
};

const LEGACY_AVAILABILITY_MAP: Record<string, number> = {
  "2-3": 3,
  "4-5": 5,
  "6+": 6,
};

const parseAvailabilityDays = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    const clamped = Math.max(1, Math.min(7, Math.round(value)));
    return clamped;
  }
  if (typeof value === "string") {
    const normalized = value.trim();
    if (normalized in LEGACY_AVAILABILITY_MAP) return LEGACY_AVAILABILITY_MAP[normalized];
    if (/^\d+$/.test(normalized)) {
      const parsed = Number(normalized);
      if (Number.isFinite(parsed)) return Math.max(1, Math.min(7, Math.round(parsed)));
    }
  }
  return null;
};

const buildSevenDayPlan = (availabilityDays: number): DayPlan[] => {
  const days = buildSampleProgramDays(availabilityDays);
  return days.map((day) => ({
    dayLabel: `Day ${day.dayNumber}`,
    title: day.title,
    durationMinutes: day.type === "workout" ? 65 : null,
    exercises: day.exercises ?? [],
  }));
};

export default function PreviewScreen() {
  const router = useRouter();
  const [availabilityDays, setAvailabilityDays] = useState(4);

  useEffect(() => {
    let cancelled = false;
    const auth = getAuth();
    const currentUser = auth.currentUser;
    if (!currentUser) return () => void 0;

    (async () => {
      try {
        const userData = await getUserData(currentUser.uid);
        const parsed = parseAvailabilityDays(userData?.availabilityDays ?? userData?.availability);
        if (!cancelled && parsed != null) {
          setAvailabilityDays(parsed);
        }
      } catch (error) {
        console.log("Failed to load onboarding preview context", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const weekPlan = useMemo(() => buildSevenDayPlan(availabilityDays), [availabilityDays]);

  return (
    <OnboardingLayout
      title="Your Sample Program"
      showSkip={false}
      onBack={() => router.push("/onboarding/nickname")}
    >
      <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
        <Text style={styles.subtitle}>
          Based on your availability:{" "}
          <Text style={styles.subtitleStrong}>{availabilityDays} days/week</Text>
        </Text>

        <ScrollView contentContainerStyle={styles.planList} showsVerticalScrollIndicator={false}>
          {weekPlan.map((day, index) => (
            <MotiView
              key={`${day.dayLabel}-${day.title}`}
              from={{ opacity: 0, translateY: 16 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ delay: index * 70, duration: 350 }}
              style={styles.dayCard}
            >
              <View style={styles.dayHeaderRow}>
                <Text style={styles.dayLabel}>{day.dayLabel}</Text>
                <Text style={styles.dayTitle}>{day.title}</Text>
              </View>
              {day.durationMinutes ? (
                <Text style={styles.durationText}>Estimated session: {day.durationMinutes} min</Text>
              ) : (
                <Text style={styles.restText}>No lifting session scheduled.</Text>
              )}
              {day.exercises.map((exercise) => (
                <Text key={`${day.dayLabel}-${exercise}`} style={styles.exerciseText}>
                  • {exercise}
                </Text>
              ))}
            </MotiView>
          ))}
        </ScrollView>

        <View style={styles.healthSyncCard}>
          <Text style={styles.healthSyncTitle}>Optional health sync</Text>
          <Text style={styles.healthSyncText}>
            You can connect Samsung Health later to import sleep and body composition data into Lastrep.
          </Text>
          <Text style={styles.healthSyncText}>
            Lastrep asks for consent before reading health data, and you can manage it later in Profile.
          </Text>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.confirmButton}
            onPress={() => router.push("/(tabs)/home")}
          >
            <Text style={styles.confirmText}>Start Lastrep</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    gap: 14,
  },
  subtitle: {
    color: "#e7e9f7",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 2,
  },
  subtitleStrong: {
    color: "#fff",
    fontWeight: "800",
  },
  planList: {
    gap: 10,
    paddingBottom: 6,
  },
  dayCard: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    gap: 5,
  },
  dayHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dayLabel: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
    overflow: "hidden",
  },
  dayTitle: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
    flex: 1,
  },
  durationText: {
    color: "#e3d8ff",
    fontSize: 12,
    fontWeight: "700",
  },
  restText: {
    color: "#d8dcef",
    fontSize: 12,
    fontStyle: "italic",
  },
  exerciseText: {
    color: "#eef0fb",
    fontSize: 13,
    lineHeight: 18,
  },
  actionRow: {
    marginTop: 2,
  },
  healthSyncCard: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    gap: 6,
  },
  healthSyncTitle: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
  },
  healthSyncText: {
    color: "#dfe5fa",
    fontSize: 13,
    lineHeight: 18,
  },
  confirmButton: {
    backgroundColor: "#2a67b1",
    minHeight: 52,
    width: "100%",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  confirmText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
  },
});
