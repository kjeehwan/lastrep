import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { Href, useRouter } from "expo-router";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { collection, doc, getDoc, getDocs, query, setDoc, Timestamp, where } from "firebase/firestore";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { db } from "../../src/config/firebaseConfig"; // adjust path if needed

type PlanDay = { name: string; exercises: string[] };
type Plan = { goal: string; experience: string; startDate: string; split: PlanDay[] };

const PLAN_TEMPLATES: Record<string, PlanDay[]> = {
  "push-pull-legs": [
    { name: "Push", exercises: ["Bench Press", "Overhead Press", "Incline DB Press", "Triceps Pushdown"] },
    { name: "Pull", exercises: ["Deadlift", "Barbell Row", "Lat Pulldown", "Bicep Curl"] },
    { name: "Legs", exercises: ["Squat", "Romanian Deadlift", "Leg Press", "Calf Raise"] },
  ],
  "upper-lower": [
    { name: "Upper", exercises: ["Bench Press", "Row", "Overhead Press", "Pull Ups"] },
    { name: "Lower", exercises: ["Squat", "Deadlift", "Lunges", "Leg Curl"] },
  ],
  "full-body": [
    { name: "Full Body A", exercises: ["Squat", "Bench Press", "Row", "Plank"] },
    { name: "Full Body B", exercises: ["Deadlift", "Overhead Press", "Pull Ups", "Farmer Walk"] },
  ],
};

const buildPlan = (goal: string, experience: string): PlanDay[] => {
  // simple mapping: heavier frequency for advanced
  if (experience === "advanced") return PLAN_TEMPLATES["push-pull-legs"];
  if (experience === "intermediate") return PLAN_TEMPLATES["upper-lower"];
  return PLAN_TEMPLATES["full-body"];
};

