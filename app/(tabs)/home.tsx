import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Href, Redirect, useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { deleteField, doc, onSnapshot, setDoc, Timestamp, updateDoc } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { NormalizedDecisionError, ReasonCode } from "../../src/contracts";
import { auth, db } from "../../src/config/firebaseConfig";
import { useEntitlement } from "../../src/hooks/useEntitlement";
import { useOfflineStatus } from "../../src/hooks/useOfflineStatus";
import { getTodayDecisionNutritionSummary } from "../../src/nutrition/meals";
import {
  getSleepProfile,
  getSleepSampleAgeHours,
  isHealthSleepStale,
} from "../../src/sleep/sleep";
import { resolveDecisionSleepInput } from "../../src/sleep/resolveDecisionSleepInput";
import { getDecision, isNormalizedDecisionError } from "../../src/services/decision/getDecision";
import { hashDecisionInputs } from "../../src/services/decision/inputHash";
import type { DecisionInputs, DietPhase, LastResultPayload, TrainingPhase } from "../../src/types/decision";
import { isExpectedOfflineError } from "../../src/utils/networkErrors";

const HOME_INPUTS_KEY = "home-inputs-v1";
const TRAINING_PHASES: TrainingPhase[] = ["Hypertrophy", "Strength", "Power"];
const DIET_PHASES: DietPhase[] = ["Cut", "Maintain", "Bulk"];

const isTrainingPhase = (value: string): value is TrainingPhase =>
  TRAINING_PHASES.includes(value as TrainingPhase);
const isDietPhase = (value: string): value is DietPhase => DIET_PHASES.includes(value as DietPhase);

const formatDecisionLabel = (decision: string) => decision.replace("_", " ");
const formatIntensityLabel = (value?: number) => {
  if (value == null || value === 0) return "No change";
  const sign = value > 0 ? "+" : "";
  return `Intensity: ${sign}${value}%`;
};

const getReasonMessage = (reasonCode: ReasonCode): string => {
  switch (reasonCode) {
    case "FREE_WINDOW_EXHAUSTED":
      return "Free window is exhausted.";
    case "DAILY_LIMIT":
      return "Daily limit reached.";
    case "COOLDOWN_ACTIVE":
      return "Please wait before requesting another decision.";
    default:
      return "Unable to get a decision right now.";
  }
};

const formatCooldownMessage = (cooldownSeconds: number | null): string => {
  if (cooldownSeconds == null) return "Please wait before requesting another decision.";
  if (cooldownSeconds <= 0) return "Cooldown complete. Try again now.";
  const minutes = Math.max(1, Math.ceil(cooldownSeconds / 60));
  return `Try again in ${minutes} min.`;
};

