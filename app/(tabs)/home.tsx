import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Href, Redirect, useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, Timestamp } from "firebase/firestore";
import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import type { NormalizedDecisionError, ReasonCode } from "../../src/contracts";
import { auth, db } from "../../src/config/firebaseConfig";
import { useEntitlement } from "../../src/hooks/useEntitlement";
import { getDecision, isNormalizedDecisionError } from "../../src/services/decision/getDecision";
import { hashDecisionInputs } from "../../src/services/decision/inputHash";
import type { DecisionInputs, DietPhase, LastResultPayload, TrainingPhase } from "../../src/types/decision";

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
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const [sleepHours, setSleepHours] = useState("7");
  const [soreness, setSoreness] = useState(4);
  const [fatigue, setFatigue] = useState(4);
  const [motivation, setMotivation] = useState(6);
  const [trainingPhase, setTrainingPhase] = useState<TrainingPhase>("Hypertrophy");
  const [dietPhase, setDietPhase] = useState<DietPhase>("Maintain");

  const [loading, setLoading] = useState(false);
  const [gateError, setGateError] = useState<NormalizedDecisionError | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState<number | null>(null);
  const [latestDecision, setLatestDecision] = useState<LastResultPayload | null>(null);
  const [showAdjustHelp, setShowAdjustHelp] = useState(false);
  const [lastTapAt, setLastTapAt] = useState(0);

  const entitlement = useEntitlement(authReady, uid);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setAuthReady(true);
      if (!user) {
        setUid(null);
        setUserEmail(null);
        setLatestDecision(null);
        setRedirectTo("/auth/sign-in");
        return;
      }

      setRedirectTo(null);
      setUid(user.uid);
      setUserEmail(user.email || null);

      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) {
          const data: any = snap.data();
          const lastResult = data?.usage?.decisions?.lastResult;
          if (lastResult) {
            setLatestDecision(lastResult as LastResultPayload);
          }
        }
      } catch (e) {
        console.log("Failed to load latest decision", e);
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    const loadInputs = async () => {
      try {
        const raw = await AsyncStorage.getItem(HOME_INPUTS_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (typeof parsed.sleepHours === "string") setSleepHours(parsed.sleepHours);
        if (typeof parsed.soreness === "number") setSoreness(parsed.soreness);
        if (typeof parsed.fatigue === "number") setFatigue(parsed.fatigue);
        if (typeof parsed.motivation === "number") setMotivation(parsed.motivation);
        if (typeof parsed.trainingPhase === "string" && isTrainingPhase(parsed.trainingPhase)) {
          setTrainingPhase(parsed.trainingPhase);
        }
        if (typeof parsed.dietPhase === "string" && isDietPhase(parsed.dietPhase)) {
          setDietPhase(parsed.dietPhase);
        }
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
            sleepHours,
            soreness,
            fatigue,
            motivation,
            trainingPhase,
            dietPhase,
          })
        );
      } catch (e) {
        console.log("Failed to save home inputs", e);
      }
    };
    save();
  }, [sleepHours, soreness, fatigue, motivation, trainingPhase, dietPhase]);

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

  const { parsedSleep, sleepIsInvalid } = useMemo(() => {
    const value = Number(sleepHours);
    const invalid = !Number.isFinite(value) || value < 0 || value > 12;
    return { parsedSleep: invalid ? 0 : value, sleepIsInvalid: invalid };
  }, [sleepHours]);

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
    setLoading(true);
    setGateError(null);
    setCooldownSeconds(null);

    try {
      const inputs: DecisionInputs = {
        sleepHours: parsedSleep,
        soreness,
        fatigue,
        motivation,
        trainingPhase,
        dietPhase,
      };

      const result = await getDecision(inputs);
      const payload: LastResultPayload = {
        createdAt: Timestamp.now(),
        inputs,
        result,
      };
      const inputHash = hashDecisionInputs(inputs);

      await setDoc(
        doc(db, "users", uid),
        { usage: { decisions: { lastResult: payload, lastInputHash: inputHash } } },
        { merge: true }
      );

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
          <Text style={styles.userName}>{userEmail ?? "Lifter"}</Text>
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
            <Text style={styles.label}>Sleep (hours)</Text>
            <TextInput
              style={styles.input}
              value={sleepHours}
              onChangeText={setSleepHours}
              keyboardType="numeric"
              placeholder="7"
              placeholderTextColor="#7a7a8c"
            />
            {sleepIsInvalid ? <Text style={styles.inputHint}>Enter a number between 0 and 12.</Text> : null}

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

            <Text style={styles.label}>Training phase</Text>
            <View style={styles.segmentRow}>
              {TRAINING_PHASES.map((value) => (
                <TouchableOpacity
                  key={value}
                  style={[styles.segmentChip, trainingPhase === value && styles.segmentChipActive]}
                  onPress={() => setTrainingPhase(value)}
                >
                  <Text style={[styles.segmentText, trainingPhase === value && styles.segmentTextActive]}>
                    {value}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Diet phase</Text>
            <View style={styles.segmentRow}>
              {DIET_PHASES.map((value) => (
                <TouchableOpacity
                  key={value}
                  style={[styles.segmentChip, dietPhase === value && styles.segmentChipActive]}
                  onPress={() => setDietPhase(value)}
                >
                  <Text style={[styles.segmentText, dietPhase === value && styles.segmentTextActive]}>
                    {value}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

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
    fontSize: 18,
    fontWeight: "700",
  },
  userName: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
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
  input: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderColor: "rgba(255,255,255,0.2)",
    borderWidth: 1,
    borderRadius: 12,
    color: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  inputHint: { color: "#9aa1c3", fontSize: 12 },
  segmentRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  segmentChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  segmentChipActive: { backgroundColor: "#7b61ff", borderColor: "#7b61ff" },
  segmentText: { color: "#d8daec", fontWeight: "700" },
  segmentTextActive: { color: "#0d0d1a" },
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
});
