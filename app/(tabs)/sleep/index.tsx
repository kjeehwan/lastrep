import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Href, Redirect, useFocusEffect, useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth } from "@/src/config/firebaseConfig";
import type { SleepNightlySummary } from "@/src/contracts";
import { useOfflineStatus } from "@/src/hooks/useOfflineStatus";
import { getSleepDeltaText, getSleepRecoveryHint, classifySleepVsTarget } from "@/src/sleep/sleepInsights";
import {
  autoSyncSleepFromHealthConnectIfEligible,
  HEALTH_SLEEP_STALE_HOURS,
  getHealthConnectAvailability,
  getSleepProfile,
  saveManualSleepForDateKey,
  syncSleepFromHealthConnect,
  hasHealthSleepPermission,
  type HealthConnectAvailability,
} from "@/src/sleep/sleep";
import { showAppDialog } from "@/src/ui/appDialog";
import { getUserData } from "@/src/userData";
import { isExpectedOfflineError } from "@/src/utils/networkErrors";

const ACCENT = "#7b61ff";
const MUTED = "#a5acc1";
const SLEEP_SYNC_CONFIRM_KEY_PREFIX = "sleep-sync-confirmed-v1";

const formatTimestamp = (value: Date | null): string =>
  value ? value.toLocaleString() : "Not synced yet";