export default function Home() {
  const router = useRouter();
  const [redirectTo, setRedirectTo] = useState<Href | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  const [userNickname, setUserNickname] = useState<string | null>(null);

  const [soreness, setSoreness] = useState(4);
  const [fatigue, setFatigue] = useState(4);
  const [motivation, setMotivation] = useState(6);
  const [trainingPhase, setTrainingPhase] = useState<TrainingPhase>("Hypertrophy");
  const [dietPhase, setDietPhase] = useState<DietPhase>("Maintain");
  const [sleepTargetHours, setSleepTargetHours] = useState(7);

  const [loading, setLoading] = useState(false);
  const [gateError, setGateError] = useState<NormalizedDecisionError | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState<number | null>(null);
  const [latestDecision, setLatestDecision] = useState<LastResultPayload | null>(null);
  const [showAdjustHelp, setShowAdjustHelp] = useState(false);
  const [showAdjustInputsModal, setShowAdjustInputsModal] = useState(false);
  const [lastTapAt, setLastTapAt] = useState(0);

  const entitlement = useEntitlement(authReady, uid);
  const { isOffline } = useOfflineStatus();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setAuthReady(true);
      if (!user) {
        setUid(null);
        setUserNickname(null);
        setLatestDecision(null);
        setRedirectTo("/auth/sign-in");
        return;
      }

      setRedirectTo(null);
      setUid(user.uid);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!uid) {
      setUserNickname(null);
      return;
    }

    const unsubscribe = onSnapshot(
      doc(db, "users", uid),
      (snap) => {
        const data: any = snap.data();
        const nickname = typeof data?.nickname === "string" ? data.nickname.trim() : "";
        setUserNickname(nickname || null);
        if (isTrainingPhase(data?.trainingPhase)) {
          setTrainingPhase(data.trainingPhase);
        }
        if (isDietPhase(data?.dietPhase)) {
          setDietPhase(data.dietPhase);
        }
        const target = data?.sleepSettings?.targetHours;
        if (typeof target === "number" && Number.isFinite(target) && target > 0 && target <= 24) {
          setSleepTargetHours(Math.round(target * 10) / 10);
        }

        const lastResult = data?.usage?.decisions?.lastResult;
        if (lastResult) {
          setLatestDecision(lastResult as LastResultPayload);
        }
      },
      (e) => {
        if (!isExpectedOfflineError(e)) {
          console.log("Failed to subscribe user profile", e);
        }
      }
    );

    return unsubscribe;
  }, [uid]);

  useEffect(() => {
    const loadInputs = async () => {
      try {
        const raw = await AsyncStorage.getItem(HOME_INPUTS_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (typeof parsed.soreness === "number") setSoreness(parsed.soreness);
        if (typeof parsed.fatigue === "number") setFatigue(parsed.fatigue);
        if (typeof parsed.motivation === "number") setMotivation(parsed.motivation);
      } catch (e) {
        console.log("Failed to load home inputs, clearing cache", e);
        try {
          await AsyncStorage.removeItem(HOME_INPUTS_KEY);
        } catch {
          // no-op
        }
      }
    };
    loadInputs();
  }, []);

  useEffect(() => {
    const save = async () => {
      try {
        await AsyncStorage.setItem(
          HOME_INPUTS_KEY,
          JSON.stringify({
            soreness,
            fatigue,
            motivation,
          })
        );
      } catch (e) {
        console.log("Failed to save home inputs", e);
      }
    };
    save();
  }, [soreness, fatigue, motivation]);

  useEffect(() => {
    if (cooldownSeconds == null || cooldownSeconds <= 0) return;
    const timer = setInterval(() => {
      setCooldownSeconds((previous) => {
        if (previous == null) return previous;
        return previous > 0 ? previous - 1 : 0;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownSeconds]);

  const shouldShowUpgradeCta =
    gateError?.bucket === "business_gate" && entitlement.state === "inactive";

  const handleOpenPaywallFromGate = () => {
    if (gateError?.bucket !== "business_gate" || entitlement.state !== "inactive") return;

    const paywallParams =
      gateError.reasonCode === "COOLDOWN_ACTIVE"
        ? { sourceScreen: "cooldown_gate", reasonCode: "cooldown_gate" }
        : { sourceScreen: "home_gate", reasonCode: "decision_limit" };

    router.push({
      pathname: "/paywall",
      params: paywallParams,
    });
  };

  const handleDecision = async () => {
    if (!uid || loading) return;
    const nowMs = Date.now();
    if (nowMs - lastTapAt < 500) return;

    setLastTapAt(nowMs);
    if (isOffline) {
      setGateError({
        bucket: "other",
        message: "You're offline. Connect to get today's decision.",
      });
      setCooldownSeconds(null);
      return;
    }
    setLoading(true);
    setGateError(null);
    setCooldownSeconds(null);

    try {
        let nutrition: DecisionInputs["nutrition"] = null;
        let effectiveSleepHours = sleepTargetHours;
        let sleepSource: DecisionInputs["sleepSource"] = "manual";
        let sleepSampleAgeHours: DecisionInputs["sleepSampleAgeHours"] = 0;
        try {
          nutrition = await getTodayDecisionNutritionSummary(uid, dietPhase);
        } catch (nutritionError) {
          if (!isExpectedOfflineError(nutritionError)) {
            console.log("Failed to load nutrition summary", nutritionError);
          }
        }

        try {
          const sleepProfile = await getSleepProfile(uid);
          const sampleAgeHours = getSleepSampleAgeHours(sleepProfile.sampleRecordedAt);
          const stale = isHealthSleepStale(sleepProfile, new Date());
          const resolvedSleep = resolveDecisionSleepInput(sleepTargetHours, {
            source: sleepProfile.source,
            latestSleepHours: sleepProfile.latestSleepHours,
            sampleAgeHours: stale ? null : sampleAgeHours,
          });
          effectiveSleepHours = resolvedSleep.sleepHours;
          sleepSource = resolvedSleep.sleepSource;
          sleepSampleAgeHours = resolvedSleep.sleepSampleAgeHours;
        } catch (sleepError) {
          if (!isExpectedOfflineError(sleepError)) {
            console.log("Failed to resolve sleep source", sleepError);
          }
        }

      const inputs: DecisionInputs = {
        sleepHours: effectiveSleepHours,
        sleepSource,
        sleepSampleAgeHours,
        soreness,
        fatigue,
        motivation,
        trainingPhase,
        dietPhase,
        nutrition,
      };

      const result = await getDecision(inputs);
      const payload: LastResultPayload = {
        createdAt: Timestamp.now(),
        inputs,
        result,
      };
      const inputHash = hashDecisionInputs(inputs);

      const userRef = doc(db, "users", uid);
      await setDoc(
        userRef,
        { usage: { decisions: { lastResult: payload, lastInputHash: inputHash } } },
        { merge: true }
        );
        await updateDoc(userRef, {
          "usage.decisions.lastResult.inputs.phase": deleteField(),
          "usage.decisions.lastResult.inputs.nutrition.calorieTargetAdherence":
            deleteField(),
        });

      setLatestDecision(payload);
    } catch (error) {
      if (isNormalizedDecisionError(error)) {
        setGateError(error);
        if (error.bucket === "business_gate" && error.reasonCode === "COOLDOWN_ACTIVE") {
          if (typeof error.retryAfterSeconds === "number") {
            setCooldownSeconds(error.retryAfterSeconds);
          }
        }
        return;
      }

      console.log("Decision request failed", error);
      setGateError({
        bucket: "other",
        message: "Something went wrong. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  if (redirectTo) return <Redirect href={redirectTo} />;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.greeting}>lastrep</Text>
          <View style={styles.userRow}>
            <Text style={styles.userName}>{userNickname ?? "Lifter"}</Text>
            <View
              style={[
                styles.entitlementBadge,
                entitlement.state === "active"
                  ? styles.entitlementBadgeActive
                  : entitlement.state === "inactive"
                    ? styles.entitlementBadgeInactive
                    : styles.entitlementBadgeLoading,
              ]}
            >
              <Text
                style={[
                  styles.entitlementBadgeText,
                  entitlement.state === "active"
                    ? styles.entitlementBadgeTextActive
                    : styles.entitlementBadgeTextMuted,
                ]}
              >
                {entitlement.state === "active"
                  ? "Premium"
                  : entitlement.state === "inactive"
                    ? "Free"
                    : "Checking"}
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.iconContainer}>
          <TouchableOpacity onPress={() => router.push("/settings" as Href)} style={{ marginLeft: 12 }}>
            <Ionicons name="settings-outline" size={28} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Inputs</Text>
          <View style={styles.card}>
            <Text style={styles.cardText}>Training: {trainingPhase}</Text>
            <Text style={styles.cardText}>Diet: {dietPhase}</Text>
            <Text style={styles.cardText}>Soreness {soreness} · Fatigue {fatigue} · Motivation {motivation}</Text>

            <TouchableOpacity
              style={styles.secondaryButtonWide}
              onPress={() => setShowAdjustInputsModal(true)}
            >
              <Text style={styles.secondaryButtonText}>Adjust inputs</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.primaryButtonWide, loading && styles.disabled]}
              onPress={handleDecision}
              disabled={loading}
            >
              <Text style={styles.primaryText}>{loading ? "Working..." : "Get today's decision"}</Text>
            </TouchableOpacity>

            {gateError ? (
              <View style={styles.notice}>
                <Text style={styles.noticeText}>
                  {gateError.bucket === "business_gate"
                    ? getReasonMessage(gateError.reasonCode)
                    : gateError.message ?? "Unable to get a decision right now."}
                </Text>
                {gateError.bucket === "business_gate" && gateError.reasonCode === "COOLDOWN_ACTIVE" ? (
                  <Text style={styles.noticeSub}>{formatCooldownMessage(cooldownSeconds)}</Text>
                ) : null}
                {gateError.bucket === "seatbelt" ? (
                  <Text style={styles.noticeSub}>Too many requests. Try again shortly.</Text>
                ) : null}
                {shouldShowUpgradeCta ? (
                  <TouchableOpacity style={styles.paywallButton} onPress={handleOpenPaywallFromGate}>
                    <Text style={styles.paywallText}>Upgrade to Premium</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Today&apos;s decision</Text>
          <View style={styles.card}>
            {latestDecision ? (
              <>
                <Text style={styles.decisionTitle}>{formatDecisionLabel(latestDecision.result.decision)}</Text>
                <View style={styles.bulletList}>
                  {latestDecision.result.explanation.map((line, index) => (
                    <Text key={`${line}-${index}`} style={styles.bulletItem}>
                      - {line}
                    </Text>
                  ))}
                </View>
                <View style={styles.adjustRow}>
                  <Text style={styles.adjustText}>
                    {formatIntensityLabel(latestDecision.result.adjustments?.intensityPct)}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setShowAdjustHelp((previous) => !previous)}
                    style={styles.helpIcon}
                    accessibilityLabel="What does intensity mean?"
                  >
                    <Ionicons name="help-circle-outline" size={18} color="#9aa1c3" />
                  </TouchableOpacity>
                </View>
                {showAdjustHelp ? (
                  <Text style={styles.helpText}>Intensity adjustment = change the weight on your sets.</Text>
                ) : null}
              </>
            ) : (
              <Text style={styles.cardText}>No decision yet.</Text>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Train</Text>
          <View style={styles.card}>
            <Text style={styles.cardText}>Log a full session without templates or history browsing.</Text>
            <TouchableOpacity
              style={styles.primaryButtonWide}
              onPress={() =>
                router.push(
                  `/(tabs)/workout/log?trainingPhase=${encodeURIComponent(trainingPhase)}` as Href
                )
              }
            >
              <Text style={styles.primaryText}>Start workout</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Nutrition</Text>
          <View style={styles.card}>
            <Text style={styles.cardText}>Log today&apos;s meals and keep a simple calorie total.</Text>
            <TouchableOpacity
              style={styles.primaryButtonWide}
              onPress={() => router.push("/nutrition" as Href)}
            >
              <Text style={styles.primaryText}>Open nutrition</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <Modal visible={showAdjustInputsModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Adjust inputs</Text>

            <Text style={styles.label}>Soreness: {soreness}</Text>
            <Slider
              value={soreness}
              onValueChange={(v: number) => setSoreness(Math.round(v))}
              minimumValue={0}
              maximumValue={10}
              step={1}
              minimumTrackTintColor="#7b61ff"
              maximumTrackTintColor="#555"
              thumbTintColor="#fff"
            />

            <Text style={styles.label}>Fatigue: {fatigue}</Text>
            <Slider
              value={fatigue}
              onValueChange={(v: number) => setFatigue(Math.round(v))}
              minimumValue={0}
              maximumValue={10}
              step={1}
              minimumTrackTintColor="#7b61ff"
              maximumTrackTintColor="#555"
              thumbTintColor="#fff"
            />

            <Text style={styles.label}>Motivation: {motivation}</Text>
            <Slider
              value={motivation}
              onValueChange={(v: number) => setMotivation(Math.round(v))}
              minimumValue={0}
              maximumValue={10}
              step={1}
              minimumTrackTintColor="#7b61ff"
              maximumTrackTintColor="#555"
              thumbTintColor="#fff"
            />

            <TouchableOpacity
              style={[styles.primaryButtonWide, { marginTop: 8 }]}
              onPress={() => setShowAdjustInputsModal(false)}
            >
              <Text style={styles.primaryText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    fontSize: 18,
    fontWeight: "700",
  },
  userName: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  entitlementBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  entitlementBadgeActive: {
    backgroundColor: "#a6e3a1",
  },
  entitlementBadgeInactive: {
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  entitlementBadgeLoading: {
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  entitlementBadgeText: {
    fontSize: 11,
    fontWeight: "800",
  },
  entitlementBadgeTextActive: {
    color: "#0d0d1a",
  },
  entitlementBadgeTextMuted: {
    color: "#fff",
  },
  iconContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  scrollContent: {
    paddingBottom: 120,
  },
  section: {
    marginTop: 20,
  },
  sectionTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 10,
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 16,
    padding: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
    gap: 12,
  },
  label: { color: "#cfcfe6", fontSize: 14, fontWeight: "600" },
  secondaryButtonWide: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: "rgba(255,255,255,0.3)",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  secondaryButtonText: { color: "#fff", fontWeight: "700" },
  primaryButtonWide: {
    backgroundColor: "#7b61ff",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryText: {
    color: "#fff",
    fontWeight: "700",
  },
  disabled: { opacity: 0.6 },
  cardText: { color: "#aaa", fontSize: 15 },
  notice: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  noticeText: { color: "#fff", fontWeight: "700" },
  noticeSub: { color: "#9aa1c3", fontSize: 12 },
  paywallButton: {
    borderColor: "rgba(255,255,255,0.3)",
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  paywallText: { color: "#fff", fontWeight: "700" },
  decisionTitle: { color: "#fff", fontSize: 22, fontWeight: "800" },
  bulletList: { gap: 6 },
  bulletItem: { color: "#d8daec", fontSize: 14 },
  adjustRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  adjustText: { color: "#9aa1c3", fontSize: 13 },
  helpIcon: { paddingHorizontal: 4, paddingVertical: 2 },
  helpText: { color: "#9aa1c3", fontSize: 12 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  modalCard: {
    width: "100%",
    backgroundColor: "#111427",
    borderRadius: 16,
    padding: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
    gap: 8,
  },
  modalTitle: { color: "#fff", fontSize: 18, fontWeight: "800", marginBottom: 4 },
});
