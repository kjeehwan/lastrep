import { Ionicons } from "@expo/vector-icons";
import { Href, Redirect, useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import React, { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth } from "../../../src/config/firebaseConfig";
import {
  DEFAULT_CALORIE_TARGETS_BY_DIET_PHASE,
  normalizeCalorieTargets,
  saveNutritionProfile,
} from "../../../src/nutrition/meals";
import { getUserData, saveUserData } from "../../../src/userData";

const goals = [
  { key: "buildMuscle", label: "Build Muscle" },
  { key: "loseFat", label: "Lose Fat" },
  { key: "getStronger", label: "Get Stronger" },
  { key: "improveFitness", label: "Improve Fitness" },
];

// Phase 2A: keep only nickname + goal for prompts; remove body metrics
export default function ProfileIndex() {
  const router = useRouter();
  const [uid, setUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [goal, setGoal] = useState("");
  const [nickname, setNickname] = useState("");
  const [cutCalories, setCutCalories] = useState("");
  const [maintainCalories, setMaintainCalories] = useState("");
  const [bulkCalories, setBulkCalories] = useState("");
  const [redirectTo, setRedirectTo] = useState<Href | null>(null);

  const handleGoBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/home");
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setRedirectTo("/auth/sign-in");
        return;
      }
      setUid(user.uid);
      try {
        const data = await getUserData(user.uid);
        if (data?.goal) setGoal(data.goal);
        if (data?.nickname) setNickname(data.nickname);
        const calorieTargets = normalizeCalorieTargets(
          data?.nutritionProfile?.calorieTargetsByDietPhase
        );
        setCutCalories(
          calorieTargets.Cut == null ? "" : String(calorieTargets.Cut)
        );
        setMaintainCalories(
          calorieTargets.Maintain == null ? "" : String(calorieTargets.Maintain)
        );
        setBulkCalories(
          calorieTargets.Bulk == null ? "" : String(calorieTargets.Bulk)
        );
      } catch (e) {
        console.log("Error fetching user data", e);
      } finally {
        setLoading(false);
      }
    });
    return unsub;
  }, []);

  const save = async () => {
    if (!uid) return;
    const fields = [
      { label: "Cut", value: cutCalories },
      { label: "Maintain", value: maintainCalories },
      { label: "Bulk", value: bulkCalories },
    ] as const;

    const parsedTargets = { ...DEFAULT_CALORIE_TARGETS_BY_DIET_PHASE };
    for (const field of fields) {
      const trimmed = field.value.trim();
      if (!trimmed) continue;

      const parsed = Number(trimmed);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        Alert.alert(
          "Invalid calorie target",
          `${field.label} calories must be a positive number or left blank.`
        );
        return;
      }

      parsedTargets[field.label] = Math.round(parsed);
    }

    await saveUserData(uid, { goal, nickname }, true);
    await saveNutritionProfile(uid, parsedTargets);
    router.push("/home" as Href);
  };

  if (redirectTo) return <Redirect href={redirectTo} />;
  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <Text style={styles.loadingText}>Loading...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>Profile</Text>
          <View style={styles.headerSpacer} />
        </View>

        <Text style={styles.sectionTitle}>Nickname</Text>
        <TextInput
          placeholder="Your nickname"
          placeholderTextColor="#7a7a8c"
          style={styles.input}
          value={nickname}
          onChangeText={setNickname}
        />

        <Text style={styles.sectionTitle}>Goal</Text>
        <View style={styles.row}>
          {goals.map((g) => (
            <TouchableOpacity
              key={g.key}
              onPress={() => setGoal(g.key)}
              style={[styles.chip, goal === g.key && styles.chipActive]}
            >
              <Text style={[styles.chipText, goal === g.key && styles.chipTextActive]}>
                {g.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Calorie targets</Text>
        <Text style={styles.helperText}>
          Set daily targets by diet phase. Nutrition decisions will use completed days, not partial
          same-day intake.
        </Text>
        <View style={styles.targetRow}>
          <View style={styles.targetColumn}>
            <Text style={styles.targetLabel}>Cut</Text>
            <TextInput
              placeholder="2200"
              placeholderTextColor="#7a7a8c"
              style={styles.input}
              value={cutCalories}
              onChangeText={setCutCalories}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.targetColumn}>
            <Text style={styles.targetLabel}>Maintain</Text>
            <TextInput
              placeholder="2600"
              placeholderTextColor="#7a7a8c"
              style={styles.input}
              value={maintainCalories}
              onChangeText={setMaintainCalories}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.targetColumn}>
            <Text style={styles.targetLabel}>Bulk</Text>
            <TextInput
              placeholder="2900"
              placeholderTextColor="#7a7a8c"
              style={styles.input}
              value={bulkCalories}
              onChangeText={setBulkCalories}
              keyboardType="numeric"
            />
          </View>
        </View>

        <TouchableOpacity style={styles.save} onPress={save}>
          <Text style={styles.saveText}>Save Changes</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0d0d1a" },
  loadingText: { color: "#fff", padding: 20 },
  container: { flex: 1, backgroundColor: "#0d0d1a" },
  scrollContent: { padding: 20, paddingTop: 20, paddingBottom: 100, gap: 10 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  headerSpacer: {
    width: 22,
  },
  title: { color: "#fff", fontSize: 22, fontWeight: "800" },
  sectionTitle: { color: "#fff", fontSize: 15, fontWeight: "700", marginTop: 18, marginBottom: 8 },
  helperText: { color: "#a5acc1", fontSize: 13, lineHeight: 18 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  targetRow: { gap: 10 },
  targetColumn: { gap: 8 },
  targetLabel: { color: "#cfcfe6", fontSize: 14, fontWeight: "600" },
  input: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderColor: "rgba(255,255,255,0.2)",
    borderWidth: 1,
    borderRadius: 12,
    color: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
  },
  chip: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  chipActive: { backgroundColor: "#fff", borderColor: "#7b61ff" },
  chipText: { color: "#fff", fontWeight: "600", fontSize: 13.5 },
  chipTextActive: { color: "#4a90e2", fontWeight: "700", fontSize: 13.5 },
  save: { backgroundColor: "#7b61ff", borderRadius: 12, alignItems: "center", paddingVertical: 14, marginTop: 22 },
  saveText: { color: "#fff", fontWeight: "800", fontSize: 15 },
});