export default function SleepIndex() {
  const router = useRouter();
  const { isOffline } = useOfflineStatus();
  const [redirectTo, setRedirectTo] = useState<Href | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [accountLabel, setAccountLabel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [sleepSource, setSleepSource] = useState<"manual" | "health">("manual");
  const [sleepOriginLabel, setSleepOriginLabel] = useState<string | null>(null);
  const [sampleRecordedAt, setSampleRecordedAt] = useState<Date | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [recentNightlyHours, setRecentNightlyHours] = useState<SleepNightlySummary[]>([]);
  const [sleepTargetHours, setSleepTargetHours] = useState<number>(7);
  const [manualOverrideHours, setManualOverrideHours] = useState("");
  const [savingOverride, setSavingOverride] = useState(false);
  const [permissionState, setPermissionState] = useState<
    "granted" | "denied" | "revoked" | "unavailable" | "unsupported" | "unknown"
  >("unknown");
  const [availability, setAvailability] = useState<HealthConnectAvailability>("unsupported");

  const applyProfile = useCallback((profile: Awaited<ReturnType<typeof getSleepProfile>>) => {
    setSleepSource(profile.source);
    setSleepOriginLabel(profile.originLabel);
    setSampleRecordedAt(profile.sampleRecordedAt?.toDate() ?? null);
    setLastSyncedAt(profile.lastSyncedAt?.toDate() ?? null);
    setRecentNightlyHours(profile.recentNightlyHours);
  }, []);

  const handleGoBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/home");
  };

  const refreshSleep = useCallback(async (options?: { resetFeedback?: boolean; autoSync?: boolean }) => {
    const resetFeedback = options?.resetFeedback ?? true;
    const autoSync = options?.autoSync ?? false;
    if (!uid) return;
    setLoading(true);
    if (resetFeedback) {
      setFeedback(null);
    }
    try {
      const [profile, nextAvailability] = await Promise.all([
        getSleepProfile(uid),
        getHealthConnectAvailability(),
      ]);
      applyProfile(profile);

      setAvailability(nextAvailability);
      if (nextAvailability === "unsupported") {
        setPermissionState("unsupported");
      } else if (nextAvailability !== "available") {
        setPermissionState("unavailable");
      } else {
        const granted = await hasHealthSleepPermission();
        if (granted) {
          setPermissionState("granted");
          if (autoSync) {
            const autoSyncResult = await autoSyncSleepFromHealthConnectIfEligible(uid, {
              minIntervalMinutes: 30,
            });
            if (autoSyncResult === "synced") {
              const refreshedProfile = await getSleepProfile(uid);
              applyProfile(refreshedProfile);
            }
          }
        } else if (profile.source === "health") {
          setPermissionState("revoked");
        } else {
          setPermissionState("denied");
        }
      }
    } catch (error) {
      if (!isExpectedOfflineError(error)) {
        console.log("Failed to load sleep profile", error);
      }
      setFeedback(isExpectedOfflineError(error) ? null : "Unable to load sleep data right now.");
    } finally {
      setLoading(false);
    }
  }, [uid, applyProfile]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setUid(null);
        setAccountLabel(null);
        setRedirectTo("/auth/sign-in");
        setLoading(false);
        return;
      }
      setUid(user.uid);
      setAccountLabel(user.email?.trim() || user.uid);
      setRedirectTo(null);
      void getUserData(user.uid).then((data) => {
        const target = data?.sleepSettings?.targetHours;
        if (typeof target === "number" && target > 0) {
          setSleepTargetHours(Math.round(target * 10) / 10);
        }
      });
    });
    return unsub;
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshSleep({ autoSync: true });
      return undefined;
    }, [refreshSleep])
  );

  const sourceLabel = useMemo(() => {
    if (sleepSource !== "health") return "Manual";
    return sleepOriginLabel ?? "Health Connect";
  }, [sleepSource, sleepOriginLabel]);
  const fallbackLastNightDateKey = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
      now.getDate()
    ).padStart(2, "0")}`;
  }, []);
  const lastNightSummary = useMemo(
    // "Last night" means the most recent completed sleep episode.
    () => recentNightlyHours[0] ?? null,
    [recentNightlyHours]
  );
  const trendAverage = useMemo(() => {
    if (!recentNightlyHours.length) return null;
    const total = recentNightlyHours.reduce((sum, item) => sum + item.sleepHours, 0);
    return Math.round((total / recentNightlyHours.length) * 10) / 10;
  }, [recentNightlyHours]);
  const trendConsistencyPct = useMemo(() => {
    if (!recentNightlyHours.length) return null;
    const onTargetDays = recentNightlyHours.filter((item) => item.sleepHours >= 7).length;
    return Math.round((onTargetDays / recentNightlyHours.length) * 100);
  }, [recentNightlyHours]);
  const sampleAgeHours = useMemo(() => {
    if (!sampleRecordedAt) return null;
    const diffMs = Date.now() - sampleRecordedAt.getTime();
    if (diffMs < 0) return 0;
    return Math.round((diffMs / (60 * 60 * 1000)) * 10) / 10;
  }, [sampleRecordedAt]);
  const isStale = useMemo(() => {
    if (sleepSource !== "health") return false;
    if (sampleAgeHours == null) return true;
    return sampleAgeHours > HEALTH_SLEEP_STALE_HOURS;
  }, [sleepSource, sampleAgeHours]);
  const lastNightStatus = useMemo(
    () => classifySleepVsTarget(lastNightSummary?.sleepHours ?? null, sleepTargetHours),
    [lastNightSummary, sleepTargetHours]
  );
  const lastNightDeltaText = useMemo(
    () => getSleepDeltaText(lastNightSummary?.sleepHours ?? null, sleepTargetHours),
    [lastNightSummary, sleepTargetHours]
  );
  const recoveryHint = useMemo(
    () => getSleepRecoveryHint(lastNightStatus, trendConsistencyPct),
    [lastNightStatus, trendConsistencyPct]
  );

  const performSync = async (activeUid: string) => {
    const result = await syncSleepFromHealthConnect(activeUid);
    switch (result.status) {
      case "success":
        setFeedback(`Synced ${result.sleepHours.toFixed(1)} hours from Health Connect.`);
        break;
      case "permission_denied":
        setPermissionState(sleepSource === "health" ? "revoked" : "denied");
        setFeedback("Permission is required to sync sleep from Health Connect.");
        break;
      case "no_data":
        setFeedback("No sleep sessions found for the previous night window.");
        break;
      case "provider_update_required":
        setFeedback("Download or update Health Connect from the Play Store.");
        break;
      case "unavailable":
      case "unsupported":
        setFeedback("Health Connect is not available on this device.");
        break;
      default:
        setFeedback(result.message);
        break;
    }
    await refreshSleep({ resetFeedback: false });
  };

  const handleSync = async () => {
    if (!uid) return;
    if (isOffline) {
      setFeedback("You're offline. Reconnect to sync sleep from Health Connect.");
      return;
    }
    if (loading) {
      setFeedback("Still checking sleep access. Try again in a moment.");
      return;
    }
    if (availability === "provider_update_required") {
      setFeedback("Sync is unavailable until Health Connect is installed or updated.");
      return;
    }
    if (availability !== "available") {
      setFeedback("Health Connect is not available right now. If you're offline, reconnect and try again.");
      return;
    }
    if (permissionState !== "granted") {
      setFeedback("Sync is unavailable until Sleep permission is granted in Health Connect.");
      return;
    }

    const confirmationKey = `${SLEEP_SYNC_CONFIRM_KEY_PREFIX}:${uid}`;
    const confirmationValue = await AsyncStorage.getItem(confirmationKey);
    if (confirmationValue !== "true") {
      showAppDialog({
        title: "Confirm account for sleep sync",
        message: `Import this device's Health Connect sleep data into ${accountLabel ?? "the current account"}?`,
        buttons: [
          { text: "Cancel", role: "cancel" },
          {
            text: "Import",
            role: "default",
            onPress: () => {
              void (async () => {
                await AsyncStorage.setItem(confirmationKey, "true");
                await performSync(uid);
              })();
            },
          },
        ],
      });
      return;
    }
    await performSync(uid);
  };

  const handleManualOverride = async () => {
    if (!uid || savingOverride) return;
    const parsed = Number(manualOverrideHours.trim());
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 24) {
      setFeedback("Enter a valid sleep value between 0 and 24 hours.");
      return;
    }
    const overrideDateKey = lastNightSummary?.dateKey ?? fallbackLastNightDateKey;
    setSavingOverride(true);
    try {
      await saveManualSleepForDateKey(uid, parsed, overrideDateKey);
      setFeedback(`Saved manual sleep override for ${overrideDateKey}.`);
      setManualOverrideHours("");
      await refreshSleep({ resetFeedback: false });
    } catch (error) {
      if (!isExpectedOfflineError(error)) {
        console.log("Failed to save manual override", error);
      }
      setFeedback("Unable to save manual sleep override right now.");
    } finally {
      setSavingOverride(false);
    }
  };

  const canSyncSleep = permissionState === "granted" && availability === "available" && !loading;
  const syncUnavailableMessage =
    availability === "provider_update_required"
      ? "Sync is unavailable until Health Connect is installed or updated."
      : permissionState !== "granted"
        ? "Sync is unavailable until Sleep permission is granted in Health Connect."
        : loading
          ? "Checking sleep access..."
          : null;

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
          <Text style={styles.subText}>
            Linked account: {accountLabel ?? "Not signed in"}
          </Text>
          <Text style={styles.valueText}>
            {lastNightSummary ? `${lastNightSummary.sleepHours.toFixed(1)} hours` : "No sample yet"}
          </Text>
          <Text style={styles.subText}>
            Target: {sleepTargetHours.toFixed(1)}h
            {lastNightDeltaText ? ` (${lastNightDeltaText})` : ""}
          </Text>
          <Text style={styles.subText}>Recorded at: {formatTimestamp(sampleRecordedAt)}</Text>
          <Text style={styles.subText}>Last sync: {formatTimestamp(lastSyncedAt)}</Text>
          <Text style={styles.subText}>Sleep source: {sourceLabel}</Text>
          <Text style={styles.subText}>{recoveryHint}</Text>
          {sleepSource === "health" && isStale ? (
            <Text style={styles.warningText}>
              Health sleep sample is stale. Decision flow will fall back to manual sleep.
            </Text>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Sleep trends</Text>
          <Text style={styles.subText}>
            7-day average: {trendAverage == null ? "—" : `${trendAverage.toFixed(1)}h`}
          </Text>
          <Text style={styles.subText}>
            {"Consistency (>=7h): "}
            {trendConsistencyPct == null ? "—" : `${trendConsistencyPct}%`}
          </Text>
          <View style={styles.trendList}>
            {recentNightlyHours.length ? (
              recentNightlyHours.map((item) => (
                <View key={item.dateKey} style={styles.trendRow}>
                  <Text style={styles.subText}>{item.dateKey}</Text>
                  <Text style={styles.trendHours}>{item.sleepHours.toFixed(1)}h</Text>
                </View>
              ))
            ) : (
              <Text style={styles.subText}>No recent sleep records yet.</Text>
            )}
          </View>
          <View style={styles.overrideRow}>
            <TextInput
              placeholder="Manually record last night hours (e.g. 7.5)"
              placeholderTextColor="#7a7a8c"
              style={styles.overrideInput}
              keyboardType="decimal-pad"
              value={manualOverrideHours}
              onChangeText={setManualOverrideHours}
            />
            <TouchableOpacity
              style={[styles.overrideButton, savingOverride && styles.disabled]}
              disabled={savingOverride}
              onPress={handleManualOverride}
            >
              <Text style={styles.overrideButtonText}>{savingOverride ? "Saving..." : "Save manual entry"}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Quick sync</Text>
          <Pressable
            style={[styles.primaryButton, (!canSyncSleep || loading) && styles.disabled]}
            disabled={false}
            hitSlop={8}
            onPress={handleSync}
          >
            <Text style={styles.primaryButtonText}>Sync sleep</Text>
          </Pressable>
          {syncUnavailableMessage ? (
            <Text style={styles.subText}>{syncUnavailableMessage}</Text>
          ) : null}
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
  valueTextSmall: { color: "#fff", fontSize: 15, fontWeight: "700" },
  subText: { color: MUTED, fontSize: 12, lineHeight: 16 },
  warningText: { color: "#fbbf24", fontSize: 12, lineHeight: 16 },
  primaryButton: {
    backgroundColor: ACCENT,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  primaryButtonText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  secondaryButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 8,
  },
  secondaryButtonText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  disabled: { opacity: 0.6 },
  trendList: {
    marginTop: 4,
    gap: 6,
  },
  trendRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  trendHours: { color: "#fff", fontSize: 12, fontWeight: "600" },
  overrideRow: { marginTop: 8, gap: 8 },
  overrideInput: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderColor: "rgba(255,255,255,0.2)",
    borderWidth: 1,
    borderRadius: 12,
    color: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
  },
  overrideButton: {
    backgroundColor: "rgba(123,97,255,0.25)",
    borderRadius: 12,
    alignItems: "center",
    paddingVertical: 10,
  },
  overrideButtonText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  feedbackText: {
    color: MUTED,
    fontSize: 13,
    textAlign: "center",
    marginTop: 4,
  },
});
