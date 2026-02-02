import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import { Picker } from "@react-native-picker/picker";
import { Href, Redirect, useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, Timestamp } from "firebase/firestore";
import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { auth, db } from "../../src/config/firebaseConfig";
import { gateAndConsumeDecision } from "../../src/decisionUsageStore";
import { buildDecisionStub } from "../../src/services/decisionEngineStub";

type DecisionResult = {
  decision: "PUSH" | "MAINTAIN" | "PULL_BACK";
  explanation: string[];
  adjustments: { volumePct?: number; intensityPct?: number };
};

type LatestDecisionPayload = {
  createdAt: Timestamp;
  inputs: {
    sleepHours: number;
    soreness: number;
    fatigue: number;
    motivation: number;
    phase: string;
  };
  result: DecisionResult;
};

const reasonMessage = (reason?: string) => {
  switch (reason) {
    case "FREE_EXHAUSTED":
      return "Free decisions are exhausted. Upgrade to continue.";
    case "FREE_DAILY_LIMIT":
      return "Free users get 1 decision per day.";
    case "PAID_DAILY_LIMIT":
      return "Daily limit reached (3/day).";
    case "COOLDOWN":
      return "Please wait before requesting another decision.";
    default:
      return "Unable to get a decision right now.";
  }
};

export default function Home() {
  const router = useRouter();
  const [redirectTo, setRedirectTo] = useState<Href | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const [sleepHours, setSleepHours] = useState("7");
  const [soreness, setSoreness] = useState(4);
  const [fatigue, setFatigue] = useState(4);
  const [motivation, setMotivation] = useState(6);
  const [phase, setPhase] = useState("maintain");

  const [loading, setLoading] = useState(false);
  const [gateMessage, setGateMessage] = useState<string | null>(null);
  const [gateReason, setGateReason] = useState<string | null>(null);
  const [nextAvailableAt, setNextAvailableAt] = useState<Date | null>(null);
  const [latestDecision, setLatestDecision] = useState<LatestDecisionPayload | null>(null);
  const [showAdjustHelp, setShowAdjustHelp] = useState(false);
  const [lastGateDebug, setLastGateDebug] = useState<string | null>(null);
  const [lastTapAt, setLastTapAt] = useState(0);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
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
            setLatestDecision(lastResult as LatestDecisionPayload);
          }
        }
      } catch (e) {
        console.log("Failed to load latest decision", e);
      }
    });
    return unsub;
  }, []);

  const { parsedSleep, sleepIsInvalid } = useMemo(() => {
    const value = Number(sleepHours);
    const invalid = !Number.isFinite(value) || value < 0 || value > 12;
    return { parsedSleep: invalid ? 0 : value, sleepIsInvalid: invalid };
  }, [sleepHours]);

  const handleDecision = async () => {
    if (!uid || loading) return;
    const nowMs = Date.now();
    if (nowMs - lastTapAt < 500) return;
    setLastTapAt(nowMs);
    setLoading(true);
    setGateMessage(null);
    setGateReason(null);
    setNextAvailableAt(null);
    try {
      const gate = await gateAndConsumeDecision(uid, new Date());
      if (__DEV__) {
        const usage = gate.updatedUsage ?? gate.currentUsage;
        const dbg = `allowed=${gate.allowed} reason=${gate.reason ?? "n/a"} dailyCount=${usage?.dailyCount ?? "n/a"} freeRemaining=${usage?.freeRemaining ?? "n/a"}`;
        setLastGateDebug(dbg);
      }
      if (!gate.allowed) {
        setGateMessage(reasonMessage(gate.reason));
        setGateReason(gate.reason ?? null);
        if (gate.nextAvailableAt) setNextAvailableAt(gate.nextAvailableAt);
        setLoading(false);
        return;
      }

      const result = buildDecisionStub({
        sleepHours: parsedSleep,
        soreness,
        fatigue,
        motivation,
        phase,
      });

      const payload: LatestDecisionPayload = {
        createdAt: Timestamp.now(),
        inputs: {
          sleepHours: parsedSleep,
          soreness,
          fatigue,
          motivation,
          phase,
        },
        result,
      };

      await setDoc(
        doc(db, "users", uid),
        { usage: { decisions: { lastResult: payload } } },
        { merge: true }
      );

      setLatestDecision(payload);
    } catch (e) {
      console.log("Decision request failed", e);
      setGateMessage("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (redirectTo) return <Redirect href={redirectTo} />;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.greeting}>Daily Decision</Text>
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
            {sleepIsInvalid ? (
              <Text style={styles.inputHint}>Enter a number between 0 and 12.</Text>
            ) : null}

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
            <View style={styles.pickerWrap}>
              <Picker
                selectedValue={phase}
                onValueChange={(val) => setPhase(String(val))}
                dropdownIconColor="#fff"
                style={styles.picker}
              >
                <Picker.Item label="Cut" value="cut" />
                <Picker.Item label="Maintain" value="maintain" />
                <Picker.Item label="Bulk" value="bulk" />
              </Picker>
            </View>

            <TouchableOpacity style={[styles.primaryButtonWide, loading && styles.disabled]} onPress={handleDecision} disabled={loading}>
              <Text style={styles.primaryText}>{loading ? "Working..." : "Get today's decision"}</Text>
            </TouchableOpacity>

            {gateMessage ? (
              <View style={styles.notice}>
                <Text style={styles.noticeText}>{gateMessage}</Text>
                {nextAvailableAt ? (
                  <Text style={styles.noticeSub}>Try again: {nextAvailableAt.toLocaleString()}</Text>
                ) : null}
                {gateReason === "FREE_EXHAUSTED" ? (
                  <TouchableOpacity style={styles.paywallButton} onPress={() => { /* placeholder */ }}>
                    <Text style={styles.paywallText}>Upgrade (coming soon)</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}
            {__DEV__ && lastGateDebug ? (
              <View style={styles.devNotice}>
                <Text style={styles.devText}>{lastGateDebug}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Today&apos;s decision</Text>
          <View style={styles.card}>
            {latestDecision ? (
              <>
                <Text style={styles.decisionTitle}>{latestDecision.result.decision}</Text>
                <View style={styles.bulletList}>
                  {latestDecision.result.explanation.map((line, idx) => (
                    <Text key={`${line}-${idx}`} style={styles.bulletItem}>- {line}</Text>
                  ))}
                </View>
                <View style={styles.adjustRow}>
  <Text style={styles.adjustText}>
    {latestDecision.result.adjustments.volumePct === 0 &&
    latestDecision.result.adjustments.intensityPct === 0
      ? "No change"
      : `Volume: ${latestDecision.result.adjustments.volumePct ?? 0}% / Intensity: ${latestDecision.result.adjustments.intensityPct ?? 0}%`}
  </Text>
  <TouchableOpacity
    onPress={() => setShowAdjustHelp((prev) => !prev)}
    style={styles.helpIcon}
    accessibilityLabel="What do volume and intensity mean?"
  >
    <Ionicons name="help-circle-outline" size={18} color="#9aa1c3" />
  </TouchableOpacity>
</View>
{showAdjustHelp ? (
  <Text style={styles.helpText}>
    Volume = total work (sets/reps). Intensity = load/effort.
  </Text>
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
            <TouchableOpacity style={styles.primaryButtonWide} onPress={() => router.push("/(tabs)/workout/log" as Href)}>
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
  pickerWrap: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    borderRadius: 12,
    overflow: "hidden",
  },
  picker: { color: "#fff" },
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
  devNotice: {
    marginTop: 8,
    backgroundColor: "rgba(123,97,255,0.1)",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  devText: { color: "#9aa1c3", fontSize: 11 },
});

