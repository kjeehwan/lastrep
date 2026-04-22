import { Ionicons } from "@expo/vector-icons";
import { Href, Redirect, useFocusEffect, useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { Timestamp } from "firebase/firestore";
import React, { useCallback, useEffect, useState } from "react";
import { Linking, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth } from "../../../src/config/firebaseConfig";
import { useOfflineStatus } from "../../../src/hooks/useOfflineStatus";
import { showAppAlert } from "../../../src/ui/appDialog";
import {
  DEFAULT_CALORIE_TARGETS_BY_DIET_PHASE,
  normalizeCalorieTargets,
  saveNutritionProfile,
} from "../../../src/nutrition/meals";
import type { DietPhase, TrainingPhase } from "../../../src/types/decision";
import {
  getHealthConnectAvailability,
  hasHealthSleepPermission,
  openHealthConnectAppPermissionsScreen,
  openHealthConnectDataManagementScreen,
  type HealthConnectAvailability,
} from "../../../src/sleep/sleep";
import { getUserData, saveUserData } from "../../../src/userData";

const goals = [
  { key: "buildMuscle", label: "Build Muscle" },
  { key: "loseFat", label: "Lose Fat" },
  { key: "getStronger", label: "Get Stronger" },
  { key: "improveFitness", label: "Improve Fitness" },
];
const TRAINING_PHASES: TrainingPhase[] = ["Hypertrophy", "Strength", "Power"];
const DIET_PHASES: DietPhase[] = ["Cut", "Maintain", "Bulk"];
const isTrainingPhase = (value: unknown): value is TrainingPhase =>
  typeof value === "string" && TRAINING_PHASES.includes(value as TrainingPhase);
const isDietPhase = (value: unknown): value is DietPhase =>
  typeof value === "string" && DIET_PHASES.includes(value as DietPhase);

type TrainingPhaseHistoryEntry = {
  phase: TrainingPhase;
  startedAt: Timestamp;
};

type DietPhaseHistoryEntry = {
  phase: DietPhase;
  startedAt: Timestamp;
};

// Phase 2A: keep only nickname + goal for prompts; remove body metrics
export default function ProfileIndex() {
  const router = useRouter();
  const { isOffline } = useOfflineStatus();
  const [uid, setUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [goal, setGoal] = useState("");
  const [nickname, setNickname] = useState("");
  const [trainingPhase, setTrainingPhase] = useState<TrainingPhase>("Hypertrophy");
  const [dietPhase, setDietPhase] = useState<DietPhase>("Maintain");
  const [initialTrainingPhase, setInitialTrainingPhase] = useState<TrainingPhase>("Hypertrophy");
  const [initialDietPhase, setInitialDietPhase] = useState<DietPhase>("Maintain");
  const [trainingPhaseHistory, setTrainingPhaseHistory] = useState<TrainingPhaseHistoryEntry[]>([]);
  const [dietPhaseHistory, setDietPhaseHistory] = useState<DietPhaseHistoryEntry[]>([]);
  const [currentTrainingPhaseStartedAt, setCurrentTrainingPhaseStartedAt] = useState<Timestamp | null>(
    null
  );
  const [currentDietPhaseStartedAt, setCurrentDietPhaseStartedAt] = useState<Timestamp | null>(null);
  const [cutCalories, setCutCalories] = useState("");
  const [maintainCalories, setMaintainCalories] = useState("");
  const [bulkCalories, setBulkCalories] = useState("");
  const [sleepTargetHours, setSleepTargetHours] = useState("7");
  const [healthFeedback, setHealthFeedback] = useState<string | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthAvailability, setHealthAvailability] = useState<HealthConnectAvailability>("unsupported");
  const [healthPermissionState, setHealthPermissionState] = useState<
    "granted" | "denied" | "revoked" | "unavailable" | "unsupported" | "unknown"
  >("unknown");
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
  const [redirectTo, setRedirectTo] = useState<Href | null>(null);

  const handleGoBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/home");
  };

  const refreshHealthConnectStatus = useCallback(async () => {
    setHealthLoading(true);
    try {
      const availability = await getHealthConnectAvailability();
      setHealthAvailability(availability);
      if (availability === "unsupported") {
        setHealthPermissionState("unsupported");
      } else if (availability !== "available") {
        setHealthPermissionState("unavailable");
      } else {
        const granted = await hasHealthSleepPermission();
        setHealthPermissionState(granted ? "granted" : "denied");
      }
    } catch {
      setHealthPermissionState("unknown");
    } finally {
      setHealthLoading(false);
    }
  }, []);

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
        if (isTrainingPhase(data?.trainingPhase)) {
          setTrainingPhase(data.trainingPhase);
          setInitialTrainingPhase(data.trainingPhase);
        }
        if (isDietPhase(data?.dietPhase)) {
          setDietPhase(data.dietPhase);
          setInitialDietPhase(data.dietPhase);
        }
        setCurrentTrainingPhaseStartedAt(
          data?.trainingPhaseStartedAt instanceof Timestamp ? data.trainingPhaseStartedAt : null
        );
        setCurrentDietPhaseStartedAt(
          data?.dietPhaseStartedAt instanceof Timestamp ? data.dietPhaseStartedAt : null
        );
        const rawTrainingHistory = Array.isArray(data?.trainingPhaseHistory)
          ? data.trainingPhaseHistory
          : [];
        const rawDietHistory = Array.isArray(data?.dietPhaseHistory) ? data.dietPhaseHistory : [];
        const parsedTrainingHistory = rawTrainingHistory
          .map((entry: any) => ({
            phase: isTrainingPhase(entry?.phase) ? entry.phase : null,
            startedAt: entry?.startedAt instanceof Timestamp ? entry.startedAt : null,
          }))
          .filter(
            (
              entry: {
                phase: TrainingPhase | null;
                startedAt: Timestamp | null;
              }
            ): entry is TrainingPhaseHistoryEntry =>
              entry.phase != null && entry.startedAt != null
          )
          .sort((a, b) => a.startedAt.toMillis() - b.startedAt.toMillis());
        const parsedDietHistory = rawDietHistory
          .map((entry: any) => ({
            phase: isDietPhase(entry?.phase) ? entry.phase : null,
            startedAt: entry?.startedAt instanceof Timestamp ? entry.startedAt : null,
          }))
          .filter(
            (
              entry: {
                phase: DietPhase | null;
                startedAt: Timestamp | null;
              }
            ): entry is DietPhaseHistoryEntry =>
              entry.phase != null && entry.startedAt != null
          )
          .sort((a, b) => a.startedAt.toMillis() - b.startedAt.toMillis());
        setTrainingPhaseHistory(parsedTrainingHistory);
        setDietPhaseHistory(parsedDietHistory);
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
        const sleepTarget = data?.sleepSettings?.targetHours;
        if (typeof sleepTarget === "number" && sleepTarget > 0) {
          setSleepTargetHours(String(Math.round(sleepTarget * 10) / 10));
        }
      } catch (e) {
        console.log("Error fetching user data", e);
      } finally {
        await refreshHealthConnectStatus();
        setLoading(false);
      }
    });
    return unsub;
  }, [refreshHealthConnectStatus]);

  useFocusEffect(
    useCallback(() => {
      void refreshHealthConnectStatus();
      return undefined;
    }, [refreshHealthConnectStatus])
  );

  const healthConnectMessage = () => {
    if (healthAvailability === "provider_update_required") {
      return "Download or update Health Connect from the Play Store.";
    }
    if (healthAvailability === "unavailable") {
      return "Health Connect is unavailable on this device.";
    }
    if (healthAvailability === "unsupported") {
      return "Health Connect is only supported on Android.";
    }
    if (healthPermissionState === "granted") {
      return "You have granted Health Connect permission. You can sync sleep data now.";
    }
    if (healthPermissionState === "denied" || healthPermissionState === "revoked") {
      return "Sleep permission is required. Grant Health Connect permission to sync sleep data.";
    }
    if (isOffline) {
      return "You're offline. Reconnect to refresh Health Connect status.";
    }
    return "Checking Health Connect status...";
  };

  const handleOpenPlayStore = async () => {
    const url = "https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata";
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      setHealthFeedback("Unable to open Play Store on this device.");
      return;
    }
    await Linking.openURL(url);
  };

  const handleConnectHealthPermission = async () => {
    if (isOffline) {
      setHealthFeedback("You're offline. Reconnect to continue.");
      return;
    }
    setHealthFeedback("Opening Health Connect app permissions...");
    const opened =
      (await openHealthConnectAppPermissionsScreen()) ||
      (await openHealthConnectDataManagementScreen());
    if (!opened) {
      setHealthFeedback("Unable to open Health Connect settings on this device.");
      return;
    }
    await refreshHealthConnectStatus();
  };

  const save = async () => {
    if (!uid) return;
    setSaveFeedback(null);
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
        showAppAlert(
          "Invalid calorie target",
          `${field.label} calories must be a positive number or left blank.`
        );
        return;
      }

      parsedTargets[field.label] = Math.round(parsed);
    }

    const parsedSleepTarget = Number(sleepTargetHours.trim());
    if (!Number.isFinite(parsedSleepTarget) || parsedSleepTarget <= 0 || parsedSleepTarget > 24) {
      showAppAlert("Invalid sleep target", "Sleep target must be a number between 0 and 24.");
      return;
    }

    try {
      const profilePayload: Record<string, unknown> = { goal, nickname, trainingPhase, dietPhase };
      let nextTrainingHistory = trainingPhaseHistory;
      let nextDietHistory = dietPhaseHistory;
      if (trainingPhase !== initialTrainingPhase) {
        const now = Timestamp.now();
        profilePayload.trainingPhaseStartedAt = now;
        if (trainingPhaseHistory.length === 0) {
          const baselineStartedAt =
            currentTrainingPhaseStartedAt ?? Timestamp.fromMillis(Math.max(0, now.toMillis() - 1));
          nextTrainingHistory = [
            { phase: initialTrainingPhase, startedAt: baselineStartedAt },
            { phase: trainingPhase, startedAt: now },
          ];
        } else {
          nextTrainingHistory = [...trainingPhaseHistory, { phase: trainingPhase, startedAt: now }];
        }
        profilePayload.trainingPhaseHistory = nextTrainingHistory;
      }
      if (dietPhase !== initialDietPhase) {
        const now = Timestamp.now();
        profilePayload.dietPhaseStartedAt = now;
        if (dietPhaseHistory.length === 0) {
          const baselineStartedAt =
            currentDietPhaseStartedAt ?? Timestamp.fromMillis(Math.max(0, now.toMillis() - 1));
          nextDietHistory = [
            { phase: initialDietPhase, startedAt: baselineStartedAt },
            { phase: dietPhase, startedAt: now },
          ];
        } else {
          nextDietHistory = [...dietPhaseHistory, { phase: dietPhase, startedAt: now }];
        }
        profilePayload.dietPhaseHistory = nextDietHistory;
      }
      await saveUserData(uid, profilePayload, true);
      await saveUserData(
        uid,
        { sleepSettings: { targetHours: Math.round(parsedSleepTarget * 10) / 10 } },
        true
      );
      await saveNutritionProfile(uid, parsedTargets);
      setInitialTrainingPhase(trainingPhase);
      setInitialDietPhase(dietPhase);
      setTrainingPhaseHistory(nextTrainingHistory);
      setDietPhaseHistory(nextDietHistory);
      setCurrentTrainingPhaseStartedAt(
        trainingPhase !== initialTrainingPhase ? (profilePayload.trainingPhaseStartedAt as Timestamp) : currentTrainingPhaseStartedAt
      );
      setCurrentDietPhaseStartedAt(
        dietPhase !== initialDietPhase ? (profilePayload.dietPhaseStartedAt as Timestamp) : currentDietPhaseStartedAt
      );
      setSaveFeedback("Changes saved.");
    } catch (error) {
      console.log("Failed to save profile", error);
      showAppAlert("Save failed", "Couldn't save your changes. Please try again.");
    }
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

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Nickname</Text>
          <TextInput
            placeholder="Your nickname"
            placeholderTextColor="#7a7a8c"
            style={styles.input}
            value={nickname}
            onChangeText={setNickname}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Goal</Text>
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
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Training phase</Text>
          <View style={styles.row}>
            {TRAINING_PHASES.map((phase) => (
              <TouchableOpacity
                key={phase}
                onPress={() => setTrainingPhase(phase)}
                style={[styles.chip, trainingPhase === phase && styles.chipActive]}
              >
                <Text style={[styles.chipText, trainingPhase === phase && styles.chipTextActive]}>
                  {phase}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Diet phase</Text>
          <View style={styles.row}>
            {DIET_PHASES.map((phase) => (
              <TouchableOpacity
                key={phase}
                onPress={() => setDietPhase(phase)}
                style={[styles.chip, dietPhase === phase && styles.chipActive]}
              >
                <Text style={[styles.chipText, dietPhase === phase && styles.chipTextActive]}>
                  {phase}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Nutrition targets</Text>
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
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sleep target</Text>
          <TextInput
            placeholder="7.0"
            placeholderTextColor="#7a7a8c"
            style={styles.input}
            value={sleepTargetHours}
            onChangeText={setSleepTargetHours}
            keyboardType="decimal-pad"
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Health Connect</Text>
          <Text style={styles.helperText}>{healthConnectMessage()}</Text>
          <View style={styles.healthActionsRow}>
            <TouchableOpacity
              style={[styles.secondaryButton, styles.healthActionButton, healthLoading && styles.buttonDisabled]}
              disabled={healthLoading}
              onPress={handleConnectHealthPermission}
            >
              <Text style={styles.secondaryButtonText}>🔗 Connect</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.healthHint}>
            In Health Connect: App permissions {"->"} Lastrep {"->"} Allow all.
          </Text>
          {healthAvailability === "provider_update_required" ? (
            <TouchableOpacity
              style={[styles.secondaryButton, healthLoading && styles.buttonDisabled]}
              disabled={healthLoading}
              onPress={handleOpenPlayStore}
            >
              <Text style={styles.secondaryButtonText}>Open Play Store</Text>
            </TouchableOpacity>
          ) : null}
          {healthFeedback ? <Text style={styles.healthFeedback}>{healthFeedback}</Text> : null}
        </View>

        <TouchableOpacity style={styles.save} onPress={save}>
          <Text style={styles.saveText}>Save Changes</Text>
        </TouchableOpacity>
        {saveFeedback ? <Text style={styles.saveFeedback}>{saveFeedback}</Text> : null}
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
  cardTitle: { color: "#fff", fontSize: 15, fontWeight: "700", marginBottom: 8 },
  helperText: { color: "#a5acc1", fontSize: 13, lineHeight: 18 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  targetRow: { gap: 10 },
  card: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 16,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
    gap: 8,
  },
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
  secondaryButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
    paddingVertical: 12,
    alignItems: "center",
  },
  secondaryButtonText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  healthActionsRow: {
    flexDirection: "row",
    gap: 8,
  },
  healthActionButton: {
    flex: 1,
  },
  buttonDisabled: { opacity: 0.6 },
  healthFeedback: { color: "#a5acc1", fontSize: 12, lineHeight: 16 },
  healthHint: { color: "#a5acc1", fontSize: 12, lineHeight: 16 },
  save: { backgroundColor: "#7b61ff", borderRadius: 12, alignItems: "center", paddingVertical: 14, marginTop: 22 },
  saveText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  saveFeedback: { color: "#a6e3a1", textAlign: "center", fontSize: 13, marginTop: 8 },
});