const getTodaySuggestion = (plan: Plan | null): PlanDay | null => {
  if (!plan || !plan.split?.length) return null;
  const start = new Date(plan.startDate);
  const today = new Date();
  const startMid = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const diffDays = Math.max(0, Math.floor((todayMid - startMid) / (1000 * 60 * 60 * 24)));
  const idx = diffDays % plan.split.length;
  return plan.split[idx];
};

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [nickname, setNickname] = useState<string | null>(null);
  const [weeklyStats, setWeeklyStats] = useState({ workouts: 0, sets: 0, volumeKg: 0 });
  const [readinessScore, setReadinessScore] = useState<number | null>(null);
  const [lastReadiness, setLastReadiness] = useState<{ score: number | null; updatedAt?: Date }>({
    score: null,
    updatedAt: undefined,
  });
  const [savingReadiness, setSavingReadiness] = useState(false);
  const [plan, setPlan] = useState<any>(null);
  const [planGoal, setPlanGoal] = useState<string>("build-muscle");
  const [planExperience, setPlanExperience] = useState<string>("beginner");
  const router = useRouter();
  const auth = getAuth();
  const todaySuggestion = useMemo(() => getTodaySuggestion(plan), [plan]);

  const fetchStats = useCallback(
    async (uid: string) => {
      try {
        const sevenDaysAgo = Timestamp.fromDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
        const workoutsRef = collection(db, "users", uid, "workouts");
        const q = query(workoutsRef, where("endedAt", ">=", sevenDaysAgo));
        const docs = await getDocs(q);
        let workouts = 0;
        let sets = 0;
        let volumeKg = 0;
        docs.forEach((d) => {
          const data: any = d.data();
          workouts += 1;
          sets += Number(data.totalSets || 0);
          volumeKg += Number(data.totalVolumeKg || 0);
        });
        setWeeklyStats({ workouts, sets, volumeKg });
      } catch (e) {
        console.log("Error fetching weekly stats", e);
      }
    },
    []
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) router.push("/auth/sign-in");
      else {
        setUser(user);
        try {
          const ref = doc(db, "users", user.uid);
          const snap = await getDoc(ref);
          if (snap.exists()) {
            const data = snap.data();
            if (data.nickname) setNickname(data.nickname);
            if (data.readiness?.score !== undefined) {
              setReadinessScore(data.readiness.score);
              setLastReadiness({
                score: data.readiness.score,
                updatedAt: data.readiness.updatedAt?.toDate
                  ? data.readiness.updatedAt.toDate()
                  : undefined,
              });
            }
            if (data.plan) {
              setPlan({
                ...data.plan,
                startDate: data.plan.startDate?.toDate
                  ? data.plan.startDate.toDate().toISOString()
                  : data.plan.startDate || new Date().toISOString(),
              });
            }
          }
          fetchStats(user.uid);
        } catch (e) {
          console.log("Error fetching nickname:", e);
        }
      }
    });
    return unsubscribe;
  }, [fetchStats]);

  useFocusEffect(
    useCallback(() => {
      if (user?.uid) {
        fetchStats(user.uid);
      }
    }, [fetchStats, user?.uid])
  );

  const saveReadiness = async () => {
    if (!user?.uid || readinessScore === null) return;
    try {
      setSavingReadiness(true);
      await setDoc(
        doc(db, "users", user.uid),
        { readiness: { score: readinessScore, updatedAt: Timestamp.now() } },
        { merge: true }
      );
      setLastReadiness({ score: readinessScore, updatedAt: new Date() });
    } catch (e) {
      console.log("Error saving readiness", e);
    } finally {
      setSavingReadiness(false);
    }
  };

  const savePlan = async () => {
    if (!user?.uid) return;
    try {
      const split = buildPlan(planGoal, planExperience);
      const payload = {
        plan: {
          goal: planGoal,
          experience: planExperience,
          startDate: Timestamp.now(),
          split,
        },
      };
      await setDoc(doc(db, "users", user.uid), payload, { merge: true });
      setPlan({
        goal: planGoal,
        experience: planExperience,
        startDate: new Date().toISOString(),
        split,
      });
    } catch (e) {
      console.log("Error saving plan", e);
    }
  };

  const resetPlan = async () => {
    if (!user?.uid) return;
    try {
      await setDoc(doc(db, "users", user.uid), { plan: null }, { merge: true });
      setPlan(null);
    } catch (e) {
      console.log("Error resetting plan", e);
    }
  };

  if (!user) return null;

  // Navigate to Settings page
  const navigateToSettings = () => {
    router.push("/settings");  // Navigate to settings page
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        {/* Left side: Greeting */}
        <View style={styles.headerLeft}>
          <Text>
            <Text style={styles.greeting}>Welcome, </Text>
            <Text style={styles.userName}>
              {nickname ? nickname : user.email?.split("@")[0]}
            </Text>
          </Text>
        </View>

        {/* Right side: Icons */}
        <View style={styles.iconContainer}>
          <TouchableOpacity onPress={() => router.push("../profile" as Href)}>
            <Ionicons name="person-circle-outline" size={32} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={navigateToSettings}  // Navigate to settings when gear icon is pressed
            style={{ marginLeft: 14 }}
          >
            <Ionicons name="settings-outline" size={28} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content */}
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Today’s Workout */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Today's Workout</Text>
          <View style={styles.card}>
            <Text style={styles.cardText}>Start logging your next session.</Text>
            <TouchableOpacity
              style={styles.primaryButtonWide}
              onPress={() => router.push("/(tabs)/workout/log" as Href)}
            >
              <Text style={styles.primaryText}>Start Workout</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Readiness</Text>
          <View style={styles.card}>
            <Text style={styles.cardText}>How ready do you feel to train today?</Text>
            <View style={styles.readinessRow}>
              {[1, 2, 3, 4, 5].map((val) => {
                const active = readinessScore === val;
                return (
                  <TouchableOpacity
                    key={val}
                    style={[styles.readinessButton, active && styles.readinessButtonActive]}
                    onPress={() => setReadinessScore(val)}
                  >
                    <Text style={[styles.readinessButtonText, active && styles.readinessButtonTextActive]}>
                      {val}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity
              style={[
                styles.primaryButtonWide,
                { marginTop: 8, opacity: readinessScore === null || savingReadiness ? 0.6 : 1 },
              ]}
              disabled={readinessScore === null || savingReadiness}
              onPress={saveReadiness}
            >
              <Text style={styles.primaryText}>{savingReadiness ? "Saving..." : "Save readiness"}</Text>
            </TouchableOpacity>
            <Text style={[styles.cardText, { marginTop: 10 }]}>
              {lastReadiness.score !== null
                ? `Last saved: ${lastReadiness.score}/5${
                    lastReadiness.updatedAt
                      ? ` · ${lastReadiness.updatedAt.toLocaleDateString()} ${lastReadiness.updatedAt.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}`
                      : ""
                  }`
              : "Not saved yet"}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Guided plan</Text>
          <View style={styles.card}>
            {plan ? (
              <>
                <View style={styles.planHeader}>
                  <Text style={styles.cardText}>
                    Goal: {plan.goal?.replace("-", " ")} · {plan.experience}
                  </Text>
                  <TouchableOpacity onPress={resetPlan}>
                    <Text style={styles.link}>Change</Text>
                  </TouchableOpacity>
                </View>
                {todaySuggestion ? (
                  <>
                    <Text style={[styles.cardText, { marginBottom: 8 }]}>
                      Today: {todaySuggestion.name}
                    </Text>
                    <View style={styles.bulletList}>
                      {todaySuggestion.exercises.map((ex: string) => (
                        <Text key={ex} style={styles.bulletItem}>
                          • {ex}
                        </Text>
                      ))}
                    </View>
                    <View style={styles.buttonRow}>
                      <TouchableOpacity
                        style={styles.primaryButton}
                        onPress={() => router.push("/(tabs)/workout/log" as Href)}
                      >
                        <Text style={styles.primaryText}>Start suggested</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.secondaryButton}
                        onPress={() => router.push("/(tabs)/workout/log" as Href)}
                      >
                        <Text style={styles.secondaryText}>Start freestyle</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <Text style={styles.cardText}>No suggestion for today.</Text>
                )}
              </>
            ) : (
              <>
                <Text style={styles.cardText}>Pick a split and we’ll suggest today’s workout.</Text>
                <Text style={styles.smallLabel}>Goal</Text>
                <View style={styles.chipRow}>
                  {[
                    { key: "build-muscle", label: "Build muscle" },
                    { key: "lose-fat", label: "Lose fat" },
                    { key: "general-fitness", label: "General" },
                  ].map((g) => (
                    <TouchableOpacity
                      key={g.key}
                      style={[styles.chip, planGoal === g.key && styles.chipActive]}
                      onPress={() => setPlanGoal(g.key)}
                    >
                      <Text style={[styles.chipText, planGoal === g.key && styles.chipTextActive]}>
                        {g.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.smallLabel}>Experience</Text>
                <View style={styles.chipRow}>
                  {["beginner", "intermediate", "advanced"].map((lvl) => (
                    <TouchableOpacity
                      key={lvl}
                      style={[styles.chip, planExperience === lvl && styles.chipActive]}
                      onPress={() => setPlanExperience(lvl)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          planExperience === lvl && styles.chipTextActive,
                        ]}
                      >
                        {lvl}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity style={[styles.primaryButtonWide, { marginTop: 8 }]} onPress={savePlan}>
                  <Text style={styles.primaryText}>Save plan</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        {/* Stats Summary Placeholder */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>This Week</Text>
          <View style={styles.statsCard}>
            <Text style={styles.statsText}>Workouts Completed: {weeklyStats.workouts}</Text>
            <Text style={styles.statsText}>Total Sets: {weeklyStats.sets}</Text>
            <Text style={styles.statsText}>Total Weight Lifted: {Math.round(weeklyStats.volumeKg * 10) / 10} kg</Text>
          </View>
        </View>

        {/* Motivation / Quote */}
        <View style={styles.motivationCard}>
          <Text style={styles.quote}>
            “One more rep isn’t just a number — it’s a mindset.” 💪
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0d0d1a",
    paddingHorizontal: 20,
    paddingTop: 50,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  headerLeft: {
    flexShrink: 1,
  },
  greeting: {
    color: "#ccc",
    fontSize: 20,
    fontWeight: "600",
  },
  userName: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
  },
  iconContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  scrollContent: {
    paddingBottom: 100,
  },
  section: {
    marginTop: 20,
  },
  sectionTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 10,
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 16,
    padding: 20,
  },
  cardText: { color: "#aaa", fontSize: 15, marginBottom: 16 },
  link: { color: "#7b61ff", fontWeight: "700" },
  smallLabel: { color: "#ccc", fontSize: 13, marginTop: 4, marginBottom: 6 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 6 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  chipActive: { backgroundColor: "#7b61ff", borderColor: "#7b61ff" },
  chipText: { color: "#d8daec", fontWeight: "700" },
  chipTextActive: { color: "#0d0d1a" },
  planHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  bulletList: { gap: 4, marginBottom: 10 },
  bulletItem: { color: "#d8daec" },
  buttonRow: { flexDirection: "row", gap: 10, marginTop: 10 },
  readinessRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 8, marginBottom: 8 },
  readinessButton: {
    flex: 1,
    marginHorizontal: 4,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
  },
  readinessButtonActive: {
    backgroundColor: "#7b61ff",
    borderColor: "#7b61ff",
  },
  readinessButtonText: { color: "#d2d3e0", fontWeight: "700" },
  readinessButtonTextActive: { color: "#0d0d1a" },
  primaryButtonWide: {
    backgroundColor: "#7b61ff",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryButton: {
    backgroundColor: "#7b61ff",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flex: 1,
    alignItems: "center",
  },
  primaryText: {
    color: "#fff",
    fontWeight: "700",
  },
  secondaryButton: {
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flex: 1,
    alignItems: "center",
    marginLeft: 8,
  },
  secondaryText: {
    color: "#7b61ff",
    fontWeight: "700",
  },
  statsCard: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 16,
    padding: 20,
  },
  statsText: {
    color: "#ccc",
    fontSize: 15,
    marginBottom: 6,
  },
  motivationCard: {
    marginTop: 25,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 16,
    padding: 20,
  },
  quote: {
    color: "#fff",
    fontSize: 16,
    fontStyle: "italic",
    textAlign: "center",
  },
});
