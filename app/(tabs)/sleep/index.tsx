import { Ionicons } from "@expo/vector-icons";
import { Href, Redirect, useFocusEffect, useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth } from "@/src/config/firebaseConfig";
import { getSleepProfile } from "@/src/sleep/sleep";
import { isExpectedOfflineError } from "@/src/utils/networkErrors";

const ACCENT = "#7b61ff";
const MUTED = "#a5acc1";

const formatTimestamp = (value: Date | null): string =>
  value ? value.toLocaleString() : "Not synced yet";

export default function SleepIndex() {
  const router = useRouter();
  const [redirectTo, setRedirectTo] = useState<Href | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [sleepHours, setSleepHours] = useState<number | null>(null);
  const [sleepSource, setSleepSource] = useState<"manual" | "health">("manual");
  const [sampleRecordedAt, setSampleRecordedAt] = useState<Date | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  const handleGoBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/home");
  };

  const refreshSleep = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    setFeedback(null);
    try {
      const profile = await getSleepProfile(uid);
      setSleepHours(profile.latestSleepHours);
      setSleepSource(profile.source);
      setSampleRecordedAt(profile.sampleRecordedAt?.toDate() ?? null);
      setLastSyncedAt(profile.lastSyncedAt?.toDate() ?? null);
    } catch (error) {
      if (!isExpectedOfflineError(error)) {
        console.log("Failed to load sleep profile", error);
      }
      setFeedback(
        isExpectedOfflineError(error)
          ? "You're offline. Sleep data will refresh when you reconnect."
          : "Unable to load sleep data right now."
      );
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setUid(null);
        setRedirectTo("/auth/sign-in");
        setLoading(false);
        return;
      }
      setUid(user.uid);
      setRedirectTo(null);
    });
    return unsub;
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshSleep();
      return undefined;
    }, [refreshSleep])
  );

  const sourceLabel = useMemo(
    () => (sleepSource === "health" ? "Health" : "Manual"),
    [sleepSource]
  );

  if (redirectTo) return <Redirect href={redirectTo} />;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} style={styles.container} bounces>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>Sleep</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Current sleep summary</Text>
          <Text style={styles.valueText}>
            {sleepHours == null ? "No sample yet" : `${sleepHours.toFixed(1)} hours`}
          </Text>
          <Text style={styles.subText}>
            Recorded at: {formatTimestamp(sampleRecordedAt)}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Sleep source</Text>
          <Text style={styles.valueText}>{sourceLabel}</Text>
          <Text style={styles.subText}>Last sync: {formatTimestamp(lastSyncedAt)}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Health sync</Text>
          <Text style={styles.subText}>
            Health integration lands in Phase 6B. For now, decisions use manual sleep by default.
          </Text>
          <TouchableOpacity
            style={[styles.primaryButton, loading && styles.disabled]}
            disabled={loading}
            onPress={() => setFeedback("Sync placeholder. Health integration comes in Phase 6B.")}
          >
            <Text style={styles.primaryButtonText}>Sync sleep (placeholder)</Text>
          </TouchableOpacity>
        </View>

        {feedback ? <Text style={styles.feedbackText}>{feedback}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0d0d1a" },
  container: { flex: 1, backgroundColor: "#0d0d1a" },
  content: {
    padding: 16,
    paddingTop: 12,
    paddingBottom: 140,
    gap: 12,
  },
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
  headerSpacer: { width: 22 },
  title: { color: "#fff", fontSize: 22, fontWeight: "800" },
  card: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 16,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
    gap: 8,
  },
  sectionTitle: { color: "#fff", fontSize: 16, fontWeight: "700" },
  valueText: { color: "#fff", fontSize: 20, fontWeight: "800" },
  subText: { color: MUTED, fontSize: 12, lineHeight: 16 },
  primaryButton: {
    backgroundColor: ACCENT,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  primaryButtonText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  disabled: { opacity: 0.6 },
  feedbackText: {
    color: MUTED,
    fontSize: 13,
    textAlign: "center",
    marginTop: 4,
  },
});
